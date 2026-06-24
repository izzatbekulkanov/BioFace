import { useEffect, useState, useCallback, useMemo } from 'react'
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
  DismissCircleRegular,
  ClockRegular,
  ChevronDownRegular,
  ChevronUpRegular,
  ArrowDownRegular,
  ArrowUpRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import Skeleton from '../components/Skeleton'
import { useToast } from '../components/Toaster'
import CustomSelect from '../components/CustomSelect'

export default function AttendanceGroups() {
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const toast = useToast()

  const [items, setItems] = useState([])
  const [orgs, setOrgs] = useState([])
  const [branches, setBranches] = useState([])
  const [cameras, setCameras] = useState([])
  const [expandedRows, setExpandedRows] = useState(new Set())

  // Pagination states
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Today summary stats (top cards)
  const [todayStats, setTodayStats] = useState({
    total_employees: 0,
    present_today: 0,
    absent_today: 0,
    late_today: 0,
  })

  // Date defaults to today in Tashkent
  const [dateStr, setDateStr] = useState(() => {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tashkent',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date())
    } catch {
      return '2026-06-10'
    }
  })
  const [orgFilter, setOrgFilter] = useState('all')
  const [branchFilter, setBranchFilter] = useState('all')
  const [camFilter, setCamFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all') // all, came, did_not_come, came_late
  const [search, setSearch] = useState('')
  const [isSuperAdmin, setIsSuperAdmin] = useState(true)

  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

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

      setOrgs(orgList)
      setBranches(branchList)
      setCameras(camList)

      if (!superAdmin && orgList.length === 1) {
        setOrgFilter(String(orgList[0].id))
      }
    } catch {
      // silent
    }
  }, [])

  // Main fetch call
  const loadData = useCallback(async (targetPage = 1, showIndicator = true) => {
    if (showIndicator) setRefreshing(true)
    setError('')
    try {
      const [y, m, d] = dateStr.split('-')
      const params = new URLSearchParams({
        page: String(targetPage),
        page_size: '15',
        year: String(parseInt(y)),
        month: String(parseInt(m)),
        day: String(parseInt(d)),
      })

      if (orgFilter !== 'all') params.set('organization_id', orgFilter)
      if (branchFilter !== 'all') params.set('branch_id', branchFilter)
      if (camFilter !== 'all') params.set('camera_id', camFilter)
      if (statusFilter !== 'all') params.set('today_status', statusFilter)
      if (search.trim()) params.set('personal_id', search.trim())

      const res = await fetch(`/api/attendance/groups?${params}`, { credentials: 'include' })
      if (!res.ok) {
        if (res.status === 401) throw new Error(isRu ? 'Не авторизован' : 'Avtorizatsiya talab qilinadi')
        throw new Error(`HTTP ${res.status}`)
      }
      const data = await res.json()
      const list = Array.isArray(data?.items) ? data.items : []

      setItems(list)
      setPage(Number(data?.page || 1))
      setTotalPages(Number(data?.total_pages || 1))
      setTotalCount(Number(data?.total || 0))

      if (data?.summary?.employee_summary) {
        const sum = data.summary.employee_summary
        setTodayStats({
          total_employees: sum.total_employees || sum.total || 0,
          present_today: sum.came || sum.present || 0,
          absent_today: sum.did_not_come || sum.absent || 0,
          late_today: sum.came_late || sum.late || 0,
        })
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setInitialLoading(false)
      setRefreshing(false)
    }
  }, [dateStr, orgFilter, branchFilter, camFilter, statusFilter, search, isRu])

  // Initial load
  useEffect(() => {
    loadFilters()
  }, [loadFilters])

  // Reload when filters change
  useEffect(() => {
    loadData(1)
    setExpandedRows(new Set())
  }, [loadData])

  const toggleRow = (groupId) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return
    loadData(newPage)
    setExpandedRows(new Set())
  }

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

  const statusOptions = useMemo(() => [
    { value: 'all', label: isRu ? 'Все статусы' : 'Hamma holatlar' },
    { value: 'came', label: isRu ? 'Пришли' : 'Kelganlar' },
    { value: 'came_late', label: isRu ? 'Опоздали' : 'Kechikkanlar' },
    { value: 'did_not_come', label: isRu ? 'Не пришли' : 'Kelmaganlar' },
  ], [isRu])

  const formatTime = (isoStr) => {
    if (!isoStr) return '—'
    try {
      const dt = new Date(isoStr)
      return dt.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    } catch {
      return '—'
    }
  }

  const showSkeleton = initialLoading && items.length === 0

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={isRu ? '✦ Группировка' : '✦ Guruhlash'}
        title={isRu ? 'Посещаемость по сотрудникам' : 'Davomat xodimlar kesimida'}
        sub={isRu ? 'Суммарные отчеты за день с детализацией' : "Kunlik jamlangan hisobotlar batafsil ko'rinishi"}
        right={
          <button
            onClick={() => loadData(page)}
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
        .pagination-btn {
          padding: 6px 12px;
          border-radius: 6px;
          background: var(--surface-2);
          border: 1px solid var(--border-2);
          color: var(--text-1);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .pagination-btn:hover:not(:disabled) {
          background: var(--border-2);
          color: #fff;
        }
        .pagination-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
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
          .attendance-toolbar > div {
            flex: 1 1 100% !important;
            width: 100% !important;
          }
        }
      `}</style>

      <div className="attendance-container">
        {error && (
          <div style={errBannerStyle}>{error}</div>
        )}

        {/* Summary Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
          <StatCard
            icon={<PersonRegular />}
            label={isRu ? 'Всего по штату' : 'Jami xodimlar'}
            value={todayStats.total_employees}
            color="var(--accent)"
            bg="var(--accent-bg)"
            border="var(--accent-bd)"
            active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
          />
          <StatCard
            icon={<CheckmarkCircleRegular />}
            label={isRu ? 'Пришли' : 'Kelganlar'}
            value={todayStats.present_today}
            color="var(--green)"
            bg="var(--green-bg)"
            border="var(--green-bd)"
            active={statusFilter === 'came'}
            onClick={() => setStatusFilter('came')}
          />
          <StatCard
            icon={<DismissCircleRegular />}
            label={isRu ? 'Не пришли' : 'Kelmaganlar'}
            value={todayStats.absent_today}
            color="var(--red)"
            bg="var(--red-bg)"
            border="var(--red-bd)"
            active={statusFilter === 'did_not_come'}
            onClick={() => setStatusFilter('did_not_come')}
          />
          <StatCard
            icon={<ClockRegular />}
            label={isRu ? 'Опоздали' : 'Kechikkanlar'}
            value={todayStats.late_today}
            color="var(--yellow)"
            bg="var(--yellow-bg)"
            border="var(--yellow-bd)"
            active={statusFilter === 'came_late'}
            onClick={() => setStatusFilter('came_late')}
          />
        </div>

        {/* Filters Card */}
        <div className="attendance-card" style={{ ...cardStyle, marginBottom: 20 }}>
          <div className="attendance-toolbar">
            <div style={{ flex: '1 1 180px', minWidth: 150 }}>
              <FieldLabel>{isRu ? 'Дата' : 'Sana'}</FieldLabel>
              <input
                type="date"
                value={dateStr}
                onChange={e => setDateStr(e.target.value)}
                style={inpStyle}
              />
            </div>

            <div style={{ flex: '1 1 200px', minWidth: 150 }}>
              <FieldLabel>{isRu ? 'ID / Поиск' : 'ID / Qidiruv'}</FieldLabel>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={isRu ? 'Personal ID...' : 'Personal ID...'}
                style={inpStyle}
              />
            </div>

            {/* Tashkilot filtri */}
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


            {/* Filial filtri */}
            {(isSuperAdmin || branchesByOrg.length > 0) && (
              <div style={{ flex: '1 1 200px' }}>
                <FieldLabel>{isRu ? 'Филиал' : 'Filial'}</FieldLabel>
                <CustomSelect
                  value={branchFilter}
                  onChange={val => { setBranchFilter(val); setCamFilter('all') }}
                  options={branchOptions}
                  placeholder={isRu ? 'Все филиалы' : 'Hamma filiallar'}
                />
              </div>
            )}

            {camerasByOrgAndBranch.length > 0 && (
              <div style={{ flex: '1 1 180px' }}>
                <FieldLabel>{isRu ? 'Камера' : 'Kamera'}</FieldLabel>
                <CustomSelect
                  value={camFilter}
                  onChange={setCamFilter}
                  options={camOptions}
                  placeholder={isRu ? 'Все камеры' : 'Hamma kameralar'}
                />
              </div>
            )}

            <div style={{ flex: '1 1 180px' }}>
              <FieldLabel>{isRu ? 'Статус' : 'Holat'}</FieldLabel>
              <CustomSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={statusOptions}
                placeholder={isRu ? 'Все статусы' : 'Hamma holatlar'}
              />
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="attendance-card" style={cardStyle}>
          {showSkeleton ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: 8 }).map((_, i) => <Skeleton.Row key={i} />)}
            </div>
          ) : items.length === 0 ? (
            <div style={emptyStyle}>
              {isRu ? 'Записей группировки пока нет.' : "Jamlangan davomat yozuvlari hali yo'q."}
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, width: 40 }}></th>
                      <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>№</th>
                      {[
                        isRu ? 'Сотрудник' : 'Xodim',
                        isRu ? 'Организация' : 'Tashkilot',
                        isRu ? 'Время прихода' : 'Kelish vaqti',
                        isRu ? 'Время ухода' : 'Ketish vaqti',
                        isRu ? 'Проходов / Опоздания' : 'Kirib-chiqishlar / Kechikishlar',
                        isRu ? 'Статус' : 'Holat',
                      ].map((h, i) => <th key={i} style={thStyle}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => {
                      const isExpanded = expandedRows.has(it.group_id)
                      const rowNum = (page - 1) * 15 + idx + 1
                      const cameTime = it.first_timestamp ? formatTime(it.first_timestamp) : null
                      const leftTime = it.latest_timestamp ? formatTime(it.latest_timestamp) : null

                      return (
                        <>
                          <tr
                            key={it.group_id}
                            onClick={() => toggleRow(it.group_id)}
                            style={{ cursor: 'pointer', transition: 'background-color 0.12s' }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--surface-2)' }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
                          >
                            <td style={tdStyle}>
                              {isExpanded ? <ChevronUpRegular fontSize={14} /> : <ChevronDownRegular fontSize={14} />}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600, color: 'var(--text-3)' }}>
                              {rowNum}
                            </td>
                            <td style={tdStyle}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={avatarFallback}>
                                  {it.employee_image_url ? (
                                    <img
                                      src={it.employee_image_url}
                                      alt=""
                                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                                    />
                                  ) : (
                                    <PersonRegular fontSize={14} />
                                  )}
                                </div>
                                <div>
                                  {it.employee_id ? (
                                    <Link
                                      to={`/employees/${it.employee_uuid || it.employee_id}`}
                                      onClick={e => e.stopPropagation()}
                                      style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}
                                    >
                                      {it.employee_name}
                                    </Link>
                                  ) : (
                                    <div style={{ fontWeight: 600 }}>{it.employee_name}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td style={tdStyle}>
                              {it.organization_name ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                                  <BuildingRegular fontSize={13} style={{ color: 'var(--text-4)' }} />
                                  {it.organization_name}{it.branch_name ? ` | ${it.branch_name}` : ''}
                                </div>
                              ) : <span style={{ color: 'var(--text-4)' }}>—</span>}
                            </td>
                            <td style={tdStyle}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {it.employee_id && (
                                  <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <ClockRegular fontSize={10} style={{ color: 'var(--text-4)' }} />
                                    {isRu ? 'План: ' : 'Reja: '}{it.expected_start_time || '09:00'}
                                  </div>
                                )}
                                {cameTime ? (
                                  <span style={it.late_minutes > 0 ? lateTimeBadgeStyle : onTimeBadgeStyle}>
                                    <ArrowDownRegular fontSize={12} />
                                    {cameTime}
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-4)', fontSize: 13 }}>—</span>
                                )}
                              </div>
                            </td>
                            <td style={tdStyle}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {it.employee_id && (
                                  <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <ClockRegular fontSize={10} style={{ color: 'var(--text-4)' }} />
                                    {isRu ? 'План: ' : 'Reja: '}{it.expected_end_time || '18:00'}
                                  </div>
                                )}
                                {!cameTime ? (
                                  <span style={{ color: 'var(--text-4)', fontSize: 13 }}>—</span>
                                ) : (!leftTime || it.visit_count <= 1 || it.first_timestamp === it.latest_timestamp) ? (
                                  <span style={activeBadgeStyle}>
                                    {isRu ? 'В офисе' : 'Hozir shu yerda'}
                                  </span>
                                ) : (
                                  <span style={checkoutTimeBadgeStyle}>
                                    <ArrowUpRegular fontSize={12} />
                                    {leftTime}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={tdStyle}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={visitCountBadgeStyle} title={isRu ? 'Количество проходов' : 'Kirib-chiqishlar soni'}>
                                  {it.visit_count}
                                </span>
                                {it.late_minutes > 0 && (
                                  <span style={lateLabelStyle}>
                                    {isRu ? `Опоздание: ${it.late_minutes} мин` : `Kechikish: ${it.late_minutes} daqiqa`}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={tdStyle}>
                              <StatusPill status={it.status} hasEmployee={it.employee_id != null} isRu={isRu} />
                            </td>
                          </tr>

                          {/* Expanded detail logs */}
                          {isExpanded && (
                            <tr style={{ background: 'var(--surface-3)' }}>
                              <td colSpan={8} style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)' }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
                                  {isRu ? 'Детали проходов' : 'Kirib-chiqish batafsil jurnali'}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {Array.isArray(it.events) && it.events.length > 0 ? (
                                    it.events.map((evt, eIdx) => (
                                      <div
                                        key={eIdx}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          padding: '8px 12px',
                                          borderRadius: 6,
                                          background: 'var(--surface)',
                                          border: '1px solid var(--border)',
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                          <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{formatTime(evt.timestamp)}</div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-2)' }}>
                                            <CameraRegular fontSize={12} />
                                            {evt.camera_name || 'Camera'}
                                          </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                          {evt.direction === 'in' ? (
                                            <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>Kirish (Keldi)</span>
                                          ) : evt.direction === 'out' ? (
                                            <span style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600 }}>Chiqish (Ketdi)</span>
                                          ) : (
                                            <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>—</span>
                                          )}
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div style={{ fontSize: 12, color: 'var(--text-4)', padding: 6 }}>
                                      {isRu ? 'Детальная информация о сессиях отсутствует.' : "Sessiyalar haqida batafsil ma'lumot yo'q."}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {isRu
                      ? `Показаны записи ${items.length} из ${totalCount}`
                      : `Ko'rsatilmoqda ${items.length} tadan ${totalCount} tasi`}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="pagination-btn"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page === 1}
                    >
                      {isRu ? 'Назад' : 'Orqaga'}
                    </button>
                    <span style={{ alignSelf: 'center', fontSize: 12, fontWeight: 600, padding: '0 4px' }}>
                      {page} / {totalPages}
                    </span>
                    <button
                      className="pagination-btn"
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page === totalPages}
                    >
                      {isRu ? 'Вперед' : 'Oldinga'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color, bg, border, active, onClick }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--surface)',
        border: `1.5px solid ${active ? color : (hovered ? 'var(--text-4)' : 'var(--border)')}`,
        borderRadius: 12,
        padding: '15.5px 19.5px', // offset 1.5px border to avoid layout shift
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        boxShadow: active ? `0 4px 14px ${color}22` : (hovered ? '0 4px 12px rgba(0,0,0,0.08)' : 'none'),
        transform: hovered ? 'translateY(-2px)' : 'none',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: active ? color : 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.3, transition: 'color 0.2s' }}>
          {label}
        </span>
        <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', lineHeight: 1.1 }}>
          {value}
        </span>
      </div>
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 10,
          background: bg,
          color: color,
          border: `1px solid ${border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          transform: hovered ? 'scale(1.05)' : 'none',
          transition: 'transform 0.2s ease',
        }}
      >
        {icon}
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
      text: isRu ? 'Опоздал' : 'Kechikkan'
    }
  } else if (statusStr === 'kelmagan' || statusStr === 'did_not_come') {
    tone = {
      bg: 'rgba(232, 17, 35, 0.1)',
      color: '#e81123',
      border: 'rgba(232, 17, 35, 0.25)',
      icon: <DismissCircleRegular fontSize={12} />,
      text: isRu ? 'Не пришел' : 'Kelmagan'
    }
  } else if (statusStr === 'came' || statusStr === 'kelgan') {
    tone = {
      bg: 'var(--green-bg)',
      color: 'var(--green)',
      border: 'var(--green-bd)',
      icon: <CheckmarkCircleRegular fontSize={12} />,
      text: isRu ? 'Пришел' : 'Kelgan'
    }
  } else {
    const isKnown = hasEmployee || statusStr.includes('aniq')
    tone = isKnown
      ? { bg: 'var(--green-bg)', color: 'var(--green)', border: 'var(--green-bd)', icon: <CheckmarkCircleRegular fontSize={12} />, text: isRu ? 'Пришел' : 'Kelgan' }
      : { bg: 'var(--yellow-bg)', color: 'var(--yellow)', border: 'var(--yellow-bd)', icon: <QuestionCircleRegular fontSize={12} />, text: isRu ? 'Неизвестный' : "Noma'lum" }
  }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 9px', borderRadius: 999,
      background: tone.bg, color: tone.color,
      fontSize: 11, fontWeight: 600,
      border: `1px solid ${tone.border}`,
      whiteSpace: 'nowrap',
    }}>{tone.icon}{tone.text}</span>
  )
}

function FieldLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>
      {children}
    </div>
  )
}

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

const expectedTimeBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '4px 8px',
  borderRadius: 6,
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  color: 'var(--text-2)',
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: 'nowrap'
}

const onTimeBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '4px 8px',
  borderRadius: 6,
  background: 'var(--green-bg)',
  border: '1px solid var(--green-bd)',
  color: 'var(--green)',
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: 'nowrap'
}

const lateTimeBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '4px 8px',
  borderRadius: 6,
  background: 'var(--yellow-bg)',
  border: '1px solid var(--yellow-bd)',
  color: 'var(--yellow)',
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: 'nowrap'
}

const checkoutTimeBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '4px 8px',
  borderRadius: 6,
  background: 'var(--purple-bg)',
  border: '1px solid var(--purple-bd)',
  color: 'var(--purple)',
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: 'nowrap'
}

const activeBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '4px 8px',
  borderRadius: 6,
  background: 'var(--accent-bg)',
  border: '1px solid var(--accent-bd)',
  color: 'var(--accent-tx)',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
  whiteSpace: 'nowrap'
}

const visitCountBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 24,
  height: 24,
  borderRadius: 12,
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  color: 'var(--text-1)',
  fontSize: 12,
  fontWeight: 700,
  padding: '0 6px',
}

const lateLabelStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '3px 7px',
  borderRadius: 4,
  background: 'var(--red-bg)',
  border: '1px solid var(--red-bd)',
  color: 'var(--red)',
  fontSize: 11,
  fontWeight: 600,
  whiteSpace: 'nowrap',
}
