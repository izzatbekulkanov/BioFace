import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  PersonRegular,
  MailRegular,
  CallRegular,
  ClockRegular,
  DeleteRegular,
  ArrowSyncRegular,
  DismissRegular,
  ShieldRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import Skeleton from '../components/Skeleton'
import { useConfirm } from '../components/ConfirmDialog'
import { useToast } from '../components/Toaster'

export default function ContactMessages() {
  const { i18n, t } = useTranslation()
  const isRu = i18n.language === 'ru'
  const confirm = useConfirm()
  const toast = useToast()

  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [isForbidden, setIsForbidden] = useState(false)
  const [selectedMsg, setSelectedMsg] = useState(null)
  const [search, setSearch] = useState('')

  const aliveRef = useRef(true)

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch('/api/settings/contact-messages', { credentials: 'include' })
      if (!res.ok) {
        if (res.status === 401) throw new Error(isRu ? 'Не авторизован' : 'Avtorizatsiya talab qilinadi')
        if (res.status === 403) {
          if (aliveRef.current) {
            setIsForbidden(true)
            setLoading(false)
            setRefreshing(false)
          }
          return
        }
        throw new Error(isRu ? `Ошибка сервера (${res.status})` : `Server xatosi (${res.status})`)
      }
      const data = await res.json()
      if (aliveRef.current) {
        const msgs = data.messages || []
        setMessages(msgs)
        setError('')
        
        // If selectedMsg was deleted or we refreshed, keep it updated or clear
        if (selectedMsg) {
          const current = msgs.find(m => m.id === selectedMsg.id)
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

  const filtered = messages.filter(m => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    const text = [m.name, m.email, m.phone, m.message].filter(Boolean).join(' ').toLowerCase()
    return text.includes(q)
  })

  const handleDelete = async (msg, e) => {
    if (e) e.stopPropagation()
    const ok = await confirm({
      title: isRu ? 'Удалить сообщение?' : "Xabarni o'chirish?",
      message: isRu
        ? `Вы действительно хотите удалить сообщение от ${msg.name}?`
        : `Haqiqatan ham ${msg.name} yuborgan xabarni o'chirishni istaysizmi?`,
      confirmText: isRu ? 'Удалить' : "O'chirish",
      cancelText: isRu ? 'Отмена' : 'Bekor qilish',
      danger: true,
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/settings/contact-messages/${msg.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success(isRu ? 'Сообщение успешно удалено' : "Xabar muvaffaqiyatli o'chirildi")
      if (selectedMsg?.id === msg.id) {
        setSelectedMsg(null)
      }
      await load({ silent: true })
    } catch (e) {
      toast.error(e.message)
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

  if (isForbidden) {
    return (
      <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{
          textAlign: 'center', maxWidth: 440,
          background: 'var(--surface)', border: '1px solid var(--red-bd)',
          borderRadius: 20, padding: '48px 40px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.3)'
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'var(--red-bg)', border: '2px solid var(--red-bd)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px', fontSize: 32
          }}>
            <ShieldRegular fontSize={36} style={{ color: 'var(--red)' }} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            {isRu ? 'Доступ запрещён' : 'Ruxsat yo\u02bcq'}
          </div>
          <h2 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 800, color: 'var(--text-1)' }}>
            {isRu ? 'Недостаточно прав' : 'Kirish huquqi yo\u02bcq'}
          </h2>
          <p style={{ margin: '0 0 28px', fontSize: 14, color: 'var(--text-3)', lineHeight: 1.6 }}>
            {isRu
              ? 'У вас нет разрешения на просмотр этой страницы. Обратитесь к главному администратору.'
              : 'Bu sahifani ko\u02bcrishga ruxsatingiz yo\u02bcq. Iltimos, administratorga murojaat qiling.'}
          </p>
          <button
            onClick={() => window.history.back()}
            style={{
              padding: '10px 24px', borderRadius: 9,
              background: 'var(--accent)', border: 'none',
              color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer'
            }}
          >
            {isRu ? '← Назад' : '← Orqaga'}
          </button>
        </div>
      </div>
    )
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
            display: \${selectedMsg ? 'none' : 'flex'};
          }
          .msg-detail-panel {
            height: calc(100vh - 200px);
            display: \${selectedMsg ? 'flex' : 'none'};
            padding: 20px;
          }
        }
      `}</style>

      <PageHero
        badge={isRu ? '✦ Сообщения' : '✦ Murojaatlar'}
        title={isRu ? 'Обращения с сайта' : 'Saytdan kelgan xabarlar'}
        description={isRu ? 'Просмотр и управление обращениями обратной связи от посетителей сайта.' : 'Saytdagi bog\'lanish formasi orqali yuborilgan murojaatlar ro\'yxati.'}
      />

      <div className="msg-layout">
        {/* Messages List Panel */}
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
                {isRu ? 'Сообщений не найдено' : 'Xabarlar topilmadi'}
              </div>
            ) : (
              filtered.map(msg => (
                <div
                  key={msg.id}
                  className={`msg-item ${selectedMsg?.id === msg.id ? 'active' : ''}`}
                  onClick={() => setSelectedMsg(msg)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 600, color: 'var(--white)', fontSize: 14 }}>{msg.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-4)' }}>
                      {msg.created_at ? new Date(msg.created_at).toLocaleDateString(isRu ? 'ru' : 'uz') : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <MailRegular fontSize={12} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.email}</span>
                  </div>
                  <p style={{
                    margin: 0, fontSize: 13, color: 'var(--text-2)',
                    overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.4
                  }}>
                    {msg.message}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Message Detail Panel */}
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

              {/* Sender info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-3)', paddingBottom: 20, marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px', color: 'var(--white)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <PersonRegular fontSize={22} style={{ color: 'var(--accent)' }} /> {selectedMsg.name}
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--text-2)' }}>
                      <MailRegular fontSize={14} style={{ color: 'var(--text-4)' }} />
                      <a href={`mailto:${selectedMsg.email}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{selectedMsg.email}</a>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--text-2)' }}>
                      <CallRegular fontSize={14} style={{ color: 'var(--text-4)' }} />
                      <a href={`tel:${selectedMsg.phone.replace(/\s+/g, '')}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{selectedMsg.phone}</a>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-4)' }}>
                    <ClockRegular fontSize={13} /> {formatTime(selectedMsg.created_at)}
                  </div>
                  <button
                    onClick={(e) => handleDelete(selectedMsg, e)}
                    style={{
                      background: 'var(--red-bg)', border: '1px solid var(--red-bd)',
                      borderRadius: 8, color: 'var(--red)', padding: '7px 14px',
                      cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6
                    }}
                  >
                    <DeleteRegular fontSize={14} /> {isRu ? 'Удалить' : 'O\'chirish'}
                  </button>
                </div>
              </div>

              {/* Message text */}
              <div style={{ flex: 1, padding: 12, background: 'var(--surface-2)', borderRadius: 12, border: '1px solid var(--border-3)', minHeight: 200, overflowY: 'auto' }}>
                <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 8, fontWeight: 600, letterSpacing: 0.5 }}>
                  {isRu ? 'Сообщение' : 'Xabar matni'}
                </div>
                <div style={{ fontSize: 14.5, color: 'var(--text-1)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {selectedMsg.message}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-4)', gap: 16 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--border-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                ✉
              </div>
              <div>
                {isRu ? 'Выберите сообщение для чтения' : 'O\'qish uchun biror xabarni tanlang'}
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
