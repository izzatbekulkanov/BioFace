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
import PsychologicalPortrait from './pages/PsychologicalPortrait'
import MiddlewareLogs from './pages/MiddlewareLogs'
import Shifts         from './pages/Shifts'
import Organizations  from './pages/Organizations'
import OrganizationDetail from './pages/OrganizationDetail'
import OrganizationForm from './pages/OrganizationForm'
import BranchDetail from './pages/BranchDetail'
import Profile          from './pages/Profile'
import ContactMessages  from './pages/ContactMessages'
import Salary           from './pages/Salary'
import SalaryDetail     from './pages/SalaryDetail'
import Kpi              from './pages/Kpi'
import Cashflow         from './pages/Cashflow'
import Accounts         from './pages/Accounts'
import Versions         from './pages/Versions'
import VersionForm      from './pages/VersionForm'
import VersionDetail    from './pages/VersionDetail'
import ErrorPage        from './pages/ErrorPage'
import { ConfirmProvider } from './components/ConfirmDialog'
import { ToastProvider } from './components/Toaster'
import Footer from './components/Footer'

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
    // Dashboard cache ni tozalaymiz — yangi foydalanuvchi eski datani ko'rmasin
    localStorage.removeItem('bf_dashboard_metrics')
    localStorage.removeItem('bf_dashboard_trend')
    localStorage.removeItem('bf_dashboard_events')
    setLoggedIn(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('bf_logged_in')
    // Dashboard cache ni tozalaymiz — keyingi foydalanuvchi eski datani ko'rmasin
    localStorage.removeItem('bf_dashboard_metrics')
    localStorage.removeItem('bf_dashboard_trend')
    localStorage.removeItem('bf_dashboard_events')
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
        <ToastProvider>
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
              <Route path="/settings"        element={isLoggedIn ? <Settings />     : <Navigate to="/login" replace />} />
              <Route path="/settings/messages" element={isLoggedIn ? <ContactMessages /> : <Navigate to="/login" replace />} />
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
              <Route path="/employees/:id/edit" element={isLoggedIn ? <EmployeeForm />               : <Navigate to="/login" replace />} />
              <Route path="/employees/:id"      element={isLoggedIn ? <EmployeeDetail />             : <Navigate to="/login" replace />} />
              <Route path="/attendance"      element={isLoggedIn ? <Attendance /> : <Navigate to="/login" replace />} />
              <Route path="/attendance/employees" element={isLoggedIn ? <AttendanceGroups /> : <Navigate to="/login" replace />} />
              <Route path="/psychology"      element={isLoggedIn ? <PsychologicalPortrait /> : <Navigate to="/login" replace />} />
              <Route path="/shifts"          element={isLoggedIn ? <Shifts />    : <Navigate to="/login" replace />} />
              <Route path="/organizations"        element={isLoggedIn ? <Organizations /> : <Navigate to="/login" replace />} />
              <Route path="/organizations/new"    element={isLoggedIn ? <OrganizationForm /> : <Navigate to="/login" replace />} />
              <Route path="/organizations/:id"    element={isLoggedIn ? <OrganizationDetail /> : <Navigate to="/login" replace />} />
              <Route path="/organizations/:id/branches/:branchId" element={isLoggedIn ? <BranchDetail /> : <Navigate to="/login" replace />} />
              <Route path="/organizations/:id/edit" element={isLoggedIn ? <OrganizationForm /> : <Navigate to="/login" replace />} />
              <Route path="/middleware-logs" element={isLoggedIn ? <MiddlewareLogs /> : <Navigate to="/login" replace />} />
              <Route path="/finance/salary"   element={isLoggedIn ? <Salary />   : <Navigate to="/login" replace />} />
              <Route path="/finance/salary/:id" element={isLoggedIn ? <SalaryDetail /> : <Navigate to="/login" replace />} />
              <Route path="/finance/kpi"      element={isLoggedIn ? <Kpi />      : <Navigate to="/login" replace />} />
              <Route path="/finance/cashflow" element={isLoggedIn ? <Cashflow /> : <Navigate to="/login" replace />} />
              <Route path="/finance/accounts" element={isLoggedIn ? <Accounts /> : <Navigate to="/login" replace />} />
              <Route path="/profile"         element={isLoggedIn ? <Profile />        : <Navigate to="/login" replace />} />
              <Route path="/settings/versions"          element={isLoggedIn ? <Versions />      : <Navigate to="/login" replace />} />
              <Route path="/settings/versions/new"      element={isLoggedIn ? <VersionForm />   : <Navigate to="/login" replace />} />
              <Route path="/settings/versions/:id"      element={isLoggedIn ? <VersionDetail /> : <Navigate to="/login" replace />} />
              <Route path="/settings/versions/:id/edit" element={isLoggedIn ? <VersionForm />   : <Navigate to="/login" replace />} />
              {/* ── Catch-all: 404 for any unknown path ── */}
              <Route path="*" element={<ErrorPage status={404} />} />
            </Routes>
          </main>
          <Footer isLoggedIn={isLoggedIn} />
        </div>
        </ToastProvider>
      </ConfirmProvider>
    </FluentSync>
  )
}
