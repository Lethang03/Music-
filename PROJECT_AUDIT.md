# PROJECT AUDIT

## V1 Legacy Project Analysis
The V1 legacy project (`e:\MusicPodcastHealing`) was audited as read-only reference.
- **Architecture**: All routing, context, state, and media logic was bundled tightly in a single monolithic `App.jsx` (1400+ lines).
- **Backend**: Connected to Supabase (auth, storage, PostgreSQL).
- **Playback**: Standard HTML5 Audio elements often re-mounted on route changes, leading to gaps, missing persistence, and broken background playback.
- **UI**: Functional but lacking a premium streaming service feel (no complex glassmorphism, flat tables, standard inputs).

## Key Insights for V2
- We must decouple Auth, Data Fetching (Library), and Playback (Audio Engine) into distinct context providers.
- The UI must be rewritten from scratch using a modern design token system.
- Playback must be global, independent of the router, utilizing Media Session API and strict state management to prevent auto-next bugs.

