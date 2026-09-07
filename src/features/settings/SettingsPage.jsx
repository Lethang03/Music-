import React, { useState, useEffect } from 'react'
import { Volume2, Moon, Shuffle, Repeat, LogOut, Shield, ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useAudio } from '../../contexts/AudioContext'

export default function SettingsPage() {
  const navigate = useNavigate()
  const { signOut, profile } = useAuth()
  const { volume, setVolume, shuffle, toggleShuffle, repeat, toggleRepeat } = useAudio()
  
  // Local storage preferences (Theme is purely UI for this demo)
  const [darkMode, setDarkMode] = useState(true)

  const handleLogout = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <div className="v2-page v2-animate-fade">
      <header className="v2-page-header">
        <button className="v2-icon-btn" onClick={() => navigate(-1)} style={{ marginLeft: '-12px', marginBottom: '16px' }}>
          <ChevronLeft size={24} />
        </button>
        <h1>Cài đặt</h1>
      </header>

      <div className="v2-settings-container">
        
        {/* Audio Settings */}
        <section className="v2-settings-section">
          <h2><Volume2 size={20} /> Âm thanh & Phát</h2>
          <div className="v2-setting-item">
            <div className="v2-setting-info">
              <strong>Mức âm lượng mặc định</strong>
              <span>Được lưu trên trình duyệt của bạn</span>
            </div>
            <div className="v2-setting-control">
              <input 
                type="range" 
                min="0" max="1" step="0.05"
                value={volume}
                onChange={e => setVolume(parseFloat(e.target.value))}
                className="v2-range-slider"
              />
            </div>
          </div>
          
          <div className="v2-setting-item">
            <div className="v2-setting-info">
              <strong>Phát ngẫu nhiên (Shuffle)</strong>
              <span>Luôn bật phát ngẫu nhiên khi mở playlist</span>
            </div>
            <div className="v2-setting-control">
              <button className={`v2-toggle-btn ${shuffle ? 'active' : ''}`} onClick={toggleShuffle}>
                <div className="v2-toggle-knob" />
              </button>
            </div>
          </div>
          
          <div className="v2-setting-item">
            <div className="v2-setting-info">
              <strong>Lặp lại (Repeat)</strong>
              <span>Chế độ lặp lại danh sách</span>
            </div>
            <div className="v2-setting-control">
               <button className={`v2-toggle-btn ${repeat !== 'off' ? 'active' : ''}`} onClick={toggleRepeat}>
                <div className="v2-toggle-knob" />
              </button>
            </div>
          </div>
        </section>

        {/* Appearance */}
        <section className="v2-settings-section">
          <h2><Moon size={20} /> Giao diện</h2>
          <div className="v2-setting-item">
            <div className="v2-setting-info">
              <strong>Chế độ tối (Dark Mode)</strong>
              <span>Giao diện V2 hiện tại chỉ hỗ trợ Dark Mode</span>
            </div>
            <div className="v2-setting-control">
               <button className="v2-toggle-btn active" disabled style={{ opacity: 0.5 }}>
                <div className="v2-toggle-knob" />
              </button>
            </div>
          </div>
        </section>

        {/* Account */}
        <section className="v2-settings-section v2-danger-zone">
          <h2><Shield size={20} /> Tài khoản</h2>
          <div className="v2-setting-item">
            <div className="v2-setting-info">
              <strong>Tài khoản hiện tại</strong>
              <span>{profile?.email}</span>
            </div>
            <div className="v2-setting-control">
              <button className="v2-btn-secondary" onClick={handleLogout}>
                <LogOut size={16} /> Đăng xuất
              </button>
            </div>
          </div>
        </section>

      </div>

      <style>{`
        .v2-page { display: flex; flex-direction: column; gap: 32px; max-width: 800px; margin: 0 auto; width: 100%; }
        .v2-page-header h1 { font-size: 2.5rem; font-weight: 800; letter-spacing: -0.03em; }
        
        .v2-settings-container { display: flex; flex-direction: column; gap: 40px; }
        
        .v2-settings-section { display: flex; flex-direction: column; gap: 16px; }
        .v2-settings-section h2 { 
          font-size: 1.125rem; font-weight: 700; color: var(--accent-primary);
          display: flex; align-items: center; gap: 12px; margin-bottom: 8px;
          text-transform: uppercase; letter-spacing: 0.05em;
        }
        
        .v2-setting-item {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px; background: var(--bg-panel); border-radius: var(--radius-lg);
          border: 1px solid var(--border-subtle);
        }
        .v2-setting-info { display: flex; flex-direction: column; gap: 4px; }
        .v2-setting-info strong { font-size: 1.0625rem; font-weight: 600; color: var(--text-primary); }
        .v2-setting-info span { font-size: 0.875rem; color: var(--text-secondary); }
        
        /* Toggle Button */
        .v2-toggle-btn {
          width: 52px; height: 32px; border-radius: 16px;
          background: rgba(255,255,255,0.1); border: none;
          position: relative; cursor: pointer; transition: background 0.2s;
        }
        .v2-toggle-btn.active { background: var(--accent-primary); }
        .v2-toggle-knob {
          width: 24px; height: 24px; border-radius: 50%; background: white;
          position: absolute; top: 4px; left: 4px;
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        .v2-toggle-btn.active .v2-toggle-knob { transform: translateX(20px); }

        /* Range Slider */
        .v2-range-slider {
          -webkit-appearance: none; width: 120px; height: 6px;
          background: rgba(255,255,255,0.1); border-radius: 3px; outline: none;
        }
        .v2-range-slider::-webkit-slider-thumb {
          -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%;
          background: white; cursor: pointer;
        }

        .v2-danger-zone .v2-setting-item { border-color: rgba(248, 113, 113, 0.2); }
      `}</style>
    </div>
  )
}

