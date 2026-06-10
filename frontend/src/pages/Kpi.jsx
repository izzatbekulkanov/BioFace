import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  StarRegular,
  CheckmarkCircleRegular,
  RewardRegular,
  ArrowSyncRegular,
  SearchRegular,
  ClipboardTaskListLtrRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import { useToast } from '../components/Toaster'

const INITIAL_KPI = [
  { id: 1, name: 'Tursunov Dilshod', dept: 'Dasturlash', attendance: 98, ontime: 95, baseSalary: 12000000 },
  { id: 2, name: 'Karimova Nargiza', dept: 'HR Menejment', attendance: 100, ontime: 100, baseSalary: 7000000 },
  { id: 3, name: 'Sodiqov Farhod', dept: 'Tizim xizmatlari', attendance: 90, ontime: 80, baseSalary: 9000000 },
  { id: 4, name: 'Usmonova Malika', dept: 'Marketing', attendance: 92, ontime: 90, baseSalary: 6000000 },
  { id: 5, name: 'Rustamov Jamshid', dept: 'Buxgalteriya', attendance: 100, ontime: 100, baseSalary: 8000000 },
  { id: 6, name: 'Qodirova Shahlo', dept: 'Ma\'muriyat', attendance: 85, ontime: 75, baseSalary: 5000000 },
]

export default function Kpi() {
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const toast = useToast()

  const [kpis, setKpis] = useState(INITIAL_KPI)
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [awardedList, setAwardedList] = useState([])

  // Calculate KPI metrics
  // KPI Score = (attendance * 0.6) + (ontime * 0.4)
  // Bonus = KPI >= 95 ? 10% of base, KPI >= 90 ? 5% of base, else 0%
  const processedKpis = useMemo(() => {
    return kpis.map(k => {
      const score = Math.round((k.attendance * 0.6) + (k.ontime * 0.4))
      let bonusPercent = 0
      if (score >= 95) bonusPercent = 0.10
      else if (score >= 90) bonusPercent = 0.05

      const bonusAmount = Math.round(k.baseSalary * bonusPercent)

      return {
        ...k,
        score,
        bonusAmount,
        isAwarded: awardedList.includes(k.id)
      }
    })
  }, [kpis, awardedList])

  const stats = useMemo(() => {
    let sumScore = 0
    let totalBonuses = 0
    let topEmp = null
    let topScore = -1

    processedKpis.forEach(k => {
      sumScore += k.score
      totalBonuses += k.bonusAmount
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

  const handleAward = (id, name, amount) => {
    setAwardedList(prev => [...prev, id])
    toast.success(isRu ? `Бонус в размере ${formatMoney(amount)} для "${name}" начислен!` : `"${name}" uchun ${formatMoney(amount)} bonus to'landi!`)
  }

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => {
      setRefreshing(false)
      toast.success(isRu ? 'Метрики KPI обновлены' : 'KPI ko\'rsatkichlari yangilandi')
    }, 600)
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={isRu ? '✦ Финансы' : '✦ Moliya'}
        title={isRu ? 'KPI (бонусы)' : 'Xodimlar KPI va Bonuslar'}
        sub={isRu ? 'Расчет бонусов на основе посещаемости и пунктуальности' : 'Davomat va intizom ko\'rsatkichlari asosida bonuslarni hisoblash'}
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
      `}</style>

      <div className="kpi-container">
        {/* KPI Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text-4)', fontWeight: 500 }}>{isRu ? 'СРЕДНИЙ ПОКАЗАТЕЛЬ KPI' : 'O\'RTACHA KPI KO\'RSATKICHI'}</span>
              <div style={{ padding: 6, borderRadius: 8, background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
                <StarRegular fontSize={20} />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{stats.avgScore}%</div>
            <div style={{ fontSize: 12, color: '#10b981', marginTop: 4, fontWeight: 600 }}>
              {isRu ? 'Высокая дисциплина' : 'Yuqori intizom ko\'rsatkichi'}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text-4)', fontWeight: 500 }}>{isRu ? 'РАСПРЕДЕЛЕНО БОНУСОВ' : 'AJRATILGAN BONUSLAR'}</span>
              <div style={{ padding: 6, borderRadius: 8, background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                <RewardRegular fontSize={20} />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>{formatMoney(stats.totalBonuses)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>
              {isRu ? 'Рассчитано за этот месяц' : 'Ushbu oy uchun hisoblangan'}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text-4)', fontWeight: 500 }}>{isRu ? 'ЛУЧШИЙ СОТРУДНИК OЯ' : 'OYNING ENG YAXSHI XODIMI'}</span>
              <div style={{ padding: 6, borderRadius: 8, background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                <CheckmarkCircleRegular fontSize={20} />
              </div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{stats.topEmp}</div>
            <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 4, fontWeight: 600 }}>
              {isRu ? 'Рейтинг:' : 'Reyting:'} {stats.topScore}
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
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Сотрудник' : 'Xodim'}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Отдел' : 'Bo\'lim'}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Посещаемость' : 'Davomat'}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Вовремя' : 'O\'z vaqtida'}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Балл KPI' : 'KPI reytingi'}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Расчетный бонус' : 'Bonus miqdori'}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredKpis.map(k => (
                  <tr key={k.id} style={{ borderBottom: '1px solid var(--border-2)', fontSize: 13, color: 'var(--text-2)' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-1)' }}>{k.name}</td>
                    <td style={{ padding: '14px 16px' }}>{k.dept}</td>
                    <td style={{ padding: '14px 16px' }}>{k.attendance}%</td>
                    <td style={{ padding: '14px 16px' }}>{k.ontime}%</td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 120 }}>
                        <span style={{ fontWeight: 700, color: k.score >= 90 ? '#10b981' : k.score >= 80 ? '#f59e0b' : '#ef4444' }}>{k.score}%</span>
                        <div style={{ flex: 1, height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--border)' }}>
                          <div style={{ width: `${k.score}%`, height: '100%', background: k.score >= 90 ? '#10b981' : k.score >= 80 ? '#f59e0b' : '#ef4444' }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: k.bonusAmount > 0 ? '#10b981' : 'var(--text-4)' }}>
                      {k.bonusAmount > 0 ? formatMoney(k.bonusAmount) : '—'}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      {k.bonusAmount > 0 && (
                        <button
                          onClick={() => handleAward(k.id, k.name, k.bonusAmount)}
                          disabled={k.isAwarded}
                          style={{
                            background: k.isAwarded ? 'rgba(255,255,255,0.06)' : 'var(--accent)',
                            color: k.isAwarded ? 'var(--text-4)' : '#fff',
                            border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12,
                            fontWeight: 600, cursor: k.isAwarded ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {k.isAwarded ? (isRu ? 'Начислено' : 'To\'langan') : (isRu ? 'Начислить' : 'Mukofotlash')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
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
