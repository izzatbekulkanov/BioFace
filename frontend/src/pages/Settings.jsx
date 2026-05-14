import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  SettingsRegular, ListRegular, PlugConnectedRegular, SaveRegular,
  ClockRegular, InfoRegular, CameraRegular, LockClosedRegular,
  CheckmarkCircleRegular, ArrowUpRegular, ArrowDownRegular, ArrowSyncRegular,
  PlayRegular, StopRegular
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'

export default function Settings() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const isRu = i18n.language === 'ru'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('system')

  // System
  const [appName, setAppName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [logoPreview, setLogoPreview] = useState('')
  const [faviconUrl, setFaviconUrl] = useState('')
  const [faviconPreview, setFaviconPreview] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('18:00')
  const [isupHost, setIsupHost] = useState('')
  const [webBaseUrl, setWebBaseUrl] = useState('')

  // Files
  const logoFileRef = useRef(null)
  const faviconFileRef = useRef(null)

  // Menus
  const [menus, setMenus] = useState([])

  // Integrations (Telegram)
  const [tgEnabled, setTgEnabled] = useState(false)
  const [tgAdminId, setTgAdminId] = useState('')
  const [tgToken, setTgToken] = useState('')
  const [tgUsersCount, setTgUsersCount] = useState(0)
  const [botProcess, setBotProcess] = useState({ running: false, pid: null, uptime: null })
  const [botLoading, setBotLoading] = useState(false)

  // Integrations (Google)
  const [googleEnabled, setGoogleEnabled] = useState(false)
  const [googleClientId, setGoogleClientId] = useState('')
  const [googleClientSecret, setGoogleClientSecret] = useState('')
  const [googleRedirectUri, setGoogleRedirectUri] = useState('')

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [setRes, menuRes, botRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/menu_settings'),
        fetch('/api/telegram/process').catch(() => null) // May fail if not configured
      ])

      if (setRes.status === 401) { navigate('/login'); return }

      if (setRes.ok) {
        const data = await setRes.json()
        setAppName(data.app_name || '')
        setLogoUrl(data.logo_url || '')
        setFaviconUrl(data.favicon_url || '')
        setStartTime(data.default_start_time || '09:00')
        setEndTime(data.default_end_time || '18:00')
        setIsupHost(data.isup_public_host || '')
        setWebBaseUrl(data.public_web_base_url || '')

        setTgEnabled(!!data.telegram_enabled)
        setTgAdminId(data.telegram_admin_chat_id || '')
        if (!data.telegram_token_configured) setTgToken(data.telegram_bot_token || '')
        setTgUsersCount(data.telegram_users_count || 0)

        setGoogleEnabled(!!data.google_oauth_enabled)
        setGoogleClientId(data.google_client_id || '')
        setGoogleRedirectUri(data.google_redirect_uri || '')
      }

      if (menuRes.ok) {
        const menuData = await menuRes.json()
        // Convert menuData.menus map and menuData.order array to ordered array
        if (menuData.menus && menuData.order) {
          const orderedMenus = menuData.order.map(key => ({
            key,
            ...menuData.menus[key]
          }))
          setMenus(orderedMenus)
        }
      }

      if (botRes && botRes.ok) {
        const botData = await botRes.json()
        if (botData.status) setBotProcess(botData.status)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [navigate])

  const handleFileChange = (e, setPreview) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setPreview(URL.createObjectURL(file))
    }
  }

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      let finalLogo = logoUrl
      let finalFavicon = faviconUrl

      if (logoFileRef.current && logoFileRef.current.files[0]) {
        const fd = new FormData()
        fd.append('file', logoFileRef.current.files[0])
        const res = await fetch('/api/settings/upload_logo', { method: 'POST', body: fd })
        const dat = await res.json()
        if (dat.ok) finalLogo = dat.url
      }
      if (faviconFileRef.current && faviconFileRef.current.files[0]) {
        const fd = new FormData()
        fd.append('file', faviconFileRef.current.files[0])
        const res = await fetch('/api/settings/upload_favicon', { method: 'POST', body: fd })
        const dat = await res.json()
        if (dat.ok) finalFavicon = dat.url
      }

      const settingsPayload = {
        app_name: appName,
        logo_url: finalLogo,
        favicon_url: finalFavicon,
        default_start_time: startTime,
        default_end_time: endTime,
        isup_public_host: isupHost,
        public_web_base_url: webBaseUrl,
        telegram_enabled: tgEnabled,
        telegram_admin_chat_id: tgAdminId,
        telegram_bot_token: tgToken,
        google_oauth_enabled: googleEnabled,
        google_client_id: googleClientId,
        google_client_secret: googleClientSecret,
        google_redirect_uri: googleRedirectUri
      }

      const setRes = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsPayload)
      })
      if (!setRes.ok) throw new Error('Sozlamalarni saqlashda xatolik')

      // Save menus
      const menusMap = {}
      const order = menus.map(m => m.key)
      menus.forEach(m => {
        menusMap[m.key] = { uz: m.uz, ru: m.ru, type: m.type, icon: m.icon, href: m.href }
      })

      const menuRes = await fetch('/api/menu_settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menus: menusMap, order })
      })
      if (!menuRes.ok) throw new Error('Menyu sozlamalarini saqlashda xatolik')

      // Refresh to reflect changes
      window.location.reload()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  const handleBotAction = async (action) => {
    setBotLoading(true)
    try {
      const res = await fetch(`/api/telegram/process/${action}`, { method: 'POST' })
      const data = await res.json()
      if (data.status) setBotProcess(data.status)
    } catch (e) {
      alert(e.message)
    } finally {
      setBotLoading(false)
    }
  }

  const moveMenu = (index, dir) => {
    if (dir === -1 && index === 0) return
    if (dir === 1 && index === menus.length - 1) return
    const newMenus = [...menus]
    const temp = newMenus[index]
    newMenus[index] = newMenus[index + dir]
    newMenus[index + dir] = temp
    setMenus(newMenus)
  }

  const handleMenuChange = (index, lang, value) => {
    const newMenus = [...menus]
    newMenus[index][lang] = value
    setMenus(newMenus)
  }

  if (loading) {
    return (
      <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
        <ArrowSyncRegular style={{ animation: 'spin 1s linear infinite', fontSize: 32, color: 'var(--accent)' }} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={`✦ ${isRu ? 'Настройки' : 'Sozlamalar'}`}
        title={isRu ? 'Настройки системы' : 'Tizim Sozlamalari'}
        sub={isRu ? 'Управление системой, меню и интеграциями' : 'Tizim, menyular va integratsiyalarni boshqarish'}
        right={
          <button onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
            {saving ? <ArrowSyncRegular fontSize={16} style={{ animation: 'spin 1s linear infinite' }} /> : <SaveRegular fontSize={16} />}
            {saving ? (isRu ? 'Сохранение...' : 'Saqlanmoqda...') : (isRu ? 'Сохранить' : 'Saqlash')}
          </button>
        }
      />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 32px 80px' }}>
        
        {error && (
          <div style={{ marginBottom: 20, padding: 16, background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, border: '1px solid var(--red-bd)' }}>
            {error}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
          {[
            { id: 'system', icon: <SettingsRegular />, label: isRu ? 'Система' : 'Tizim' },
            { id: 'menus', icon: <ListRegular />, label: isRu ? 'Меню' : 'Menyu' },
            { id: 'integrations', icon: <PlugConnectedRegular />, label: isRu ? 'Интеграции' : 'Integratsiyalar' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px', cursor: 'pointer',
                background: 'transparent', border: 'none', borderBottom: `2px solid ${activeTab === tab.id ? 'var(--accent)' : 'transparent'}`,
                color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-4)',
                fontWeight: activeTab === tab.id ? 600 : 500, fontSize: 14,
                transition: 'all 0.2s'
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB: SYSTEM */}
        {activeTab === 'system' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClockRegular /> {isRu ? 'Общие настройки' : 'Umumiy Sozlamalar'}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{isRu ? 'Название программы' : 'Dastur nomi'}</label>
                <input type="text" value={appName} onChange={e => setAppName(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--bg)', color: 'var(--text-1)', outline: 'none' }} />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{isRu ? 'Начало раб. дня' : 'Ish boslanish vaqti'}</label>
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--bg)', color: 'var(--text-1)', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{isRu ? 'Конец раб. дня' : 'Ish tugash vaqti'}</label>
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--bg)', color: 'var(--text-1)', outline: 'none' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>ISUP Public Host</label>
                <input type="text" value={isupHost} onChange={e => setIsupHost(e.target.value)} placeholder="10.10.1.10" style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--bg)', color: 'var(--text-1)', outline: 'none' }} />
                <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>{isRu ? 'Если оставить пустым, будет использоваться локальный IP.' : 'Bo\'sh qoldirsangiz avtomatik lokal IP olinadi.'}</div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Public Web Base URL</label>
                <input type="text" value={webBaseUrl} onChange={e => setWebBaseUrl(e.target.value)} placeholder="https://example.com" style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--bg)', color: 'var(--text-1)', outline: 'none' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 12 }}>
                
                {/* Logo Upload */}
                <div style={{ padding: 20, border: '1px dashed var(--border-2)', borderRadius: 12, background: 'var(--surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, transition: 'all 0.2s' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase' }}>{isRu ? 'Логотип' : 'Logotip'}</label>
                  <div style={{ width: 80, height: 80, borderRadius: 12, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <img src={logoPreview || logoUrl || '/static/images/default-logo.png'} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }} />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-bd)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
                    <CameraRegular fontSize={18} />
                    {isRu ? 'Выбрать фото' : 'Rasm tanlash'}
                    <input type="file" ref={logoFileRef} accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFileChange(e, setLogoPreview)} />
                  </label>
                </div>

                {/* Favicon Upload */}
                <div style={{ padding: 20, border: '1px dashed var(--border-2)', borderRadius: 12, background: 'var(--surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, transition: 'all 0.2s' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase' }}>Favicon</label>
                  <div style={{ width: 80, height: 80, borderRadius: 12, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <img src={faviconPreview || faviconUrl || '/favicon.ico'} style={{ width: 32, height: 32, objectFit: 'contain' }} />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--surface-2)', color: 'var(--text-1)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
                    <CameraRegular fontSize={18} />
                    {isRu ? 'Выбрать иконку' : 'Ikonka tanlash'}
                    <input type="file" ref={faviconFileRef} accept=".ico,.png" style={{ display: 'none' }} onChange={(e) => handleFileChange(e, setFaviconPreview)} />
                  </label>
                </div>
                
              </div>

            </div>
          </div>
        )}

        {/* TAB: MENUS */}
        {activeTab === 'menus' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
             <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ListRegular /> {isRu ? 'Редактор меню' : 'Menyu muharriri'}
            </h3>
            <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 24 }}>{isRu ? 'Измените порядок и названия меню на левой панели.' : 'Chap paneldagi menyu ketma-ketligini va nomlarini o\'zgartiring.'}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {menus.map((m, idx) => (
                <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: m.type === 'group' ? 'var(--accent-bg)' : 'var(--bg)', border: `1px solid ${m.type === 'group' ? 'var(--accent-bd)' : 'var(--border)'}`, borderRadius: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <button onClick={() => moveMenu(idx, -1)} disabled={idx === 0} style={{ padding: 4, background: 'transparent', border: 'none', cursor: idx === 0 ? 'not-allowed' : 'pointer', color: 'var(--text-4)' }}><ArrowUpRegular /></button>
                    <button onClick={() => moveMenu(idx, 1)} disabled={idx === menus.length - 1} style={{ padding: 4, background: 'transparent', border: 'none', cursor: idx === menus.length - 1 ? 'not-allowed' : 'pointer', color: 'var(--text-4)' }}><ArrowDownRegular /></button>
                  </div>
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 600, marginBottom: 4 }}>UZ</div>
                      <input type="text" value={m.uz} onChange={e => handleMenuChange(idx, 'uz', e.target.value)} style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--text-1)', fontSize: 13, outline: 'none' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 600, marginBottom: 4 }}>RU</div>
                      <input type="text" value={m.ru} onChange={e => handleMenuChange(idx, 'ru', e.target.value)} style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--text-1)', fontSize: 13, outline: 'none' }} />
                    </div>
                  </div>
                  <div style={{ width: 100, fontSize: 11, color: 'var(--text-4)', textAlign: 'right' }}>
                    {m.type === 'group' ? <b>{isRu ? 'ГРУППА' : 'GURUH'}</b> : m.key}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: INTEGRATIONS */}
        {activeTab === 'integrations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Telegram */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PlugConnectedRegular style={{ color: '#2563eb' }} /> Telegram Bot
                </h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{isRu ? 'Активен' : 'Faol'}</span>
                  <input type="checkbox" checked={tgEnabled} onChange={e => setTgEnabled(e.target.checked)} style={{ accentColor: 'var(--accent)', width: 18, height: 18 }} />
                </label>
              </div>

              {tgEnabled && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Bot Token</label>
                    <input type="password" value={tgToken} onChange={e => setTgToken(e.target.value)} placeholder="123456:ABC..." style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--bg)', color: 'var(--text-1)', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Admin Chat ID</label>
                    <input type="text" value={tgAdminId} onChange={e => setTgAdminId(e.target.value)} placeholder="-1001234..." style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--bg)', color: 'var(--text-1)', outline: 'none' }} />
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-2)', paddingTop: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{isRu ? 'Управление ботом' : 'Bot boshqaruvi'}</div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <button onClick={() => handleBotAction('start')} disabled={botProcess.running || botLoading} style={{ padding: '8px 16px', background: botProcess.running ? 'var(--surface-2)' : '#10b981', color: botProcess.running ? 'var(--text-4)' : '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: botProcess.running ? 'not-allowed' : 'pointer' }}>{isRu ? 'Запустить' : 'Ishga tushirish'}</button>
                      <button onClick={() => handleBotAction('stop')} disabled={!botProcess.running || botLoading} style={{ padding: '8px 16px', background: !botProcess.running ? 'var(--surface-2)' : '#f43f5e', color: !botProcess.running ? 'var(--text-4)' : '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: !botProcess.running ? 'not-allowed' : 'pointer' }}>{isRu ? 'Остановить' : 'To\'xtatish'}</button>
                      
                      <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-4)' }}>
                        {isRu ? 'Статус:' : 'Holati:'} <strong style={{ color: botProcess.running ? '#10b981' : '#f43f5e' }}>{botProcess.running ? (isRu ? 'Работает' : 'Ishlayapti') : (isRu ? 'Остановлен' : 'To\'xtagan')}</strong>
                        {botProcess.running && ` | PID: ${botProcess.pid}`}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Google OAuth */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <LockClosedRegular style={{ color: '#ea4335' }} /> Google OAuth
                </h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{isRu ? 'Активен' : 'Faol'}</span>
                  <input type="checkbox" checked={googleEnabled} onChange={e => setGoogleEnabled(e.target.checked)} style={{ accentColor: 'var(--accent)', width: 18, height: 18 }} />
                </label>
              </div>

              {googleEnabled && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Client ID</label>
                    <input type="text" value={googleClientId} onChange={e => setGoogleClientId(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--bg)', color: 'var(--text-1)', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Client Secret</label>
                    <input type="password" value={googleClientSecret} onChange={e => setGoogleClientSecret(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--bg)', color: 'var(--text-1)', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Redirect URI</label>
                    <input type="text" value={googleRedirectUri} onChange={e => setGoogleRedirectUri(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--bg)', color: 'var(--text-1)', outline: 'none' }} />
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  )
}
