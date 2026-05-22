import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useToast } from './Toaster'
import { useTheme } from 'next-themes'
import { useTranslation } from 'react-i18next'
import { Tooltip } from '@fluentui/react-components'
import {
  MapRegular, InfoRegular, MailRegular, SignOutRegular, PersonRegular,
  GridRegular, CameraRegular, CodeRegular, WeatherSunnyRegular, WeatherMoonRegular,
  SettingsRegular, HistoryRegular, CalendarClockRegular,
  ServerRegular, DatabaseRegular, PlugConnectedRegular, ChevronDownRegular,
  PeopleRegular, ShieldRegular, HatGraduationRegular,
  ClipboardTaskListLtrRegular, BrainCircuitRegular, BuildingRegular, AlertRegular,
} from '@fluentui/react-icons'

const PUBLIC_LINKS  = ['map', 'about', 'contact']
const PRIVATE_LINKS = ['dashboard', 'devices', 'attendance', 'psychology', 'shifts', 'organizations', 'middlewareLogs']

const LINK_ICONS = {
  map:            <MapRegular  fontSize={17} />,
  about:          <InfoRegular fontSize={17} />,
  contact:        <MailRegular fontSize={17} />,
  dashboard:      <GridRegular fontSize={17} />,
  devices:        <CameraRegular fontSize={17} />,
  shifts:         <CalendarClockRegular fontSize={17} />,
  attendance:     <ClipboardTaskListLtrRegular fontSize={17} />,
  psychology:     <BrainCircuitRegular fontSize={17} />,
  organizations:  <BuildingRegular fontSize={17} />,
  middlewareLogs: <HistoryRegular fontSize={17} />,
  settings:       <SettingsRegular fontSize={17} />,
}
const LINK_PATHS = {
  map: '/map', about: '/about', contact: '/contact', dashboard: '/dashboard', 
  devices: '/devices', shifts: '/shifts', attendance: '/attendance', psychology: '/psychology', organizations: '/organizations', middlewareLogs: '/middleware-logs', settings: '/settings',
}

// Navbar ichida barcha tugmalar oq matnli
const navBtn = (active) => ({
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '5px 13px', borderRadius: 6, border: 'none',
  background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
  color: active ? '#fff' : 'rgba(255,255,255,0.55)',
  fontWeight: active ? 600 : 400,
  fontSize: 13, cursor: 'pointer',
})

function NavBtn({ id, active, onClick }) {
  const { t } = useTranslation()
  return (
    <button onClick={onClick} style={navBtn(active)}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff' } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' } }}
    >
      {LINK_ICONS[id]}
      {t(`nav.${id}`)}
    </button>
  )
}

// Dropdown menu for Settings section
function SettingsDropdown({ active }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const isRu = i18n.language === 'ru'

  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  const items = [
    { id: 'settings', label: isRu ? 'Настройки' : 'Sozlamalar', icon: <SettingsRegular fontSize={15} />, path: '/settings' },
    { id: 'messages', label: isRu ? 'Обращения' : 'Murojaatlar', icon: <MailRegular fontSize={15} />, path: '/settings/messages' },
    { id: 'isup', label: 'ISUP Server', icon: <ServerRegular fontSize={15} />, path: '/settings/isup' },
    { id: 'redis', label: 'Redis', icon: <DatabaseRegular fontSize={15} />, path: '/settings/redis' },
    { id: 'api', label: 'API Helper', icon: <PlugConnectedRegular fontSize={15} />, path: '/settings/api' },
  ]

  return <NavDropdown
    label={t('nav.settings')}
    icon={<SettingsRegular fontSize={17} />}
    items={items}
    active={active}
    open={open}
    setOpen={setOpen}
    refEl={ref}
    location={location}
    navigate={navigate}
  />
}

// Dropdown menu for Users section
function UsersDropdown({ active }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  const items = [
    { id: 'usersAdmins',  label: t('nav.usersAdmins'),  icon: <ShieldRegular fontSize={15} />,         path: '/users' },
    { id: 'usersStaff',   label: t('nav.usersStaff'),   icon: <PeopleRegular fontSize={15} />,         path: '/users/staff' },
    { id: 'usersStudents',label: t('nav.usersStudents'),icon: <HatGraduationRegular fontSize={15} />,  path: '/users/students' },
  ]

  return <NavDropdown
    label={t('nav.users')}
    icon={<PeopleRegular fontSize={17} />}
    items={items}
    active={active}
    open={open}
    setOpen={setOpen}
    refEl={ref}
    location={location}
    navigate={navigate}
  />
}

// Shared dropdown shell used by both SettingsDropdown and UsersDropdown
function NavDropdown({ label, icon, items, active, open, setOpen, refEl, location, navigate }) {
  return (
    <div ref={refEl} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{
        ...navBtn(active),
        gap: 5,
      }}
        onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff' } }}
        onMouseLeave={e => { if (!active && !open) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' } }}
      >
        {icon}
        {label}
        <ChevronDownRegular fontSize={12} style={{ opacity: 0.6, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 6,
          background: '#1a2236', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10, padding: '6px', minWidth: 220,
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          zIndex: 999, animation: 'fadeIn 0.15s ease',
        }}>
          {items.map(item => {
            const isActive = location.pathname === item.path
            return (
              <button key={item.id} onClick={() => { navigate(item.path); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '9px 12px', borderRadius: 7, border: 'none',
                  background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.7)',
                  fontSize: 13, fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.background = isActive ? 'rgba(255,255,255,0.1)' : 'transparent'; e.currentTarget.style.color = isActive ? '#fff' : 'rgba(255,255,255,0.7)' }}
              >
                {item.icon}
                {item.label}
              </button>
            )
          })}
        </div>
      )}
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-4px) } to { opacity: 1; transform: translateY(0) } }`}</style>
    </div>
  )
}

const NAV_BG = '#0f172a'

export default function Navbar({ isLoggedIn, onLogout, onLangChange }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { t, i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const { resolvedTheme, setTheme } = useTheme()
  const isLogin = location.pathname === '/login'
  const isDark  = resolvedTheme === 'dark'
  const [menuOpen, setMenuOpen] = useState(false)
  const toast = useToast()

  const [notifications, setNotifications] = useState([])
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const notifRef = useRef(null)

  // Load dismissed system/camera alerts from localStorage
  const [dismissedAlerts, setDismissedAlerts] = useState(() => {
    try {
      const saved = localStorage.getItem('dismissedAlerts')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Save dismissed alerts to localStorage
  const dismissAlert = (alertId) => {
    const updated = [...dismissedAlerts, alertId]
    setDismissedAlerts(updated)
    localStorage.setItem('dismissedAlerts', JSON.stringify(updated))
  }

  // Fetch notifications
  const fetchNavbarStatus = async () => {
    if (!isLoggedIn) return
    try {
      // 1. Fetch system status
      const res = await fetch('/api/system-monitor/navbar-status', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()

      const list = []

      // Telegram bot offline alert
      if (data.telegram && data.telegram.online === false) {
        list.push({
          id: 'bot-offline',
          isBotOffline: true,
          titleUz: 'Telegram bot to\'xtagan!',
          titleRu: 'Telegram-бот остановлен!',
          descUz: 'Tizimdagi xabar yuborish telegram boti ishlamayapti.',
          descRu: 'Служба Telegram-бота не активна.',
          type: 'error',
          icon: <AlertRegular style={{ color: '#f87171' }} fontSize={18} />,
        })
      }

      // Camera offline alerts
      if (data.camera_alerts && data.camera_alerts.items) {
        data.camera_alerts.items.forEach(cam => {
          const alertId = `cam-offline-${cam.id}-${cam.last_seen_at || 'never'}`
          list.push({
            id: alertId,
            titleUz: `${cam.name} kamerasi oflayn!`,
            titleRu: `Камера ${cam.name} отключена!`,
            descUz: cam.organization_name 
              ? `${cam.organization_name}. Oxirgi faollik: ${cam.last_seen_at ? new Date(cam.last_seen_at).toLocaleString() : 'hech qachon'}`
              : `Oxirgi faollik: ${cam.last_seen_at ? new Date(cam.last_seen_at).toLocaleString() : 'hech qachon'}`,
            descRu: cam.organization_name
              ? `${cam.organization_name}. Последняя активность: ${cam.last_seen_at ? new Date(cam.last_seen_at).toLocaleString() : 'никогда'}`
              : `Последняя активность: ${cam.last_seen_at ? new Date(cam.last_seen_at).toLocaleString() : 'никогда'}`,
            type: 'warning',
            path: '/devices',
            icon: <CameraRegular style={{ color: '#fb923c' }} fontSize={18} />,
          })
        })
      }

      // 2. Fetch unread appeals (contact messages)
      if (data.unread_appeals_count > 0) {
        const appealsRes = await fetch('/api/settings/contact-messages', { credentials: 'include' })
        if (appealsRes.ok) {
          const appealsData = await appealsRes.json()
          if (appealsData.messages) {
            appealsData.messages.forEach(msg => {
              if (!msg.is_read) {
                list.push({
                  id: `appeal-${msg.id}`,
                  appealId: msg.id,
                  titleUz: `Yangi murojaat: ${msg.name}`,
                  titleRu: `Новое обращение: ${msg.name}`,
                  descUz: msg.message.length > 60 ? `${msg.message.substring(0, 60)}...` : msg.message,
                  descRu: msg.message.length > 60 ? `${msg.message.substring(0, 60)}...` : msg.message,
                  type: 'info',
                  path: '/settings/messages',
                  icon: <MailRegular style={{ color: '#38bdf8' }} fontSize={18} />,
                })
              }
            })
          }
        }
      }

      setNotifications(list)
    } catch (err) {
      console.error('Error fetching navbar status alerts:', err)
    }
  }

  // Poll notifications
  useEffect(() => {
    if (isLoggedIn) {
      fetchNavbarStatus()
      const interval = setInterval(fetchNavbarStatus, 8000)

      const handleRefresh = () => {
        fetchNavbarStatus()
      }
      window.addEventListener('navbar-refresh', handleRefresh)

      return () => {
        clearInterval(interval)
        window.removeEventListener('navbar-refresh', handleRefresh)
      }
    } else {
      setNotifications([])
    }
  }, [isLoggedIn])

  // Handle click outside notifications dropdown
  useEffect(() => {
    function handleOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setIsNotifOpen(false)
      }
    }
    if (isNotifOpen) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [isNotifOpen])

  const activeNotifications = notifications.filter(notif => {
    if (notif.appealId) return true
    return !dismissedAlerts.includes(notif.id)
  })

  const [logoUrl, setLogoUrl] = useState('')
  const [faviconUrl, setFaviconUrl] = useState('')
  const [appName, setAppName] = useState('BioFace')
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    const fetchUser = () => {
      if (isLoggedIn) {
        fetch('/api/auth/me', { credentials: 'include' })
          .then(res => {
            if (res.ok) return res.json()
            throw new Error('Unauthorized')
          })
          .then(data => {
            setCurrentUser(data)
          })
          .catch(err => {
            console.log('Error loading current user:', err)
          })
      } else {
        setCurrentUser(null)
      }
    }

    fetchUser()
    window.addEventListener('user-profile-updated', fetchUser)
    return () => window.removeEventListener('user-profile-updated', fetchUser)
  }, [isLoggedIn])

  const getUserInitials = () => {
    if (!currentUser) return ''
    const last = (currentUser.last_name || '').trim()
    const first = (currentUser.first_name || '').trim()
    if (last && first) {
      return `${last}.${first.charAt(0).toUpperCase()}.`
    }
    if (last) return last
    if (first) return first
    return (currentUser.display_name || currentUser.name || '').trim()
  }

  const initials = getUserInitials()

  useEffect(() => {
    fetch('/api/settings')
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Failed to load settings');
      })
      .then(data => {
        if (data) {
          setAppName(data.app_name || 'BioFace')
          setLogoUrl(data.logo_url || '')
          setFaviconUrl(data.favicon_url || '')
        }
      })
      .catch(err => {
        console.log('Error loading branding settings:', err)
      })
  }, [])

  useEffect(() => {
    const link = document.querySelector("link[rel~='icon']") || document.querySelector("link[rel='shortcut icon']");
    if (link) {
      link.href = faviconUrl || '/favicon.svg';
    } else {
      const newLink = document.createElement('link');
      newLink.rel = 'icon';
      newLink.href = faviconUrl || '/favicon.svg';
      document.head.appendChild(newLink);
    }
  }, [faviconUrl])

  useEffect(() => {
    document.title = appName || 'BioFace';
  }, [appName])

  const handleLangChange = (lang) => {
    i18n.changeLanguage(lang)
    if (onLangChange) onLangChange(lang)
  }

  const handleLogout = () => {
    if (onLogout) onLogout()
    navigate('/login')
  }

  const links = isLoggedIn ? PRIVATE_LINKS : PUBLIC_LINKS

  return (
    <>
      <header style={{
        height: 52,
        background: NAV_BG,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center',
        padding: '0 24px', gap: 4,
        position: 'sticky', top: 0, zIndex: 200,
      }}>
        {/* Logo */}
        <div onClick={() => { navigate(isLoggedIn ? '/dashboard' : '/'); setMenuOpen(false); }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginRight: 16 }}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={appName}
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                objectFit: 'contain',
                flexShrink: 0,
              }}
            />
          ) : (
            <div style={{
              width: 28, height: 28, background: 'var(--accent)',
              borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0,
            }}>
              {appName ? appName.charAt(0).toUpperCase() : 'B'}
            </div>
          )}
          <span style={{ fontWeight: 700, fontSize: 16, color: '#fff', letterSpacing: -0.3 }}>
            {appName}
          </span>
        </div>

        {/* Desktop Nav links */}
        <nav className="desktop-nav" style={{ display: 'flex', gap: 2, flex: 1 }}>
          {links.map(id => (
            <NavBtn key={id} id={id}
              active={location.pathname === LINK_PATHS[id] || location.pathname.startsWith(LINK_PATHS[id] + '/')}
              onClick={() => navigate(LINK_PATHS[id])}
            />
          ))}
          {isLoggedIn && (
            <>
              <UsersDropdown active={location.pathname.startsWith('/users')} />
              <SettingsDropdown active={location.pathname.startsWith('/settings')} />
            </>
          )}
        </nav>

        {/* Desktop Actions wrapper */}
        <div className="desktop-actions" style={{ display: 'flex', alignItems: 'center' }}>
          {/* Theme toggle */}
          <Tooltip content={isDark ? t('nav.themeLight') : t('nav.themeDark')} relationship="label">
            <button onClick={() => setTheme(isDark ? 'light' : 'dark')} aria-label="Toggle theme"
              style={{
                width: 34, height: 34, borderRadius: 8,
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,0.6)', cursor: 'pointer', marginRight: 8, flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
            >
              {isDark ? <WeatherSunnyRegular fontSize={16} /> : <WeatherMoonRegular fontSize={16} />}
            </button>
          </Tooltip>

          {/* Language switcher */}
          <div style={{
            display: 'flex', background: 'rgba(255,255,255,0.07)', borderRadius: 7,
            padding: 3, marginRight: 10, border: '1px solid rgba(255,255,255,0.1)',
          }}>
            {['uz', 'ru'].map(l => (
              <button key={l} onClick={() => handleLangChange(l)} style={{
                padding: '3px 11px', borderRadius: 5, border: 'none',
                background: i18n.language === l ? 'var(--accent)' : 'transparent',
                color: i18n.language === l ? '#fff' : 'rgba(255,255,255,0.5)',
                fontSize: 11.5, fontWeight: i18n.language === l ? 700 : 400,
                cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 0.5,
              }}>{l}</button>
            ))}
          </div>

          {/* Auth button */}
          {isLoggedIn && (
            <Tooltip content={i18n.language === 'ru' ? 'Профиль' : 'Profil'} relationship="label">
              <button onClick={() => navigate('/profile')} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 13px', borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)',
                color: '#fff', fontSize: 13, cursor: 'pointer',
                marginRight: 8,
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              >
                <PersonRegular fontSize={15} />
                {initials || (i18n.language === 'ru' ? 'Профиль' : 'Profil')}
              </button>
            </Tooltip>
          )}

          {isLoggedIn ? (
            <Tooltip content={t('nav.logout')} relationship="label">
              <button onClick={handleLogout} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 13px', borderRadius: 6,
                border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.1)',
                color: '#f87171', fontSize: 13, cursor: 'pointer',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.18)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(248,113,113,0.1)'}
              >
                <SignOutRegular fontSize={15} />
                {t('nav.logout')}
              </button>
            </Tooltip>
          ) : !isLogin ? (
            <button onClick={() => navigate('/login')} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 13px', borderRadius: 6,
              border: '1px solid rgba(71,158,245,0.3)', background: 'rgba(71,158,245,0.1)',
              color: '#479ef5', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(71,158,245,0.18)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(71,158,245,0.1)'}
            >
              <PersonRegular fontSize={15} />
              {t('nav.login')}
            </button>
          ) : null}
        </div>

        {/* Notifications Bell Dropdown */}
        {isLoggedIn && (
          <div ref={notifRef} style={{ position: 'relative', marginRight: 8 }}>
            <Tooltip content={isRu ? 'Уведомления' : 'Bildirishnomalar'} relationship="label">
              <button onClick={() => setIsNotifOpen(!isNotifOpen)} aria-label="Notifications"
                style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: isNotifOpen ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: activeNotifications.length > 0 ? '#fb7185' : 'rgba(255,255,255,0.6)',
                  cursor: 'pointer', flexShrink: 0,
                  position: 'relative',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = activeNotifications.length > 0 ? '#fda4af' : '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.background = isNotifOpen ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = activeNotifications.length > 0 ? '#fb7185' : 'rgba(255,255,255,0.6)' }}
              >
                <AlertRegular fontSize={18} style={{
                  animation: activeNotifications.length > 0 ? 'pulse 2s infinite' : 'none'
                }} />
                {activeNotifications.length > 0 && (
                  <span style={{
                    position: 'absolute', top: -3, right: -3,
                    background: '#e11d48', color: '#fff',
                    fontSize: 9.5, fontWeight: 700,
                    minWidth: 16, height: 16, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 4px', border: `2px solid ${NAV_BG}`,
                    boxShadow: '0 0 10px rgba(225,29,72,0.5)',
                  }}>
                    {activeNotifications.length}
                  </span>
                )}
              </button>
            </Tooltip>

            {isNotifOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 6,
                background: 'rgba(26, 34, 54, 0.95)', backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12, padding: '12px 0 8px 0', minWidth: 320, maxWidth: 360,
                boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
                zIndex: 9999, animation: 'fadeInNotif 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              }}>
                {/* Header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0 16px 10px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)',
                }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>
                    {isRu ? 'Уведомления' : 'Bildirishnomalar'}
                    {activeNotifications.length > 0 && (
                      <span style={{ marginLeft: 6, color: '#fb7185', fontSize: 12 }}>
                        ({activeNotifications.length})
                      </span>
                    )}
                  </span>
                  {activeNotifications.length > 0 && (
                    <button onClick={async () => {
                      // 1. Mark all system/camera alerts as read locally
                      const systemAlertIds = activeNotifications.filter(n => !n.appealId).map(n => n.id)
                      if (systemAlertIds.length > 0) {
                        const updated = [...dismissedAlerts, ...systemAlertIds]
                        setDismissedAlerts(updated)
                        localStorage.setItem('dismissedAlerts', JSON.stringify(updated))
                      }
                      // 2. Mark all appeals as read on backend
                      const hasAppeals = activeNotifications.some(n => n.appealId)
                      if (hasAppeals) {
                        try {
                          await fetch('/api/settings/contact-messages/read-all', { method: 'POST', credentials: 'include' })
                        } catch (e) {
                          console.error(e)
                        }
                      }
                      fetchNavbarStatus()
                    }} style={{
                      background: 'transparent', border: 'none', color: 'var(--accent)',
                      fontSize: 11.5, fontWeight: 600, cursor: 'pointer', padding: 0,
                    }}
                      onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                      onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                    >
                      {isRu ? 'Прочитать все' : 'Hammasini o\'qish'}
                    </button>
                  )}
                </div>

                {/* List */}
                <div style={{
                  maxHeight: 320, overflowY: 'auto', padding: '4px 0',
                }}>
                  {activeNotifications.length === 0 ? (
                    <div style={{
                      padding: '24px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.4)',
                      fontSize: 12.5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    }}>
                      <AlertRegular fontSize={24} style={{ opacity: 0.5 }} />
                      <div>{isRu ? 'Новых уведомлений нет' : 'Yangi bildirishnomalar mavjud emas'}</div>
                    </div>
                  ) : (
                    activeNotifications.map(notif => (
                      <div key={notif.id} 
                        onClick={() => {
                          if (notif.path) {
                            navigate(notif.path)
                            setIsNotifOpen(false)
                          }
                        }}
                        style={{
                          display: 'flex', gap: 10, padding: '10px 16px',
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                          cursor: notif.path ? 'pointer' : 'default',
                          transition: 'background 0.15s',
                          background: 'transparent',
                        }}
                        onMouseEnter={e => { if (notif.path) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                          {notif.icon}
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', lineHeight: 1.3 }}>
                            {isRu ? notif.titleRu : notif.titleUz}
                          </div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.3 }}>
                            {isRu ? notif.descRu : notif.descUz}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          {notif.isBotOffline ? (
                            <>
                              <button 
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    const res = await fetch('/api/telegram/process/start', { method: 'POST', credentials: 'include' })
                                    if (res.ok) {
                                      toast.success(isRu ? 'Telegram-бот успешно запущен' : 'Telegram bot muvaffaqiyatli ishga tushirildi')
                                      window.dispatchEvent(new CustomEvent('navbar-refresh'))
                                    } else {
                                      const errData = await res.json()
                                      toast.error(errData.detail || (isRu ? 'Ошибка при запуске' : 'Ishga tushirishda xatolik'))
                                    }
                                  } catch (err) {
                                    toast.error(err.message)
                                  }
                                }}
                                style={{
                                  background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
                                  color: '#34d399', borderRadius: 5, padding: '3px 8px',
                                  fontSize: 10.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.25)'; e.currentTarget.style.color = '#fff' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.15)'; e.currentTarget.style.color = '#34d399' }}
                              >
                                {isRu ? 'Запустить' : 'Tiklash'}
                              </button>
                              <button onClick={(e) => {
                                e.stopPropagation()
                                dismissAlert(notif.id)
                              }} style={{
                                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                                color: 'rgba(255,255,255,0.6)', borderRadius: 5, padding: '3px 8px',
                                fontSize: 10.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                              }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#fff' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
                              >
                                {isRu ? 'ОК' : 'O\'qildi'}
                              </button>
                            </>
                          ) : (
                            <button onClick={async (e) => {
                              e.stopPropagation() // Prevent navigation if clicking dismiss
                              if (notif.appealId) {
                                try {
                                  const res = await fetch(`/api/settings/contact-messages/${notif.appealId}/read`, { method: 'POST', credentials: 'include' })
                                  if (res.ok) fetchNavbarStatus()
                                } catch (err) {
                                  console.error(err)
                                }
                              } else {
                                dismissAlert(notif.id)
                              }
                            }} style={{
                              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                              color: 'rgba(255,255,255,0.6)', borderRadius: 5, padding: '3px 8px',
                              fontSize: 10.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                            }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#fff' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
                            >
                              {isRu ? 'ОК' : 'O\'qildi'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            
            <style>{`
              @keyframes fadeInNotif {
                from { opacity: 0; transform: translateY(-8px) scale(0.98); }
                to { opacity: 1; transform: translateY(0) scale(1); }
              }
              @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.08); }
                100% { transform: scale(1); }
              }
            `}</style>
          </div>
        )}

        {/* Animated Hamburger Button for Mobile */}
        <button
          className="hamburger-btn"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
          style={{
            display: 'none',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: 24,
            height: 18,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            boxSizing: 'border-box',
            marginLeft: 'auto',
            zIndex: 210,
          }}
        >
          <span style={{
            width: '100%',
            height: 2,
            background: '#fff',
            borderRadius: 2,
            transition: 'all 0.3s ease',
            transformOrigin: '1px',
            transform: menuOpen ? 'rotate(45deg) translate(2px, 2px)' : 'rotate(0)'
          }} />
          <span style={{
            width: '100%',
            height: 2,
            background: '#fff',
            borderRadius: 2,
            transition: 'all 0.3s ease',
            opacity: menuOpen ? 0 : 1,
            transform: menuOpen ? 'translateX(10px)' : 'translateX(0)'
          }} />
          <span style={{
            width: '100%',
            height: 2,
            background: '#fff',
            borderRadius: 2,
            transition: 'all 0.3s ease',
            transformOrigin: '1px',
            transform: menuOpen ? 'rotate(-45deg) translate(2px, -2px)' : 'rotate(0)'
          }} />
        </button>
      </header>

      {/* Mobile Navigation Drawer */}
      {menuOpen && (
        <div className="mobile-drawer" style={{
          position: 'absolute',
          top: 52,
          left: 0,
          right: 0,
          background: 'rgba(15, 23, 42, 0.96)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          zIndex: 199,
          maxHeight: 'calc(100vh - 52px)',
          overflowY: 'auto',
          animation: 'slideDown 0.3s ease-out',
        }}>
          {/* Navigation Links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {links.map(id => {
              if (id === 'settings' || id === 'users') return null;
              const active = location.pathname === LINK_PATHS[id] || location.pathname.startsWith(LINK_PATHS[id] + '/');
              return (
                <button key={id} onClick={() => { navigate(LINK_PATHS[id]); setMenuOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 8, border: 'none',
                    background: active ? 'var(--accent)' : 'transparent',
                    color: active ? '#fff' : 'rgba(255, 255, 255, 0.7)',
                    fontSize: 14, fontWeight: active ? 600 : 400,
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'background 0.2s',
                  }}
                >
                  {LINK_ICONS[id]}
                  {t(`nav.${id}`)}
                </button>
              );
            })}

            {/* Users group if logged in */}
            {isLoggedIn && (
              <div style={{ marginTop: 10 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: 'rgba(255, 255, 255, 0.35)',
                  textTransform: 'uppercase', letterSpacing: 0.8, padding: '0 14px 6px'
                }}>
                  {t('nav.users')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[
                    { id: 'usersAdmins', label: t('nav.usersAdmins'), icon: <ShieldRegular fontSize={14} />, path: '/users' },
                    { id: 'usersStaff', label: t('nav.usersStaff'), icon: <PeopleRegular fontSize={14} />, path: '/users/staff' },
                    { id: 'usersStudents', label: t('nav.usersStudents'), icon: <HatGraduationRegular fontSize={14} />, path: '/users/students' },
                  ].map(item => {
                    const active = location.pathname === item.path;
                    return (
                      <button key={item.id} onClick={() => { navigate(item.path); setMenuOpen(false); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 14px 8px 24px', borderRadius: 8, border: 'none',
                          background: active ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                          color: active ? '#fff' : 'rgba(255, 255, 255, 0.6)',
                          fontSize: 13.5, cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        {item.icon}
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Settings group if logged in */}
            {isLoggedIn && (
              <div style={{ marginTop: 10 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: 'rgba(255, 255, 255, 0.35)',
                  textTransform: 'uppercase', letterSpacing: 0.8, padding: '0 14px 6px'
                }}>
                  {t('nav.settings')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[
                    { id: 'settings', label: isRu ? 'Настройки' : 'Sozlamalar', icon: <SettingsRegular fontSize={14} />, path: '/settings' },
                    { id: 'messages', label: isRu ? 'Обращения' : 'Murojaatlar', icon: <MailRegular fontSize={14} />, path: '/settings/messages' },
                    { id: 'isup', label: 'ISUP Server', icon: <ServerRegular fontSize={14} />, path: '/settings/isup' },
                    { id: 'redis', label: 'Redis', icon: <DatabaseRegular fontSize={14} />, path: '/settings/redis' },
                    { id: 'api', label: 'API Helper', icon: <PlugConnectedRegular fontSize={14} />, path: '/settings/api' },
                  ].map(item => {
                    const active = location.pathname === item.path;
                    return (
                      <button key={item.id} onClick={() => { navigate(item.path); setMenuOpen(false); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 14px 8px 24px', borderRadius: 8, border: 'none',
                          background: active ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                          color: active ? '#fff' : 'rgba(255, 255, 255, 0.6)',
                          fontSize: 13.5, cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        {item.icon}
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />

          {/* Actions Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Theme and Language Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {/* Theme Toggle Button */}
              <button onClick={() => setTheme(isDark ? 'light' : 'dark')}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '10px', borderRadius: 8, background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)', color: '#fff', fontSize: 13.5, cursor: 'pointer',
                  marginRight: 10,
                }}
              >
                {isDark ? <WeatherSunnyRegular fontSize={16} /> : <WeatherMoonRegular fontSize={16} />}
                {isDark ? t('nav.themeLight') : t('nav.themeDark')}
              </button>

              {/* Language switch */}
              <div style={{
                display: 'flex', background: 'rgba(255, 255, 255, 0.07)', borderRadius: 8,
                padding: 3, border: '1px solid rgba(255, 255, 255, 0.1)',
              }}>
                {['uz', 'ru'].map(l => (
                  <button key={l} onClick={() => handleLangChange(l)} style={{
                    padding: '6px 14px', borderRadius: 6, border: 'none',
                    background: i18n.language === l ? 'var(--accent)' : 'transparent',
                    color: i18n.language === l ? '#fff' : 'rgba(255, 255, 255, 0.5)',
                    fontSize: 12, fontWeight: i18n.language === l ? 700 : 400,
                    cursor: 'pointer', textTransform: 'uppercase',
                  }}>{l}</button>
                ))}
              </div>
            </div>

            {/* Profile & Logout / Login */}
            {isLoggedIn ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={() => { navigate('/profile'); setMenuOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '10px', borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.15)',
                    background: 'rgba(255, 255, 255, 0.06)', color: '#fff', fontSize: 13.5, cursor: 'pointer',
                  }}
                >
                  <PersonRegular fontSize={16} />
                  {initials || (i18n.language === 'ru' ? 'Профиль' : 'Profil')}
                </button>

                <button onClick={() => { handleLogout(); setMenuOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '10px', borderRadius: 8, border: '1px solid rgba(248, 113, 113, 0.3)',
                    background: 'rgba(248, 113, 113, 0.1)', color: '#f87171', fontSize: 13.5, cursor: 'pointer',
                  }}
                >
                  <SignOutRegular fontSize={16} />
                  {t('nav.logout')}
                </button>
              </div>
            ) : (
              !isLogin && (
                <button onClick={() => { navigate('/login'); setMenuOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '10px', borderRadius: 8, border: '1px solid rgba(71, 158, 245, 0.3)',
                    background: 'rgba(71, 158, 245, 0.1)', color: '#479ef5', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <PersonRegular fontSize={16} />
                  {t('nav.login')}
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* Global CSS for Navigation Responsiveness */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @media (max-width: 900px) {
          .desktop-nav {
            display: none !important;
          }
          .desktop-actions {
            display: none !important;
          }
          .hamburger-btn {
            display: flex !important;
          }
        }
      `}</style>
    </>
  )
}
