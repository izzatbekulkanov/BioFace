import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ClipboardTaskListLtrRegular,
  ArrowSyncRegular,
  PersonRegular,
  CameraRegular,
  CalendarRegular,
  BuildingRegular,
  CheckmarkCircleRegular,
  QuestionCircleRegular,
  EyeRegular,
  ClockRegular,
  DismissCircleRegular,
  ArrowDownRegular,
  ArrowUpRegular,
  PhoneRegular,
  LocationRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import Skeleton from '../components/Skeleton'
import { useToast } from '../components/Toaster'
import CustomSelect from '../components/CustomSelect'

/**
 * Davomat sahifasi.
 *
 * Backend endpointlari:
 *   GET /api/attendance?limit=&organization_id=&camera_id=&today_only=&after_id=
 *   GET /api/attendance/filter-data  -> { organizations, cameras }
 *
 * Sahifa imkoniyatlari:
 *   • Tashkilot va kamera bo'yicha filter
 *   • "Faqat bugun" / barcha vaqtlar
 *   • Personal ID yoki ism bo'yicha qidiruv (frontda)
 *   • Snapshot preview lightbox
 *   • Avtomatik 5s polling (silent) — yangi yozuvlar yuqoriga qo'shiladi
 *   • Pastki "Yana yuklash" — eski yozuvlar
 */
export default function Attendance() {
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const toast = useToast()

  const [items, setItems] = useState([])
  const [orgs, setOrgs] = useState([])
  const [branches, setBranches] = useState([])
  const [cameras, setCameras] = useState([])
  const [schedules, setSchedules] = useState([])

  const [totalCount, setTotalCount] = useState(0)
  const [knownCount, setKnownCount] = useState(0)
  const [unknownCount, setUnknownCount] = useState(0)
  const [todayStats, setTodayStats] = useState({
    total_employees: 0,
    present_today: 0,
    absent_today: 0,
    late_today: 0,
  })

  const [orgFilter, setOrgFilter] = useState('all')
  const [branchFilter, setBranchFilter] = useState('all')
  const [camFilter, setCamFilter] = useState('all')
  const [employeeTypeFilter, setEmployeeTypeFilter] = useState('all')
  const [shiftFilter, setShiftFilter] = useState('all')
  const [todayOnly, setTodayOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [isSuperAdmin, setIsSuperAdmin] = useState(true) // default true, keyin aniqlanadi

  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [lightbox, setLightbox] = useState(null)

  const aliveRef = useRef(true)
  const lastIdRef = useRef(0)         // eng yangi ID, polling uchun
  const oldestIdRef = useRef(null)    // eng eski ID, "yana yuklash" uchun
  const reachedEndRef = useRef(false)

  const loadFilters = useCallback(async () => {
    try {
      const [filterRes, meRes] = await Promise.all([
        fetch('/api/attendance/filter-data', { credentials: 'include' }),
        fetch('/api/auth/me', { credentials: 'include' }),
      ])
      if (!filterRes.ok) return
      const data = await filterRes.json()
      const meData = meRes.ok ? await meRes.json() : {}

      const role = String(meData.role || '').toLowerCase()
      const superAdmin = role === 'super_admin' || role === 'superadmin'
      setIsSuperAdmin(superAdmin)

      const orgList = Array.isArray(data?.organizations) ? data.organizations : []
      const branchList = Array.isArray(data?.branches) ? data.branches : []
      const camList = Array.isArray(data?.cameras) ? data.cameras : []
      const schedList = Array.isArray(data?.schedules) ? data.schedules : []

      if (aliveRef.current) {
        setOrgs(orgList)
        setBranches(branchList)
        setCameras(camList)
        setSchedules(schedList)
        // Agar faqat 1 ta tashkilot bo'lsa, avtomatik tanlash
        if (!superAdmin && orgList.length === 1) {
          setOrgFilter(String(orgList[0].id))
        }
      }
    } catch {
      // silent
    }
  }, [])

  // Asosiy / qayta yuklash (filtr o'zgarganda)
  const loadInitial = useCallback(async () => {
    setRefreshing(true)
    setError('')
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (orgFilter !== 'all') params.set('organization_id', orgFilter)
      if (branchFilter !== 'all') params.set('branch_id', branchFilter)
      if (camFilter !== 'all') params.set('camera_id', camFilter)
      if (employeeTypeFilter !== 'all') params.set('employee_type', employeeTypeFilter)
      if (shiftFilter !== 'all') params.set('schedule_id', shiftFilter)
      if (todayOnly) params.set('today_only', 'true')

      const res = await fetch(`/api/attendance?${params}`, { credentials: 'include' })
      if (!res.ok) {
        if (res.status === 401) throw new Error(isRu ? 'Не авторизован' : 'Avtorizatsiya talab qilinadi')
        throw new Error(`HTTP ${res.status}`)
      }
      const data = await res.json()
      const list = Array.isArray(data?.items) ? data.items : []
      if (aliveRef.current) {
        setItems(list)
        setTotalCount(data?.total || list.length)
        setKnownCount(data?.known || list.filter(x => x.employee_id != null).length)
        setUnknownCount(data?.unknown || list.filter(x => x.employee_id == null).length)
        if (data?.today_stats) {
          setTodayStats(data.today_stats)
        }
        lastIdRef.current = Number(data?.last_id || (list[0]?.id || 0))
        oldestIdRef.current = list.length ? Number(list[list.length - 1].id) : null
        reachedEndRef.current = list.length < 100
      }
    } catch (e) {
      if (aliveRef.current) setError(e.message)
    } finally {
      if (aliveRef.current) {
        setInitialLoading(false)
        setRefreshing(false)
      }
    }
  }, [orgFilter, branchFilter, camFilter, employeeTypeFilter, shiftFilter, todayOnly, isRu])

  // Polling — yangi yozuvlar
  const pollNew = useCallback(async () => {
    if (!lastIdRef.current) return
    try {
      const params = new URLSearchParams({ limit: '50', after_id: String(lastIdRef.current) })
      if (orgFilter !== 'all') params.set('organization_id', orgFilter)
      if (branchFilter !== 'all') params.set('branch_id', branchFilter)
      if (camFilter !== 'all') params.set('camera_id', camFilter)
      if (employeeTypeFilter !== 'all') params.set('employee_type', employeeTypeFilter)
      if (shiftFilter !== 'all') params.set('schedule_id', shiftFilter)
      if (todayOnly) params.set('today_only', 'true')

      const res = await fetch(`/api/attendance?${params}`, { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      const fresh = Array.isArray(data?.items) ? data.items : []
      if (!fresh.length) return

      // /api/attendance after_id rejimida ASC qaytaradi: tepaga qo'shish uchun reverse qilamiz
      const newIds = new Set(fresh.map(x => x.id))
      if (aliveRef.current) {
        setItems(prev => {
          const filtered = prev.filter(x => !newIds.has(x.id))
          return [...fresh.slice().reverse(), ...filtered]
        })
        if (data?.total !== undefined) {
          setTotalCount(data.total)
          setKnownCount(data.known)
          setUnknownCount(data.unknown)
        }
        if (data?.today_stats) {
          setTodayStats(data.today_stats)
        }
        const maxId = Number(data?.last_id || fresh[fresh.length - 1].id)
        if (maxId > lastIdRef.current) lastIdRef.current = maxId
      }
    } catch {
      // silent
    }
  }, [orgFilter, branchFilter, camFilter, employeeTypeFilter, shiftFilter, todayOnly])

  // Eski yozuvlarni yuklash (pagination)
  const loadMore = useCallback(async () => {
    if (loadingMore || reachedEndRef.current || !oldestIdRef.current) return
    setLoadingMore(true)
    try {
      const before = oldestIdRef.current
      const params = new URLSearchParams({ limit: '100', before_id: String(before) })
      if (orgFilter !== 'all') params.set('organization_id', orgFilter)
      if (branchFilter !== 'all') params.set('branch_id', branchFilter)
      if (camFilter !== 'all') params.set('camera_id', camFilter)
      if (employeeTypeFilter !== 'all') params.set('employee_type', employeeTypeFilter)
      if (shiftFilter !== 'all') params.set('schedule_id', shiftFilter)
      if (todayOnly) params.set('today_only', 'true')
      const res = await fetch(`/api/attendance?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const list = Array.isArray(data?.items) ? data.items : []
      if (aliveRef.current) {
        if (!list.length) {
          reachedEndRef.current = true
          toast.info(isRu ? 'Больше записей нет' : "Yana yozuvlar yo'q")
        } else {
          setItems(prev => [...prev, ...list])
          oldestIdRef.current = Number(list[list.length - 1].id)
          reachedEndRef.current = list.length < 100
        }
      }
    } catch (e) {
      toast.error(e.message)
    } finally {
      if (aliveRef.current) setLoadingMore(false)
    }
  }, [loadingMore, orgFilter, branchFilter, camFilter, employeeTypeFilter, shiftFilter, todayOnly, toast, isRu])

  // Mount
  useEffect(() => {
    aliveRef.current = true
    loadFilters()
    return () => { aliveRef.current = false }
  }, [loadFilters])

  // Filtr o'zgarsa qaytadan
  useEffect(() => {
    setInitialLoading(true)
    setItems([])
    lastIdRef.current = 0
    oldestIdRef.current = null
    reachedEndRef.current = false
    loadInitial()
  }, [loadInitial])

  // Polling
  useEffect(() => {
    const id = setInterval(pollNew, 5000)
    return () => clearInterval(id)
  }, [pollNew])

  // Filtrlash
  const branchesByOrg = useMemo(() => {
    if (orgFilter === 'all') return branches
    return branches.filter(b => String(b.organization_id) === String(orgFilter))
  }, [branches, orgFilter])

  const camerasByOrgAndBranch = useMemo(() => {
    let list = cameras
    if (orgFilter !== 'all') {
      list = list.filter(c => String(c.organization_id) === String(orgFilter))
    }
    if (branchFilter !== 'all') {
      list = list.filter(c => String(c.branch_id) === String(branchFilter))
    }
    return list
  }, [cameras, orgFilter, branchFilter])

  const schedulesByOrg = useMemo(() => {
    if (orgFilter === 'all') return schedules
    return schedules.filter(s => String(s.organization_id) === String(orgFilter))
  }, [schedules, orgFilter])

  const orgOptions = useMemo(() => [
    { value: 'all', label: isRu ? 'Все организации' : 'Hamma tashkilotlar' },
    ...orgs.map(o => ({ value: String(o.id), label: o.name }))
  ], [orgs, isRu])

  const branchOptions = useMemo(() => [
    { value: 'all', label: isRu ? 'Все филиалы' : 'Hamma filiallar' },
    ...branchesByOrg.map(b => ({ value: String(b.id), label: b.name }))
  ], [branchesByOrg, isRu])

  const camOptions = useMemo(() => [
    { value: 'all', label: isRu ? 'Все камеры' : 'Hamma kameralar' },
    ...camerasByOrgAndBranch.map(c => ({ value: String(c.id), label: c.name }))
  ], [camerasByOrgAndBranch, isRu])

  const employeeTypeOptions = useMemo(() => [
    { value: 'all', label: isRu ? 'Все типы' : 'Barcha turlar' },
    { value: 'hodim', label: isRu ? 'Сотрудник' : 'Hodim' },
    { value: 'oqituvchi', label: isRu ? 'Учитель' : "O'qituvchi" },
    { value: 'oquvchi', label: isRu ? 'Ученик' : "O'quvchi" },
    { value: 'talaba', label: isRu ? 'Студент' : 'Talaba' },
  ], [isRu])

  const shiftOptions = useMemo(() => [
    { value: 'all', label: isRu ? 'Все смены' : 'Barcha smenalar' },
    ...schedulesByOrg.map(s => ({ value: String(s.id), label: s.name }))
  ], [schedulesByOrg, isRu])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(it => {
      const haystack = [
        it.employee_name, it.person_name, it.personal_id,
        it.camera_name, it.organization_name,
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [items, search])

  // Statistika
  const stats = useMemo(() => {
    const known = items.filter(i => i.employee_id != null).length
    const unknown = items.length - known
    return { total: items.length, known, unknown }
  }, [items])

  const showSkeleton = initialLoading && items.length === 0

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={isRu ? '✦ Посещаемость' : '✦ Davomat'}
        title={isRu ? 'Журнал посещаемости' : 'Davomat jurnali'}
        sub={isRu ? 'Все события распознавания лиц' : "Yuz tanish hodisalari ro'yxati"}
        right={
          <button
            onClick={loadInitial}
            disabled={refreshing || initialLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 16px', borderRadius: 8,
              background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)',
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: (refreshing || initialLoading) ? 'not-allowed' : 'pointer',
              opacity: (refreshing || initialLoading) ? 0.6 : 1,
            }}
          >
            <ArrowSyncRegular fontSize={16} style={{ animation: (refreshing || initialLoading) ? 'spin 1s linear infinite' : 'none' }} />
            {isRu ? 'Обновить' : 'Yangilash'}
          </button>
        }
      />

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulse-opacity {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        .shimmer-bar {
          background: linear-gradient(90deg, var(--bg) 25%, var(--border-2) 50%, var(--bg) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite linear;
        }
        .pulse-text {
          animation: pulse-opacity 1.5s infinite ease-in-out;
        }
        .attendance-container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 24px 32px 80px;
        }
        .attendance-toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: flex-end;
        }
        @media (max-width: 768px) {
          .attendance-container {
            padding: 16px 16px 60px !important;
          }
          .attendance-card {
            padding: 16px !important;
          }
          .attendance-toolbar {
            flex-direction: column;
            align-items: stretch !important;
          }
          .attendance-toolbar > div,
          .attendance-toolbar > label {
            flex: 1 1 100% !important;
            width: 100% !important;
          }
        }
      `}</style>

      <div className="attendance-container">
        {error && (
          <div style={errBannerStyle}>{error}</div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
          <StatCard icon={<PersonRegular />} label={isRu ? 'Всего сотрудников' : 'Jami xodimlar'} value={todayStats.total_employees} color="var(--accent)" bg="var(--accent-bg)" border="var(--accent-bd)" />
          <StatCard icon={<CheckmarkCircleRegular />} label={isRu ? 'Пришли' : 'Kelganlar'} value={todayStats.present_today} color="var(--green)" bg="var(--green-bg)" border="var(--green-bd)" />
          <StatCard icon={<DismissCircleRegular />} label={isRu ? 'Не пришли' : 'Kelmaganlar'} value={todayStats.absent_today} color="var(--red)" bg="var(--red-bg)" border="var(--red-bd)" />
          <StatCard icon={<ClockRegular />} label={isRu ? 'Опоздали' : 'Kechikkanlar'} value={todayStats.late_today} color="var(--yellow)" bg="var(--yellow-bg)" border="var(--yellow-bd)" />
        </div>

        {/* Toolbar */}
        <div className="attendance-card" style={{ ...cardStyle, marginBottom: 20 }}>
          <div className="attendance-toolbar">
            <div style={{ flex: '1 1 240px', minWidth: 200 }}>
              <FieldLabel>{isRu ? 'Поиск' : 'Qidiruv'}</FieldLabel>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={isRu ? 'Имя, ID, камера...' : 'Ism, ID, kamera...'}
                style={inpStyle}
              />
            </div>

            {/* Tashkilot filtri — faqat super admin yoki ko'p tashkilot uchun */}
            {(isSuperAdmin || orgs.length > 1) && (
              <div style={{ flex: '1 1 200px' }}>
                <FieldLabel>{isRu ? 'Организация' : 'Tashkilot'}</FieldLabel>
                <CustomSelect
                  value={orgFilter}
                  onChange={val => { setOrgFilter(val); setBranchFilter('all'); setCamFilter('all') }}
                  options={orgOptions}
                  placeholder={isRu ? 'Все организации' : 'Hamma tashkilotlar'}
                />
              </div>
            )}
            {/* Yagona tashkilot nomi ko'rinishi */}
            {!isSuperAdmin && orgs.length === 1 && (
              <div style={{ flex: '1 1 200px' }}>
                <FieldLabel>{isRu ? 'Организация' : 'Tashkilot'}</FieldLabel>
                <div style={{ ...inpStyle, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-1)', fontWeight: 600, cursor: 'default' }}>
                  <BuildingRegular fontSize={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  {orgs[0].name}
                </div>
              </div>
            )}

            {/* Filial filtri */}
            <div style={{ flex: '1 1 180px' }}>
              <FieldLabel>{isRu ? 'Филиал' : 'Filial'}</FieldLabel>
              <CustomSelect
                value={branchFilter}
                onChange={val => { setBranchFilter(val); setCamFilter('all') }}
                options={branchOptions}
                placeholder={isRu ? 'Все филиалы' : 'Hamma filiallar'}
              />
            </div>

            <div style={{ flex: '1 1 180px' }}>
              <FieldLabel>{isRu ? 'Камера' : 'Kamera'}</FieldLabel>
              <CustomSelect
                value={camFilter}
                onChange={setCamFilter}
                options={camOptions}
                placeholder={isRu ? 'Все камеры' : 'Hamma kameralar'}
              />
            </div>

            <div style={{ flex: '1 1 180px' }}>
              <FieldLabel>{isRu ? 'Тип' : 'Turi'}</FieldLabel>
              <CustomSelect
                value={employeeTypeFilter}
                onChange={setEmployeeTypeFilter}
                options={employeeTypeOptions}
                placeholder={isRu ? 'Все типы' : 'Barcha turlar'}
              />
            </div>

            <div style={{ flex: '1 1 180px' }}>
              <FieldLabel>{isRu ? 'Смена' : 'Smena'}</FieldLabel>
              <CustomSelect
                value={shiftFilter}
                onChange={setShiftFilter}
                options={shiftOptions}
                placeholder={isRu ? 'Все смены' : 'Barcha smenalar'}
              />
            </div>

            <label style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 12px', borderRadius: 8,
              background: todayOnly ? 'var(--accent-bg)' : 'var(--bg)',
              border: `1px solid ${todayOnly ? 'var(--accent-bd)' : 'var(--border-2)'}`,
              cursor: 'pointer', fontSize: 13, color: 'var(--text-1)', fontWeight: 600,
              height: 36, boxSizing: 'border-box',
            }}>
              <input
                type="checkbox"
                checked={todayOnly}
                onChange={e => setTodayOnly(e.target.checked)}
                style={{ accentColor: 'var(--accent)', width: 14, height: 14 }}
              />
              <CalendarRegular fontSize={14} />
              {isRu ? 'Только сегодня' : 'Faqat bugun'}
            </label>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-4)' }}>
            {search.trim() ? (
              isRu 
                ? `Найдено: ${filtered.length} из ${totalCount} записей (Загружено: ${items.length})`
                : `Topildi: ${filtered.length} / ${totalCount} yozuv (Yuklangan: ${items.length})`
            ) : (
              isRu
                ? `Показано: ${items.length} из ${totalCount} записей`
                : `Ko'rsatilmoqda: ${items.length} / ${totalCount} yozuv`
            )}
          </div>
        </div>

        {/* Table */}
        <div className="attendance-card" style={cardStyle}>
          {showSkeleton ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: 8 }).map((_, i) => <Skeleton.Row key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={emptyStyle}>
              {items.length === 0
                ? (isRu ? 'Записей посещаемости пока нет.' : "Davomat yozuvlari hali yo'q.")
                : (isRu ? 'Ничего не найдено.' : "Hech narsa topilmadi.")}
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      {[
                        '№',
                        isRu ? 'Время' : 'Vaqt',
                        isRu ? 'Сотрудник' : 'Xodim',
                        isRu ? 'ID' : 'ID',
                        isRu ? 'Направление' : 'Yo\'nalish',
                        isRu ? 'Камера' : 'Kamera',
                        isRu ? 'Организация' : 'Tashkilot',
                        isRu ? 'Статус' : 'Holat',
                        isRu ? 'Стресс' : 'Stress',
                        isRu ? 'Снимок' : 'Snapshot',
                      ].map((h, i) => <th key={i} style={thStyle}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((it, idx) => (
                      <tr key={it.id}>
                        <td style={tdStyle}>
                          <span style={{ fontWeight: 600, color: 'var(--text-4)' }}>{idx + 1}</span>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--accent, #4f46e5)', letterSpacing: '0.5px' }}>{formatTime(it.timestamp)}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-4)', marginTop: '2px' }}>{formatDate(it.timestamp)}</div>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={avatarFallback}><PersonRegular fontSize={16} /></div>
                            <div>
                              {it.employee_id ? (
                                <Link
                                  to={`/employees/${it.employee_uuid || it.employee_id}`}
                                  state={{ from: '/attendance' }}
                                  style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}
                                >
                                  {it.employee_name || it.person_name || (isRu ? 'Сотрудник' : 'Xodim')}
                                </Link>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontWeight: 600 }}>
                                    {it.employee_name || it.person_name || (isRu ? 'Неизвестный' : "Noma'lum")}
                                  </span>
                                  {it.person_name && it.person_name !== "Noma'lum" && (
                                    <Link
                                      to={`/users/staff/new?snapshot_url=${encodeURIComponent(it.snapshot_url || '')}&name=${encodeURIComponent(it.person_name)}`}
                                      style={saveBtnStyle}
                                      title={isRu ? 'Добавить в базу' : "Bazaga qo'shish"}
                                      onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-h)'}
                                      onMouseLeave={e => e.currentTarget.style.background = 'var(--accent)'}
                                    >
                                      {isRu ? 'Сохранить' : 'Saqlash'}
                                    </Link>
                                  )}
                                </div>
                              )}
                              {it.person_name && it.person_name !== it.employee_name && (
                                <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>{it.person_name}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <code style={{ fontSize: 12, color: 'var(--text-1)' }}>{it.personal_id || '—'}</code>
                        </td>
                        <td style={tdStyle}>
                          <DirectionPill direction={it.direction} isRu={isRu} />
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                            {it.direction === 'mobile' ? (
                              <PhoneRegular fontSize={13} style={{ color: '#3b82f6' }} />
                            ) : (
                              <CameraRegular fontSize={13} style={{ color: 'var(--text-4)' }} />
                            )}
                            {it.camera_name || it.camera_isup_device_id || '—'}
                            {it.direction === 'mobile' && it.latitude && it.longitude && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${it.latitude},${it.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  color: '#3b82f6',
                                  marginLeft: 6,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  cursor: 'pointer',
                                }}
                                title={isRu ? 'Показать на карте' : "Xaritada ko'rsatish"}
                              >
                                <LocationRegular fontSize={13} />
                              </a>
                            )}
                          </div>
                          {it.camera_mac && (
                            <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2, fontFamily: 'monospace' }}>{it.camera_mac}</div>
                          )}
                        </td>
                        <td style={tdStyle}>
                          {it.organization_name ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                              <BuildingRegular fontSize={13} style={{ color: 'var(--text-4)' }} />
                              {it.organization_name}
                            </div>
                          ) : <span style={{ color: 'var(--text-4)' }}>—</span>}
                        </td>
                        <td style={tdStyle}>
                          <StatusPill status={it.status} hasEmployee={it.employee_id != null} isRu={isRu} />
                        </td>

                        <td style={tdStyle}>
                          {it.stress_score != null && Math.round(it.stress_score) > 0 ? (() => {
                            const stressScore = Math.round(it.stress_score)
                            const stressColor = stressScore <= 35 ? '#10b981' : stressScore <= 70 ? '#f59e0b' : '#f43f5e'
                            const stressStatusText = isRu ? it.stress_status_ru : it.stress_status_uz
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 95 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                                  <span style={{ fontWeight: 600, color: stressColor }}>{stressStatusText}</span>
                                  <span style={{ fontWeight: 700, color: 'var(--text-2)' }}>{stressScore}%</span>
                                </div>
                                <div style={{ height: 5, background: 'var(--bg)', borderRadius: 999, border: '1px solid var(--border)', overflow: 'hidden' }}>
                                  <div style={{ width: `${stressScore}%`, height: '100%', background: stressColor, borderRadius: 999 }} />
                                </div>
                              </div>
                            )
                          })() : (
                            <div className="pulse-text" style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 95 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-4)' }}>
                                  {isRu ? 'Определяется...' : 'Aniqlanmoqda...'}
                                </span>
                              </div>
                              <div style={{ height: 5, background: 'var(--bg)', borderRadius: 999, border: '1px solid var(--border)', overflow: 'hidden' }}>
                                <div className="shimmer-bar" style={{ width: '100%', height: '100%', borderRadius: 999 }} />
                              </div>
                            </div>
                          )}
                        </td>
                        <td style={tdStyle}>
                          {it.snapshot_url ? (
                            <button
                              onClick={() => setLightbox(it)}
                              title={isRu ? 'Открыть снимок' : 'Snapshot ochish'}
                              style={{
                                width: 44, height: 44, borderRadius: 6,
                                padding: 0, border: '1px solid var(--border-2)',
                                background: 'var(--bg)', cursor: 'pointer', overflow: 'hidden',
                                position: 'relative',
                              }}
                            >
                              <img
                                src={it.snapshot_url}
                                alt=""
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                onError={e => { e.currentTarget.style.display = 'none' }}
                              />
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-4)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Load more */}
              {!reachedEndRef.current && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '8px 18px', borderRadius: 8,
                      background: 'var(--accent-bg)', color: 'var(--accent-tx)',
                      border: '1px solid var(--accent-bd)',
                      fontSize: 13, fontWeight: 600,
                      cursor: loadingMore ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {loadingMore && <ArrowSyncRegular fontSize={14} style={{ animation: 'spin 1s linear infinite' }} />}
                    {isRu ? 'Загрузить ещё' : 'Yana yuklash'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && lightbox.snapshot_url && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9998,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 32, cursor: 'zoom-out',
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', textAlign: 'center' }}>
            <img src={lightbox.snapshot_url} alt="" style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 12 }} />
            <div style={{ marginTop: 12, color: '#fff', fontSize: 13 }}>
              <div style={{ fontWeight: 700 }}>{lightbox.employee_name || lightbox.person_name || (isRu ? 'Неизвестный' : "Noma'lum")}</div>
              <div style={{ opacity: 0.7, marginTop: 4 }}>
                {formatTime(lightbox.timestamp)} · {formatDate(lightbox.timestamp)}
                {lightbox.camera_name && <> · {lightbox.camera_name}</>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function formatTime(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return iso
  }
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return ''
  }
}

function StatCard({ icon, label, value, color, bg, border }) {
  return (
    <div style={{ padding: 14, background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: 40, height: 40, borderRadius: 9,
        background: bg || (color + '22'), 
        color, 
        border: `1px solid ${border || (color + '55')}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', marginTop: 2 }}>{value}</div>
      </div>
    </div>
  )
}

function StatusPill({ status, hasEmployee, isRu }) {
  const statusStr = String(status || '').toLowerCase()
  let tone
  if (statusStr === 'kech') {
    tone = {
      bg: 'rgba(247, 108, 12, 0.1)',
      color: '#f76c0c',
      border: 'rgba(247, 108, 12, 0.25)',
      icon: <ClockRegular fontSize={12} />,
      text: isRu ? 'Опоздал' : 'Kech qoldi'
    }
  } else if (statusStr === 'kelmagan') {
    tone = {
      bg: 'rgba(232, 17, 35, 0.1)',
      color: '#e81123',
      border: 'rgba(232, 17, 35, 0.25)',
      icon: <DismissCircleRegular fontSize={12} />,
      text: isRu ? 'Не пришел' : 'Kelmagan'
    }
  } else {
    const isKnown = hasEmployee || statusStr.includes('aniq')
    tone = isKnown
      ? { bg: 'var(--green-bg)', color: 'var(--green)', border: 'var(--green-bd)', icon: <CheckmarkCircleRegular fontSize={12} />, text: isRu ? 'Распознан' : 'Aniqlandi' }
      : { bg: 'var(--yellow-bg)', color: 'var(--yellow)', border: 'var(--yellow-bd)', icon: <QuestionCircleRegular fontSize={12} />, text: isRu ? 'Неизвестный' : "Noma'lum" }
  }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 9px', borderRadius: 999,
      background: tone.bg, color: tone.color,
      fontSize: 11, fontWeight: 600,
      border: `1px solid ${tone.border}`,
    }}>{tone.icon}{tone.text}</span>
  )
}

function DirectionPill({ direction, isRu }) {
  const dir = String(direction || '').toLowerCase().trim()
  let bg = 'rgba(100, 116, 139, 0.1)'
  let color = 'var(--text-3)'
  let border = 'var(--border-2)'
  let text = isRu ? 'Неизвестно' : "Noma'lum"
  let icon = <ArrowSyncRegular fontSize={12} />

  if (dir === 'in') {
    bg = 'var(--green-bg)'
    color = 'var(--green)'
    border = 'var(--green-bd)'
    text = isRu ? 'Вход (Keldi)' : 'Kirish (Keldi)'
    icon = <ArrowDownRegular fontSize={12} />
  } else if (dir === 'out') {
    bg = 'var(--red-bg)'
    color = 'var(--red)'
    border = 'var(--red-bd)'
    text = isRu ? 'Выход (Ketdi)' : 'Chiqish (Ketdi)'
    icon = <ArrowUpRegular fontSize={12} />
  } else if (dir === 'mobile') {
    bg = 'rgba(59, 130, 246, 0.1)'
    color = '#3b82f6'
    border = 'rgba(59, 130, 246, 0.2)'
    text = 'Mobile'
    icon = <PhoneRegular fontSize={12} />
  }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 9px', borderRadius: 999,
      background: bg, color: color,
      fontSize: 11, fontWeight: 600,
      border: `1px solid ${border}`,
      whiteSpace: 'nowrap',
      transition: 'all 0.2s ease',
    }}>
      {icon}
      <span>{text}</span>
    </span>
  )
}

function FieldLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>
      {children}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────────────

const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }
const errBannerStyle = { marginBottom: 18, padding: 12, background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, border: '1px solid var(--red-bd)' }
const inpStyle = {
  width: '100%', padding: '8px 11px', borderRadius: 7,
  border: '1px solid var(--border-2)', background: 'var(--bg)',
  color: 'var(--text-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  height: 36,
}
const tableStyle = { width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }
const thStyle = {
  textAlign: 'left', padding: '10px 12px', fontSize: 11,
  fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase',
  letterSpacing: 0.4, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
}
const tdStyle = { padding: '10px 12px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
const emptyStyle = { padding: 32, textAlign: 'center', color: 'var(--text-4)', fontSize: 13, background: 'var(--bg)', borderRadius: 8, border: '1px dashed var(--border-2)' }
const avatarFallback = { width: 30, height: 30, borderRadius: '50%', background: 'var(--surface-2)', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }

const saveBtnStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '4px 8px',
  borderRadius: 4,
  background: 'var(--accent)',
  border: 'none',
  color: '#fff',
  fontSize: 11,
  fontWeight: 600,
  textDecoration: 'none',
  cursor: 'pointer',
  transition: 'background-color 0.15s ease',
  marginLeft: 12,
}
