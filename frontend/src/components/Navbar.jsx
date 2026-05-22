import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTheme } from 'next-themes'
import { useTranslation } from 'react-i18next'
import { Tooltip } from '@fluentui/react-components'
import {
  MapRegular, InfoRegular, MailRegular, SignOutRegular, PersonRegular,
  GridRegular, CameraRegular, CodeRegular, WeatherSunnyRegular, WeatherMoonRegular,
  SettingsRegular, HistoryRegular, CalendarClockRegular,
  ServerRegular, DatabaseRegular, PlugConnectedRegular, ChevronDownRegular,
  PeopleRegular, ShieldRegular, HatGraduationRegular,
  ClipboardTaskListLtrRegular, BrainCircuitRegular, BuildingRegular,
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
  const { resolvedTheme, setTheme } = useTheme()
  const isLogin = location.pathname === '/login'
  const isDark  = resolvedTheme === 'dark'

  const [logoUrl, setLogoUrl] = useState('')
  const [faviconUrl, setFaviconUrl] = useState('')
  const [appName, setAppName] = useState('BioFace')

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
    <header style={{
      height: 52,
      background: NAV_BG,
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      display: 'flex', alignItems: 'center',
      padding: '0 24px', gap: 4,
      position: 'sticky', top: 0, zIndex: 200,
    }}>
      {/* Logo */}
      <div onClick={() => navigate(isLoggedIn ? '/dashboard' : '/')}
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

      {/* Nav links */}
      <nav style={{ display: 'flex', gap: 2, flex: 1 }}>
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
    </header>
  )
}
