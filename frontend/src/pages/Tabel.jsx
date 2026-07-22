import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CalendarRegular,
  ArrowSyncRegular,
  SearchRegular,
  DismissCircleRegular,
  DocumentTableRegular,
  DismissRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import { useToast } from '../components/Toaster'
import CustomSelect from '../components/CustomSelect'
import Skeleton from '../components/Skeleton'

export default function Tabel() {
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const toast = useToast()

  const excuseOptions = useMemo(() => [
    { value: 'sick_leave', label: isRu ? 'Болезнь (Больничный)' : 'Kasallik (Kasallik varaqasi)' },
    { value: 'vacation', label: isRu ? 'Отпуск' : "Ta'til" },
    { value: 'business_trip', label: isRu ? 'Командировка' : 'Xizmat safari' },
    { value: 'suspended', label: isRu ? 'Отстранение (Временное)' : 'Vaqtincha chetlashtirilgan' },
    { value: 'other', label: isRu ? 'Другая причина (Справка/Рапорт)' : 'Boshqa sabab (Spravka/Hujjat)' }
  ], [isRu])

  const [tabelData, setTabelData] = useState([])
  const [daysInMonth, setDaysInMonth] = useState(30)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [orgs, setOrgs] = useState([])
  const [branches, setBranches] = useState([])
  const [orgFilter, setOrgFilter] = useState('all')
  const [branchFilter, setBranchFilter] = useState('all')
  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])
  const [deptFilter, setDeptFilter] = useState('all')
  const [posFilter, setPosFilter] = useState('all')

  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1))
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()))

  // User role checking
  const [currentUser, setCurrentUser] = useState(null)
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setCurrentUser(d) })
      .catch(() => {})
  }, [])
  const role = (currentUser?.role || '').toLowerCase().replace(/_/g, '')
  const canEdit = role !== 'buxgalter' && role !== 'kadr'

  // Excuse Absence Modal States
  const [excuseModalOpen, setExcuseModalOpen] = useState(false)
  const [targetEmp, setTargetEmp] = useState(null)
  const [targetDay, setTargetDay] = useState(null)
  const [excuseType, setExcuseType] = useState('sick_leave')
  const [excuseComment, setExcuseComment] = useState('')
  const [excuseDocument, setExcuseDocument] = useState(null)
  const [savingExcuse, setSavingExcuse] = useState(false)

  const handleCellClick = (emp, dayNum, currentStatus) => {
    setTargetEmp(emp)
    setTargetDay(dayNum)
    setExcuseType('sick_leave')
    setExcuseComment('')
    setExcuseDocument(null)
    setExcuseModalOpen(true)
  }

  const handleSaveExcuse = async (e) => {
    e.preventDefault()
    if (!canEdit) {
      toast.error(isRu ? 'У вас нет прав для выполнения этого действия' : 'Ushbu amalni bajarish uchun sizda huquq yo\'q')
      return
    }
    if (!targetEmp || !targetDay) return

    const targetDateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`
    
    setSavingExcuse(true)
    try {
      const formData = new FormData()
      formData.append('employee_id', targetEmp.id)
      formData.append('status_type', excuseType)
      formData.append('start_date', targetDateStr)
      formData.append('end_date', targetDateStr)
      if (excuseComment) formData.append('comment', excuseComment)
      if (excuseDocument) formData.append('document', excuseDocument)

      const res = await fetch('/api/employees/status-records', {
        method: 'POST',
        credentials: 'include',
        body: formData
      })

      if (res.ok) {
        toast.success(
          isRu 
            ? 'Статус успешно добавлен' 
            : 'Status muvaffaqiyatli qoʻshildi'
        )
        setExcuseModalOpen(false)
        loadTabel()
      } else {
        const err = await res.json()
        toast.error(err.detail || (isRu ? 'Ошибка при сохранении' : 'Saqlashda xatolik yuz berdi'))
      }
    } catch (err) {
      console.error(err)
      toast.error(isRu ? 'Aloqa xatoligi' : 'Aloqa xatoligi')
    } finally {
      setSavingExcuse(false)
    }
  }

  const monthsUz = [
    { value: '1', label: 'Yanvar' },
    { value: '2', label: 'Fevral' },
    { value: '3', label: 'Mart' },
    { value: '4', label: 'Aprel' },
    { value: '5', label: 'May' },
    { value: '6', label: 'Iyun' },
    { value: '7', label: 'Iyul' },
    { value: '8', label: 'Avgust' },
    { value: '9', label: 'Sentyabr' },
    { value: '10', label: 'Oktyabr' },
    { value: '11', label: 'Noyabr' },
    { value: '12', label: 'Dekabr' }
  ]

  const monthsRu = [
    { value: '1', label: 'Январь' },
    { value: '2', label: 'Февраль' },
    { value: '3', label: 'Март' },
    { value: '4', label: 'Апрель' },
    { value: '5', label: 'Май' },
    { value: '6', label: 'Июнь' },
    { value: '7', label: 'Июль' },
    { value: '8', label: 'Август' },
    { value: '9', label: 'Сентябрь' },
    { value: '10', label: 'Октябрь' },
    { value: '11', label: 'Ноябрь' },
    { value: '12', label: 'Декабрь' }
  ]

  const years = [
    { value: '2024', label: '2024' },
    { value: '2025', label: '2025' },
    { value: '2026', label: '2026' },
    { value: '2027', label: '2027' }
  ]

  const loadFilters = async () => {
    try {
      const res = await fetch('/api/attendance/filter-data', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        const organizations = data?.organizations || []
        setOrgs(organizations)
        setBranches(data?.branches || [])
        if (organizations.length === 1) {
          setOrgFilter(String(organizations[0].id))
        }
      }
    } catch (err) {
      console.error('Failed to load filters:', err)
    }
  }

  const loadTabel = async () => {
    if (orgFilter === 'all') {
      setTabelData([])
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams({
        year: selectedYear,
        month: selectedMonth,
      })
      if (orgFilter !== 'all') params.set('organization_id', orgFilter)
      if (branchFilter !== 'all') params.set('branch_id', branchFilter)
      if (deptFilter !== 'all') params.set('department_id', deptFilter)
      if (posFilter !== 'all') params.set('position_id', posFilter)
      if (search) params.set('search', search)

      const res = await fetch(`/api/finance/tabel?${params.toString()}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setTabelData(data.tabel || [])
        setDaysInMonth(data.days_in_month || 30)
      }
    } catch (err) {
      console.error('Failed to load tabel:', err)
      toast.error(isRu ? 'Ошибка загрузки табеля' : 'Tabelni yuklashda xatolik yuz berdi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFilters()
  }, [])

  useEffect(() => {
    if (orgFilter === 'all') {
      setDepartments([])
      setPositions([])
      setDeptFilter('all')
      return
    }
    const loadCatalogs = async () => {
      try {
        const res = await fetch(`/api/employee-catalogs?organization_id=${orgFilter}`, { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          const depts = data?.departments || []
          setDepartments(depts)
          setPositions(data?.positions || [])
          if (depts.length > 0) {
            setDeptFilter(String(depts[0].id))
          } else {
            setDeptFilter('all')
          }
        }
      } catch (err) {
        console.error('Failed to load catalogs:', err)
      }
    }
    loadCatalogs()
  }, [orgFilter])

  useEffect(() => {
    loadTabel()
  }, [orgFilter, branchFilter, deptFilter, posFilter, selectedMonth, selectedYear])

  const filteredBranches = useMemo(() => {
    if (orgFilter === 'all') return branches
    return branches.filter(b => String(b.organization_id) === String(orgFilter))
  }, [branches, orgFilter])

  const filteredDepartments = departments

  const filteredPositions = useMemo(() => {
    if (deptFilter === 'all') return positions
    return positions.filter(p => String(p.department_id) === String(deptFilter))
  }, [positions, deptFilter])

  const orgOptions = useMemo(() => {
    return [
      { value: 'all', label: isRu ? 'Все организации' : 'Barcha tashkilotlar' },
      ...orgs.map(org => ({ value: String(org.id), label: org.name }))
    ]
  }, [orgs, isRu])

  const branchOptions = useMemo(() => {
    return [
      { value: 'all', label: isRu ? 'Все филиалы' : 'Barcha filiallar' },
      ...filteredBranches.map(b => ({ value: String(b.id), label: b.name }))
    ]
  }, [filteredBranches, isRu])

  const deptOptions = useMemo(() => {
    return filteredDepartments.map(d => ({ value: String(d.id), label: d.name }))
  }, [filteredDepartments])

  const posOptions = useMemo(() => {
    return [
      { value: 'all', label: isRu ? 'Все должности' : 'Barcha lavozimlar' },
      ...filteredPositions.map(p => ({ value: String(p.id), label: p.name }))
    ]
  }, [filteredPositions, isRu])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    loadTabel()
  }

  const getEmployeeStats = (days) => {
    let present = 0
    let late = 0
    let absent = 0
    let holiday = 0
    let vacation = 0
    let sick = 0
    let trip = 0
    let resigned = 0
    let suspended = 0

    days.forEach(d => {
      if (d.status === 'present') present++
      else if (d.status === 'late') {
        present++
        late++
      } else if (d.status === 'absent') absent++
      else if (d.status === 'holiday') holiday++
      else if (d.status === 'vacation') vacation++
      else if (d.status === 'sick_leave') sick++
      else if (d.status === 'business_trip') trip++
      else if (d.status === 'resigned') resigned++
      else if (d.status === 'suspended') suspended++
    })

    return { present, late, absent, holiday, vacation, sick, trip, resigned, suspended }
  }

  const handleExportExcel = () => {
    if (orgFilter === 'all') {
      toast.error(isRu ? 'Выберите организацию' : 'Tashkilotni tanlang')
      return
    }
    const params = new URLSearchParams({
      year: selectedYear,
      month: selectedMonth,
      organization_id: orgFilter,
    })
    if (branchFilter !== 'all') params.set('branch_id', branchFilter)
    if (deptFilter !== 'all') params.set('department_id', deptFilter)
    if (posFilter !== 'all') params.set('position_id', posFilter)
    if (search) params.set('search', search)

    window.open(`/api/finance/tabel/export-excel?${params.toString()}`, '_blank')
    toast.success(isRu ? 'Началось скачивание Excel' : 'Excel yuklab olish boshlandi')
  }

  const handleExportPdf = () => {
    if (orgFilter === 'all') {
      toast.error(isRu ? 'Выберите организацию' : 'Tashkilotni tanlang')
      return
    }
    const params = new URLSearchParams({
      year: selectedYear,
      month: selectedMonth,
      organization_id: orgFilter,
    })
    if (branchFilter !== 'all') params.set('branch_id', branchFilter)
    if (deptFilter !== 'all') params.set('department_id', deptFilter)
    if (posFilter !== 'all') params.set('position_id', posFilter)
    if (search) params.set('search', search)

    window.open(`/api/finance/tabel/export-pdf?${params.toString()}`, '_blank')
    toast.success(isRu ? 'Началось скачивание PDF' : 'PDF yuklab olish boshlandi')
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={isRu ? '✦ Финансы' : '✦ Moliya'}
        title={isRu ? 'Табель учета рабочего времени' : 'Ish vaqti tabeli'}
        sub={isRu ? 'Ежемесячный учет посещаемости, явок, опозданий и пропусков сотрудников' : 'Xodimlarning oylik davomati, kelgan-ketgan vaqtlari va proqullari tabeli'}
        right={
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={loadTabel}
              disabled={loading}
              style={refreshBtnStyle(loading)}
            >
              <ArrowSyncRegular fontSize={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              {isRu ? 'Обновить' : 'Yangilash'}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleExportExcel}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', borderRadius: 8,
                background: '#217346', border: 'none', color: '#fff',
                fontSize: 13, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'all 0.15s',
              }}
            >
              <DocumentTableRegular fontSize={15} />
              {isRu ? 'Экспорт в Excel' : 'Excelga eksport'}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleExportPdf}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', borderRadius: 8,
                background: '#c43c3c', border: 'none', color: '#fff',
                fontSize: 13, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'all 0.15s',
              }}
            >
              <DocumentTableRegular fontSize={15} />
              {isRu ? 'Печать T-13 PDF' : 'T-13 PDF chop etish'}
            </button>
          </div>
        }
      />

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 24px 80px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        
        {/* Card for Filters & Table */}
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>
            <CalendarRegular style={{ color: 'var(--accent)' }} />
            {isRu ? 'Сетка учета посещаемости' : 'Davomat tabeli setkasi'}
          </h3>
          
          {/* Filters Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
            {/* Dropdowns Row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {/* Org Selector */}
              <div style={{ minWidth: 200, flex: 1 }}>
                <CustomSelect
                  options={orgOptions}
                  value={orgFilter}
                  onChange={val => {
                    setOrgFilter(val || 'all')
                    setBranchFilter('all')
                    setDeptFilter('all')
                    setPosFilter('all')
                  }}
                  placeholder={isRu ? 'Все организации' : 'Barcha tashkilotlar'}
                />
              </div>

              {/* Branch Selector */}
              <div style={{ minWidth: 180, flex: 1 }}>
                <CustomSelect
                  options={branchOptions}
                  value={branchFilter}
                  onChange={val => setBranchFilter(val || 'all')}
                  disabled={orgFilter === 'all'}
                  placeholder={isRu ? 'Все филиалы' : 'Barcha filiallar'}
                />
              </div>

              {/* Department Selector */}
              <div style={{ minWidth: 180, flex: 1 }}>
                <CustomSelect
                  options={deptOptions}
                  value={deptFilter}
                  onChange={val => {
                    setDeptFilter(val || (departments[0] ? String(departments[0].id) : 'all'))
                    setPosFilter('all')
                  }}
                  disabled={orgFilter === 'all'}
                  placeholder={isRu ? 'Выберите отдел' : 'Bo\'limni tanlang'}
                />
              </div>

              {/* Position Selector */}
              <div style={{ minWidth: 180, flex: 1 }}>
                <CustomSelect
                  options={posOptions}
                  value={posFilter}
                  onChange={val => setPosFilter(val || 'all')}
                  disabled={orgFilter === 'all'}
                  placeholder={isRu ? 'Все должности' : 'Barcha lavozimlar'}
                />
              </div>

              {/* Year Selector */}
              <div style={{ minWidth: 100, flex: '0 0 auto' }}>
                <CustomSelect
                  options={years}
                  value={selectedYear}
                  onChange={setSelectedYear}
                />
              </div>

              {/* Month Selector */}
              <div style={{ minWidth: 130, flex: '0 0 auto' }}>
                <CustomSelect
                  options={isRu ? monthsRu : monthsUz}
                  value={selectedMonth}
                  onChange={setSelectedMonth}
                />
              </div>
            </div>

            {/* Search Input Row */}
            <div style={{ display: 'flex', gap: 12, maxWidth: 360, width: '100%' }}>
              {/* Search Form */}
              <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flex: 1, position: 'relative' }}>
                <SearchRegular fontSize={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)' }} />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={isRu ? 'Поиск сотрудников...' : 'Xodimlarni qidirish...'}
                  style={{
                    width: '100%', padding: '8px 32px 8px 32px', borderRadius: 8,
                    border: '1px solid var(--border-2)', background: 'var(--bg)',
                    color: 'var(--text-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box'
                  }}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('')
                      setTimeout(() => {
                        loadTabel()
                      }, 0)
                    }}
                    style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer'
                    }}
                  >
                    <DismissCircleRegular fontSize={14} />
                  </button>
                )}
              </form>
            </div>
          </div>

          {/* Matrix table container */}
          {orgFilter === 'all' ? (
            <div style={emptyStyle}>
              {isRu ? 'Пожалуйста, выберите организацию для отображения табеля.' : "Tabelni ko'rish uchun iltimos tashkilotni tanlang."}
            </div>
          ) : !loading && tabelData.length === 0 ? (
            <div style={emptyStyle}>
              {isRu ? 'Нет данных для отображения за выбранный период.' : "Tanlangan davr uchun ma'lumotlar mavjud emas."}
            </div>
          ) : (
            <div style={{ width: '100%', overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)' }}>
                    <th style={{ ...thStyle, width: 40, paddingLeft: 12 }}>№</th>
                    <th className="sticky-col-header" style={{
                      ...thStyle,
                      minWidth: 150,
                      paddingLeft: 12
                    }}>
                      {isRu ? 'Ф.И.О. сотрудника' : 'Xodim F.I.SH'}
                    </th>
                    
                    {/* Days columns */}
                    {Array.from({ length: daysInMonth }).map((_, i) => (
                      <th key={i} style={{
                        ...thStyle,
                        padding: '6px 2px',
                        textAlign: 'center', 
                        minWidth: 22, 
                        borderRight: '1px solid var(--border-2)',
                        fontSize: 10,
                      }}>
                        {i + 1}
                      </th>
                    ))}

                    {/* Summary columns */}
                    <th style={{ ...thStyle, padding: '8px 2px', color: '#10b981', textAlign: 'center', minWidth: 28 }}>
                      {isRu ? 'Я' : 'K'}
                    </th>
                    <th style={{ ...thStyle, padding: '8px 2px', color: '#f59e0b', textAlign: 'center', minWidth: 28 }}>
                      {isRu ? 'О' : 'Kch'}
                    </th>
                    <th style={{ ...thStyle, padding: '8px 2px', color: '#ef4444', textAlign: 'center', minWidth: 28 }}>
                      {isRu ? 'Н' : 'Yo'}
                    </th>
                    <th style={{ ...thStyle, padding: '8px 2px', color: 'var(--text-3)', textAlign: 'center', minWidth: 28, paddingRight: 12 }}>
                      {isRu ? 'В' : 'D'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 8 }).map((_, rIdx) => (
                      <tr key={rIdx} style={{ background: rIdx % 2 === 1 ? 'var(--surface-2)' : 'transparent' }}>
                        <td style={{ ...tdStyle, paddingLeft: 12 }}>
                          <Skeleton width={18} height={12} />
                        </td>
                        <td className="sticky-col-cell" style={{ ...tdStyle, paddingLeft: 12 }}>
                          <Skeleton width={110} height={12} />
                        </td>
                        {Array.from({ length: daysInMonth }).map((_, dIdx) => (
                          <td key={dIdx} style={{ padding: '6px 2px', borderRight: '1px solid var(--border-2)', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                            <Skeleton width={16} height={16} radius={4} />
                          </td>
                        ))}
                        <td style={{ ...tdStyle, padding: '8px 2px', textAlign: 'center' }}><Skeleton width={16} height={12} /></td>
                        <td style={{ ...tdStyle, padding: '8px 2px', textAlign: 'center' }}><Skeleton width={16} height={12} /></td>
                        <td style={{ ...tdStyle, padding: '8px 2px', textAlign: 'center' }}><Skeleton width={16} height={12} /></td>
                        <td style={{ ...tdStyle, padding: '8px 2px', textAlign: 'center', paddingRight: 12 }}><Skeleton width={16} height={12} /></td>
                      </tr>
                    ))
                  ) : (
                    tabelData.map((emp, index) => {
                      const stats = getEmployeeStats(emp.days)
                      return (
                        <tr
                          key={emp.uuid || emp.id}
                          style={{
                            background: index % 2 === 1 ? 'var(--surface-2)' : 'transparent',
                            transition: 'background 0.1s'
                          }}
                        >
                          <td style={{ ...tdStyle, color: 'var(--text-3)', paddingLeft: 12 }}>{index + 1}</td>
                          <td className="sticky-col-cell" style={{
                            ...tdStyle,
                            fontWeight: 600, 
                            color: 'var(--text-1)',
                            paddingLeft: 12
                          }}>
                            {emp.name}
                          </td>

                          {/* Days cell matrix */}
                          {emp.days.map((d, dIdx) => {
                            let displayChar = '-'
                            let cellBg = 'transparent'
                            let textColor = 'var(--text-4)'
                            let hoverTitle = ''

                            if (d.status === 'present') {
                              displayChar = isRu ? 'Я' : 'K'
                              cellBg = 'rgba(16, 185, 129, 0.15)'
                              textColor = '#10b981'
                              hoverTitle = isRu 
                                ? `Присутствовал\nПришел: ${d.first_seen || ''}\nУшел: ${d.last_seen || ''}`
                                : `Kelgan\nKeldi: ${d.first_seen || ''}\nKetdi: ${d.last_seen || ''}`
                            } else if (d.status === 'late') {
                              displayChar = isRu ? 'О' : 'Kch'
                              cellBg = 'rgba(245, 158, 11, 0.18)'
                              textColor = '#d97706'
                              hoverTitle = isRu 
                                ? `Опоздал\nПришел: ${d.first_seen || ''}\nУшел: ${d.last_seen || ''}`
                                : `Kechikkan\nKeldi: ${d.first_seen || ''}\nKetdi: ${d.last_seen || ''}`
                            } else if (d.status === 'absent') {
                              displayChar = isRu ? 'Н' : 'Yo'
                              cellBg = 'rgba(239, 68, 68, 0.12)'
                              textColor = '#ef4444'
                              hoverTitle = isRu ? 'Отсутствовал' : 'Kelmagan'
                            } else if (d.status === 'holiday') {
                              displayChar = isRu ? 'В' : 'D'
                              cellBg = 'var(--surface-2)'
                              textColor = 'var(--text-3)'
                              hoverTitle = isRu ? 'Выходной день / праздник' : 'Dam olish kuni'
                            } else if (d.status === 'vacation') {
                              displayChar = isRu ? 'ОТ' : 'Ta'
                              cellBg = 'rgba(99, 102, 241, 0.18)'
                              textColor = '#818cf8'
                              hoverTitle = isRu ? 'Отпуск' : "Ta'til"
                            } else if (d.status === 'sick_leave') {
                              displayChar = isRu ? 'Б' : 'Ka'
                              cellBg = 'rgba(236, 72, 153, 0.18)'
                              textColor = '#ec4899'
                              hoverTitle = isRu ? 'Больничный' : 'Kasallik'
                            } else if (d.status === 'business_trip') {
                              displayChar = isRu ? 'К' : 'Xs'
                              cellBg = 'rgba(6, 182, 212, 0.18)'
                              textColor = '#06b6d4'
                              hoverTitle = isRu ? 'Командировка' : 'Xizmat safari'
                            } else if (d.status === 'resigned') {
                              displayChar = isRu ? 'УВ' : 'Bo'
                              cellBg = 'rgba(107, 114, 128, 0.18)'
                              textColor = '#9ca3af'
                              hoverTitle = isRu ? 'Уволен' : "Bo'shatilgan"
                            } else if (d.status === 'suspended') {
                              displayChar = isRu ? 'ОС' : 'Vt'
                              cellBg = 'rgba(156, 163, 175, 0.1)'
                              textColor = '#6b7280'
                              hoverTitle = isRu ? 'Отстранен' : 'Vaqtincha to\'xtatilgan'
                            } else if (d.status === 'other') {
                              displayChar = isRu ? 'УВ' : 'Sa'
                              cellBg = 'rgba(14, 165, 233, 0.15)'
                              textColor = '#0ea5e9'
                              hoverTitle = isRu ? 'Другая уважительная причина' : 'Boshqa sababli kelmagan'
                            } else if (d.status === 'pending') {
                              displayChar = '•'
                              cellBg = 'transparent'
                              textColor = 'var(--text-4)'
                            }

                            return (
                              <td
                                key={dIdx}
                                title={hoverTitle}
                                onClick={() => canEdit && handleCellClick(emp, d.day, d.status)}
                                style={{
                                  padding: '4px 1px',
                                  borderRight: '1px solid var(--border-2)',
                                  borderBottom: '1px solid var(--border)',
                                  textAlign: 'center',
                                  userSelect: 'none',
                                  cursor: canEdit ? 'pointer' : 'default',
                                  transition: 'background-color 0.1s',
                                }}
                                onMouseEnter={e => {
                                  if (canEdit) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'
                                }}
                                onMouseLeave={e => {
                                  if (canEdit) e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                              >
                                <div style={{
                                  width: 18, height: 18, borderRadius: 4,
                                  margin: '0 auto', display: 'flex',
                                  alignItems: 'center', justifyContent: 'center',
                                  fontWeight: '700', fontSize: 9,
                                  background: cellBg, color: textColor,
                                }}>
                                  {displayChar}
                                </div>
                              </td>
                            )
                          })}

                          {/* Summary cells */}
                          <td style={{ ...tdStyle, padding: '8px 2px', color: '#10b981', fontWeight: 700, textAlign: 'center' }}>
                            {stats.present}
                          </td>
                          <td style={{ ...tdStyle, padding: '8px 2px', color: '#f59e0b', fontWeight: 700, textAlign: 'center' }}>
                            {stats.late}
                          </td>
                          <td style={{ ...tdStyle, padding: '8px 2px', color: '#ef4444', fontWeight: 700, textAlign: 'center' }}>
                            {stats.absent}
                          </td>
                          <td style={{ ...tdStyle, padding: '8px 2px', color: 'var(--text-3)', fontWeight: 600, textAlign: 'center', paddingRight: 12 }}>
                            {stats.holiday}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Legend Panel */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 20, padding: 16,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          fontSize: 12, color: 'var(--text-3)'
        }}>
          <div style={{ fontWeight: 600, color: 'var(--text-1)' }}>
            {isRu ? 'Условные обозначения:' : 'Tabel belgilari:'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: 4, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 700, alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
              {isRu ? 'Я' : 'K'}
            </span>
            <span>{isRu ? 'Явка (присутствие)' : 'Kelgan (keldi)'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: 4, background: 'rgba(245, 158, 11, 0.18)', color: '#d97706', fontWeight: 700, alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
              {isRu ? 'О' : 'Kch'}
            </span>
            <span>{isRu ? 'Опоздание' : 'Kechikkan'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: 4, background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', fontWeight: 700, alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
              {isRu ? 'Н' : 'Yo'}
            </span>
            <span>{isRu ? 'Неявка (отсутствие)' : 'Kelmagan (yo\'q)'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: 4, background: 'var(--surface-2)', color: 'var(--text-3)', fontWeight: 700, alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
              {isRu ? 'В' : 'D'}
            </span>
            <span>{isRu ? 'Выходной / Праздник' : 'Dam olish / bayram'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: 4, background: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9', fontWeight: 700, alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
              {isRu ? 'УВ' : 'Sa'}
            </span>
            <span>{isRu ? 'Уважительная причина' : 'Sababli kelmagan'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: 4, background: 'rgba(99, 102, 241, 0.18)', color: '#818cf8', fontWeight: 700, alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
              {isRu ? 'ОТ' : 'Ta'}
            </span>
            <span>{isRu ? 'Отпуск' : "Ta'til"}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: 4, background: 'rgba(236, 72, 153, 0.18)', color: '#ec4899', fontWeight: 700, alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
              {isRu ? 'Б' : 'Ka'}
            </span>
            <span>{isRu ? 'Больничный' : 'Kasallik'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: 4, background: 'rgba(6, 182, 212, 0.18)', color: '#06b6d4', fontWeight: 700, alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
              {isRu ? 'К' : 'Xs'}
            </span>
            <span>{isRu ? 'Командировка' : 'Xizmat safari'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: 4, background: 'rgba(107, 114, 128, 0.18)', color: '#9ca3af', fontWeight: 700, alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
              {isRu ? 'УВ' : 'Bo'}
            </span>
            <span>{isRu ? 'Уволен' : "Bo'shatilgan"}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: 4, background: 'rgba(156, 163, 175, 0.1)', color: '#6b7280', fontWeight: 700, alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
              {isRu ? 'ОС' : 'Vt'}
            </span>
            <span>{isRu ? 'Отстранен' : "Vaqtincha to'xtatilgan"}</span>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .sticky-col-header {
          position: sticky;
          left: 0;
          background: var(--surface-2) !important;
          border-right: 1px solid var(--border) !important;
          z-index: 12 !important;
        }
        .sticky-col-cell {
          position: sticky;
          left: 0;
          background: var(--surface) !important;
          border-right: 1px solid var(--border) !important;
          z-index: 10 !important;
        }
        tr:nth-of-type(even) .sticky-col-cell {
          background: var(--surface-2) !important;
        }
        tr:hover {
          background-color: var(--surface-2) !important;
        }
        tr:hover .sticky-col-cell {
          background-color: var(--surface-2) !important;
        }
      `}</style>

      {/* Excuse Absence Modal */}
      {excuseModalOpen && targetEmp && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(3px)', padding: 20
        }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 16, width: '100%', maxWidth: 450,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
            overflow: 'hidden', animation: 'bfModalIn 0.2s ease-out'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 20px', borderBottom: '1px solid var(--border)',
              background: 'var(--bg)'
            }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-1)' }}>
                {isRu ? 'Оправдать пропуск' : 'Kelmagan kunni sababli qilish'}
              </h2>
              <button
                onClick={() => setExcuseModalOpen(false)}
                style={{
                  background: 'transparent', border: 'none', color: 'var(--text-3)',
                  cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center'
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-1)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
              >
                <DismissRegular fontSize={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveExcuse} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 2 }}>
                  {isRu ? 'Сотрудник' : 'Xodim'}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>
                  {targetEmp.name}
                </span>
              </div>

              <div>
                <span style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 2 }}>
                  {isRu ? 'Дата' : 'Sana'}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
                  {selectedYear}-{String(selectedMonth).padStart(2, '0')}-{String(targetDay).padStart(2, '0')}
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-2)' }}>
                  {isRu ? 'Причина' : 'Sababi'} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <CustomSelect
                  options={excuseOptions}
                  value={excuseType}
                  onChange={val => setExcuseType(val || 'sick_leave')}
                  placeholder={isRu ? 'Выберите причину' : 'Sababini tanlang'}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-2)' }}>
                  {isRu ? 'Комментарий' : 'Izoh'}
                </label>
                <textarea
                  rows="2"
                  value={excuseComment}
                  onChange={e => setExcuseComment(e.target.value)}
                  placeholder={isRu ? 'Причина, приказ №...' : 'Sababi, buyruq raqami va h.k...'}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 9,
                    border: '1px solid var(--border-3)', background: 'var(--bg)',
                    color: 'var(--text-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-2)' }}>
                  {isRu ? 'Документ (Справка / Рапорт / другое - Необязательно)' : 'Hujjat (Spravka / Hujjat / boshqa - Ixtiyoriy)'}
                </label>
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px',
                    borderRadius: 9,
                    border: '2px dashed var(--border-3)',
                    background: 'var(--bg)',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s, background-color 0.2s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.backgroundColor = 'var(--surface-2)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border-3)';
                    e.currentTarget.style.backgroundColor = 'var(--bg)';
                  }}
                  onClick={() => document.getElementById('excuse-file-input').click()}
                >
                  <input
                    id="excuse-file-input"
                    type="file"
                    onChange={e => setExcuseDocument(e.target.files[0] || null)}
                    style={{ display: 'none' }}
                  />
                  {excuseDocument ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        background: 'rgba(16, 185, 129, 0.12)',
                        color: '#10b981',
                        fontSize: 16,
                        flexShrink: 0
                      }}>
                        📄
                      </div>
                      <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, color: 'var(--text-1)' }} title={excuseDocument.name}>
                        {excuseDocument.name}
                        <div style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 2 }}>
                          {Math.round(excuseDocument.size / 1024)} KB
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExcuseDocument(null);
                          document.getElementById('excuse-file-input').value = '';
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: 4,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'none'}
                      >
                        <DismissRegular fontSize={14} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 24, marginBottom: 4 }}>📤</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                        {isRu ? 'Выберите файл' : 'Faylni tanlash'}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 2 }}>
                        {isRu ? 'PDF, JPG, PNG или другие форматы' : 'PDF, JPG, PNG yoki boshqa formatlar'}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Buttons */}
              <div style={{
                display: 'flex', justifyContent: 'flex-end', gap: 10,
                marginTop: 10, paddingTop: 14, borderTop: '1px solid var(--border)'
              }}>
                <button
                  type="button"
                  onClick={() => setExcuseModalOpen(false)}
                  style={{
                    background: 'transparent', border: '1px solid var(--border-2)',
                    color: 'var(--text-1)', padding: '8px 16px', borderRadius: 7,
                    cursor: 'pointer', fontSize: 13, fontWeight: 600
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {isRu ? 'Отмена' : 'Bekor qilish'}
                </button>
                <button
                  type="submit"
                  disabled={savingExcuse}
                  style={{
                    background: 'var(--accent)',
                    color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 7,
                    cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    opacity: savingExcuse ? 0.7 : 1
                  }}
                >
                  {savingExcuse ? (isRu ? 'Сохранение...' : 'Saqlanmoqda...') : (isRu ? 'Сохранить' : 'Saqlash')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Keyframe animations */}
      <style>{`
        @keyframes bfModalIn {
          from { opacity: 0; transform: scale(0.96) translateY(5px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
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

const cardStyle = { 
  background: 'var(--surface)', 
  border: '1px solid var(--border)', 
  borderRadius: 12, 
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 16
}

const cardTitleStyle = { 
  fontSize: 16, 
  fontWeight: 700, 
  display: 'flex', 
  alignItems: 'center', 
  gap: 8, 
  margin: 0,
  color: 'var(--text-1)'
}

const toolbarStyle = { 
  display: 'flex', 
  justifyContent: 'space-between', 
  alignItems: 'center', 
  gap: 16, 
  flexWrap: 'wrap', 
  marginBottom: 14 
}

const tableStyle = { 
  width: '100%', 
  borderCollapse: 'separate', 
  borderSpacing: 0, 
  fontSize: 13 
}

const thStyle = {
  textAlign: 'left', 
  padding: '12px 10px', 
  fontSize: 11,
  fontWeight: 700, 
  color: 'var(--text-4)', 
  textTransform: 'uppercase',
  letterSpacing: 0.4, 
  borderBottom: '1px solid var(--border)', 
  whiteSpace: 'nowrap',
}

const tdStyle = { 
  padding: '12px 10px', 
  borderBottom: '1px solid var(--border)', 
  verticalAlign: 'middle' 
}

const emptyStyle = { 
  padding: 40, 
  textAlign: 'center', 
  color: 'var(--text-4)', 
  fontSize: 13, 
  background: 'var(--bg)', 
  borderRadius: 8, 
  border: '1px dashed var(--border-2)' 
}
