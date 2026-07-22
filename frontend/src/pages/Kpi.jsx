import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  StarRegular,
  CheckmarkCircleRegular,
  RewardRegular,
  ArrowSyncRegular,
  SearchRegular,
  DismissRegular,
  DocumentCopyRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import { useToast } from '../components/Toaster'
import Skeleton from '../components/Skeleton'

export default function Kpi() {
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const toast = useToast()

  const [kpis, setKpis] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [awardedList, setAwardedList] = useState([])

  const [rewardModal, setRewardModal] = useState({ open: false, emp: null, amount: '', comment: '' })

  const loadKpis = async () => {
    try {
      const res = await fetch('/api/finance/kpi', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setKpis(data.kpis || [])
      }
    } catch (err) {
      console.error('Failed to load KPI metrics:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadKpis()
  }, [])

  const processedKpis = useMemo(() => {
    return kpis.map(k => ({
      ...k,
      isAwarded: awardedList.includes(k.uuid || k.id)
    }))
  }, [kpis, awardedList])

  const stats = useMemo(() => {
    let sumScore = 0
    let totalBonuses = 0
    let topEmp = null
    let topScore = -1

    processedKpis.forEach(k => {
      sumScore += k.score
      totalBonuses += k.overtimeBonus
      if (k.score > topScore) {
        topScore = k.score
        topEmp = k.name
      }
    })

    return {
      avgScore: Math.round(sumScore / (processedKpis.length || 1)),
      totalBonuses,
      topEmp: topEmp || '—',
      topScore: topScore > -1 ? `${topScore}%` : '—'
    }
  }, [processedKpis])

  const filteredKpis = useMemo(() => {
    const q = search.trim().toLowerCase()
    return processedKpis.filter(k => {
      return k.name.toLowerCase().includes(q) || k.dept.toLowerCase().includes(q)
    })
  }, [processedKpis, search])

  const formatMoney = (val) => {
    return new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS', maximumFractionDigits: 0 }).format(val)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadKpis()
    setRefreshing(false)
    toast.success(isRu ? 'Метрики KPI обновлены' : 'KPI ko\'rsatkichlari yangilandi')
  }

  const handleRewardClick = (emp) => {
    setRewardModal({
      open: true,
      emp: emp,
      amount: '',
      comment: ''
    })
  }

  const handleRewardSubmit = async () => {
    const { emp, amount, comment } = rewardModal
    if (!emp || !amount || parseFloat(amount) <= 0) return

    try {
      const empId = emp.uuid || emp.id
      const res = await fetch(`/api/finance/kpi/${empId}/reward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(amount), comment })
      })

      if (res.ok) {
        setAwardedList(prev => [...prev, empId])
        toast.success(isRu 
          ? `Бонус в размере ${formatMoney(amount)} для "${emp.name}" начислен!` 
          : `"${emp.name}" uchun ${formatMoney(amount)} bonus to'landi!`
        )
      } else {
        throw new Error('Reward request failed')
      }
    } catch (err) {
      toast.error(isRu ? 'Ошибка при сохранении бонуса' : 'Bonusni saqlashda xatolik yuz berdi')
    } finally {
      setRewardModal({ open: false, emp: null, amount: '', comment: '' })
    }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={isRu ? '✦ Финансы' : '✦ Moliya'}
        title={isRu ? 'KPI и бонусы' : 'Xodimlar KPI va Bonuslar'}
        sub={isRu ? 'Показатели дисциплины, расчет сверхурочных и начисление бонусов' : 'Intizom reytingi, qo\'shimcha soatlar va bonuslarni hisoblash'}
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
        .kpi-container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 24px 32px 80px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        @media (max-width: 900px) {
          .kpi-container {
            padding: 16px 16px 60px !important;
            gap: 16px !important;
          }
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

      <div className="kpi-container">
        {loading ? (
          <>
            {/* KPI Stats Grid Skeleton */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Skeleton width={120} height={12} />
                    <Skeleton width={32} height={32} radius={8} />
                  </div>
                  <Skeleton width={80} height={24} />
                  <Skeleton width={140} height={12} />
                </div>
              ))}
            </div>

            {/* Table Container Skeleton */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <Skeleton width={260} height={36} radius={8} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 16, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <Skeleton width={30} height={12} />
                  <Skeleton width={120} height={12} />
                  <Skeleton width={80} height={12} />
                  <Skeleton width={100} height={12} />
                  <Skeleton width={60} height={12} />
                  <Skeleton width={120} height={12} style={{ marginLeft: 'auto' }} />
                </div>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ display: 'flex', gap: 16, padding: '14px 16px', borderBottom: '1px solid var(--border-2)', alignItems: 'center' }}>
                    <Skeleton width={20} height={12} />
                    <Skeleton width={150} height={12} />
                    <Skeleton width={90} height={12} />
                    <Skeleton width={70} height={12} />
                    <Skeleton width={80} height={12} />
                    <Skeleton width={110} height={28} radius={6} style={{ marginLeft: 'auto' }} />
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* KPI Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-4)', fontWeight: 500 }}>{isRu ? 'СРЕДНИЙ ПОКАЗАТЕЛЬ KPI' : 'O\'RTACHA KPI REYTINGI'}</span>
                  <div style={{ padding: 6, borderRadius: 8, background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
                    <StarRegular fontSize={20} />
                  </div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{stats.avgScore}%</div>
                <div style={{ fontSize: 12, color: '#10b981', marginTop: 4, fontWeight: 600 }}>
                  {isRu ? 'Высокая дисциплина' : 'Tashkilot bo\'yicha yuqori ko\'rsatkich'}
                </div>
              </div>

              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-4)', fontWeight: 500 }}>{isRu ? 'РАСЧЕТНАЯ СУММА СВЕРХУРОЧНЫХ' : 'HISOB-KITOB QILINGAN BONUSLAR'}</span>
                  <div style={{ padding: 6, borderRadius: 8, background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                    <RewardRegular fontSize={20} />
                  </div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>{formatMoney(stats.totalBonuses)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>
                  {isRu ? 'Рассчитано за этот месяц' : 'Ushbu oy uchun hisoblangan jami qo\'shimcha ish haqi'}
                </div>
              </div>

              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-4)', fontWeight: 500 }}>{isRu ? 'ЛУЧШИЙ СОТРУДНИК МЕСЯЦА' : 'OYNING ENG INTIZOMLI XODIMI'}</span>
                  <div style={{ padding: 6, borderRadius: 8, background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                    <CheckmarkCircleRegular fontSize={20} />
                  </div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{stats.topEmp}</div>
                <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 4, fontWeight: 600 }}>
                  {isRu ? 'Рейтинг KPI:' : 'KPI reytingi:'} {stats.topScore}
                </div>
              </div>
            </div>

            {/* Filters and List */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
                  <SearchRegular fontSize={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)' }} />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={isRu ? 'Поиск по имени или отделу...' : 'Ism yoki bo\'lim bo\'yicha qidirish...'}
                    style={{
                      width: '100%', padding: '9px 12px 9px 36px', borderRadius: 8,
                      border: '1px solid var(--border)', background: 'var(--bg)',
                      color: 'var(--text-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-4)', fontSize: 12.5 }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600, width: 40 }}>#</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Сотрудник' : 'Xodim'}</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Отдел' : 'Bo\'lim'}</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Посещаемость' : 'Davomat'}</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Вовремя' : 'O\'z vaqtida'}</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Надбавка (Сверхурочные)' : 'Qo\'shimcha ish haqi'}</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Вычеты / Jarima' : 'Chegirmalar / Jarima'}</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Балл KPI' : 'KPI reytingi'}</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredKpis.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-4)', fontSize: 13.5 }}>
                          {isRu ? 'Сотрудники не найдены' : 'Xodimlar topilmadi'}
                        </td>
                      </tr>
                    ) : (
                      filteredKpis.map((k, idx) => (
                        <tr key={k.id} style={{ borderBottom: '1px solid var(--border-2)', fontSize: 13, color: 'var(--text-2)' }}>
                          <td style={{ padding: '14px 16px', color: 'var(--text-4)' }}>{idx + 1}</td>
                          <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-1)' }}>{k.name}</td>
                          <td style={{ padding: '14px 16px' }}>{k.dept}</td>
                          <td style={{ padding: '14px 16px', fontWeight: 600 }}>{k.attendance}%</td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{ fontSize: 11.5, color: '#10b981', fontWeight: 600, background: 'rgba(16, 185, 129, 0.08)', padding: '3px 8px', borderRadius: 6 }}>
                              {k.ontimeCount} {isRu ? 'раз' : 'marta'}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', fontWeight: 700, color: k.overtimeBonus > 0 ? '#10b981' : 'var(--text-4)' }}>
                            {k.overtimeBonus > 0 ? `+${formatMoney(k.overtimeBonus)}` : '—'}
                          </td>
                          <td style={{ padding: '14px 16px', fontWeight: 700, color: k.totalDeductions > 0 ? '#ef4444' : 'var(--text-4)' }}>
                            {k.totalDeductions > 0 ? `-${formatMoney(k.totalDeductions)}` : '—'}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 120 }}>
                              <span style={{ fontWeight: 700, color: k.score >= 90 ? '#10b981' : k.score >= 80 ? '#f59e0b' : '#ef4444' }}>{k.score}%</span>
                              <div style={{ flex: 1, height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--border)' }}>
                                <div style={{ width: `${k.score}%`, height: '100%', background: k.score >= 90 ? '#10b981' : k.score >= 80 ? '#f59e0b' : '#ef4444' }} />
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                            <button
                              onClick={() => handleRewardClick(k)}
                              disabled={k.isAwarded}
                              style={{
                                background: k.isAwarded ? 'rgba(255,255,255,0.06)' : 'var(--accent)',
                                color: k.isAwarded ? 'var(--text-4)' : '#fff',
                                border: 'none', padding: '7px 14px', borderRadius: 6, fontSize: 12,
                                fontWeight: 600, cursor: k.isAwarded ? 'not-allowed' : 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {k.isAwarded ? (isRu ? 'Начислено' : 'To\'langan') : (isRu ? 'Начислить' : 'Mukofotlash')}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {rewardModal.open && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                {isRu ? 'Начисление премии' : 'Xodimni mukofotlash'}
              </h3>
              <button
                onClick={() => setRewardModal({ open: false, emp: null, amount: '', comment: '' })}
                style={closeBtnStyle}
              >
                <DismissRegular fontSize={18} />
              </button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 6 }}>
                {isRu ? 'Сотрудник:' : 'Xodim:'}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginBottom: 16 }}>
                {rewardModal.emp?.name}
              </div>

              <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>
                  {isRu ? 'Сверхурочно заработано:' : 'Vaqtidan ko\'proq ishlab topgani:'}
                </span>
                <span style={{ fontWeight: 700, color: '#10b981' }}>
                  {formatMoney(rewardModal.emp?.overtimeBonus || 0)}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>
                {isRu ? 'Сумма премии (UZS):' : 'Mukofot summasi (UZS):'}
              </label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="number"
                  value={rewardModal.amount}
                  onChange={e => setRewardModal(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder={isRu ? 'Введите сумму...' : 'Summani kiriting...'}
                  style={inputStyle}
                />
                <button
                  onClick={() => setRewardModal(prev => ({ ...prev, amount: String(rewardModal.emp?.overtimeBonus || 0) }))}
                  style={loadBtnStyle}
                >
                  <DocumentCopyRegular fontSize={14} style={{ marginRight: 4 }} />
                  {isRu ? 'Вставить' : 'Yuklash'}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>
                {isRu ? 'Комментарий (изоh):' : 'Izoh:'}
              </label>
              <textarea
                value={rewardModal.comment}
                onChange={e => setRewardModal(prev => ({ ...prev, comment: e.target.value }))}
                placeholder={isRu ? 'Введите пояснение к бонусу...' : 'Mukofot sababini yoki izohini kiriting...'}
                style={textareaStyle}
                rows={3}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleRewardSubmit}
                disabled={!rewardModal.amount || parseFloat(rewardModal.amount) <= 0}
                style={submitRewardBtnStyle}
              >
                {isRu ? 'Начислить' : 'Mukofotlash'}
              </button>
              <button
                onClick={() => setRewardModal({ open: false, emp: null, amount: '', comment: '' })}
                style={cancelRewardBtnStyle}
              >
                {isRu ? 'Bekor qilish' : 'Bekor qilish'}
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
  maxWidth: 440,
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

const inputStyle = {
  flex: 1,
  padding: '9px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text-1)',
  fontSize: 13.5,
  outline: 'none',
}

const textareaStyle = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text-1)',
  fontSize: 13.5,
  outline: 'none',
  resize: 'none',
  boxSizing: 'border-box',
}

const loadBtnStyle = {
  background: 'rgba(59, 130, 246, 0.1)',
  border: '1px solid rgba(59, 130, 246, 0.2)',
  color: 'var(--accent)',
  padding: '9px 14px',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  whiteSpace: 'nowrap',
}

const submitRewardBtnStyle = {
  flex: 1,
  background: 'var(--accent)',
  border: 'none',
  color: '#fff',
  padding: '12px',
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
}

const cancelRewardBtnStyle = {
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid var(--border)',
  color: 'var(--text-3)',
  padding: '12px 18px',
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
}
