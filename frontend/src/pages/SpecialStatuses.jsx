import { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useToast } from '../components/Toaster'
import { useConfirm } from '../components/ConfirmDialog'
import {
  SearchRegular,
  FilterRegular,
  AddRegular,
  DeleteRegular,
  CalendarRegular,
  DismissRegular,
  SearchSquareRegular,
  BriefcaseRegular,
  OpenRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import Skeleton from '../components/Skeleton'
import CustomSelect from '../components/CustomSelect'

export default function SpecialStatuses() {
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()

  const statusOptions = useMemo(() => [
    { value: 'vacation', label: isRu ? 'Отпуск' : "Ta'til" },
    { value: 'business_trip', label: isRu ? 'Командировка' : 'Xizmat safari' },
    { value: 'sick_leave', label: isRu ? 'Больничный' : 'Kasallik' },
    { value: 'suspended', label: isRu ? 'Отстранение (Временное)' : 'Chetlashtirish (Vaqtincha)' },
    { value: 'other', label: isRu ? 'Другое (Справка/Рапорт)' : 'Boshqa (Spravka/Hujjat)' },
    { value: 'resigned', label: isRu ? 'Увольнение (Постоянное)' : 'Ishdan boʻshash (Doimiy)' }
  ], [isRu])

  // State lists
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)

  // User and role
  const [currentUser, setCurrentUser] = useState(null)
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setCurrentUser(d)
          const userRole = (d.role || '').toLowerCase().replace(/_/g, '')
          if (userRole === 'buxgalter') {
            toast.error(isRu ? 'Доступ запрещен' : 'Kirish taqiqlangan')
            navigate('/dashboard')
          }
        }
      })
      .catch(() => {})
  }, [navigate, isRu])
  const role = (currentUser?.role || '').toLowerCase().replace(/_/g, '')
  const canEdit = role !== 'buxgalter'

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  // Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [empSearchQuery, setEmpSearchQuery] = useState('')
  const [empSuggestions, setEmpSuggestions] = useState([])
  const [searchingEmployees, setSearchingEmployees] = useState(false)

  // Form State
  const [statusType, setStatusType] = useState('vacation')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [comment, setComment] = useState('')
  const [documentFile, setDocumentFile] = useState(null)
  const [saving, setSaving] = useState(false)

  const suggestionRef = useRef(null)

  // Fetch status records
  const fetchRecords = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/employees/status-records', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setRecords(data)
      } else {
        toast.error(isRu ? 'Ошибка при загрузке статусов' : 'Statuslarni yuklashda xatolik yuz berdi')
      }
    } catch (err) {
      console.error(err)
      toast.error(isRu ? 'Сетевая ошибка' : 'Aloqa xatoligi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecords()
  }, [])

  // Employee search autocomplete
  useEffect(() => {
    if (!empSearchQuery.trim() || selectedEmployee) {
      setEmpSuggestions([])
      return
    }

    const delayDebounce = setTimeout(async () => {
      setSearchingEmployees(true)
      try {
        const res = await fetch(`/api/employees/search?query=${encodeURIComponent(empSearchQuery)}&page_size=10`, { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setEmpSuggestions(data.items || [])
        }
      } catch (err) {
        console.error(err)
      } finally {
        setSearchingEmployees(false)
      }
    }, 300)

    return () => clearTimeout(delayDebounce)
  }, [empSearchQuery, selectedEmployee])

  // Click outside suggestions
  useEffect(() => {
    function handleClickOutside(event) {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target)) {
        setEmpSuggestions([])
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Delete status record
  const handleDelete = async (record) => {
    if (!canEdit) {
      toast.error(isRu ? 'У вас нет прав для выполнения этого действия' : 'Ushbu amalni bajarish uchun sizda huquq yo\'q')
      return
    }
    const titleUz = 'Holatni oʻchirish'
    const titleRu = 'Удалить статус'
    const messageUz = `Haqiqatan ham ${record.employee_name} uchun belgilangan maxsus holatni oʻchirmoqchimisiz?`
    const messageRu = `Вы действительно хотите удалить особый статус для сотрудника ${record.employee_name}?`

    const ok = await confirm({
      title: isRu ? titleRu : titleUz,
      message: isRu ? messageRu : messageUz,
    })

    if (!ok) return

    try {
      const res = await fetch(`/api/employees/status-records/${record.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (res.ok) {
        toast.success(isRu ? 'Статус успешно удален' : 'Status muvaffaqiyatli oʻchirildi')
        fetchRecords()
      } else {
        toast.error(isRu ? 'Ошибка при удалении статуса' : 'Statusni oʻchirishda xatolik')
      }
    } catch (err) {
      console.error(err)
      toast.error(isRu ? 'Сетевая ошибка' : 'Aloqa xatoligi')
    }
  }

  // Create status record
  const handleSave = async (e) => {
    e.preventDefault()
    if (!canEdit) {
      toast.error(isRu ? 'У вас нет прав для выполнения этого действия' : 'Ushbu amalni bajarish uchun sizda huquq yo\'q')
      return
    }
    if (!selectedEmployee) {
      toast.warning(isRu ? 'Выберите сотрудника' : 'Xodimni tanlang')
      return
    }
    if (!startDate) {
      toast.warning(isRu ? 'Выберите дату начала' : 'Boshlanish sanasini tanlang')
      return
    }

    setSaving(true)
    try {
      const formData = new FormData()
      formData.append('employee_id', selectedEmployee.id)
      formData.append('status_type', statusType)
      formData.append('start_date', startDate)
      if (statusType !== 'resigned' && endDate) {
        formData.append('end_date', endDate)
      }
      if (comment) {
        formData.append('comment', comment)
      }
      if (documentFile) {
        formData.append('document', documentFile)
      }

      const res = await fetch('/api/employees/status-records', {
        method: 'POST',
        credentials: 'include',
        body: formData
      })

      if (res.ok) {
        toast.success(isRu ? 'Статус успешно добавлен' : 'Status muvaffaqiyatli qoʻshildi')
        setModalOpen(false)
        // Reset form
        setSelectedEmployee(null)
        setEmpSearchQuery('')
        setStatusType('vacation')
        setStartDate('')
        setEndDate('')
        setComment('')
        setDocumentFile(null)
        // Refresh list
        fetchRecords()
      } else {
        const errorData = await res.json()
        toast.error(errorData.detail || (isRu ? 'Ошибка при сохранении' : 'Saqlashda xatolik yuz berdi'))
      }
    } catch (err) {
      console.error(err)
      toast.error(isRu ? 'Aloqa xatoligi' : 'Aloqa xatoligi')
    } finally {
      setSaving(false)
    }
  }

  // Filter records
  const filteredRecords = records.filter(rec => {
    const matchesSearch = rec.employee_name?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = filterStatus === 'all' || rec.status_type === filterStatus
    return matchesSearch && matchesStatus
  })

  // Status mapping
  const getStatusText = (type) => {
    switch (type) {
      case 'vacation': return isRu ? 'Отпуск' : "Ta'til"
      case 'business_trip': return isRu ? 'Командировка' : 'Xizmat safari'
      case 'sick_leave': return isRu ? 'Больничный' : 'Kasallik'
      case 'resigned': return isRu ? 'Уволен' : 'Ishdan boʻshagan'
      case 'suspended': return isRu ? 'Отстранен' : 'Chetlashtirish'
      case 'other': return isRu ? 'Другое (Справка/Рапорт)' : 'Boshqa (Spravka/Hujjat)'
      default: return type
    }
  }

  const getStatusPillColors = (type) => {
    switch (type) {
      case 'vacation': return { bg: 'rgba(79, 70, 229, 0.12)', color: '#818cf8' }
      case 'business_trip': return { bg: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24' }
      case 'sick_leave': return { bg: 'rgba(244, 63, 94, 0.12)', color: '#f87171' }
      case 'resigned': return { bg: 'rgba(239, 68, 68, 0.12)', color: '#f87171' }
      case 'suspended': return { bg: 'rgba(71, 85, 105, 0.15)', color: '#94a3b8' }
      case 'other': return { bg: 'rgba(14, 165, 233, 0.12)', color: '#38bdf8' }
      default: return { bg: 'rgba(255,255,255,0.06)', color: 'var(--text-3)' }
    }
  }

  function StatusBadge({ type }) {
    const colors = getStatusPillColors(type)
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center',
        padding: '3px 9px', borderRadius: 999,
        background: colors.bg, color: colors.color,
        fontSize: 11, fontWeight: 600,
        border: `1px solid ${colors.color}33`,
      }}>
        {getStatusText(type)}
      </span>
    )
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      
      {/* Page Hero Header consistent with System design */}
      <PageHero
        badge={isRu ? '✦ Статусы' : '✦ Holatlar'}
        title={isRu ? 'Особые статусы сотрудников' : 'Xodimlarning maxsus holatlari'}
        sub={isRu 
          ? 'Управление отпусками, командировками, больничными и увольнениями сотрудников' 
          : "Ta'tillar, xizmat safarlari, kasallik varaqalari va chetlashtirishlarni boshqarish"
        }
        right={
          canEdit && (
            <button
              onClick={() => setModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 16px',
                borderRadius: 8,
                background: 'var(--accent)',
                border: 'none',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <AddRegular fontSize={16} /> {isRu ? 'Добавить статус' : "Holat qo'shish"}
            </button>
          )
        }
      />

      <div style={{ padding: '0 24px 32px 24px', maxWidth: '1280px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        
        {/* Main Wrapper Card */}
        <div style={cardStyle}>
          
          {/* Filters card */}
          <div style={toolbarStyle}>
            {/* Search Input */}
            <div style={{ position: 'relative', minWidth: 260, flex: 1 }}>
              <SearchRegular style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)' }} fontSize={15} />
              <input
                type="text"
                placeholder={isRu ? 'Поиск по имени...' : 'Ism boʻyicha qidirish...'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ ...inpStyle, paddingLeft: 32 }}
              />
            </div>

            {/* Status Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 200 }}>
              <FilterRegular style={{ color: 'var(--text-4)' }} fontSize={15} />
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                style={inpStyle}
              >
                <option value="all">{isRu ? 'Все статусы' : 'Barcha holatlar'}</option>
                <option value="vacation">{isRu ? 'Отпуск' : "Ta'til"}</option>
                <option value="business_trip">{isRu ? 'Командировка' : 'Xizmat safari'}</option>
                <option value="sick_leave">{isRu ? 'Больничный' : 'Kasallik'}</option>
                <option value="suspended">{isRu ? 'Отстранение' : 'Vaqtincha chetlashtirilgan'}</option>
                <option value="other">{isRu ? 'Другое' : 'Boshqa'}</option>
                <option value="resigned">{isRu ? 'Увольнение' : 'Ishdan boʻshatilgan'}</option>
              </select>
            </div>
          </div>

          {/* Skeleton Loader or Table */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: 5 }).map((_, i) => <Skeleton.Row key={i} />)}
            </div>
          ) : filteredRecords.length === 0 ? (
            <div style={emptyStyle}>
              {isRu ? 'Особые статусы не найдены.' : 'Maxsus holatlar topilmadi.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>{isRu ? 'Сотрудник' : 'Xodim'}</th>
                    <th style={thStyle}>{isRu ? 'Статус' : 'Holat'}</th>
                    <th style={thStyle}>{isRu ? 'Период' : 'Davri'}</th>
                    <th style={thStyle}>{isRu ? 'Комментарий' : 'Izoh'}</th>
                    <th style={thStyle}>{isRu ? 'Документ' : 'Hujjat'}</th>
                    <th style={thStyle}>{isRu ? 'Дата создания' : 'Yaratilgan sana'}</th>
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((rec) => (
                    <tr key={rec.id}>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <Link to={`/employees/${rec.employee_id}`} style={{
                            color: 'var(--accent)', textDecoration: 'none', fontWeight: 600
                          }}
                            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                          >
                            {rec.employee_name}
                          </Link>
                          <span style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>
                            {rec.employee_position || (isRu ? 'Должность не указана' : 'Lavozim belgilanmagan')}
                          </span>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <StatusBadge type={rec.status_type} />
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-2)' }}>
                          <CalendarRegular fontSize={13} style={{ color: 'var(--text-4)' }} />
                          <span>
                            {rec.start_date} {rec.end_date ? ` — ${rec.end_date}` : ` (${isRu ? 'постоянно' : 'doimiy'})`}
                          </span>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--text-2)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rec.comment || ''}>
                        {rec.comment || <span style={{ color: 'var(--text-4)' }}>—</span>}
                      </td>
                      <td style={tdStyle}>
                        {rec.document_url ? (
                          <a
                            href={rec.document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              color: 'var(--accent)',
                              textDecoration: 'none',
                              fontWeight: 600,
                              fontSize: 12
                            }}
                            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                          >
                            <OpenRegular fontSize={14} />
                            {isRu ? 'Открыть' : 'Koʻrish'}
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-4)' }}>—</span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, fontSize: 12, color: 'var(--text-4)' }}>
                        {rec.created_at ? rec.created_at.substring(0, 10) : '—'}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {canEdit && (
                          <button
                            onClick={() => handleDelete(rec)}
                            style={smallBtn('danger')}
                            title={isRu ? 'Удалить' : "O'chirish"}
                          >
                            <DeleteRegular fontSize={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add New Status Record Modal */}
      {modalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(3px)', padding: 20
        }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 16, width: '100%', maxWidth: 500,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
            overflow: 'hidden', animation: 'bfModalIn 0.2s ease-out'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 20px', borderBottom: '1px solid var(--border)',
              background: 'var(--bg)'
            }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-1)' }}>
                {isRu ? 'Новый особый статус' : 'Yangi maxsus holat qoʻshish'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                style={{
                  background: 'transparent', border: 'none', color: 'var(--text-3)',
                  cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center'
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-1)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
              >
                <DismissRegular fontSize={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              
              {/* Employee search */}
              <div style={{ position: 'relative' }} ref={suggestionRef}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--text-2)' }}>
                  {isRu ? 'Сотрудник / Учащийся' : 'Xodim / Oʻquvchi'} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                {selectedEmployee ? (
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: 7,
                    padding: '8px 12px'
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)' }}>
                        {selectedEmployee.last_name} {selectedEmployee.first_name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>
                        {selectedEmployee.position || (isRu ? 'Должность не указана' : 'Lavozim belgilanmagan')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedEmployee(null); setEmpSearchQuery('') }}
                      style={{
                        background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)',
                        padding: '4px 8px', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 600
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-2)'}
                    >
                      {isRu ? 'Изменить' : 'Oʻzgartirish'}
                    </button>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <SearchRegular style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)' }} fontSize={14} />
                    <input
                      type="text"
                      placeholder={isRu ? 'Введите имя или фамилию...' : 'Ism yoki familiya kiriting...'}
                      value={empSearchQuery}
                      onChange={e => setEmpSearchQuery(e.target.value)}
                      style={{ ...inpStyle, paddingLeft: 30 }}
                    />
                    {searchingEmployees && (
                      <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                        <div className="animate-spin" style={{ width: 12, height: 12, border: '2px solid var(--border-2)', borderTopColor: 'var(--accent)', borderRadius: '50%' }}></div>
                      </div>
                    )}
                    
                    {/* Autocomplete Suggestions */}
                    {empSuggestions.length > 0 && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 7, boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
                        maxHeight: 180, overflowY: 'auto', zIndex: 10
                      }}>
                        {empSuggestions.map(emp => (
                          <div
                            key={emp.id}
                            onClick={() => {
                              setSelectedEmployee(emp)
                              setEmpSuggestions([])
                            }}
                            style={{
                              padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-2)',
                              transition: 'background-color 0.1s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                              {emp.last_name} {emp.first_name} {emp.middle_name || ''}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>
                              {emp.position || (isRu ? 'Должность не указана' : 'Lavozim belgilanmagan')}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Status Type */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--text-2)' }}>
                  {isRu ? 'Тип статуса' : 'Holat turi'} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <CustomSelect
                  options={statusOptions}
                  value={statusType}
                  onChange={val => setStatusType(val || 'vacation')}
                  placeholder={isRu ? 'Выберите status' : 'Holatni tanlang'}
                />
                {statusType === 'resigned' && (
                  <p style={{ margin: '5px 0 0 0', color: 'var(--red)', fontSize: 11, fontWeight: 500 }}>
                    {isRu 
                      ? 'Внимание: Доступ сотрудника к системе будет аннулирован.' 
                      : 'Eslatma: Xodimning tizimga va kameralarga kirish huquqlari oʻchiriladi.'
                    }
                  </p>
                )}
              </div>

              {/* Dates */}
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--text-2)' }}>
                    {isRu ? 'Дата начала' : 'Boshlanish sanasi'} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    required
                    style={inpStyle}
                  />
                </div>

                {statusType !== 'resigned' && (
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--text-2)' }}>
                      {isRu ? 'Дата окончания' : 'Tugash sanasi'}
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      style={inpStyle}
                    />
                  </div>
                )}
              </div>

              {/* Comment */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--text-2)' }}>
                  {isRu ? 'Комментарий' : 'Izoh'}
                </label>
                <textarea
                  rows="3"
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder={isRu ? 'Причина, приказ №...' : 'Sababi, buyruq raqami va h.k...'}
                  style={{ ...inpStyle, resize: 'vertical' }}
                />
              </div>

              {/* Document upload */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-2)' }}>
                  {isRu ? 'Документ (Справка / Рапорт / другое - Необязательно)' : 'Hujjat (Spravka / Hujjat / boshqa - Ixtiyoriy)'}
                </label>
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px',
                    borderRadius: 9,
                    border: '2px dashed var(--border-3)',
                    background: 'var(--bg)',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s, background-color 0.2s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.backgroundColor = 'var(--surface-2)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border-3)';
                    e.currentTarget.style.backgroundColor = 'var(--bg)';
                  }}
                  onClick={() => document.getElementById('status-file-input').click()}
                >
                  <input
                    id="status-file-input"
                    type="file"
                    onChange={e => setDocumentFile(e.target.files[0] || null)}
                    style={{ display: 'none' }}
                  />
                  {documentFile ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        background: 'rgba(16, 185, 129, 0.12)',
                        color: '#10b981',
                        fontSize: 16,
                        flexShrink: 0
                      }}>
                        📄
                      </div>
                      <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, color: 'var(--text-1)' }} title={documentFile.name}>
                        {documentFile.name}
                        <div style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 2 }}>
                          {Math.round(documentFile.size / 1024)} KB
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDocumentFile(null);
                          document.getElementById('status-file-input').value = '';
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: 4,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'none'}
                      >
                        <DismissRegular fontSize={14} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 24, marginBottom: 4 }}>📤</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                        {isRu ? 'Выберите файл' : 'Faylni tanlash'}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 2 }}>
                        {isRu ? 'PDF, JPG, PNG или другие форматы' : 'PDF, JPG, PNG yoki boshqa formatlar'}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Buttons */}
              <div style={{
                display: 'flex', justifyContent: 'flex-end', gap: 10,
                marginTop: 10, paddingTop: 14, borderTop: '1px solid var(--border)'
              }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    background: 'transparent', border: '1px solid var(--border-2)',
                    color: 'var(--text-1)', padding: '8px 16px', borderRadius: 7,
                    cursor: 'pointer', fontSize: 13, fontWeight: 600
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {isRu ? 'Отмена' : 'Bekor qilish'}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    background: 'var(--accent)',
                    color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 7,
                    cursor: 'pointer', fontSize: 13, fontWeight: 600,
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

      {/* Modal Keyframe animations */}
      <style>{`
        @keyframes bfModalIn {
          from { opacity: 0; transform: scale(0.96) translateY(5px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Styles matching the overall application layout
// ────────────────────────────────────────────────────────────────────────────
const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }
const toolbarStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 16 }
const inpStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 7,
  border: '1px solid var(--border-2)', background: 'var(--bg)',
  color: 'var(--text-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
}
const tableStyle = { width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }
const thStyle = {
  textAlign: 'left', padding: '10px 12px', fontSize: 11,
  fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase',
  letterSpacing: 0.4, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
}
const tdStyle = { padding: '12px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
const emptyStyle = { padding: 32, textAlign: 'center', color: 'var(--text-4)', fontSize: 13, background: 'var(--bg)', borderRadius: 8, border: '1px dashed var(--border-2)' }

function smallBtn(kind) {
  const map = {
    accent: { bg: 'var(--accent)', color: '#fff' },
    danger: { bg: '#f43f5e', color: '#fff' },
    subtle: { bg: 'var(--surface-2)', color: 'var(--text-1)', border: '1px solid var(--border-2)' },
  }
  const t = map[kind] || map.subtle
  return {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '6px 10px', borderRadius: 6,
    background: t.bg, color: t.color,
    border: t.border || 'none',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
  }
}
