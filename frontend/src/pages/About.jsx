import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  CameraRegular, ShieldLockRegular, PeopleRegular,
  ChartMultipleRegular, PersonRegular, CalculatorRegular,
  BookRegular, ArrowRightRegular, CheckmarkCircleRegular,
  BuildingRegular, CodeRegular,
} from '@fluentui/react-icons'

const STEP_COLORS  = ['#0078d4', '#038387', '#6264a7', '#8764b8']
const PROB_COLORS  = ['#0078d4', '#038387', '#6264a7', '#8764b8']
const AUDIENCE_COLORS = ['#0078d4', '#038387', '#6264a7', '#8764b8']
const STACK_COLORS = ['#0078d4', '#038387', '#6264a7', '#8764b8']

const STATS = [
  { val: '99.9%', labelKey: 'about.stats.uptime'    },
  { val: '<0.5s', labelKey: 'about.stats.speed'     },
  { val: '10k+',  labelKey: 'about.stats.profiles'  },
  { val: '24/7',  labelKey: 'about.stats.monitoring' },
]

const sectionTitle = {
  fontSize: 14, fontWeight: 700, color: 'var(--text-1)',
  marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
}

export default function About() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  // Intro video states
  const [showIntro, setShowIntro] = useState(true)
  const [isIntroFading, setIsIntroFading] = useState(false)
  const [introProgress, setIntroProgress] = useState(0)
  const introVideoRef = useRef(null)

  // Demo video states
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showControls, setShowControls] = useState(false)
  const mainVideoRef = useRef(null)
  const playerWrapperRef = useRef(null)

  // Intro logic
  const handleSkipIntro = () => {
    if (introVideoRef.current) {
      introVideoRef.current.pause()
    }
    setIsIntroFading(true)
    setTimeout(() => {
      setShowIntro(false)
    }, 720)
  }

  const handleIntroTimeUpdate = () => {
    const video = introVideoRef.current
    if (video && video.duration) {
      setIntroProgress((video.currentTime / video.duration) * 100)
    }
  }

  // Keyboard controls for intro
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showIntro) {
        if (e.key === 'Escape' || e.key === ' ') {
          e.preventDefault()
          handleSkipIntro()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showIntro])

  // Demo player logic
  const togglePlay = () => {
    const video = mainVideoRef.current
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
    const video = mainVideoRef.current
    if (!video) return
    video.muted = !isMuted
    setIsMuted(!isMuted)
  }

  const handleTimeUpdate = () => {
    const video = mainVideoRef.current
    if (video) {
      setCurrentTime(video.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    const video = mainVideoRef.current
    if (video) {
      setDuration(video.duration)
    }
  }

  const handleVideoEnded = () => {
    setIsPlaying(false)
    setCurrentTime(0)
  }

  const handleProgressClick = (e) => {
    const video = mainVideoRef.current
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

  const steps = [
    { n:1, color: STEP_COLORS[0], icon: <CameraRegular fontSize={20}/>,        title: t('about.steps.s1title'), desc: t('about.steps.s1desc') },
    { n:2, color: STEP_COLORS[1], icon: <ChartMultipleRegular fontSize={20}/>, title: t('about.steps.s2title'), desc: t('about.steps.s2desc') },
    { n:3, color: STEP_COLORS[2], icon: <ShieldLockRegular fontSize={20}/>,    title: t('about.steps.s3title'), desc: t('about.steps.s3desc') },
    { n:4, color: STEP_COLORS[3], icon: <BookRegular fontSize={20}/>,          title: t('about.steps.s4title'), desc: t('about.steps.s4desc') },
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
        @keyframes blink {
          0% { opacity: 0.4; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.15); }
          100% { opacity: 0.4; transform: scale(0.9); }
        }
        @media (max-width: 600px) {
          .about-wrapper {
            padding: 24px 16px 40px !important;
          }
          .about-stats-bar {
            flex-direction: column !important;
          }
          .about-stats-item {
            border-right: none !important;
            border-bottom: 1px solid var(--border) !important;
          }
          .about-stats-item:last-child {
            border-bottom: none !important;
          }
          .about-probs-grid {
            grid-template-columns: 1fr !important;
          }
          .about-author-box {
            flex-direction: column !important;
            align-items: center !important;
            text-align: center !important;
            gap: 12px !important;
          }
        }
      `}</style>

      {/* Intro Overlay */}
      {showIntro && (
        <div
          onClick={handleSkipIntro}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: '#000',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isIntroFading ? 0 : 1,
            transition: 'opacity 0.7s ease, transform 0.7s ease',
            transform: isIntroFading ? 'scale(1.05)' : 'scale(1)',
            cursor: 'pointer',
          }}
        >
          <video
            ref={introVideoRef}
            src="/static/video_intro.mp4"
            autoPlay
            muted
            playsInline
            onTimeUpdate={handleIntroTimeUpdate}
            onEnded={handleSkipIntro}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
          
          {/* Top-right skip button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSkipIntro();
            }}
            style={{
              position: 'absolute',
              top: '24px',
              right: '24px',
              background: 'rgba(0, 0, 0, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: '#fff',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.6)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }}
          >
            {t('about.video.skip')} ➔
          </button>
          
          {/* Bottom progress bar */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '100%',
              height: '4px',
              background: 'rgba(255, 255, 255, 0.1)',
            }}
          >
            <div
              style={{
                width: `${introProgress}%`,
                height: '100%',
                background: 'var(--accent, #0078d4)',
                transition: 'width 0.1s linear',
              }}
            />
          </div>
        </div>
      )}

      <div className="about-wrapper" style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', padding: '40px 24px 80px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>

          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'inline-block', background: 'var(--accent-bg)', border: '1px solid var(--accent-bd)', borderRadius: 100, padding: '4px 14px', marginBottom: 14, fontSize: 12, color: 'var(--accent-tx)' }}>
              ✦ {t('about.heading')}
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 800, color: 'var(--white)', marginBottom: 8, letterSpacing: -0.5 }}>BioFace</h1>
            <p style={{ fontSize: 14, color: 'var(--text-4)', maxWidth: 520, lineHeight: 1.7 }}>{t('about.sub')}</p>
          </div>

          {/* Stats bar */}
          <div className="about-stats-bar" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, display: 'flex', marginBottom: 24, overflow: 'hidden' }}>
            {STATS.map((s, i) => (
              <div key={i} className="about-stats-item" style={{ flex: 1, textAlign: 'center', padding: '20px 10px', borderRight: i < STATS.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', letterSpacing: -0.5 }}>{s.val}</div>
                <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>{t(s.labelKey)}</div>
              </div>
            ))}
          </div>

          {/* Demo Video Player */}
          <div 
            ref={playerWrapperRef}
            onMouseEnter={() => setShowControls(true)}
            onMouseLeave={() => setShowControls(false)}
            style={{ 
              position: 'relative', 
              background: '#000', 
              border: '1px solid var(--border)', 
              borderRadius: 14, 
              overflow: 'hidden', 
              marginBottom: 24, 
              aspectRatio: '16/9', 
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <video
              ref={mainVideoRef}
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

            {/* Blink Badge: Tizim namoyishi */}
            <div style={{
              position: 'absolute',
              top: 16,
              left: 16,
              background: 'rgba(0, 0, 0, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              padding: '6px 12px',
              borderRadius: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              zIndex: 10,
              backdropFilter: 'blur(10px)',
              pointerEvents: 'none',
              userSelect: 'none'
            }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#ff4d4f',
                boxShadow: '0 0 8px #ff4d4f',
                animation: 'blink 1.5s infinite ease-in-out',
                display: 'inline-block'
              }} />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: '#fff', letterSpacing: '0.2px' }}>
                {t('about.video.badge')}
              </span>
            </div>

            {/* Central Play/Pause Overlay */}
            {!isPlaying && (
              <button 
                onClick={togglePlay}
                style={{
                  position: 'absolute',
                  width: 68,
                  height: 68,
                  borderRadius: '50%',
                  background: 'var(--accent, #0078d4)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(0, 120, 212, 0.4)',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  zIndex: 15,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'scale(1.1)';
                  e.currentTarget.style.boxShadow = '0 12px 28px rgba(0, 120, 212, 0.55)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 120, 212, 0.4)';
                }}
              >
                <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" style={{ marginLeft: 2 }}>
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </button>
            )}

            {/* Custom Control Bar */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
              padding: '24px 16px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              transition: 'opacity 0.3s ease, transform 0.3s ease',
              opacity: showControls || !isPlaying ? 1 : 0,
              transform: showControls || !isPlaying ? 'translateY(0)' : 'translateY(8px)',
              zIndex: 20,
              pointerEvents: showControls || !isPlaying ? 'auto' : 'none'
            }}>
              {/* Progress seek bar */}
              <div 
                onClick={handleProgressClick}
                style={{
                  width: '100%',
                  height: 5,
                  background: 'rgba(255, 255, 255, 0.25)',
                  borderRadius: 3,
                  cursor: 'pointer',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'height 0.1s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.height = '7px'}
                onMouseLeave={e => e.currentTarget.style.height = '5px'}
              >
                <div style={{
                  width: `${duration ? (currentTime / duration) * 100 : 0}%`,
                  height: '100%',
                  background: 'var(--accent, #0078d4)',
                  borderRadius: 3,
                  position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute',
                    right: -5,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: '#fff',
                    boxShadow: '0 0 6px rgba(0,0,0,0.4)'
                  }} />
                </div>
              </div>

              {/* Bottom Row controls */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
              }}>
                {/* Left controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <button 
                    onClick={togglePlay}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 4,
                      transition: 'transform 0.15s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    {isPlaying ? (
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    )}
                  </button>

                  <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.85)', fontFamily: 'monospace', minWidth: 80 }}>
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                {/* Right controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button 
                    onClick={toggleMute}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 4,
                      transition: 'transform 0.15s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    {isMuted ? (
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                        <line x1="23" y1="9" x2="17" y2="15"/>
                        <line x1="17" y1="9" x2="23" y2="15"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                      </svg>
                    )}
                  </button>

                  <button 
                    onClick={toggleFullscreen}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 4,
                      transition: 'transform 0.15s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* How it works */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px', marginBottom: 16 }}>
            <div style={sectionTitle}><CheckmarkCircleRegular fontSize={17} color="#0078d4" />{t('about.howTitle')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {steps.map(s => (
                <div key={s.n} style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '16px 14px' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = s.color + '55'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-2)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: s.color, color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.n}</div>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: s.color + '18', border: `1px solid ${s.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>{s.icon}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 5 }}>{s.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-4)', lineHeight: 1.55 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Problems */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ ...sectionTitle, paddingLeft: 2 }}><ShieldLockRegular fontSize={17} color="#0078d4" />{t('about.probTitle')}</div>
            <div className="about-probs-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {probs.map((p, i) => (
                <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = p.color + '44'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={{ width: 38, height: 38, borderRadius: 9, background: p.color + '18', border: `1px solid ${p.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: p.color, marginBottom: 10 }}>{p.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 5 }}>{p.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-4)', lineHeight: 1.6 }}>{p.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Audience */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px', marginBottom: 16 }}>
            <div style={sectionTitle}><PeopleRegular fontSize={17} color="#0078d4" />{t('about.audTitle')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {audience.map((a, i) => (
                <div key={i} style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '16px' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = a.color + '55'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-2)'}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: a.color + '18', border: `1px solid ${a.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: a.color, marginBottom: 10 }}>{a.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 5 }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-4)', lineHeight: 1.6 }}>{a.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Stack */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px', marginBottom: 16 }}>
            <div style={sectionTitle}><CodeRegular fontSize={17} color="#0078d4" />{t('about.stackTitle')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              {stack.map((s, i) => (
                <div key={i} style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = s.color + '55'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-2)'}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: s.color + '18', border: `1px solid ${s.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, flexShrink: 0 }}>{s.icon}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Author */}
          <div className="about-author-box" style={{ background: 'var(--surface)', border: '1px solid var(--accent-bd)', borderRadius: 14, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 18, marginBottom: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0 }}>IU</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', marginBottom: 5 }}>{t('about.authorName')}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-4)', lineHeight: 1.65 }}>{t('about.authorDesc')}</div>
            </div>
          </div>

          {/* CTA */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--accent-bd)', borderRadius: 14, padding: '28px', textAlign: 'center' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--white)', marginBottom: 8 }}>{t('about.ctaTitle')}</h2>
            <p style={{ color: 'var(--text-4)', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>{t('about.ctaDesc')}</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={() => navigate('/login')} style={{ padding: '9px 20px', borderRadius: 7, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-h)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--accent)'}
              ><ArrowRightRegular fontSize={15} />{t('about.ctaLogin')}</button>
              <button onClick={() => navigate('/contact')} style={{ padding: '9px 20px', borderRadius: 7, background: 'var(--accent-bg)', border: '1px solid var(--accent-bd)', color: 'var(--accent-tx)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-bd)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--accent-bg)'}
              >{t('about.ctaContact')}</button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
