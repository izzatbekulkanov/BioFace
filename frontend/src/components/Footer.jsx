import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TagRegular } from '@fluentui/react-icons'

export default function Footer({ isLoggedIn }) {
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const navigate = useNavigate()
  const [latest, setLatest] = useState(null)

  useEffect(() => {
    fetch('/api/versions')
      .then(r => r.ok ? r.json() : null)
      .then(list => { if (list?.length) setLatest(list[0]) })
      .catch(() => {})
  }, [])

  return (
    <footer style={{
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
      padding: '16px 32px',
      color: 'var(--text-3)',
      fontSize: '13px',
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '16px',
      zIndex: 10,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ fontWeight: 600, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>BioFace</span>

          {/* Latest version badge — clickable */}
          {latest ? (
            <button
              onClick={() => navigate(`/settings/versions/${latest.id}`)}
              title={latest.title || `v${latest.version}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: '10px',
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#818cf8',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                padding: '2px 8px',
                borderRadius: '6px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all .15s',
                lineHeight: 1.5,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(99,102,241,.28)'
                e.currentTarget.style.borderColor = 'rgba(99,102,241,.5)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(99,102,241,.15)'
                e.currentTarget.style.borderColor = 'rgba(99,102,241,.3)'
              }}
            >
              <TagRegular fontSize={9} />
              v{latest.version}
            </button>
          ) : (
            <span style={{
              fontSize: '10px',
              background: 'rgba(139, 92, 246, 0.15)',
              color: '#8b5cf6',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              padding: '1px 6px',
              borderRadius: '4px',
              fontWeight: 'bold',
            }}>
              v1.0.0
            </span>
          )}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-4)' }}>
          {isRu
            ? 'Система умного распознавания лиц и контроля доступа'
            : 'Aqlli yuzni tanish va kirishni nazorat qilish tizimi'}
        </div>
      </div>

      <div style={{ fontSize: '12px', color: 'var(--text-4)' }}>
        &copy; {new Date().getFullYear()} BioFace.{' '}
        {isRu ? 'Все права защищены.' : 'Barcha huquqlar himoyalangan.'}
      </div>
    </footer>
  )
}
