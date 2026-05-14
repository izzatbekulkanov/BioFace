import { useNavigate, useLocation } from 'react-router-dom'
import { useTheme } from 'next-themes'
import { useTranslation } from 'react-i18next'
import { Tooltip } from '@fluentui/react-components'
import {
  MapRegular, InfoRegular, MailRegular, SignOutRegular, PersonRegular,
  GridRegular, CameraRegular, CodeRegular, WeatherSunnyRegular, WeatherMoonRegular,
  SettingsRegular, HistoryRegular, CalendarClockRegular, ServerRegular,
} from '@fluentui/react-icons'

const PUBLIC_LINKS  = ['map', 'about', 'contact']
const PRIVATE_LINKS = ['dashboard', 'devices', 'shifts', 'middlewareLogs', 'isupServer', 'settings']

const LINK_ICONS = {
  map:            <MapRegular  fontSize={17} />,
  about:          <InfoRegular fontSize={17} />,
  contact:        <MailRegular fontSize={17} />,
  dashboard:      <GridRegular fontSize={17} />,
  devices:        <CameraRegular fontSize={17} />,
  shifts:         <CalendarClockRegular fontSize={17} />,
  middlewareLogs: <HistoryRegular fontSize={17} />,
  isupServer:     <ServerRegular fontSize={17} />,
  settings:       <SettingsRegular fontSize={17} />,
}
const LINK_PATHS = {
  map: '/map', about: '/about', contact: '/contact', dashboard: '/dashboard',
  devices: '/devices', shifts: '/shifts', middlewareLogs: '/middleware-logs', isupServer: '/isup-server', settings: '/settings',
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

const NAV_BG = '#0f172a'

export default function Navbar({ isLoggedIn, onLogout, onLangChange }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { t, i18n } = useTranslation()
  const { resolvedTheme, setTheme } = useTheme()
  const isLogin = location.pathname === '/login'
  const isDark  = resolvedTheme === 'dark'

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
        <div style={{
          width: 28, height: 28, background: 'var(--accent)',
          borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0,
        }}>B</div>
        <span style={{ fontWeight: 700, fontSize: 16, color: '#fff', letterSpacing: -0.3 }}>
          BioFace
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
