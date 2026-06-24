import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  CalendarClockRegular, CalendarLtrRegular, BuildingRegular,
  PeopleRegular, PulseSquareRegular, FilterRegular,
  ArrowSyncRegular, DocumentCopyRegular, SearchRegular,
  CheckmarkSquareRegular, DeleteRegular, EditRegular, AddRegular,
  ChevronLeftRegular, ChevronRightRegular, DismissRegular, PersonRegular
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import CustomSelect from '../components/CustomSelect'
import { useConfirm } from '../components/ConfirmDialog'
import { useToast } from '../components/Toaster'

export default function Shifts() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const isRu = i18n.language === 'ru'

  // --- States ---
  const [loading, setLoading] = useState(true)
  const [filterOptions, setFilterOptions] = useState({ organizations: [], departments: [], positions: [] })
  
  // Table
  const [employees, setEmployees] = useState([])
  const [stats, setStats] = useState({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  
  // Filters
  const [search, setSearch] = useState('')
  const [orgFilter, setOrgFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  
  // Schedule Manager
  const [scheduleOrg, setScheduleOrg] = useState('')
  const [schedules, setSchedules] = useState([])
  const [scheduleLoading, setScheduleLoading] = useState(false)

  // Holidays
  const [holidayOrg, setHolidayOrg] = useState('global')
  const [holidays, setHolidays] = useState([])
  const [holidayLoading, setHolidayLoading] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [holidayViewMode, setHolidayViewMode] = useState('calendar') // 'calendar' or 'list'
  const [currentUser, setCurrentUser] = useState(null)

  // Modal States
  // 1. Schedule Modal
  const [isSchModalOpen, setIsSchModalOpen] = useState(false)
  const [schEditing, setSchEditing] = useState(null)
  const [schName, setSchName] = useState('')
  const [schOrg, setSchOrg] = useState('') // Tashkilot (modal-level)
  const [schStart, setSchStart] = useState('09:00')
  const [schEnd, setSchEnd] = useState('18:00')
  const [schFlexible, setSchFlexible] = useState(false)
  const [schSubmitting, setSchSubmitting] = useState(false)
  const [schError, setSchError] = useState('')

  // 2. Holiday Modal
  const [isHolModalOpen, setIsHolModalOpen] = useState(false)
  const [holEditing, setHolEditing] = useState(null)
  const [holTitle, setHolTitle] = useState('')
  const [holDate, setHolDate] = useState('')
  const [holIsWeekend, setHolIsWeekend] = useState(false)
  const [holSubmitting, setHolSubmitting] = useState(false)
  const [holError, setHolError] = useState('')

  // 3. Bulk Schedule Modal
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)
  const [bulkSelectSch, setBulkSelectSch] = useState('')
  const [bulkClearOver, setBulkClearOver] = useState(true)
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [bulkError, setBulkError] = useState('')

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState([])

  // Selected organization info
  const selectedOrgObj = filterOptions.organizations.find(o => o.id.toString() === scheduleOrg)
  const selectedOrgName = selectedOrgObj ? selectedOrgObj.name : ''

  // Attendance Monitor Status State
  const [monitorStatus, setMonitorStatus] = useState(null)
  const [monitorRunning, setMonitorRunning] = useState(false)

  // Initial Load
  useEffect(() => {
    // Fetch current user details
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(user => {
        if (user) {
          setCurrentUser(user)
        }
      })
      .catch(console.error)

    fetch('/api/employees/filter-options')
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setFilterOptions(data)
          if (data.organizations?.length > 0) {
            setScheduleOrg(data.organizations[0].id.toString())
          }
        }
      })
      .catch(console.error)
  }, [])

  // Auto-switch holidayOrg away from 'global' for non-superadmins
  useEffect(() => {
    if (currentUser) {
      const role = (currentUser.role || '').toLowerCase().replace(/_/g, '')
      const isSuper = role === 'superadmin'
      if (!isSuper && holidayOrg === 'global' && filterOptions.organizations?.length > 0) {
        setHolidayOrg(filterOptions.organizations[0].id.toString())
      }
    }
  }, [currentUser, filterOptions.organizations, holidayOrg])

  // Load Monitor Status
  const loadMonitorStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance-monitor/status')
      const data = await res.json()
      if (data.ok) setMonitorStatus(data.status)
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    loadMonitorStatus()
  }, [loadMonitorStatus])

  // Load Employees
  const loadEmployees = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('page', page)
      params.append('page_size', pageSize)
      if (search) params.append('query', search)
      if (orgFilter) params.append('organization_id', orgFilter)
      if (typeFilter) params.append('employee_type', typeFilter)
      
      const res = await fetch(`/api/employees/search?${params.toString()}`)
      const data = await res.json()
      if (data.ok) {
        setEmployees(data.items || [])
        setStats(data.stats || {})
        setTotalPages(data.total_pages || 1)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, orgFilter, typeFilter])

  useEffect(() => { loadEmployees() }, [loadEmployees])

  // Load Schedules
  const loadSchedules = useCallback(async () => {
    if (!scheduleOrg) return
    setScheduleLoading(true)
    try {
      const res = await fetch(`/api/organizations/${scheduleOrg}/schedules`)
      const data = await res.json()
      if (data.ok) setSchedules(data.items || [])
    } catch (e) {
      console.error(e)
    } finally {
      setScheduleLoading(false)
    }
  }, [scheduleOrg])

  useEffect(() => { loadSchedules() }, [loadSchedules])

  // Load Holidays
  const loadHolidays = useCallback(async () => {
    setHolidayLoading(true)
    try {
      const y = currentDate.getFullYear()
      const m = currentDate.getMonth() + 1
      const params = new URLSearchParams()
      params.append('year', y)
      params.append('month', m.toString().padStart(2, '0'))
      if (holidayOrg !== 'global') params.append('organization_id', holidayOrg)

      const res = await fetch(`/api/holidays?${params.toString()}`)
      const data = await res.json()
      if (data.ok) setHolidays(data.items || [])
    } catch (e) {
      console.error(e)
    } finally {
      setHolidayLoading(false)
    }
  }, [currentDate, holidayOrg])

  useEffect(() => { loadHolidays() }, [loadHolidays])

  // --- Modal Open Handlers ---
  const handleOpenSchModal = (sch = null) => {
    setSchEditing(sch)
    setSchName(sch ? sch.name : '')
    setSchOrg(sch ? (sch.organization_id ? sch.organization_id.toString() : scheduleOrg) : scheduleOrg)
    setSchStart(sch ? sch.start_time : '09:00')
    setSchEnd(sch ? sch.end_time : '18:00')
    setSchFlexible(sch ? sch.is_flexible : false)
    setSchError('')
    setIsSchModalOpen(true)
  }

  const handleOpenHolModal = (hol = null) => {
    if (hol) {
      const isSuper = (currentUser?.role || '').toLowerCase().replace(/_/g, '') === 'superadmin'
      if (hol.organization_id === null && !isSuper) {
        toast.error(isRu ? 'Вы не можете изменять глобальные праздники' : 'Siz global bayramlarni o\'zgartira olmaysiz')
        return
      }
      setHolEditing(hol)
      setHolTitle(hol.title || '')
      setHolDate(hol.date || '')
      setHolIsWeekend(!!hol.is_weekend)
    } else {
      setHolEditing(null)
      setHolTitle('')
      const defaultDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01`
      setHolDate(defaultDate)
      setHolIsWeekend(false)
    }
    setHolError('')
    setIsHolModalOpen(true)
  }

  const handleOpenBulkModal = () => {
    const selectedEmps = employees.filter(emp => selectedIds.includes(emp.id))
    const orgIds = Array.from(new Set(selectedEmps.map(emp => emp.organization_id).filter(Boolean)))
    if (orgIds.length > 1) {
      toast.warning(
        isRu 
          ? 'Групповая смена применяется только к одной организации. Пожалуйста, отфильтруйте сотрудников по организации.' 
          : 'Bulk smena faqat bitta tashkilot bo\'yicha qo\'llanadi. Avval tashkilot bo\'yicha filtrlang.'
      )
      return
    }
    setBulkSelectSch('')
    setBulkClearOver(true)
    setBulkError('')
    setIsBulkModalOpen(true)
  }

  // --- CRUD Submission Handlers ---
  const handleSchSubmit = async (e) => {
    e.preventDefault()
    if (!schName.trim()) {
      setSchError(isRu ? 'Название смены обязательно' : 'Smena nomi majburiy')
      return
    }
    const targetOrg = schOrg || scheduleOrg
    if (!targetOrg) {
      setSchError(isRu ? 'Выберите организацию' : 'Tashkilotni tanlang')
      return
    }
    setSchSubmitting(true)
    setSchError('')
    try {
      const url = schEditing 
        ? `/api/schedules/${schEditing.id}` 
        : `/api/organizations/${targetOrg}/schedules`
      const method = schEditing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: schName.trim(),
          start_time: schStart,
          end_time: schEnd,
          is_flexible: schFlexible
        })
      })
      const data = await res.json()
      if (data.ok) {
        toast.success(
          schEditing 
            ? (isRu ? 'Смена успешно обновлена' : 'Smena muvaffaqiyatli yangilandi')
            : (isRu ? 'Смена успешно создана' : 'Smena muvaffaqiyatli yaratildi')
        )
        setIsSchModalOpen(false)
        loadSchedules()
        loadEmployees()
      } else {
        setSchError(data.detail || (isRu ? 'Ошибка при сохранении' : 'Saqlashda xatolik'))
      }
    } catch (err) {
      console.error(err)
      setSchError(isRu ? 'Сетевая ошибка' : 'Tarmoq xatoligi')
    } finally {
      setSchSubmitting(false)
    }
  }

  const handleHolSubmit = async (e) => {
    e.preventDefault()
    if (!holTitle.trim()) {
      setHolError(isRu ? 'Название праздника обязательно' : 'Bayram nomi majburiy')
      return
    }
    if (!holDate) {
      setHolError(isRu ? 'Укажите дату' : 'Sanani kiriting')
      return
    }
    setHolSubmitting(true)
    setHolError('')
    try {
      const url = holEditing 
        ? `/api/holidays/${holEditing.id}` 
        : `/api/holidays`
      const method = holEditing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: holTitle.trim(),
          date: holDate,
          organization_id: holidayOrg === 'global' ? null : Number(holidayOrg),
          is_weekend: holIsWeekend
        })
      })
      const data = await res.json()
      if (data.ok) {
        toast.success(
          holEditing 
            ? (isRu ? 'Запись успешно обновлена' : 'Yozuv muvaffaqiyatli yangilandi')
            : (isRu ? 'Запись успешно создана' : 'Yozuv muvaffaqiyatli yaratildi')
        )
        setIsHolModalOpen(false)
        loadHolidays()
      } else {
        setHolError(data.detail || (isRu ? 'Ошибка при сохранении' : 'Saqlashda xatolik'))
      }
    } catch (err) {
      console.error(err)
      setHolError(isRu ? 'Сетевая ошибка' : 'Tarmoq xatoligi')
    } finally {
      setHolSubmitting(false)
    }
  }

  const handleBulkSubmit = async (e) => {
    e.preventDefault()
    setBulkSubmitting(true)
    setBulkError('')
    try {
      const res = await fetch('/api/schedules/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_ids: selectedIds.map(Number),
          schedule_id: bulkSelectSch ? Number(bulkSelectSch) : null,
          clear_overrides: bulkClearOver
        })
      })
      const data = await res.json()
      if (data.ok) {
        toast.success(isRu ? 'Смены успешно обновлены для выбранных профилей' : 'Tanlangan profillar smenalari muvaffaqiyatli almashtirildi')
        setIsBulkModalOpen(false)
        setSelectedIds([])
        loadEmployees()
      } else {
        setBulkError(data.detail || (isRu ? 'Ошибка при групповом изменении' : 'Bulk o\'zgartirishda xatolik'))
      }
    } catch (err) {
      console.error(err)
      setBulkError(isRu ? 'Сетевая ошибка' : 'Tarmoq xatoligi')
    } finally {
      setBulkSubmitting(false)
    }
  }

  // --- Delete Actions ---
  const handleDeleteSch = async (sch) => {
    const confirmed = await confirm({
      title: isRu ? 'Удалить смену' : 'Smenani o\'chirish',
      message: isRu 
        ? `Вы уверены, что хотите удалить смену "${sch.name}"?` 
        : `Haqiqatan ham "${sch.name}" smenasini o'chirmoqchimisiz?`,
      confirmText: isRu ? 'Удалить' : 'O\'chirish',
      danger: true
    })
    if (!confirmed) return
    try {
      const res = await fetch(`/api/schedules/${sch.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.ok) {
        toast.success(isRu ? 'Смена удалена' : 'Smena o\'chirildi')
        loadSchedules()
        loadEmployees()
      } else {
        toast.error(data.detail || (isRu ? 'Ошибка при удалении' : 'O\'chirishda xatolik'))
      }
    } catch (err) {
      console.error(err)
      toast.error(isRu ? 'Сетевая ошибка' : 'Tarmoq xatoligi')
    }
  }

  const handleDeleteHol = async (h) => {
    const isSuper = (currentUser?.role || '').toLowerCase().replace(/_/g, '') === 'superadmin'
    if (h.organization_id === null && !isSuper) {
      toast.error(isRu ? 'Вы не можете удалять глобальные праздники' : 'Siz global bayramlarni o\'chira olmaysiz')
      return
    }
    const confirmed = await confirm({
      title: isRu ? 'Удалить праздник/выходной' : 'Yozuvni o\'chirish',
      message: isRu 
        ? `Вы уверены, что хотите удалить "${h.title}" на ${h.date}?` 
        : `Haqiqatan ham ${h.date} dagi "${h.title}" yozuvini o'chirmoqchimisiz?`,
      confirmText: isRu ? 'Удалить' : 'O\'chirish',
      danger: true
    })
    if (!confirmed) return
    try {
      const res = await fetch(`/api/holidays/${h.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.ok) {
        toast.success(isRu ? 'Запись удалена' : 'Yozuv o\'chirildi')
        loadHolidays()
      } else {
        toast.error(data.detail || (isRu ? 'Ошибка при удалении' : 'O\'chirishda xatolik'))
      }
    } catch (err) {
      console.error(err)
      toast.error(isRu ? 'Сетевая ошибка' : 'Tarmoq xatoligi')
    }
  }

  // --- Attendance Monitor Run Action ---
  const handleRunMonitor = async () => {
    setMonitorRunning(true)
    try {
      const res = await fetch('/api/attendance-monitor/run', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        loadMonitorStatus()
        const result = data.result || {}
        toast.success(
          isRu 
            ? `Проверено: ${result.checked || 0} • Оповещено: ${result.notified || 0}`
            : `Tekshirildi: ${result.checked || 0} • Xabar yuborildi: ${result.notified || 0}`
        )
      } else {
        toast.error(data.detail || (isRu ? 'Не удалось запустить монитор' : 'Tekshirgichni ishga tushirib bo\'lmadi'))
      }
    } catch (e) {
      console.error(e)
      toast.error(isRu ? 'Ошибка при запуске монитора' : 'Tekshirgichni ishga tushirishda xatolik')
    } finally {
      setMonitorRunning(false)
    }
  }

  // --- Selection Helpers ---
  const allVisibleIds = employees.map(emp => emp.id)
  const isAllVisibleSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedIds.includes(id))

  const handleSelectAllVisible = () => {
    if (isAllVisibleSelected) {
      setSelectedIds(prev => prev.filter(id => !allVisibleIds.includes(id)))
    } else {
      setSelectedIds(prev => {
        const next = [...prev]
        allVisibleIds.forEach(id => {
          if (!next.includes(id)) next.push(id)
        })
        return next
      })
    }
  }

  const handleToggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  // --- Calendar Grid Generator ---
  const weekdays = isRu 
    ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
    : ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya']

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Days in current month
  const numDays = new Date(year, month + 1, 0).getDate()

  // Weekday of the first day (0 = Sun, 1 = Mon, ..., 6 = Sat)
  const firstDayIndex = new Date(year, month, 1).getDay()
  let startDay = firstDayIndex - 1 // Shift so Monday is 0
  if (startDay < 0) startDay = 6

  // Days from previous month
  const prevMonthNumDays = new Date(year, month, 0).getDate()

  const calendarCells = []

  // Add previous month days (pad the beginning)
  for (let i = startDay - 1; i >= 0; i--) {
    const d = prevMonthNumDays - i
    const prevDate = new Date(year, month - 1, d)
    calendarCells.push({
      day: d,
      date: prevDate,
      isCurrentMonth: false,
      dateStr: `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`
    })
  }

  // Add current month days
  for (let d = 1; d <= numDays; d++) {
    const currDate = new Date(year, month, d)
    calendarCells.push({
      day: d,
      date: currDate,
      isCurrentMonth: true,
      dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    })
  }

  // Add next month days (pad the end to make multiple of 7, 42 cells total)
  const remaining = 42 - calendarCells.length
  for (let d = 1; d <= remaining; d++) {
    const nextDate = new Date(year, month + 1, d)
    calendarCells.push({
      day: d,
      date: nextDate,
      isCurrentMonth: false,
      dateStr: `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`
    })
  }

  const renderCalendarView = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Weekday headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, textAlign: 'center', marginBottom: 4 }}>
          {weekdays.map((wd, i) => {
            const isWeekendHeader = i === 5 || i === 6
            return (
              <div 
                key={wd} 
                style={{ 
                  fontSize: 11, 
                  fontWeight: 700, 
                  color: isWeekendHeader ? '#f59e0b' : 'var(--text-4)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                {wd}
              </div>
            )
          })}
        </div>

        {/* Days grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
          {calendarCells.map((cell, idx) => {
            const isToday = new Date().toDateString() === cell.date.toDateString()
            const dayOfWeek = cell.date.getDay()
            const isStandardWeekend = dayOfWeek === 0 || dayOfWeek === 6

            // Filter holidays/weekends for this cell
            const cellHolidays = holidays.filter(h => h.date === cell.dateStr)
            const cellHoliday = cellHolidays.find(h => !h.is_weekend)
            const cellWeekend = cellHolidays.find(h => h.is_weekend)

            // Styling variables
            let bg = 'var(--bg)'
            let border = '1px solid var(--border-2)'
            let color = 'var(--text-1)'
            let titleText = cell.dateStr

            if (!cell.isCurrentMonth) {
              color = 'var(--text-4)'
              border = '1px solid transparent'
              bg = 'transparent'
            } else {
              if (cellHoliday) {
                bg = 'rgba(244, 63, 94, 0.12)'
                border = '1px solid var(--red)'
                color = 'var(--red)'
                titleText += ` • ${cellHoliday.title} (${isRu ? 'Праздник' : 'Bayram'})`
              } else if (cellWeekend) {
                bg = 'rgba(245, 158, 11, 0.12)'
                border = '1px solid #f59e0b'
                color = '#f59e0b'
                titleText += ` • ${cellWeekend.title} (${isRu ? 'Выходной' : 'Dam olish'})`
              } else if (isStandardWeekend) {
                bg = 'var(--surface-2)'
                border = '1px dashed var(--border-3)'
                color = 'var(--text-3)'
                titleText += ` • ${isRu ? 'Выходной день (Сб/Вс)' : 'Dam olish kuni (Sh/Ya)'}`
              }
              
              if (isToday) {
                border = '2px solid var(--accent)'
              }
            }

            // Click action
            const handleCellClick = () => {
              if (!cell.isCurrentMonth) return
              
              if (cellHoliday) {
                handleOpenHolModal(cellHoliday)
              } else if (cellWeekend) {
                handleOpenHolModal(cellWeekend)
              } else {
                // Pre-fill date and open empty holiday modal
                setHolEditing(null)
                setHolTitle('')
                setHolDate(cell.dateStr)
                setHolIsWeekend(isStandardWeekend)
                setHolError('')
                setIsHolModalOpen(true)
              }
            }

            return (
              <div
                key={`${cell.dateStr}-${idx}`}
                onClick={handleCellClick}
                title={titleText}
                style={{
                  aspectRatio: '1',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  background: bg,
                  border: border,
                  color: color,
                  fontSize: 13,
                  fontWeight: cell.isCurrentMonth ? 600 : 400,
                  cursor: cell.isCurrentMonth ? 'pointer' : 'default',
                  position: 'relative',
                  transition: 'all 0.15s ease',
                  opacity: cell.isCurrentMonth ? 1 : 0.45,
                }}
                onMouseEnter={e => {
                  if (cell.isCurrentMonth) {
                    e.currentTarget.style.transform = 'scale(1.05)'
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
                  }
                }}
                onMouseLeave={e => {
                  if (cell.isCurrentMonth) {
                    e.currentTarget.style.transform = 'none'
                    e.currentTarget.style.boxShadow = 'none'
                  }
                }}
              >
                {/* Day number */}
                <span>{cell.day}</span>

                {/* Indicators */}
                <div style={{ display: 'flex', gap: 3, position: 'absolute', bottom: 4 }}>
                  {cellHoliday && (
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--red)' }} />
                  )}
                  {cellWeekend && (
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#f59e0b' }} />
                  )}
                  {isToday && (
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)' }} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
        
        {/* Calendar Legend */}
        <div style={{ display: 'flex', gap: 12, justifycontent: 'center', justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-3)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)' }} />
            <span>{isRu ? 'Праздник' : 'Bayram'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-3)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
            <span>{isRu ? 'Выходной' : 'Dam olish'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-3)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
            <span>{isRu ? 'Сегодня' : 'Bugun'}</span>
          </div>
        </div>
      </div>
    )
  }

  // Common input/select CSS rules
  const inpStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--border-2)', background: 'var(--bg)',
    color: 'var(--text-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  }

  const selectStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--border-2)', background: 'var(--bg)',
    color: 'var(--text-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
    cursor: 'pointer'
  }

  return (
    <div className="sh-page-wrap" style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <style>{`
        .sh-page-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 24px 32px 80px;
        }
        .sh-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }
        .sh-main-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 24px;
          margin-bottom: 24px;
        }
        .sh-header-row {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
          background: var(--surface-2);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .sh-filter-bar {
          padding: 16px;
          border-bottom: 1px solid var(--border);
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          background: var(--surface-2);
        }
        .sh-bulk-bar {
          padding: 12px 16px;
          background: var(--bg);
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          animation: bfToastIn 0.2s ease;
        }
        .sh-form-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        @media (max-width: 900px) {
          .sh-header-row {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
          }
        }

        @media (max-width: 768px) {
          .sh-page-container {
            padding: 16px 16px 60px;
          }
          .sh-main-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
        }

        @media (max-width: 600px) {
          .sh-filter-bar {
            flex-direction: column;
            align-items: stretch;
          }
          .sh-filter-bar > div {
            width: 100% !important;
          }
          .sh-bulk-bar {
            flex-direction: column;
            align-items: stretch;
          }
        }

        @media (max-width: 480px) {
          .sh-form-grid-2 {
            grid-template-columns: 1fr;
            gap: 12px;
          }
        }
      `}</style>
      <PageHero
        badge={`✦ ${isRu ? 'Система' : 'Tizim'}`}
        title={isRu ? 'Смены' : 'Smenalar'}
        sub={isRu ? 'Персональные и организационные графики сотрудников и учащихся.' : 'Hodim va o\'quvchilarning shaxsiy, tayyor va tashkilot smenalari nazorati.'}
      />

      <div className="sh-page-container">
        
        {/* Stats Grid */}
        <div className="sh-stats-grid">
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <PeopleRegular /> {isRu ? 'Всего профилей' : 'Jami profillar'}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.total_employees || 0}</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <BuildingRegular /> {isRu ? 'Организации' : 'Tashkilotlar'}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.organization_count || 0}</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CalendarLtrRegular /> {isRu ? 'Выходные' : 'Dam olish kunlari'}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{holidays.length || 0}</div>
          </div>
        </div>

        <div className="sh-main-grid">
          
          {/* Schedule Manager */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
            <div className="sh-header-row" style={{ borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{isRu ? 'Управление сменами' : 'Smenalar boshqaruvi'}</h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-4)' }}>{isRu ? 'Графики организации' : 'Tashkilot grafiki'}</p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ width: 140 }}>
                  <CustomSelect 
                    value={scheduleOrg}
                    onChange={setScheduleOrg}
                    options={filterOptions.organizations.map(o => ({ label: o.name, value: o.id.toString() }))}
                    placeholder={isRu ? 'Организация' : 'Tashkilot'}
                  />
                </div>
                <button 
                  onClick={() => handleOpenSchModal()}
                  style={{ background: 'var(--accent)', border: 'none', color: '#fff', padding: '0 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <AddRegular />
                </button>
              </div>
            </div>
            <div style={{ padding: 20, flex: 1, overflowY: 'auto', minHeight: 200 }}>
              {scheduleLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-4)' }}><ArrowSyncRegular style={{ animation: 'spin 1s linear infinite', fontSize: 24 }} /></div>
              ) : schedules.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-4)' }}>{isRu ? 'Смены не найдены' : 'Smenalar topilmadi'}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {schedules.map(sch => (
                    <div key={sch.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{sch.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-4)' }}>{sch.start_time} - {sch.end_time} • {sch.is_flexible ? (isRu ? 'Свободный' : 'Erkin') : (isRu ? 'Фиксированный' : 'Qat\'iy')}</div>
                        <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <BuildingRegular style={{ fontSize: 12 }} />
                          <span>{selectedOrgName || (isRu ? 'Организация' : 'Tashkilot')}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                         <button 
                           onClick={() => handleOpenSchModal(sch)}
                           style={{ background: 'var(--surface)', border: '1px solid var(--border-3)', color: 'var(--text-1)', padding: 6, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                         >
                           <EditRegular />
                         </button>
                         <button 
                           onClick={() => handleDeleteSch(sch)}
                           style={{ background: 'var(--red-bg)', border: '1px solid var(--red-bd)', color: 'var(--red)', padding: 6, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                         >
                           <DeleteRegular />
                         </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Holiday Manager */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
            <div className="sh-header-row" style={{ borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{isRu ? 'Праздники и выходные' : 'Dam olish kunlari'}</h3>
                
                {/* Month navigation controls & toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button 
                      onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2 }}
                    >
                      <ChevronLeftRegular fontSize={14} />
                    </button>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', minWidth: 60, textAlign: 'center' }}>
                      {currentDate.getFullYear()}-{String(currentDate.getMonth()+1).padStart(2, '0')}
                    </span>
                    <button 
                      onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2 }}
                    >
                      <ChevronRightRegular fontSize={14} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', background: 'var(--bg)', border: '1px solid var(--border-2)', borderRadius: 6, padding: 2, marginLeft: 8 }}>
                    <button
                      type="button"
                      onClick={() => setHolidayViewMode('calendar')}
                      style={{
                        padding: '3px 8px',
                        fontSize: 10,
                        fontWeight: 600,
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        background: holidayViewMode === 'calendar' ? 'var(--accent)' : 'transparent',
                        color: holidayViewMode === 'calendar' ? '#fff' : 'var(--text-3)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {isRu ? 'Календарь' : 'Kalendar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setHolidayViewMode('list')}
                      style={{
                        padding: '3px 8px',
                        fontSize: 10,
                        fontWeight: 600,
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        background: holidayViewMode === 'list' ? 'var(--accent)' : 'transparent',
                        color: holidayViewMode === 'list' ? '#fff' : 'var(--text-3)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {isRu ? 'Список' : 'Ro\'yxat'}
                    </button>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ width: 140 }}>
                  <CustomSelect 
                    value={holidayOrg}
                    onChange={setHolidayOrg}
                    options={[
                      ...((currentUser?.role || '').toLowerCase().replace(/_/g, '') === 'superadmin'
                        ? [{ label: isRu ? 'Глобально' : 'Global bayramlar', value: 'global' }]
                        : []
                      ),
                      ...filterOptions.organizations.map(o => ({ label: o.name, value: o.id.toString() }))
                    ]}
                  />
                </div>
                <button 
                  onClick={() => handleOpenHolModal()}
                  style={{ background: 'var(--red)', border: 'none', color: '#fff', padding: '0 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <AddRegular />
                </button>
              </div>
            </div>
            <div style={{ padding: 20, flex: 1, overflowY: 'auto', minHeight: 200 }}>
              {holidayLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-4)' }}><ArrowSyncRegular style={{ animation: 'spin 1s linear infinite', fontSize: 24 }} /></div>
              ) : holidayViewMode === 'calendar' ? (
                renderCalendarView()
              ) : holidays.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-4)' }}>{isRu ? 'Записей нет' : 'Yozuvlar yo\'q'}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {holidays.map(h => (
                    <div key={h.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 8, background: h.is_weekend ? 'rgba(245,158,11,0.1)' : 'rgba(244,63,94,0.1)', color: h.is_weekend ? '#f59e0b' : '#f43f5e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CalendarLtrRegular />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{h.title}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-4)' }}>{h.date} • {h.is_weekend ? (isRu ? 'Выходной' : 'Dam olish') : (isRu ? 'Праздник' : 'Bayram')}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                         {((currentUser?.role || '').toLowerCase().replace(/_/g, '') === 'superadmin' || h.organization_id !== null) && (
                           <>
                             <button 
                               onClick={() => handleOpenHolModal(h)}
                               style={{ background: 'var(--surface)', border: '1px solid var(--border-3)', color: 'var(--text-1)', padding: 6, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                             >
                               <EditRegular />
                             </button>
                             <button 
                               onClick={() => handleDeleteHol(h)}
                               style={{ background: 'var(--red-bg)', border: '1px solid var(--red-bd)', color: 'var(--red)', padding: 6, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                             >
                               <DeleteRegular />
                             </button>
                           </>
                         )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Attendance Monitor Status and Runner Button */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)', borderBottomLeftRadius: 12, borderBottomRightRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: 'var(--text-2)', display: 'block' }}>
                  {isRu ? 'Проверка посещаемости' : 'Tekshirgich holati'}
                </span>
                <span style={{ color: 'var(--text-4)', fontSize: 11 }}>
                  {monitorStatus ? (
                    isRu 
                      ? `${monitorStatus.running ? 'Активен' : 'Отключен'} • Последний: ${monitorStatus.last_run_at || '-'}`
                      : `${monitorStatus.running ? 'Aktiv' : 'O\'chiq'} • Oxirgi run: ${monitorStatus.last_run_at || '-'}`
                  ) : (
                    isRu ? 'Загрузка...' : 'Yuklanmoqda...'
                  )}
                </span>
              </div>
              <button
                disabled={monitorRunning}
                onClick={handleRunMonitor}
                style={{
                  background: 'var(--accent)', border: 'none', color: '#fff', 
                  padding: '8px 16px', borderRadius: 8, cursor: monitorRunning ? 'not-allowed' : 'pointer', 
                  fontWeight: 600, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
                  opacity: monitorRunning ? 0.7 : 1
                }}
              >
                <ArrowSyncRegular style={{ animation: monitorRunning ? 'spin 1s linear infinite' : 'none' }} />
                {isRu ? 'Запустить' : 'Ishga tushirish'}
              </button>
            </div>
          </div>
        </div>



      </div>

      {/* --- MODALS --- */}
      
      {/* 1. Schedule Modal */}
      {isSchModalOpen && (
        <Modal 
          title={schEditing ? (isRu ? 'Редактировать смену' : 'Smenani tahrirlash') : (isRu ? 'Новая смена' : 'Yangi smena')} 
          onClose={() => setIsSchModalOpen(false)}
        >
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: 12,
            background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)',
            marginBottom: 16, fontSize: 12.5, color: 'var(--text-2)'
          }}>
            <BuildingRegular fontSize={18} style={{ color: 'var(--accent)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>
                {isRu ? `Организация: ${selectedOrgName}` : `Tashkilot: ${selectedOrgName}`}
              </span>
              <span>
                {isRu 
                  ? 'Вы управляете графиком времени и типом смены в этой форме.' 
                  : 'Tashkilot ichidagi smena nomi, vaqt oralig\'i va grafik turini shu blokda boshqarasiz.'
                }
              </span>
            </div>
          </div>

          <form onSubmit={handleSchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {schError && (
              <div style={{ color: '#f43f5e', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)', padding: 10, borderRadius: 8, fontSize: 13 }}>
                {schError}
              </div>
            )}

            <Field label={isRu ? 'Название смены' : 'Smena nomi'} required>
              <input 
                type="text" 
                value={schName} 
                onChange={e => setSchName(e.target.value)} 
                style={inpStyle} 
                placeholder={isRu ? 'Напр: Дневная смена' : 'Masalan: Kunduzgi smena'}
              />
            </Field>

            {/* Tashkilot tanlash — faqat yangi smena qo'shganda ko'rinadi */}
            {!schEditing && (
              <Field label={isRu ? 'Организация' : 'Tashkilot'} required>
                <select
                  value={schOrg}
                  onChange={e => setSchOrg(e.target.value)}
                  style={{ ...selectStyle, border: schOrg ? '1.5px solid var(--accent)' : '1px solid var(--border-2)' }}
                >
                  <option value="">{isRu ? '— Выберите организацию —' : '— Tashkilotni tanlang —'}</option>
                  {filterOptions.organizations.map(o => (
                    <option key={o.id} value={o.id.toString()}>{o.name}</option>
                  ))}
                </select>
              </Field>
            )}

            <div className="sh-form-grid-2">
              <Field label={isRu ? 'Время начала' : 'Boshlanish vaqti'} required>
                <input 
                  type="time" 
                  value={schStart} 
                  onChange={e => setSchStart(e.target.value)} 
                  style={inpStyle} 
                />
              </Field>
              <Field label={isRu ? 'Время окончания' : 'Tugash vaqti'} required>
                <input 
                  type="time" 
                  value={schEnd} 
                  onChange={e => setSchEnd(e.target.value)} 
                  style={inpStyle} 
                />
              </Field>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', margin: '4px 0 12px 0', fontSize: 13, userSelect: 'none' }}>
              <input 
                type="checkbox" 
                checked={schFlexible} 
                onChange={e => setSchFlexible(e.target.checked)} 
                style={{ cursor: 'pointer', width: 16, height: 16 }} 
              />
              <span style={{ fontWeight: 500, color: 'var(--text-1)' }}>
                {isRu ? 'Свободный график (без учета опозданий)' : 'Erkin grafik (kechikish hisoblanmaydi)'}
              </span>
            </label>

            <div style={{ height: 1, background: 'var(--border)', margin: '12px -24px' }} />

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                onClick={() => setIsSchModalOpen(false)} 
                style={{ padding: '9px 20px', borderRadius: 9, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
              >
                {isRu ? 'Отмена' : 'Bekor qilish'}
              </button>
              <button 
                type="submit" 
                disabled={schSubmitting}
                style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: schSubmitting ? 'not-allowed' : 'pointer', opacity: schSubmitting ? 0.8 : 1 }}
              >
                {schSubmitting ? (isRu ? 'Сохранение...' : 'Saqlanmoqda...') : (schEditing ? (isRu ? 'Обновить' : 'Yangilash') : (isRu ? 'Сохранить' : 'Saqlash'))}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 2. Holiday Modal */}
      {isHolModalOpen && (
        <Modal 
          title={holEditing ? (isRu ? 'Редактировать день' : 'Bayram/dam olishni tahrirlash') : (isRu ? 'Новый день' : 'Bayram/dam olish qo\'shish')} 
          onClose={() => setIsHolModalOpen(false)}
        >
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: 12,
            background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)',
            marginBottom: 16, fontSize: 12.5, color: 'var(--text-2)'
          }}>
            <CalendarLtrRegular fontSize={18} style={{ color: 'var(--red)' }} />
            <span>
              {isRu 
                ? `Уровень действия: ${holidayOrg === 'global' ? 'Глобально' : 'Только для выбранной организации'}` 
                : `Amal qilish darajasi: ${holidayOrg === 'global' ? 'Global bayramlar' : 'Faqatgina tanlangan tashkilot'}`
              }
            </span>
          </div>

          <form onSubmit={handleHolSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {holError && (
              <div style={{ color: '#f43f5e', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)', padding: 10, borderRadius: 8, fontSize: 13 }}>
                {holError}
              </div>
            )}

            <Field label={isRu ? 'Название праздника/события' : 'Bayram nomi'} required>
              <input 
                type="text" 
                value={holTitle} 
                onChange={e => setHolTitle(e.target.value)} 
                style={inpStyle} 
                placeholder={isRu ? 'Напр: День Независимости' : 'Masalan: Mustaqillik kuni'}
              />
            </Field>

            <div className="sh-form-grid-2">
              <Field label={isRu ? 'Дата' : 'Sana'} required>
                <input 
                  type="date" 
                  value={holDate} 
                  onChange={e => setHolDate(e.target.value)} 
                  style={inpStyle} 
                />
              </Field>
              <Field label={isRu ? 'Тип дня' : 'Kun turi'} required>
                <select 
                  value={holIsWeekend ? 'weekend' : 'holiday'} 
                  onChange={e => setHolIsWeekend(e.target.value === 'weekend')} 
                  style={selectStyle}
                >
                  <option value="holiday">{isRu ? 'Праздник' : 'Bayram'}</option>
                  <option value="weekend">{isRu ? 'Выходной' : 'Dam olish kuni'}</option>
                </select>
              </Field>
            </div>

            <div style={{ height: 1, background: 'var(--border)', margin: '12px -24px' }} />

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                onClick={() => setIsHolModalOpen(false)} 
                style={{ padding: '9px 20px', borderRadius: 9, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
              >
                {isRu ? 'Отмена' : 'Bekor qilish'}
              </button>
              <button 
                type="submit" 
                disabled={holSubmitting}
                style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: 'var(--red)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: holSubmitting ? 'not-allowed' : 'pointer', opacity: holSubmitting ? 0.8 : 1 }}
              >
                {holSubmitting ? (isRu ? 'Сохранение...' : 'Saqlanmoqda...') : (holEditing ? (isRu ? 'Обновить' : 'Yangilash') : (isRu ? 'Сохранить' : 'Saqlash'))}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 3. Bulk Schedule Modal */}
      {isBulkModalOpen && (
        <Modal 
          title={isRu ? 'Групповое изменение смены' : 'Bulk smena almashtirish'} 
          onClose={() => setIsBulkModalOpen(false)}
        >
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: 12,
            background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)',
            marginBottom: 16, fontSize: 12.5, color: 'var(--text-2)'
          }}>
            <PeopleRegular fontSize={18} style={{ color: 'var(--accent)' }} />
            <span>
              {isRu 
                ? `Выбрано профилей: ${selectedIds.length} • Организация: ${employees.find(e => selectedIds.includes(e.id))?.organization_name || '-'}` 
                : `Tanlangan profillar soni: ${selectedIds.length} ta • Tashkilot: ${employees.find(e => selectedIds.includes(e.id))?.organization_name || '-'}`
              }
            </span>
          </div>

          <form onSubmit={handleBulkSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {bulkError && (
              <div style={{ color: '#f43f5e', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)', padding: 10, borderRadius: 8, fontSize: 13 }}>
                {bulkError}
              </div>
            )}

            <Field label={isRu ? 'Выберите новую смену' : 'Yangi smena'} required>
              <select 
                value={bulkSelectSch} 
                onChange={e => setBulkSelectSch(e.target.value)} 
                style={selectStyle}
              >
                <option value="">{isRu ? 'Сбросить на настройки организации' : 'Tashkilot defaultiga qaytarish'}</option>
                {schedules.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name} — {item.start_time}-{item.end_time} {item.is_flexible ? `(${isRu ? 'Свободный' : 'Erkin'})` : ''}
                  </option>
                ))}
              </select>
            </Field>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', margin: '4px 0 12px 0', fontSize: 13, userSelect: 'none' }}>
              <input 
                type="checkbox" 
                checked={bulkClearOver} 
                onChange={e => setBulkClearOver(e.target.checked)} 
                style={{ cursor: 'pointer', width: 16, height: 16 }} 
              />
              <span style={{ fontWeight: 500, color: 'var(--text-1)' }}>
                {isRu 
                  ? 'Сбросить персональные настройки времени и применить принудительно' 
                  : 'Shaxsiy vaqt override\'larini tozalab, yangi smenani majburan qo\'llash'
                }
              </span>
            </label>

            <div style={{ height: 1, background: 'var(--border)', margin: '12px -24px' }} />

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                onClick={() => setIsBulkModalOpen(false)} 
                style={{ padding: '9px 20px', borderRadius: 9, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
              >
                {isRu ? 'Отмена' : 'Bekor qilish'}
              </button>
              <button 
                type="submit" 
                disabled={bulkSubmitting}
                style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: bulkSubmitting ? 'not-allowed' : 'pointer', opacity: bulkSubmitting ? 0.8 : 1 }}
              >
                {bulkSubmitting ? (isRu ? 'Применение...' : 'Qo\'llanilmoqda...') : (isRu ? 'Применить' : 'Qo\'llash')}
              </button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  )
}

// --- Local Helpers ---

function Modal({ title, onClose, children }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16, backdropFilter: 'blur(4px)',
        animation: 'fadeInOverlay 0.15s ease'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, padding: 24, maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 10px 35px rgba(0,0,0,0.25)',
          animation: 'slideUpDialog 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>{title}</h3>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <DismissRegular fontSize={20} />
          </button>
        </div>
        {children}
      </div>

      <style>{`
        @keyframes fadeInOverlay { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUpDialog { from { opacity: 0; transform: scale(0.95) translateY(10px) } to { opacity: 1; transform: scale(1) translateY(0) } }
      `}</style>
    </div>
  )
}

function Field({ label, hint, required, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}{required && <span style={{ color: '#f43f5e' }}> *</span>}
      </span>
      {children}
      {hint && <span style={{ fontSize: 10, color: 'var(--text-4)' }}>{hint}</span>}
    </label>
  )
}
