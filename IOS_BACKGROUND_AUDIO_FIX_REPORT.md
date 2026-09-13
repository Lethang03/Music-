# iOS Background Audio Transition Fix

## Root cause

The global engine already used a single persistent `HTMLAudioElement`; there was no `AudioContext`, `webkitAudioContext`, `GainNode`, `createMediaElementSource`, or crossfade implementation. The transition flow did assign the next source on that persistent element, but `audio.play()` was fire-and-forget and rejected promises (including iOS media-interruption failures) were either suppressed for generation changes or reduced to a generic message. This made UI queue state look advanced even when a real media start could not be confirmed.

## Fix

- `AudioContext.jsx` has one awaited `safePlay()` path that records `PLAY_REQUEST`, `PLAY_SUCCESS`, and `PLAY_REJECTED` and presents the exact useful failure category to the listener.
- Manual Next, natural `ended`, and the Media Session `nexttrack` action all call the same `handleNext(false)` queue transition function.
- The same global audio element is paused, assigned the new source, loaded, and played for every transition. No element is created during Next/ended transitions.
- Media Session metadata still updates from the new active item after the state transition.
- Standard native HTML audio output remains in use, which avoids a suspended Web Audio graph on iOS because none is involved.

## iPhone diagnostics

After reproducing an issue, inspect `localStorage.getItem('soundverse_playback_diagnostics')` in a remote Safari Web Inspector. It retains the most recent 200 events. Each entry contains timestamp, visibility state, track ID/title, sanitized audio origin/path, paused/current-time/readiness/network/volume/mute values, and `audioContextState: "not-used"`. URL query strings are deliberately excluded so signed media URLs and secrets are not stored.

Events include `MANUAL_NEXT`, `ENDED`, `NEXT_SELECTED`, `SOURCE_CHANGED`, media readiness/playback/error events, play promise outcomes, and visibility changes.

## Files changed

- `src/contexts/AudioContext.jsx`
- `src/lib/playbackDiagnostics.js`
- `tests/fixtures.js`
- `tests/v2.spec.js`

## Regression results

- `npm run build`: passed
- `npm run lint`: passed
- `npx playwright test tests/v2.spec.js --workers=1`: the 31-test worker completed and no `error-message.md` artifact was produced, but this environment's Playwright launcher/Vite server remained orphaned and did not emit its final summary. The verified orphaned processes were stopped. Treat this run as inconclusive until it is rerun in a terminal that returns the reporter exit status.
