import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  MoneyRegular,
  CheckmarkCircleRegular,
  WarningRegular,
  ClockRegular,
  ArrowSyncRegular,
  SearchRegular,
  EyeRegular,
  DismissRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import { useToast } from '../components/Toaster'
import CustomSelect from '../components/CustomSelect'

export default function Salary() {
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const toast = useToast()
  const navigate = useNavigate()

  const [salaries, setSalaries] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [refreshing, setRefreshing] = useState(false)

  const [orgs, setOrgs] = useState([])
  const [branches, setBranches] = useState([])
  const [orgFilter, setOrgFilter] = useState('all')
  const [branchFilter, setBranchFilter] = useState('all')
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [payModal, setPayModal] = useState({ open: false, id: null, name: null, finalAmount: 0, status: null })

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

  const handleView = (emp) => {
    navigate(`/finance/salary/${emp.uuid || emp.id}`)
  }

  // Calculate salary metrics
  const stats = useMemo(() => {
    let totalBase = 0
    let totalDeductions = 0
    let totalFinal = 0
    let paidSum = 0
    let unpaidSum = 0

    salaries.forEach(s => {
      const lateDeduction = s.lateDeduction !== undefined ? s.lateDeduction : (s.lateCount * 50000)
      const absentDeduction = s.absentDeduction || 0
      const deduction = lateDeduction + absentDeduction
      const finalAmount = s.finalAmount !== undefined ? s.finalAmount : (s.base - deduction)

      totalBase += s.base
      totalDeductions += deduction
      totalFinal += finalAmount

      if (s.status === 'paid') {
        paidSum += finalAmount
      } else if (s.status === 'advance') {
        const advPaid = Math.floor(finalAmount / 2)
        paidSum += advPaid
        unpaidSum += (finalAmount - advPaid)
      } else {
        unpaidSum += finalAmount
      }
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

  const handlePayClick = (emp) => {
    setPayModal({
      open: true,
      id: emp.uuid || emp.id,
      name: emp.name,
      finalAmount: emp.finalAmount,
      status: emp.status
    })
  }

  const handlePayConfirm = async (id, name, type) => {
    try {
      const res = await fetch(`/api/finance/salaries/${id}/pay?pay_type=${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.ok) {
        setSalaries(prev => prev.map(s => {
          if (String(s.id) === String(id) || s.uuid === id) {
            return { ...s, status: type === 'advance' ? 'advance' : 'paid' }
          }
          return s
        }))
        const typeLabel = type === 'advance' ? (isRu ? 'Аванс' : 'Avans') : (isRu ? 'Оклад' : 'To\'liq oylik')
        toast.success(isRu ? `${typeLabel} для xодима "${name}" выплачен` : `"${name}" uchun ${typeLabel.toLowerCase()} to'landi`)
      } else {
        throw new Error('Payment failed')
      }
    } catch (err) {
      toast.error(isRu ? 'Ошибка при выплате' : 'To\'lov qilishda xatolik yuz berdi')
    } finally {
      setPayModal({ open: false, id: null, name: null, finalAmount: 0, status: null })
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
        @keyframes fadeInOverlay {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleInModal {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
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
              <span style={{ fontSize: 13, color: 'var(--text-4)', fontWeight: 500 }}>{isRu ? 'ШТРАФЫ И ВЫЧЕТЫ' : 'JARIMALAR VA CHEGIRMALAR'}</span>
              <div style={{ padding: 6, borderRadius: 8, background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                <ClockRegular fontSize={20} />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b' }}>{formatMoney(stats.totalDeductions)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>
              {isRu ? 'На основе опозданий и пропусков' : 'Kechikishlar va kelmagan kunlar uchun'}
            </div>
          </div>
        </div>

        {/* Filter Toolbar & Table */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
            {/* Organization filter */}
            {(isSuperAdmin || orgs.length > 1) && (
              <div style={{ minWidth: 220, flex: 1 }}>
                <CustomSelect
                  value={orgFilter}
                  onChange={val => {
                    setOrgFilter(val || 'all')
                    setBranchFilter('all')
                  }}
                  options={orgOptions}
                  placeholder={isRu ? 'Все организации' : 'Barcha tashkilotlar'}
                />
              </div>
            )}

            {/* Branch filter */}
            {(isSuperAdmin || filteredBranches.length > 0) && (
              <div style={{ minWidth: 220, flex: 1 }}>
                <CustomSelect
                  value={branchFilter}
                  onChange={val => setBranchFilter(val || 'all')}
                  options={branchOptions}
                  placeholder={isRu ? 'Все филиалы' : 'Barcha filiallar'}
                />
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
                  <th style={{ padding: '12px 16px', fontWeight: 600, width: 40 }}>#</th>
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
                    <td colSpan={8} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-4)', fontSize: 13.5 }}>
                      {isRu ? 'Сотрудники не найдены' : 'Xodimlar topilmadi'}
                    </td>
                  </tr>
                ) : (
                  filteredSalaries.map((s, idx) => {
                    const lateDeduction = s.lateDeduction !== undefined ? s.lateDeduction : (s.lateCount * 50000)
                    const absentDeduction = s.absentDeduction || 0
                    const deduction = lateDeduction + absentDeduction
                    const finalAmount = s.finalAmount !== undefined ? s.finalAmount : (s.base - deduction)
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border-2)', fontSize: 13, color: 'var(--text-2)' }}>
                        <td style={{ padding: '14px 16px', color: 'var(--text-4)' }}>{idx + 1}</td>
                        <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-1)' }}>{s.name}</td>
                        <td style={{ padding: '14px 16px' }}>{s.role}</td>
                        <td style={{ padding: '14px 16px', fontWeight: 600 }}>{formatMoney(s.base)}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {lateDeduction > 0 && (
                              <span style={{ fontSize: 11.5, color: '#f59e0b', fontWeight: 600 }}>
                                ⏰ {s.lateCount} {isRu ? 'опозд.' : 'marta kechikkan'} (-{formatMoney(lateDeduction)})
                              </span>
                            )}
                            {absentDeduction > 0 && (
                              <span style={{ fontSize: 11.5, color: '#ef4444', fontWeight: 600 }}>
                                ❌ {s.absentCount} {isRu ? 'дн. отсут.' : 'kun kelmagan'} (-{formatMoney(absentDeduction)})
                              </span>
                            )}
                            {lateDeduction === 0 && absentDeduction === 0 && (
                              <span style={{ color: 'var(--text-4)' }}>—</span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-1)' }}>{formatMoney(finalAmount)}</td>
                        <td style={{ padding: '14px 16px' }}>
                          {s.status === 'paid' && (
                            <span style={statusPaid}>
                              {isRu ? 'Выплачено' : 'To\'langan'}
                            </span>
                          )}
                          {s.status === 'advance' && (
                            <span style={statusAdvance}>
                              {isRu ? 'Аванс (50%)' : 'Avans (50%)'}
                            </span>
                          )}
                          {s.status === 'unpaid' && (
                            <span style={statusPending}>
                              {isRu ? 'Ожидается' : 'To\'lanmagan'}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                            <button
                              onClick={() => handleView(s)}
                              style={{
                                background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text-2)',
                                padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', gap: 6
                              }}
                            >
                              <EyeRegular fontSize={14} />
                              {isRu ? 'Просмотр' : 'Ko\'rish'}
                            </button>
                            {s.status !== 'paid' && (
                              <button
                                onClick={() => handlePayClick(s)}
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

      </div>

      {payModal.open && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                {isRu ? 'Выплата заработной платы' : 'Ish haqini to\'lash'}
              </h3>
              <button
                onClick={() => setPayModal({ open: false, id: null, name: null, finalAmount: 0, status: null })}
                style={closeBtnStyle}
              >
                <DismissRegular fontSize={18} />
              </button>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 6 }}>
                {isRu ? 'Сотрудник:' : 'Xodim:'}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginBottom: 16 }}>
                {payModal.name}
              </div>

              <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-3)' }}>{isRu ? 'Sof ish haqi:' : 'Sof ish haqi:'}</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-1)' }}>{formatMoney(payModal.finalAmount)}</span>
                </div>
                {payModal.status === 'advance' ? (
                  <div style={{ borderTop: '1px solid var(--border-2)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-3)' }}>{isRu ? 'Оплачено (Аванс 50%):' : 'To\'langan (Avans 50%):'}</span>
                    <span style={{ fontWeight: 700, color: '#10b981' }}>{formatMoney(Math.floor(payModal.finalAmount / 2))}</span>
                  </div>
                ) : (
                  <div style={{ borderTop: '1px solid var(--border-2)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-3)' }}>{isRu ? 'Сумма аванса (50%):' : 'Avans miqdori (50%):'}</span>
                    <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{formatMoney(Math.floor(payModal.finalAmount / 2))}</span>
                  </div>
                )}
                {payModal.status === 'advance' && (
                  <div style={{ borderTop: '1px solid var(--border-2)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-3)' }}>{isRu ? 'Остаток к выплате:' : 'Qolgan to\'lov summasi:'}</span>
                    <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{formatMoney(payModal.finalAmount - Math.floor(payModal.finalAmount / 2))}</span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {payModal.status !== 'advance' && (
                <button
                  onClick={() => handlePayConfirm(payModal.id, payModal.name, 'advance')}
                  style={payAdvanceBtnStyle}
                >
                  💸 {isRu ? 'Выплатить аванс (50%)' : 'Avans to\'lash (50%)'}
                </button>
              )}
              <button
                onClick={() => handlePayConfirm(payModal.id, payModal.name, 'full')}
                style={payFullBtnStyle}
              >
                💰 {payModal.status === 'advance' 
                  ? (isRu ? 'Выплатить остаток (50%)' : 'Qolgan qismini to\'lash (50%)') 
                  : (isRu ? 'Выплатить полностью (100%)' : 'To\'liq to\'lash (100%)')
                }
              </button>
              <button
                onClick={() => setPayModal({ open: false, id: null, name: null, finalAmount: 0, status: null })}
                style={cancelBtnStyle}
              >
                {isRu ? 'Отмена' : 'Bekor qilish'}
              </button>
            </div>
          </div>
        </div>
      )}
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

const statusAdvance = {
  padding: '3px 8px',
  borderRadius: 6,
  fontSize: 11.5,
  fontWeight: 600,
  background: 'rgba(245,158,11,0.12)',
  color: '#f59e0b',
  whiteSpace: 'nowrap',
}

const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.6)',
  backdropFilter: 'blur(6px)',
  zIndex: 10000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  animation: 'fadeInOverlay 0.2s ease-out',
}

const modalContentStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: 24,
  width: '100%',
  maxWidth: 420,
  boxShadow: 'var(--shadow-lg)',
  boxSizing: 'border-box',
  animation: 'scaleInModal 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
}

const closeBtnStyle = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-3)',
  cursor: 'pointer',
  padding: 4,
  display: 'flex',
  alignItems: 'center',
}

const payAdvanceBtnStyle = {
  background: 'rgba(245, 158, 11, 0.1)',
  border: '1px solid rgba(245, 158, 11, 0.2)',
  color: '#f59e0b',
  padding: '12px',
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  width: '100%',
}

const payFullBtnStyle = {
  background: 'var(--accent)',
  border: 'none',
  color: '#fff',
  padding: '12px',
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  width: '100%',
}

const cancelBtnStyle = {
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid var(--border)',
  color: 'var(--text-3)',
  padding: '10px',
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  width: '100%',
  marginTop: 4,
}
