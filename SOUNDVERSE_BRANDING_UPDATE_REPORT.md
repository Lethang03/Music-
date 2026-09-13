# SoundVerse Branding Update

## Audit and replacements

The old branding consisted of an inline waveform logo in the desktop sidebar, an inline music-note logo in the landing header, and unused legacy `public/icon.svg` / `icon-192.png` / `icon-512.png` assets. Only those brand marks were replaced; playback, podcast, queue, lyrics, auth, admin, and Supabase code were not changed.

`SoundVerseLogo` now provides the shared official logo treatment for the sidebar and landing header. It uses `/branding/soundverse-logo.png`, preserves its square ratio with `object-fit: contain`, and avoids an additional card behind the artwork.

## New web assets

- `/favicon.ico` (contains 16, 32, and 48px PNG icon entries)
- `/favicon-16x16.png`
- `/favicon-32x32.png`
- `/favicon-48x48.png`
- `/apple-touch-icon.png` (180×180)
- `/icon-192x192.png`
- `/icon-512x512.png`
- `/icon-maskable-192x192.png`
- `/icon-maskable-512x512.png`

The derivatives were produced from a reviewed, identity-preserving app-icon master based on the supplied official logo. Favicon-scale assets contain no text.

## PWA and cache behavior

`manifest.json` now references the explicit 192px and 512px `any` icons plus dedicated maskable variants. `index.html` has one ICO declaration, PNG fallbacks, and the Apple touch icon declaration. The service worker only caches the offline document rather than image assets, so it does not retain the retired icon files. Browsers with their own favicon cache can be refreshed with a hard reload or by clearing site data.

## Files changed

- `src/components/branding/SoundVerseLogo.jsx`
- `src/components/branding/SoundVerseLogo.css`
- `src/components/layout/Sidebar.jsx`
- `src/features/landing/LandingPage.jsx`
- `index.html`
- `public/manifest.json`
- branding/icon assets listed above

## Removed assets

- `public/icon.svg`
- `public/icon-192.png`
- `public/icon-512.png`

## Verification

- `npm run build`: passed.
- `npm run lint`: passed.
- `npx playwright test tests/v2.spec.js --workers=1 --reporter=list`: started successfully and its worker completed with no `error-message.md` failure artifact, but the environment again left its Vite child running and did not return the list reporter's final summary. The verified orphaned test server was stopped; rerun in a normal terminal to capture the final exit status.
