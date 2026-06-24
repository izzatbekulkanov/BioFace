import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MoneyRegular,
  BriefcaseRegular,
  BuildingRegular,
  ArrowSyncRegular,
  SearchRegular,
  EditRegular,
  DismissCircleRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import Skeleton from '../components/Skeleton'
import { useToast } from '../components/Toaster'
import CustomSelect from '../components/CustomSelect'

export default function SalaryRates() {
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const toast = useToast()

  const [positions, setPositions] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [search, setSearch] = useState('')
  const [orgFilter, setOrgFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Edit Modal States
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedPosition, setSelectedPosition] = useState(null)
  const [salaryInput, setSalaryInput] = useState('')
  const [saving, setSaving] = useState(false)

  // Employees Modal States
  const [showEmployeesModal, setShowEmployeesModal] = useState(false)
  const [modalPositionName, setModalPositionName] = useState('')
  const [modalEmployees, setModalEmployees] = useState([])
  const [loadingEmployees, setLoadingEmployees] = useState(false)

  const loadRates = async () => {
    try {
      const params = new URLSearchParams()
      if (orgFilter !== 'all') {
        params.set('organization_id', orgFilter)
      }
      const res = await fetch(`/api/employee-catalogs?${params.toString()}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setPositions(data.positions || [])
        setOrganizations(data.organizations || [])
        
        // Auto-select first org if not set and there is only 1 org
        if (orgFilter === 'all' && data.organizations?.length === 1) {
          setOrgFilter(String(data.organizations[0].id))
        }
      }
    } catch (err) {
      console.error('Failed to load salary rates:', err)
      toast.error(isRu ? 'Ошибка загрузки данных' : 'Ma\'lumotlarni yuklashda xatolik yuz berdi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRates()
  }, [orgFilter])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadRates()
    setRefreshing(false)
    toast.success(isRu ? 'Данные обновлены' : 'Ma\'lumotlar yangilandi')
  }

  const formatMoney = (val) => {
    if (!val) return '—'
    const num = parseFloat(String(val).replace(/\s/g, ''))
    if (isNaN(num)) return val
    return new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS', maximumFractionDigits: 0 }).format(num)
  }

  const formatSalaryOptions = (options) => {
    if (!options) return '—'
    return options.split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(formatMoney)
      .join(' / ')
  }

  const handleEditClick = (pos) => {
    setSelectedPosition(pos)
    setSalaryInput(pos.salary_options || '')
    setShowEditModal(true)
  }

  const handleEmployeesClick = async (pos) => {
    if (pos.employee_count === 0) return
    setModalPositionName(pos.name)
    setModalEmployees([])
    setLoadingEmployees(true)
    setShowEmployeesModal(true)
    try {
      const res = await fetch(`/api/employees?position_id=${pos.id}&paginate=false`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setModalEmployees(Array.isArray(data) ? data : (data.items || []))
      }
    } catch (err) {
      console.error('Failed to load employees for position:', err)
      toast.error(isRu ? 'Ошибка загрузки списка сотрудников' : 'Xodimlar ro\'yxatini yuklashda xatolik yuz berdi')
    } finally {
      setLoadingEmployees(false)
    }
  }

  const handleSaveSalary = async (e) => {
    e.preventDefault()
    if (!selectedPosition) return
    setSaving(true)
    try {
      const res = await fetch(`/api/employee-catalogs/positions/${selectedPosition.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department_id: selectedPosition.department_id,
          name: selectedPosition.name,
          salary_options: salaryInput.trim()
        })
      })
      if (res.ok) {
        toast.success(isRu ? 'Ставка успешно сохранена' : 'Maosh stavkasi muvaffaqiyatli saqlandi')
        setShowEditModal(false)
        loadRates()
      } else {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || 'Failed to save')
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const filteredPositions = useMemo(() => {
    const q = search.trim().toLowerCase()
    return positions.filter(pos => {
      const matchesSearch =
        pos.name.toLowerCase().includes(q) ||
        (pos.department_name || '').toLowerCase().includes(q) ||
        (pos.organization_name || '').toLowerCase().includes(q)
      return matchesSearch
    })
  }, [positions, search])

  const orgOptions = useMemo(() => {
    return [
      { value: 'all', label: isRu ? 'Все организации' : 'Barcha tashkilotlar' },
      ...organizations.map(org => ({ value: String(org.id), label: org.name }))
    ]
  }, [organizations, isRu])

  const cardStyle = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 24,
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

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={isRu ? '✦ Финансы' : '✦ Moliya'}
        title={isRu ? 'Оклады и ставки' : 'Oylik Maosh Stavkalari'}
        sub={isRu ? 'Должностные оклады, ставки и сетка заработной платы сотрудников' : 'Tashkilot bo\'limlari, lavozimlari va ularning oylik maosh stavkalari'}
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
        .rates-container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 24px 32px 80px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        @media (max-width: 900px) {
          .rates-container {
            padding: 16px 16px 60px !important;
            gap: 16px !important;
          }
        }
      `}</style>

      <div className="rates-container">
        <div style={cardStyle}>
          {/* Filters Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
              <SearchRegular fontSize={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={isRu ? 'Поиск по названию или отделу...' : 'Lavozim yoki bo\'lim bo\'yicha qidirish...'}
                style={{
                  width: '100%', padding: '9px 12px 9px 36px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>

            {organizations.length > 1 && (
              <div style={{ minWidth: 200 }}>
                <CustomSelect
                  options={orgOptions}
                  value={orgFilter}
                  onChange={val => setOrgFilter(val || 'all')}
                  placeholder={isRu ? 'Все организации' : 'Barcha tashkilotlar'}
                />
              </div>
            )}
          </div>

          {/* Table Container */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-4)', fontSize: 12.5 }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600, width: 50 }}>№</th>
                  {organizations.length > 1 && (
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Организация' : 'Tashkilot'}</th>
                  )}
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Отдел / Подразделение' : 'Bo\'lim / Shuba'}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Должность' : 'Lavozim'}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Ставки окладов (UZS)' : 'Oylik Maosh Stavkalari (UZS)'}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>{isRu ? 'Сотрудники' : 'Xodimlar soni'}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>{isRu ? 'Действие' : 'Amal'}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-2)' }}>
                      <td style={{ padding: '14px 16px' }}><Skeleton width={20} height={12} /></td>
                      {organizations.length > 1 && (
                        <td style={{ padding: '14px 16px' }}><Skeleton width={100} height={12} /></td>
                      )}
                      <td style={{ padding: '14px 16px' }}><Skeleton width={100} height={12} /></td>
                      <td style={{ padding: '14px 16px' }}><Skeleton width={120} height={12} /></td>
                      <td style={{ padding: '14px 16px' }}><Skeleton width={110} height={12} /></td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}><Skeleton width={30} height={12} style={{ margin: '0 auto' }} /></td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}><Skeleton width={50} height={12} style={{ marginLeft: 'auto' }} /></td>
                    </tr>
                  ))
                ) : filteredPositions.length === 0 ? (
                  <tr>
                    <td colSpan={organizations.length > 1 ? 7 : 6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-4)' }}>
                      {isRu ? 'Ставки не найдены' : 'Maosh stavkalari topilmadi'}
                    </td>
                  </tr>
                ) : (
                  filteredPositions.map((pos, idx) => (
                    <tr key={pos.id} style={{ borderBottom: '1px solid var(--border-2)', fontSize: 13, color: 'var(--text-2)' }}>
                      <td style={{ padding: '14px 16px', color: 'var(--text-4)', fontWeight: 600 }}>{idx + 1}</td>
                      {organizations.length > 1 && (
                        <td style={{ padding: '14px 16px', fontWeight: 500 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <BuildingRegular style={{ color: 'var(--text-4)' }} fontSize={14} />
                            {pos.organization_name}
                          </span>
                        </td>
                      )}
                      <td style={{ padding: '14px 16px' }}>
                        {pos.department_name || (isRu ? 'Без отдела' : 'Bo\'limsiz')}
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-1)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <BriefcaseRegular style={{ color: 'var(--accent)' }} fontSize={14} />
                          {pos.name}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: '#10b981' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <MoneyRegular fontSize={14} />
                          {formatSalaryOptions(pos.salary_options)}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 600 }}>
                        <span
                          onClick={() => handleEmployeesClick(pos)}
                          style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: 12,
                            background: pos.employee_count > 0 ? 'rgba(59,130,246,0.1)' : 'var(--border-2)',
                            color: pos.employee_count > 0 ? '#3b82f6' : 'var(--text-4)',
                            fontSize: 12,
                            cursor: pos.employee_count > 0 ? 'pointer' : 'default',
                            textDecoration: pos.employee_count > 0 ? 'underline' : 'none',
                          }}
                          title={pos.employee_count > 0 ? (isRu ? 'Показать сотрудников' : 'Xodimlarni ko\'rsatish') : ''}
                        >
                          {pos.employee_count}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleEditClick(pos)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--accent)',
                            cursor: 'pointer',
                            padding: '4px 8px',
                            borderRadius: 6,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 12.5,
                            fontWeight: 600,
                            transition: 'background 0.2s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--border-2)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <EditRegular fontSize={14} />
                          {isRu ? 'Изменить' : 'Tahrirlash'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Salary Modal */}
      {showEditModal && selectedPosition && (
        <div style={modalOverlayStyle} onClick={() => setShowEditModal(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid var(--border-2)', paddingBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                {isRu ? 'Редактировать оклад' : 'Maosh stavkasini tahrirlash'}
              </h3>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>
                <DismissCircleRegular fontSize={20} />
              </button>
            </div>

            <form onSubmit={handleSaveSalary} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>{isRu ? 'Отдел' : 'Bo\'lim'}</label>
                <div style={{ fontSize: 13.5, color: 'var(--text-2)', padding: '6px 0' }}>
                  {selectedPosition.department_name || (isRu ? 'Без отдела' : 'Bo\'limsiz')}
                </div>
              </div>

              <div>
                <label style={labelStyle}>{isRu ? 'Должность' : 'Lavozim'}</label>
                <div style={{ fontSize: 13.5, color: 'var(--text-1)', fontWeight: 600, padding: '6px 0' }}>
                  {selectedPosition.name}
                </div>
              </div>

              <div>
                <label style={labelStyle}>{isRu ? 'Варианты окладов (UZS)' : 'Maosh variantlari (UZS)'}</label>
                <input
                  type="text"
                  value={salaryInput}
                  onChange={e => setSalaryInput(e.target.value)}
                  placeholder="3000000, 4500000, 6000000"
                  style={inputStyle}
                />
                <span style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 6, display: 'block', lineHeight: 1.4 }}>
                  {isRu
                    ? 'Введите суммы окладов через запятую, если их несколько (например: 3000000, 4500000)'
                    : 'Maosh variantlarini vergul bilan ajratib kiriting (masalan: 3000000, 4500000)'
                  }
                </span>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 12, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  disabled={saving}
                  style={{
                    padding: '9px 18px', borderRadius: 8, border: '1px solid var(--border)',
                    background: 'transparent', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  {isRu ? 'Отмена' : 'Bekor qilish'}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '9px 18px', borderRadius: 8, border: 'none',
                    background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    opacity: saving ? 0.7 : 1
                  }}
                >
                  {saving ? (isRu ? 'Сохранение...' : 'Saqlanmoqda...') : (isRu ? 'Сохранить' : 'Saqlash')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Position Employees Modal */}
      {showEmployeesModal && (
        <div style={modalOverlayStyle} onClick={() => setShowEmployeesModal(false)}>
          <div style={{ ...modalContentStyle, width: 500 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid var(--border-2)', paddingBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                {isRu ? `Сотрудники на должности: ${modalPositionName}` : `Lavozimdagi xodimlar: ${modalPositionName}`}
              </h3>
              <button onClick={() => setShowEmployeesModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>
                <DismissCircleRegular fontSize={20} />
              </button>
            </div>

            <div style={{ maxHeight: 350, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 4 }}>
              {loadingEmployees ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-4)' }}>
                  <div style={{
                    display: 'inline-block', width: 24, height: 24,
                    border: '2px solid var(--border)', borderTopColor: 'var(--accent)',
                    borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: 8
                  }} />
                  <div>{isRu ? 'Загрузка...' : 'Yuklanmoqda...'}</div>
                </div>
              ) : modalEmployees.length === 0 ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-4)' }}>
                  {isRu ? 'Сотрудники не найдены' : 'Xodimlar topilmadi'}
                </div>
              ) : (
                modalEmployees.map((emp) => (
                  <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
                    {/* Avatar */}
                    {emp.avatar ? (
                      <img src={emp.avatar} alt={emp.full_name} style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
                    ) : (
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--accent-bg)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
                        {emp.full_name ? emp.full_name.charAt(0).toUpperCase() : '?'}
                      </div>
                    )}
                    {/* Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-1)' }}>{emp.full_name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 2 }}>{emp.phone || (isRu ? 'Нет телефона' : 'Telefon raqamsiz')}</div>
                    </div>
                    {/* Salary */}
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#10b981', textAlign: 'right' }}>
                      {formatMoney(emp.salary)}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                onClick={() => setShowEmployeesModal(false)}
                style={{
                  padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                }}
              >
                {isRu ? 'Закрыть' : 'Yopish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
