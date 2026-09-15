# Podcast Import UI fix

## Root cause

`AdminPage.jsx` renders `AdminPodcastImport.jsx` for the Import Podcast workspace. Its state already defaulted to `rss` and correctly mounted `PodcastUrlImport.jsx` only when `video` was selected. The podcast buttons reused `audio-import-tabs`, but that class's styles were emitted inside the separate `AdminMusicImport.jsx` component. When Music Import was not mounted, the podcast buttons had no gap, padding or active styling. They also used `aria-pressed` while the borrowed active selector expected `.selected`.

Mobile verification found an additional layout issue: the existing Admin container kept its main content and mobile navigation in a horizontal flex row, squeezing the form out of view. The fix applies a vertical layout only while Podcast Import is present.

## Files changed for this task

- `src/features/admin/components/AdminPodcastImport.jsx`: dedicated tab classes, pressed state, labelled content region, connected RSS input label and stylesheet import.
- `src/features/admin/components/PodcastUrlImport.jsx`: URL form heading/help, published catalog selection, selected podcast artwork, validation gating, empty state and safe error presentation; removed component-local inline styles.
- `src/features/admin/components/PodcastImport.css`: independent, scoped tab/form styling, focus outlines, mobile layout and touch targets.
- `tests/podcast-import-ui.spec.js`: 15 focused tests.
- This report. Build and test runs also regenerate frontend output and screenshots.

Existing unrelated edits were preserved. No player, queue, lyrics, authentication, Supabase security, Edge function, worker, yt-dlp, ffmpeg or Storage implementation was changed by this task. RSS fetching/parsing/insertion and its queue manager remain unchanged.

## Tab state and visual behavior

The existing `tab = 'rss' | 'video'` state is retained. RSS is selected by default. Exactly one form branch is mounted inside `podcast-import-panel`; switching back restores the existing RSS URL draft and its queue state. URL episode jobs remain under the URL tab, and RSS jobs remain under RSS.

Both buttons have rounded surfaces, a visible 10 px gap (8 px on small mobile), a dark bordered container, a violet/blue active gradient, subdued inactive text and visible cyan keyboard focus. Native button semantics provide Tab/Enter/Space access; `aria-pressed` announces selection and the content region is labelled by the selected button.

## TikTok / YouTube integration

The form now shows Import TikTok / YouTube Episode, Source URL and the requested authorized-media helper text. A separate badge identifies the detected platform without changing the input's accessible label.

The selector uses the app's existing published podcast catalog instead of another podcast query. Native selection stays usable on mobile; selected artwork and title appear in a preview when a cover exists. No published podcasts produces: No published podcasts available. Create or publish a podcast first.

Import Episode is disabled until the existing source validator accepts the URL, a published podcast is selected and permission is confirmed. Guidance distinguishes an invalid URL, missing podcast and missing permission. Optional fields remain optional. The submit handler independently validates the required selections.

Submission still uses `createImportJob` from the existing `audioImport.js` helper, with:

```json
{
  "source_type": "podcast_episode_url",
  "source_url": "validated/canonical URL",
  "podcast_id": "selected published podcast ID",
  "metadata": {
    "title": "optional",
    "description": "optional",
    "cover_url": null,
    "episode_number": null,
    "season_number": null,
    "authorized": true
  }
}
```

Browser tests intercept the existing Edge endpoint and verify both YouTube and TikTok requests, canonical source URL, target, optional metadata and permission. They also verify the RSS fetch path is not called. No API helper or queue system was duplicated. Existing three-second job polling, stage display, retry/cancel and catalog refresh remain intact.

Errors are mapped to fixed user-facing messages for duplicate sources, selection, permission, invalid sources, unpublished/missing podcasts, session problems and service failures. Unrecognized internal output becomes a safe failure message. A focused test supplies a command/path/token/stack-like backend response and verifies those details are not rendered.

These are frontend integration tests with mocked Supabase responses. Live media extraction was not run; this UI-only change does not require a migration or backend deployment.

## Responsive verification

| Viewport | Result |
| --- | --- |
| 1920×1080 | PASS |
| 1440×900 | PASS |
| 1280×720 | PASS |
| 768×1024 | PASS |
| 430×932 | PASS |
| 390×844 | PASS |
| 375×667 | PASS |
| 360×800 | PASS |

Checks use real tab clicks and native podcast selection, measure the inter-tab gap and ≥44 px tab heights, and verify form/control bounds and absence of document horizontal overflow. Mobile URL fields fill the form width; optional number fields stack and the primary button has a 48 px touch height. The Admin layout correction is scoped with `:has(.podcast-import-page)` so it does not restyle other workspaces.

Screenshots:

- [Mobile URL tab](audit/podcast-import-ui-390.png)
- [Desktop URL tab](audit/podcast-import-ui-1280.png)

## Verification results

- `npm run build`: PASS. Vite emits the existing main-bundle size warning.
- `npm run lint`: PASS.
- Final Playwright results: PASS, 60/60 tests (31 regression, 14 existing feature upgrade and 15 podcast import UI checks).

Final command includes the requested regression suite and the existing focused upgrade suite:

```powershell
Set-Location 'F:\Music GG'
npx playwright test tests/v2.spec.js tests/feature-upgrade.spec.js tests/podcast-import-ui.spec.js --workers=1 --reporter=list
```

Existing tests were not changed to hide regressions. The new tests cover RSS default/exclusive content, keyboard switching, RSS draft preservation, URL validation, podcast/permission requirements, both platform submissions, selected artwork, empty catalog, safe errors, existing job stages and all eight responsive sizes.
