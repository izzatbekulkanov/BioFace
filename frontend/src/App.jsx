import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useTheme, ThemeProvider as FluentThemeSync } from 'next-themes'
import { FluentProvider, webDarkTheme, webLightTheme } from '@fluentui/react-components'
import { useTranslation } from 'react-i18next'
import Navbar    from './components/Navbar'
import Login     from './pages/Login'
import About     from './pages/About'
import Pricing   from './pages/Pricing'
import Contact   from './pages/Contact'
import MapView   from './pages/MapView'
import Dashboard    from './pages/Dashboard'
import Devices      from './pages/Devices'
import CameraDetail from './pages/CameraDetail'
import Commands       from './pages/Commands'
import Settings       from './pages/Settings'
import IsupServer     from './pages/IsupServer'
import RedisMonitor   from './pages/RedisMonitor'
import ApiHelper      from './pages/ApiHelper'
import SystemUsers    from './pages/SystemUsers'
import UserForm       from './pages/UserForm'
import EmployeesPage  from './pages/EmployeesPage'
import EmployeeForm   from './pages/EmployeeForm'
import EmployeeDetail from './pages/EmployeeDetail'
import Attendance     from './pages/Attendance'
import AttendanceGroups from './pages/AttendanceGroups'
import FaceIdControl from './pages/FaceIdControl'
import PsychologicalPortrait from './pages/PsychologicalPortrait'
import MiddlewareLogs from './pages/MiddlewareLogs'
import Shifts         from './pages/Shifts'
import Organizations  from './pages/Organizations'
import OrganizationDetail from './pages/OrganizationDetail'
import OrganizationForm from './pages/OrganizationForm'
import Tracking from './pages/Tracking'
import BranchDetail from './pages/BranchDetail'
import Profile          from './pages/Profile'
import ContactMessages  from './pages/ContactMessages'
import Feedbacks        from './pages/Feedbacks'
import PrivacyPolicy    from './pages/PrivacyPolicy'
import Salary           from './pages/Salary'
import SalaryDetail     from './pages/SalaryDetail'
import Kpi              from './pages/Kpi'
import Cashflow         from './pages/Cashflow'
import Accounts         from './pages/Accounts'
import Tabel            from './pages/Tabel'
import SalaryRates      from './pages/SalaryRates'
import Versions         from './pages/Versions'
import VersionForm      from './pages/VersionForm'
import VersionDetail    from './pages/VersionDetail'
import ErrorPage        from './pages/ErrorPage'
import SpecialStatuses  from './pages/SpecialStatuses'
import AuditLogs        from './pages/AuditLogs'
import { ConfirmProvider } from './components/ConfirmDialog'
import { ToastProvider, useToast } from './components/Toaster'
import Footer from './components/Footer'

function getIsLoggedIn() {
  return localStorage.getItem('bf_logged_in') === 'true'
}

function clearClientSessionState() {
  localStorage.removeItem('bf_logged_in')
  localStorage.removeItem('bf_dashboard_metrics')
  localStorage.removeItem('bf_dashboard_trend')
  localStorage.removeItem('bf_dashboard_events')
}

// Fluent UI must be inside next-themes ThemeProvider so it can read resolvedTheme
function FluentSync({ children }) {
  const { resolvedTheme } = useTheme()
  return (
    <FluentProvider theme={resolvedTheme === 'light' ? webLightTheme : webDarkTheme}>
      {children}
    </FluentProvider>
  )
}

export default function App() {
  const [isLoggedIn, setLoggedIn] = useState(getIsLoggedIn)
  const { i18n } = useTranslation()

  useEffect(() => {
    let cancelled = false

    if (!getIsLoggedIn()) {
      return () => {
        cancelled = true
      }
    }

    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => {
        if (!res.ok) {
          throw new Error('Session expired')
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearClientSessionState()
          setLoggedIn(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const handleLogin = () => {
    localStorage.setItem('bf_logged_in', 'true')
    // Dashboard cache ni tozalaymiz — yangi foydalanuvchi eski datani ko'rmasin
    localStorage.removeItem('bf_dashboard_metrics')
    localStorage.removeItem('bf_dashboard_trend')
    localStorage.removeItem('bf_dashboard_events')
    setLoggedIn(true)
  }

  const handleLogout = () => {
    fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {})
    clearClientSessionState()
    setLoggedIn(false)
  }

  // Language switcher — changes i18next language and persists in localStorage
  const handleLangChange = (lang) => {
    i18n.changeLanguage(lang)
    localStorage.setItem('bf_lang', lang)
    document.cookie = `lang=${lang};path=/;max-age=31536000`
  }

  const location = useLocation()
  const isMapOrTracking = location.pathname === '/organizations/tracking' || location.pathname === '/map'

  return (
    <FluentSync>
      <ConfirmProvider>
        <ToastProvider>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          height: isMapOrTracking ? '100vh' : 'auto',
          minHeight: '100vh',
          overflow: isMapOrTracking ? 'hidden' : 'visible'
        }}>
          <Navbar
            isLoggedIn={isLoggedIn}
            onLogout={handleLogout}
            onLangChange={handleLangChange}
          />
          <main style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column',
            height: isMapOrTracking ? 'calc(100vh - 52px)' : 'auto',
            overflow: isMapOrTracking ? 'hidden' : 'visible'
          }}>
            <Routes>
              <Route path="/"          element={<Navigate to={isLoggedIn ? '/dashboard' : '/login'} replace />} />
              <Route path="/login"     element={<Login onLogin={handleLogin} />} />
              <Route path="/about"     element={<About />} />
              <Route path="/pricing"   element={<Pricing />} />
              <Route path="/contact"   element={<Contact />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/map"       element={<MapView isLoggedIn={isLoggedIn} />} />
              <Route path="/dashboard"   element={isLoggedIn ? <Dashboard /> : <Navigate to="/login" replace />} />
              <Route path="/devices"     element={isLoggedIn ? <Devices />   : <Navigate to="/login" replace />} />
              <Route path="/devices/:id" element={isLoggedIn ? <CameraDetail /> : <Navigate to="/login" replace />} />
              <Route path="/commands"        element={isLoggedIn ? <Commands />  : <Navigate to="/login" replace />} />
              <Route path="/settings"        element={isLoggedIn ? <Settings />     : <Navigate to="/login" replace />} />
              <Route path="/settings/messages" element={isLoggedIn ? <ContactMessages /> : <Navigate to="/login" replace />} />
              <Route path="/settings/feedbacks" element={isLoggedIn ? <Feedbacks /> : <Navigate to="/login" replace />} />
              <Route path="/settings/isup"   element={isLoggedIn ? <IsupServer />   : <Navigate to="/login" replace />} />
              <Route path="/settings/redis"  element={isLoggedIn ? <RedisMonitor /> : <Navigate to="/login" replace />} />
              <Route path="/settings/api"    element={isLoggedIn ? <ApiHelper />    : <Navigate to="/login" replace />} />
              <Route path="/users"           element={isLoggedIn ? <SystemUsers />                    : <Navigate to="/login" replace />} />
              <Route path="/users/new"       element={isLoggedIn ? <UserForm />                       : <Navigate to="/login" replace />} />
              <Route path="/users/:id/edit"  element={isLoggedIn ? <UserForm />                       : <Navigate to="/login" replace />} />
              <Route path="/users/staff"     element={isLoggedIn ? <EmployeesPage mode="staff" />     : <Navigate to="/login" replace />} />
              <Route path="/users/staff/new" element={isLoggedIn ? <EmployeeForm />                  : <Navigate to="/login" replace />} />
              <Route path="/users/students"  element={isLoggedIn ? <EmployeesPage mode="students" />  : <Navigate to="/login" replace />} />
              <Route path="/users/students/new" element={isLoggedIn ? <EmployeeForm />               : <Navigate to="/login" replace />} />
              <Route path="/users/special-statuses" element={isLoggedIn ? <SpecialStatuses /> : <Navigate to="/login" replace />} />
              <Route path="/employees/:id/edit" element={isLoggedIn ? <EmployeeForm />               : <Navigate to="/login" replace />} />
              <Route path="/employees/:id"      element={isLoggedIn ? <EmployeeDetail />             : <Navigate to="/login" replace />} />
              <Route path="/attendance"      element={isLoggedIn ? <Attendance /> : <Navigate to="/login" replace />} />
              <Route path="/attendance/employees" element={isLoggedIn ? <AttendanceGroups /> : <Navigate to="/login" replace />} />
              <Route path="/attendance/control" element={isLoggedIn ? <FaceIdControl /> : <Navigate to="/login" replace />} />
              <Route path="/psychology"      element={isLoggedIn ? <PsychologicalPortrait /> : <Navigate to="/login" replace />} />
              <Route path="/shifts"          element={isLoggedIn ? <Shifts />    : <Navigate to="/login" replace />} />
              <Route path="/organizations"        element={isLoggedIn ? <Organizations /> : <Navigate to="/login" replace />} />
              <Route path="/organizations/new"    element={isLoggedIn ? <OrganizationForm /> : <Navigate to="/login" replace />} />
              <Route path="/organizations/:id"    element={isLoggedIn ? <OrganizationDetail /> : <Navigate to="/login" replace />} />
              <Route path="/organizations/tracking" element={isLoggedIn ? <Tracking /> : <Navigate to="/login" replace />} />
              <Route path="/organizations/:id/branches/:branchId" element={isLoggedIn ? <BranchDetail /> : <Navigate to="/login" replace />} />
              <Route path="/organizations/:id/edit" element={isLoggedIn ? <OrganizationForm /> : <Navigate to="/login" replace />} />
              <Route path="/middleware-logs" element={isLoggedIn ? <MiddlewareLogs /> : <Navigate to="/login" replace />} />
              <Route path="/finance/salary"   element={isLoggedIn ? <Salary />   : <Navigate to="/login" replace />} />
              <Route path="/finance/salary/:id" element={isLoggedIn ? <SalaryDetail /> : <Navigate to="/login" replace />} />
              <Route path="/finance/kpi"      element={isLoggedIn ? <Kpi />      : <Navigate to="/login" replace />} />
              <Route path="/finance/cashflow" element={isLoggedIn ? <Cashflow /> : <Navigate to="/login" replace />} />
              <Route path="/finance/accounts" element={isLoggedIn ? <Accounts /> : <Navigate to="/login" replace />} />
              <Route path="/finance/tabel"    element={isLoggedIn ? <Tabel />    : <Navigate to="/login" replace />} />
              <Route path="/finance/rates"    element={isLoggedIn ? <SalaryRates /> : <Navigate to="/login" replace />} />
              <Route path="/profile"         element={isLoggedIn ? <Profile />        : <Navigate to="/login" replace />} />
              <Route path="/settings/versions"          element={isLoggedIn ? <Versions />      : <Navigate to="/login" replace />} />
              <Route path="/settings/versions/new"      element={isLoggedIn ? <VersionForm />   : <Navigate to="/login" replace />} />
              <Route path="/settings/versions/:id"      element={isLoggedIn ? <VersionDetail /> : <Navigate to="/login" replace />} />
              <Route path="/settings/versions/:id/edit" element={isLoggedIn ? <VersionForm />   : <Navigate to="/login" replace />} />
              <Route path="/audit-logs" element={isLoggedIn ? <AuditLogs /> : <Navigate to="/login" replace />} />
              {/* ── Catch-all: 404 for any unknown path ── */}
              <Route path="*" element={<ErrorPage status={404} />} />
            </Routes>
          </main>
          {!isMapOrTracking && <Footer isLoggedIn={isLoggedIn} />}
        </div>
        <AppDownloadFloatingWidget />
        <AppPromoFloatingWidget />
        <CookieConsentBanner />
        </ToastProvider>
      </ConfirmProvider>
    </FluentSync>
  )
}

function AppPromoFloatingWidget() {
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const isRu = i18n.language === 'ru'
  const location = useLocation()

  const [isVisible, setIsVisible] = useState(false)

  // Public paths on which the promo can show
  const PROMO_PATHS = ['/login', '/map', '/about', '/contact', '/privacy-policy']
  const isPromoRoute = PROMO_PATHS.includes(location.pathname)

  useEffect(() => {
    if (!isPromoRoute) {
      setIsVisible(false)
      return
    }

    // 1. Session Storage Cooldown: if user closed it, do not show again during this session
    const isDismissed = sessionStorage.getItem('bf_promo_dismissed') === 'true'
    if (isDismissed) return

    // 2. Randomized marketing engine: 75% chance to trigger
    const shouldTrigger = Math.random() < 0.75
    if (!shouldTrigger) return

    // 3. Intelligent popup delay: show after 4 seconds to look organic
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 4000)

    return () => clearTimeout(timer)
  }, [location.pathname, isPromoRoute])

  if (!isPromoRoute || !isVisible) return null

  const handleClose = (e) => {
    e.stopPropagation() // Prevent click from triggering navigation to /pricing
    setIsVisible(false)
    sessionStorage.setItem('bf_promo_dismissed', 'true')
  }

  return (
    <>
      <style>{`
        @keyframes pulseNeon {
          0%, 100% {
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 10px rgba(0, 120, 212, 0.3), inset 0 0 15px rgba(0, 120, 212, 0.1);
            border-color: rgba(0, 120, 212, 0.3);
          }
          50% {
            box-shadow: 0 12px 40px rgba(0, 120, 212, 0.3), 0 0 20px rgba(0, 120, 212, 0.6), inset 0 0 25px rgba(0, 120, 212, 0.2);
            border-color: rgba(0, 120, 212, 0.8);
          }
        }
        @keyframes shimmerText {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes floatIcon {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-4px) rotate(-5deg); }
        }
        @media print {
          .promo-floating-widget {
            display: none !important;
          }
        }
      `}</style>
      <div className="promo-floating-widget" onClick={() => navigate('/pricing')} style={{
        position: 'fixed',
        bottom: '16px',
        left: '16px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(0, 120, 212, 0.3)',
        borderRadius: '16px',
        padding: '16px',
        width: '240px',
        cursor: 'pointer',
        animation: 'pulseNeon 3s infinite ease-in-out',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        userSelect: 'none',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)';
        e.currentTarget.style.background = 'rgba(15, 23, 42, 0.95)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0) scale(1)';
        e.currentTarget.style.background = 'rgba(15, 23, 42, 0.85)';
      }}
      >
        {/* Badge & Close Button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ 
            fontSize: '9.5px', 
            fontWeight: 800, 
            background: 'linear-gradient(135deg, #ef4444 0%, #f43f5e 100%)', 
            color: '#ffffff', 
            borderRadius: '100px', 
            padding: '3px 10px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            boxShadow: '0 4px 10px rgba(239, 68, 68, 0.4)'
          }}>
            {isRu ? 'АКЦИЯ -25%' : 'AKSIYA -25%'}
          </span>
          <button 
            onClick={handleClose}
            title={isRu ? 'Закрыть' : 'Yopish'}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px',
              borderRadius: '50%',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = '#94a3b8';
              e.currentTarget.style.background = 'none';
            }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        {/* Content Layout */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          {/* Glowing Animated Icon */}
          <div style={{ 
            width: '42px', 
            height: '42px', 
            borderRadius: '12px', 
            background: 'rgba(0, 120, 212, 0.15)', 
            border: '1px solid rgba(0, 120, 212, 0.3)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: 'var(--accent-tx)',
            flexShrink: 0,
            animation: 'floatIcon 3s infinite ease-in-out',
            boxShadow: '0 0 10px rgba(0, 120, 212, 0.2)'
          }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M12.75,3.75A2.25,2.25,0,0,0,10.5,6v4.5H6A2.25,2.25,0,0,0,3.75,12.75v5.25A2.25,2.25,0,0,0,6,20.25h12A2.25,2.25,0,0,0,20.25,18V12.75A2.25,2.25,0,0,0,18,10.5h-4.5V6A2.25,2.25,0,0,0,12.75,3.75ZM12,5.25A.75.75,0,0,1,12.75,6v4.5h-1.5V6A.75.75,0,0,1,12,5.25ZM6,12h12a.75.75,0,0,1,.75.75v5.25a.75.75,0,0,1-.75.75H6a.75.75,0,0,1-.75-.75V12.75A.75.75,0,0,1,6,12Zm3.75,3a1.5,1.5,0,1,0,1.5,1.5A1.5,1.5,0,0,0,9.75,15Zm4.5,0a1.5,1.5,0,1,0,1.5,1.5A1.5,1.5,0,0,0,14.25,15Z"/>
            </svg>
          </div>

          {/* Description text */}
          <div style={{ flex: 1 }}>
            <h4 style={{ 
              fontSize: '13.5px', 
              fontWeight: 800, 
              color: '#ffffff', 
              lineHeight: '1.3',
              marginBottom: '4px'
            }}>
              {isRu ? 'Сэкономьте миллионы!' : 'Millionlab tejang!'}
            </h4>
            <p style={{ 
              fontSize: '11.5px', 
              color: '#94a3b8', 
              lineHeight: '1.4'
            }}>
              {isRu 
                ? 'Установите BioFace со скидкой 25% и получите годовой SLA в подарок.' 
                : 'BioFace tizimini 25% chegirma bilan o‘rnating va yillik SLAga ega bo‘ling.'}
            </p>
          </div>
        </div>

        {/* Shimmering Button CTA */}
        <div style={{
          background: 'linear-gradient(90deg, #0078d4, #00c6ff, #0078d4)',
          backgroundSize: '200% auto',
          color: '#ffffff',
          border: 'none',
          borderRadius: '8px',
          padding: '8px 14px',
          fontSize: '12px',
          fontWeight: 700,
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          marginTop: '6px',
          boxShadow: '0 4px 12px rgba(0, 120, 212, 0.3)',
          animation: 'shimmerText 3s infinite linear',
          transition: 'transform 0.15s'
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <span>{isRu ? 'Рассчитать скидку' : 'Chegirmani hisoblash'}</span>
          <span>➔</span>
        </div>
      </div>
    </>
  )
}

function AppDownloadFloatingWidget() {
  const { i18n } = useTranslation()
  const toast = useToast()
  const isRu = i18n.language === 'ru'
  const location = useLocation()

  // Public paths on which the download widget will be visible
  const PUBLIC_PATHS = ['/login', '/map', '/about', '/pricing', '/contact', '/privacy-policy']
  const isPublicRoute = PUBLIC_PATHS.includes(location.pathname)

  if (!isPublicRoute) return null

  const handleClick = (platform) => {
    const msg = isRu 
      ? `Мобильное приложение BioFace для ${platform} находится на стадии разработки.`
      : `BioFace mobil ilovasi ${platform} platformasi uchun hozirda ishlab chiqish jarayonida.`
    toast.info(msg)
  }

  return (
    <>
      <style>{`
        @media print {
          .download-floating-widget {
            display: none !important;
          }
        }
      `}</style>
      <div className="download-floating-widget" style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        background: 'var(--surface)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        padding: '10px',
        boxShadow: 'var(--shadow)',
        width: '150px',
        pointerEvents: 'auto',
      }}>
        <div style={{ 
          fontSize: '9.5px', 
          color: 'var(--text-3)', 
          fontWeight: 700, 
          letterSpacing: '0.5px', 
          textTransform: 'uppercase', 
          marginBottom: '4px', 
          textAlign: 'center' 
        }}>
          {isRu ? 'Скачать приложение' : 'Ilovani yuklash'}
        </div>
        
        {/* App Store button */}
        <button 
          onClick={() => handleClick('App Store')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: '5px',
            padding: '5px 8px',
            color: 'var(--text-1)',
            cursor: 'pointer',
            transition: 'all 0.15s',
            textAlign: 'left',
            width: '100%',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.background = 'var(--surface-3)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.background = 'var(--surface-2)';
          }}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
            <path d="M18.71,19.5C17.88,20.74,17,21.95,15.66,22c-1.31,0-1.72-.8-3.22-.8-1.5,0-2,.78-3.2.82C7.93,22,7,20.72,6.13,19.49,4.41,17,3.1,12.39,4.87,9.32a5.21,5.21,0,0,1,4.39-2.65c1.33,0,2.58.92,3.39.92s2.29-1.09,3.87-.93a5.16,5.16,0,0,1,4.07,2.28C17.29,11.08,18.84,16.85,18.71,19.5ZM15.92,5.21a5,5,0,0,0,1.18-3.56,5.13,5.13,0,0,0-3.34,1.72,4.8,4.8,0,0,0-1.25,3.46A4.32,4.32,0,0,0,15.92,5.21Z"/>
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '8px', textTransform: 'uppercase', color: 'var(--text-3)', lineHeight: 1 }}>Download on the</span>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.1, marginTop: '1px' }}>App Store</span>
          </div>
        </button>

        {/* Google Play button */}
        <button 
          onClick={() => handleClick('Google Play')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: '5px',
            padding: '5px 8px',
            color: 'var(--text-1)',
            cursor: 'pointer',
            transition: 'all 0.15s',
            textAlign: 'left',
            width: '100%',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.background = 'var(--surface-3)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.background = 'var(--surface-2)';
          }}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
            <path d="M5,3.06c-0.12,0.13-0.2,0.33-0.2,0.58v16.72c0,0.25,0.08,0.45,0.2,0.58l0.11,0.1L14.7,12.2v-0.4L5.11,2.96L5,3.06z M17.9,15.4l-3.2-3.2v-0.4l3.2-3.2l0.1,0.06l3.8,2.2c1.1,0.6,1.1,1.6,0,2.2l-3.8,2.2C18,15.34,17.95,15.38,17.9,15.4z M14.1,11.8L5.6,3.3 C5.8,3.2,6,3.2,6.3,3.3l11.6,6.6L14.1,11.8z M14.1,12.2l3.8,3.8l-11.6,6.6C6,22.8,5.8,22.8,5.6,22.7L14.1,12.2z"/>
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '8px', textTransform: 'uppercase', color: 'var(--text-3)', lineHeight: 1 }}>Get it on</span>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.1, marginTop: '1px' }}>Google Play</span>
          </div>
        </button>
      </div>
    </>
  )
}

function CookieConsentBanner() {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'ru' ? 'ru' : 'uz'
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const accepted = localStorage.getItem('bf_cookies_accepted')
    if (!accepted) {
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem('bf_cookies_accepted', 'true')
    setIsVisible(false)
  }

  if (!isVisible) return null

  const texts = {
    uz: {
      text: 'Biz foydalanish qulayligini oshirish va sayt sifatini yaxshilash uchun cookielardan foydalanamiz.',
      btn: 'Tushunarli'
    },
    ru: {
      text: 'Мы используем файлы cookie для повышения удобства использования и улучшения качества сайта.',
      btn: 'Понятно'
    }
  }

  const t = texts[lang]

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '24px',
      zIndex: 9999,
      maxWidth: '350px',
      background: 'rgba(25, 25, 35, 0.75)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '12px',
      padding: '16px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      animation: 'slideUpCookie 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      <style>{`
        @keyframes slideUpCookie {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '20px' }}>🍪</span>
        <p style={{ margin: 0, fontSize: '12.5px', color: '#e0e0e3', lineHeight: '1.45', fontWeight: '500' }}>
          {t.text}
        </p>
      </div>
      <button 
        onClick={handleAccept}
        style={{
          alignSelf: 'flex-end',
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          padding: '6px 14px',
          fontSize: '12px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.15s'
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-h)'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--accent)'}
      >
        {t.btn}
      </button>
    </div>
  )
}
