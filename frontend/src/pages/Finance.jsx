import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MoneyRegular,
  AddRegular,
  SearchRegular,
  CheckmarkCircleRegular,
  WarningRegular,
  DismissCircleRegular,
  PersonRegular,
  BuildingRegular,
  CalendarRegular,
  ArrowSyncRegular,
  FilterRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import { useToast } from '../components/Toaster'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'

const INITIAL_TRANSACTIONS = [
  { id: 1, name: 'Azizov Bilol', org: 'SmartGate IT Academy', amount: 1200000, date: '2026-06-05', status: 'paid', method: 'card' },
  { id: 2, name: 'Ismoilova Madina', org: 'Toshkent Davlat Universiteti', amount: 800000, date: '2026-06-04', status: 'paid', method: 'cash' },
  { id: 3, name: 'Karimov Diyor', org: 'SmartGate IT Academy', amount: 1500000, date: '2026-06-03', status: 'unpaid', method: 'bank' },
  { id: 4, name: 'Rustamov Sardor', org: 'Xalq ta\'limi maktabi #12', amount: 500000, date: '2026-06-02', status: 'partial', method: 'card' },
  { id: 5, name: 'Tursunova Ziyoda', org: 'SmartGate IT Academy', amount: 1200000, date: '2026-06-01', status: 'paid', method: 'card' },
  { id: 6, name: 'Nazarov Sanjar', org: 'Toshkent Davlat Universiteti', amount: 2000000, date: '2026-05-28', status: 'paid', method: 'bank' },
  { id: 7, name: 'Alimova Shahnoza', org: 'Xalq ta\'limi maktabi #12', amount: 450000, date: '2026-05-25', status: 'unpaid', method: 'cash' },
]

export default function Finance() {
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const toast = useToast()

  const [transactions, setTransactions] = useState(INITIAL_TRANSACTIONS)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Form states for new payment
  const [formName, setFormName] = useState('')
  const [formOrg, setFormOrg] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formMethod, setFormMethod] = useState('card')
  const [formStatus, setFormStatus] = useState('paid')

  // Calculate statistics
  const stats = useMemo(() => {
    let total = 0
    let paid = 0
    let unpaid = 0
    let discount = 3400000 // mock static value

    transactions.forEach(t => {
      total += t.amount
      if (t.status === 'paid') paid += t.amount
      else if (t.status === 'unpaid') unpaid += t.amount
      else if (t.status === 'partial') {
        paid += t.amount * 0.5 // mock partial calculation
        unpaid += t.amount * 0.5
      }
    })

    return { total, paid, unpaid, discount }
  }, [transactions])

  // Chart data
  const chartData = [
    { name: isRu ? 'Янв' : 'Yan', collections: 8500000 },
    { name: isRu ? 'Фев' : 'Fev', collections: 10200000 },
    { name: isRu ? 'Мар' : 'Mar', collections: 9800000 },
    { name: isRu ? 'Апр' : 'Apr', collections: 12400000 },
    { name: isRu ? 'Май' : 'May', collections: 14200000 },
    { name: isRu ? 'Июн' : 'Iyun', collections: stats.paid },
  ]

  // Payment method breakdown
  const methodData = useMemo(() => {
    const counts = { card: 0, cash: 0, bank: 0 }
    transactions.forEach(t => {
      if (counts[t.method] !== undefined) {
        counts[t.method] += t.amount
      }
    })
    return [
      { name: isRu ? 'Карта' : 'Karta', value: counts.card, fill: '#3b82f6' },
      { name: isRu ? 'Наличные' : 'Naqd pul', value: counts.cash, fill: '#10b981' },
      { name: isRu ? 'Банк' : 'Bank', value: counts.bank, fill: '#f59e0b' },
    ]
  }, [transactions, isRu])

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    const q = search.trim().toLowerCase()
    return transactions.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(q) || t.org.toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [transactions, search, statusFilter])

  const formatMoney = (val) => {
    return new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS', maximumFractionDigits: 0 }).format(val)
  }

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => {
      setRefreshing(false)
      toast.success(isRu ? 'Финансовые данные обновлены' : 'Moliya ma\'lumotlari yangilandi')
    }, 800)
  }

  const handleAddPayment = (e) => {
    e.preventDefault()
    if (!formName.trim() || !formOrg.trim() || !formAmount) {
      toast.error(isRu ? 'Заполните все поля!' : 'Barcha maydonlarni to\'ldiring!')
      return
    }

    const newPayment = {
      id: Date.now(),
      name: formName.trim(),
      org: formOrg.trim(),
      amount: parseFloat(formAmount),
      date: new Date().toISOString().split('T')[0],
      status: formStatus,
      method: formMethod,
    }

    setTransactions(prev => [newPayment, ...prev])
    setShowAddModal(false)
    toast.success(isRu ? 'Платеж успешно добавлен' : 'To\'lov muvaffaqiyatli qo\'shildi')

    // Reset form
    setFormName('')
    setFormOrg('')
    setFormAmount('')
    setFormMethod('card')
    setFormStatus('paid')
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={isRu ? '✦ Финансы' : '✦ Moliya'}
        title={isRu ? 'Финансовый мониторинг' : 'Moliya monitoringi'}
        sub={isRu ? 'Отслеживание платежей, доходов и задолженностей' : 'To\'lovlar, tushumlar va qarzdorliklar nazorati'}
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
              <AddRegular fontSize={16} /> {isRu ? 'Добавить платеж' : 'To\'lov qo\'shish'}
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
        .finance-container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 24px 32px 80px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .charts-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 24px;
        }
        @media (max-width: 900px) {
          .finance-container {
            padding: 16px 16px 60px !important;
            gap: 16px !important;
          }
          .charts-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
        }
      `}</style>

      <div className="finance-container">
        {/* Statistics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text-4)', fontWeight: 500 }}>{isRu ? 'ОБЩИЕ СБОРЫ' : 'UMUMIY TUSHUM'}</span>
              <div style={{ padding: 6, borderRadius: 8, background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
                <MoneyRegular fontSize={20} />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)' }}>{formatMoney(stats.total)}</div>
            <div style={{ fontSize: 12, color: '#10b981', marginTop: 4, fontWeight: 600 }}>+12.4% {isRu ? 'с прошлого месяца' : 'o\'tgan oyga nisbatan'}</div>
          </div>

          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text-4)', fontWeight: 500 }}>{isRu ? 'ОПЛАЧЕНО' : 'TO\'LANGAN'}</span>
              <div style={{ padding: 6, borderRadius: 8, background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                <CheckmarkCircleRegular fontSize={20} />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>{formatMoney(stats.paid)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>{((stats.paid / (stats.total || 1)) * 100).toFixed(1)}% {isRu ? 'от общей суммы' : 'umumiy summadan'}</div>
          </div>

          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text-4)', fontWeight: 500 }}>{isRu ? 'ЗАДОЛЖЕННОСТЬ' : 'QARZDORLIK'}</span>
              <div style={{ padding: 6, borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                <WarningRegular fontSize={20} />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#ef4444' }}>{formatMoney(stats.unpaid)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>{((stats.unpaid / (stats.total || 1)) * 100).toFixed(1)}% {isRu ? 'ожидается к оплате' : 'to\'lanishi kutilmoqda'}</div>
          </div>

          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text-4)', fontWeight: 500 }}>{isRu ? 'СКИДКИ И ЛЬГОТЫ' : 'CHEGIRMALAR'}</span>
              <div style={{ padding: 6, borderRadius: 8, background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                <MoneyRegular fontSize={20} />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b' }}>{formatMoney(stats.discount)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>{isRu ? 'Выделено грантов' : 'Ajratilgan grantlar'}</div>
          </div>
        </div>

        {/* Charts & Breakdown Row */}
        <div className="charts-grid">
          {/* Collection trends */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 20px 0', color: 'var(--text-1)' }}>
              {isRu ? 'Динамика поступлений (последние 6 месяцев)' : 'Tushumlar dinamikasi (oxirgi 6 oy)'}
            </h3>
            <ResponsiveContainer width="100%" height={280} minWidth={0}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCollections" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-4)" fontSize={11} />
                <YAxis stroke="var(--text-4)" fontSize={11} tickFormatter={(val) => `${val / 1000000}M`} />
                <RechartsTooltip
                  formatter={(val) => formatMoney(val)}
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text-1)' }}
                />
                <Area type="monotone" dataKey="collections" stroke="var(--accent)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCollections)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Payment method breakdown */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 20px 0', color: 'var(--text-1)' }}>
              {isRu ? 'Распределение по типам оплаты' : 'To\'lov turlari taqsimoti'}
            </h3>
            <ResponsiveContainer width="100%" height={180} minWidth={0} style={{ marginBottom: 16 }}>
              <BarChart data={methodData} layout="vertical" margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid stroke="var(--border)" vertical={true} horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="var(--text-3)" fontSize={11.5} width={70} />
                <RechartsTooltip
                  formatter={(val) => formatMoney(val)}
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text-1)' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {methodData.map((m, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.fill }} />
                    <span style={{ color: 'var(--text-3)' }}>{m.name}</span>
                  </div>
                  <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{formatMoney(m.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Filters and Transactions Table */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
              <SearchRegular fontSize={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={isRu ? 'Поиск по имени или организации...' : 'Ism yoki tashkilot bo\'yicha qidirish...'}
                style={{
                  width: '100%', padding: '9px 12px 9px 36px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Status Filter buttons */}
            <div style={{ display: 'flex', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 3 }}>
              {[
                { id: 'all', label: isRu ? 'Все' : 'Barchasi' },
                { id: 'paid', label: isRu ? 'Оплачено' : 'To\'langan' },
                { id: 'unpaid', label: isRu ? 'Не оплачено' : 'To\'lanmagan' },
                { id: 'partial', label: isRu ? 'Частично' : 'Qisman' },
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

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-4)', fontSize: 12.5 }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Плательщик' : 'To\'lovchi'}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Организация' : 'Tashkilot'}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Сумма' : 'Miqdor'}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Дата' : 'Sana'}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Способ оплаты' : 'To\'lov turi'}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Статус' : 'Holat'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-4)', fontSize: 13.5 }}>
                      {isRu ? 'Транзакции не найдены' : 'To\'lovlar topilmadi'}
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border-2)', fontSize: 13, color: 'var(--text-2)' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 500, color: 'var(--text-1)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
                            <PersonRegular fontSize={14} />
                          </div>
                          {t.name}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <BuildingRegular fontSize={14} style={{ color: 'var(--text-4)' }} />
                          {t.org}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-1)' }}>{formatMoney(t.amount)}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CalendarRegular fontSize={14} style={{ color: 'var(--text-4)' }} />
                          {t.date}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', textTransform: 'uppercase', fontSize: 11.5, fontWeight: 600, color: 'var(--text-3)' }}>
                        {t.method === 'card' ? (isRu ? 'Карта' : 'Karta') : t.method === 'cash' ? (isRu ? 'Наличные' : 'Naqd pul') : (isRu ? 'Банк' : 'Bank')}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={statusBadgeStyle(t.status, isRu)}>
                          {t.status === 'paid' ? (isRu ? 'Оплачено' : 'To\'langan') : t.status === 'unpaid' ? (isRu ? 'Не оплачено' : 'To\'lanmagan') : (isRu ? 'Частично' : 'Qisman')}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Payment Modal */}
      {showAddModal && (
        <div style={modalOverlayStyle} onClick={() => setShowAddModal(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid var(--border-2)', paddingBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-1)' }}>
                {isRu ? 'Добавить новый платеж' : 'Yangi to\'lov qo\'shish'}
              </h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>
                <DismissCircleRegular fontSize={20} />
              </button>
            </div>

            <form onSubmit={handleAddPayment} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>{isRu ? 'ФИО Плательщика' : 'To\'lovchi F.I.Sh.'}</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder={isRu ? 'Например: Иванов Иван' : 'Masalan: Eshmatov Toshmat'}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>{isRu ? 'Организация / Учебное заведение' : 'Tashkilot / O\'quv muassasasi'}</label>
                <input
                  type="text"
                  required
                  value={formOrg}
                  onChange={e => setFormOrg(e.target.value)}
                  placeholder={isRu ? 'Например: SmartGate Academy' : 'Masalan: SmartGate Academy'}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>{isRu ? 'Сумма платежа (UZS)' : 'To\'lov miqdori (UZS)'}</label>
                <input
                  type="number"
                  required
                  value={formAmount}
                  onChange={e => setFormAmount(e.target.value)}
                  placeholder="1000000"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>{isRu ? 'Способ оплаты' : 'To\'lov turi'}</label>
                  <select value={formMethod} onChange={e => setFormMethod(e.target.value)} style={selectStyle}>
                    <option value="card">{isRu ? 'Карта' : 'Karta'}</option>
                    <option value="cash">{isRu ? 'Наличные' : 'Naqd pul'}</option>
                    <option value="bank">{isRu ? 'Банковский перевод' : 'Bank o\'tkazmasi'}</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>{isRu ? 'Статус платежа' : 'To\'lov holati'}</label>
                  <select value={formStatus} onChange={e => setFormStatus(e.target.value)} style={selectStyle}>
                    <option value="paid">{isRu ? 'Оплачено' : 'To\'langan'}</option>
                    <option value="unpaid">{isRu ? 'Не оплачено' : 'To\'lanmagan'}</option>
                    <option value="partial">{isRu ? 'Частичная оплата' : 'Qisman to\'lov'}</option>
                  </select>
                </div>
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

// Inline Styles
const cardStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 20,
  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
}

const statusBadgeStyle = (status, isRu) => {
  const styles = {
    padding: '3px 8px',
    borderRadius: 6,
    fontSize: 11.5,
    fontWeight: 600,
  }

  if (status === 'paid') {
    return { ...styles, background: 'rgba(16,185,129,0.12)', color: '#10b981' }
  }
  if (status === 'unpaid') {
    return { ...styles, background: 'rgba(239,68,68,0.12)', color: '#ef4444' }
  }
  return { ...styles, background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }
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
