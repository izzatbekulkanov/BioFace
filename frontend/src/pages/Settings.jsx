import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  SettingsRegular, PlugConnectedRegular, SaveRegular,
  ClockRegular, CameraRegular, LockClosedRegular,
  ArrowSyncRegular, ImageRegular, GlobeRegular, DeleteRegular, DismissRegular, MailRegular,
  InfoRegular
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import { useToast } from '../components/Toaster'

function ImageUploader({
  label,
  value,
  preview,
  fileRef,
  onChange,
  onClear,
  placeholderIcon: PlaceholderIcon,
  accept = "image/*",
  isRu = false,
  description = ""
}) {
  const [isDragOver, setIsDragOver] = useState(false)
  const activeImage = preview || value

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      const mockEvent = {
        target: {
          files: [file]
        }
      }
      if (fileRef.current) {
        const dataTransfer = new DataTransfer()
        dataTransfer.items.add(file)
        fileRef.current.files = dataTransfer.files
      }
      onChange(mockEvent)
    }
  }

  const handleFileSelect = (e) => {
    onChange(e)
  }

  const triggerUpload = () => {
    if (fileRef.current) {
      fileRef.current.click()
    }
  }

  const handleRemove = (e) => {
    e.stopPropagation()
    if (fileRef.current) {
      fileRef.current.value = ''
    }
    onClear()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase' }}>
        {label}
      </label>
      
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerUpload}
        style={{
          position: 'relative',
          padding: 16,
          border: isDragOver ? '2px dashed var(--accent)' : '2px dashed var(--border-2)',
          borderRadius: 12,
          background: isDragOver ? 'var(--accent-bg)' : 'var(--surface)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          cursor: 'pointer',
          transition: 'all 0.2s ease-in-out',
          height: 160,
          boxShadow: isDragOver ? '0 0 12px rgba(var(--accent-rgb), 0.15)' : 'none',
          overflow: 'hidden'
        }}
        className="pro-image-uploader"
      >
        <input
          type="file"
          ref={fileRef}
          accept={accept}
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />

        {activeImage ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <img
              src={activeImage}
              alt={label}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }}
            />
            
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'rgba(0, 0, 0, 0.4)',
                opacity: 0,
                transition: 'opacity 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                borderRadius: 8
              }}
              className="uploader-overlay"
            >
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); triggerUpload(); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 12px',
                  background: '#fff',
                  color: '#000',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <CameraRegular fontSize={14} />
                {isRu ? 'Изменить' : "O'zgartirish"}
              </button>
              <button
                type="button"
                onClick={handleRemove}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 12px',
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <DeleteRegular fontSize={14} />
                {isRu ? 'Удалить' : "O'chirish"}
              </button>
            </div>
            
            <button
              type="button"
              onClick={handleRemove}
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.9)',
                border: 'none',
                color: '#333',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                zIndex: 10
              }}
              title={isRu ? 'Удалить' : "O'chirish"}
            >
              <DismissRegular fontSize={14} />
            </button>
          </div>
        ) : (
          <>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
              {PlaceholderIcon && <PlaceholderIcon fontSize={22} />}
            </div>
            <div style={{ textAlign: 'center', fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: 'var(--accent)' }}>
                {isRu ? 'Загрузить файл' : 'Fayl yuklash'}
              </span>
              <span style={{ color: 'var(--text-3)' }}>
                {isRu ? ' или перетащите сюда' : ' yoki bu yerga torting'}
              </span>
            </div>
            {description && (
              <div style={{ fontSize: 11, color: 'var(--text-4)' }}>
                {description}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        .pro-image-uploader:hover .uploader-overlay {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  )
}

export default function Settings() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const isRu = i18n.language === 'ru'
  const toast = useToast()

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

  // Contact Info
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactAddressUz, setContactAddressUz] = useState('')
  const [contactAddressRu, setContactAddressRu] = useState('')
  const [emailFocused, setEmailFocused] = useState(false)
  const [phoneFocused, setPhoneFocused] = useState(false)

  const handlePhoneChange = (e) => {
    let val = e.target.value;
    let digits = val.replace(/\D/g, '');
    if (digits === '') {
      setContactPhone('');
      return;
    }
    if (digits === '9' || digits === '99' || digits === '998') {
      setContactPhone('+' + digits);
      return;
    }
    if (!digits.startsWith('998')) {
      digits = '998' + digits;
    }
    digits = digits.slice(0, 12);
    let formatted = '+998';
    if (digits.length > 3) formatted += ' ' + digits.slice(3, 5);
    if (digits.length > 5) formatted += ' ' + digits.slice(5, 8);
    if (digits.length > 8) formatted += ' ' + digits.slice(8, 10);
    if (digits.length > 10) formatted += ' ' + digits.slice(10, 12);
    setContactPhone(formatted);
  }

  const handlePhoneFocus = () => {
    setPhoneFocused(true);
    if (!contactPhone) {
      setContactPhone('+998 ');
    }
  }

  const handlePhoneBlur = () => {
    setPhoneFocused(false);
    if (contactPhone === '+998' || contactPhone === '+998 ' || contactPhone.trim() === '+998') {
      setContactPhone('');
    }
  }

  const DOMAINS = ['gmail.com', 'mail.ru', 'yandex.ru', 'outlook.com', 'yahoo.com', 'bioface.uz']
  const atIndex = contactEmail.indexOf('@')
  const showSuggestions = emailFocused && atIndex !== -1 && atIndex > 0
  const username = atIndex !== -1 ? contactEmail.slice(0, atIndex) : ''
  const typedDomain = atIndex !== -1 ? contactEmail.slice(atIndex + 1) : ''
  const suggestions = DOMAINS
    .filter(d => d.startsWith(typedDomain.toLowerCase()) && d !== typedDomain.toLowerCase())
    .map(d => `${username}@${d}`)

  // Files
  const logoFileRef = useRef(null)
  const faviconFileRef = useRef(null)



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

  // Archive
  const [archiving, setArchiving] = useState(false)
  const [archiveResult, setArchiveResult] = useState(null)
  const [archiveError, setArchiveError] = useState('')

  const handleArchive = async () => {
    setArchiving(true)
    setArchiveError('')
    setArchiveResult(null)
    try {
      const res = await fetch('/api/settings/archive', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.detail || (isRu ? 'Ошибка архивирования' : 'Arxivlashda xatolik'))
      }
      setArchiveResult(data.result)
    } catch (e) {
      setArchiveError(e.message)
    } finally {
      setArchiving(false)
    }
  }

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [setRes, botRes] = await Promise.all([
        fetch('/api/settings'),
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
        setContactEmail(data.contact_email || '')
        setContactPhone(data.contact_phone || '')
        setContactAddressUz(data.contact_address_uz || '')
        setContactAddressRu(data.contact_address_ru || '')

        setTgEnabled(!!data.telegram_enabled)
        setTgAdminId(data.telegram_admin_chat_id || '')
        if (!data.telegram_token_configured) setTgToken(data.telegram_bot_token || '')
        setTgUsersCount(data.telegram_users_count || 0)

        setGoogleEnabled(!!data.google_oauth_enabled)
        setGoogleClientId(data.google_client_id || '')
        setGoogleRedirectUri(data.google_redirect_uri || '')
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
        google_redirect_uri: googleRedirectUri,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        contact_address_uz: contactAddressUz,
        contact_address_ru: contactAddressRu
      }

      const setRes = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsPayload)
      })
      if (!setRes.ok) throw new Error('Sozlamalarni saqlashda xatolik')

      // Refresh to reflect changes
      toast.success(isRu ? 'Настройки сохранены' : 'Sozlamalar saqlandi')
      window.location.reload()
    } catch (e) {
      setError(e.message)
      toast.error(e.message)
      setSaving(false)
    }
  }

  const handleBotAction = async (action) => {
    setBotLoading(true)
    try {
      const res = await fetch(`/api/telegram/process/${action}`, { method: 'POST', credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.status) setBotProcess(data.status)
      const labels = {
        start: isRu ? 'Бот запущен' : 'Bot ishga tushirildi',
        stop: isRu ? 'Бот остановлен' : "Bot to'xtatildi",
        restart: isRu ? 'Бот перезапущен' : 'Bot qayta ishga tushirildi',
      }
      toast.success(labels[action] || (isRu ? 'Готово' : 'Bajarildi'))
      window.dispatchEvent(new CustomEvent('navbar-refresh'))
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBotLoading(false)
    }
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
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @media (max-width: 768px) {
          .settings-container {
            padding: 16px 16px 60px !important;
          }
          .settings-grid-2col {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
        }
        @media (max-width: 600px) {
          .settings-bot-actions {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
          }
          .settings-bot-actions div {
            margin-left: 0 !important;
            text-align: left !important;
          }
        }
      `}</style>

      <PageHero
        badge={`✦ ${isRu ? 'Настройки' : 'Sozlamalar'}`}
        title={isRu ? 'Настройки системы' : 'Tizim Sozlamalari'}
        sub={isRu ? 'Управление системой и интеграциями' : 'Tizim va integratsiyalarni boshqarish'}
        right={
          <button onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
            {saving ? <ArrowSyncRegular fontSize={16} style={{ animation: 'spin 1s linear infinite' }} /> : <SaveRegular fontSize={16} />}
            {saving ? (isRu ? 'Сохранение...' : 'Saqlanmoqda...') : (isRu ? 'Сохранить' : 'Saqlash')}
          </button>
        }
      />

      <div className="settings-container" style={{ maxWidth: 900, margin: '0 auto', padding: '24px 32px 80px' }}>
        
        {error && (
          <div style={{ marginBottom: 20, padding: 16, background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, border: '1px solid var(--red-bd)' }}>
            {error}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border)', marginBottom: 24, overflowX: 'auto' }}>
          {[
            { id: 'system', icon: <SettingsRegular />, label: isRu ? 'Система' : 'Tizim' },
            { id: 'integrations', icon: <PlugConnectedRegular />, label: isRu ? 'Интеграции' : 'Integratsiyalar' },
            { id: 'version', icon: <InfoRegular />, label: isRu ? 'Версия' : 'Versiya' },
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
              
              <div className="settings-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
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

              <div className="settings-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 12 }}>
                
                {/* Logo Upload */}
                <ImageUploader
                  label={isRu ? 'Логотип' : 'Logotip'}
                  value={logoUrl}
                  preview={logoPreview}
                  fileRef={logoFileRef}
                  onChange={(e) => handleFileChange(e, setLogoPreview)}
                  onClear={() => {
                    setLogoUrl('')
                    setLogoPreview('')
                  }}
                  placeholderIcon={ImageRegular}
                  accept="image/*"
                  isRu={isRu}
                  description={isRu ? 'PNG, JPG или SVG' : 'PNG, JPG yoki SVG'}
                />

                {/* Favicon Upload */}
                <ImageUploader
                  label="Favicon"
                  value={faviconUrl}
                  preview={faviconPreview}
                  fileRef={faviconFileRef}
                  onChange={(e) => handleFileChange(e, setFaviconPreview)}
                  onClear={() => {
                    setFaviconUrl('')
                    setFaviconPreview('')
                  }}
                  placeholderIcon={GlobeRegular}
                  accept=".ico,.png,.svg"
                  isRu={isRu}
                  description={isRu ? 'ICO, PNG или SVG' : 'ICO, PNG yoki SVG'}
                />
                
              </div>

            </div>

            {/* Contact Information Section */}
            <div style={{ borderTop: '1px solid var(--border-2)', marginTop: 28, paddingTop: 24 }}>
              <div className="settings-grid-2col" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <GlobeRegular /> {isRu ? 'Контактная информация' : 'Bog\'lanish ma\'lumotlari'}
                </h3>
                <button
                  type="button"
                  onClick={() => navigate('/settings/messages')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    borderRadius: 8,
                    background: 'var(--accent-bg)',
                    border: '1px solid var(--accent-bd)',
                    color: 'var(--accent-tx)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--accent-bg)'}
                >
                  <MailRegular fontSize={14} />
                  {isRu ? 'Просмотр обращений' : 'Murojaatlarni ko\'rish'}
                </button>
              </div>
              
              <div className="settings-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                <div style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Email</label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={e => setContactEmail(e.target.value)}
                    placeholder="support@bioface.uz"
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    style={{
                      width: '100%', padding: '10px 14px',
                      borderRadius: 8, border: `1px solid ${emailFocused ? 'var(--accent)' : 'var(--border-2)'}`,
                      background: 'var(--bg)', color: 'var(--text-1)', outline: 'none'
                    }}
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      right: 0,
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border-3)',
                      borderRadius: 8,
                      boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)',
                      zIndex: 100,
                      maxHeight: 180,
                      overflowY: 'auto',
                      padding: '4px 0',
                    }}>
                      {suggestions.map((sug, idx) => (
                        <div
                          key={idx}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setContactEmail(sug);
                            setEmailFocused(false);
                          }}
                          onTouchStart={(e) => {
                            e.preventDefault();
                            setContactEmail(sug);
                            setEmailFocused(false);
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-bg)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            color: 'var(--text-1)',
                            fontSize: 13,
                            textAlign: 'left',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          {sug}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{isRu ? 'Телефон' : 'Telefon raqam'}</label>
                  <input
                    type="text"
                    value={contactPhone}
                    onChange={handlePhoneChange}
                    onFocus={handlePhoneFocus}
                    onBlur={handlePhoneBlur}
                    placeholder="+998 90 123 45 67"
                    style={{
                      width: '100%', padding: '10px 14px',
                      borderRadius: 8, border: `1px solid ${phoneFocused ? 'var(--accent)' : 'var(--border-2)'}`,
                      background: 'var(--bg)', color: 'var(--text-1)', outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div className="settings-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{isRu ? 'Адрес (UZ)' : 'Manzil (UZ)'}</label>
                  <textarea
                    rows={3}
                    value={contactAddressUz}
                    onChange={e => setContactAddressUz(e.target.value)}
                    placeholder="Toshkent, O'zbekiston..."
                    style={{
                      width: '100%', padding: '10px 14px',
                      borderRadius: 8, border: '1px solid var(--border-2)',
                      background: 'var(--bg)', color: 'var(--text-1)', outline: 'none',
                      resize: 'vertical', fontFamily: 'inherit'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{isRu ? 'Адрес (RU)' : 'Manzil (RU)'}</label>
                  <textarea
                    rows={3}
                    value={contactAddressRu}
                    onChange={e => setContactAddressRu(e.target.value)}
                    placeholder="Ташкент, Узбекистан..."
                    style={{
                      width: '100%', padding: '10px 14px',
                      borderRadius: 8, border: '1px solid var(--border-2)',
                      background: 'var(--bg)', color: 'var(--text-1)', outline: 'none',
                      resize: 'vertical', fontFamily: 'inherit'
                    }}
                  />
                </div>
              </div>
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
                    <div className="settings-bot-actions" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
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

            {/* ============ DATABASE ARCHIVE CARD ============ */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden' }}>
              {/* Decorative gradient accent */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7)', borderRadius: '12px 12px 0 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 20 }}>&#128190;</span>
                    {t('archive.cardTitle')}
                  </h3>
                  <div style={{ fontSize: 12.5, color: 'var(--text-4)', maxWidth: 480 }}>{t('archive.cardSub')}</div>
                </div>
                <div style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-bd)', fontWeight: 600, flexShrink: 0 }}>
                  bioface_archive.db
                </div>
              </div>

              {/* Policy info box */}
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 15, color: '#fff' }}>&#9432;</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>{t('archive.policyTitle')}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6 }}>{t('archive.policyDesc')}</div>
                  </div>
                </div>
              </div>

              {/* Warning box */}
              <div style={{ background: 'var(--yellow-bg)', border: '1px solid var(--yellow-bd)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>&#9888;</span>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--yellow)', marginBottom: 2 }}>{t('archive.warningTitle')}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{t('archive.warningDesc')}</div>
                </div>
              </div>

              {/* Error */}
              {archiveError && (
                <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-bd)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: 'var(--red)', fontSize: 13 }}>
                  {archiveError}
                </div>
              )}

              {/* Success result card */}
              {archiveResult && (
                <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green-bd)', borderRadius: 10, padding: '18px 20px', marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>&#10004;</span> {t('archive.successTitle')}
                  </div>
                  {archiveResult.archived_count === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{t('archive.noRecords')}</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)' }}>{archiveResult.archived_count}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>{t('archive.successArchived', { count: '' }).replace(' ', '')}</div>
                      </div>
                      <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{archiveResult.reclaimed_space_kb ? (archiveResult.reclaimed_space_kb / 1024).toFixed(1) : '0'} MB</div>
                        <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>{isRu ? 'Освобождено' : 'Bo\'shadi'}</div>
                      </div>
                    </div>
                  )}
                  {(archiveResult.initial_size_mb || archiveResult.final_size_mb) && (
                    <div style={{ marginTop: 12, display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-3)' }}>
                      <span>{t('archive.currentSize')}: <strong>{archiveResult.initial_size_mb} MB</strong></span>
                      <span style={{ color: 'var(--text-4)' }}>→</span>
                      <span>{t('archive.afterSize')}: <strong>{archiveResult.final_size_mb} MB</strong></span>
                    </div>
                  )}
                </div>
              )}

              {/* Archive button */}
              <button
                id="settings-archive-btn"
                onClick={handleArchive}
                disabled={archiving}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '13px 24px',
                  background: archiving ? 'var(--surface-2)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: archiving ? 'var(--text-4)' : '#fff',
                  border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
                  cursor: archiving ? 'not-allowed' : 'pointer',
                  boxShadow: archiving ? 'none' : '0 4px 14px rgba(99,102,241,0.4)',
                  transition: 'all 0.2s',
                  width: '100%', justifyContent: 'center'
                }}
              >
                {archiving ? (
                  <>
                    <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    {t('archive.btnRunning')}
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 18 }}>&#128190;</span>
                    {t('archive.btnArchive')}
                  </>
                )}
              </button>
            </div>

          </div>
        )}

        {activeTab === 'version' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
              <InfoRegular /> {isRu ? 'О системе и Версия' : 'Tizim haqida va Versiya'}
            </h3>

            {/* Version Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 24 }}>
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
                <div style={{ fontSize: 12, color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 600 }}>{isRu ? 'Версия ПО' : 'Dastur versiyasi'}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)', marginTop: 6 }}>v2.5.4-stable</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{isRu ? 'Сборка: 2026-06-08' : 'Tuzilgan sana: 2026-06-08'}</div>
              </div>

              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
                <div style={{ fontSize: 12, color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 600 }}>{isRu ? 'Лицензия' : 'Litsenziya turi'}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981', marginTop: 8 }}>Enterprise License</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{isRu ? 'Срок действия: Неограничен' : 'Muddati: Cheksiz'}</div>
              </div>
            </div>

            {/* Live System Diagnostics */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 24, background: 'var(--bg)' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: 14, fontWeight: 700 }}>{isRu ? 'Диагностика служб' : 'Tizim xizmatlari diagnostikasi'}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { name: 'PostgreSQL Database', status: 'Connected', desc: isRu ? 'Хранилище данных пользователей и давомата' : 'Tizim foydalanuvchilari va davomat ma\'lumotlar ombori' },
                  { name: 'Redis Cache Memory', status: 'Active', desc: isRu ? 'Кэширование данных событий и сессий' : 'Faol hodisalar va sessiya kesh xizmati' },
                  { name: 'Telegram Notification Bot', status: botProcess.running ? 'Running' : 'Offline', desc: isRu ? 'Служба мгновенной отправки уведомлений' : 'Xodimlarni xabardor qilish telegram boti' },
                  { name: 'Hikvision ISUP Camera SDK Server', status: 'Connected', desc: isRu ? 'Шлюз прямого подключения камер Hikvision' : 'Hikvision kameralarini ulash SDK shlyuzi' },
                ].map((item, idx) => {
                  const isOk = item.status === 'Connected' || item.status === 'Active' || item.status === 'Running';
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: idx < 3 ? '1px solid var(--border-2)' : 'none', flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>{item.desc}</div>
                      </div>
                      <span style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: isOk ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                        color: isOk ? '#10b981' : '#ef4444'
                      }}>
                        {item.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tech Stack Details */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 24 }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: 14, fontWeight: 700 }}>{isRu ? 'Стек технологий' : 'Texnologiyalar steki'}</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-4)' }}>Backend Framework</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 2 }}>FastAPI v0.115 (Python)</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-4)' }}>Frontend Library</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 2 }}>React v19.2.6 (Vite)</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-4)' }}>UI Components</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 2 }}>Microsoft Fluent UI v9</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-4)' }}>Deployment Platform</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 2 }}>Linux Ubuntu Server</div>
                </div>
              </div>
            </div>

            {/* Version History (Release Notes) */}
            <div>
              <h4 style={{ margin: '0 0 16px 0', fontSize: 14, fontWeight: 700 }}>{isRu ? 'История обновлений' : 'Yangilanishlar tarixi'}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { ver: 'v2.5.4 (Текущая)', date: '2026-06-08', notesUz: 'Moliya bo\'limi moslashuvchan dizayni yangilandi, tugmalardagi matn ko\'rinishi yorug\' rejimda yaxshilandi, murojaatlar o\'qilishi va bildirishnomalarning darhol sinxronizatsiyasi joriy qilindi.', notesRu: 'Обновлен адаптивный дизайн раздела Финансы, улучшена видимость текста на кнопках в светлом режиме, внедрено автоматическое прочтение обращений и синхронизация уведомлений.' },
                  { ver: 'v2.4.8', date: '2026-06-05', notesUz: 'Ish haqi to\'lovlari, xodimlar KPI tizimi va kirim-chiqimlar moliya monitoringi modullari muvaffaqiyatli integratsiya qilindi.', notesRu: 'Интегрированы модули расчета заработной платы, KPI сотрудников и финансового мониторинга доходов и расходов.' },
                  { ver: 'v2.3.0', date: '2026-05-20', notesUz: 'Oflayn kameralar haqida bildirishnomalar, saytdagi xabarlarni o\'chirish va tizim sozlamalaridan keshni tozalash funksiyalari qo\'shildi.', notesRu: 'Добавлены уведомления об офлайн камерах, удаление обращений с сайта и очистка кэша базы данных.' },
                  { ver: 'v2.0.0', date: '2026-04-12', notesUz: 'Tizim dizayni Fluent UI uslubiga to\'liq moslashtirildi, yorug\' va to\'q rejimlar uchun maxsus HSL o\'zgaruvchilari joriy qilindi.', notesRu: 'Дизайн системы полностью переведен на компоненты Fluent UI, добавлены HSL переменные для светлой и темной тем.' },
                ].map((rel, idx) => (
                  <div key={idx} style={{ paddingLeft: 16, borderLeft: '2px solid var(--border-3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{rel.ver}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{rel.date}</span>
                    </div>
                    <p style={{ margin: '6px 0 0 0', fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.4 }}>
                      {isRu ? rel.notesRu : rel.notesUz}
                    </p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  )
}
