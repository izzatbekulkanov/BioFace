import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Spinner } from '@fluentui/react-components'
import { MailRegular, PhoneRegular, LocationRegular, SendRegular, CheckmarkCircleRegular } from '@fluentui/react-icons'

function InputField({ label, type = 'text', value, onChange, placeholder }) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>{label}</label>
      <input
        type={type} value={value} onChange={onChange} placeholder={placeholder} required
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
  const { t } = useTranslation()
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [msg, setMsg]         = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [tf, setTf]           = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message: msg })
      })
      if (res.ok) {
        setSent(true)
        setName('')
        setEmail('')
        setMsg('')
      }
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  const CONTACTS = [
    { icon: <MailRegular fontSize={20} />,     labelKey: 'contact.email',   value: 'support@bioface.uz',       color: '#0078d4' },
    { icon: <PhoneRegular fontSize={20} />,    labelKey: 'contact.phone',   value: '+998 90 123 45 67',        color: '#038387' },
    { icon: <LocationRegular fontSize={20} />, labelKey: 'contact.address', value: t('contact.addressValue'),  color: '#6264a7' },
  ]

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', padding: '56px 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
      <div style={{ maxWidth: 880, width: '100%', display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 48 }}>

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
              { icon: <MailRegular fontSize={20} />,     labelKey: 'contact.email',   value: 'support@bioface.uz',      color: '#0078d4' },
              { icon: <PhoneRegular fontSize={20} />,    labelKey: 'contact.phone',   value: '+998 90 123 45 67',       color: '#038387' },
              { icon: <LocationRegular fontSize={20} />, labelKey: 'contact.address', value: t('contact.addressValue'), color: '#6264a7' },
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
              <InputField label={t('contact.email')} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" />
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
