import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MoneyRegular,
  CheckmarkCircleRegular,
  WarningRegular,
  ClockRegular,
  ArrowSyncRegular,
  SearchRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import { useToast } from '../components/Toaster'

export default function Salary() {
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const toast = useToast()

  const [salaries, setSalaries] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [refreshing, setRefreshing] = useState(false)

  const [orgs, setOrgs] = useState([])
  const [branches, setBranches] = useState([])
  const [orgFilter, setOrgFilter] = useState('all')
  const [branchFilter, setBranchFilter] = useState('all')
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  // Modal States
  const [selectedEmp, setSelectedEmp] = useState(null)
  const [calendarData, setCalendarData] = useState(null)
  const [loadingCalendar, setLoadingCalendar] = useState(false)
  const [showModal, setShowModal] = useState(false)

  const loadSalaries = async () => {
    try {
      const params = new URLSearchParams()
      if (orgFilter !== 'all') params.set('organization_id', orgFilter)
      if (branchFilter !== 'all') params.set('branch_id', branchFilter)
      
      const res = await fetch(`/api/finance/salaries?${params.toString()}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setSalaries(data.salaries || [])
      }
    } catch (err) {
      console.error('Failed to load salaries:', err)
    }
  }

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [filterRes, meRes] = await Promise.all([
          fetch('/api/attendance/filter-data', { credentials: 'include' }),
          fetch('/api/auth/me', { credentials: 'include' }),
        ])
        
        if (filterRes.ok) {
          const data = await filterRes.json()
          setOrgs(data?.organizations || [])
          setBranches(data?.branches || [])
        }
        
        if (meRes.ok) {
          const meData = await meRes.json()
          const role = String(meData.role || '').toLowerCase()
          const superAdmin = role === 'super_admin' || role === 'superadmin'
          setIsSuperAdmin(superAdmin)
        }
      } catch (err) {
        console.error('Failed to load filters:', err)
      }
    }
    loadFilters()
  }, [])

  useEffect(() => {
    loadSalaries()
  }, [orgFilter, branchFilter])

  const filteredBranches = useMemo(() => {
    if (orgFilter === 'all') return branches
    return branches.filter(b => String(b.organization_id) === String(orgFilter))
  }, [branches, orgFilter])

  const handleView = async (emp) => {
    setSelectedEmp(emp)
    setShowModal(true)
    setLoadingCalendar(true)
    try {
      const res = await fetch(`/api/employees/${emp.id}/attendance-calendar`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setCalendarData(data)
      }
    } catch (err) {
      console.error('Failed to load attendance calendar:', err)
    } finally {
      setLoadingCalendar(false)
    }
  }

  // Calculate salary metrics
  // Each late arrival deducts 50,000 UZS
  const stats = useMemo(() => {
    let totalBase = 0
    let totalDeductions = 0
    let totalFinal = 0
    let paidSum = 0
    let unpaidSum = 0

    salaries.forEach(s => {
      const deduction = s.lateCount * 50000
      const finalAmount = s.base - deduction

      totalBase += s.base
      totalDeductions += deduction
      totalFinal += finalAmount

      if (s.status === 'paid') paidSum += finalAmount
      else unpaidSum += finalAmount
    })

    return { totalBase, totalDeductions, totalFinal, paidSum, unpaidSum }
  }, [salaries])

  const filteredSalaries = useMemo(() => {
    const q = search.trim().toLowerCase()
    return salaries.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(q) || s.role.toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [salaries, search, statusFilter])

  const formatMoney = (val) => {
    return new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS', maximumFractionDigits: 0 }).format(val)
  }

  const formatDateDay = (dateStr) => {
    if (!dateStr) return ''
    const parts = dateStr.split('-')
    if (parts.length < 3) return dateStr
    const day = parseInt(parts[2], 10)
    const monthIndex = parseInt(parts[1], 10) - 1
    const monthsUz = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr']
    const monthsRu = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
    const monthName = isRu ? monthsRu[monthIndex] : monthsUz[monthIndex]
    return `${day}-${monthName}`
  }

  const formatVariance = (workedSec, expectedSec) => {
    const diff = workedSec - expectedSec
    if (diff === 0) return '0'
    const sign = diff > 0 ? '+' : '-'
    const absDiff = Math.abs(diff)
    const hours = Math.floor(absDiff / 3600)
    const minutes = Math.floor((absDiff % 3600) / 60)
    
    let text = ''
    if (hours > 0) text += `${hours}s `
    if (minutes > 0 || hours === 0) text += `${minutes}d`
    return `${sign}${text}`
  }

  const formatDuration = (sec) => {
    if (!sec) return '0d'
    const hours = Math.floor(sec / 3600)
    const minutes = Math.floor((sec % 3600) / 60)
    let text = ''
    if (hours > 0) text += `${hours}s `
    if (minutes > 0 || hours === 0) text += `${minutes}d`
    return text
  }

  const detailedStats = useMemo(() => {
    if (!calendarData || !calendarData.days) return null

    let totalWorkedSeconds = 0
    let totalExpectedSeconds = 0
    let overtimeSeconds = 0
    let undertimeSeconds = 0
    let onTimeDays = 0
    let lateDays = 0
    let absentDays = 0
    let presentDays = 0
    let holidayDays = 0

    calendarData.days.forEach(day => {
      if (day.status === 'holiday') {
        holidayDays++
        return
      }

      if (!day.present) {
        absentDays++
        return
      }

      presentDays++
      if (day.late_minutes > 0) {
        lateDays++
      } else {
        onTimeDays++
      }

      // Calculate expected duration
      const start = new Date(day.expected_time)
      const end = new Date(day.expected_end_time)
      const expectedDiff = Math.max(0, (end - start) / 1000) // in seconds
      totalExpectedSeconds += expectedDiff

      totalWorkedSeconds += day.worked_seconds

      const diff = day.worked_seconds - expectedDiff
      if (diff > 0) {
        overtimeSeconds += diff
      } else {
        undertimeSeconds += Math.abs(diff)
      }
    })

    // 1 hour of overtime earns 30,000 UZS
    const overtimeHours = overtimeSeconds / 3600
    const overtimeBonus = Math.round(overtimeHours * 30000)

    // Late penalty is 50,000 UZS
    const latePenalty = lateDays * 50000

    return {
      totalWorkedSeconds,
      totalExpectedSeconds,
      overtimeSeconds,
      undertimeSeconds,
      onTimeDays,
      lateDays,
      absentDays,
      presentDays,
      holidayDays,
      overtimeHours,
      overtimeBonus,
      latePenalty
    }
  }, [calendarData])

  const handlePay = async (id, name) => {
    try {
      const res = await fetch(`/api/finance/salaries/${id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.ok) {
        setSalaries(prev => prev.map(s => {
          if (s.id === id) {
            return { ...s, status: 'paid' }
          }
          return s
        }))
        toast.success(isRu ? `Оклад для xодима "${name}" выплачен` : `"${name}" uchun oylik to'landi`)
      } else {
        throw new Error('Payment failed')
      }
    } catch (err) {
      toast.error(isRu ? 'Ошибка при выплате' : 'To\'lov qilishda xatolik yuz berdi')
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadSalaries()
    setRefreshing(false)
    toast.success(isRu ? 'Данные по окладам обновлены' : 'Ish haqi ma\'lumotlari yangilandi')
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={isRu ? '✦ Финансы' : '✦ Moliya'}
        title={isRu ? 'Заработная плата' : 'Xodimlar ish haqi'}
        sub={isRu ? 'Управление окладами, выплатами и штрафами за опоздания' : 'Ish haqi, to\'lovlar va kechikishlar uchun jarimalar nazorati'}
        right={
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 16px', borderRadius: 8,
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              opacity: refreshing ? 0.6 : 1,
            }}
          >
            <ArrowSyncRegular fontSize={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            {isRu ? 'Обновить' : 'Yangilash'}
          </button>
        }
      />

      <style>{`
        .salary-container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 24px 32px 80px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        @media (max-width: 900px) {
          .salary-container {
            padding: 16px 16px 60px !important;
            gap: 16px !important;
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div className="salary-container">
        {/* Salary Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text-4)', fontWeight: 500 }}>{isRu ? 'ОБЩИЙ ФОНД ОПЛАТЫ' : 'JAMI ISH HAQI FONDI'}</span>
              <div style={{ padding: 6, borderRadius: 8, background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
                <MoneyRegular fontSize={20} />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{formatMoney(stats.totalFinal)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>
              {isRu ? 'Базовый:' : 'Asosiy:'} {formatMoney(stats.totalBase)}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text-4)', fontWeight: 500 }}>{isRu ? 'ВЫПЛАЧЕНО' : 'TO\'LANGAN ISH HAQI'}</span>
              <div style={{ padding: 6, borderRadius: 8, background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                <CheckmarkCircleRegular fontSize={20} />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>{formatMoney(stats.paidSum)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>
              {((stats.paidSum / (stats.totalFinal || 1)) * 100).toFixed(1)}% {isRu ? 'выплачено' : 'to\'lab berildi'}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text-4)', fontWeight: 500 }}>{isRu ? 'К ВЫПЛАТЕ' : 'TO\'LANISHI KERAK'}</span>
              <div style={{ padding: 6, borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                <WarningRegular fontSize={20} />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#ef4444' }}>{formatMoney(stats.unpaidSum)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>
              {((stats.unpaidSum / (stats.totalFinal || 1)) * 100).toFixed(1)}% {isRu ? 'ожидает перевода' : 'to\'lov kutilmoqda'}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text-4)', fontWeight: 500 }}>{isRu ? 'ШТРАФЫ ЗА ОПОЗДАНИЯ' : 'KECHIKISH UCHUN JARIMA'}</span>
              <div style={{ padding: 6, borderRadius: 8, background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                <ClockRegular fontSize={20} />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b' }}>{formatMoney(stats.totalDeductions)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>
              {isRu ? 'На основе логов давомата' : 'Davomat loglari asosida'}
            </div>
          </div>
        </div>

        {/* Filter Toolbar & Table */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
            {/* Organization filter */}
            {(isSuperAdmin || orgs.length > 1) && (
              <div style={{ minWidth: 200, flex: 1 }}>
                <select
                  value={orgFilter}
                  onChange={e => {
                    setOrgFilter(e.target.value)
                    setBranchFilter('all')
                  }}
                  style={selectStyle}
                >
                  <option value="all">{isRu ? 'Все организации' : 'Barcha tashkilotlar'}</option>
                  {orgs.map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Branch filter */}
            {(isSuperAdmin || filteredBranches.length > 0) && (
              <div style={{ minWidth: 200, flex: 1 }}>
                <select
                  value={branchFilter}
                  onChange={e => setBranchFilter(e.target.value)}
                  style={selectStyle}
                >
                  <option value="all">{isRu ? 'Все филиалы' : 'Barcha filiallar'}</option>
                  {filteredBranches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Search */}
            <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
              <SearchRegular fontSize={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={isRu ? 'Поиск по имени или должности...' : 'Ism yoki lavozim bo\'yicha qidirish...'}
                style={{
                  width: '100%', padding: '9px 12px 9px 36px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Filter */}
            <div style={{ display: 'flex', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 3 }}>
              {[
                { id: 'all', label: isRu ? 'Все' : 'Barchasi' },
                { id: 'paid', label: isRu ? 'Выплачено' : 'To\'langan' },
                { id: 'unpaid', label: isRu ? 'Ожидается' : 'To\'lanmagan' },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setStatusFilter(item.id)}
                  style={{
                    padding: '6px 14px', borderRadius: 6, border: 'none',
                    background: statusFilter === item.id ? 'var(--accent)' : 'transparent',
                    color: statusFilter === item.id ? '#fff' : 'var(--text-3)',
                    fontSize: 12.5, fontWeight: statusFilter === item.id ? 600 : 400, cursor: 'pointer',
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-4)', fontSize: 12.5 }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Сотрудник' : 'Xodim'}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Должность' : 'Lavozim'}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Оклад' : 'Asosiy oylik'}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Опоздания / Штраф' : 'Kechikish / Jarima'}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Итого к выплате' : 'Sof oylik'}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Статус' : 'Holat'}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredSalaries.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-4)', fontSize: 13.5 }}>
                      {isRu ? 'Сотрудники не найдены' : 'Xodimlar topilmadi'}
                    </td>
                  </tr>
                ) : (
                  filteredSalaries.map(s => {
                    const deduction = s.lateCount * 50000
                    const finalAmount = s.base - deduction
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border-2)', fontSize: 13, color: 'var(--text-2)' }}>
                        <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-1)' }}>{s.name}</td>
                        <td style={{ padding: '14px 16px' }}>{s.role}</td>
                        <td style={{ padding: '14px 16px', fontWeight: 600 }}>{formatMoney(s.base)}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 11, color: s.lateCount > 0 ? '#f59e0b' : 'var(--text-4)' }}>
                              {s.lateCount} {isRu ? 'опозданий' : 'marta kechikkan'}
                            </span>
                            {deduction > 0 && (
                              <span style={{ color: '#ef4444', fontWeight: 600, fontSize: 11.5 }}>
                                -{formatMoney(deduction)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-1)' }}>{formatMoney(finalAmount)}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={s.status === 'paid' ? statusPaid : statusPending}>
                            {s.status === 'paid' ? (isRu ? 'Выплачено' : 'To\'langan') : (isRu ? 'Ожидается' : 'To\'lanmagan')}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                            <button
                              onClick={() => handleView(s)}
                              style={{
                                background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text-2)',
                                padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              👁️ {isRu ? 'Просмотр' : 'Ko\'rish'}
                            </button>
                            {s.status !== 'paid' && (
                              <button
                                onClick={() => handlePay(s.id, s.name)}
                                style={{
                                  background: 'var(--accent)', border: 'none', color: '#fff',
                                  padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer'
                                }}
                              >
                                {isRu ? 'Выплатить' : 'To\'lash'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail Modal */}
        {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1000, padding: 20
        }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 16, width: '100%', maxWidth: 840, display: 'flex',
            flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)', animation: 'fadeIn 0.2s ease'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '20px 24px', borderBottom: '1px solid var(--border)'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                  {selectedEmp?.name}
                </h3>
                <span style={{ fontSize: 12.5, color: 'var(--text-4)', display: 'block', marginTop: 4 }}>
                  💼 {selectedEmp?.role}
                </span>
              </div>
              <button
                onClick={() => {
                  setShowModal(false)
                  setCalendarData(null)
                }}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--text-3)',
                  width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                  fontWeight: 700, transition: 'all 0.15s'
                }}
                onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.12)'}
                onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.06)'}
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {loadingCalendar ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 16 }}>
                  <div style={{
                    width: 40, height: 40, border: '3px solid var(--border)',
                    borderTopColor: 'var(--accent)', borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
                    {isRu ? 'Загрузка данных посещаемости...' : 'Davomat ma\'lumotlari yuklanmoqda...'}
                  </span>
                </div>
              ) : calendarData && detailedStats ? (
                <>
                  {/* Attendance Stats Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
                    <div style={modalStatCardStyle}>
                      <span style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600 }}>{isRu ? 'ПРИСУТСТВИЕ' : 'KELGAN KUNLARI'}</span>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981', marginTop: 4 }}>
                        {detailedStats.presentDays} {isRu ? 'дн.' : 'kun'}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-4)' }}>
                        {isRu ? 'Пропущено:' : 'Kelmagan:'} {detailedStats.absentDays} {isRu ? 'дн.' : 'kun'}
                      </span>
                    </div>

                    <div style={modalStatCardStyle}>
                      <span style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600 }}>{isRu ? 'ВОвремя' : 'VAQTIDA KELGAN'}</span>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#3b82f6', marginTop: 4 }}>
                        {detailedStats.onTimeDays} {isRu ? 'дн.' : 'kun'}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-4)' }}>
                        {isRu ? 'Опоздания:' : 'Kechikkan:'} {detailedStats.lateDays} {isRu ? 'дн.' : 'kun'}
                      </span>
                    </div>

                    <div style={modalStatCardStyle}>
                      <span style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600 }}>{isRu ? 'СВЕРХУРОЧНО' : 'QO\'SHIMCHA VAQT'}</span>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#f59e0b', marginTop: 4 }}>
                        {formatDuration(detailedStats.overtimeSeconds)}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-4)' }}>
                        {isRu ? 'Недоработка:' : 'Kam ishlangan:'} {formatDuration(detailedStats.undertimeSeconds)}
                      </span>
                    </div>

                    <div style={modalStatCardStyle}>
                      <span style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600 }}>{isRu ? 'ИТОГО К ВЫПЛАТЕ' : 'SOF ISH HAQI'}</span>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginTop: 4 }}>
                        {formatMoney(Math.max(0, (selectedEmp?.base || 0) + detailedStats.overtimeBonus - detailedStats.latePenalty))}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-4)' }}>
                        {isRu ? 'Базовый:' : 'Asosiy:'} {formatMoney(selectedEmp?.base || 0)}
                      </span>
                    </div>
                  </div>

                  {/* Financial Details Box */}
                  <div style={{
                    background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
                    borderRadius: 12, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', borderBottom: '1px solid var(--border-2)', paddingBottom: 8 }}>
                      {isRu ? 'Финансовый расчет за месяц' : 'Bir oylik moliyaviy hisob-kitob'}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-3)' }}>{isRu ? 'Оклад (базовый)' : 'Asosiy oylik (shtat):'}</span>
                      <span style={{ fontWeight: 600 }}>{formatMoney(selectedEmp?.base || 0)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-3)' }}>
                        ➕ {isRu ? 'Бонус за сверхурочные' : 'Qo\'shimcha ishlangan vaqt uchun (Bonus):'}
                        <span style={{ fontSize: 11, color: 'var(--text-4)', marginLeft: 6 }}>
                          ({formatDuration(detailedStats.overtimeSeconds)} × 30,000 UZS/soat)
                        </span>
                      </span>
                      <span style={{ color: '#10b981', fontWeight: 600 }}>+{formatMoney(detailedStats.overtimeBonus)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-3)' }}>
                        ➖ {isRu ? 'Штраф за опоздания' : 'Kechikkan kunlar uchun (Jarima):'}
                        <span style={{ fontSize: 11, color: 'var(--text-4)', marginLeft: 6 }}>
                          ({detailedStats.lateDays} marta × 50,000 UZS)
                        </span>
                      </span>
                      <span style={{ color: '#ef4444', fontWeight: 600 }}>-{formatMoney(detailedStats.latePenalty)}</span>
                    </div>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800,
                      borderTop: '1px solid var(--border-2)', paddingTop: 10, marginTop: 4
                    }}>
                      <span>{isRu ? 'Итоговая сумма к выплате' : 'To\'lanadigan yakuniy ish haqi:'}</span>
                      <span style={{ color: 'var(--accent)' }}>
                        {formatMoney(Math.max(0, (selectedEmp?.base || 0) + detailedStats.overtimeBonus - detailedStats.latePenalty))}
                      </span>
                    </div>
                  </div>

                  {/* Daily Details Table */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>
                      {isRu ? 'Подробный отчет по дням' : 'Kunlik batafsil hisobot'}
                    </div>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12.5 }}>
                          <thead>
                            <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', color: 'var(--text-4)' }}>
                              <th style={{ padding: '10px 14px', fontWeight: 600 }}>{isRu ? 'День' : 'Kun'}</th>
                              <th style={{ padding: '10px 14px', fontWeight: 600 }}>{isRu ? 'Статус' : 'Holat'}</th>
                              <th style={{ padding: '10px 14px', fontWeight: 600 }}>{isRu ? 'Режим' : 'Smen vaqti'}</th>
                              <th style={{ padding: '10px 14px', fontWeight: 600 }}>{isRu ? 'Приход/Уход' : 'Kelish/Ketish'}</th>
                              <th style={{ padding: '10px 14px', fontWeight: 600 }}>{isRu ? 'Отработано' : 'Ishlangan vaqt'}</th>
                              <th style={{ padding: '10px 14px', fontWeight: 600 }}>{isRu ? 'Разница' : 'Farq'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {calendarData.days.map((day, idx) => {
                              const expStart = day.expected_time ? day.expected_time.split('T')[1]?.substring(0, 5) : '09:00'
                              const expEnd = day.expected_end_time ? day.expected_end_time.split('T')[1]?.substring(0, 5) : '18:00'
                              const actStart = day.first_seen ? day.first_seen.split('T')[1]?.substring(0, 5) : '--:--'
                              const actEnd = day.last_seen ? day.last_seen.split('T')[1]?.substring(0, 5) : '--:--'

                              const startDt = new Date(day.expected_time)
                              const endDt = new Date(day.expected_end_time)
                              const expSec = Math.max(0, (endDt - startDt) / 1000)

                              let badge = <span style={modalBadgeGray}>{isRu ? 'Выходной' : 'Dam olish'}</span>
                              if (day.status === 'present') {
                                badge = <span style={modalBadgeGreen}>✅ {isRu ? 'Вовремя' : 'Vaqtida'}</span>
                              } else if (day.status === 'late') {
                                badge = <span style={modalBadgeYellow}>⚠️ {isRu ? 'Опоздал' : 'Kechikdi'}</span>
                              } else if (day.status === 'absent') {
                                badge = <span style={modalBadgeRed}>❌ {isRu ? 'Не пришел' : 'Kelmagan'}</span>
                              }

                              const diffSec = day.worked_seconds - expSec

                              return (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--border-2)', background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                                  <td style={{ padding: '12px 14px', fontWeight: 600 }}>{formatDateDay(day.date)}</td>
                                  <td style={{ padding: '12px 14px' }}>{badge}</td>
                                  <td style={{ padding: '12px 14px', color: 'var(--text-3)' }}>{expStart} - {expEnd}</td>
                                  <td style={{ padding: '12px 14px', fontWeight: 500 }}>
                                    {day.present ? `${actStart} - ${actEnd}` : '--'}
                                  </td>
                                  <td style={{ padding: '12px 14px', fontWeight: 600 }}>
                                    {day.present ? formatDuration(day.worked_seconds) : '--'}
                                  </td>
                                  <td style={{ padding: '12px 14px', fontWeight: 700 }}>
                                    {!day.present ? '--' : (
                                      <span style={{ color: diffSec >= 0 ? '#10b981' : '#ef4444' }}>
                                        {formatVariance(day.worked_seconds, expSec)}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-4)' }}>
                  {isRu ? 'Не удалось загрузить календарь' : 'Taqvim ma\'lumotlarini yuklab bo\'lmadi'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

const cardStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 20,
}

const statusPaid = {
  padding: '3px 8px',
  borderRadius: 6,
  fontSize: 11.5,
  fontWeight: 600,
  background: 'rgba(16,185,129,0.12)',
  color: '#10b981',
}

const statusPending = {
  padding: '3px 8px',
  borderRadius: 6,
  fontSize: 11.5,
  fontWeight: 600,
  background: 'rgba(239,68,68,0.12)',
  color: '#ef4444',
}

const selectStyle = {
  padding: '9px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text-1)',
  fontSize: 13,
  outline: 'none',
  width: '100%',
  cursor: 'pointer',
}

const modalStatCardStyle = {
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '12px 16px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  minHeight: 80,
}

const modalBadgeGreen = {
  padding: '3px 8px',
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  background: 'rgba(16,185,129,0.12)',
  color: '#10b981',
  whiteSpace: 'nowrap'
}

const modalBadgeYellow = {
  padding: '3px 8px',
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  background: 'rgba(245,158,11,0.12)',
  color: '#f59e0b',
  whiteSpace: 'nowrap'
}

const modalBadgeRed = {
  padding: '3px 8px',
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  background: 'rgba(239,68,68,0.12)',
  color: '#ef4444',
  whiteSpace: 'nowrap'
}

const modalBadgeGray = {
  padding: '3px 8px',
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--text-3)',
  whiteSpace: 'nowrap'
}
