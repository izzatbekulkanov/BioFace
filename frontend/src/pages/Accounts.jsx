import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  WalletRegular,
  ArrowSyncRegular,
  AddRegular,
  ArrowSwapRegular,
  CheckmarkCircleRegular,
  PersonRegular,
  DismissCircleRegular,
  EditRegular,
  DeleteRegular,
  DocumentCopyRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import { useToast } from '../components/Toaster'
import CustomSelect from '../components/CustomSelect'

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

  const [accounts, setAccounts] = useState([])
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Transfer Form States
  const [fromAccount, setFromAccount] = useState('')
  const [toAccount, setToAccount] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferDesc, setTransferDesc] = useState('')

  // Account CRUD Modals and States
  const [showAddAccountModal, setShowAddAccountModal] = useState(false)
  const [showEditAccountModal, setShowEditAccountModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState(null)

  const [accNameUz, setAccNameUz] = useState('')
  const [accNameRu, setAccNameRu] = useState('')
  const [accType, setAccType] = useState('cash')
  const [accNumber, setAccNumber] = useState('')
  const [accBalance, setAccBalance] = useState('')

  const loadAccounts = async () => {
    try {
      const res = await fetch('/api/finance/accounts', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setAccounts(data.accounts || [])
        setTransfers(data.transfers || [])
        if (data.accounts && data.accounts.length > 0) {
          setFromAccount(String(data.accounts[0].id))
          setToAccount(String(data.accounts[1] ? data.accounts[1].id : data.accounts[0].id))
        }
      }
    } catch (err) {
      console.error('Failed to load accounts data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  const totalBalance = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + acc.balance, 0)
  }, [accounts])

  const formatMoney = (val) => {
    return new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS', maximumFractionDigits: 0 }).format(val)
  }

  const handleEditClick = (acc) => {
    setEditingAccount(acc)
    setAccNameUz(acc.nameUz)
    setAccNameRu(acc.nameRu)
    setAccType(acc.type)
    setAccNumber(acc.accountNumber || '')
    setAccBalance(String(acc.balance))
    setShowEditAccountModal(true)
  }

  const handleAddAccount = async (e) => {
    e.preventDefault()
    if (!accNameUz.trim() || !accNameRu.trim()) return
    try {
      const res = await fetch('/api/finance/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nameUz: accNameUz.trim(),
          nameRu: accNameRu.trim(),
          accountNumber: accNumber.trim(),
          balance: parseFloat(accBalance) || 0.0,
          type: accType,
        })
      })
      if (res.ok) {
        toast.success(isRu ? 'Счет создан' : 'Hisob muvaffaqiyatli yaratildi')
        setShowAddAccountModal(false)
        setAccNameUz('')
        setAccNameRu('')
        setAccNumber('')
        setAccBalance('')
        setAccType('cash')
        loadAccounts()
      }
    } catch (err) {
      toast.error(isRu ? 'Ошибка' : 'Xatolik yuz berdi')
    }
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (!accNameUz.trim() || !accNameRu.trim()) return
    try {
      const res = await fetch(`/api/finance/accounts/${editingAccount.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nameUz: accNameUz.trim(),
          nameRu: accNameRu.trim(),
          accountNumber: accNumber.trim(),
          balance: parseFloat(accBalance) || 0.0,
          type: accType,
        })
      })
      if (res.ok) {
        toast.success(isRu ? 'Счет обновлен' : 'Hisob muvaffaqiyatli yangilandi')
        setShowEditAccountModal(false)
        setEditingAccount(null)
        setAccNameUz('')
        setAccNameRu('')
        setAccNumber('')
        setAccBalance('')
        setAccType('cash')
        loadAccounts()
      }
    } catch (err) {
      toast.error(isRu ? 'Ошибка' : 'Xatolik yuz berdi')
    }
  }

  const handleDeleteClick = async (acc) => {
    const confirmText = isRu 
      ? `Вы уверены, что хотите удалить счет "${acc.nameRu}"?` 
      : `Haqiqatan ham "${acc.nameUz}" hisobini o'chirmoqchimisiz?`
    if (!window.confirm(confirmText)) return
    try {
      const res = await fetch(`/api/finance/accounts/${acc.id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        toast.success(isRu ? 'Счет удален' : 'Hisob o\'chirildi')
        loadAccounts()
      }
    } catch (err) {
      toast.error(isRu ? 'Ошибка' : 'Xatolik yuz berdi')
    }
  }

  const handleTransfer = async (e) => {
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
    if (!sourceAcc || sourceAcc.balance < amount) {
      toast.error(isRu ? 'Недостаточно средств на счете!' : 'Hisobda yetarli mablag\' mavjud emas!')
      return
    }

    try {
      const res = await fetch('/api/finance/accounts/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_account_id: fromAccId,
          to_account_id: toAccId,
          amount: amount,
          description: transferDesc.trim() || (isRu ? 'Внутренний перевод' : 'Ichki o\'tkazma'),
        })
      })

      if (res.ok) {
        toast.success(isRu ? 'Перевод успешно выполнен' : 'O\'tkazma muvaffaqiyatli bajarildi')
        setShowTransferModal(false)
        setTransferAmount('')
        setTransferDesc('')
        loadAccounts()
      } else {
        const errData = await res.json()
        toast.error(errData.detail || (isRu ? 'Ошибка перевода' : 'O\'tkazmada xatolik yuz berdi'))
      }
    } catch (err) {
      toast.error(isRu ? 'Ошибка сети' : 'Tarmoq xatoligi')
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadAccounts()
    setRefreshing(false)
    toast.success(isRu ? 'Балансы счетов обновлены' : 'Hisoblar balansi yangilandi')
  }

  const formatAccountNumber = (num, type) => {
    if (!num) return ''
    const clean = num.replace(/\s+/g, '')
    if (type === 'card') {
      return clean.replace(/(\d{4})(?=\d)/g, '$1 ')
    }
    if (type === 'bank') {
      return clean.replace(/(\d{4})(?=\d)/g, '$1 ')
    }
    return clean.replace(/(.{4})(?=.)/g, '$1 ')
  }

  const handleCopy = (num) => {
    if (!num) return
    navigator.clipboard.writeText(num)
    toast.success(isRu ? 'Номер скопирован' : 'Raqam nusxalandi')
  }

  const getAccountNumberLabel = () => {
    if (accType === 'card') return isRu ? 'Номер карты' : 'Karta raqami'
    if (accType === 'bank') return isRu ? 'Номер банковского счета' : 'Bank hisob raqami'
    return isRu ? 'Номер счета / карты (необязательно)' : 'Hisob / Karta raqami (ixtiyoriy)'
  }

  const getAccountNumberPlaceholder = () => {
    if (accType === 'card') return '8600 0000 0000 0000'
    if (accType === 'bank') return '2020 8000 1234 5678 9012'
    return isRu ? 'Например: 8600...' : 'Masalan: 8600...'
  }

  const typeOptions = useMemo(() => [
    { value: 'cash', label: isRu ? 'Наличные (Kassa)' : 'Naqd pul (Kassa)' },
    { value: 'bank', label: isRu ? 'Банковский счет' : 'Bank hisobi' },
    { value: 'card', label: isRu ? 'Карта' : 'Karta' },
    { value: 'reserve', label: isRu ? 'Резерв' : 'Zaxira' }
  ], [isRu])

  const accountOptions = useMemo(() => {
    return accounts.map(a => ({
      value: String(a.id),
      label: `${isRu ? a.nameRu : a.nameUz} (${formatMoney(a.balance)})`
    }))
  }, [accounts, isRu])

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={isRu ? '✦ Финансы' : '✦ Moliya'}
        title={isRu ? 'Счета и Балансы' : 'Hisoblar va Balanslar'}
        sub={isRu ? 'Мониторинг остатков на счетах и внутренние переводы' : 'Hisob raqamlardagi qoldiqlar nazorati va ichki pul o\'tkazmalari'}
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowAddAccountModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', borderRadius: 8,
                background: 'var(--accent-bg)', border: '1px solid var(--accent-bd)',
                color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <AddRegular fontSize={16} /> {isRu ? 'Создать счет' : 'Yangi hisob'}
            </button>
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
        .account-card:hover {
          transform: translateY(-2px);
          border-color: var(--accent) !important;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
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
          {/* Accounts list */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 20px 0' }}>{isRu ? 'Список счетов' : 'Hisob raqamlar ro\'yxati'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {loading ? (
                <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-4)' }}>
                  <div style={{
                    display: 'inline-block', width: 24, height: 24,
                    border: '2px solid var(--border)', borderTopColor: 'var(--accent)',
                    borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: 8
                  }} />
                  <div>{isRu ? 'Загрузка...' : 'Yuklanmoqda...'}</div>
                </div>
              ) : accounts.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-4)', fontSize: 13 }}>
                  {isRu ? 'Счета не найдены' : 'Hisoblar topilmadi'}
                </div>
              ) : (
                accounts.map(acc => {
                  const typeLabel = acc.type === 'card' 
                    ? (isRu ? 'Карта' : 'Plastik karta')
                    : acc.type === 'bank' 
                      ? (isRu ? 'Банковский счет' : 'Bank hisobi')
                      : acc.type === 'cash' 
                        ? (isRu ? 'Касса (Наличные)' : 'Kassa (Naqd pul)')
                        : (isRu ? 'Резерв' : 'Zaxira jamg\'armasi')

                  const typeColor = acc.type === 'card' ? '#a78bfa' 
                    : acc.type === 'bank' ? '#60a5fa' 
                    : acc.type === 'cash' ? '#34d399' 
                    : '#fbbf24'

                  const typeBg = acc.type === 'card' ? 'rgba(139, 92, 246, 0.15)'
                    : acc.type === 'bank' ? 'rgba(59, 130, 246, 0.15)'
                    : acc.type === 'cash' ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(245, 158, 11, 0.15)'

                  return (
                    <div key={acc.id} className="account-card" style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      padding: '18px 20px',
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 14,
                      position: 'relative',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: 0.8,
                          padding: '4px 10px',
                          borderRadius: 20,
                          background: typeBg,
                          color: typeColor,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: typeColor }}></span>
                          {typeLabel}
                        </span>

                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => handleEditClick(acc)}
                            style={{
                              background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                              color: 'var(--text-3)', padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', transition: 'all 0.15s ease'
                            }}
                            title={isRu ? 'Редактировать' : 'Tahrirlash'}
                          >
                            <EditRegular fontSize={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(acc)}
                            style={{
                              background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                              color: '#ef4444', padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', transition: 'all 0.15s ease'
                            }}
                            title={isRu ? 'Удалить' : 'O\'chirish'}
                          >
                            <DeleteRegular fontSize={14} />
                          </button>
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>
                          {isRu ? acc.nameRu : acc.nameUz}
                        </div>
                        {acc.accountNumber && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                            <span style={{ 
                              fontSize: 12.5, 
                              fontFamily: 'monospace', 
                              letterSpacing: 1.2, 
                              color: 'var(--text-3)', 
                              background: 'var(--surface-2)',
                              padding: '2px 8px',
                              borderRadius: 6,
                              border: '1px solid var(--border)'
                            }}>
                              {formatAccountNumber(acc.accountNumber, acc.type)}
                            </span>
                            <button
                              onClick={() => handleCopy(acc.accountNumber)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-4)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                padding: 4,
                                borderRadius: 4,
                                transition: 'color 0.15s'
                              }}
                              title={isRu ? 'Копировать номер' : 'Raqamni nusxalash'}
                            >
                              <DocumentCopyRegular fontSize={13} />
                            </button>
                          </div>
                        )}
                      </div>

                      <div style={{ 
                        marginTop: 4,
                        paddingTop: 12,
                        borderTop: '1px dashed var(--border)',
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'baseline' 
                      }}>
                        <span style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 500 }}>
                          {isRu ? 'Баланс:' : 'Balans:'}
                        </span>
                        <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>
                          {formatMoney(acc.balance)}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Transfers list */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 20px 0' }}>{isRu ? 'Последние переводы' : 'So\'nggi ichki o\'tkazmalar'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {loading ? (
                <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-4)' }}>
                  <div style={{
                    display: 'inline-block', width: 24, height: 24,
                    border: '2px solid var(--border)', borderTopColor: 'var(--accent)',
                    borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: 8
                  }} />
                  <div>{isRu ? 'Загрузка...' : 'Yuklanmoqda...'}</div>
                </div>
              ) : transfers.length === 0 ? (
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
                <CustomSelect
                  value={fromAccount}
                  onChange={setFromAccount}
                  options={accountOptions}
                  placeholder={isRu ? 'Выберите счет' : 'Hisobni tanlang'}
                />
              </div>

              <div>
                <label style={labelStyle}>{isRu ? 'Куда перевести' : 'Qaysi hisobga'}</label>
                <CustomSelect
                  value={toAccount}
                  onChange={setToAccount}
                  options={accountOptions}
                  placeholder={isRu ? 'Выберите счет' : 'Hisobni tanlang'}
                />
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
      {/* Add Account Modal */}
      {showAddAccountModal && (
        <div style={modalOverlayStyle} onClick={() => setShowAddAccountModal(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid var(--border-2)', paddingBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                {isRu ? 'Создать новый счет' : 'Yangi hisob raqami qo\'shish'}
              </h3>
              <button onClick={() => setShowAddAccountModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>
                <DismissCircleRegular fontSize={20} />
              </button>
            </div>

            <form onSubmit={handleAddAccount} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>{isRu ? 'Название (UZ)' : 'Nomi (UZ)'}</label>
                <input
                  type="text"
                  required
                  value={accNameUz}
                  onChange={e => setAccNameUz(e.target.value)}
                  placeholder="Masalan: Milliy Bank"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>{isRu ? 'Название (RU)' : 'Nomi (RU)'}</label>
                <input
                  type="text"
                  required
                  value={accNameRu}
                  onChange={e => setAccNameRu(e.target.value)}
                  placeholder="Например: Национальный Банк"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>{isRu ? 'Тип' : 'Turi'}</label>
                  <CustomSelect
                    value={accType}
                    onChange={setAccType}
                    options={typeOptions}
                  />
                </div>
                <div>
                  <label style={labelStyle}>{isRu ? 'Начальный баланс' : 'Boshlang\'ich balans'}</label>
                  <input
                    type="number"
                    value={accBalance}
                    onChange={e => setAccBalance(e.target.value)}
                    placeholder="0"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>{getAccountNumberLabel()}</label>
                <input
                  type="text"
                  value={accNumber}
                  onChange={e => setAccNumber(e.target.value)}
                  placeholder={getAccountNumberPlaceholder()}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 12, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowAddAccountModal(false)}
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
                  {isRu ? 'Создать' : 'Yaratish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Account Modal */}
      {showEditAccountModal && (
        <div style={modalOverlayStyle} onClick={() => setShowEditAccountModal(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid var(--border-2)', paddingBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                {isRu ? 'Редактировать счет' : 'Hisobni tahrirlash'}
              </h3>
              <button onClick={() => setShowEditAccountModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>
                <DismissCircleRegular fontSize={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>{isRu ? 'Название (UZ)' : 'Nomi (UZ)'}</label>
                <input
                  type="text"
                  required
                  value={accNameUz}
                  onChange={e => setAccNameUz(e.target.value)}
                  placeholder="Masalan: Milliy Bank"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>{isRu ? 'Название (RU)' : 'Nomi (RU)'}</label>
                <input
                  type="text"
                  required
                  value={accNameRu}
                  onChange={e => setAccNameRu(e.target.value)}
                  placeholder="Например: Национальный Банк"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>{isRu ? 'Тип' : 'Turi'}</label>
                  <CustomSelect
                    value={accType}
                    onChange={setAccType}
                    options={typeOptions}
                  />
                </div>
                <div>
                  <label style={labelStyle}>{isRu ? 'Текущий баланс' : 'Joriy balans'}</label>
                  <input
                    type="number"
                    value={accBalance}
                    onChange={e => setAccBalance(e.target.value)}
                    placeholder="0"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>{getAccountNumberLabel()}</label>
                <input
                  type="text"
                  value={accNumber}
                  onChange={e => setAccNumber(e.target.value)}
                  placeholder={getAccountNumberPlaceholder()}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 12, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowEditAccountModal(false)}
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
