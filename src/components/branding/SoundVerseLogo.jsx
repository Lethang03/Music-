import React from 'react'
import './SoundVerseLogo.css'

export default function SoundVerseLogo({ size = 'medium', tagline = false, className = '' }) {
  return <div className={`soundverse-logo soundverse-logo--${size} ${className}`.trim()}>
    <img src="/branding/soundverse-logo.png" alt="SoundVerse" />
    <span className="soundverse-logo__copy"><strong>SoundVerse</strong>{tagline && <small>Music &amp; Podcasts</small>}</span>
  </div>
}
