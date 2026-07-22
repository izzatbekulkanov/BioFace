import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  PersonRegular,
  ArrowSyncRegular,
  ShieldRegular,
  MailRegular,
  CallRegular,
  CheckmarkCircleRegular,
  ClockRegular,
  AddRegular,
  EditRegular,
  DeleteRegular,
  DismissRegular,
  CheckmarkRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import Skeleton from '../components/Skeleton'
import { useConfirm } from '../components/ConfirmDialog'
import { useToast } from '../components/Toaster'
import CustomSelect from '../components/CustomSelect'

/**
 * Tizim foydalanuvchilari sahifasi.
 *
 * Funksionali:
 *   • Aktiv foydalanuvchilar ro'yxati (qidiruv, rol bo'yicha filtr)
 *   • "Yangi qo'shish" — alohida sahifaga (/users/new) o'tadi
 *   • Tahrirlash — alohida sahifa (/users/:id/edit)
 *   • O'chirish — DELETE /api/users/{id}
 *   • Google orqali kelganlarni tasdiqlash navbati — GET /api/users/pending
 *     + tasdiqlash modali (rol + tashkilot) — POST /api/users/{id}/approve
 *
 * Skeleton loader dastlabki yuklanishda ishlaydi.
 */

const ROLES = [
  { value: 'SuperAdmin',      label_uz: 'Asosiy Administrator', label_ru: 'Главный администратор' },
  { value: 'MahallaAdmin',    label_uz: 'Mahalla Admini',       label_ru: 'Махаллинский админ' },
  { value: 'MaktabAdmin',     label_uz: 'Maktab Admini',        label_ru: 'Школьный админ' },
  { value: 'KollejAdmin',     label_uz: 'Kollej Admini',        label_ru: 'Колледжский админ' },
  { value: 'TashkilotAdmin',  label_uz: 'Tashkilot Admini',     label_ru: 'Админ организации' },
  { value: 'KorxonaAdmin',    label_uz: 'Korxona Admini',       label_ru: 'Админ предприятия' },
  { value: 'Kadr',            label_uz: 'Kadr bo\'limi',        label_ru: 'Кадровый специалист' },
  { value: 'Buxgalter',       label_uz: 'Buxgalter',            label_ru: 'Бухгалтер' },
  { value: 'Psixolog',        label_uz: 'Psixolog',             label_ru: 'Психолог' },
]

export default function SystemUsers() {
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()

  const [users, setUsers] = useState([])
  const [pending, setPending] = useState([])
  const [orgs, setOrgs] = useState([])

  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [isForbidden, setIsForbidden] = useState(false)

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  const [approving, setApproving] = useState(null)

  const aliveRef = useRef(true)

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setRefreshing(true)
    try {
      const [uRes, pRes, oRes] = await Promise.all([
        fetch('/api/users', { credentials: 'include' }),
        fetch('/api/users/pending', { credentials: 'include' }),
        fetch('/api/organizations', { credentials: 'include' }),
      ])
      if (!uRes.ok) {
        if (uRes.status === 401) throw new Error(isRu ? 'Не авторизован' : 'Avtorizatsiya talab qilinadi')
        if (uRes.status === 403) {
          if (aliveRef.current) { setIsForbidden(true); setInitialLoading(false); setRefreshing(false) }
          return
        }
        throw new Error(isRu ? `Server xatosi (${uRes.status})` : `Server xatosi (${uRes.status})`)
      }
      const usersData = await uRes.json()
      const pendingData = pRes.ok ? await pRes.json() : { users: [] }
      const orgsData = oRes.ok ? await oRes.json() : []
      if (aliveRef.current) {
        setUsers(Array.isArray(usersData) ? usersData : [])
        setPending(Array.isArray(pendingData?.users) ? pendingData.users : [])
        setOrgs(Array.isArray(orgsData) ? orgsData : (orgsData?.items || []))
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
  }, [isRu])

  useEffect(() => {
    aliveRef.current = true
    load({ silent: true })
    return () => { aliveRef.current = false }
  }, [load])

  const allRoles = useMemo(
    () => Array.from(new Set(users.map(u => u.role).filter(Boolean))).sort(),
    [users],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter(u => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (!q) return true
      const haystack = [
        u.name, u.first_name, u.last_name, u.middle_name,
        u.email, u.phone, u.organization_name,
        ...(u.organization_names || []),
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [users, search, roleFilter])

  const showSkeleton = initialLoading && users.length === 0

  const onDelete = async (user) => {
    const ok = await confirm({
      title: isRu ? 'Удалить пользователя?' : "Foydalanuvchini o'chirish?",
      message: isRu
        ? `Вы хотите удалить пользователя ${user.name || user.email}? Это действие нельзя отменить.`
        : `${user.name || user.email} foydalanuvchini o'chirib tashlamoqchimisiz? Bu amalni qaytarib bo'lmaydi.`,
      confirmText: isRu ? 'Удалить' : "O'chirish",
      cancelText: isRu ? 'Отмена' : 'Bekor qilish',
      danger: true,
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success(isRu ? 'Пользователь удалён' : "Foydalanuvchi o'chirildi")
      await load({ silent: true })
    } catch (e) {
      toast.error(e.message)
    }
  }

  // 403 — Ruxsat yo'q sahifasi
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
              : 'Bu sahifani ko\u02bcrishga ruxsatingiz yo\u02bcq. Iltimos, asosiy administratorga murojaat qiling.'}
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
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={isRu ? '✦ Пользователи' : '✦ Foydalanuvchilar'}
        title={isRu ? 'Системные пользователи' : 'Tizim foydalanuvchilari'}
        sub={isRu ? 'Администраторы, роли и подтверждение' : 'Adminlar, rollar va tasdiqlash'}
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => navigate('/users/new')}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', borderRadius: 8,
                background: 'var(--accent)', border: 'none',
                color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <AddRegular fontSize={16} /> {isRu ? 'Добавить' : "Qo'shish"}
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

        {/* Pending approvals */}
        {pending.length > 0 && (
          <div style={{
            ...cardStyle,
            marginBottom: 20,
            border: '1px solid var(--yellow-bd)',
            background: 'var(--yellow-bg)',
          }}>
            <div style={{ ...toolbarStyle, marginBottom: 12 }}>
              <div>
                <h3 style={{ ...cardTitleStyle, color: 'var(--yellow)' }}>
                  <ClockRegular />
                  {isRu ? 'Ожидают подтверждения' : 'Tasdiqlash kutilmoqda'}
                </h3>
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-3)' }}>
                  {isRu
                    ? `${pending.length} вход(ов) через Google требует одобрения`
                    : `Google orqali kirgan ${pending.length} ta foydalanuvchi rol kutmoqda`}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pending.map(u => (
                <div key={u.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px', borderRadius: 8,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                }}>
                  {u.image_url
                    ? <img src={u.image_url} alt="" style={avatarImg} onError={e => { e.target.style.display = 'none' }} />
                    : <div style={avatarFallback}><PersonRegular fontSize={18} /></div>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-4)' }}>
                      {u.email} · {isRu ? 'через Google' : 'Google orqali'}
                    </div>
                  </div>
                  <button
                    onClick={() => setApproving(u)}
                    style={smallBtn('accent')}
                  >
                    <CheckmarkRegular fontSize={13} />
                    {isRu ? 'Подтвердить' : 'Tasdiqlash'}
                  </button>
                  <button
                    onClick={() => onDelete(u)}
                    style={smallBtn('danger')}
                    title={isRu ? 'Отклонить' : 'Rad etish'}
                  >
                    <DismissRegular fontSize={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={cardStyle}>
          <div style={toolbarStyle}>
            <div>
              <h3 style={cardTitleStyle}>
                <ShieldRegular style={{ color: '#3b82f6' }} />
                {isRu ? 'Список администраторов' : "Administratorlar ro'yxati"}
              </h3>
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-4)' }}>
                {filtered.length} / {users.length} {isRu ? 'польз.' : 'foydalanuvchi'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={isRu ? 'Поиск по имени или email' : "Ism yoki email bo'yicha qidiruv"}
                style={{ minWidth: 240, ...inpStyle }}
              />
              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={inpStyle}>
                <option value="all">{isRu ? 'Все роли' : 'Hamma rollar'}</option>
                {allRoles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          {showSkeleton ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: 5 }).map((_, i) => <Skeleton.Row key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={emptyStyle}>
              {isRu ? 'Ничего не найдено.' : "Hech narsa topilmadi."}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {[
                      isRu ? 'Пользователь' : 'Foydalanuvchi',
                      isRu ? 'Контакты' : 'Aloqa',
                      isRu ? 'Роль' : 'Rol',
                      isRu ? 'Организации' : 'Tashkilotlar',
                      isRu ? 'Статус' : 'Holat',
                      '',
                    ].map((h, i) => <th key={i} style={thStyle}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => (
                    <tr key={u.id}>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {u.image_url
                            ? <img src={u.image_url} alt="" style={avatarImg} onError={e => { e.target.style.display = 'none' }} />
                            : <div style={avatarFallback}><PersonRegular fontSize={18} /></div>}
                          <div>
                            <div style={{ fontWeight: 600 }}>{u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || `#${u.id}`}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-4)' }}>ID: {u.id}</div>
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        {u.email && <div style={lineStyle}><MailRegular fontSize={12} />{u.email}</div>}
                        {u.phone && <div style={lineStyle}><CallRegular fontSize={12} />{u.phone}</div>}
                      </td>
                      <td style={tdStyle}>
                        <RolePill role={u.role} />
                      </td>
                      <td style={tdStyle}>
                        {(u.organization_names && u.organization_names.length > 0)
                          ? u.organization_names.join(', ')
                          : (u.organization_name || <span style={{ color: 'var(--text-4)' }}>—</span>)}
                      </td>
                      <td style={tdStyle}>
                        <StatusPill status={u.status} isRu={isRu} />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button onClick={() => navigate(`/users/${u.id}/edit`)} style={smallBtn('subtle')} title={isRu ? 'Редактировать' : 'Tahrirlash'}>
                            <EditRegular fontSize={13} />
                          </button>
                          <button onClick={() => onDelete(u)} style={smallBtn('danger')} title={isRu ? 'Удалить' : "O'chirish"}>
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

      {approving && (
        <ApproveModal
          user={approving}
          orgs={orgs}
          onClose={() => setApproving(null)}
          onSaved={async () => {
            setApproving(null)
            toast.success(isRu ? 'Пользователь подтверждён' : 'Foydalanuvchi tasdiqlandi')
            await load({ silent: true })
          }}
          isRu={isRu}
        />
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Approve modal (Google orqali kelgan foydalanuvchini tasdiqlash)
// ────────────────────────────────────────────────────────────────────────────

function ApproveModal({ user, orgs, onClose, onSaved, isRu }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [role, setRole] = useState('TashkilotAdmin')
  const [orgIds, setOrgIds] = useState([])

  const toggleOrg = (id) => {
    const sid = String(id)
    setOrgIds(prev => prev.includes(sid) ? prev.filter(x => x !== sid) : [...prev, sid])
  }

  const onSubmit = async (e) => {
    e?.preventDefault?.()
    if (orgIds.length === 0) {
      setError(isRu ? 'Выберите минимум одну организацию' : "Kamida bitta tashkilot tanlang")
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/users/${user.id}/approve`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          organization_ids: orgIds.map(Number),
          organization_id: Number(orgIds[0]),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const detail = data?.detail || data?.message || `HTTP ${res.status}`
        throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
      }
      onSaved?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={isRu ? 'Подтверждение пользователя' : 'Foydalanuvchini tasdiqlash'} onClose={onClose}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: 12,
        background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)',
        marginBottom: 14,
      }}>
        {user.image_url
          ? <img src={user.image_url} alt="" style={avatarImg} onError={e => { e.target.style.display = 'none' }} />
          : <div style={avatarFallback}><PersonRegular fontSize={18} /></div>}
        <div>
          <div style={{ fontWeight: 600 }}>{user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email}</div>
          <div style={{ fontSize: 12, color: 'var(--text-4)' }}>{user.email}</div>
        </div>
      </div>

      <form onSubmit={onSubmit}>
        <Field label={isRu ? 'Роль' : 'Rol'} required>
          <CustomSelect
            value={role}
            onChange={(val) => setRole(val)}
            options={ROLES.map(r => ({ value: r.value, label: isRu ? r.label_ru : r.label_uz }))}
            placeholder={isRu ? '— Rol tanlang —' : '— Rol tanlang —'}
          />
        </Field>

        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
            {isRu ? 'Организации' : 'Tashkilotlar'} <span style={{ color: '#f43f5e' }}>*</span>
          </div>
          {orgs.length === 0 ? (
            <div style={{ color: 'var(--text-4)', fontSize: 12 }}>
              {isRu ? 'Сначала создайте организацию' : "Avval tashkilot yarating"}
            </div>
          ) : (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 6, maxHeight: 200, overflowY: 'auto',
              padding: 8, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)',
            }}>
              {orgs.map(o => {
                const checked = orgIds.includes(String(o.id))
                return (
                  <label key={o.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', borderRadius: 6,
                    background: checked ? 'var(--accent-bg)' : 'transparent',
                    border: `1px solid ${checked ? 'var(--accent-bd)' : 'var(--border-2)'}`,
                    cursor: 'pointer', fontSize: 13,
                  }}>
                    <input type="checkbox" checked={checked} onChange={() => toggleOrg(o.id)} style={{ accentColor: 'var(--accent)' }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</span>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        {error && (
          <div style={{ marginTop: 14, padding: 10, background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, border: '1px solid var(--red-bd)', fontSize: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <button type="button" onClick={onClose} disabled={saving} style={smallBtn('subtle')}>
            {isRu ? 'Отмена' : 'Bekor qilish'}
          </button>
          <button type="submit" disabled={saving} style={smallBtn('accent')}>
            {saving
              ? <ArrowSyncRegular fontSize={14} style={{ animation: 'spin 1s linear infinite' }} />
              : <CheckmarkRegular fontSize={14} />}
            {saving ? (isRu ? 'Сохранение...' : 'Saqlanmoqda...') : (isRu ? 'Подтвердить' : 'Tasdiqlash')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Reusable bits
// ────────────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 640,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, padding: 24, maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h3>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>
            <DismissRegular fontSize={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, hint, required, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}{required && <span style={{ color: '#f43f5e' }}> *</span>}
      </span>
      {children}
      {hint && <span style={{ fontSize: 10, color: 'var(--text-4)' }}>{hint}</span>}
    </label>
  )
}

function RolePill({ role }) {
  if (!role) return <span style={{ color: 'var(--text-4)' }}>—</span>
  const rawRoleStr = String(role || '').toLowerCase().replace(/_/g, '')
  const foundRole = ROLES.find(r => r.value.toLowerCase().replace(/_/g, '') === rawRoleStr)
  const roleKey = foundRole ? foundRole.value : role
  const displayLabel = foundRole ? foundRole.label_uz : role

  const colorMap = {
    SuperAdmin: '#a855f7',
    MahallaAdmin: '#3b82f6',
    MaktabAdmin: '#22c55e',
    KollejAdmin: '#06b6d4',
    TashkilotAdmin: '#f59e0b',
    KorxonaAdmin: '#ec4899',
    Kadr: '#14b8a6',
    Buxgalter: '#f97316',
    Psixolog: '#8b5cf6',
  }
  const color = colorMap[roleKey] || '#64748b'
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 999,
      fontSize: 11, fontWeight: 600,
      background: color + '22', color, border: `1px solid ${color}55`,
    }}>{displayLabel}</span>
  )
}

function StatusPill({ status, isRu }) {
  const isActive = (status || '').toLowerCase() === 'active'
  const isPending = (status || '').toLowerCase() === 'pending'
  const tone = isActive
    ? { bg: 'rgba(16,185,129,0.12)', color: '#10b981', icon: <CheckmarkCircleRegular fontSize={12} />, text: isRu ? 'Активен' : 'Faol' }
    : isPending
    ? { bg: 'rgba(251,191,36,0.12)', color: '#f59e0b', icon: <ClockRegular fontSize={12} />, text: isRu ? 'Ожидает' : 'Kutilmoqda' }
    : { bg: 'rgba(244,63,94,0.10)', color: '#f43f5e', icon: null, text: status || '—' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 9px', borderRadius: 999,
      background: tone.bg, color: tone.color,
      fontSize: 11, fontWeight: 600,
      border: `1px solid ${tone.color}33`,
    }}>{tone.icon}{tone.text}</span>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Styles
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
const tdStyle = { padding: '12px', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }
const emptyStyle = { padding: 24, textAlign: 'center', color: 'var(--text-4)', fontSize: 13, background: 'var(--bg)', borderRadius: 8, border: '1px dashed var(--border-2)' }
const avatarImg = { width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }
const avatarFallback = { width: 36, height: 36, borderRadius: '50%', background: 'var(--surface-2)', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
const lineStyle = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-2)', marginBottom: 3 }

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
