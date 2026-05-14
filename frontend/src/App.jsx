import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useTheme, ThemeProvider as FluentThemeSync } from 'next-themes'
import { FluentProvider, webDarkTheme, webLightTheme } from '@fluentui/react-components'
import { useTranslation } from 'react-i18next'
import Navbar    from './components/Navbar'
import Login     from './pages/Login'
import About     from './pages/About'
import Contact   from './pages/Contact'
import MapView   from './pages/MapView'
import Dashboard    from './pages/Dashboard'
import Devices      from './pages/Devices'
import CameraDetail from './pages/CameraDetail'
import Commands       from './pages/Commands'
import Settings       from './pages/Settings'
import MiddlewareLogs from './pages/MiddlewareLogs'
import Shifts         from './pages/Shifts'
import { ConfirmProvider } from './components/ConfirmDialog'

function getIsLoggedIn() {
  return localStorage.getItem('bf_logged_in') === 'true'
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

  const handleLogin = () => {
    localStorage.setItem('bf_logged_in', 'true')
    setLoggedIn(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('bf_logged_in')
    setLoggedIn(false)
  }

  // Language switcher — changes i18next language and persists in localStorage
  const handleLangChange = (lang) => {
    i18n.changeLanguage(lang)
    localStorage.setItem('bf_lang', lang)
    document.cookie = `lang=${lang};path=/;max-age=31536000`
  }

  return (
    <FluentSync>
      <ConfirmProvider>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <Navbar
            isLoggedIn={isLoggedIn}
            onLogout={handleLogout}
            onLangChange={handleLangChange}
          />
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Routes>
              <Route path="/"          element={<Navigate to={isLoggedIn ? '/dashboard' : '/login'} replace />} />
              <Route path="/login"     element={<Login onLogin={handleLogin} />} />
              <Route path="/about"     element={<About />} />
              <Route path="/contact"   element={<Contact />} />
              <Route path="/map"       element={<MapView isLoggedIn={isLoggedIn} />} />
              <Route path="/dashboard"   element={isLoggedIn ? <Dashboard /> : <Navigate to="/login" replace />} />
              <Route path="/devices"     element={isLoggedIn ? <Devices />   : <Navigate to="/login" replace />} />
              <Route path="/devices/:id" element={isLoggedIn ? <CameraDetail /> : <Navigate to="/login" replace />} />
              <Route path="/commands"        element={isLoggedIn ? <Commands />  : <Navigate to="/login" replace />} />
              <Route path="/settings"        element={isLoggedIn ? <Settings />  : <Navigate to="/login" replace />} />
              <Route path="/shifts"          element={isLoggedIn ? <Shifts />    : <Navigate to="/login" replace />} />
              <Route path="/middleware-logs" element={isLoggedIn ? <MiddlewareLogs /> : <Navigate to="/login" replace />} />
            </Routes>
          </main>
        </div>
      </ConfirmProvider>
    </FluentSync>
  )
}
