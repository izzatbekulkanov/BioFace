import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Spinner } from '@fluentui/react-components'
import { MailRegular, PhoneRegular, LocationRegular, SendRegular, CheckmarkCircleRegular } from '@fluentui/react-icons'
import { useToast } from '../components/Toaster'

function InputField({ label, type = 'text', value, onChange, placeholder, required = true }) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>{label}</label>
      <input
        type={type} value={value} onChange={onChange} placeholder={placeholder} required={required}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width: '100%', padding: '10px 13px',
          background: 'var(--input-bg)',
          border: `1px solid ${focused ? 'var(--accent)' : 'var(--input-bd)'}`,
          borderRadius: 8, color: 'var(--text-1)', fontSize: 13.5,
          outline: 'none', boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

export default function Contact() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [phone, setPhone]     = useState('')
  const [msg, setMsg]         = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [tf, setTf]           = useState(false)

  const [emailFocused, setEmailFocused] = useState(false)
  const [phoneFocused, setPhoneFocused] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/public/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, email, phone, message: msg })
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setSent(true)
        setName('')
        setEmail('')
        setPhone('')
        setMsg('')
        toast.success(i18n.language === 'ru' ? 'Сообщение отправлено' : 'Xabar yuborildi')
      } else {
        toast.error(data.detail || (i18n.language === 'ru' ? 'Ошибка отправки' : 'Yuborishda xatolik'))
      }
    } catch (err) {
      console.error(err)
      toast.error(i18n.language === 'ru' ? 'Ошибка сети' : 'Tarmoqda xatolik')
    } finally {
      setLoading(false)
    }
  }

  const [contactInfo, setContactInfo] = useState({
    email: 'support@bioface.uz',
    phone: '+998 90 123 45 67',
    addressUz: '',
    addressRu: ''
  })

  useEffect(() => {
    fetch('/api/settings')
      .then(res => {
        if (res.ok) return res.json()
        throw new Error('Failed to load settings')
      })
      .then(data => {
        setContactInfo({
          email: data.contact_email || 'support@bioface.uz',
          phone: data.contact_phone || '+998 90 123 45 67',
          addressUz: data.contact_address_uz || '',
          addressRu: data.contact_address_ru || ''
        })
      })
      .catch(err => console.error("Error loading contact settings:", err))
  }, [])

  const displayEmail = contactInfo.email
  const displayPhone = contactInfo.phone
  const displayAddress = i18n.language === 'ru'
    ? (contactInfo.addressRu || t('contact.addressValue'))
    : (contactInfo.addressUz || t('contact.addressValue'))

  const handlePhoneChange = (e) => {
    let val = e.target.value;
    let digits = val.replace(/\D/g, '');
    
    if (digits === '') {
      setPhone('');
      return;
    }
    
    if (digits === '9' || digits === '99' || digits === '998') {
      setPhone('+' + digits);
      return;
    }
    
    if (!digits.startsWith('998')) {
      digits = '998' + digits;
    }
    
    digits = digits.slice(0, 12);
    
    let formatted = '+998';
    if (digits.length > 3) {
      formatted += ' ' + digits.slice(3, 5);
    }
    if (digits.length > 5) {
      formatted += ' ' + digits.slice(5, 8);
    }
    if (digits.length > 8) {
      formatted += ' ' + digits.slice(8, 10);
    }
    if (digits.length > 10) {
      formatted += ' ' + digits.slice(10, 12);
    }
    setPhone(formatted);
  }

  const handlePhoneFocus = () => {
    setPhoneFocused(true);
    if (!phone) {
      setPhone('+998 ');
    }
  }

  const handlePhoneBlur = () => {
    setPhoneFocused(false);
    if (phone === '+998' || phone === '+998 ' || phone.trim() === '+998') {
      setPhone('');
    }
  }

  const DOMAINS = ['gmail.com', 'mail.ru', 'yandex.ru', 'outlook.com', 'yahoo.com', 'bioface.uz']
  const atIndex = email.indexOf('@')
  const showSuggestions = emailFocused && atIndex !== -1 && atIndex > 0
  const username = atIndex !== -1 ? email.slice(0, atIndex) : ''
  const typedDomain = atIndex !== -1 ? email.slice(atIndex + 1) : ''
  const suggestions = DOMAINS
    .filter(d => d.startsWith(typedDomain.toLowerCase()) && d !== typedDomain.toLowerCase())
    .map(d => `${username}@${d}`)

  return (
    <div className="contact-wrapper" style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', padding: '56px 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
      <style>{`
        @media (max-width: 768px) {
          .contact-wrapper {
            padding: 24px 16px !important;
          }
          .contact-grid {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }
        }
      `}</style>
      <div className="contact-grid" style={{ maxWidth: 880, width: '100%', display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 48 }}>

        {/* Left info */}
        <div style={{ paddingTop: 4 }}>
          <div style={{ display: 'inline-block', background: 'var(--accent-bg)', border: '1px solid var(--accent-bd)', borderRadius: 100, padding: '4px 14px', marginBottom: 20, fontSize: 12, color: 'var(--accent-tx)' }}>
            ✦ {t('contact.heading')}
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.22, marginBottom: 14, color: 'var(--white)' }}>
            {t('contact.heroQuestion')}<br />
            <span style={{ color: 'var(--accent)' }}>{t('contact.heroAnswer')}</span>
          </h1>
          <p style={{ color: 'var(--text-4)', fontSize: 14, lineHeight: 1.7, marginBottom: 40 }}>{t('contact.sub')}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {[
              { icon: <MailRegular fontSize={20} />,     labelKey: 'contact.email',   value: displayEmail,      color: '#0078d4' },
              { icon: <PhoneRegular fontSize={20} />,    labelKey: 'contact.phone',   value: displayPhone,      color: '#038387' },
              { icon: <LocationRegular fontSize={20} />, labelKey: 'contact.address', value: displayAddress,    color: '#6264a7' },
            ].map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: c.color + '18', border: `1px solid ${c.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.color, flexShrink: 0 }}>
                  {c.icon}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.4 }}>{t(c.labelKey)}</div>
                  <div style={{ fontSize: 14, color: 'var(--text-1)', whiteSpace: 'pre-line' }}>{c.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right form */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '32px 28px' }}>
          {sent ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', gap: 14, padding: '40px 0' }}>
              <CheckmarkCircleRegular fontSize={52} color="#4ade80" />
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--white)' }}>{t('contact.sent')}</h2>
              <p style={{ color: 'var(--text-4)', fontSize: 13, lineHeight: 1.7 }}>{t('contact.sentSub')}</p>
              <button onClick={() => setSent(false)} style={{ marginTop: 6, padding: '9px 22px', background: 'var(--surface-2)', border: '1px solid var(--border-3)', borderRadius: 8, color: 'var(--text-1)', cursor: 'pointer', fontSize: 13 }}>
                {t('contact.again')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>{t('contact.formTitle')}</h2>
              <InputField label={t('contact.name')} value={name} onChange={e => setName(e.target.value)} placeholder="Ism Familya" />
              
              {/* Email Input with Suggestions */}
              <div style={{ position: 'relative' }}>
                <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>{t('contact.email')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  required
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  style={{
                    width: '100%', padding: '10px 13px',
                    background: 'var(--input-bg)',
                    border: `1px solid ${emailFocused ? 'var(--accent)' : 'var(--input-bd)'}`,
                    borderRadius: 8, color: 'var(--text-1)', fontSize: 13.5,
                    outline: 'none', boxSizing: 'border-box',
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
                          setEmail(sug);
                          setEmailFocused(false);
                        }}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          setEmail(sug);
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

              {/* Phone Input with +998 Mask */}
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>{t('contact.phone')}</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  onFocus={handlePhoneFocus}
                  onBlur={handlePhoneBlur}
                  placeholder="+998 90 123 45 67"
                  required
                  style={{
                    width: '100%', padding: '10px 13px',
                    background: 'var(--input-bg)',
                    border: `1px solid ${phoneFocused ? 'var(--accent)' : 'var(--input-bd)'}`,
                    borderRadius: 8, color: 'var(--text-1)', fontSize: 13.5,
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>{t('contact.message')}</label>
                <textarea
                  rows={5} value={msg} onChange={e => setMsg(e.target.value)} required
                  placeholder={t('contact.message') + '...'}
                  onFocus={() => setTf(true)} onBlur={() => setTf(false)}
                  style={{ width: '100%', padding: '10px 13px', background: 'var(--input-bg)', border: `1px solid ${tf ? 'var(--accent)' : 'var(--input-bd)'}`, borderRadius: 8, color: 'var(--text-1)', fontSize: 13.5, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
              <button type="submit" disabled={loading} style={{ padding: '11px', background: loading ? 'var(--accent-h)' : 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--accent-h)' }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'var(--accent)' }}
              >
                {loading ? <Spinner size="tiny" appearance="inverted" /> : <SendRegular fontSize={16} />}
                {loading ? t('contact.sending') : t('contact.send')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
// Force HMR refresh
