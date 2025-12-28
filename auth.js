require('dotenv').config();
const SpotifyWebApi = require('spotify-web-api-node');
const express = require('express');
const open = require('open');
const fs = require('fs');
const path = require('path');

const scopes = [
	'user-read-private',
	'user-read-email',
	'playlist-read-private',
	'playlist-read-collaborative',
	'playlist-modify-public',
	'playlist-modify-private',
];

const spotifyApi = new SpotifyWebApi({
	clientId: process.env.SPOTIFY_CLIENT_ID,
	clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
	redirectUri:
		process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:8888/callback',
});

const app = express();
const port = 8888;

app.get('/login', (req, res) => {
	res.redirect(spotifyApi.createAuthorizeURL(scopes));
});

app.get('/callback', (req, res) => {
	const error = req.query.error;
	const code = req.query.code;
	const state = req.query.state;

	if (error) {
		console.error('Callback Error:', error);
		res.send(`Callback Error: ${error}`);
		return;
	}

	spotifyApi
		.authorizationCodeGrant(code)
		.then((data) => {
			const access_token = data.body['access_token'];
			const refresh_token = data.body['refresh_token'];
			const expires_in = data.body['expires_in'];

			spotifyApi.setAccessToken(access_token);
			spotifyApi.setRefreshToken(refresh_token);

			// Save tokens to a file for the main script to use
			fs.writeFileSync(
				path.join(__dirname, 'spotify_tokens.json'),
				JSON.stringify({
					access_token,
					refresh_token,
					expires_in,
				})
			);

			res.send('Success! You can now close the window.');
			console.log(
				'Successfully retrieved access token. Tokens saved to spotify_tokens.json'
			);

			// Close the server and exit
			server.close(() => {
				process.exit(0);
			});
		})
		.catch((error) => {
			console.error('Error getting Tokens:', error);
			res.send(`Error getting Tokens: ${error}`);
		});
});

const server = app.listen(port, () => {
	console.log(`HTTP Server up on port ${port}. Opening browser...`);
	open(`http://127.0.0.1:${port}/login`);
});
