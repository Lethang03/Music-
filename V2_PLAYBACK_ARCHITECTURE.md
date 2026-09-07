# V2 PLAYBACK ARCHITECTURE

## Goal
To provide a seamless, gapless, persistent, and cinematic playback experience akin to premium streaming services.

## Core Component
`AudioContext.jsx` acts as the single source of truth for audio. It initializes a persistent `new Audio()` object outside of the React render cycle to ensure the stream is never destroyed on route changes.

## Features Implemented
- **Global Persistence**: The player is mounted at the root (`AppShell`) and the audio object persists across all routes.
- **Media Session API**: Integrated so that OS-level controls (lock screen, bluetooth devices) can play/pause/skip and view artwork.
- **Auto-Next**: The `ended` event listener securely increments the queue index and immediately initiates playback of the next track without UI delays.
- **Queue Management**: Maintains an array of items and a `currentIndex`. 
- **Seek & Volume**: High-performance state tracking mapped to React range inputs.

## Crossfade Strategy (Upcoming)
A secondary `nextAudioRef` has been prepared to handle overlapping audio streams (1-10s) based on user settings, which will eliminate absolute silence between continuous plays.

