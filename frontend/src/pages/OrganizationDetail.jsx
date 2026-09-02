import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  BuildingRegular,
  ArrowSyncRegular,
  EditRegular,
  DeleteRegular,
  DismissRegular,
  CheckmarkRegular,
  AddRegular,
  PeopleRegular,
  PersonRegular,
  BuildingMultipleRegular,
  ChevronLeftRegular,
  QuestionCircleRegular,
  EyeRegular,
  PhoneRegular,
  LocationRegular,
  ClockRegular,
  HatGraduationRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import Skeleton from '../components/Skeleton'
import { useConfirm } from '../components/ConfirmDialog'
import { useToast } from '../components/Toaster'
import CustomSelect from '../components/CustomSelect'

export default function OrganizationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const confirm = useConfirm()
  const toast = useToast()

  const [org, setOrg] = useState(null)
  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])
  const [employees, setEmployees] = useState([])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  // Selection states
  const [selectedDeptId, setSelectedDeptId] = useState(null)

  // Filters for member table
  const [memberTypeFilter, setMemberTypeFilter] = useState('all')
  const [memberSearch, setMemberSearch] = useState('')

  // Modals state
  const [showDeptModal, setShowDeptModal] = useState(false)
  const [editingDept, setEditingDept] = useState(null)
  const [deptName, setDeptName] = useState('')

  const [showPosModal, setShowPosModal] = useState(false)
  const [editingPos, setEditingPos] = useState(null)
  const [posName, setPosName] = useState('')
  const [posSalaryOptions, setPosSalaryOptions] = useState('')
  const [showViewPosModal, setShowViewPosModal] = useState(false)
  const [viewingPos, setViewingPos] = useState(null)

  // Default classes state
  const [showDefaultClassesModal, setShowDefaultClassesModal] = useState(false)
  const [defaultFormat, setDefaultFormat] = useState('number')
  const [startGrade, setStartGrade] = useState(1)
  const [endGrade, setEndGrade] = useState(11)
  const [includeLetters, setIncludeLetters] = useState(true)
  const [lettersInput, setLettersInput] = useState('A, B, C, D, E, F')
  const [creatingClasses, setCreatingClasses] = useState(false)

  const aliveRef = useRef(true)

  // Fetch organization and its metadata
  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    try {
      const [orgRes, catalogRes, employeesRes] = await Promise.all([
        fetch(`/api/organizations/${id}?lang=${i18n.language}`, { credentials: 'include' }),
        fetch(`/api/organizations/${id}/employee-catalogs`, { credentials: 'include' }),
        fetch(`/api/employees?organization_id=${id}&paginate=false`, { credentials: 'include' }),
      ])

      if (!orgRes.ok) {
        if (orgRes.status === 404) throw new Error(isRu ? 'Организация не найдена' : 'Tashkilot topilmadi')
        throw new Error(`HTTP ${orgRes.status}`)
      }

      const orgData = await orgRes.json()
      if (orgData.uuid && id !== orgData.uuid) {
        navigate(`/organizations/${orgData.uuid}`, { replace: true })
        return
      }
      const catalogData = catalogRes.ok ? await catalogRes.json() : { departments: [], positions: [] }
      const employeesData = employeesRes.ok ? await employeesRes.json() : []

      if (aliveRef.current) {
        setOrg(orgData)
        setDepartments(Array.isArray(catalogData.departments) ? catalogData.departments : [])
        setPositions(Array.isArray(catalogData.positions) ? catalogData.positions : [])
        setEmployees(Array.isArray(employeesData) ? employeesData : [])
        setError('')

        // Auto-select first department if none selected and departments exist
        if (!selectedDeptId && catalogData.departments?.length > 0) {
          setSelectedDeptId(catalogData.departments[0].id)
        }
      }
    } catch (e) {
      if (aliveRef.current) setError(e.message)
    } finally {
      if (aliveRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [id, isRu, i18n.language, selectedDeptId, navigate])

  useEffect(() => {
    aliveRef.current = true
    load()
    return () => {
      aliveRef.current = false
    }
  }, [id])

  const isSchool = org?.organization_type === 'maktab'

  // Labels helper depending on organization type
  const getLabel = (key, fallback) => {
    if (isSchool) {
      return t(`organizationDetail.school.${key}`, fallback)
    }
    return t(`organizationDetail.${key}`, fallback)
  }

  // Naturally sorted departments (1, 2, 3 ... 9, 10, 11)
  const sortedDepartments = useMemo(() => {
    return [...departments].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' })
    )
  }, [departments])

  // Filter positions for selected department and sort naturally (A, B, C, D, E, F)
  const filteredPositions = useMemo(() => {
    if (!selectedDeptId) return []
    return positions
      .filter(p => p.department_id === selectedDeptId)
      .sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' })
      )
  }, [positions, selectedDeptId])

  // Selected department details
  const selectedDept = useMemo(() => {
    return departments.find(d => d.id === selectedDeptId)
  }, [departments, selectedDeptId])

  // Filter employees for listing
  const filteredEmployees = useMemo(() => {
    let list = employees
    
    // 1. Filter by selected department if any
    if (selectedDeptId) {
      list = list.filter(e => e.department_id === selectedDeptId)
    }

    // 2. Filter by member type
    if (memberTypeFilter !== 'all') {
      if (memberTypeFilter === 'student') {
        list = list.filter(e => ['oquvchi', 'talaba', 'student'].includes(e.employee_type?.toLowerCase()))
      } else if (memberTypeFilter === 'staff') {
        list = list.filter(e => !['oquvchi', 'talaba', 'student'].includes(e.employee_type?.toLowerCase()))
      }
    }

    // 3. Filter by search query
    const q = memberSearch.trim().toLowerCase()
    if (q) {
      list = list.filter(e =>
        `${e.first_name || ''} ${e.last_name || ''} ${e.middle_name || ''}`.toLowerCase().includes(q) ||
        (e.personal_id || '').toLowerCase().includes(q) ||
        (e.position || '').toLowerCase().includes(q)
      )
    }

    return list
  }, [employees, selectedDeptId, memberTypeFilter, memberSearch])

  // --- Department actions ---
  const handleOpenAddDept = () => {
    setEditingDept(null)
    setDeptName('')
    setShowDeptModal(true)
  }

  const handleOpenEditDept = (dept, e) => {
    e.stopPropagation()
    setEditingDept(dept)
    setDeptName(dept.name || '')
    setShowDeptModal(true)
  }

  const handleSubmitDept = async (e) => {
    e.preventDefault()
    const trimmedName = deptName.trim()
    if (!trimmedName) {
      toast.error(isRu ? 'Название не может быть пустым' : 'Nom bo\'sh bo\'lishi mumkin emas')
      return
    }

    try {
      const url = editingDept
        ? `/api/employee-catalogs/departments/${editingDept.id}`
        : `/api/organizations/${id}/departments`
      
      const method = editingDept ? 'PUT' : 'POST'
      const body = { name: trimmedName }
      if (!editingDept) {
        body.organization_id = id
      }

      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData?.detail || `HTTP ${res.status}`)
      }

      const resData = await res.json()
      toast.success(
        editingDept
          ? (isRu ? 'Обновлено успешно' : 'Muvaffaqiyatli yangilandi')
          : (isRu ? 'Добавлено успешно' : 'Muvaffaqiyatli qo\'shildi')
      )

      setShowDeptModal(false)
      await load({ silent: true })

      if (!editingDept && resData?.item?.id) {
        setSelectedDeptId(resData.item.id)
      }
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleDeleteDept = async (dept, e) => {
    e.stopPropagation()
    const deptLabel = getLabel('departmentName', isRu ? 'Отдел' : 'Bo\'lim')
    const confirmMsg = isRu
      ? `Вы действительно хотите удалить "${dept.name}" (${deptLabel})? Все привязанные должности также должны быть удалены.`
      : `Haqiqatan ham "${dept.name}" (${deptLabel})ni o'chirib tashlamoqchimisiz? Undagi barcha lavozimlar ham o'chirilishi kerak.`

    const ok = await confirm({
      title: isRu ? 'Удаление структурного элемента' : 'Tarkibiy qismni o\'chirish',
      message: confirmMsg,
      confirmText: isRu ? 'Удалить' : 'O\'chirish',
      cancelText: isRu ? 'Отмена' : 'Bekor qilish',
      danger: true,
    })
    if (!ok) return

    try {
      const res = await fetch(`/api/employee-catalogs/departments/${dept.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData?.detail || (isRu ? 'Не удалось удалить. Убедитесь, что нет связанных сотрудников/должностей.' : 'O\'chirib bo\'lmadi. Bog\'langan lavozim yoki xodimlar mavjud emasligiga ishonch hosil qiling.'))
      }

      toast.success(isRu ? 'Успешно удалено' : 'Muvaffaqiyatli o\'chirildi')
      
      if (selectedDeptId === dept.id) {
        setSelectedDeptId(null)
      }
      await load({ silent: true })
    } catch (err) {
      toast.error(err.message)
    }
  }

  // --- Default classes action (Schools) ---
  const handleCreateDefaultClasses = async (e) => {
    e?.preventDefault?.()
    setCreatingClasses(true)
    try {
      const letters = includeLetters
        ? lettersInput
            .split(',')
            .map(l => l.trim().toUpperCase())
            .filter(Boolean)
        : []
      const res = await fetch(`/api/organizations/${id}/default-classes`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_grade: parseInt(startGrade, 10) || 1,
          end_grade: parseInt(endGrade, 10) || 11,
          format: defaultFormat,
          letters,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData?.detail || `HTTP ${res.status}`)
      }

      const resData = await res.json()
      toast.success(resData.message || (isRu ? 'Классы успешно созданы' : 'Sinflar muvaffaqiyatli yaratildi'))
      setShowDefaultClassesModal(false)
      await load({ silent: true })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCreatingClasses(false)
    }
  }

  // --- Position actions ---
  const handleOpenAddPos = () => {
    if (!selectedDeptId) {
      toast.error(isRu ? 'Сначала выберите отдел/класс' : 'Avval bo\'lim/sinfni tanlang')
      return
    }
    setEditingPos(null)
    setPosName('')
    setPosSalaryOptions('')
    setShowPosModal(true)
  }

  const handleOpenViewPos = (pos, e) => {
    e.stopPropagation()
    setViewingPos(pos)
    setShowViewPosModal(true)
  }

  const handleOpenEditPos = (pos, e) => {
    e.stopPropagation()
    setEditingPos(pos)
    setPosName(pos.name || '')
    const formattedSalaryOptions = pos.salary_options
      ? pos.salary_options.split(',').map(s => {
          const num = parseInt(s.trim().replace(/\s/g, ''), 10)
          return isNaN(num) ? s.trim() : num.toLocaleString('uz-UZ').replace(/,/g, ' ')
        }).join(', ')
      : ''
    setPosSalaryOptions(formattedSalaryOptions)
    setShowPosModal(true)
  }

  const handleSalaryOptionsChange = (e) => {
    const raw = e.target.value
    if (raw.endsWith(',')) {
      setPosSalaryOptions(raw)
      return
    }
    const formatted = raw.split(',').map(segment => {
      const clean = segment.replace(/\D/g, '')
      if (!clean) return ''
      return parseInt(clean, 10).toLocaleString('uz-UZ').replace(/,/g, ' ')
    }).join(', ')
    setPosSalaryOptions(formatted)
  }

  const handleSubmitPos = async (e) => {
    e.preventDefault()
    const trimmedName = posName.trim()
    if (!trimmedName) {
      toast.error(isRu ? 'Название не может быть пустым' : 'Nom bo\'sh bo\'lishi mumkin emas')
      return
    }

    try {
      const url = editingPos
        ? `/api/employee-catalogs/positions/${editingPos.id}`
        : `/api/organizations/${id}/positions`
      
      const method = editingPos ? 'PUT' : 'POST'
      const cleanedSalaryOptions = posSalaryOptions.split(',')
        .map(s => s.replace(/\s/g, '').trim())
        .filter(Boolean)
        .join(',')

      const body = {
        name: trimmedName,
        department_id: selectedDeptId,
        salary_options: cleanedSalaryOptions,
      }
      if (!editingPos) {
        body.organization_id = id
      }

      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData?.detail || `HTTP ${res.status}`)
      }

      toast.success(
        editingPos
          ? (isRu ? 'Обновлено успешно' : 'Muvaffaqiyatli yangilandi')
          : (isRu ? 'Добавлено успешно' : 'Muvaffaqiyatli qo\'shildi')
      )

      setShowPosModal(false)
      await load({ silent: true })
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleDeletePos = async (pos, e) => {
    e.stopPropagation()
    const posLabel = getLabel('positionName', isRu ? 'Должность' : 'Lavozim')
    const confirmMsg = isRu
      ? `Вы действительно хотите удалить "${pos.name}" (${posLabel})?`
      : `Haqiqatan ham "${pos.name}" (${posLabel})ni o'chirib tashlamoqchimisiz?`

    const ok = await confirm({
      title: isRu ? 'Удаление должности' : 'Lavozimni o\'chirish',
      message: confirmMsg,
      confirmText: isRu ? 'Удалить' : 'O\'chirish',
      cancelText: isRu ? 'Отмена' : 'Bekor qilish',
      danger: true,
    })
    if (!ok) return

    try {
      const res = await fetch(`/api/employee-catalogs/positions/${pos.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData?.detail || (isRu ? 'Не удалось удалить. Убедитесь, что к должности не привязаны сотрудники.' : 'O\'chirib bo\'lmadi. Bog\'langan xodimlar mavjud emasligiga ishonch hosil qiling.'))
      }

      toast.success(isRu ? 'Успешно удалено' : 'Muvaffaqiyatli o\'chirildi')
      await load({ silent: true })
    } catch (err) {
      toast.error(err.message)
    }
  }

  // --- Sub-counters calculations ---
  const getDeptEmployeesCount = (deptId) => {
    return employees.filter(e => e.department_id === deptId).length
  }

  const getPosEmployeesCount = (posId) => {
    return employees.filter(e => e.position_id === posId).length
  }

  // No full-page early loading skeleton return block. Skeletons are rendered contextually in widgets.

  if (error) {
    return (
      <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', padding: 32 }}>
        <div style={errBannerStyle}>{error}</div>
        <Link to="/organizations" style={smallBtn('subtle')}>
          <ChevronLeftRegular fontSize={16} /> {isRu ? 'Назад к организациям' : 'Tashkilotlarga qaytish'}
        </Link>
      </div>
    )
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <style>{`
        .org-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px 32px 80px;
          box-sizing: border-box;
        }
        .org-catalog-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
        }
        @media (max-width: 768px) {
          .org-container {
            padding: 16px 16px 60px;
          }
          .org-catalog-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
        }
      `}</style>

      <PageHero
        badge={
          loading ? (
            <Skeleton
              width={100}
              height={12}
              style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 100%)' }}
            />
          ) : (
            org?.organization_type_label || org?.organization_type
          )
        }
        title={
          loading ? (
            <Skeleton
              width={250}
              height={22}
              style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 100%)' }}
            />
          ) : (
            org?.name
          )
        }
        sub={t('organizationDetail.subtitle')}
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to="/organizations" style={smallBtn('subtle')}>
              <ChevronLeftRegular fontSize={16} /> {isRu ? 'Назад' : 'Orqaga'}
            </Link>
            <button
              onClick={() => load({ silent: true })}
              disabled={refreshing || loading}
              style={refreshBtnStyle(refreshing || loading)}
            >
              <ArrowSyncRegular fontSize={16} style={{ animation: (refreshing || loading) ? 'spin 1s linear infinite' : 'none' }} />
              {isRu ? 'Обновить' : 'Yangilash'}
            </button>
          </div>
        }
      />

      <div className="org-container">
        {/* ══════════ Tashkilot ma'lumotlari ══════════ */}
        <div style={{ ...cardStyle, marginBottom: 24, padding: '24px 28px' }}>
          <div style={{ ...toolbarStyle, marginBottom: 20 }}>
            <h3 style={cardTitleStyle}>
              <BuildingRegular style={{ color: 'var(--accent)', fontSize: 20 }} />
              {isRu ? 'Информация об организации' : "Tashkilot ma'lumotlari"}
            </h3>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 24,
          }}>
            {/* Column 1: Main Identification */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <span style={infoTitleStyle}>{isRu ? 'Название организации' : 'Tashkilot nomi'}</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', marginTop: 6 }}>
                  {loading ? <Skeleton width={180} height={20} /> : (org?.name || '—')}
                </div>
              </div>
              <div>
                <span style={infoTitleStyle}>{isRu ? 'Тип организации' : 'Tashkilot turi'}</span>
                <div style={{ marginTop: 6 }}>
                  {loading ? (
                    <Skeleton width={100} height={20} />
                  ) : (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: 'var(--accent-bg)',
                      color: 'var(--accent-tx)',
                      fontSize: 12,
                      fontWeight: 600,
                    }}>
                      {org?.organization_type_label || org?.organization_type || '—'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Column 2: Contact & Address */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <span style={infoTitleStyle}>{isRu ? 'Телефон' : 'Telefon'}</span>
                <div style={{ fontSize: 14, color: 'var(--text-1)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PhoneRegular fontSize={16} style={{ color: 'var(--accent)' }} />
                  {loading ? (
                    <Skeleton width={120} height={16} />
                  ) : org?.phone ? (
                    <a href={`tel:${org.phone}`} style={{ color: 'var(--text-1)', textDecoration: 'none', fontWeight: 600 }}>
                      {org.phone}
                    </a>
                  ) : '—'}
                </div>
              </div>
              <div>
                <span style={infoTitleStyle}>{isRu ? 'Адрес' : 'Manzil'}</span>
                <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {loading ? (
                    <Skeleton width="90%" height={32} />
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        <LocationRegular fontSize={16} style={{ color: 'var(--accent)', marginTop: 2, flexShrink: 0 }} />
                        <span style={{ fontWeight: 500 }}>{org?.address || '—'}</span>
                      </div>
                      {(org?.region || org?.district) && (
                        <span style={{ fontSize: 11, color: 'var(--text-4)', marginLeft: 22 }}>
                          {[org.region, org.district, org.village].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Column 3: Work Mode & Subscription */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <span style={infoTitleStyle}>{isRu ? 'Режим работы' : 'Ish tartibi'}</span>
                <div style={{ fontSize: 14, color: 'var(--text-1)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ClockRegular fontSize={16} style={{ color: 'var(--accent)' }} />
                  {loading ? (
                    <Skeleton width={100} height={16} />
                  ) : (
                    <span style={{ fontWeight: 600 }}>
                      {org?.default_start_time || '09:00'} - {org?.default_end_time || '18:00'}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <span style={infoTitleStyle}>{isRu ? 'Статус подписки' : 'Obuna holati'}</span>
                <div style={{ marginTop: 6 }}>
                  {loading ? (
                    <Skeleton width={80} height={20} />
                  ) : (
                    <StatusPill status={org?.subscription_status} isRu={isRu} />
                  )}
                </div>
              </div>
            </div>

            {/* Column 4: Quick Metrics */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
              <div style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: 10,
                background: 'var(--surface-2)',
                border: '1px solid var(--border-2)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase' }}>
                  {isRu ? 'Члены' : 'A\'zolar'}
                </span>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)', marginTop: 4 }}>
                  {loading ? <Skeleton width={30} height={24} /> : employees.length}
                </div>
              </div>

              <div style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: 10,
                background: 'var(--surface-2)',
                border: '1px solid var(--border-2)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase' }}>
                  {isRu ? 'Отделы' : 'Bo\'limlar'}
                </span>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)', marginTop: 4 }}>
                  {loading ? <Skeleton width={30} height={24} /> : departments.length}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════ Filiallar (Joylashuvlar) ══════════ */}
        <div style={{ ...cardStyle, marginBottom: 24 }}>
          <div style={{ ...toolbarStyle, marginBottom: 18 }}>
            <h3 style={cardTitleStyle}>
              <BuildingMultipleRegular style={{ color: 'var(--accent)' }} />
              {isRu ? 'Филиалы (Локации)' : 'Filiallar (Joylashuvlar)'}
              {!loading && org?.branches && org.branches.length > 0 && (
                <span style={{
                  marginLeft: 8, padding: '2px 10px', borderRadius: 20,
                  background: 'var(--accent-bg)', color: 'var(--accent-tx)',
                  fontSize: 12, fontWeight: 700,
                }}>
                  {org.branches.length}
                </span>
              )}
            </h3>
          </div>

          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              <Skeleton width="100%" height={72} />
              <Skeleton width="100%" height={72} />
              <Skeleton width="100%" height={72} />
            </div>
          ) : !org?.branches || org.branches.length === 0 ? (
            <div style={{ ...emptyStyle, padding: '32px 10px' }}>
              {isRu ? 'Филиалы не добавлены' : "Filiallar qo'shilmagan"}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 12,
            }}>
              {org.branches.map(branch => (
                <Link
                  key={branch.id}
                  to={`/organizations/${org.uuid || org.id}/branches/${branch.uuid || branch.id}`}
                  style={{
                    padding: '14px 18px',
                    borderRadius: 12,
                    background: 'var(--surface-2)',
                    border: '1.5px solid var(--border-2)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 14,
                    transition: 'all 0.15s ease',
                    textDecoration: 'none',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--accent)'
                    e.currentTarget.style.background = 'var(--surface-3)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border-2)'
                    e.currentTarget.style.background = 'var(--surface-2)'
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: 'rgba(0,120,212,0.1)', border: '1.5px solid rgba(0,120,212,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--accent)', marginTop: 1,
                  }}>
                    <LocationRegular fontSize={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {branch.name}
                      </span>
                      {branch.radius && (
                        <span style={{ fontSize: 11, background: 'var(--accent-bg)', color: 'var(--accent-tx)', padding: '2px 8px', borderRadius: 12, fontWeight: 600, flexShrink: 0 }}>
                          R: {branch.radius}m
                        </span>
                      )}
                    </div>
                    {branch.address && (
                      <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <LocationRegular fontSize={12} style={{ color: 'var(--text-4)', flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{branch.address}</span>
                      </div>
                    )}
                    {branch.latitude && branch.longitude && (
                      <div style={{ fontSize: 11, color: 'var(--text-4)', fontFamily: 'monospace', marginTop: 2 }}>
                        {branch.latitude.toFixed(4)}, {branch.longitude.toFixed(4)}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ══════════ Catalog grid (Bo'limlar + Lavozimlar) ══════════ */}
        <div className="org-catalog-grid" style={{ marginBottom: 24 }}>

          {/* Departments column */}
          <div style={cardStyle}>
            <div style={toolbarStyle}>
              <h3 style={cardTitleStyle}>
                <BuildingMultipleRegular style={{ color: 'var(--accent)' }} />
                {getLabel('departmentsCard', isRu ? 'Отделы' : 'Bo\'limlar')}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {isSchool && (
                  <button
                    type="button"
                    onClick={() => setShowDefaultClassesModal(true)}
                    style={{ ...smallBtn('secondary'), display: 'inline-flex', alignItems: 'center', gap: 5 }}
                    title={isRu ? 'Создать 1-11 классы по умолчанию' : '1-11 standart sinflarni yaratish'}
                  >
                    <HatGraduationRegular fontSize={14} />
                    {isRu ? '1-11 классы' : 'Default sinflar'}
                  </button>
                )}
                <button onClick={handleOpenAddDept} style={smallBtn('accent')}>
                  <AddRegular fontSize={14} /> {getLabel('addDepartment', isRu ? 'Добавить' : 'Qo\'shish')}
                </button>
              </div>
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Skeleton width="100%" height={38} />
                <Skeleton width="100%" height={38} />
                <Skeleton width="100%" height={38} />
              </div>
            ) : departments.length === 0 ? (
              <div style={{ ...emptyStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div>{t('organizationDetail.noDepartments')}</div>
                {isSchool && (
                  <button
                    type="button"
                    onClick={() => setShowDefaultClassesModal(true)}
                    style={{
                      ...smallBtn('accent'),
                      padding: '8px 14px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 13,
                    }}
                  >
                    <HatGraduationRegular fontSize={16} />
                    {isRu ? 'Создать 1-11 классы по умолчанию' : '1-dan 11-gacha sinflarni qo\'shish'}
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto', paddingRight: 4 }}>
                {sortedDepartments.map(dept => {
                  const count = getDeptEmployeesCount(dept.id)
                  const isSelected = selectedDeptId === dept.id
                  return (
                    <div
                      key={dept.id}
                      onClick={() => setSelectedDeptId(dept.id)}
                      style={deptItemStyle(isSelected)}
                    >
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{dept.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
                        <span style={badgeCountStyle(isSelected)} title={t('organizationDetail.associatedEmployees')}>
                          <PersonRegular fontSize={12} /> {count}
                        </span>
                        <button onClick={(e) => handleOpenEditDept(dept, e)} style={actionBtnStyle(isSelected)} title={isRu ? 'Редактировать' : 'Tahrirlash'}>
                          <EditRegular fontSize={12} />
                        </button>
                        <button onClick={(e) => handleDeleteDept(dept, e)} style={actionBtnStyle(isSelected, true)} title={isRu ? 'Удалить' : 'O\'chirish'}>
                          <DeleteRegular fontSize={12} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Positions column */}
          <div style={cardStyle}>
            <div style={toolbarStyle}>
              <h3 style={cardTitleStyle}>
                <BuildingRegular style={{ color: 'var(--accent)' }} />
                {getLabel('positionsCard', isRu ? 'Должности' : 'Lavozimlar')}
                {selectedDept && <span style={{ fontSize: 13, color: 'var(--text-4)', fontWeight: 400 }}> ({selectedDept.name})</span>}
              </h3>
              {selectedDeptId && (
                <button onClick={handleOpenAddPos} style={smallBtn('accent')}>
                  <AddRegular fontSize={14} /> {getLabel('addPosition', isRu ? 'Добавить' : 'Qo\'shish')}
                </button>
              )}
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Skeleton width="100%" height={38} />
                <Skeleton width="100%" height={38} />
                <Skeleton width="100%" height={38} />
              </div>
            ) : !selectedDeptId ? (
              <div style={emptyStyle}>
                <QuestionCircleRegular fontSize={24} style={{ marginBottom: 8, opacity: 0.6 }} />
                <div>{isRu ? 'Выберите структурный элемент для просмотра должностей' : 'Lavozimlarni ko\'rish uchun bo\'lim/sinfni tanlang'}</div>
              </div>
            ) : filteredPositions.length === 0 ? (
              <div style={emptyStyle}>{isRu ? 'В этом элементе нет должностей' : 'Bu tarkibiy qismda hech qanday lavozim yo\'q'}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto', paddingRight: 4 }}>
                {filteredPositions.map(pos => {
                  const count = getPosEmployeesCount(pos.id)
                  return (
                    <div key={pos.id} style={posItemStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontWeight: 500, fontSize: 13 }}>{pos.name}</span>
                        {pos.salary_options && (
                          <span style={{ fontSize: 11, color: 'var(--text-4)' }}>
                            {isRu ? 'Оклады: ' : 'Ish haqlari: '}
                            {pos.salary_options.split(',').map(s => {
                              const num = parseInt(s.trim(), 10);
                              return isNaN(num) ? s : num.toLocaleString('uz-UZ') + ' UZS';
                            }).join(' / ')}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={badgeCountStyle(false)} title={t('organizationDetail.associatedEmployees')}>
                          <PersonRegular fontSize={12} /> {count}
                        </span>
                        <button onClick={(e) => handleOpenViewPos(pos, e)} style={actionBtnStyle(false)} title={isRu ? 'Просмотреть' : 'Ko\'rish'}>
                          <EyeRegular fontSize={12} />
                        </button>
                        <button onClick={(e) => handleOpenEditPos(pos, e)} style={actionBtnStyle(false)} title={isRu ? 'Редактировать' : 'Tahrirlash'}>
                          <EditRegular fontSize={12} />
                        </button>
                        <button onClick={(e) => handleDeletePos(pos, e)} style={actionBtnStyle(false, true)} title={isRu ? 'Удалить' : 'O\'chirish'}>
                          <DeleteRegular fontSize={12} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Member List Section */}
        <div style={cardStyle}>
          <div style={toolbarStyle}>
            <div>
              <h3 style={cardTitleStyle}>
                <PeopleRegular style={{ color: 'var(--accent)' }} />
                {t('organizationDetail.employeesList')}
              </h3>
              {selectedDept && (
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>
                  {isRu ? 'Отфильтровано по:' : 'Filtrlangan:'} <strong>{selectedDept.name}</strong>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="text"
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                placeholder={isRu ? 'Поиск абитуриента...' : 'A\'zolarni qidirish...'}
                style={{ minWidth: 200, ...inpStyle }}
              />
              <div style={{ width: 180 }}>
                <CustomSelect
                  value={memberTypeFilter}
                  onChange={val => setMemberTypeFilter(val)}
                  options={[
                    { value: 'all', label: isRu ? 'Все роли' : 'Barcha rollar' },
                    { value: 'staff', label: isRu ? 'Сотрудники / Учителя' : 'Xodimlar / O\'qituvchilar' },
                    { value: 'student', label: isRu ? 'Ученики / Студенты' : 'O\'quvchilar / Talabalar' }
                  ]}
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Skeleton width="100%" height={32} />
              <Skeleton width="100%" height={32} />
              <Skeleton width="100%" height={32} />
              <Skeleton width="100%" height={32} />
              <Skeleton width="100%" height={32} />
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div style={emptyStyle}>{t('organizationDetail.noEmployees')}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {[
                      isRu ? 'Имя и фамилия' : 'Ism va familiya',
                      'Personal ID',
                      isRu ? 'Роль (тип)' : 'Roli (turi)',
                      getLabel('departmentName', isRu ? 'Отдел' : 'Bo\'lim'),
                      getLabel('positionName', isRu ? 'Должность' : 'Lavozim'),
                      isRu ? 'Телефон' : 'Telefon',
                    ].map((h, i) => <th key={i} style={thStyle}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map(emp => {
                    const isStu = ['oquvchi', 'talaba', 'student'].includes(emp.employee_type?.toLowerCase())
                    return (
                      <tr key={emp.id}>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>
                          <Link to={`/employees/${emp.uuid || emp.id}`} style={{ color: 'var(--text-1)', textDecoration: 'none' }}>
                            {emp.last_name} {emp.first_name} {emp.middle_name || ''}
                          </Link>
                        </td>
                        <td style={tdStyle}>{emp.personal_id || '—'}</td>
                        <td style={tdStyle}>
                          <span style={roleBadgeStyle(isStu)}>
                            {isStu
                              ? (isRu ? 'Ученик' : 'O\'quvchi')
                              : (isRu ? 'Сотрудник' : 'Xodim')}
                          </span>
                        </td>
                        <td style={tdStyle}>{emp.department || '—'}</td>
                        <td style={tdStyle}>{emp.position || '—'}</td>
                        <td style={tdStyle}>{emp.phone || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Department Modal */}
      {showDeptModal && (
        <Modal
          title={editingDept ? getLabel('editDepartment', isRu ? 'Редактировать' : 'Tahrirlash') : getLabel('addDepartment', isRu ? 'Добавить' : 'Qo\'shish')}
          onClose={() => setShowDeptModal(false)}
        >
          <form onSubmit={handleSubmitDept} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label={getLabel('departmentName', isRu ? 'Название' : 'Nomi')} required>
              <input
                type="text"
                value={deptName}
                onChange={e => setDeptName(e.target.value)}
                placeholder={isSchool ? (isRu ? 'Например: 9' : 'Masalan: 9') : (isRu ? 'Например: Бухгалтерия' : 'Masalan: Buxgalteriya')}
                style={inpStyle}
                required
                autoFocus
              />
            </Field>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" onClick={() => setShowDeptModal(false)} style={smallBtn('subtle')}>
                {isRu ? 'Отмена' : 'Bekor qilish'}
              </button>
              <button type="submit" style={smallBtn('accent')}>
                <CheckmarkRegular fontSize={14} />
                {isRu ? 'Сохранить' : 'Saqlash'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Position Modal */}
      {showPosModal && (
        <Modal
          title={editingPos ? getLabel('editPosition', isRu ? 'Редактировать' : 'Tahrirlash') : getLabel('addPosition', isRu ? 'Добавить' : 'Qo\'shish')}
          onClose={() => setShowPosModal(false)}
        >
          <form onSubmit={handleSubmitPos} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label={getLabel('positionName', isRu ? 'Название' : 'Nomi')} required>
              <input
                type="text"
                value={posName}
                onChange={e => setPosName(e.target.value)}
                placeholder={isSchool ? (isRu ? 'Например: a' : 'Masalan: a') : (isRu ? 'Например: Бухгалтер' : 'Masalan: Buxgalter')}
                style={inpStyle}
                required
                autoFocus
              />
            </Field>
            <Field label={isRu ? 'Варианты окладов' : 'Oylik maosh variantlari'}>
              <input
                type="text"
                value={posSalaryOptions}
                onChange={handleSalaryOptionsChange}
                placeholder="3 000 000, 5 000 000"
                style={inpStyle}
              />
              <span style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>
                {isRu ? 'Введите значения через запятую (например: 3000000, 5000000)' : 'Qiymatlarni vergul bilan ajratib kiriting (masalan: 3000000, 5000000)'}
              </span>
            </Field>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" onClick={() => setShowPosModal(false)} style={smallBtn('subtle')}>
                {isRu ? 'Отмена' : 'Bekor qilish'}
              </button>
              <button type="submit" style={smallBtn('accent')}>
                <CheckmarkRegular fontSize={14} />
                {isRu ? 'Сохранить' : 'Saqlash'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* View Position Modal */}
      {showViewPosModal && viewingPos && (
        <Modal
          title={isRu ? 'Детали должности' : 'Lavozim tafsilotlari'}
          onClose={() => setShowViewPosModal(false)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={infoTitleStyle}>{isRu ? 'Название должности' : 'Lavozim nomi'}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4, color: 'var(--text-1)' }}>
                {viewingPos.name}
              </div>
            </div>

            <div>
              <div style={infoTitleStyle}>{isRu ? 'Отдел / Класс' : 'Bo\'lim / Sinf'}</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4, color: 'var(--text-2)' }}>
                {selectedDept?.name || '—'}
              </div>
            </div>

            <div>
              <div style={infoTitleStyle}>{isRu ? 'Варианты окладов' : 'Ish haqi variantlari'}</div>
              {viewingPos.salary_options ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {viewingPos.salary_options.split(',').map(s => {
                    const num = parseInt(s.trim().replace(/\s/g, ''), 10);
                    const formatted = isNaN(num) ? s : num.toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS';
                    return (
                      <span
                        key={s}
                        style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: 6,
                          background: 'var(--surface-2)',
                          border: '1px solid var(--border-2)',
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--text-1)'
                        }}
                      >
                        {formatted}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-4)', marginTop: 4 }}>
                  {isRu ? 'Не указаны' : 'Belgilanmagan'}
                </div>
              )}
            </div>

            <div>
              <div style={infoTitleStyle}>{isRu ? 'Связанные сотрудники' : 'Bog\'langan xodimlar'}</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4, color: 'var(--text-2)' }}>
                {getPosEmployeesCount(viewingPos.id)} {isRu ? 'чел.' : 'ta xodim'}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" onClick={() => setShowViewPosModal(false)} style={smallBtn('subtle')}>
                {isRu ? 'Закрыть' : 'Yopish'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Default Classes Modal */}
      {showDefaultClassesModal && (
        <Modal
          title={isRu ? 'Создать классы по умолчанию (1-11)' : 'Standart sinflarni qo\'shish (1-dan 11-gacha)'}
          onClose={() => setShowDefaultClassesModal(false)}
        >
          <form onSubmit={handleCreateDefaultClasses} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>
              {isRu
                ? 'Эта функция автоматически создаст параллели классов от 1-го до 11-го класса для школы.'
                : 'Ushbu funksiya maktab uchun 1-sinfdan 11-sinfgacha bo\'lgan barcha sinflarni avtomatik yaratadi.'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label={isRu ? 'Начальный класс' : "Boshlang'ich sinf"} required>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={startGrade}
                  onChange={e => setStartGrade(e.target.value)}
                  style={inpStyle}
                  required
                />
              </Field>
              <Field label={isRu ? 'Конечный класс' : 'Oxirgi sinf'} required>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={endGrade}
                  onChange={e => setEndGrade(e.target.value)}
                  style={inpStyle}
                  required
                />
              </Field>
            </div>

            <Field label={isRu ? 'Формат названия' : 'Sinf nomlanishi formati'}>
              <div style={{ display: 'flex', gap: 14, marginTop: 4, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="defaultFormat"
                    value="number"
                    checked={defaultFormat === 'number'}
                    onChange={() => setDefaultFormat('number')}
                  />
                  <span>{isRu ? '1, 2 ... 11 (Рекомендуется)' : '1, 2 ... 11 (Tavsiya etiladi)'}</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="defaultFormat"
                    value="suffix"
                    checked={defaultFormat === 'suffix'}
                    onChange={() => setDefaultFormat('suffix')}
                  />
                  <span>1-sinf, 2-sinf...</span>
                </label>
              </div>
            </Field>

            <div style={{ borderTop: '1px solid var(--border-2)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeLetters}
                  onChange={e => setIncludeLetters(e.target.checked)}
                />
                <span>{isRu ? 'Добавить параллели (буквы классов)' : 'Parallel sinf harflarini ham qo\'shish'}</span>
              </label>

              {includeLetters && (
                <Field label={isRu ? 'Буквы классов (через запятую)' : 'Sinf harflari (vergul bilan)'}>
                  <input
                    type="text"
                    value={lettersInput}
                    onChange={e => setLettersInput(e.target.value)}
                    placeholder="A, B, D"
                    style={inpStyle}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>
                    {isRu
                      ? 'Пример: "A, B, D" создаст для каждого класса параллели (например: 1-A, 1-B, 1-D)'
                      : 'Masalan: "A, B, D" kiritilsa, har bir sinf ichiga shu harflar qo\'shiladi (1-A, 1-B, 1-D)'}
                  </span>
                </Field>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setShowDefaultClassesModal(false)}
                disabled={creatingClasses}
                style={smallBtn('subtle')}
              >
                {isRu ? 'Отмена' : 'Bekor qilish'}
              </button>
              <button
                type="submit"
                disabled={creatingClasses}
                style={{ ...smallBtn('accent'), display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {creatingClasses ? (
                  <>
                    <ArrowSyncRegular style={{ animation: 'spin 1s linear infinite' }} fontSize={14} />
                    {isRu ? 'Создание...' : 'Yaratilmoqda...'}
                  </>
                ) : (
                  <>
                    <CheckmarkRegular fontSize={14} />
                    {isRu ? 'Создать классы' : 'Sinflarni yaratish'}
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Yordamchi komponentlar va stillar
// ────────────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 450,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, padding: 24, maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h3>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>
            <DismissRegular fontSize={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}{required && <span style={{ color: '#f43f5e' }}> *</span>}
      </span>
      {children}
    </label>
  )
}

function StatusPill({ status, isRu }) {
  const normalized = (status || '').toLowerCase()
  const isActive = normalized === 'active'
  const isPending = normalized === 'pending'
  const isExpired = normalized === 'expired'

  let bg = 'rgba(100, 116, 139, 0.10)'
  let color = '#64748b'
  let text = status || '—'

  if (isActive) {
    bg = 'rgba(16,185,129,0.12)'
    color = '#10b981'
    text = isRu ? 'Активна' : 'Faol'
  } else if (isPending) {
    bg = 'rgba(251,191,36,0.12)'
    color = '#f59e0b'
    text = isRu ? 'Ожидание' : 'Kutilmoqda'
  } else if (isExpired) {
    bg = 'rgba(244,63,94,0.12)'
    color = '#f43f5e'
    text = isRu ? 'Истекла' : 'Muddati o\'tgan'
  }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 9px', borderRadius: 999,
      background: bg, color: color,
      fontSize: 11, fontWeight: 600,
      border: `1px solid ${color}33`,
    }}>{text}</span>
  )
}

const refreshBtnStyle = (loading) => ({
  display: 'flex', alignItems: 'center', gap: 7,
  padding: '8px 16px', borderRadius: 8,
  background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)',
  color: '#fff', fontSize: 13, fontWeight: 600,
  cursor: loading ? 'not-allowed' : 'pointer',
  opacity: loading ? 0.6 : 1,
})

const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }
const cardTitleStyle = { fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }
const toolbarStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 14 }
const errBannerStyle = { marginBottom: 20, padding: 14, background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, border: '1px solid var(--red-bd)' }
const inpStyle = {
  padding: '8px 10px', borderRadius: 7,
  border: '1px solid var(--border-2)', background: 'var(--bg)',
  color: 'var(--text-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
}

const infoTitleStyle = { fontSize: 11, fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.5 }
const infoValueStyle = { fontSize: 18, fontWeight: 700, color: 'var(--text-1)', marginTop: 4 }

const deptItemStyle = (selected) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 14px',
  borderRadius: 8,
  background: selected ? 'var(--surface-2)' : 'transparent',
  border: selected ? '1px solid var(--accent)' : '1px solid var(--border-2)',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
})

const posItemStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid var(--border-2)',
  background: 'var(--bg)',
}

const badgeCountStyle = (active) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 8px',
  borderRadius: 12,
  background: active ? 'var(--accent)' : 'var(--border-2)',
  color: active ? '#fff' : 'var(--text-3)',
  fontSize: 11,
  fontWeight: 600,
})

const actionBtnStyle = (active, isDanger = false) => ({
  background: 'transparent',
  border: 'none',
  color: isDanger ? '#f43f5e' : (active ? 'var(--text-1)' : 'var(--text-3)'),
  cursor: 'pointer',
  padding: '4px',
  borderRadius: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  opacity: 0.8,
  transition: 'opacity 0.1s',
  ':hover': {
    opacity: 1,
    background: 'rgba(255,255,255,0.05)',
  }
})

const tableStyle = { width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }
const thStyle = {
  textAlign: 'left', padding: '10px 12px', fontSize: 11,
  fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase',
  letterSpacing: 0.4, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
}
const tdStyle = { padding: '12px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
const emptyStyle = {
  padding: 32,
  textAlign: 'center',
  color: 'var(--text-4)',
  fontSize: 13,
  background: 'var(--bg)',
  borderRadius: 8,
  border: '1px dashed var(--border-2)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
}

const roleBadgeStyle = (isStu) => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 600,
  background: isStu ? 'rgba(59, 130, 246, 0.12)' : 'rgba(16, 185, 129, 0.12)',
  color: isStu ? '#3b82f6' : '#10b981',
  border: `1px solid ${isStu ? '#3b82f6' : '#10b981'}33`,
})

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
    textDecoration: 'none',
  }
}
