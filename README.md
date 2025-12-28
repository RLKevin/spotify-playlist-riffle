# Spotify Playlist Riffle

A tool to merge and Spotify playlists efficiently. Perfect for creating an end of year playlist to reflect your (and your friends') listening habits.

## Usage

1. **Setup**:

    - Install dependencies: `npm install`
    - Create a Spotify App in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/).
    - Add `http://127.0.0.1:8888/callback` as a Redirect URI in your Spotify App settings.
    - Create a `.env` file based on `.env.example` and add your credentials.

2. **Run**:
    ```bash
    npm start
    ```
    Follow the on-screen prompts to:
    - Authenticate (if needed).
    - Select playlists from your account.
    - Merge them.
    - Create a new playlist.

## Known Issues
- Spotify no longer returns 'Spotify owned' playlists via the API, so these cannot be selected or merged. Please use collaborative or user-created playlists, or manually create a playlist with the contents of the desired Spotify owned playlist. Source: [Spotify Community](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api).