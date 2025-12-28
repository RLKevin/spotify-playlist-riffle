require('dotenv').config();
const fs = require('fs');
const path = require('path');
const SpotifyWebApi = require('spotify-web-api-node');
const inquirer = require('inquirer');
const { spawn } = require('child_process');

const tokensPath = path.join(__dirname, 'spotify_tokens.json');

async function main() {
	console.log('Welcome to Spotify Playlist Riffle!');

	// 1. Check Authentication
	if (!fs.existsSync(tokensPath)) {
		console.log('Authentication required. Launching auth.js...');
		await runAuth();
	}

	// Load tokens
	let tokens = JSON.parse(fs.readFileSync(tokensPath));
	const spotifyApi = new SpotifyWebApi({
		clientId: process.env.SPOTIFY_CLIENT_ID,
		clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
		redirectUri:
			process.env.SPOTIFY_REDIRECT_URI ||
			'http://127.0.0.1:8888/callback',
	});

	spotifyApi.setAccessToken(tokens.access_token);
	spotifyApi.setRefreshToken(tokens.refresh_token);

	// Refresh token
	try {
		const data = await spotifyApi.refreshAccessToken();
		spotifyApi.setAccessToken(data.body['access_token']);

		// Update tokens file
		tokens.access_token = data.body['access_token'];
		if (data.body['refresh_token'])
			tokens.refresh_token = data.body['refresh_token'];
		fs.writeFileSync(tokensPath, JSON.stringify(tokens));
	} catch (err) {
		console.log('Error refreshing token. Please re-authenticate.');
		await runAuth();
		// Reload tokens after re-auth
		tokens = JSON.parse(fs.readFileSync(tokensPath));
		spotifyApi.setAccessToken(tokens.access_token);
		spotifyApi.setRefreshToken(tokens.refresh_token);
	}

	// 2. Get User Info & Playlists
	const me = await spotifyApi.getMe();
	console.log(`Logged in as: ${me.body.display_name}`);

	console.log('Fetching your playlists...');
	const userPlaylists = await getAllUserPlaylists(spotifyApi);

	if (userPlaylists.length < 2) {
		console.log('You need at least 2 playlists to merge.');
		return;
	}

	// 3. Prompt Selection
	const answers = await inquirer.prompt([
		{
			type: 'checkbox',
			name: 'selectedPlaylists',
			message:
				'Select playlists to merge (space to select, enter to confirm):',
			choices: userPlaylists.map((p) => ({
				name: `${p.name} (${p.tracks.total} tracks)`,
				value: p.id,
			})),
			pageSize: 15,
			validate: (answer) => {
				if (answer.length < 2) {
					return 'You must choose at least 2 playlists.';
				}
				return true;
			},
		},
	]);

	// 4. Fetch Tracks
	console.log('Fetching tracks from selected playlists...');
	const playlistsTracks = [];
	for (const playlistId of answers.selectedPlaylists) {
		const tracks = await getAllPlaylistTracks(spotifyApi, playlistId);
		// Store URI and duration
		playlistsTracks.push(
			tracks.map((t) => ({
				uri: t.track.uri,
				duration_ms: t.track.duration_ms,
			}))
		);
	}

	// 5. Merge (Riffle Shuffle)
	let mergedTracks = riffleShuffle(playlistsTracks);
	console.log(`Merged ${mergedTracks.length} tracks.`);

	// 6. Ask for Options
	const options = await inquirer.prompt([
		{
			type: 'confirm',
			name: 'removeDuplicates',
			message: '1. Remove duplicates?',
			default: true,
		},
		{
			type: 'confirm',
			name: 'enableTimeLimit',
			message: '2. Set a time limit?',
			default: false,
		},
		{
			type: 'number',
			name: 'timeLimitMinutes',
			message: '   Enter time limit in minutes:',
			when: (answers) => answers.enableTimeLimit,
			validate: (value) =>
				value > 0 ? true : 'Please enter a positive number.',
		},
		{
			type: 'confirm',
			name: 'reverse',
			message: '3. Reverse playlist?',
			default: false,
		},
		{
			type: 'input',
			name: 'newPlaylistName',
			message: 'Enter a name for the new playlist:',
			default: `Riffle Merged ${new Date().toISOString().split('T')[0]}`,
		},
	]);

	// Apply Options

	// 1. Remove Duplicates
	if (options.removeDuplicates) {
		const seen = new Set();
		mergedTracks = mergedTracks.filter((track) => {
			if (seen.has(track.uri)) return false;
			seen.add(track.uri);
			return true;
		});
		console.log(
			`Duplicates removed. Count: ${mergedTracks.length} tracks.`
		);
	}

	// 2. Time Limit
	if (options.enableTimeLimit && options.timeLimitMinutes) {
		const limitMs = options.timeLimitMinutes * 60 * 1000;
		let currentDuration = 0;
		const limitedTracks = [];
		for (const track of mergedTracks) {
			if (currentDuration + track.duration_ms <= limitMs) {
				limitedTracks.push(track);
				currentDuration += track.duration_ms;
			} else {
				break;
			}
		}
		mergedTracks = limitedTracks;
		console.log(
			`Time limit applied. Count: ${
				mergedTracks.length
			} tracks (${Math.floor(currentDuration / 60000)} mins).`
		);
	}

	// 3. Reverse
	if (options.reverse) {
		mergedTracks.reverse();
		console.log('Playlist reversed.');
	}

	if (mergedTracks.length === 0) {
		console.log('No tracks to add.');
		return;
	}

	const finalUris = mergedTracks.map((t) => t.uri);

	// 7. Create Playlist
	console.log(`Creating playlist "${options.newPlaylistName}"...`);
	const newPlaylist = await spotifyApi.createPlaylist(
		options.newPlaylistName,
		{
			description: 'Created via Spotify Playlist Riffle',
			public: false,
		}
	);

	// 8. Add Tracks
	console.log('Adding tracks...');
	const chunkSize = 100;
	for (let i = 0; i < finalUris.length; i += chunkSize) {
		const chunk = finalUris.slice(i, i + chunkSize);
		await spotifyApi.addTracksToPlaylist(newPlaylist.body.id, chunk);
		process.stdout.write(
			`\rAdded ${Math.min(i + chunkSize, finalUris.length)}/${
				finalUris.length
			} tracks...`
		);
	}
	console.log('\nDone! Enjoy your playlist.');
}

// --- Helper Functions ---

function runAuth() {
	return new Promise((resolve, reject) => {
		console.log('Starting authentication process...');
		// Use spawn to inherit stdio so user can see the output and interact if needed
		const child = spawn('node', ['auth.js'], { stdio: 'inherit' });

		child.on('close', (code) => {
			if (code === 0) {
				console.log('Authentication successful.');
				resolve();
			} else {
				reject(new Error(`Auth process exited with code ${code}`));
			}
		});
	});
}

async function getAllUserPlaylists(spotifyApi) {
	let playlists = [];
	let offset = 0;
	let limit = 50;
	let hasMore = true;

	while (hasMore) {
		// Pass undefined as the first argument to explicitly target /v1/me/playlists
		// This ensures we get both owned and followed playlists
		const data = await spotifyApi.getUserPlaylists(undefined, {
			limit,
			offset,
		});
		playlists = playlists.concat(data.body.items);
		offset += limit;
		hasMore = data.body.next !== null;
	}
	return playlists;
}

async function getAllPlaylistTracks(spotifyApi, playlistId) {
	let tracks = [];
	let offset = 0;
	let limit = 100;
	let hasMore = true;

	while (hasMore) {
		const data = await spotifyApi.getPlaylistTracks(playlistId, {
			limit,
			offset,
		});
		// Filter out null tracks (can happen if tracks are unavailable)
		const validTracks = data.body.items.filter(
			(item) => item.track && item.track.uri
		);
		tracks = tracks.concat(validTracks);
		offset += limit;
		hasMore = data.body.next !== null;
	}
	return tracks;
}

function riffleShuffle(playlistsTracks) {
	// playlistsTracks is an array of arrays of track URIs
	const maxLen = Math.max(...playlistsTracks.map((p) => p.length));
	const merged = [];

	for (let i = 0; i < maxLen; i++) {
		for (let j = 0; j < playlistsTracks.length; j++) {
			const playlist = playlistsTracks[j];
			if (i < playlist.length) {
				merged.push(playlist[i]);
			}
		}
	}
	return merged;
}

main().catch((err) => console.error(err));
