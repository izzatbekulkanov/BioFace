import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  PersonRegular,
  ClockRegular,
  ArrowSyncRegular,
  DismissRegular,
  ChatRegular,
  CheckmarkRegular,
  BuildingRegular
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import Skeleton from '../components/Skeleton'
import { useToast } from '../components/Toaster'

export default function Feedbacks() {
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const toast = useToast()

  const [feedbacks, setFeedbacks] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [selectedMsg, setSelectedMsg] = useState(null)
  const [search, setSearch] = useState('')

  const aliveRef = useRef(true)

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch('/api/feedbacks')
      if (!res.ok) {
        if (res.status === 401) throw new Error(isRu ? 'Не авторизован' : 'Avtorizatsiya talab qilinadi')
        throw new Error(isRu ? `Ошибка сервера (${res.status})` : `Server xatosi (${res.status})`)
      }
      const data = await res.json()
      if (aliveRef.current) {
        setFeedbacks(data)
        setError('')
        
        if (selectedMsg) {
          const current = data.find(m => m.uuid === selectedMsg.uuid)
          setSelectedMsg(current || null)
        }
      }
    } catch (e) {
      if (aliveRef.current) setError(e.message)
    } finally {
      if (aliveRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [isRu, selectedMsg])

  useEffect(() => {
    aliveRef.current = true
    load()
    return () => {
      aliveRef.current = false
    }
  }, [])

  const filtered = feedbacks.filter(m => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    const text = [
      m.employee_name,
      m.employee_personal_id,
      m.organization_name,
      m.title,
      m.message
    ].filter(Boolean).join(' ').toLowerCase()
    return text.includes(q)
  })

  const handleSelectMessage = async (msg) => {
    setSelectedMsg(msg)
    if (!msg.is_read) {
      try {
        const res = await fetch(`/api/feedbacks/${msg.uuid}/read`, {
          method: 'PUT'
        })
        if (res.ok) {
          setFeedbacks(prev => prev.map(m => m.uuid === msg.uuid ? { ...m, is_read: true } : m))
          setSelectedMsg(prev => prev && prev.uuid === msg.uuid ? { ...prev, is_read: true } : prev)
          window.dispatchEvent(new CustomEvent('navbar-refresh'))
        }
      } catch (err) {
        console.error('Error marking feedback as read:', err)
      }
    }
  }

  const formatTime = (isoString) => {
    if (!isoString) return ''
    try {
      const date = new Date(isoString)
      return date.toLocaleString(isRu ? 'ru-RU' : 'uz-UZ', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch (err) {
      return isoString
    }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .msg-layout {
          display: grid;
          grid-template-columns: 380px 1fr;
          gap: 24px;
          padding: 24px;
          flex: 1;
          max-width: 1400px;
          width: 100%;
          margin: 0 auto;
          box-sizing: border-box;
        }
        .msg-list-panel {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          height: 600px;
        }
        .msg-detail-panel {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 32px;
          overflow-y: auto;
          height: 600px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
        }
        .msg-item {
          padding: 16px;
          border-bottom: 1px solid var(--border-3);
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          gap: 8px;
          text-align: left;
        }
        .msg-item:hover {
          background: var(--surface-2);
        }
        .msg-item.active {
          background: var(--accent-bg);
          border-left: 4px solid var(--accent);
          padding-left: 12px;
        }
        .search-input {
          background: var(--input-bg);
          border: 1px solid var(--input-bd);
          border-radius: 8px;
          padding: 9px 12px;
          color: var(--text-1);
          font-size: 13.5px;
          width: 100%;
          outline: none;
          box-sizing: border-box;
        }
        .search-input:focus {
          border-color: var(--accent);
        }
        @media (max-width: 768px) {
          .msg-layout {
            grid-template-columns: 1fr;
            padding: 16px;
          }
          .msg-list-panel {
            height: calc(100vh - 200px);
            display: ${selectedMsg ? 'none' : 'flex'};
          }
          .msg-detail-panel {
            height: calc(100vh - 200px);
            display: ${selectedMsg ? 'flex' : 'none'};
            padding: 20px;
          }
        }
      `}</style>

      <PageHero
        badge={isRu ? '✦ Отзывы' : '✦ Fikrlar'}
        title={isRu ? 'Отзывы из мобильного приложения' : 'Mobil ilovadan fikr-mulohazalar'}
        description={isRu ? 'Список предложений, замечаний и отзывов от сотрудников организации.' : 'Xodimlardan kelgan takliflar, shikoyatlar va fikr-mulohazalar ro\'yxati.'}
      />

      {error && (
        <div style={{ padding: 12, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: 8, fontSize: 13, margin: '0 24px 16px' }}>
          {error}
        </div>
      )}

      <div className="msg-layout">
        {/* Left Side: List Panel */}
        <div className="msg-list-panel">
          <div style={{ padding: 16, borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                className="search-input"
                placeholder={isRu ? 'Поиск...' : 'Qidiruv...'}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer', display: 'flex'
                  }}
                >
                  <DismissRegular fontSize={14} />
                </button>
              )}
            </div>
            <button
              onClick={() => load({ silent: true })}
              disabled={refreshing}
              style={{
                background: 'var(--surface-2)', border: '1px solid var(--border-3)',
                borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-1)', cursor: refreshing ? 'not-allowed' : 'pointer'
              }}
            >
              <ArrowSyncRegular className={refreshing ? 'spin-anim' : ''} fontSize={16} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 24 }}>
                <Skeleton count={4} height={70} style={{ marginBottom: 12 }} />
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-4)' }}>
                {isRu ? 'Отзывы не найдены' : 'Fikr-mulohazalar topilmadi'}
              </div>
            ) : (
              filtered.map(item => (
                <div
                  key={item.uuid}
                  className={`msg-item ${selectedMsg?.uuid === item.uuid ? 'active' : ''}`}
                  onClick={() => handleSelectMessage(item)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 600, color: 'var(--white)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {!item.is_read && (
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', flexShrink: 0 }} />
                      )}
                      {item.title || (isRu ? 'Без темы' : 'Mavzusiz')}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-4)' }}>
                      {item.created_at ? new Date(item.created_at).toLocaleDateString(isRu ? 'ru' : 'uz') : ''}
                    </span>
                  </div>
                  
                  <p style={{
                    margin: 0, fontSize: 13, color: 'var(--text-2)',
                    overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.4
                  }}>
                    {item.message}
                  </p>

                  <div style={{ display: 'flex', gap: 12, fontSize: 11.5, color: 'var(--text-3)', marginTop: 4 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <PersonRegular fontSize={12} />
                      {item.employee_name || (isRu ? 'Анонимно' : 'Anonim')} 
                      {item.employee_personal_id && ` (${item.employee_personal_id})`}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Detail Panel */}
        <div className="msg-detail-panel">
          {selectedMsg ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', textAlign: 'left' }}>
              {/* Mobile Back Header */}
              <div style={{ display: 'none', marginBottom: 20 }} className="mobile-only-flex">
                <button
                  onClick={() => setSelectedMsg(null)}
                  style={{
                    background: 'var(--surface-2)', border: '1px solid var(--border-3)',
                    borderRadius: 8, padding: '6px 14px', color: 'var(--text-1)', fontSize: 13, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6
                  }}
                >
                  ← {isRu ? 'Назад к списку' : 'Ro\'yxatga qaytish'}
                </button>
              </div>

              {/* Header Info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-3)', paddingBottom: 20, marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px', color: 'var(--white)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ChatRegular fontSize={22} style={{ color: 'var(--accent)' }} /> {selectedMsg.title || (isRu ? 'Без темы' : 'Mavzusiz')}
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--text-2)' }}>
                      <PersonRegular fontSize={14} style={{ color: 'var(--text-4)' }} />
                      <span style={{ fontWeight: 600 }}>{selectedMsg.employee_name || (isRu ? 'Анонимный отправитель' : 'Anonim yuboruvchi')}</span>
                      {selectedMsg.employee_personal_id && <span style={{ color: 'var(--text-4)' }}>ID: {selectedMsg.employee_personal_id}</span>}
                    </div>
                    {selectedMsg.organization_name && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--text-2)' }}>
                        <BuildingRegular fontSize={14} style={{ color: 'var(--text-4)' }} />
                        <span>{selectedMsg.organization_name}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-4)' }}>
                    <ClockRegular fontSize={13} /> {formatTime(selectedMsg.created_at)}
                  </div>
                  {selectedMsg.is_read && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#10b981', fontSize: 12.5, fontWeight: 600 }}>
                      <CheckmarkRegular fontSize={14} /> {isRu ? 'Прочитано' : 'O\'qilgan'}
                    </span>
                  )}
                </div>
              </div>

              {/* Message text */}
              <div style={{ flex: 1, padding: 16, background: 'var(--surface-2)', borderRadius: 12, border: '1px solid var(--border-3)', minHeight: 200, overflowY: 'auto' }}>
                <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 8, fontWeight: 600, letterSpacing: 0.5 }}>
                  {isRu ? 'Текст отзыва' : 'Fikr matni'}
                </div>
                <div style={{ fontSize: 14.5, color: 'var(--text-1)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {selectedMsg.message}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-4)', gap: 16 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--border-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                💬
              </div>
              <div>
                {isRu ? 'Выберите отзыв для чтения' : 'Fikr-mulohazani o\'qish uchun ro\'yxatdan tanlang'}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .mobile-only-flex {
          display: none !important;
        }
        @media (max-width: 768px) {
          .mobile-only-flex {
            display: flex !important;
          }
        }
        .spin-anim {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
