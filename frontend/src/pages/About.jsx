import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  CameraRegular, ShieldLockRegular, PeopleRegular,
  ChartMultipleRegular, PersonRegular, CalculatorRegular,
  BookRegular, ArrowRightRegular, CheckmarkCircleRegular,
  BuildingRegular, CodeRegular, PlayRegular, DismissRegular,
  InfoRegular, ShieldCheckmarkRegular, LaptopRegular, AlertRegular
} from '@fluentui/react-icons'

const STEP_COLORS  = ['#0078d4', '#038387', '#6264a7', '#8764b8']
const PROB_COLORS  = ['#0078d4', '#038387', '#6264a7', '#8764b8']
const AUDIENCE_COLORS = ['#0078d4', '#038387', '#6264a7', '#8764b8']
const STACK_COLORS = ['#0078d4', '#038387', '#6264a7', '#8764b8']

const STATS = [
  { val: '99.9%', labelKey: 'about.stats.uptime'    },
  { val: '<0.3s', labelKey: 'about.stats.speed'     },
  { val: '15k+',  labelKey: 'about.stats.profiles'  },
  { val: '24/7',  labelKey: 'about.stats.monitoring' },
]

export default function About() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  // Video Presentation Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showControls, setShowControls] = useState(false)
  const videoRef = useRef(null)
  const playerWrapperRef = useRef(null)

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (isPlaying) {
      video.pause()
      setIsPlaying(false)
    } else {
      video.play()
      setIsPlaying(true)
    }
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !isMuted
    setIsMuted(!isMuted)
  }

  const handleTimeUpdate = () => {
    const video = videoRef.current
    if (video) {
      setCurrentTime(video.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    const video = videoRef.current
    if (video) {
      setDuration(video.duration)
    }
  }

  const handleVideoEnded = () => {
    setIsPlaying(false)
    setCurrentTime(0)
  }

  const handleProgressClick = (e) => {
    const video = videoRef.current
    if (!video || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = Math.max(0, Math.min(1, clickX / rect.width))
    video.currentTime = percentage * duration
    setCurrentTime(percentage * duration)
  }

  const toggleFullscreen = () => {
    const wrapper = playerWrapperRef.current
    if (!wrapper) return
    if (!document.fullscreenElement) {
      wrapper.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
  }

  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds)) return '0:00'
    const mins = Math.floor(timeInSeconds / 60)
    const secs = Math.floor(timeInSeconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isModalOpen])

  // Stop video when modal closes
  useEffect(() => {
    if (!isModalOpen) {
      setIsPlaying(false)
      setCurrentTime(0)
      if (videoRef.current) {
        videoRef.current.pause()
      }
    }
  }, [isModalOpen])

  const steps = [
    { n: 1, color: STEP_COLORS[0], icon: <CameraRegular fontSize={20}/>,        title: t('about.steps.s1title'), desc: t('about.steps.s1desc') },
    { n: 2, color: STEP_COLORS[1], icon: <ChartMultipleRegular fontSize={20}/>, title: t('about.steps.s2title'), desc: t('about.steps.s2desc') },
    { n: 3, color: STEP_COLORS[2], icon: <ShieldLockRegular fontSize={20}/>,    title: t('about.steps.s3title'), desc: t('about.steps.s3desc') },
    { n: 4, color: STEP_COLORS[3], icon: <BookRegular fontSize={20}/>,          title: t('about.steps.s4title'), desc: t('about.steps.s4desc') },
  ]

  const probs = [
    { color: PROB_COLORS[0], icon: <BookRegular fontSize={18}/>,         title: t('about.problems.p1title'), desc: t('about.problems.p1desc') },
    { color: PROB_COLORS[1], icon: <ShieldLockRegular fontSize={18}/>,   title: t('about.problems.p2title'), desc: t('about.problems.p2desc') },
    { color: PROB_COLORS[2], icon: <CalculatorRegular fontSize={18}/>,   title: t('about.problems.p3title'), desc: t('about.problems.p3desc') },
    { color: PROB_COLORS[3], icon: <PeopleRegular fontSize={18}/>,       title: t('about.problems.p4title'), desc: t('about.problems.p4desc') },
  ]

  const audience = [
    { color: AUDIENCE_COLORS[0], icon: <PersonRegular fontSize={20}/>,      title: t('about.audience.a1title'), desc: t('about.audience.a1desc') },
    { color: AUDIENCE_COLORS[1], icon: <CalculatorRegular fontSize={20}/>,  title: t('about.audience.a2title'), desc: t('about.audience.a2desc') },
    { color: AUDIENCE_COLORS[2], icon: <ShieldLockRegular fontSize={20}/>,  title: t('about.audience.a3title'), desc: t('about.audience.a3desc') },
    { color: AUDIENCE_COLORS[3], icon: <BuildingRegular fontSize={20}/>,    title: t('about.audience.a4title'), desc: t('about.audience.a4desc') },
  ]

  const stack = [
    { color: STACK_COLORS[0], icon: <CodeRegular fontSize={18}/>,         name: 'FastAPI',         desc: 'Backend API'  },
    { color: STACK_COLORS[1], icon: <CameraRegular fontSize={18}/>,        name: 'Hikvision ISUP', desc: 'SDK / ISUP'   },
    { color: STACK_COLORS[2], icon: <ChartMultipleRegular fontSize={18}/>, name: 'React + Vite',   desc: 'Frontend UI'  },
    { color: STACK_COLORS[3], icon: <ShieldLockRegular fontSize={18}/>,    name: 'PostgreSQL / JWT', desc: 'DB / Auth'    },
  ]

  return (
    <>
      <style>{`
        /* Modernized Styles for About Page */
        .about-wrapper {
          min-height: calc(100vh - 52px);
          background: var(--bg);
          color: var(--text-1);
          padding: 0 0 80px 0;
          overflow-y: auto;
        }
        .about-hero {
          background: linear-gradient(135deg, var(--accent-bg) 0%, var(--bg) 100%);
          border-bottom: 1px solid var(--border);
          position: relative;
          padding: 80px 24px;
          text-align: center;
          overflow: hidden;
        }
        .about-hero::before {
          content: "";
          position: absolute;
          top: -20%;
          left: -10%;
          width: 50%;
          height: 80%;
          background: radial-gradient(circle, rgba(0, 120, 212, 0.12) 0%, transparent 60%);
          pointer-events: none;
        }
        .section-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--accent-bg);
          border: 1px solid var(--accent-bd);
          border-radius: 100px;
          padding: 6px 16px;
          font-size: 12px;
          font-weight: 700;
          color: var(--accent-tx);
          margin-bottom: 20px;
        }
        .hero-title {
          font-size: 38px;
          font-weight: 900;
          color: var(--white);
          letter-spacing: -0.8px;
          margin-bottom: 16px;
          line-height: 1.2;
        }
        .hero-desc {
          font-size: 15px;
          color: var(--text-2);
          max-width: 720px;
          margin: 0 auto 30px;
          line-height: 1.7;
        }
        .hero-btns {
          display: flex;
          justify-content: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        .btn-primary {
          background: var(--accent);
          color: #fff;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: 650;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 13.5px;
          transition: background 0.15s;
          box-shadow: 0 4px 14px rgba(0, 120, 212, 0.25);
        }
        .btn-primary:hover {
          background: var(--accent-h);
        }
        .btn-secondary {
          background: var(--surface-2);
          border: 1px solid var(--border);
          color: var(--text-1);
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: 650;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 13.5px;
          transition: background 0.15s, border-color 0.15s;
        }
        .btn-secondary:hover {
          background: var(--surface-3);
          border-color: var(--border-3);
        }
        
        .grid-container {
          max-width: 1000px;
          margin: -40px auto 0;
          padding: 0 24px;
          position: relative;
          z-index: 10;
        }

        /* Stats Bar */
        .stats-card-bar {
          background: var(--surface);
          border: 1px solid var(--border-2);
          border-radius: 16px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          padding: 8px;
          box-shadow: var(--shadow);
          margin-bottom: 40px;
        }
        .stats-item {
          text-align: center;
          padding: 24px 12px;
          border-right: 1px solid var(--border-2);
        }
        .stats-item:last-child {
          border-right: none;
        }
        .stats-val {
          font-size: 26px;
          font-weight: 900;
          color: var(--accent-tx);
          letter-spacing: -0.5px;
        }
        .stats-lbl {
          font-size: 11.5px;
          color: var(--text-3);
          margin-top: 6px;
          font-weight: 600;
          text-transform: uppercase;
        }

        /* Content Blocks */
        .content-section {
          background: var(--surface);
          border: 1px solid var(--border-2);
          border-radius: 16px;
          padding: 30px;
          margin-bottom: 24px;
          box-shadow: var(--shadow-sm);
        }
        .section-header-title {
          font-size: 16px;
          font-weight: 800;
          color: var(--white);
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
          border-bottom: 1px solid var(--border);
          padding-bottom: 12px;
        }
        
        /* Modern Timeline Workflow */
        .workflow-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        .workflow-card {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 20px 16px;
          transition: border-color 0.2s, transform 0.2s;
        }
        .workflow-card:hover {
          border-color: var(--accent-bd);
          transform: translateY(-2px);
        }
        .workflow-num-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .workflow-num {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          background: var(--accent-bg);
          color: var(--accent-tx);
          border: 1px solid var(--accent-bd);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
        }
        .workflow-icon {
          color: var(--accent);
        }
        .workflow-title {
          font-size: 13.5px;
          font-weight: 700;
          color: var(--text-1);
          margin-bottom: 6px;
        }
        .workflow-desc {
          font-size: 11.5px;
          color: var(--text-3);
          line-height: 1.5;
        }

        /* Matrix Grids */
        .matrix-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .matrix-card {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 20px;
          display: flex;
          gap: 16px;
          align-items: flex-start;
          transition: border-color 0.15s;
        }
        .matrix-card:hover {
          border-color: var(--accent-bd);
        }
        .matrix-icon-box {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          background: var(--accent-bg);
          color: var(--accent-tx);
          border: 1px solid var(--accent-bd);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .matrix-info {
          flex: 1;
        }
        .matrix-title {
          font-size: 13.5px;
          font-weight: 700;
          color: var(--text-1);
          margin-bottom: 6px;
        }
        .matrix-desc {
          font-size: 12px;
          color: var(--text-3);
          line-height: 1.55;
        }

        /* Author and SLA */
        .author-card {
          display: flex;
          align-items: center;
          gap: 20px;
          background: var(--surface);
          border: 1px solid var(--accent-bd);
          border-radius: 16px;
          padding: 24px;
          box-shadow: var(--shadow-sm);
          margin-bottom: 24px;
        }
        .author-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: var(--accent);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 800;
          flex-shrink: 0;
        }

        /* Presentation Video Modal Overlay */
        .video-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .video-modal-window {
          width: 100%;
          max-width: 900px;
          background: #000;
          border: 1px solid var(--border-3);
          border-radius: 16px;
          overflow: hidden;
          position: relative;
          box-shadow: 0 20px 50px rgba(0,0,0,0.8);
        }
        .close-modal-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          background: rgba(0, 0, 0, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          width: 32px;
          height: 32px;
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 25;
          transition: background 0.15s;
        }
        .close-modal-btn:hover {
          background: rgba(255, 255, 255, 0.15);
        }
        .video-player-box {
          position: relative;
          width: 100%;
          aspect-ratio: 16/9;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Responsive Breakpoints */
        @media (max-width: 1024px) {
          .stats-card-bar {
            grid-template-columns: repeat(2, 1fr);
          }
          .stats-item:nth-child(2) {
            border-right: none;
          }
          .stats-item:nth-child(1), .stats-item:nth-child(2) {
            border-bottom: 1px solid var(--border-2);
          }
          .workflow-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 768px) {
          .about-hero {
            padding: 50px 20px;
          }
          .hero-title {
            font-size: 28px;
          }
          .matrix-grid {
            grid-template-columns: 1fr;
          }
          .author-card {
            flex-direction: column;
            text-align: center;
            padding: 20px;
          }
        }
        @media (max-width: 520px) {
          .stats-card-bar {
            grid-template-columns: 1fr;
          }
          .stats-item {
            border-right: none !important;
            border-bottom: 1px solid var(--border-2) !important;
          }
          .stats-item:last-child {
            border-bottom: none !important;
          }
          .workflow-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="about-wrapper">
        
        {/* Hero Area */}
        <div className="about-hero">
          <div className="section-badge">
            <LaptopRegular fontSize={14} />
            <span>{t('about.heading')}</span>
          </div>
          <h1 className="hero-title">BioFace.uz</h1>
          <p className="hero-desc">
            {t('about.sub')}
          </p>
          <div className="hero-btns">
            <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
              <PlayRegular fontSize={16} />
              <span>{t('about.video.demo')}</span>
            </button>
            <button className="btn-secondary" onClick={() => navigate('/contact')}>
              <span>{t('about.ctaContact')}</span>
            </button>
          </div>
        </div>

        {/* Content Workspace */}
        <div className="grid-container">
          
          {/* Key Stats Bar */}
          <div className="stats-card-bar">
            {STATS.map((s, i) => (
              <div key={i} className="stats-item">
                <div className="stats-val">{s.val}</div>
                <div className="stats-lbl">{t(s.labelKey)}</div>
              </div>
            ))}
          </div>

          {/* How It Works Section */}
          <div className="content-section">
            <h3 className="section-header-title">
              <CheckmarkCircleRegular fontSize={18} color="var(--accent)" />
              <span>{t('about.howTitle')}</span>
            </h3>
            <div className="workflow-grid">
              {steps.map(s => (
                <div key={s.n} className="workflow-card">
                  <div className="workflow-num-row">
                    <span className="workflow-num">{s.n}</span>
                    <span className="workflow-icon">{s.icon}</span>
                  </div>
                  <h4 className="workflow-title">{s.title}</h4>
                  <p className="workflow-desc">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Problems Solved Section */}
          <div className="content-section">
            <h3 className="section-header-title">
              <ShieldLockRegular fontSize={18} color="var(--accent)" />
              <span>{t('about.probTitle')}</span>
            </h3>
            <div className="matrix-grid">
              {probs.map((p, i) => (
                <div key={i} className="matrix-card">
                  <div className="matrix-icon-box">{p.icon}</div>
                  <div className="matrix-info">
                    <h4 className="matrix-title">{p.title}</h4>
                    <p className="matrix-desc">{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Target Segments Section */}
          <div className="content-section">
            <h3 className="section-header-title">
              <PeopleRegular fontSize={18} color="var(--accent)" />
              <span>{t('about.audTitle')}</span>
            </h3>
            <div className="workflow-grid">
              {audience.map((a, i) => (
                <div key={i} className="workflow-card">
                  <div style={{ marginBottom: 12, color: 'var(--accent)' }}>{a.icon}</div>
                  <h4 className="workflow-title">{a.title}</h4>
                  <p className="workflow-desc">{a.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Technology Stack Section */}
          <div className="content-section">
            <h3 className="section-header-title">
              <CodeRegular fontSize={18} color="var(--accent)" />
              <span>{t('about.stackTitle')}</span>
            </h3>
            <div className="workflow-grid">
              {stack.map((s, i) => (
                <div key={i} className="workflow-card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div className="matrix-icon-box" style={{ width: 34, height: 34 }}>{s.icon}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Author Block */}
          <div className="author-card">
            <div className="author-avatar">IU</div>
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>
                {t('about.authorName')}
              </h4>
              <p style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.6 }}>
                {t('about.authorDesc')}
              </p>
            </div>
          </div>

          {/* CTA Card */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 16, padding: 32, textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--white)', marginBottom: 8 }}>
              {t('about.ctaTitle')}
            </h3>
            <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
              {t('about.ctaDesc')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button className="btn-primary" onClick={() => navigate('/login')}>
                <ArrowRightRegular fontSize={16} />
                <span>{t('about.ctaLogin')}</span>
              </button>
              <button className="btn-secondary" onClick={() => navigate('/contact')}>
                <span>{t('about.ctaContact')}</span>
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* Presentation Video Player Modal Window */}
      {isModalOpen && (
        <div className="video-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="video-modal-window" onClick={(e) => e.stopPropagation()}>
            
            {/* Close Button */}
            <button className="close-modal-btn" onClick={() => setIsModalOpen(false)}>
              <DismissRegular fontSize={16} />
            </button>

            {/* Custom Designed Embedded Player Wrapper */}
            <div 
              ref={playerWrapperRef}
              className="video-player-box"
              onMouseEnter={() => setShowControls(true)}
              onMouseLeave={() => setShowControls(false)}
            >
              <video
                ref={videoRef}
                src="/static/video_robot.mp4"
                onClick={togglePlay}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleVideoEnded}
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'contain',
                  cursor: 'pointer'
                }}
              />

              {/* Central Large Play Icon */}
              {!isPlaying && (
                <button 
                  onClick={togglePlay}
                  style={{
                    position: 'absolute',
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 6px 20px rgba(0, 120, 212, 0.4)',
                    transition: 'transform 0.2s',
                    zIndex: 15,
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" style={{ marginLeft: 2 }}>
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </button>
              )}

              {/* Progress and Bottom Control Overlay */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
                padding: '24px 16px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                transition: 'opacity 0.2s',
                opacity: showControls || !isPlaying ? 1 : 0,
                zIndex: 20,
                pointerEvents: showControls || !isPlaying ? 'auto' : 'none'
              }}>
                {/* Seek Bar */}
                <div 
                  onClick={handleProgressClick}
                  style={{
                    width: '100%',
                    height: 4,
                    background: 'rgba(255, 255, 255, 0.25)',
                    borderRadius: 2,
                    cursor: 'pointer',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <div style={{
                    width: `${duration ? (currentTime / duration) * 100 : 0}%`,
                    height: '100%',
                    background: 'var(--accent)',
                    borderRadius: 2,
                    position: 'relative'
                  }}>
                    <div style={{
                      position: 'absolute',
                      right: -4,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#fff'
                    }} />
                  </div>
                </div>

                {/* Sub Bar Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button 
                      onClick={togglePlay}
                      style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }}
                    >
                      {isPlaying ? (
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      )}
                    </button>
                    <span style={{ fontSize: 11, color: '#ddd', fontFamily: 'monospace' }}>
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button 
                      onClick={toggleMute}
                      style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }}
                    >
                      {isMuted ? (
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                          <line x1="23" y1="9" x2="17" y2="15"/>
                          <line x1="17" y1="9" x2="23" y2="15"/>
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                        </svg>
                      )}
                    </button>
                    <button 
                      onClick={toggleFullscreen}
                      style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}
    </>
  )
}
