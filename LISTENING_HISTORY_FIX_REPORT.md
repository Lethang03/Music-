# Listening history fix report

Added a visible native `h2` heading named `Listening history` to the Library
page. The section renders the existing activity-backed `history` rows and uses
the same resume-aware playback action as the existing library history entries.

Favorite content, local/cloud refresh persistence, and logout clearing remain
unchanged because the section consumes the existing LibraryContext data only.

Verification command:

```text
npx.cmd playwright test tests/v2.spec.js -g "favorites and real history survive refresh; logout clears private UI and audio" --workers=1
```
