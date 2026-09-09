# Podcast playback lifecycle debug report

## Root cause

`AudioProvider` rendered an inline `<audio>` element. The Playwright fixture
tracks media constructed through `window.Audio`, so `window.testAudio` observed
a different element than the player controlled. The UI could show an active
podcast while the fixture-observed media element remained at `currentTime = 0`.

## Fix

`AudioProvider` now creates exactly one `new Audio()` instance in its effect,
stores it in `audioRef`, and owns its complete lifecycle. The rendered audio
element was removed.

The same instance now handles source assignment, `play`, `pause`,
`loadedmetadata`, `timeupdate`, persistence, and cleanup. In React Strict Mode,
the cleanup fully stops and clears the first development-only instance before
the active instance is created, so no stale instance remains playable.

Podcast resume remains one-shot: a saved position is retained until
`loadedmetadata`, assigned to `audio.currentTime` once, and then cleared. It is
not reapplied during `timeupdate` or playback.

## Verification

Passed:

```text
npx.cmd playwright test tests/v2.spec.js -g "podcast resume restores the saved offset after metadata loads" --workers=1
```

Result: 1 passed. The test verifies natural Episode 1 time advancement, a
paused saved offset, reload restoration after metadata, and restarting playback.

Music controls, visible UI, and admin code were unchanged.
