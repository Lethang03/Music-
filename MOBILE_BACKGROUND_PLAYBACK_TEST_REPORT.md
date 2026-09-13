# SoundVerse Mobile Background Playback Test

## Final Status

| Environment | Status | What is proven |
| --- | --- | --- |
| Desktop/browser simulation | PARTIAL | Natural end → auto-next uses one media element and browser playback resumes; browser automation cannot prove audible output after a mobile lock. |
| Android real-device | NOT EXECUTED | `adb` is not installed/available on this Windows workstation. |
| iPhone real-device | NOT EXECUTED | iOS Safari lock-screen audio cannot be emulated faithfully by Windows Playwright. |

## Critical Scenario

| Stage | Browser evidence | Real locked-phone conclusion |
| --- | --- | --- |
| Track A playing | `playing` / time advancement captured by the existing suite | Not tested on a phone |
| Track A ends | `ended` event asserted by the natural-end regression tests | Not tested on a phone |
| Track B selected | Queue progression and subsequent Track B source are asserted | Not tested on a phone |
| Track B play requested | Shared `handleNext(true)` changes the single element source and awaits `play()` | Not tested on a phone |
| Track B audio element playing | Browser `playing` event and increasing `currentTime` are asserted | Not proof of real background audibility |
| Track B audible while locked | Cannot be measured by browser automation | NOT EXECUTED |

Therefore, the question “can SoundVerse keep playing and auto-advance with audible audio while the phone is locked?” is **not yet answered by a real-device result**.

## Playback Architecture

- Global playback creates **one persistent `HTMLAudioElement`** in `AudioProvider`; it is reused across source transitions and route changes.
- The admin-only track preview can create a separate temporary preview element, but it is not part of global playback or auto-next.
- No `AudioContext`, `webkitAudioContext`, `createMediaElementSource`, `GainNode`, crossfade, or gain state is present.
- `ended` records diagnostics, reports progress, and calls `handleNext(true)`.
- Auto-next selects a queue item, assigns `audio.src` on the same global element, calls `load()`, and awaits `audio.play()`.
- Media Session metadata is refreshed from the newly active item; its action handlers use the provider controls.
- `visibilitychange` and `pagehide` are observed for diagnostics/persistence. They do not recreate the media element.

## Logs

The existing local-only diagnostic log is `soundverse_playback_diagnostics`. It retains 200 sanitized entries and records source origin/path (without query strings), media state, volume/mute state, visibility state, and `audioContextState: "not-used"`.

Relevant expected transition sequence:

`PLAYING (A)` → `ENDED (A)` → `NEXT_SELECTED (B)` → `SOURCE_CHANGED (B)` → `PLAY_REQUEST (B)` → `PLAY_SUCCESS (B)` → `LOADEDMETADATA/CANPLAY/PLAYING (B)`.

## Silent Track Investigation

No silent-track failure was reproduced in the desktop browser fixture. Existing natural-ending tests verify source progression, `playing` events, time advancement, and that only one global fixture audio element has a source.

There is no evidence of an AudioContext suspension, zero gain, muted/zero-volume state, wrong `MediaElementSource`, crossfade state, or React-only state transition: those systems are absent or the actual native element is explicitly updated. A WebKit/iOS background-media restriction remains a possible platform-specific cause, but it is **not proven** without a real iPhone run.

## Automated Tests

- Build: PASS.
- Lint: PASS.
- Playwright: the previously recorded JSON report shows 29 expected / 0 unexpected desktop tests. The fresh requested 31-test list-reporter worker finished without an `error-message.md` failure artifact, but this environment orphaned the Vite child before returning the reporter summary; the verified test server was stopped. Record the fresh run as INCONCLUSIVE until rerun in a normal terminal, and never interpret it as an iPhone test.

## Real Device Test Instructions

### Android

1. Install/run SoundVerse on an authorized Android device and prepare two short tracks in order.
2. Start Track A, lock the device, and leave it locked through Track A’s ending.
3. Listen for Track B. Unlock and inspect `soundverse_playback_diagnostics` in remote DevTools if available.
4. With Android platform tools available, run `adb shell dumpsys media_session` before and after the transition; record active session state plus title/artist metadata.
5. Pass only if Track A remains audible locked and Track B starts audibly, with metadata updated.

### iPhone

1. Open SoundVerse in Safari and queue two short songs.
2. Start Track A and confirm its lock-screen title/artwork.
3. Lock the iPhone and leave it locked until Track A ends.
4. Listen for Track B, then unlock and check title/artwork and `soundverse_playback_diagnostics` via Safari Remote Web Inspector.
5. Pass only if both tracks are audible while locked and Track B’s lock-screen metadata updates. Fail if Track B appears/progresses but produces no sound, or if playback stops.

## Suspected Root Cause

No code-level root cause is supported by the current browser evidence. The remaining risk is a WebKit/iOS background playback policy or device-specific media-session behavior that browser automation cannot reproduce. No production playback changes were made during this test/diagnosis task.
