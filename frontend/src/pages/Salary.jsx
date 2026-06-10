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
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
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
