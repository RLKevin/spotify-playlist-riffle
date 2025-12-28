# Spotify Playlist Riffle
A tool to merge and Spotify playlists efficiently. Perfect for creating an end of year playlist to reflect your (and your friends') listening habits.

## Usage
1. Clone the repository.
2. Export your Spotify playlists as CSV files from here: https://www.spotlistr.com/export/spotify-playlist.
3. Place the exported CSV files in the `lists/` directory.
4. Run the script to merge playlists:
   ```bash
   node mergePlaylists.js
   ```
5. The merged playlist will be saved as `merged.csv` in the project root.
6. Import the `merged.csv` file back into Spotify using Spotlistr: https://www.spotlistr.com/search/textbox.