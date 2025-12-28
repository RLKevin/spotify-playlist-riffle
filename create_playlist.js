require('dotenv').config();
const SpotifyWebApi = require('spotify-web-api-node');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const tokensPath = path.join(__dirname, 'spotify_tokens.json');
const mergedCsvPath = path.join(__dirname, 'merged.csv');

if (!fs.existsSync(tokensPath)) {
	console.error(
		'Error: spotify_tokens.json not found. Please run "node auth.js" first.'
	);
	process.exit(1);
}

if (!fs.existsSync(mergedCsvPath)) {
	console.error(
		'Error: merged.csv not found. Please run "node merge_playlists.js" first.'
	);
	process.exit(1);
}

// Load tokens
const tokens = JSON.parse(fs.readFileSync(tokensPath));

const spotifyApi = new SpotifyWebApi({
	clientId: process.env.SPOTIFY_CLIENT_ID,
	clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
	redirectUri:
		process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:8888/callback',
});

spotifyApi.setAccessToken(tokens.access_token);
spotifyApi.setRefreshToken(tokens.refresh_token);

async function main() {
	try {
		// 1. Refresh the token
		const data = await spotifyApi.refreshAccessToken();
		spotifyApi.setAccessToken(data.body['access_token']);

		// Save new access token
		tokens.access_token = data.body['access_token'];
		if (data.body['refresh_token']) {
			tokens.refresh_token = data.body['refresh_token'];
		}
		fs.writeFileSync(tokensPath, JSON.stringify(tokens));

		// 2. Get User Info
		const me = await spotifyApi.getMe();
		console.log(`Logged in as ${me.body.display_name} (${me.body.id})`);

		// 3. Read and Parse CSV
		const fileContent = fs.readFileSync(mergedCsvPath, 'utf-8');
		const lines = fileContent
			.split(/\r?\n/)
			.filter((line) => line.trim().length > 0);

		// Remove header if it exists (assuming first line is header)
		if (
			lines.length > 0 &&
			(lines[0].includes('Arist') || lines[0].includes('Artist'))
		) {
			lines.shift();
		}

		const tracksToFind = lines
			.map((line) => {
				// Simple CSV parsing (assuming no commas in fields for now, or handle quotes later if needed)
				// The example showed "Arist(s) Name,Track Name"
				const parts = line.split(',');
				if (parts.length >= 2) {
					return {
						artist: parts[0].trim(),
						track: parts.slice(1).join(',').trim(), // Join back in case track name has commas
					};
				}
				return null;
			})
			.filter((item) => item !== null);

		console.log(`Found ${tracksToFind.length} tracks in CSV.`);

		// 4. Search for Tracks
		const trackUris = [];
		console.log('Searching for tracks on Spotify...');

		// Process in chunks to avoid rate limits or long waits without feedback
		for (let i = 0; i < tracksToFind.length; i++) {
			const item = tracksToFind[i];
			try {
				// Search query: "track:Name artist:Name"
				// Sometimes strict matching fails, so we can try a broader search if needed
				const query = `track:${item.track} artist:${item.artist}`;
				const searchResult = await spotifyApi.searchTracks(query);

				if (searchResult.body.tracks.items.length > 0) {
					const track = searchResult.body.tracks.items[0];
					// console.log(`Found: ${track.name} by ${track.artists[0].name}`);
					trackUris.push(track.uri);
				} else {
					console.log(
						`Could not find: "${item.track}" by "${item.artist}"`
					);
					// Fallback: try searching just by track name and artist name without tags
					const looseQuery = `${item.track} ${item.artist}`;
					const looseResult = await spotifyApi.searchTracks(
						looseQuery
					);
					if (looseResult.body.tracks.items.length > 0) {
						const track = looseResult.body.tracks.items[0];
						console.log(
							`  -> Found with loose search: ${track.name} by ${track.artists[0].name}`
						);
						trackUris.push(track.uri);
					} else {
						console.log(`  -> Still could not find.`);
					}
				}
			} catch (err) {
				console.error(
					`Error searching for ${item.track}:`,
					err.message
				);
			}

			// Add a small delay to be nice to the API
			await new Promise((resolve) => setTimeout(resolve, 100));

			if ((i + 1) % 10 === 0) {
				console.log(
					`Processed ${i + 1}/${tracksToFind.length} tracks...`
				);
			}
		}

		console.log(
			`Found ${trackUris.length} out of ${tracksToFind.length} tracks.`
		);

		if (trackUris.length === 0) {
			console.log('No tracks found. Exiting.');
			return;
		}

		// 5. Create a New Playlist
		const dateStr = new Date().toISOString().split('T')[0];
		const playlistName = `Riffle Merged Playlist ${dateStr}`;

		const newPlaylist = await spotifyApi.createPlaylist(playlistName, {
			description: 'Created via Spotify Playlist Riffle',
			public: false,
		});
		console.log(
			`Created playlist: "${newPlaylist.body.name}" (ID: ${newPlaylist.body.id})`
		);

		// 6. Add Tracks to Playlist
		// Spotify API allows adding max 100 tracks per request
		const chunkSize = 100;
		for (let i = 0; i < trackUris.length; i += chunkSize) {
			const chunk = trackUris.slice(i, i + chunkSize);
			await spotifyApi.addTracksToPlaylist(newPlaylist.body.id, chunk);
			console.log(
				`Added tracks ${i + 1} to ${i + chunk.length} to playlist.`
			);
		}

		console.log('Done! Enjoy your playlist.');
	} catch (err) {
		console.error('Error:', err);
	}
}

main();
