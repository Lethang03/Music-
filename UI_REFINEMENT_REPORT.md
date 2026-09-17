# SoundVerse interface refinement

## Delivered

- Music hero: stronger title and metadata hierarchy, layered navy/violet/cyan lighting, a music-note tile, orbit details and subtle animated bars. Mobile keeps a quieter decorative treatment behind readable copy.
- Shared layout: consistent page spacing even on direct navigation, clearer search/Settings/avatar spacing, inherited input typography and visible focus states.
- Mobile bottom area: one shared safe-area calculation for navigation, mini player and scroll clearance; `viewport-fit=cover` enables iPhone safe-area handling.
- Profile: compact identity card, clearer actions, balanced three-column statistics and readable wrapped account details.
- Admin: section navigation above mobile content; one app-owned vertical scroll area; visible table headings/data in an explicitly scrollable table; distinct title/artist lines; reachable editor footer and brand-aligned publish button.
- Full player: viewport-filling presentation above the app chrome, larger artwork, soft ambient lighting, breathing artwork, refined progress and playback controls, segmented queue/lyrics buttons and current-line lyric highlighting.
- Queue actions retain their behavior and now have accessible names for moving tracks. Reduced-motion settings disable decorative animation and artwork tilt.

## Implementation

Extracted Music, layout and player CSS from inline JSX style blocks into component stylesheets. Rebuilt the player stylesheet and separated shared interface styles into `src/styles/interface.css`. Used the existing brand and spacing tokens, with a shared bottom safe-area token.

The playback engine, audio lifecycle, routing, Supabase client, admin data operations, worker services and earlier service-worker fix were not changed. GlobalPlayer edits are presentation and accessibility changes around existing handlers. The new UI test confirms queue reordering keeps the same audio element.

Main files: `MusicLibrary.jsx/css`, `GlobalPlayer.jsx/css`, `SyncedLyrics.css`, layout components plus `Layout.css`, `Profile.jsx`, admin layout/styles, shared `interface.css`, `main.css`, `variables.css`, and the viewport meta tag in `index.html`.

## Visual review

Only the text brief was attached; reference screenshots were not included. The screenshots below were generated from local fixture data, not the production music catalog. Each viewport includes Music, full player, lyrics, Profile and Admin captures.

| View | Preview |
| --- | --- |
| Desktop Music | [1440px](audit/ui-redesign/music-1440.png) |
| Mobile Music | [390px](audit/ui-redesign/music-390.png) |
| Mobile player | [390px](audit/ui-redesign/player-390.png) |
| Mobile lyrics | [390px](audit/ui-redesign/lyrics-390.png) |
| Mobile Profile | [390px](audit/ui-redesign/profile-390.png) |
| Mobile Admin | [390px](audit/ui-redesign/admin-390.png) |
| Mobile editor actions | [390px](audit/ui-redesign/admin-editor-actions-390.png) |

All captures are in `audit/ui-redesign/`, including 430px, 768px and 1920px variants. Admin tables intentionally scroll horizontally to keep all fields and actions available. Long song titles wrap in the full player and queue; compact catalog/mini-player titles retain ellipsis.

## Validation

- Build and lint: passed.
- New interface tests: six viewport/reduced-motion checks plus one mobile editor check passed. They cover scroll width, player controls, visible lyrics, queue reordering, stable audio identity, profile statistics clearance, admin labels and editor actions.
- `npx playwright test tests/v2.spec.js tests/feature-upgrade.spec.js --workers=1 --reporter=list`: 45 passed (31 V2 and 14 feature/lyrics tests).
- Visual review caught and fixed decorative-background overflow and run-together admin title/artist text. A new desktop test selector was scoped to Profile to avoid matching the sidebar's identical Admin link. Existing tests were not edited.

Physical iPhone/Safari testing was not performed. Safe-area clearance was checked in Chrome with a simulated 34px bottom inset; mobile viewports and reduced-motion behavior were also checked. No production deployment was performed.
