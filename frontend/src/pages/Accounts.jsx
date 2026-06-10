import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  WalletRegular,
  ArrowSyncRegular,
  AddRegular,
  ArrowSwapRegular,
  CheckmarkCircleRegular,
  PersonRegular,
  DismissCircleRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import { useToast } from '../components/Toaster'

const INITIAL_ACCOUNTS = [
  { id: 1, nameUz: 'Asosiy Kassa (Naqd)', nameRu: 'Основная касса (Наличные)', balance: 45000000, type: 'cash' },
  { id: 2, nameUz: 'Milliy Bank (Hisob raqam)', nameRu: 'Национальный Банк (Расч. счет)', balance: 128500000, type: 'bank' },
  { id: 3, nameUz: 'Korporativ Karta (Uzcard/Humo)', nameRu: 'Корпоративная карта (Uzcard/Humo)', balance: 12000000, type: 'card' },
  { id: 4, nameUz: 'Zaxira jamg\'armasi (Kelajak)', nameRu: 'Резервный фонд (Будущее)', balance: 50000000, type: 'reserve' },
]

const INITIAL_TRANSFERS = [
  { id: 1, from: 'Milliy Bank', to: 'Asosiy Kassa', amount: 10000000, date: '2026-06-07', desc: 'Kassani to\'ldirish uchun naqdlashtirish' },
  { id: 2, from: 'Korporativ Karta', to: 'Milliy Bank', amount: 5000000, date: '2026-06-05', desc: 'Mablag\'ni hisob raqamga qaytarish' },
  { id: 3, from: 'Milliy Bank', to: 'Zaxira jamg\'armasi', amount: 15000000, date: '2026-06-01', desc: 'Zaxira fondini shakllantirish ajratmasi' },
]

export default function Accounts() {
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const toast = useToast()

  const [accounts, setAccounts] = useState(INITIAL_ACCOUNTS)
  const [transfers, setTransfers] = useState(INITIAL_TRANSFERS)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Transfer Form States
  const [fromAccount, setFromAccount] = useState('1')
  const [toAccount, setToAccount] = useState('2')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferDesc, setTransferDesc] = useState('')

  const totalBalance = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + acc.balance, 0)
  }, [accounts])

  const formatMoney = (val) => {
    return new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS', maximumFractionDigits: 0 }).format(val)
  }

  const handleTransfer = (e) => {
    e.preventDefault()
    if (!transferAmount || parseFloat(transferAmount) <= 0) {
      toast.error(isRu ? 'Введите корректную сумму!' : "To'g'ri miqdorni kiriting!")
      return
    }

    const amount = parseFloat(transferAmount)
    const fromAccId = parseInt(fromAccount)
    const toAccId = parseInt(toAccount)

    if (fromAccId === toAccId) {
      toast.error(isRu ? 'Выберите разные счета!' : 'Turli xil hisoblarni tanlang!')
      return
    }

    const sourceAcc = accounts.find(a => a.id === fromAccId)
    if (sourceAcc.balance < amount) {
      toast.error(isRu ? 'Недостаточно средств на счете!' : 'Hisobda yetarli mablag\' mavjud emas!')
      return
    }

    // Update balances
    setAccounts(prev => prev.map(a => {
      if (a.id === fromAccId) return { ...a, balance: a.balance - amount }
      if (a.id === toAccId) return { ...a, balance: a.balance + amount }
      return a
    }))

    const destinationAcc = accounts.find(a => a.id === toAccId)

    // Add transfer record
    const newTx = {
      id: Date.now(),
      from: isRu ? sourceAcc.nameRu : sourceAcc.nameUz,
      to: isRu ? destinationAcc.nameRu : destinationAcc.nameUz,
      amount,
      date: new Date().toISOString().split('T')[0],
      desc: transferDesc.trim() || (isRu ? 'Внутренний перевод' : 'Ichki o\'tkazma'),
    }

    setTransfers(prev => [newTx, ...prev])
    setShowTransferModal(false)
    toast.success(isRu ? 'Перевод успешно выполнен' : 'O\'tkazma muvaffaqiyatli bajarildi')

    // Reset Form
    setTransferAmount('')
    setTransferDesc('')
  }

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => {
      setRefreshing(false)
      toast.success(isRu ? 'Балансы счетов обновлены' : 'Hisoblar balansi yangilandi')
    }, 600)
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={isRu ? '✦ Финансы' : '✦ Moliya'}
        title={isRu ? 'Счета и Балансы' : 'Hisoblar va Balanslar'}
        sub={isRu ? 'Мониторинг остатков на счетах и внутренние переводы' : 'Hisob raqamlardagi qoldiqlar nazorati va ichki pul o\'tkazmalari'}
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowTransferModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', borderRadius: 8,
                background: 'var(--accent)', border: 'none',
                color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <ArrowSwapRegular fontSize={16} /> {isRu ? 'Перевод между счетами' : 'Pul o\'tkazish'}
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
        .accounts-container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 24px 32px 80px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .accounts-grid {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 24px;
        }
        @media (max-width: 900px) {
          .accounts-container {
            padding: 16px 16px 60px !important;
            gap: 16px !important;
          }
          .accounts-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
        }
      `}</style>

      <div className="accounts-container">
        {/* Total Balance Card */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '24px 28px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16
        }}>
          <div>
            <div style={{ fontSize: 12.5, color: 'var(--text-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {isRu ? 'ОБЩИЙ БАЛАНС ВСЕХ СЧЕТОВ' : 'BARCHA HISOBLARDAGI UMUMIY QOLDIQ'}
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--accent)', marginTop: 8 }}>{formatMoney(totalBalance)}</div>
          </div>
          <div style={{ padding: 12, borderRadius: 10, background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-bd)' }}>
            <WalletRegular fontSize={28} />
          </div>
        </div>

        {/* Accounts List & Recent Transfers Row */}
        <div className="accounts-grid">
          {/* Accounts list */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 20px 0' }}>{isRu ? 'Список счетов' : 'Hisob raqamlar ro\'yxati'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {accounts.map(acc => (
                <div key={acc.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: 16, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: acc.type === 'bank' ? 'rgba(59,130,246,0.1)' : acc.type === 'cash' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                      color: acc.type === 'bank' ? '#3b82f6' : acc.type === 'cash' ? '#10b981' : '#f59e0b'
                    }}>
                      <WalletRegular fontSize={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>
                        {isRu ? acc.nameRu : acc.nameUz}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', marginTop: 2 }}>
                        {acc.type}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)' }}>
                    {formatMoney(acc.balance)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Transfers list */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 20px 0' }}>{isRu ? 'Последние переводы' : 'So\'nggi ichki o\'tkazmalar'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {transfers.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-4)', fontSize: 13 }}>
                  {isRu ? 'Переводов пока не было' : 'O\'tkazmalar tarixi bo\'sh'}
                </div>
              ) : (
                transfers.map(tx => (
                  <div key={tx.id} style={{
                    padding: 14, borderBottom: '1px solid var(--border-2)',
                    display: 'flex', flexDirection: 'column', gap: 8
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--text-1)' }}>
                        <span>{tx.from}</span>
                        <ArrowSwapRegular fontSize={12} style={{ color: 'var(--text-4)' }} />
                        <span>{tx.to}</span>
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{formatMoney(tx.amount)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-4)' }}>
                      <span>{tx.desc}</span>
                      <span>{tx.date}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Transfer Modal */}
      {showTransferModal && (
        <div style={modalOverlayStyle} onClick={() => setShowTransferModal(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid var(--border-2)', paddingBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                {isRu ? 'Внутренний перевод средств' : 'Hisoblararo pul o\'tkazish'}
              </h3>
              <button onClick={() => setShowTransferModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>
                <DismissCircleRegular fontSize={20} />
              </button>
            </div>

            <form onSubmit={handleTransfer} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>{isRu ? 'Откуда списать' : 'Qaysi hisobdan'}</label>
                <select value={fromAccount} onChange={e => setFromAccount(e.target.value)} style={selectStyle}>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {(isRu ? a.nameRu : a.nameUz)} ({formatMoney(a.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>{isRu ? 'Куда перевести' : 'Qaysi hisobga'}</label>
                <select value={toAccount} onChange={e => setToAccount(e.target.value)} style={selectStyle}>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {(isRu ? a.nameRu : a.nameUz)} ({formatMoney(a.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>{isRu ? 'Сумма перевода (UZS)' : 'O\'tkazma miqdori (UZS)'}</label>
                <input
                  type="number"
                  required
                  value={transferAmount}
                  onChange={e => setTransferAmount(e.target.value)}
                  placeholder="5000000"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>{isRu ? 'Примечание' : 'Izoh'}</label>
                <input
                  type="text"
                  value={transferDesc}
                  onChange={e => setTransferDesc(e.target.value)}
                  placeholder={isRu ? 'Например: Пополнение кассы' : 'Masalan: Kassani to\'ldirish'}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 12, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
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
                  {isRu ? 'Перевести' : 'O\'tkazish'}
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
