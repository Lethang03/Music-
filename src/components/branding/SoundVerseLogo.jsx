import React from 'react'
import './SoundVerseLogo.css'

export default function SoundVerseLogo({ size = 'medium', tagline = false, className = '' }) {
  return <div className={`soundverse-logo soundverse-logo--${size} ${className}`.trim()}>
    <picture>
      <source srcSet="/branding/soundverse-logo.webp" type="image/webp" />
      <img src="/branding/soundverse-logo.png" alt="SoundVerse" decoding="async" />
    </picture>
    <span className="soundverse-logo__copy"><strong>SoundVerse</strong>{tagline && <small>Music &amp; Podcasts</small>}</span>
  </div>
}
