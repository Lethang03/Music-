# Playlist remove-track accessibility fix

Added a track-specific accessible remove action for every playlist item. Each
uses the existing `savePlaylist` persistence path and removes only that track
ID from the selected playlist, updating local state immediately after save.

For example, the first fixture item exposes `button "Remove Track 1"`.
Playback, edit/save, and track reordering are unchanged.

Verification command:

```text
npx.cmd playwright test tests/v2.spec.js -g "playlist CRUD, song ordering and profile persist through refresh" --workers=1
```
