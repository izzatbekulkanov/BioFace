import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  PersonRegular,
  ArrowLeftRegular,
  EditRegular,
  DeleteRegular,
  ArrowSyncRegular,
  CameraRegular,
  ClockRegular,
  CalendarRegular,
  CheckmarkCircleRegular,
  DismissCircleRegular,
  BuildingRegular,
  ChevronLeftRegular,
  ChevronRightRegular,
  BrainCircuitRegular,
  WarningRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import Skeleton from '../components/Skeleton'
import { useToast } from '../components/Toaster'
import { useConfirm } from '../components/ConfirmDialog'

/**
 * Xodim/o'quvchi detail sahifasi.
 *
 * URL:
 *   /employees/:id
 *
 * Bo'limlari:
 *   1. Hero — avatar, ism, tashkilot, tahrirlash/o'chirish tugmalari
 *   2. Stat kartalari — bugungi, oy bo'yicha, jami events, kechikish
 *   3. Asosiy ma'lumotlar (chap) + So'nggi davomat loglari (o'ng) paginatsiyali
 *   4. Ulangan kameralar
 *   5. Psixologik holat tarixi
 */

export default function EmployeeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const toast = useToast()
  const confirm = useConfirm()

  const [employee, setEmployee] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Tabs uchun statlar
  const [logs, setLogs] = useState([])
  const [logsTotal, setLogsTotal] = useState(0)
  const [logsPage, setLogsPage] = useState(1)
  const [logsLoading, setLogsLoading] = useState(true)

  const [psyHistory, setPsyHistory] = useState([])
  const [psyLoading, setPsyLoading] = useState(true)

  const [calendarData, setCalendarData] = useState(null)
  const [calLoading, setCalLoading] = useState(true)
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  })

  const aliveRef = useRef(true)

  // Asosiy xodim ma'lumotlari
  const loadEmployee = useCallback(async () => {
    try {
      const r = await fetch(`/api/employees/${id}`, { credentials: 'include' })
      if (!r.ok) {
        if (r.status === 404) throw new Error(isRu ? 'Сотрудник не найден' : 'Xodim topilmadi')
        if (r.status === 403) throw new Error(isRu ? 'Нет доступа' : "Ruxsat yo'q")
        throw new Error(`HTTP ${r.status}`)
      }
      const data = await r.json()
      if (aliveRef.current) {
        setEmployee(data?.item || null)
        setError('')
      }
    } catch (e) {
      if (aliveRef.current) setError(e.message)
    } finally {
      if (aliveRef.current) setLoading(false)
    }
  }, [id, isRu])

  // Logs (paginatsiya)
  const loadLogs = useCallback(async (page = 1) => {
    setLogsLoading(true)
    try {
      const r = await fetch(`/api/employees/${id}/logs?page=${page}&page_size=20`, { credentials: 'include' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json()
      if (aliveRef.current) {
        setLogs(Array.isArray(data?.items) ? data.items : [])
        setLogsTotal(Number(data?.total || 0))
        setLogsPage(Number(data?.page || page))
      }
    } catch {
      // silent
    } finally {
      if (aliveRef.current) setLogsLoading(false)
    }
  }, [id])

  // Psy
  const loadPsy = useCallback(async () => {
    setPsyLoading(true)
    try {
      const r = await fetch(`/api/employees/${id}/psychological-state/history?limit=14`, { credentials: 'include' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json()
      if (aliveRef.current) {
        setPsyHistory(Array.isArray(data?.items) ? data.items : [])
      }
    } catch {
      // silent
    } finally {
      if (aliveRef.current) setPsyLoading(false)
    }
  }, [id])

  // Calendar
  const loadCalendar = useCallback(async () => {
    setCalLoading(true)
    try {
      const params = new URLSearchParams({ year: String(calMonth.year), month: String(calMonth.month) })
      const r = await fetch(`/api/employees/${id}/attendance-calendar?${params}`, { credentials: 'include' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json()
      if (aliveRef.current) setCalendarData(data || null)
    } catch {
      if (aliveRef.current) setCalendarData(null)
    } finally {
      if (aliveRef.current) setCalLoading(false)
    }
  }, [id, calMonth.year, calMonth.month])

  useEffect(() => {
    aliveRef.current = true
    loadEmployee()
    loadLogs(1)
    loadPsy()
    return () => { aliveRef.current = false }
  }, [loadEmployee, loadLogs, loadPsy])

  useEffect(() => { loadCalendar() }, [loadCalendar])

  const isStudent = useMemo(() => {
    const t = String(employee?.employee_type || '').toLowerCase()
    return ['oquvchi', 'talaba', 'student'].includes(t)
  }, [employee])

  const backPath = location.state?.from || (isStudent ? '/users/students' : '/users/staff')

  const onDelete = async () => {
    if (!employee) return
    const ok = await confirm({
      title: isRu ? 'Удалить?' : "O'chirish?",
      message: isRu
        ? `${employee.full_name} будет удалён из системы и со всех привязанных камер.`
        : `${employee.full_name} tizimdan va kameralardan o'chiriladi.`,
      confirmText: isRu ? 'Удалить' : "O'chirish",
      cancelText: isRu ? 'Отмена' : 'Bekor qilish',
      danger: true,
    })
    if (!ok) return
    try {
      const r = await fetch(`/api/employees/${id}?delete_from_cameras=true`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json()
      const sync = data?.camera_sync
      if (sync && sync.enabled) {
        const ok2 = sync.deleted || 0
        const fail = sync.failed || 0
        const skip = sync.skipped || 0
        if (fail || skip) {
          toast.warning(isRu
            ? `Удалён. Камеры: ${ok2} OK, ${fail} ошибок, ${skip} пропущено`
            : `O'chirildi. Kameralar: ${ok2} OK, ${fail} xato, ${skip} o'tkazildi`)
        } else {
          toast.success(isRu ? `Удалён. Камеры: ${ok2} OK` : `O'chirildi. ${ok2} kameradan ham`)
        }
      } else {
        toast.success(isRu ? 'Удалён' : "O'chirildi")
      }
      navigate(backPath)
    } catch (e) {
      toast.error(e.message)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)' }}>
        <PageHero badge="✦" title={isRu ? 'Сотрудник' : 'Xodim'} backPath={backPath} />
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 32px' }}>
          <Skeleton.Card rows={4} />
          <div style={{ marginTop: 16 }}><Skeleton.Stats count={4} /></div>
        </div>
      </div>
    )
  }

  if (error || !employee) {
    return (
      <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)' }}>
        <PageHero badge="✦" title={isRu ? 'Ошибка' : 'Xato'} backPath={backPath} />
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 32px' }}>
          <div style={{ padding: 24, background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 12, border: '1px solid var(--red-bd)' }}>
            {error || (isRu ? 'Сотрудник не найден' : 'Xodim topilmadi')}
          </div>
        </div>
      </div>
    )
  }

  const cal = calendarData
  const totalLogPages = Math.max(1, Math.ceil(logsTotal / 20))

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={isRu ? '✦ Профиль' : '✦ Profil'}
        title={employee.full_name}
        sub={[
          employee.organization_name,
          employee.department,
          employee.position,
        ].filter(Boolean).join(' · ')}
        backPath={backPath}
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => navigate(`/employees/${id}/edit`)} style={heroBtn('subtle')}>
              <EditRegular fontSize={14} /> {isRu ? 'Изменить' : 'Tahrirlash'}
            </button>
            <button onClick={onDelete} style={heroBtn('danger')}>
              <DeleteRegular fontSize={14} /> {isRu ? 'Удалить' : "O'chirish"}
            </button>
          </div>
        }
      />

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 32px 80px' }}>
        {/* Stat kartalari */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 18 }}>
          <StatCard
            icon={<CalendarRegular fontSize={20} />}
            label={isRu ? 'Этот месяц' : 'Shu oy'}
            value={cal?.summary?.present_days ?? '—'}
            hint={isRu ? 'Дни присутствия' : 'Kelgan kunlar'}
            color="#10b981"
            loading={calLoading}
          />
          <StatCard
            icon={<ClockRegular fontSize={20} />}
            label={isRu ? 'Опоздания' : 'Kechikishlar'}
            value={cal?.summary?.late_days ?? '—'}
            hint={isRu ? 'Дни с опозданием' : 'Kechikkan kunlar'}
            color="#f59e0b"
            loading={calLoading}
          />
          <StatCard
            icon={<DismissCircleRegular fontSize={20} />}
            label={isRu ? 'Отсутствия' : 'Kelmagan'}
            value={cal?.summary?.absent_days ?? '—'}
            hint={isRu ? 'Дни отсутствия' : 'Yo\'qlik kunlari'}
            color="#f43f5e"
            loading={calLoading}
          />
          <StatCard
            icon={<CheckmarkCircleRegular fontSize={20} />}
            label={isRu ? 'Всего событий' : 'Jami eventlar'}
            value={logsTotal}
            hint={isRu ? 'Распознавания за всё время' : "Tanish hodisalari"}
            color="#3b82f6"
            loading={logsLoading}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 18, marginBottom: 18 }}>
          {/* Asosiy ma'lumotlar (chap) */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
              <div style={{
                width: 120, height: 120, borderRadius: '50%',
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              }}>
                {employee.avatar
                  ? <img src={employee.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
                  : <PersonRegular fontSize={40} style={{ color: 'var(--text-4)' }} />}
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{employee.full_name}</div>
                {employee.employee_type && <TypePill type={employee.employee_type} />}
              </div>
              <AccessPill status={employee.status} isRu={isRu} />
            </div>

            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <InfoRow label={isRu ? 'ID' : 'ID'} value={employee.personal_id || '—'} mono />
              <InfoRow label={isRu ? 'Организация' : 'Tashkilot'} value={employee.organization_name || '—'} icon={<BuildingRegular fontSize={12} />} />
              <InfoRow
                label={isStudent ? (isRu ? 'Класс' : 'Sinf') : (isRu ? 'Отдел' : "Bo'lim")}
                value={employee.department || '—'}
              />
              <InfoRow
                label={isStudent ? (isRu ? 'Параллель' : 'Parallel') : (isRu ? 'Должность' : 'Lavozim')}
                value={employee.position || '—'}
              />
              <InfoRow
                label={isRu ? 'График' : 'Smena'}
                value={(employee.effective_start_time || '—') + ' – ' + (employee.effective_end_time || '—')}
                icon={<ClockRegular fontSize={12} />}
              />
              {employee.schedule_name && (
                <InfoRow label={isRu ? 'Название графика' : 'Smena nomi'} value={employee.schedule_name} />
              )}
              <InfoRow label={isRu ? 'Пол' : 'Jinsi'} value={employee.gender === 'male' ? (isRu ? 'Мужской' : 'Erkak') : employee.gender === 'female' ? (isRu ? 'Женский' : 'Ayol') : '—'} />
              <InfoRow label={isRu ? 'Дата рождения' : "Tug'ilgan sana"} value={employee.birth_date || '—'} />
              <InfoRow label={isRu ? 'Телефон' : 'Telefon'} value={employee.phone || '—'} />
              {employee.parent_phone && (
                <InfoRow label={isRu ? 'Телефон родителей' : 'Ota-onasi telefoni'} value={employee.parent_phone} />
              )}
              {employee.region && (
                <InfoRow label={isRu ? 'Область' : 'Viloyat'} value={employee.region} />
              )}
              {employee.district && (
                <InfoRow label={isRu ? 'Район' : 'Tuman'} value={employee.district} />
              )}
              {employee.address && (
                <InfoRow label={isRu ? 'Адрес' : 'Manzil'} value={employee.address} />
              )}
              <InfoRow label={isRu ? 'Дата добавления' : "Qo'shilgan sana"} value={employee.added_date || '—'} />
            </div>
          </div>

          {/* Kalendar (o'ng) */}
          <CalendarPanel
            data={calendarData}
            loading={calLoading}
            month={calMonth}
            onMonthChange={setCalMonth}
            isRu={isRu}
          />
        </div>

        {/* So'nggi loglar (alohida bo'lim, to'liq enlik) */}
        <div style={{ ...cardStyle, marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={cardTitle}>
              <CalendarRegular style={{ color: '#3b82f6' }} />
              {isRu ? 'История посещений' : "Davomat tarixi"}
            </h3>
            <span style={countPill}>
              {logsTotal} {isRu ? 'записей' : 'yozuv'}
            </span>
          </div>

          {logsLoading && logs.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: 5 }).map((_, i) => <Skeleton.Row key={i} />)}
            </div>
          ) : logs.length === 0 ? (
            <div style={emptyStyle}>
              {isRu ? 'Нет записей посещаемости.' : "Davomat yozuvlari yo'q."}
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      {[
                        isRu ? 'Дата' : 'Sana',
                        isRu ? 'Время' : 'Vaqt',
                        isRu ? 'Камера' : 'Kamera',
                        isRu ? 'Статус' : 'Holat',
                      ].map((h, i) => <th key={i} style={thStyle}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(l => (
                      <tr key={l.id}>
                        <td style={tdStyle}>{formatDate(l.timestamp)}</td>
                        <td style={tdStyle}>
                          <span style={{ fontFamily: 'monospace' }}>{formatTime(l.timestamp)}</span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                            <CameraRegular fontSize={12} style={{ color: 'var(--text-4)' }} />
                            {l.camera_name || '—'}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <StatusPill status={l.status} isRu={isRu} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalLogPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-4)' }}>
                    {isRu ? 'Стр.' : 'Sahifa'} {logsPage} / {totalLogPages}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      disabled={logsPage <= 1 || logsLoading}
                      onClick={() => loadLogs(logsPage - 1)}
                      style={pageBtn(logsPage > 1)}
                    >
                      <ChevronLeftRegular fontSize={14} />
                    </button>
                    <button
                      type="button"
                      disabled={logsPage >= totalLogPages || logsLoading}
                      onClick={() => loadLogs(logsPage + 1)}
                      style={pageBtn(logsPage < totalLogPages)}
                    >
                      <ChevronRightRegular fontSize={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Ulangan kameralar */}
        <div style={{ ...cardStyle, marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={cardTitle}>
              <CameraRegular style={{ color: '#22c55e' }} />
              {isRu ? 'Привязанные камеры' : 'Ulangan kameralar'}
            </h3>
            <span style={countPill}>
              {employee.camera_names?.length || 0} {isRu ? 'шт.' : 'ta'}
            </span>
          </div>
          {!employee.camera_names || employee.camera_names.length === 0 ? (
            <div style={emptyStyle}>
              {isRu ? 'Камеры не привязаны.' : "Kamera biriktirilmagan."}
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {employee.camera_names.map((name, i) => (
                <span key={i} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 8,
                  background: 'var(--bg)', border: '1px solid var(--border-2)',
                  fontSize: 13, color: 'var(--text-1)',
                }}>
                  <CameraRegular fontSize={14} style={{ color: 'var(--text-4)' }} />
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Psixologik holat tarixi */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={cardTitle}>
              <BrainCircuitRegular style={{ color: '#a855f7' }} />
              {isRu ? 'Психологическое состояние' : 'Psixologik holat tarixi'}
            </h3>
            <span style={countPill}>
              {psyHistory.length} {isRu ? 'записей' : 'yozuv'}
            </span>
          </div>
          {psyLoading && psyHistory.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: 4 }).map((_, i) => <Skeleton.Row key={i} />)}
            </div>
          ) : psyHistory.length === 0 ? (
            <div style={emptyStyle}>
              {isRu ? 'Нет данных психологического состояния.' : "Psixologik holat ma'lumotlari yo'q."}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {psyHistory.map(s => (
                <PsyRow key={s.id} state={s} isRu={isRu} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Calendar panel
// ────────────────────────────────────────────────────────────────────────────

const STATUS_TONES = {
  present:    { bg: 'rgba(16,185,129,0.15)',  bd: 'rgba(16,185,129,0.40)',  fg: '#10b981' },
  late:       { bg: 'rgba(245,158,11,0.15)',  bd: 'rgba(245,158,11,0.40)',  fg: '#f59e0b' },
  absent:     { bg: 'rgba(244,63,94,0.10)',   bd: 'rgba(244,63,94,0.25)',   fg: '#f43f5e' },
  weekend:    { bg: 'var(--surface-2)',        bd: 'var(--border-2)',        fg: 'var(--text-4)' },
  holiday:    { bg: 'rgba(168,85,247,0.10)',  bd: 'rgba(168,85,247,0.30)',  fg: '#a855f7' },
  future:     { bg: 'var(--bg)',               bd: 'var(--border-2)',        fg: 'var(--text-4)' },
  no_data:    { bg: 'var(--bg)',               bd: 'var(--border-2)',        fg: 'var(--text-4)' },
}

function CalendarPanel({ data, loading, month, onMonthChange, isRu }) {
  const [selectedDay, setSelectedDay] = useState(null)
  const days = data?.days || []
  const summary = data?.summary || {}

  const monthName = useMemo(() => {
    const date = new Date(month.year, month.month - 1, 1)
    return date.toLocaleDateString(isRu ? 'ru-RU' : 'uz-UZ', { month: 'long', year: 'numeric' })
  }, [month, isRu])

  const goPrev = () => {
    const m = month.month === 1 ? { year: month.year - 1, month: 12 } : { year: month.year, month: month.month - 1 }
    setSelectedDay(null)
    onMonthChange(m)
  }
  const goNext = () => {
    const m = month.month === 12 ? { year: month.year + 1, month: 1 } : { year: month.year, month: month.month + 1 }
    setSelectedDay(null)
    onMonthChange(m)
  }

  // 6×7 grid: oyning birinchi kuni hafta kuniga moslab bo'sh kataklar
  const firstDow = new Date(month.year, month.month - 1, 1).getDay() // 0=Sun
  const offset = (firstDow + 6) % 7  // monday-first
  const cells = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let i = 0; i < days.length; i++) cells.push(days[i])

  const weekdays = isRu
    ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
    : ['Du', 'Se', 'Cho', 'Pa', 'Ju', 'Sha', 'Ya']

  return (
    <div style={cardStyle}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <h3 style={cardTitle}>
          <CalendarRegular style={{ color: '#3b82f6' }} />
          {isRu ? 'Календарь посещаемости' : 'Davomat kalendari'}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button type="button" onClick={goPrev} style={pageBtn(true)} title={isRu ? 'Предыдущий' : 'Oldingi'}>
            <ChevronLeftRegular fontSize={14} />
          </button>
          <span style={{
            minWidth: 160, textAlign: 'center',
            padding: '6px 12px', borderRadius: 7,
            background: 'var(--bg)', border: '1px solid var(--border-2)',
            fontSize: 13, fontWeight: 600, textTransform: 'capitalize',
          }}>
            {monthName}
          </span>
          <button type="button" onClick={goNext} style={pageBtn(true)} title={isRu ? 'Следующий' : 'Keyingi'}>
            <ChevronRightRegular fontSize={14} />
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 8, marginBottom: 14,
      }}>
        <SummaryPill label={isRu ? 'Присутствовал' : 'Kelgan'} value={summary.present_days ?? 0} color="#10b981" />
        <SummaryPill label={isRu ? 'Опоздания' : 'Kechikkan'} value={summary.late_days ?? 0} color="#f59e0b" />
        <SummaryPill label={isRu ? 'Отсутствие' : "Yo'q"} value={summary.absent_days ?? 0} color="#f43f5e" />
        <SummaryPill label={isRu ? 'Опоздание (всего)' : 'Jami kechikish'} value={summary.total_late_human || '—'} color="#a855f7" />
      </div>

      {loading && days.length === 0 ? (
        <Skeleton width="100%" height={260} />
      ) : (
        <div>
          {/* Weekday header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
            {weekdays.map((w, i) => (
              <div key={w} style={{
                padding: '6px 4px', textAlign: 'center', fontSize: 11,
                fontWeight: 700, color: i >= 5 ? '#f43f5e' : 'var(--text-4)',
                textTransform: 'uppercase', letterSpacing: 0.4,
              }}>{w}</div>
            ))}
          </div>

          {/* Day grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {cells.map((d, idx) => {
              if (!d) return <div key={`empty-${idx}`} />
              const tone = STATUS_TONES[d.status] || STATUS_TONES.no_data
              const isSel = selectedDay && selectedDay.day === d.day
              return (
                <button
                  key={d.day}
                  type="button"
                  onClick={() => setSelectedDay(isSel ? null : d)}
                  style={{
                    aspectRatio: '1 / 1',
                    minHeight: 64,
                    padding: '6px 8px',
                    background: tone.bg,
                    border: `1.5px solid ${isSel ? 'var(--accent)' : tone.bd}`,
                    borderRadius: 8,
                    color: tone.fg,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                  title={d.date}
                >
                  <span style={{
                    fontSize: 13, fontWeight: 700,
                    color: isSel ? 'var(--accent)' : tone.fg,
                  }}>{d.day}</span>
                  {d.status === 'present' && <span style={{ fontSize: 10, fontWeight: 600 }}>✓</span>}
                  {d.status === 'late' && (
                    <span style={{ fontSize: 10, fontWeight: 600, lineHeight: 1.1 }}>
                      ⏱ {d.late_human ? d.late_human.replace(/\s+/g, '') : ''}
                    </span>
                  )}
                  {d.status === 'absent' && <span style={{ fontSize: 10, fontWeight: 600 }}>✕</span>}
                  {d.status === 'weekend' && <span style={{ fontSize: 10 }}>{isRu ? 'вых.' : 'dam'}</span>}
                  {d.status === 'holiday' && <span style={{ fontSize: 10 }}>{isRu ? 'празд.' : 'bayram'}</span>}
                </button>
              )
            })}
          </div>

          {/* Selected day details */}
          {selectedDay && (
            <div style={{
              marginTop: 14,
              padding: 14,
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 10,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>
                  {selectedDay.date}
                </div>
                <DayStatusPill status={selectedDay.status} isRu={isRu} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                <DayInfo label={isRu ? 'Ожидаемое время' : 'Belgilangan vaqt'} value={(formatTime(selectedDay.expected_time) || '—') + ' – ' + (formatTime(selectedDay.expected_end_time) || '—')} />
                <DayInfo label={isRu ? 'Первый вход' : 'Birinchi kirish'} value={selectedDay.first_seen ? formatTime(selectedDay.first_seen) : '—'} />
                {selectedDay.last_seen && selectedDay.last_seen !== selectedDay.first_seen && (
                  <DayInfo label={isRu ? 'Последний вход' : 'Oxirgi kirish'} value={formatTime(selectedDay.last_seen)} />
                )}
                {selectedDay.late_human && selectedDay.late_minutes > 0 && (
                  <DayInfo label={isRu ? 'Опоздание' : 'Kechikish'} value={selectedDay.late_human} color="#f59e0b" />
                )}
                {selectedDay.worked_human && (
                  <DayInfo label={isRu ? 'Время работы' : 'Ishlangan vaqt'} value={selectedDay.worked_human} />
                )}
                {selectedDay.event_count > 0 && (
                  <DayInfo label={isRu ? 'События' : 'Hodisalar'} value={selectedDay.event_count} />
                )}
              </div>

              {selectedDay.camera_names && selectedDay.camera_names.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {selectedDay.camera_names.map((n, i) => (
                    <span key={i} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 9px', borderRadius: 999,
                      background: 'var(--surface-2)', border: '1px solid var(--border-2)',
                      fontSize: 11, color: 'var(--text-2)',
                    }}>
                      <CameraRegular fontSize={12} style={{ color: 'var(--text-4)' }} />
                      {n}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Legend */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 12,
            marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)',
            fontSize: 11, color: 'var(--text-4)',
          }}>
            <LegendDot color="#10b981" label={isRu ? 'Присутствовал' : 'Kelgan'} />
            <LegendDot color="#f59e0b" label={isRu ? 'Опоздание' : 'Kechikkan'} />
            <LegendDot color="#f43f5e" label={isRu ? 'Отсутствовал' : "Yo'q"} />
            <LegendDot color="var(--text-4)" label={isRu ? 'Выходной' : 'Dam olish'} />
            <LegendDot color="#a855f7" label={isRu ? 'Праздник' : 'Bayram'} />
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryPill({ label, value, color }) {
  return (
    <div style={{
      padding: '8px 12px', borderRadius: 8,
      background: color + '14', border: `1px solid ${color}40`,
    }}>
      <div style={{ fontSize: 10, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color, marginTop: 2 }}>{value}</div>
    </div>
  )
}

function DayStatusPill({ status, isRu }) {
  const map = {
    present:  { bg: 'rgba(16,185,129,0.15)',  fg: '#10b981', text: isRu ? 'Присутствовал' : 'Kelgan' },
    late:     { bg: 'rgba(245,158,11,0.15)',  fg: '#f59e0b', text: isRu ? 'Опоздание' : 'Kechikkan' },
    absent:   { bg: 'rgba(244,63,94,0.10)',   fg: '#f43f5e', text: isRu ? 'Отсутствовал' : "Yo'q" },
    weekend:  { bg: 'var(--surface-2)',        fg: 'var(--text-3)', text: isRu ? 'Выходной' : 'Dam olish' },
    holiday:  { bg: 'rgba(168,85,247,0.10)',  fg: '#a855f7', text: isRu ? 'Праздник' : 'Bayram' },
    future:   { bg: 'var(--bg)',               fg: 'var(--text-4)', text: isRu ? 'В будущем' : 'Kelajakda' },
    no_data:  { bg: 'var(--bg)',               fg: 'var(--text-4)', text: isRu ? 'Нет данных' : "Ma'lumot yo'q" },
  }
  const t = map[status] || map.no_data
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 999,
      fontSize: 11, fontWeight: 600,
      background: t.bg, color: t.fg, border: `1px solid ${t.fg}33`,
    }}>{t.text}</span>
  )
}

function DayInfo({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: color || 'var(--text-1)', marginTop: 2 }}>{value}</div>
    </div>
  )
}

function LegendDot({ color, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: 'inline-block' }} />
      {label}
    </span>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, hint, color, loading }) {
  return (
    <div style={{
      padding: '16px 18px', background: 'var(--surface)',
      border: '1px solid var(--border)', borderRadius: 12,
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
        background: color + '22', color, border: `1px solid ${color}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
        {loading
          ? <div style={{ marginTop: 4 }}><Skeleton width={60} height={20} /></div>
          : <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', marginTop: 2 }}>{value}</div>}
        {hint && <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>{hint}</div>}
      </div>
    </div>
  )
}

function InfoRow({ label, value, icon, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
      <span style={{ color: 'var(--text-4)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {icon}{label}
      </span>
      <span style={{
        textAlign: 'right', color: 'var(--text-1)', fontWeight: 500,
        fontFamily: mono ? 'monospace' : undefined,
        wordBreak: 'break-word',
      }}>{value}</span>
    </div>
  )
}

function TypePill({ type }) {
  const t = String(type || '').toLowerCase()
  const map = {
    oquvchi:    { color: '#06b6d4', text: "O'quvchi" },
    talaba:     { color: '#0891b2', text: 'Talaba' },
    student:    { color: '#06b6d4', text: 'Student' },
    oqituvchi:  { color: '#22c55e', text: "O'qituvchi" },
    teacher:    { color: '#22c55e', text: 'Teacher' },
    hodim:      { color: '#f59e0b', text: 'Hodim' },
    employee:   { color: '#f59e0b', text: 'Employee' },
    staff:      { color: '#f59e0b', text: 'Staff' },
  }
  const meta = map[t] || { color: '#64748b', text: type }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 9px', borderRadius: 999,
      fontSize: 11, fontWeight: 600, marginTop: 6,
      background: meta.color + '22', color: meta.color, border: `1px solid ${meta.color}55`,
    }}>{meta.text}</span>
  )
}

function AccessPill({ status, isRu }) {
  const isOk = !!status && !String(status).toLowerCase().includes('yo')
  const tone = isOk
    ? { bg: 'rgba(16,185,129,0.12)', color: '#10b981', icon: <CheckmarkCircleRegular fontSize={12} />, text: status || (isRu ? 'Активен' : 'Faol') }
    : { bg: 'rgba(244,63,94,0.10)', color: '#f43f5e', icon: <DismissCircleRegular fontSize={12} />, text: status || (isRu ? 'Нет доступа' : "Ruxsat yo'q") }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 999,
      background: tone.bg, color: tone.color,
      fontSize: 11, fontWeight: 600,
      border: `1px solid ${tone.color}33`,
    }}>{tone.icon}{tone.text}</span>
  )
}

function StatusPill({ status, isRu }) {
  const s = String(status || '').toLowerCase()
  const isKnown = s.includes('aniq') || s === 'present' || s === 'recognized'
  const tone = isKnown
    ? { bg: 'rgba(16,185,129,0.12)', color: '#10b981', icon: <CheckmarkCircleRegular fontSize={11} />, text: isRu ? 'Распознан' : 'Aniqlandi' }
    : { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', icon: <WarningRegular fontSize={11} />, text: isRu ? 'Неизвестный' : "Noma'lum" }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 999,
      background: tone.bg, color: tone.color,
      fontSize: 10, fontWeight: 600,
      border: `1px solid ${tone.color}33`,
    }}>{tone.icon}{tone.text}</span>
  )
}

function PsyRow({ state, isRu }) {
  const text = isRu ? (state.profile_text_ru || state.state_ru) : (state.profile_text_uz || state.state_uz)
  const tone = emotionTone(state.state_key)
  const pct = state.confidence != null ? Math.round((state.confidence || 0) * 100) : null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '10px 14px', borderRadius: 8,
      background: 'var(--bg)', border: '1px solid var(--border)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: tone + '22', color: tone, border: `1px solid ${tone}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
      }}>
        {pct != null ? `${pct}%` : '—'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{text || '—'}</div>
        <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>
          {state.state_date}{state.source && <> · {state.source}</>}
        </div>
      </div>
    </div>
  )
}

function emotionTone(key) {
  const map = {
    happy: '#22c55e', neutral: '#3b82f6', sad: '#64748b',
    anger: '#f43f5e', angry: '#f43f5e', fear: '#a855f7',
    disgust: '#84cc16', surprise: '#06b6d4', contempt: '#f59e0b',
    undetermined: '#94a3b8',
  }
  return map[String(key || '').toLowerCase()] || '#64748b'
}

function formatDate(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return iso }
}
function formatTime(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
  catch { return iso }
}

// ────────────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────────────

const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }
const cardTitle = { fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }
const tableStyle = { width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }
const thStyle = {
  textAlign: 'left', padding: '8px 10px', fontSize: 11,
  fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase',
  letterSpacing: 0.4, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
}
const tdStyle = { padding: '9px 10px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
const emptyStyle = { padding: 20, textAlign: 'center', color: 'var(--text-4)', fontSize: 13, background: 'var(--bg)', borderRadius: 8, border: '1px dashed var(--border-2)' }
const countPill = {
  display: 'inline-block', padding: '3px 10px', borderRadius: 999,
  background: 'var(--surface-2)', border: '1px solid var(--border-2)',
  fontSize: 11, fontWeight: 600, color: 'var(--text-2)',
}

function heroBtn(kind) {
  const map = {
    subtle: { bg: 'rgba(255,255,255,0.10)', color: '#fff', border: '1px solid rgba(255,255,255,0.14)' },
    danger: { bg: 'rgba(244,63,94,0.18)', color: '#fff', border: '1px solid rgba(244,63,94,0.40)' },
  }
  const t = map[kind] || map.subtle
  return {
    display: 'flex', alignItems: 'center', gap: 7,
    padding: '8px 14px', borderRadius: 8,
    background: t.bg, color: t.color, border: t.border,
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
  }
}

function pageBtn(enabled) {
  return {
    width: 32, height: 32, borderRadius: 7,
    border: '1px solid var(--border-2)',
    background: enabled ? 'var(--bg)' : 'var(--surface-2)',
    color: enabled ? 'var(--text-1)' : 'var(--text-4)',
    cursor: enabled ? 'pointer' : 'not-allowed',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    opacity: enabled ? 1 : 0.5,
  }
}
