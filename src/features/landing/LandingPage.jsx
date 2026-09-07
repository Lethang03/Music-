import React, { useState } from 'react'

export default function LandingPage({ onShowAuth }) {
  // Using local state to manage AuthModal inside LandingPage if we want
  // Or we can just trigger the parent. We will use the parent trigger to align with App.jsx
  return (
    <div className="v2-landing-container">
      <div className="v2-landing-bg">
        <div className="v2-blob v2-blob-1"></div>
        <div className="v2-blob v2-blob-2"></div>
        <div className="v2-noise-overlay"></div>
      </div>

      <header className="v2-landing-header">
        <div className="v2-brand">
          <div className="v2-brand-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
          </div>
          <div className="v2-brand-text">
            <strong>Podcast Vault</strong>
            <span>PREMIUM STREAMING</span>
          </div>
        </div>
        <div className="v2-header-actions">
          <button className="v2-btn-secondary" onClick={onShowAuth}>Log In</button>
          <button className="v2-btn-primary" onClick={onShowAuth}>Sign Up</button>
        </div>
      </header>

      <main className="v2-landing-hero">
        <div className="v2-hero-content">
          <div className="v2-hero-badge">Welcome to Version 2.0</div>
          <h1>
            Immerse in the sound.<br />
            <span className="v2-hero-highlight">Elevate your experience.</span>
          </h1>
          <p>
            The premium destination for your favorite music and podcasts. 
            High-fidelity audio, seamless cross-device playback, and a beautiful cinematic interface designed just for you.
          </p>
          <div className="v2-hero-cta">
            <button className="v2-btn-primary" style={{ padding: '16px 32px', fontSize: '1.125rem' }} onClick={onShowAuth}>
              Start Listening Now
            </button>
            <p className="v2-hero-subtext">No credit card required. Free forever.</p>
          </div>
        </div>

        <div className="v2-hero-showcase">
          <div className="v2-floating-player v2-glass">
            <div className="v2-fp-artwork">
              <img src="https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=500" alt="Artwork" />
              <div className="v2-fp-play-btn"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></div>
            </div>
            <div className="v2-fp-info">
              <div className="v2-fp-title">Midnight Synth</div>
              <div className="v2-fp-artist">The Weeknd</div>
              <div className="v2-fp-waveform">
                {[...Array(24)].map((_, i) => (
                  <div key={i} className="v2-bar" style={{ height: `${Math.random() * 100}%`, animationDelay: `${i * 50}ms`}}></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <style>{`
        .v2-landing-container {
          position: relative; min-height: 100vh; background: var(--bg-base); color: var(--text-primary);
          display: flex; flex-direction: column; overflow: hidden;
        }
        .v2-landing-bg { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
        .v2-blob { position: absolute; border-radius: 50%; filter: blur(120px); opacity: 0.4; animation: blob-float 20s infinite alternate ease-in-out; }
        .v2-blob-1 { top: -10%; left: -10%; width: 50vw; height: 50vw; background: var(--accent-primary); }
        .v2-blob-2 { bottom: -20%; right: -10%; width: 60vw; height: 60vw; background: var(--accent-secondary); animation-delay: -5s; }
        .v2-noise-overlay {
          position: absolute; inset: 0;
          background: url('data:image/svg+xml;utf8,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)" opacity="0.05"/%3E%3C/svg%3E');
          opacity: 0.8; mix-blend-mode: overlay;
        }
        @keyframes blob-float { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(5%,10%) scale(1.1); } }
        
        .v2-landing-header { position: relative; z-index: 10; display: flex; align-items: center; justify-content: space-between; padding: 24px 48px; }
        .v2-brand { display: flex; align-items: center; gap: 12px; }
        .v2-brand-icon { width: 48px; height: 48px; border-radius: 12px; background: var(--accent-gradient); display: grid; place-items: center; box-shadow: 0 8px 24px var(--accent-glow); }
        .v2-brand-icon svg { width: 24px; height: 24px; }
        .v2-brand-text strong { display: block; font-size: 1.25rem; font-weight: 800; }
        .v2-brand-text span { font-size: 0.65rem; color: var(--accent-primary); letter-spacing: 0.2em; }
        .v2-header-actions { display: flex; gap: 16px; }

        .v2-landing-hero { position: relative; z-index: 10; flex: 1; display: grid; grid-template-columns: 1fr 1fr; align-items: center; gap: 64px; padding: 48px 8vw; max-width: 1600px; margin: 0 auto; }
        .v2-hero-badge { display: inline-block; padding: 6px 12px; border-radius: 999px; background: rgba(155,108,255,0.15); border: 1px solid rgba(155,108,255,0.3); color: #d1b8ff; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; margin-bottom: 24px; }
        .v2-hero-content h1 { margin-bottom: 24px; font-size: clamp(3rem, 5vw, 4.5rem); line-height: 1.1; letter-spacing: -0.04em;}
        .v2-hero-highlight { background: var(--accent-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .v2-hero-content p { font-size: 1.125rem; color: var(--text-secondary); max-width: 540px; margin-bottom: 40px; }
        .v2-hero-subtext { font-size: 0.75rem; color: var(--text-tertiary); margin-top: 12px; }

        .v2-hero-showcase { display: flex; justify-content: center; }
        .v2-floating-player { display: flex; gap: 20px; padding: 20px; border-radius: 24px; max-width: 460px; width: 100%; transform: perspective(1000px) rotateY(-15deg) rotateX(5deg); transition: transform 0.5s; }
        .v2-floating-player:hover { transform: perspective(1000px) rotateY(-5deg) rotateX(2deg) translateY(-10px); }
        .v2-fp-artwork { position: relative; width: 140px; height: 140px; border-radius: 16px; overflow: hidden; flex-shrink: 0; box-shadow: 0 12px 30px rgba(0,0,0,0.5); }
        .v2-fp-artwork img { width: 100%; height: 100%; object-fit: cover; }
        .v2-fp-play-btn { position: absolute; inset: 0; margin: auto; width: 48px; height: 48px; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); border-radius: 50%; display: grid; place-items: center; opacity: 0; transform: scale(0.8); transition: 0.3s; }
        .v2-floating-player:hover .v2-fp-play-btn { opacity: 1; transform: scale(1); }
        .v2-fp-play-btn svg { width: 24px; height: 24px; margin-left: 4px; }
        .v2-fp-info { flex: 1; display: flex; flex-direction: column; justify-content: center; }
        .v2-fp-title { font-size: 1.25rem; font-weight: 800; margin-bottom: 4px; }
        .v2-fp-artist { color: var(--text-secondary); margin-bottom: 24px; }
        .v2-fp-waveform { display: flex; align-items: flex-end; gap: 3px; height: 32px; }
        .v2-bar { flex: 1; background: var(--accent-primary); border-radius: 2px; animation: wave-bar 1s infinite alternate; }
        @keyframes wave-bar { 0% { height: 10%; } 100% { height: 100%; } }

        @media (max-width: 1024px) { .v2-landing-hero { grid-template-columns: 1fr; text-align: center; } .v2-hero-content { align-items: center; display: flex; flex-direction: column; } .v2-floating-player { transform: none !important; margin: 0 auto; } }
      `}</style>
    </div>
  )
}

