import React, { useRef, useState, useCallback } from 'react'
import './TiltCard.css'

export default function TiltCard({ children, className = '', onClick, onKeyDown, tabIndex, role, ...props }) {
  const cardRef = useRef(null)
  const [style, setStyle] = useState({})
  const [glareStyle, setGlareStyle] = useState({})
  
  const handleMouseMove = useCallback((e) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    
    // Calculate mouse position relative to the center of the card (-1 to +1)
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    
    const rotateX = ((y - centerY) / centerY) * -10 // Max 10 deg
    const rotateY = ((x - centerX) / centerX) * 10  // Max 10 deg
    
    setStyle({
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`,
      transition: 'none'
    })
    
    // Glare effect calculation
    const glareX = (x / rect.width) * 100
    const glareY = (y / rect.height) * 100
    setGlareStyle({
      background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 60%)`,
      opacity: 1,
      transition: 'none'
    })
  }, [])
  
  const handleMouseLeave = useCallback(() => {
    setStyle({
      transform: 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)',
      transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
    })
    setGlareStyle({
      opacity: 0,
      transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
    })
  }, [])
  
  return (
    <div 
      ref={cardRef}
      className={`v2-tilt-card ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={tabIndex}
      role={role}
      style={style}
      {...props}
    >
      <div className="v2-tilt-glare" style={glareStyle} />
      {children}
    </div>
  )
}

