import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
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
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import Skeleton from '../components/Skeleton'
import { useConfirm } from '../components/ConfirmDialog'
import { useToast } from '../components/Toaster'

export default function OrganizationDetail() {
  const { id } = useParams()
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
  }, [id, isRu, i18n.language, selectedDeptId])

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

  // Filter positions for selected department
  const filteredPositions = useMemo(() => {
    if (!selectedDeptId) return []
    return positions.filter(p => p.department_id === selectedDeptId)
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

  // --- Position actions ---
  const handleOpenAddPos = () => {
    if (!selectedDeptId) {
      toast.error(isRu ? 'Сначала выберите отдел/класс' : 'Avval bo\'lim/sinfni tanlang')
      return
    }
    setEditingPos(null)
    setPosName('')
    setShowPosModal(true)
  }

  const handleOpenEditPos = (pos, e) => {
    e.stopPropagation()
    setEditingPos(pos)
    setPosName(pos.name || '')
    setShowPosModal(true)
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
      const body = {
        name: trimmedName,
        department_id: selectedDeptId,
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

  if (loading) {
    return (
      <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', padding: '24px 16px' }}>
        <Skeleton width="100%" height={120} style={{ marginBottom: 24 }} />
        <div className="org-catalog-grid" style={{ marginTop: 24 }}>
          <Skeleton.Card />
          <Skeleton.Card />
        </div>
        <style>{`
          .org-catalog-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            margin-bottom: 24px;
          }
          @media (max-width: 768px) {
            .org-catalog-grid {
              grid-template-columns: 1fr;
              gap: 16px;
            }
          }
        `}</style>
      </div>
    )
  }

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
        badge={org?.organization_type_label || org?.organization_type}
        title={org?.name}
        sub={t('organizationDetail.subtitle')}
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to="/organizations" style={smallBtn('subtle')}>
              <ChevronLeftRegular fontSize={16} /> {isRu ? 'Назад' : 'Orqaga'}
            </Link>
            <button
              onClick={() => load({ silent: true })}
              disabled={refreshing}
              style={refreshBtnStyle(refreshing)}
            >
              <ArrowSyncRegular fontSize={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              {isRu ? 'Обновить' : 'Yangilash'}
            </button>
          </div>
        }
      />

      <div className="org-container">
        {/* Info row */}
        <div style={{ ...cardStyle, marginBottom: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
          <div>
            <div style={infoTitleStyle}>{isRu ? 'Режим работы' : 'Ish tartibi'}</div>
            <div style={infoValueStyle}>{org?.default_start_time || '09:00'} - {org?.default_end_time || '18:00'}</div>
          </div>
          <div>
            <div style={infoTitleStyle}>{isRu ? 'Общее число членов' : 'Jami a\'zolar soni'}</div>
            <div style={infoValueStyle}>{employees.length}</div>
          </div>
          <div>
            <div style={infoTitleStyle}>{isRu ? 'Всего подразделений' : 'Jami bo\'limlar'}</div>
            <div style={infoValueStyle}>{departments.length}</div>
          </div>
          <div>
            <div style={infoTitleStyle}>{isRu ? 'Статус подписки' : 'Obuna holati'}</div>
            <div style={{ marginTop: 4 }}>
               <StatusPill status={org?.subscription_status} isRu={isRu} />
            </div>
          </div>
        </div>

        {/* Catalog grid */}
        <div className="org-catalog-grid">
          {/* Departments column */}
          <div style={cardStyle}>
            <div style={toolbarStyle}>
              <h3 style={cardTitleStyle}>
                <BuildingMultipleRegular style={{ color: 'var(--accent)' }} />
                {getLabel('departmentsCard', isRu ? 'Отделы' : 'Bo\'limlar')}
              </h3>
              <button onClick={handleOpenAddDept} style={smallBtn('accent')}>
                <AddRegular fontSize={14} /> {getLabel('addDepartment', isRu ? 'Добавить' : 'Qo\'shish')}
              </button>
            </div>

            {departments.length === 0 ? (
              <div style={emptyStyle}>{t('organizationDetail.noDepartments')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto', paddingRight: 4 }}>
                {departments.map(dept => {
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

            {!selectedDeptId ? (
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
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{pos.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={badgeCountStyle(false)} title={t('organizationDetail.associatedEmployees')}>
                          <PersonRegular fontSize={12} /> {count}
                        </span>
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
              <select value={memberTypeFilter} onChange={e => setMemberTypeFilter(e.target.value)} style={inpStyle}>
                <option value="all">{isRu ? 'Все роли' : 'Barcha rollar'}</option>
                <option value="staff">{isRu ? 'Сотрудники / Учителя' : 'Xodimlar / O\'qituvchilar'}</option>
                <option value="student">{isRu ? 'Ученики / Студенты' : 'O\'quvchilar / Talabalar'}</option>
              </select>
            </div>
          </div>

          {filteredEmployees.length === 0 ? (
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
                          <Link to={`/employees/${emp.id}`} style={{ color: 'var(--text-1)', textDecoration: 'none' }}>
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
  }
}
