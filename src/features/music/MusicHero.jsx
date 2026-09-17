import React, { useMemo } from 'react'
import { Compass, Music2, Play, Users, Radio } from 'lucide-react'
import { useAudio } from '../../contexts/AudioContext'
import './MusicHero.css'
const artwork = item => item?.image_url || item?.cover_url || item?.image || '/icons/icon.svg'
const bars = [16,24,38,26,48,66,40,56,80,62,38,70,52,30,46,26,36,20,26]
export default function MusicHero({ tracks = [] }) {
  const { activeItem, isPlaying, playItem, setShuffle } = useAudio()
  const featured = tracks.find(track => track.id === activeItem?.id) || tracks[0]
  const secondary = tracks.find(track => track.id !== featured?.id) || featured
  const artistsCount = useMemo(() => new Set(tracks.map(t => t.artist || t.author).filter(Boolean)).size, [tracks])
  const duration = useMemo(() => {
    const seconds = tracks.reduce((sum, track) => sum + (Number(track.duration) > 0 ? Number(track.duration) : 0), 0)
    if (!seconds) return '—'
    const hours = Math.floor(seconds / 3600), minutes = Math.floor((seconds % 3600) / 60)
    return hours ? `${hours}h ${minutes}m` : `${minutes}m`
  }, [tracks])
  const randomPlay = () => { if (!tracks.length) return; const index = Math.floor(Math.random() * tracks.length); setShuffle(true); playItem(tracks[index], tracks, index) }
  const explore = () => document.querySelector('.music-library .v2-premium-grid, .music-library .music-list')?.scrollIntoView({ behavior: 'smooth' })
  return <header className="v2-page-hdr music-hero music-reference-hero">
    <div className="cosmic-bg-overlay" aria-hidden="true"><div className="cosmic-nebula-violet"/><div className="cosmic-nebula-cyan"/><div className="cosmic-dust-grid"/></div>
    <div className="music-hero-copy">
      <p className="music-hero-eyebrow"><span className="eyebrow-star">✦</span> YOUR SOUND. YOUR UNIVERSE.</p>
      <h1 className="music-hero-title"><span>Âm nhạc và</span><span className="music-title-gradient">những câu chuyện,</span><span>ở cùng một nơi.</span></h1>
      <p className="music-hero-subtitle">Khám phá thế giới âm nhạc theo cách của bạn.<br/>Mỗi bài hát là một câu chuyện. Mỗi câu chuyện là một hành trình.</p>
      <div className="music-hero-actions"><button className="v2-btn-primary music-hero-play" onClick={randomPlay} disabled={!tracks.length}><Play size={20} fill="currentColor"/> Phát ngẫu nhiên</button><button className="v2-btn-secondary music-hero-explore" onClick={explore}><Compass size={20}/> Khám phá ngay</button></div>
      <div className="music-hero-stats-cards" role="region" aria-label="Thống kê âm nhạc">
        <div className="music-stat-card stat-card-tracks"><Music2 size={22}/><strong className="stat-card-number">{tracks.length}</strong><span>BÀI HÁT</span><small>đang chờ bạn khám phá</small></div>
        <div className="music-stat-card stat-card-artists"><Users size={22}/><strong className="stat-card-number">{artistsCount}</strong><span>NGHỆ SĨ</span><small>với những màu sắc riêng</small></div>
        <div className="music-stat-card stat-card-listening"><Radio size={22}/><strong className="stat-card-number">{duration}</strong><span>TỔNG THỜI LƯỢNG</span><small>trong thư viện của bạn</small></div>
      </div>
    </div>
    <div className="music-hero-art" aria-hidden="true"><div className="music-universe-stage"><div className="music-orbit-ring orbit-outer"/><div className="music-orbit-ring orbit-mid"/><div className="music-record"/>
      <div className="music-side-cover"><img src={artwork(secondary)} alt="" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/icons/icon.svg' }}/></div>
      <div className="music-floating-tile"><img src={artwork(featured)} alt="" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/icons/icon.svg' }}/><div className="music-cover-caption"><strong>{featured?.title || 'SoundVerse'}</strong><span>{featured?.artist || 'Âm nhạc cho mọi cảm xúc'}</span></div></div>
      <div className={`music-hero-visualizer ${isPlaying ? 'is-playing' : 'is-idle'}`}>{bars.map((height, i) => <i key={i} className="visualizer-bar" style={{'--bar-h': `${height}px`, '--bar-delay': `${i * -.16}s`}}/>)}</div>
      <div className="music-hero-branding">SOUNDVERSE <span>GOOD MUSIC, BRIGHTER DAYS</span></div>
    </div></div>
  </header>
}
