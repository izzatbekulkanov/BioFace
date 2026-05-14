import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from 'next-themes'
import './i18n'           // i18next init — before anything else
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider
      attribute="data-theme"   // sets html[data-theme="dark|light"]
      defaultTheme="dark"
      storageKey="bf_theme"    // persists in localStorage as "bf_theme"
      enableSystem={false}     // don't auto-follow OS preference
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
