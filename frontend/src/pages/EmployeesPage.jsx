import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  PersonRegular,
  ArrowSyncRegular,
  PeopleRegular,
  HatGraduationRegular,
  ClockRegular,
  CheckmarkCircleRegular,
  DismissCircleRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import Skeleton from '../components/Skeleton'

/**
 * Hodimlar yoki O'quvchilar / Talabalar sahifasi.
 *
 * mode prop:
 *   - "staff"    -> xodim/oqituvchi (oquvchi/talaba bo'lmaganlar)
 *   - "students" -> oquvchi yoki talaba
 *
 * Backend:
 *   GET /api/employees -> [ { id, full_name, personal_id, employee_type,
 *                             department, position, organization_name,
 *                             effective_start_time, effective_end_time,
 *                             schedule_name, status, avatar, ... } ]
 */

const STAFF_TYPES = new Set(['hodim', 'oqituvchi', 'employee', 'staff', 'teacher'])
const STUDENT_TYPES = new Set(['oquvchi', 'talaba', 'student'])

export default function EmployeesPage({ mode = 'staff' }) {
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const isStudents = mode === 'students'

  const [items, setItems] = useState([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [orgFilter, setOrgFilter] = useState('all')
  const aliveRef = useRef(true)

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setRefreshing(true)
    try {
      const res = await fetch('/api/employees', { credentials: 'include' })
      if (!res.ok) {
        if (res.status === 401) throw new Error(isRu ? 'Не авторизован' : 'Avtorizatsiya talab qilinadi')
        throw new Error(`HTTP ${res.status}`)
      }
      const data = await res.json()
      if (aliveRef.current) {
        setItems(Array.isArray(data) ? data : [])
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
    setInitialLoading(true)
    load({ silent: true })
    return () => { aliveRef.current = false }
  }, [load, mode])

  // Mode bo'yicha filtr
  const modeFiltered = useMemo(() => {
    return items.filter(emp => {
      const t = String(emp.employee_type || '').trim().toLowerCase()
      if (isStudents) return STUDENT_TYPES.has(t)
      // Default staff: agar tip bo'lmasa ham xodim deb hisoblaymiz
      if (!t) return true
      return STAFF_TYPES.has(t)
    })
  }, [items, isStudents])

  const orgs = useMemo(() => {
    const set = new Map()
    modeFiltered.forEach(e => {
      if (e.organization_id != null && e.organization_name) {
        set.set(e.organization_id, e.organization_name)
      }
    })
    return Array.from(set, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [modeFiltered])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return modeFiltered.filter(emp => {
      if (orgFilter !== 'all' && String(emp.organization_id) !== String(orgFilter)) return false
      if (!q) return true
      const haystack = [
        emp.full_name, emp.first_name, emp.last_name, emp.middle_name,
        emp.personal_id, emp.department, emp.position, emp.organization_name,
        emp.schedule_name,
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [modeFiltered, search, orgFilter])

  const showSkeleton = initialLoading && items.length === 0

  const titleUz = isStudents ? 'O\'quvchilar / Talabalar' : 'Xodimlar'
  const titleRu = isStudents ? 'Учащиеся / Студенты' : 'Сотрудники'
  const HeroIcon = isStudents ? HatGraduationRegular : PeopleRegular

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={isRu ? `✦ ${titleRu}` : `✦ ${titleUz}`}
        title={isRu ? titleRu : titleUz}
        sub={isStudents
          ? (isRu ? 'Учащиеся школ, студенты колледжей' : 'Maktab o\'quvchilari, kollej talabalari')
          : (isRu ? 'Сотрудники и преподаватели' : 'Hodimlar va o\'qituvchilar')}
        right={
          <button onClick={() => load()} disabled={refreshing || initialLoading} style={refreshBtnStyle(refreshing || initialLoading)}>
            <ArrowSyncRegular fontSize={16} style={{ animation: (refreshing || initialLoading) ? 'spin 1s linear infinite' : 'none' }} />
            {isRu ? 'Обновить' : 'Yangilash'}
          </button>
        }
      />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px 80px' }}>
        {error && <div style={errBannerStyle}>{error}</div>}

        <div style={cardStyle}>
          <div style={toolbarStyle}>
            <div>
              <h3 style={cardTitleStyle}>
                <HeroIcon style={{ color: isStudents ? '#06b6d4' : '#22c55e' }} />
                {isRu ? titleRu : titleUz}
              </h3>
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-4)' }}>
                {filtered.length} / {modeFiltered.length} {isRu ? 'результат' : 'natija'}
                {orgs.length > 0 && ` · ${orgs.length} ${isRu ? 'орг.' : 'tashkilot'}`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={isRu ? 'Поиск по ФИО, ID, отделу' : 'F.I.SH, ID, bo\'lim bo\'yicha qidiruv'}
                style={{ minWidth: 240, ...inpStyle }}
              />
              <select value={orgFilter} onChange={e => setOrgFilter(e.target.value)} style={inpStyle}>
                <option value="all">{isRu ? 'Все организации' : 'Hamma tashkilotlar'}</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          </div>

          {showSkeleton ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: 6 }).map((_, i) => <Skeleton.Row key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={emptyStyle}>
              {modeFiltered.length === 0
                ? (isStudents
                  ? (isRu ? 'Учащиеся / студенты ещё не добавлены.' : 'O\'quvchilar / talabalar hali qo\'shilmagan.')
                  : (isRu ? 'Сотрудники ещё не добавлены.' : 'Hodimlar hali qo\'shilmagan.'))
                : (isRu ? 'Ничего не найдено.' : 'Hech narsa topilmadi.')}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {[
                      isRu ? 'ФИО' : 'F.I.SH',
                      isRu ? 'Личный ID' : 'Shaxsiy ID',
                      isStudents ? (isRu ? 'Класс / группа' : 'Sinf / guruh') : (isRu ? 'Отдел / должность' : 'Bo\'lim / lavozim'),
                      isRu ? 'Организация' : 'Tashkilot',
                      isRu ? 'График' : 'Smena',
                      isRu ? 'Статус' : 'Holat',
                    ].map((h, i) => <th key={i} style={thStyle}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(emp => (
                    <tr key={emp.id}>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {emp.avatar
                            ? <img src={emp.avatar} alt="" style={avatarImg} onError={e => { e.target.style.display = 'none' }} />
                            : <div style={avatarFallback}><PersonRegular fontSize={18} /></div>}
                          <div>
                            <div style={{ fontWeight: 600 }}>{emp.full_name || `#${emp.id}`}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-4)' }}>
                              {emp.employee_type
                                ? <TypePill type={emp.employee_type} />
                                : <span>ID: {emp.id}</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <code style={{ fontSize: 12, color: 'var(--text-1)' }}>
                          {emp.personal_id || '—'}
                        </code>
                      </td>
                      <td style={tdStyle}>
                        <div>{emp.department || <span style={{ color: 'var(--text-4)' }}>—</span>}</div>
                        {emp.position && <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>{emp.position}</div>}
                      </td>
                      <td style={tdStyle}>
                        {emp.organization_name || <span style={{ color: 'var(--text-4)' }}>—</span>}
                      </td>
                      <td style={tdStyle}>
                        {(emp.effective_start_time || emp.effective_end_time) ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                            <ClockRegular fontSize={12} style={{ color: 'var(--text-4)' }} />
                            {emp.effective_start_time || '—'} – {emp.effective_end_time || '—'}
                          </div>
                        ) : <span style={{ color: 'var(--text-4)' }}>—</span>}
                        {emp.schedule_name && (
                          <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>{emp.schedule_name}</div>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <AccessPill status={emp.status} isRu={isRu} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TypePill({ type }) {
  if (!type) return null
  const t = String(type).toLowerCase()
  const map = {
    oquvchi:    { color: '#06b6d4', text: 'O\'quvchi' },
    talaba:     { color: '#0891b2', text: 'Talaba' },
    student:    { color: '#06b6d4', text: 'Student' },
    oqituvchi:  { color: '#22c55e', text: 'O\'qituvchi' },
    teacher:    { color: '#22c55e', text: 'Teacher' },
    hodim:      { color: '#f59e0b', text: 'Hodim' },
    employee:   { color: '#f59e0b', text: 'Employee' },
    staff:      { color: '#f59e0b', text: 'Staff' },
  }
  const meta = map[t] || { color: '#64748b', text: type }
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 7px',
      borderRadius: 999,
      fontSize: 10,
      fontWeight: 600,
      background: meta.color + '22',
      color: meta.color,
      border: `1px solid ${meta.color}55`,
    }}>{meta.text}</span>
  )
}

function AccessPill({ status, isRu }) {
  const isOk = !!status && !String(status).toLowerCase().includes('yo')
  const tone = isOk
    ? { bg: 'rgba(16,185,129,0.12)', color: '#10b981', icon: <CheckmarkCircleRegular fontSize={12} />, text: status || (isRu ? 'Активен' : 'Faol') }
    : { bg: 'rgba(244,63,94,0.10)', color: '#f43f5e', icon: <DismissCircleRegular fontSize={12} />, text: status || (isRu ? 'Нет доступа' : 'Ruxsat yo\'q') }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 9px', borderRadius: 999,
      background: tone.bg, color: tone.color,
      fontSize: 11, fontWeight: 600,
      border: `1px solid ${tone.color}33`,
    }}>
      {tone.icon}{tone.text}
    </span>
  )
}

// shared styles
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
  padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-2)',
  background: 'var(--bg)', color: 'var(--text-1)', fontSize: 13, outline: 'none',
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
