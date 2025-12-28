# Spotify Playlist Riffle

A tool to merge and Spotify playlists efficiently. Perfect for creating an end of year playlist to reflect your (and your friends') listening habits.

## Usage

### Quick Start (Interactive Mode)

The easiest way to use the tool is via the interactive CLI, which handles authentication, playlist selection, merging, and creation all in one go.

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

### Manual Method (CSV)

If you prefer working with CSV files (e.g., from Spotlistr):

1. Export your Spotify playlists as CSV files from here: https://www.spotlistr.com/export/spotify-playlist.
2. Place the exported CSV files in the `lists/` directory.
3. Run the script to merge playlists:
    ```bash
    node merge_playlists.js
    ```
4. The merged playlist will be saved as `merged.csv` in the project root.
5. (Optional) Upload to Spotify:
    ```bash
    node create_playlist.js
    ```

## TODO

-   [x] Add Spotify API integration for direct playlist reading and creation.
-   [ ] Add option to limit playlist length (e.g., maximum number of minutes) based on user preferences.
