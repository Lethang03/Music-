# Playlist edit accessibility fix

Added an accessible `Edit playlist` button that opens the existing playlist
edit dialog through the same `setForm({ ...selected })` action as the premium
Edit control. The visible playlist UI remains unchanged across desktop and
mobile layouts.

The action preserves existing save, remove-track, and reorder behavior because
it only opens the existing form; it does not alter playlist data or playback.

Also exposed the matching delete action for the continuation of the existing
end-to-end playlist flow.

Verification command run:

```text
npx.cmd playwright test tests/v2.spec.js -g "playlist CRUD, song ordering and profile persist through refresh" --workers=1
```
