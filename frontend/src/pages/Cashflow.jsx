import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowSyncRegular,
  AddRegular,
  SearchRegular,
  MoneyRegular,
  ArrowSwapRegular,
  ArrowDownRegular,
  ArrowUpRegular,
  DismissCircleRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import { useToast } from '../components/Toaster'
import Skeleton from '../components/Skeleton'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

export default function Cashflow() {
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const toast = useToast()

  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Form states
  const [formDesc, setFormDesc] = useState('')
  const [formType, setFormType] = useState('income')
  const [formAmount, setFormAmount] = useState('')
  const [formComment, setFormComment] = useState('')

  const loadCashflow = async () => {
    try {
      const res = await fetch('/api/finance/cashflow', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setTransactions(data.transactions || [])
      }
    } catch (err) {
      console.error('Failed to load cashflow data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCashflow()
  }, [])

  const stats = useMemo(() => {
    let income = 0
    let expense = 0
    transactions.forEach(t => {
      if (t.type === 'income') income += t.amount
      else expense += t.amount
    })
    return { income, expense, profit: income - expense }
  }, [transactions])

  const chartData = useMemo(() => {
    const monthly = {}
    const monthsUz = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek']
    const monthsRu = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
    
    const result = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = d.getFullYear()
      const monthIdx = d.getMonth()
      const key = `${year}-${String(monthIdx + 1).padStart(2, '0')}`
      monthly[key] = {
        name: isRu ? monthsRu[monthIdx] : monthsUz[monthIdx],
        income: 0,
        expense: 0
      }
    }
    
    transactions.forEach(t => {
      if (!t.date) return
      const part = t.date.slice(0, 7) // 'YYYY-MM'
      if (monthly[part]) {
        if (t.type === 'income') {
          monthly[part].income += t.amount
        } else {
          monthly[part].expense += t.amount
        }
      }
    })
    
    return Object.values(monthly)
  }, [transactions, isRu])

  const filteredTransactions = useMemo(() => {
    const q = search.trim().toLowerCase()
    return transactions.filter(t => {
      const matchesSearch = t.desc.toLowerCase().includes(q) || (t.comment || '').toLowerCase().includes(q)
      const matchesType = typeFilter === 'all' || t.type === typeFilter
      return matchesSearch && matchesType
    })
  }, [transactions, search, typeFilter])

  const formatMoney = (val) => {
    return new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS', maximumFractionDigits: 0 }).format(val)
  }

  const handleAddTransaction = async (e) => {
    e.preventDefault()
    if (!formDesc.trim() || !formAmount) {
      toast.error(isRu ? 'Заполните все поля!' : 'Barcha maydonlarni to\'ldiring!')
      return
    }

    try {
      const res = await fetch('/api/finance/cashflow', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          desc: formDesc.trim(),
          type: formType,
          amount: parseFloat(formAmount),
          comment: formComment.trim(),
          date: new Date().toISOString().split('T')[0]
        })
      })
      if (res.ok) {
        toast.success(isRu ? 'Операция добавлена' : 'Amal muvaffaqiyatli qo\'shildi')
        setShowAddModal(false)
        setFormDesc('')
        setFormType('income')
        setFormAmount('')
        setFormComment('')
        loadCashflow()
      } else {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || 'Failed to save')
      }
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadCashflow()
    setRefreshing(false)
    toast.success(isRu ? 'Данные о доходах и расходах обновлены' : 'Kirim-chiqim ma\'lumotlari yangilandi')
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={isRu ? '✦ Финансы' : '✦ Moliya'}
        title={isRu ? 'Доходы и расходы' : 'Kirim va Chiqimlar'}
        sub={isRu ? 'Управление финансовыми операциями и доходами компании' : 'Moliyaviy operatsiyalar va kirim-chiqimlar nazorati'}
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', borderRadius: 8,
                background: 'var(--accent)', border: 'none',
                color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <AddRegular fontSize={16} /> {isRu ? 'Добавить операцию' : 'Tranzaksiya qo\'shish'}
            </button>
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
          </div>
        }
      />

      <style>{`
        .cashflow-container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 24px 32px 80px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        @media (max-width: 900px) {
          .cashflow-container {
            padding: 16px 16px 60px !important;
            gap: 16px !important;
          }
        }
      `}</style>

      <div className="cashflow-container">
        {loading ? (
          <>
            {/* Stats Grid Skeleton */}
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

            {/* Chart Skeleton */}
            <div style={cardStyle}>
              <Skeleton width={280} height={16} style={{ marginBottom: 20 }} />
              <Skeleton width="100%" height={280} radius={10} />
            </div>

            {/* Table Container Skeleton */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <Skeleton width={260} height={36} radius={8} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 16, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <Skeleton width={150} height={12} />
                  <Skeleton width={120} height={12} />
                  <Skeleton width={80} height={12} />
                  <Skeleton width={100} height={12} style={{ marginLeft: 'auto' }} />
                </div>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ display: 'flex', gap: 16, padding: '14px 16px', borderBottom: '1px solid var(--border-2)', alignItems: 'center' }}>
                    <Skeleton width={180} height={12} />
                    <Skeleton width={140} height={12} />
                    <Skeleton width={90} height={12} />
                    <Skeleton width={110} height={12} style={{ marginLeft: 'auto' }} />
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Statistics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-4)', fontWeight: 500 }}>{isRu ? 'ОБЩИЙ КИРИМ' : 'UMUMIY KIRIM'}</span>
                  <div style={{ padding: 6, borderRadius: 8, background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                    <ArrowUpRegular fontSize={20} />
                  </div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>{formatMoney(stats.income)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>
                  {isRu ? 'Включая подписки and услуги' : 'Obuna va qo\'shimcha xizmatlar bilan'}
                </div>
              </div>

              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-4)', fontWeight: 500 }}>{isRu ? 'ОБЩИЙ ЧИҚИМ' : 'UMUMIY CHIQIM'}</span>
                  <div style={{ padding: 6, borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                    <ArrowDownRegular fontSize={20} />
                  </div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#ef4444' }}>{formatMoney(stats.expense)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>
                  {isRu ? 'Включая зарплату and хостинг' : 'Ish haqi va xizmat ko\'rsatish xarajatlari'}
                </div>
              </div>

              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-4)', fontWeight: 500 }}>{isRu ? 'ЧИСТАЯ ПРИБЫЛЬ' : 'SOF FOYDA'}</span>
                  <div style={{ padding: 6, borderRadius: 8, background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
                    <MoneyRegular fontSize={20} />
                  </div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: stats.profit >= 0 ? '#3b82f6' : '#ef4444' }}>{formatMoney(stats.profit)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>
                  {isRu ? 'Текущий баланс за этот период' : 'Ushbu davr uchun yakuniy natija'}
                </div>
              </div>
            </div>

            {/* Chart */}
            <div style={cardStyle}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 20px 0' }}>{isRu ? 'Сравнительный график доходов и расходов' : 'Kirim va chiqimlar solishtirma grafigi'}</h3>
              <ResponsiveContainer width="100%" height={280} minWidth={0}>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-4)" fontSize={11} />
                  <YAxis stroke="var(--text-4)" fontSize={11} tickFormatter={(val) => `${val / 1000000}M`} />
                  <RechartsTooltip
                    formatter={(val) => formatMoney(val)}
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text-1)' }}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Area name={isRu ? 'Доходы' : 'Kirim'} type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorIncome)" />
                  <Area name={isRu ? 'Расходы' : 'Chiqim'} type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorExpense)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Transactions list */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
                  <SearchRegular fontSize={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)' }} />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={isRu ? 'Поиск по описанию или примечанию...' : 'Tavsif yoki izoh bo\'yicha qidirish...'}
                    style={{
                      width: '100%', padding: '9px 12px 9px 36px', borderRadius: 8,
                      border: '1px solid var(--border)', background: 'var(--bg)',
                      color: 'var(--text-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 3 }}>
                  {[
                    { id: 'all', label: isRu ? 'Все' : 'Barchasi' },
                    { id: 'income', label: isRu ? 'Доходы' : 'Kirimlar' },
                    { id: 'expense', label: isRu ? 'Расходы' : 'Chiqimlar' },
                  ].map(item => (
                    <button
                      key={item.id}
                      onClick={() => setTypeFilter(item.id)}
                      style={{
                        padding: '6px 14px', borderRadius: 6, border: 'none',
                        background: typeFilter === item.id ? 'var(--accent)' : 'transparent',
                        color: typeFilter === item.id ? '#fff' : 'var(--text-3)',
                        fontSize: 12.5, fontWeight: typeFilter === item.id ? 600 : 400, cursor: 'pointer',
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
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Описание' : 'Tavsif'}</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Примечание' : 'Izoh'}</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Дата' : 'Sana'}</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Сумма' : 'Miqdor'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ padding: 40, textAlign: 'center', color: 'var(--text-4)' }}>
                          {isRu ? 'Операции не найдены' : 'Tranzaksiyalar topilmadi'}
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map(t => (
                        <tr key={t.id} style={{ borderBottom: '1px solid var(--border-2)', fontSize: 13, color: 'var(--text-2)' }}>
                          <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-1)' }}>{t.desc}</td>
                          <td style={{ padding: '14px 16px' }}>{t.comment || '—'}</td>
                          <td style={{ padding: '14px 16px' }}>{t.date}</td>
                          <td style={{ padding: '14px 16px', fontWeight: 700, color: t.type === 'income' ? '#10b981' : '#ef4444' }}>
                            {t.type === 'income' ? '+' : '-'}{formatMoney(t.amount)}
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

      {/* Add Modal */}
      {showAddModal && (
        <div style={modalOverlayStyle} onClick={() => setShowAddModal(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid var(--border-2)', paddingBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                {isRu ? 'Добавить финансовую операцию' : 'Yangi tranzaksiya qo\'shish'}
              </h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>
                <DismissCircleRegular fontSize={20} />
              </button>
            </div>

            <form onSubmit={handleAddTransaction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>{isRu ? 'Описание операции' : 'Tavsif'}</label>
                <input
                  type="text"
                  required
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  placeholder={isRu ? 'Например: Аренда офиса' : 'Masalan: Kantselyariya xarajatlari'}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>{isRu ? 'Тип операции' : 'Turi'}</label>
                  <select value={formType} onChange={e => setFormType(e.target.value)} style={selectStyle}>
                    <option value="income">{isRu ? 'Доход (Kirim)' : 'Kirim'}</option>
                    <option value="expense">{isRu ? 'Расход (Chiqim)' : 'Chiqim'}</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>{isRu ? 'Комментарий' : 'Izoh'}</label>
                  <input
                    type="text"
                    value={formComment}
                    onChange={e => setFormComment(e.target.value)}
                    placeholder={isRu ? 'Доп. инфо' : 'Qo\'shimcha izoh'}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>{isRu ? 'Сумма (UZS)' : 'Miqdor (UZS)'}</label>
                <input
                  type="number"
                  required
                  value={formAmount}
                  onChange={e => setFormAmount(e.target.value)}
                  placeholder="500000"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 12, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: '9px 18px', borderRadius: 8, border: '1px solid var(--border)',
                    background: 'transparent', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  {isRu ? 'Отмена' : 'Bekor qilish'}
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '9px 18px', borderRadius: 8, border: 'none',
                    background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  {isRu ? 'Сохранить' : 'Saqlash'}
                </button>
              </div>
            </form>
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
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10000,
  animation: 'fadeIn 0.2s ease',
}

const modalContentStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  width: 440,
  maxWidth: '90%',
  padding: 24,
  boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
}

const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-3)',
  marginBottom: 6,
}

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text-1)',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
}

const selectStyle = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text-1)',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
}
