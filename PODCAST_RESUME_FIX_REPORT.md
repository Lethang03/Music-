# Podcast resume persistence fix

## Change made

Updated `src/contexts/AudioContext.jsx` so player persistence reads the live
audio element's `currentTime`, rather than relying solely on React state. This
covers pause and `pagehide` events that can occur between `timeupdate` events.

The pending saved position remains pending until the audio element emits
`loadedmetadata`. The handler then clamps the position to the known duration,
sets `audio.currentTime`, and only afterwards clears the pending value. No seek
is attempted before metadata is available.

## Persistence lifecycle

- Periodic: existing `timeupdate` handling persists every five seconds.
- Pause: existing `pause` handling reports and persists immediately.
- Unload: existing `pagehide` handling reports and persists immediately.
- Restore: the saved player position is restored from local storage by the
  `loadedmetadata` handler; podcast activity progress remains available through
  the existing local/cloud activity store.

Music playback, UI, and admin code were not changed.

## Verification

Command run:

```text
npx.cmd playwright test tests/v2.spec.js -g "podcast resume restores the saved offset after metadata loads" --workers=1
```

The run currently fails at the test's first pre-reload poll (line 239): the
fixture's first `window.testAudio` object reports `currentTime === 0`, although
the rendered player snapshot shows Episode 1 at `0:05`. Therefore the test does
not reach its reload/restore assertion in this environment. The persistence
change is scoped to the real media element and metadata event lifecycle.
