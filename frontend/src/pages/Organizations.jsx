import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  BuildingRegular,
  AddRegular,
  ArrowSyncRegular,
  EditRegular,
  DeleteRegular,
  PeopleRegular,
  CameraRegular,
  PersonRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import Skeleton from '../components/Skeleton'
import { useConfirm } from '../components/ConfirmDialog'
import { useToast } from '../components/Toaster'

/**
 * Tashkilotlar boshqaruvi sahifasi (Organizations page).
 * 
 * Imkoniyatlar:
 *   • Barcha tashkilotlar ro'yxatini ko'rish va qidirish.
 *   • Tashkilot turiga ko'ra saralash (maktab, mahalla, korxona va h.k.).
 *   • Yangi tashkilot qo'shish modali.
 *   • Tashkilot ma'lumotlarini tahrirlash modali.
 *   • Tashkilotni o'chirish (o'chirishdan oldin tasdiqlash dialogi bilan).
 */

export default function Organizations() {
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const confirm = useConfirm()
  const toast = useToast()
  const navigate = useNavigate()

  const [orgs, setOrgs] = useState([])
  const [types, setTypes] = useState([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const aliveRef = useRef(true)

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setRefreshing(true)
    try {
      const [oRes, tRes] = await Promise.all([
        fetch('/api/organizations', { credentials: 'include' }),
        fetch(`/api/organizations/types?lang=${i18n.language}`, { credentials: 'include' }),
      ])

      if (!oRes.ok) {
        if (oRes.status === 401) throw new Error(isRu ? 'Не авторизован' : 'Avtorizatsiya talab qilinadi')
        throw new Error(`HTTP ${oRes.status}`)
      }

      const orgsData = await oRes.json()
      const typesData = tRes.ok ? await tRes.json() : []

      if (aliveRef.current) {
        setOrgs(Array.isArray(orgsData) ? orgsData : [])
        setTypes(Array.isArray(typesData) ? typesData : [])
        setError('')
      }
    } catch (e) {
      if (aliveRef.current) setError(e.message)
    } finally {
      if (aliveRef.current) {
        setInitialLoading(false)
        setRefreshing(false)
      }
    }
  }, [isRu, i18n.language])

  useEffect(() => {
    aliveRef.current = true
    load({ silent: true })
    return () => { aliveRef.current = false }
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orgs.filter(o => {
      if (typeFilter !== 'all' && o.organization_type !== typeFilter) return false
      if (!q) return true
      return o.name.toLowerCase().includes(q) || (o.organization_type_label || '').toLowerCase().includes(q)
    })
  }, [orgs, search, typeFilter])

  const showSkeleton = initialLoading && orgs.length === 0

  const handleOpenAdd = () => navigate('/organizations/new')

  const handleOpenEdit = (org) => navigate(`/organizations/${org.id}/edit`)

  const handleDelete = async (org) => {
    const ok = await confirm({
      title: isRu ? 'Удалить организацию?' : 'Tashkilotni o\'chirish?',
      message: isRu
        ? `Вы действительно хотите удалить организацию "${org.name}"? Это действие нельзя отменить, и связанные данные сотрудников и логов могут быть потеряны.`
        : `"${org.name}" tashkilotini o'chirib tashlamoqchimisiz? Bu amalni qaytarib bo'lmaydi va ushbu tashkilotga bog'liq barcha ma'lumotlar o'chib ketishi mumkin.`,
      confirmText: isRu ? 'Удалить' : 'O\'chirish',
      cancelText: isRu ? 'Отмена' : 'Bekor qilish',
      danger: true,
    })
    if (!ok) return

    try {
      const res = await fetch(`/api/organizations/${org.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      toast.success(isRu ? 'Организация удалена' : 'Tashkilot muvaffaqiyatli o\'chirildi')
      await load({ silent: true })
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={isRu ? '✦ Управление' : '✦ Boshqaruv'}
        title={isRu ? 'Организации' : 'Tashkilotlar'}
        sub={isRu ? 'Список и настройки всех организаций в системе' : 'Tizimdagi barcha tashkilotlar va ularning sozlamalari'}
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleOpenAdd}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', borderRadius: 8,
                background: 'var(--accent)', border: 'none',
                color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <AddRegular fontSize={16} /> {isRu ? 'Добавить' : 'Qo\'shish'}
            </button>
            <button
              onClick={() => load()}
              disabled={refreshing || initialLoading}
              style={refreshBtnStyle(refreshing || initialLoading)}
            >
              <ArrowSyncRegular fontSize={16} style={{ animation: (refreshing || initialLoading) ? 'spin 1s linear infinite' : 'none' }} />
              {isRu ? 'Обновить' : 'Yangilash'}
            </button>
          </div>
        }
      />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px 80px' }}>
        {error && <div style={errBannerStyle}>{error}</div>}

        <div style={cardStyle}>
          {/* Filtrlash paneli */}
          <div style={toolbarStyle}>
            <div>
              <h3 style={cardTitleStyle}>
                <BuildingRegular style={{ color: 'var(--accent)' }} />
                {isRu ? 'Список организаций' : 'Tashkilotlar ro\'yxati'}
              </h3>
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-4)' }}>
                {filtered.length} / {orgs.length} {isRu ? 'орг.' : 'tashkilot'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={isRu ? 'Поиск по названию' : 'Nomi bo\'yicha qidiruv'}
                style={{ minWidth: 240, ...inpStyle }}
              />
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={inpStyle}>
                <option value="all">{isRu ? 'Все типы' : 'Hamma turlari'}</option>
                {types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {showSkeleton ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: 5 }).map((_, i) => <Skeleton.Row key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={emptyStyle}>
              {isRu ? 'Ничего не найдено.' : 'Hech narsa topilmadi.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {[
                      isRu ? 'Организация' : 'Tashkilot',
                      isRu ? 'Тип' : 'Turi',
                      isRu ? 'Рабочее время' : 'Ish vaqti',
                      isRu ? 'Пользователи' : 'Foydalanuvchilar',
                      isRu ? 'Сотрудники' : 'Xodimlar',
                      isRu ? 'Устройства' : 'Kameralar',
                      isRu ? 'Статус подписки' : 'Obuna holati',
                      '',
                    ].map((h, i) => <th key={i} style={thStyle}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(o => (
                    <tr key={o.id}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={avatarFallback}><BuildingRegular fontSize={18} /></div>
                          <div>
                            <div>
                              <Link to={`/organizations/${o.id}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                                {o.name}
                              </Link>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 400 }}>ID: {o.id}</div>
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          display: 'inline-block', padding: '3px 8px', borderRadius: 4,
                          background: 'var(--surface-2)', border: '1px solid var(--border-2)',
                          fontSize: 12,
                        }}>
                          {o.organization_type_label || o.organization_type}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                          {o.default_start_time || '09:00'} - {o.default_end_time || '18:00'}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <div style={statsBadgeStyle}>
                          <PersonRegular fontSize={14} style={{ opacity: 0.7 }} />
                          <span>{o.users_count}</span>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <div style={statsBadgeStyle}>
                          <PeopleRegular fontSize={14} style={{ opacity: 0.7 }} />
                          <span>{o.employees_count}</span>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <div style={statsBadgeStyle}>
                          <CameraRegular fontSize={14} style={{ opacity: 0.7 }} />
                          <span>{o.devices_count}</span>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <StatusPill status={o.subscription_status} isRu={isRu} />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button onClick={() => handleOpenEdit(o)} style={smallBtn('subtle')} title={isRu ? 'Редактировать' : 'Tahrirlash'}>
                            <EditRegular fontSize={13} />
                          </button>
                          <button onClick={() => handleDelete(o)} style={smallBtn('danger')} title={isRu ? 'Удалить' : 'O\'chirish'}>
                            <DeleteRegular fontSize={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* End of main content */}
    </div>
  )
}


function StatusPill({ status, isRu }) {
  const normalized = (status || '').toLowerCase()
  const isActive = normalized === 'active'
  const isPending = normalized === 'pending'
  const isExpired = normalized === 'expired'

  let bg = 'rgba(100, 116, 139, 0.10)'
  let color = '#64748b'
  let text = status || '—'

  if (isActive) {
    bg = 'rgba(16,185,129,0.12)'
    color = '#10b981'
    text = isRu ? 'Активна' : 'Faol'
  } else if (isPending) {
    bg = 'rgba(251,191,36,0.12)'
    color = '#f59e0b'
    text = isRu ? 'Ожидание' : 'Kutilmoqda'
  } else if (isExpired) {
    bg = 'rgba(244,63,94,0.12)'
    color = '#f43f5e'
    text = isRu ? 'Истекла' : 'Muddati o\'tgan'
  }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 9px', borderRadius: 999,
      background: bg, color: color,
      fontSize: 11, fontWeight: 600,
      border: `1px solid ${color}33`,
    }}>{text}</span>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Stillar (Styles)
// ────────────────────────────────────────────────────────────────────────────

const refreshBtnStyle = (loading) => ({
  display: 'flex', alignItems: 'center', gap: 7,
  padding: '8px 16px', borderRadius: 8,
  background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)',
  color: '#fff', fontSize: 13, fontWeight: 600,
  cursor: loading ? 'not-allowed' : 'pointer',
  opacity: loading ? 0.6 : 1,
})

const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }
const cardTitleStyle = { fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }
const toolbarStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 14 }
const errBannerStyle = { marginBottom: 20, padding: 14, background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, border: '1px solid var(--red-bd)' }
const inpStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 7,
  border: '1px solid var(--border-2)', background: 'var(--bg)',
  color: 'var(--text-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
}
const tableStyle = { width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }
const thStyle = {
  textAlign: 'left', padding: '10px 12px', fontSize: 11,
  fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase',
  letterSpacing: 0.4, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
}
const tdStyle = { padding: '12px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
const emptyStyle = { padding: 24, textAlign: 'center', color: 'var(--text-4)', fontSize: 13, background: 'var(--bg)', borderRadius: 8, border: '1px dashed var(--border-2)' }
const avatarFallback = { width: 36, height: 36, borderRadius: '50%', background: 'var(--surface-2)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }

const statsBadgeStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '4px 8px', borderRadius: 6,
  background: 'var(--bg)', border: '1px solid var(--border-2)',
  fontSize: 12, fontWeight: 600, color: 'var(--text-2)',
}

function smallBtn(kind) {
  const map = {
    accent: { bg: 'var(--accent)', color: '#fff' },
    danger: { bg: '#f43f5e', color: '#fff' },
    subtle: { bg: 'var(--surface-2)', color: 'var(--text-1)', border: '1px solid var(--border-2)' },
  }
  const t = map[kind] || map.subtle
  return {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '6px 10px', borderRadius: 6,
    background: t.bg, color: t.color,
    border: t.border || 'none',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
  }
}
