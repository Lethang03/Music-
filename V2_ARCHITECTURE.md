# V2 ARCHITECTURE

## Overview
V2 is built as a brand new React application inside `E:\Music GG`. It completely abandons the monolithic V1 `App.jsx` in favor of a strictly decoupled architecture.

## Tech Stack
- React 18
- Vite
- React Router DOM
- Supabase JS
- Lucide React (Icons)
- Plain CSS with CSS Variables (Design Tokens)

## Folder Structure
```text
src/
  components/
    layout/ (AppShell, Sidebar, Topbar)
    player/ (GlobalPlayer)
  contexts/
    AuthContext.jsx
    LibraryContext.jsx
    AudioContext.jsx
  features/
    landing/
    auth/
    home/
    music/
    podcast/
  lib/
    supabase.js
  styles/
    main.css
    variables.css
```

## Data Flow
- **Auth**: `AuthContext` manages Supabase session and user profiles.
- **Library**: `LibraryContext` fetches and caches global metadata (tracks, podcasts, history).
- **Audio**: `AudioContext` maintains the central `HTML5 Audio` instance, queue, and playback state independently of UI components.

