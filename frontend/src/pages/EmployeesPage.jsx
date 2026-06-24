import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  PersonRegular,
  ArrowSyncRegular,
  PeopleRegular,
  HatGraduationRegular,
  ClockRegular,
  CheckmarkCircleRegular,
  DismissCircleRegular,
  ChevronLeftRegular,
  ChevronRightRegular,
  AddRegular,
  EditRegular,
  DeleteRegular,
  EyeRegular,
  WarningRegular,
  DocumentTableRegular,
  ArrowUploadRegular,
  CheckmarkRegular,
  ArchiveRegular,
  SearchRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import Skeleton from '../components/Skeleton'
import { useToast } from '../components/Toaster'
import { useConfirm } from '../components/ConfirmDialog'

/**
 * Hodimlar yoki O'quvchilar / Talabalar sahifasi.
 *
 * Backend (server-side filtering + pagination):
 *   GET /api/employees?employee_type=staff|students&page=N&page_size=N&search=...
 *   -> { items, total, page, page_size, total_pages }
 *
 * mode prop:
 *   - "staff"    -> hodim/oqituvchi (yoki tipsiz)
 *   - "students" -> oquvchi yoki talaba
 */
export default function EmployeesPage({ mode = 'staff' }) {
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const isStudents = mode === 'students'
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [importModalOpen, setImportModalOpen] = useState(false)

  const handleDownloadTemplate = () => {
    try {
      const data = isStudents ? [
        {
          "Familiya": "Karimov",
          "Ism": "Eshmat",
          "Otasining ismi": "Toshmatovich",
          "Shaxsiy ID (Personal ID)": "99010203",
          "O'quvchi turi (oquvchi/talaba)": "oquvchi",
          "Sinf / Guruh": "5-A",
          "Telefon raqami": "+998901234567",
          "Ota-onasining telefon raqami": "+998907654321",
          "Viloyat": "Toshkent viloyati",
          "Tuman": "Zangiota tumani",
          "Manzil": "Muqimiy ko'chasi, 12-uy",
          "Tug'ilgan sana (YYYY-MM-DD)": "2010-05-15",
          "Jinsi (male/female)": "male",
          "Rasm (URL yoki fayl nomi)": ""
        }
      ] : [
        {
          "Familiya": "Toshmatov",
          "Ism": "Toshmat",
          "Otasining ismi": "Eshmatovich",
          "Shaxsiy ID (Personal ID)": "88010203",
          "Xodim turi (oqituvchi/hodim)": "oqituvchi",
          "Bo'lim": "Matematika bo'limi",
          "Lavozim": "Katta o'qituvchi",
          "Telefon raqami": "+998909876543",
          "Ota-onasining telefon raqami": "",
          "Viloyat": "Toshkent viloyati",
          "Tuman": "Zangiota tumani",
          "Manzil": "Tinchlik ko'chasi, 45-uy",
          "Tug'ilgan sana (YYYY-MM-DD)": "1985-10-22",
          "Jinsi (male/female)": "male",
          "Rasm (URL yoki fayl nomi)": ""
        }
      ];

      import('xlsx').then(XLSX => {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, isStudents ? "O'quvchilar shabloni" : "Xodimlar shabloni");
        
        // Auto-fit columns
        const maxLens = {};
        data.forEach(row => {
          Object.keys(row).forEach(key => {
            const val = String(row[key] || '');
            maxLens[key] = Math.max(maxLens[key] || key.length, val.length);
          });
        });
        ws['!cols'] = Object.keys(maxLens).map(key => ({
          wch: maxLens[key] + 4
        }));

        XLSX.writeFile(wb, isStudents ? "oquvchilar_shablon.xlsx" : "hodimlar_shablon.xlsx");
        toast.success(isRu ? 'Шаблон Excel скачан' : 'Excel shabloni yuklab olindi');
      }).catch(err => {
        console.error(err);
        toast.error(isRu ? 'Ошибка при загрузке Excel' : 'Excel yuklashda xatolik yuz berdi');
      });
    } catch (e) {
      console.error(e);
      toast.error(isRu ? 'Ошибка при скачивании шаблона' : 'Shablonni yuklab olishda xatolik yuz berdi');
    }
  }


  const [exportModalOpen, setExportModalOpen] = useState(false)




  const handleClearEmployees = async () => {
    let targetOrgId = orgFilter
    if (!targetOrgId && organizations.length === 1) {
      targetOrgId = organizations[0].id
    }
    if (!targetOrgId) {
      toast.error(isRu ? 'Пожалуйста, сначала выберите организацию' : 'Iltimos, avval tashkilotni tanlang')
      return
    }

    const orgName = organizations.find(o => String(o.id) === String(targetOrgId))?.name || ''
    const entityType = isStudents ? (isRu ? 'учащихся' : 'talaba/o\'quvchilarni') : (isRu ? 'сотрудников' : 'xodimlarni')

    const ok = await confirm({
      title: isRu ? 'Очистить данные?' : "Ma'lumotlarni tozalash?",
      message: isRu 
        ? `Вы действительно хотите удалить ВСЕХ ${entityType} организации ${orgName}? Это действие нельзя отменить.`
        : `Haqiqatan ham ${orgName} tashkilotidagi BARCHA ${entityType} o'chirib tashlamoqchimisiz? Ushbu amalni qaytarib bo'lmaydi.`,
      confirmText: isRu ? 'Удалить все' : "Hammasini o'chirish",
      cancelText: isRu ? 'Отмена' : 'Bekor qilish',
      danger: true,
    })
    if (!ok) return

    try {
      const res = await fetch('/api/employees/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          organization_id: Number(targetOrgId),
          employee_type: mode,
        })
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const resData = await res.json()
      if (resData.ok) {
        toast.success(
          isRu 
            ? `Успешно удалено: ${resData.deleted_count}` 
            : `Muvaffaqiyatli o'chirildi: ${resData.deleted_count} ta`
        )
        load()
      }
    } catch (err) {
      console.error(err)
      toast.error(isRu ? 'Ошибка при очистке данных' : 'Tozalashda xatolik yuz berdi')
    }
  }

  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [totalPages, setTotalPages] = useState(0)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [organizations, setOrganizations] = useState([])
  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])
  const [orgFilter, setOrgFilter] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [posFilter, setPosFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [hasFaceFilter, setHasFaceFilter] = useState('')

  // Stats
  const [stats, setStats] = useState(null)

  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const aliveRef = useRef(true)

  // Delete dialog state
  const [deleting, setDeleting] = useState(null)   // employee object or null

  // Tashkilotlar ro'yxatini yuklash
  useEffect(() => {
    let active = true
    fetch('/api/organizations', { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('HTTP ' + res.status)
        return res.json()
      })
      .then(data => {
        if (active) {
          setOrganizations(Array.isArray(data) ? data : [])
        }
      })
      .catch(err => {
        console.error('Tashkilotlarni yuklashda xatolik:', err)
      })
    return () => { active = false }
  }, [])

  // Bo'limlar va lavozimlarni dinamik yuklash
  useEffect(() => {
    if (!orgFilter) {
      setDepartments([])
      setPositions([])
      setDeptFilter('')
      setPosFilter('')
      return
    }
    let active = true
    fetch(`/api/organizations/${orgFilter}/employee-catalogs`, { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('HTTP ' + res.status)
        return res.json()
      })
      .then(data => {
        if (active) {
          setDepartments(Array.isArray(data?.departments) ? data.departments : [])
          setPositions(Array.isArray(data?.positions) ? data.positions : [])
          setDeptFilter('')
          setPosFilter('')
        }
      })
      .catch(err => {
        console.error('Bo\'limlarni yuklashda xatolik:', err)
      })
    return () => { active = false }
  }, [orgFilter])

  // Statistikani yuklash
  useEffect(() => {
    let active = true
    const params = new URLSearchParams({ employee_type: mode })
    if (orgFilter) params.set('organization_id', orgFilter)
    if (deptFilter) params.set('department_id', deptFilter)
    if (posFilter) params.set('position_id', posFilter)
    if (hasFaceFilter) params.set('has_face', hasFaceFilter)
    if (statusFilter) {
      params.set('has_access', statusFilter === 'active' ? 'true' : 'false')
    }
    if (debouncedSearch) params.set('search', debouncedSearch)

    fetch(`/api/employees/stats?${params}`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (active && data?.ok) setStats(data) })
      .catch(() => {})
    return () => { active = false }
  }, [orgFilter, mode, deptFilter, posFilter, hasFaceFilter, statusFilter, debouncedSearch])

  // Debounce qidiruv (350ms)
  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(h)
  }, [search])

  // Mode o'zgarsa — barcha filter va sahifani tozalaymiz
  useEffect(() => {
    setPage(1)
    setSearch('')
    setDebouncedSearch('')
    setOrgFilter('')
    setDeptFilter('')
    setPosFilter('')
    setStatusFilter('')
    setHasFaceFilter('')
    setStats(null)
    setInitialLoading(true)
  }, [mode])

  // Search, page_size yoki filterlar o'zgarsa, sahifani 1 ga
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, pageSize, orgFilter, deptFilter, posFilter, statusFilter, hasFaceFilter])

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setRefreshing(true)
    try {
      const params = new URLSearchParams({
        employee_type: mode,
        page: String(page),
        page_size: String(pageSize),
      })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (orgFilter) params.set('organization_id', orgFilter)
      if (deptFilter) params.set('department_id', deptFilter)
      if (posFilter) params.set('position_id', posFilter)
      if (hasFaceFilter) params.set('has_face', hasFaceFilter)
      if (statusFilter) {
        params.set('has_access', statusFilter === 'active' ? 'true' : 'false')
      }

      const res = await fetch(`/api/employees?${params}`, { credentials: 'include' })
      if (!res.ok) {
        if (res.status === 401) throw new Error(isRu ? 'Не авторизован' : 'Avtorizatsiya talab qilinadi')
        throw new Error(`HTTP ${res.status}`)
      }
      const data = await res.json()
      if (aliveRef.current) {
        setItems(Array.isArray(data?.items) ? data.items : [])
        setTotal(Number(data?.total || 0))
        setTotalPages(Number(data?.total_pages || 0))
        if (data?.page && data.page !== page) setPage(data.page)
        setError('')
      }
    } catch (e) {
      if (aliveRef.current) setError(e.message)
    } finally {
      if (aliveRef.current) {
        setInitialLoading(false)
        setRefreshing(false)
      }
    }
  }, [mode, page, pageSize, debouncedSearch, orgFilter, deptFilter, posFilter, hasFaceFilter, statusFilter, isRu])

  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  useEffect(() => {
    load({ silent: true })
  }, [load])

  const showSkeleton = initialLoading && items.length === 0

  const titleUz = isStudents ? "O'quvchilar / Talabalar" : 'Xodimlar'
  const titleRu = isStudents ? 'Учащиеся / Студенты' : 'Сотрудники'
  const HeroIcon = isStudents ? HatGraduationRegular : PeopleRegular

  const statsItems = stats ? [
    { id: 'total', label: isRu ? 'Всего' : 'Jami', value: stats.total, color: '#6366f1', bg: 'rgba(99,102,241,0.10)', border: 'rgba(99,102,241,0.20)', icon: '👥' },
    { id: 'male', label: isRu ? 'Мужчины' : 'Erkak', value: stats.male, color: '#3b82f6', bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.20)', icon: '👨' },
    { id: 'female', label: isRu ? 'Женщины' : 'Ayol', value: stats.female, color: '#ec4899', bg: 'rgba(236,72,153,0.10)', border: 'rgba(236,72,153,0.20)', icon: '👩' },
    { id: 'wface', label: isRu ? 'С фото' : 'Yuzi bor', value: stats.with_face, color: '#22c55e', bg: 'rgba(34,197,94,0.10)', border: 'rgba(34,197,94,0.20)', icon: '✅' },
    { id: 'nface', label: isRu ? 'Без фото' : "Yuzi yo'q", value: stats.without_face, color: '#ef4444', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.20)', icon: '❌' },
    { id: 'dept', label: isStudents ? (isRu ? 'Классы / Группы' : 'Sinflar / Guruhlar') : (isRu ? 'Отделы' : "Bo'limlar"), value: stats.departments, color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.20)', icon: '🏢' },
    ...(!isStudents ? [{ id: 'pos', label: isRu ? 'Должности' : 'Lavozimlar', value: stats.positions, color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)', border: 'rgba(139,92,246,0.20)', icon: '💼' }] : []),
  ] : []

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={isRu ? `✦ ${titleRu}` : `✦ ${titleUz}`}
        title={isRu ? titleRu : titleUz}
        sub={isStudents
          ? (isRu ? 'Учащиеся школ, студенты колледжей' : "Maktab o'quvchilari, kollej talabalari")
          : (isRu ? 'Сотрудники и преподаватели' : "Hodimlar va o'qituvchilar")}
        right={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setImportModalOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', borderRadius: 8,
                background: '#0f52ba', border: 'none',
                color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
              title={isRu ? 'Импортировать из Excel' : 'Exceldan import qilish'}
            >
              <ArrowUploadRegular fontSize={16} />
              {isRu ? 'Импорт' : 'Import'}
            </button>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', borderRadius: 8,
                background: '#107c41', border: 'none',
                color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
              title={isRu ? 'Скачать шаблон Excel' : 'Excel shablonini yuklab olish'}
            >
              <DocumentTableRegular fontSize={16} />
              {isRu ? 'Шаблон Excel' : 'Excel shablon'}
            </button>
            <button
              type="button"
              onClick={() => setExportModalOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', borderRadius: 8,
                background: '#217346', border: 'none',
                color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
              title={isRu ? 'Экспортировать в Excel' : 'Excelga eksport qilish'}
            >
              <DocumentTableRegular fontSize={16} />
              {isRu ? 'Экспорт' : 'Eksport'}
            </button>
            <button
              type="button"
              onClick={handleClearEmployees}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', borderRadius: 8,
                background: '#e11d48', border: 'none',
                color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
              title={isRu ? 'Очистить всех сотрудников' : 'Barcha xodimlarni tozalash'}
            >
              <DeleteRegular fontSize={16} />
              {isRu ? 'Очистить' : 'Tozalash'}
            </button>
            <button
              type="button"
              onClick={() => navigate(isStudents ? '/users/students/new?type=oquvchi' : '/users/staff/new?type=hodim')}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', borderRadius: 8,
                background: 'var(--accent)', border: 'none',
                color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <AddRegular fontSize={16} /> {isRu ? 'Добавить' : "Qo'shish"}
            </button>
            <button onClick={() => load()} disabled={refreshing || initialLoading} style={refreshBtnStyle(refreshing || initialLoading)}>
              <ArrowSyncRegular fontSize={16} style={{ animation: (refreshing || initialLoading) ? 'spin 1s linear infinite' : 'none' }} />
              {isRu ? 'Обновить' : 'Yangilash'}
            </button>
          </div>
        }
      />

      <div className="employees-container">
        {error && <div style={errBannerStyle}>{error}</div>}

        <div className="employees-card" style={cardStyle}>
          <div className="employees-toolbar" style={toolbarStyle}>
            <div>
              <h3 style={cardTitleStyle}>
                <HeroIcon style={{ color: isStudents ? '#06b6d4' : '#22c55e' }} />
                {isRu ? titleRu : titleUz}
              </h3>
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-4)' }}>
                {isRu ? 'Всего' : 'Jami'}: <strong style={{ color: 'var(--text-1)' }}>{total}</strong>
                {totalPages > 1 && <> · {isRu ? 'стр.' : 'sahifa'} {page}/{totalPages}</>}
              </div>
            </div>
          </div>

          {/* Stats Strip */}
          {statsItems.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '10px 0 4px 0', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
              {statsItems.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, background: s.bg, border: '1px solid ' + s.border, fontSize: 12, fontWeight: 600, color: s.color, whiteSpace: 'nowrap' }}>
                  <span>{s.icon}</span>
                  <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>{s.label}:</span>
                  <span>{s.value}</span>
                </div>
              ))}
            </div>
          )}

          <div className="employees-filters" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', paddingBottom: 8 }}>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={isRu ? 'Поиск по ФИО, ID' : "F.I.SH, ID bo'yicha qidiruv"}
                style={{ minWidth: 200, ...inpStyle }}
              />

              {/* Tashkilot filtri */}
              <select
                value={orgFilter}
                onChange={e => {
                  setOrgFilter(e.target.value)
                  setDeptFilter('')
                  setPosFilter('')
                }}
                style={{ minWidth: 160, ...inpStyle }}
              >
                <option value="">{isRu ? 'Все организации' : 'Barcha tashkilotlar'}</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>

              {/* Bo'lim filtri */}
              <select
                value={deptFilter}
                onChange={e => { setDeptFilter(e.target.value); setPosFilter('') }}
                disabled={!orgFilter}
                style={{ minWidth: 150, ...inpStyle }}
              >
                <option value="">
                  {isStudents
                    ? (isRu ? 'Все классы / группы' : 'Barcha sinf / guruhlar')
                    : (isRu ? 'Все отделы' : "Barcha bo'limlar")}
                </option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>

              {/* Lavozim filtri (faqat staff uchun) */}
              {!isStudents && (
                <select
                  value={posFilter}
                  onChange={e => setPosFilter(e.target.value)}
                  disabled={!orgFilter}
                  style={{ minWidth: 150, ...inpStyle }}
                >
                  <option value="">{isRu ? 'Все должности' : 'Barcha lavozimlar'}</option>
                  {positions
                    .filter(p => !deptFilter || String(p.department_id) === String(deptFilter))
                    .map(pos => (
                      <option key={pos.id} value={pos.id}>{pos.name}</option>
                    ))}
                </select>
              )}

              {/* Yuz bor/yo'q filtri */}
              <select
                value={hasFaceFilter}
                onChange={e => setHasFaceFilter(e.target.value)}
                style={{ minWidth: 130, ...inpStyle }}
              >
                <option value="">{isRu ? 'Все (лицо)' : "Barcha (yuz)"}</option>
                <option value="yes">{isRu ? '✅ Есть лицо' : '✅ Yuzi bor'}</option>
                <option value="no">{isRu ? '❌ Нет лица' : "❌ Yuzi yo'q"}</option>
              </select>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{ minWidth: 130, ...inpStyle }}
              >
                <option value="">{isRu ? 'Все статусы' : 'Barcha holatlar'}</option>
                <option value="active">{isRu ? 'Активен' : 'Faol'}</option>
                <option value="inactive">{isRu ? 'Нет доступа' : 'Ruxsat yo\'q'}</option>
              </select>

              <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} style={inpStyle}>
                {[20, 50, 100, 200].map(n => (
                  <option key={n} value={n}>{n} {isRu ? '/ стр.' : '/ sahifa'}</option>
                ))}
              </select>
            </div>

          {showSkeleton ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: 8 }).map((_, i) => <Skeleton.Row key={i} />)}
            </div>
          ) : items.length === 0 ? (
            <div style={emptyStyle}>
              {debouncedSearch
                ? (isRu ? 'По вашему запросу ничего не найдено.' : "Qidiruvga mos natija topilmadi.")
                : (isStudents
                  ? (isRu ? 'Учащиеся / студенты ещё не добавлены.' : "O'quvchilar / talabalar hali qo'shilmagan.")
                  : (isRu ? 'Сотрудники ещё не добавлены.' : "Hodimlar hali qo'shilmagan."))}
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      {/* F.I.SH */}
                      <th style={thStyle}>{isRu ? 'ФИО' : 'F.I.SH'}</th>
                      {/* Shaxsiy ID */}
                      <th style={thStyle}>{isRu ? 'Личный ID' : 'Shaxsiy ID'}</th>
                      {/* O'quvchilar: Sinf | Hodimlar: Bo'lim */}
                      {isStudents
                        ? <th style={thStyle}>{isRu ? 'Класс / группа' : 'Sinf / Guruh'}</th>
                        : <>
                            <th style={thStyle}>{isRu ? 'Отдел' : "Bo'lim"}</th>
                            <th style={thStyle}>{isRu ? 'Должность' : 'Lavozim'}</th>
                          </>
                      }
                      <th style={thStyle}>{isRu ? 'Организация' : 'Tashkilot'}</th>
                      <th style={thStyle}>{isRu ? 'График' : 'Smena'}</th>
                      <th style={thStyle}>{isRu ? 'Шаблон yuz' : 'Yuz shabloni'}</th>
                      <th style={thStyle}>{isRu ? 'Статус' : 'Holat'}</th>
                      <th style={thStyle}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(emp => (
                      <tr key={emp.id}>
                        {/* F.I.SH + avatar */}
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => navigate(`/employees/${emp.uuid || emp.id}`)}>
                            {emp.avatar
                              ? <img src={emp.avatar} alt="" style={avatarImg} onError={e => { e.target.style.display = 'none' }} />
                              : <div style={avatarFallback}><PersonRegular fontSize={18} /></div>}
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-1)' }}>{emp.full_name || `#${emp.id}`}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>
                                {emp.employee_type ? <TypePill type={emp.employee_type} /> : <span>ID: {emp.id}</span>}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Shaxsiy ID */}
                        <td style={tdStyle}>
                          <code style={{ fontSize: 12, color: 'var(--text-1)' }}>{emp.personal_id || '—'}</code>
                        </td>

                        {/* O'quvchilar: Sinf | Hodimlar: Bo'lim + Lavozim alohida */}
                        {isStudents ? (
                          <td style={tdStyle}>
                            {emp.department
                              ? <span style={{
                                  display: 'inline-block', padding: '3px 10px',
                                  borderRadius: 6, fontSize: 12, fontWeight: 600,
                                  background: 'rgba(6,182,212,0.10)', color: '#06b6d4',
                                  border: '1px solid rgba(6,182,212,0.25)',
                                }}>{emp.department}</span>
                              : <span style={{ color: 'var(--text-4)' }}>—</span>}
                          </td>
                        ) : (
                          <>
                            <td style={tdStyle}>
                              {emp.department
                                ? <span style={{
                                    display: 'inline-block', padding: '3px 10px',
                                    borderRadius: 6, fontSize: 12, fontWeight: 600,
                                    background: 'rgba(245,158,11,0.10)', color: '#f59e0b',
                                    border: '1px solid rgba(245,158,11,0.25)',
                                  }}>{emp.department}</span>
                                : <span style={{ color: 'var(--text-4)' }}>—</span>}
                            </td>
                            <td style={tdStyle}>
                              {emp.position
                                ? <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{emp.position}</span>
                                : <span style={{ color: 'var(--text-4)' }}>—</span>}
                            </td>
                          </>
                        )}

                        {/* Tashkilot */}
                        <td style={tdStyle}>
                          {emp.organization_name || <span style={{ color: 'var(--text-4)' }}>—</span>}
                        </td>

                        {/* Smena */}
                        <td style={tdStyle}>
                          {(emp.effective_start_time || emp.effective_end_time) ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, whiteSpace: 'nowrap' }}>
                              <ClockRegular fontSize={12} style={{ color: 'var(--text-4)' }} />
                              {emp.effective_start_time || '—'} – {emp.effective_end_time || '—'}
                            </div>
                          ) : <span style={{ color: 'var(--text-4)' }}>—</span>}
                          {emp.schedule_name && (
                            <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>{emp.schedule_name}</div>
                          )}
                        </td>

                        {/* Biometriya (Yuz shabloni) */}
                        <td style={tdStyle}>
                          {emp.has_embedding ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '3px 8px', borderRadius: 999,
                              background: 'var(--green-bg)', color: 'var(--green)',
                              fontSize: 11, fontWeight: 600,
                              border: '1px solid var(--green-bd)',
                              whiteSpace: 'nowrap',
                            }}>
                              ✅ {isRu ? 'Есть' : 'Mavjud'}
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '3px 8px', borderRadius: 999,
                              background: 'var(--red-bg)', color: 'var(--red)',
                              fontSize: 11, fontWeight: 600,
                              border: '1px solid var(--red-bd)',
                              whiteSpace: 'nowrap',
                            }}>
                              ❌ {isRu ? 'Нет' : "Yo'q"}
                            </span>
                          )}
                        </td>

                        {/* Holat */}
                        <td style={tdStyle}>
                          <AccessPill status={emp.status} isRu={isRu} />
                        </td>

                        {/* Amallar */}
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button type="button" onClick={() => navigate(`/employees/${emp.uuid || emp.id}`)} style={iconBtn('subtle')} title={isRu ? 'Просмотр' : "Ko'rish"}>
                              <EyeRegular fontSize={13} />
                            </button>
                            <button type="button" onClick={() => navigate(`/employees/${emp.uuid || emp.id}/edit`)} style={iconBtn('subtle')} title={isRu ? 'Редактировать' : 'Tahrirlash'}>
                              <EditRegular fontSize={13} />
                            </button>
                            <button type="button" onClick={() => setDeleting(emp)} style={iconBtn('danger')} title={isRu ? 'Удалить' : "O'chirish"}>
                              <DeleteRegular fontSize={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  total={total}
                  pageSize={pageSize}
                  onChange={setPage}
                  isRu={isRu}
                />
              )}
            </>
          )}
        </div>
      </div>

      {deleting && (
        <DeleteDialog
          employee={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={async () => {
            setDeleting(null)
            await load({ silent: true })
          }}
          toast={toast}
          isRu={isRu}
        />
      )}

      {importModalOpen && (
        <ExcelImportModal
          onClose={() => setImportModalOpen(false)}
          onImported={() => {
            setImportModalOpen(false)
            load()
          }}
          orgFilter={orgFilter}
          organizations={organizations}
          isStudents={isStudents}
          isRu={isRu}
          toast={toast}
          handleDownloadTemplate={handleDownloadTemplate}
        />
      )}

      {exportModalOpen && (
        <ExportModal
          onClose={() => setExportModalOpen(false)}
          orgFilter={orgFilter}
          organizations={organizations}
          isStudents={isStudents}
          isRu={isRu}
          toast={toast}
          debouncedSearch={debouncedSearch}
          statusFilter={statusFilter}
          hasFaceFilter={hasFaceFilter}
        />
      )}
      <style>{`
        .employees-container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 24px 32px 80px;
        }
        @media (max-width: 768px) {
          .employees-container {
            padding: 16px 16px 60px !important;
          }
          .employees-card {
            padding: 16px !important;
          }
          .employees-toolbar {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .employees-filters {
            width: 100% !important;
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .employees-filters > * {
            width: 100% !important;
            min-width: 100% !important;
          }
          .pagination-container {
            flex-direction: column !important;
            align-items: center !important;
            gap: 10px !important;
          }
        }
      `}</style>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Delete dialog (kameradan ham o'chirish opsiyasi bilan)
// ────────────────────────────────────────────────────────────────────────────

function DeleteDialog({ employee, onClose, onDeleted, toast, isRu }) {
  const [deleting, setDeleting] = useState(false)
  const [removeFromCameras, setRemoveFromCameras] = useState(true)
  const [error, setError] = useState('')

  const onConfirm = async () => {
    setDeleting(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.set('delete_from_cameras', removeFromCameras ? 'true' : 'false')
      const res = await fetch(`/api/employees/${employee.uuid || employee.id}?${params}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const detail = data?.detail || data?.message || `HTTP ${res.status}`
        throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
      }
      const data = await res.json()
      const sync = data?.camera_sync
      if (removeFromCameras && sync && sync.enabled) {
        const ok = sync.deleted || 0
        const fail = sync.failed || 0
        const skip = sync.skipped || 0
        if (fail || skip) {
          toast.warning(
            isRu
              ? `Удалён. Камеры: ${ok} ОК, ${fail} ошибок, ${skip} пропущено`
              : `O'chirildi. Kameralar: ${ok} OK, ${fail} xato, ${skip} o'tkazildi`,
            { title: isRu ? 'Удаление' : "O'chirish" }
          )
        } else {
          toast.success(
            isRu
              ? `Удалён. Камеры: ${ok} ОК`
              : `O'chirildi. ${ok} kameradan ham`,
          )
        }
      } else {
        toast.success(isRu ? 'Сотрудник удалён' : "Xodim o'chirildi")
      }
      onDeleted?.()
    } catch (e) {
      setError(e.message)
      toast.error(e.message)
    } finally {
      setDeleting(false)
    }
  }

  const camCount = (employee.camera_ids || []).length

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, padding: 24,
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 11, flexShrink: 0,
            background: 'rgba(244,63,94,0.12)', color: '#f43f5e',
            border: '1px solid rgba(244,63,94,0.30)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <WarningRegular fontSize={22} />
          </div>
          <div style={{ flex: 1, paddingTop: 2 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
              {isRu ? 'Удалить сотрудника?' : "Xodimni o'chirish?"}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>
              {isRu
                ? <><strong>{employee.full_name}</strong> будет удалён из системы. Это действие нельзя отменить.</>
                : <><strong>{employee.full_name}</strong> tizimdan o'chiriladi. Bu amalni qaytarib bo'lmaydi.</>}
            </div>
          </div>
        </div>

        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '12px 14px', borderRadius: 9,
          background: removeFromCameras ? 'var(--accent-bg)' : 'var(--bg)',
          border: `1px solid ${removeFromCameras ? 'var(--accent-bd)' : 'var(--border)'}`,
          cursor: 'pointer',
        }}>
          <input
            type="checkbox"
            checked={removeFromCameras}
            onChange={e => setRemoveFromCameras(e.target.checked)}
            style={{ accentColor: 'var(--accent)', marginTop: 2, width: 16, height: 16, flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {isRu ? 'Также удалить из камер' : "Kameralardan ham o'chirilsin"}
            </div>
            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-4)', lineHeight: 1.4 }}>
              {isRu
                ? `Лицо сотрудника будет удалено со всех камер${camCount ? ` (привязано: ${camCount})` : ' организации'}.`
                : `Yuz barcha kameralardan o'chiriladi${camCount ? ` (bog'langan: ${camCount})` : ' (tashkilotning hammasidan)'}.`}
            </div>
          </div>
        </label>

        {error && (
          <div style={{ marginTop: 14, padding: 10, background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, border: '1px solid var(--red-bd)', fontSize: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <button type="button" onClick={onClose} disabled={deleting} style={iconBtnTextStyle('subtle')}>
            {isRu ? 'Отмена' : 'Bekor qilish'}
          </button>
          <button type="button" onClick={onConfirm} disabled={deleting} style={iconBtnTextStyle('danger')}>
            {deleting
              ? <ArrowSyncRegular fontSize={14} style={{ animation: 'spin 1s linear infinite' }} />
              : <DeleteRegular fontSize={14} />}
            {deleting
              ? (isRu ? 'Удаление...' : "O'chirilmoqda...")
              : (isRu ? 'Удалить' : "O'chirish")}
          </button>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Action buttons styles
// ────────────────────────────────────────────────────────────────────────────

function iconBtn(kind) {
  const map = {
    subtle: { bg: 'var(--surface-2)', color: 'var(--text-1)', border: '1px solid var(--border-2)' },
    danger: { bg: 'rgba(244,63,94,0.10)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.30)' },
  }
  const t = map[kind] || map.subtle
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, borderRadius: 7,
    background: t.bg, color: t.color, border: t.border,
    cursor: 'pointer',
  }
}

function iconBtnTextStyle(kind) {
  const map = {
    subtle: { bg: 'var(--surface-2)', color: 'var(--text-1)', border: '1px solid var(--border-2)' },
    danger: { bg: '#f43f5e', color: '#fff', border: 'none' },
  }
  const t = map[kind] || map.subtle
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '9px 16px', borderRadius: 8,
    background: t.bg, color: t.color, border: t.border,
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Pagination component
// ────────────────────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, total, pageSize, onChange, isRu }) {
  const start = (page - 1) * pageSize + 1
  const end = Math.min(total, page * pageSize)

  // Maks. 7 ta tugma + ellipsis
  const pages = useMemo(() => buildPageList(page, totalPages), [page, totalPages])

  return (
    <div className="pagination-container" style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginTop: 16, flexWrap: 'wrap', gap: 12,
    }}>
      <div style={{ fontSize: 12, color: 'var(--text-4)' }}>
        {start}–{end} {isRu ? 'из' : '/'} <strong style={{ color: 'var(--text-1)' }}>{total}</strong>
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <PageBtn disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="prev">
          <ChevronLeftRegular fontSize={14} />
        </PageBtn>
        {pages.map((p, i) => p === '…' ? (
          <span key={`gap-${i}`} style={{ padding: '0 6px', color: 'var(--text-4)' }}>…</span>
        ) : (
          <PageBtn key={p} active={p === page} onClick={() => onChange(p)}>
            {p}
          </PageBtn>
        ))}
        <PageBtn disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="next">
          <ChevronRightRegular fontSize={14} />
        </PageBtn>
      </div>
    </div>
  )
}

function PageBtn({ children, active, disabled, onClick, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...rest}
      style={{
        minWidth: 32, height: 32, padding: '0 10px', borderRadius: 7,
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border-2)'}`,
        background: active ? 'var(--accent)' : 'var(--bg)',
        color: active ? '#fff' : 'var(--text-1)',
        fontSize: 12, fontWeight: active ? 700 : 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
    </button>
  )
}

function buildPageList(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const list = [1]
  if (page > 4) list.push('…')
  const start = Math.max(2, page - 1)
  const end = Math.min(totalPages - 1, page + 1)
  for (let p = start; p <= end; p++) list.push(p)
  if (page < totalPages - 3) list.push('…')
  list.push(totalPages)
  return list
}

// ────────────────────────────────────────────────────────────────────────────
// Pills
// ────────────────────────────────────────────────────────────────────────────

function TypePill({ type }) {
  if (!type) return null
  const t = String(type).toLowerCase()
  const map = {
    oquvchi:    { color: '#06b6d4', text: "O'quvchi" },
    talaba:     { color: '#0891b2', text: 'Talaba' },
    student:    { color: '#06b6d4', text: 'Student' },
    oqituvchi:  { color: '#22c55e', text: "O'qituvchi" },
    teacher:    { color: '#22c55e', text: 'Teacher' },
    hodim:      { color: '#f59e0b', text: 'Hodim' },
    employee:   { color: '#f59e0b', text: 'Employee' },
    staff:      { color: '#f59e0b', text: 'Staff' },
  }
  const meta = map[t] || { color: '#64748b', text: type }
  return (
    <span style={{
      display: 'inline-block', padding: '1px 7px', borderRadius: 999,
      fontSize: 10, fontWeight: 600,
      background: meta.color + '22', color: meta.color, border: `1px solid ${meta.color}55`,
    }}>{meta.text}</span>
  )
}

function AccessPill({ status, isRu }) {
  const isOk = !!status && !String(status).toLowerCase().includes('yo')
  const tone = isOk
    ? { bg: 'rgba(16,185,129,0.12)', color: '#10b981', icon: <CheckmarkCircleRegular fontSize={12} />, text: status || (isRu ? 'Активен' : 'Faol') }
    : { bg: 'rgba(244,63,94,0.10)', color: '#f43f5e', icon: <DismissCircleRegular fontSize={12} />, text: status || (isRu ? 'Нет доступа' : "Ruxsat yo'q") }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 9px', borderRadius: 999,
      background: tone.bg, color: tone.color,
      fontSize: 11, fontWeight: 600,
      border: `1px solid ${tone.color}33`,
    }}>{tone.icon}{tone.text}</span>
  )
}

// ────────────────────────────────────────────────────────────────────────────
function ExcelImportModal({
  onClose,
  onImported,
  orgFilter,
  organizations,
  isStudents,
  isRu,
  toast,
  handleDownloadTemplate,
}) {
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const [selectedOrgId, setSelectedOrgId] = useState(orgFilter || '')
  const [previewItems, setPreviewItems] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!selectedOrgId && organizations.length === 1) {
      setSelectedOrgId(organizations[0].id)
    }
  }, [organizations, selectedOrgId])

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile.name.endsWith('.zip')) {
        setFile(droppedFile)
      } else {
        toast.error(isRu ? 'Пожалуйста, выберите ZIP файл (.zip)' : 'Iltimos, faqat ZIP faylini tanlang (.zip)')
      }
    }
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      if (selectedFile.name.endsWith('.zip')) {
        setFile(selectedFile)
      } else {
        toast.error(isRu ? 'Пожалуйста, выберите ZIP файл (.zip)' : 'Iltimos, faqat ZIP faylini tanlang (.zip)')
      }
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handlePreview = async () => {
    if (!file) {
      toast.error(isRu ? 'Пожалуйста, выберите файл' : 'Iltimos, faylni tanlang')
      return
    }
    if (!selectedOrgId) {
      toast.error(isRu ? 'Пожалуйста, выберите организацию' : 'Iltimos, tashkilotni tanlang')
      return
    }

    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('organization_id', selectedOrgId)
      formData.append('employee_type', isStudents ? 'students' : 'staff')

      const res = await fetch('/api/employees/preview-zip', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || 'HTTP ' + res.status)
      }

      const resData = await res.json()
      if (resData.ok) {
        setPreviewItems(resData.items || [])
      }
    } catch (err) {
      console.error(err)
      toast.error(err.message || (isRu ? 'Ошибка при разборе ZIP' : 'ZIP arxivini tahlil qilishda xatolik yuz berdi'))
    } finally {
      setImporting(false)
    }
  }

  const handleConfirmSave = async () => {
    if (!previewItems || previewItems.length === 0) return

    setImporting(true)
    try {
      const res = await fetch('/api/employees/confirm-import-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          organization_id: Number(selectedOrgId),
          employee_type: isStudents ? 'students' : 'staff',
          items: previewItems,
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || 'HTTP ' + res.status)
      }

      const resData = await res.json()
      if (resData.ok) {
        toast.success(
          isRu 
            ? `Успешно импортировано: ${resData.imported_count}` 
            : `Muvaffaqiyatli import qilindi: ${resData.imported_count} ta`
        )
        if (resData.errors && resData.errors.length > 0) {
          console.warn('Import errors:', resData.errors)
          toast.warning(
            isRu 
              ? `Некоторые строки пропущены (${resData.errors.length} шт). Подробности в консоли.` 
              : `Ayrim qatorlar yuklanmadi (${resData.errors.length} ta). Tafsilotlar konsolda.`
          )
        }
        onImported()
      }
    } catch (err) {
      console.error(err)
      toast.error(err.message || (isRu ? 'Ошибка при сохранении' : 'Saqlashda xatolik yuz berdi'))
    } finally {
      setImporting(false)
    }
  }

  const isPreviewMode = previewItems !== null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16, backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: isPreviewMode ? 1200 : 520,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, padding: 24, boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
          position: 'relative', animation: 'scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          transition: 'max-width 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>
            {isPreviewMode
              ? (isRu ? 'Предпросмотр импортируемых сотрудников' : 'Import qilinadigan xodimlar ro\'yxati (Ko\'rish)')
              : (isRu ? 'Импорт из ZIP (Excel + Фото)' : 'ZIP arxivdan import qilish (Excel + Rasmlar)')}
          </h3>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 4 }}>
            <DismissCircleRegular fontSize={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
          {isPreviewMode ? (
            <>
              {/* Stats Summary Row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: 12,
                marginBottom: 4,
                flexShrink: 0
              }}>
                {/* Stat 1: Jami */}
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 10.5, color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 600 }}>
                    {isRu ? 'Всего' : 'Jami'}
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', marginTop: 4 }}>
                    {previewItems.length}
                  </span>
                </div>
                {/* Stat 2: Erkaklar */}
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 10.5, color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 600 }}>
                    {isRu ? 'Мужчин' : 'Erkaklar'}
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', marginTop: 4 }}>
                    {previewItems.filter(item => item.gender === 'male').length}
                  </span>
                </div>
                {/* Stat 3: Ayollar */}
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 10.5, color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 600 }}>
                    {isRu ? 'Женщин' : 'Ayollar'}
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#ec4899', marginTop: 4 }}>
                    {previewItems.filter(item => item.gender === 'female').length}
                  </span>
                </div>
                {/* Stat 4: Bo'limlar */}
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 10.5, color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 600 }}>
                    {isRu ? 'Отделов' : 'Bo\'limlar'}
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#10b981', marginTop: 4 }}>
                    {new Set(previewItems.map(item => item.department).filter(d => d && d.trim())).size}
                  </span>
                </div>
                {/* Stat 5: Lavozimlar */}
                {!isStudents && (
                  <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 10.5, color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 600 }}>
                      {isRu ? 'Должностей' : 'Lavozimlar'}
                    </span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#f59e0b', marginTop: 4 }}>
                      {new Set(previewItems.map(item => item.position).filter(p => p && p.trim())).size}
                    </span>
                  </div>
                )}
                {/* Stat 6: Rasmli */}
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 10.5, color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 600 }}>
                    {isRu ? 'С фото' : 'Rasmli'}
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#3b82f6', marginTop: 4 }}>
                    {previewItems.filter(item => item.image_url).length}
                  </span>
                </div>
                {/* Stat 7: Rasmsiz */}
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 10.5, color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 600 }}>
                    {isRu ? 'Без фото' : 'Rasmsiz'}
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#6b7280', marginTop: 4 }}>
                    {previewItems.filter(item => !item.image_url).length}
                  </span>
                </div>
              </div>

              {/* Preview Table */}
              <div style={{ border: '1px solid var(--border-2)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '420px', flex: 1 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border-2)', color: 'var(--text-3)', fontWeight: 600 }}>
                        <th style={{ padding: '10px 12px', width: 40, position: 'sticky', top: 0, background: 'var(--surface-2)', zIndex: 2 }}>#</th>
                        <th style={{ padding: '10px 12px', width: 60, position: 'sticky', top: 0, background: 'var(--surface-2)', zIndex: 2 }}>{isRu ? 'Фото' : 'Rasm'}</th>
                        <th style={{ padding: '10px 12px', position: 'sticky', top: 0, background: 'var(--surface-2)', zIndex: 2 }}>{isRu ? 'Ф.И.О' : 'F.I.SH'}</th>
                        <th style={{ padding: '10px 12px', width: 100, position: 'sticky', top: 0, background: 'var(--surface-2)', zIndex: 2 }}>{isRu ? 'ID' : 'ID'}</th>
                        <th style={{ padding: '10px 12px', position: 'sticky', top: 0, background: 'var(--surface-2)', zIndex: 2 }}>{isRu ? 'Отдел' : 'Bo\'lim/Sinf'}</th>
                        {!isStudents && <th style={{ padding: '10px 12px', position: 'sticky', top: 0, background: 'var(--surface-2)', zIndex: 2 }}>{isRu ? 'Должность' : 'Lavozim'}</th>}
                        <th style={{ padding: '10px 12px', position: 'sticky', top: 0, background: 'var(--surface-2)', zIndex: 2 }}>{isRu ? 'Телефон' : 'Telefon'}</th>
                        <th style={{ padding: '10px 12px', position: 'sticky', top: 0, background: 'var(--surface-2)', zIndex: 2 }}>{isRu ? 'Дата рожд.' : 'Tug\'ilgan sana'}</th>
                        <th style={{ padding: '10px 12px', position: 'sticky', top: 0, background: 'var(--surface-2)', zIndex: 2 }}>{isRu ? 'Пол' : 'Jinsi'}</th>
                        <th style={{ padding: '10px 12px', position: 'sticky', top: 0, background: 'var(--surface-2)', zIndex: 2 }}>{isRu ? 'Адрес' : 'Manzil'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewItems.length === 0 ? (
                        <tr>
                          <td colSpan={isStudents ? 9 : 10} style={{ padding: 24, textAlign: 'center', color: 'var(--text-4)' }}>
                            {isRu ? 'Нет данных для импорта' : 'Import qilish uchun ma\'lumotlar mavjud emas'}
                          </td>
                        </tr>
                      ) : (
                        previewItems.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-2)', color: 'var(--text-1)' }}>
                            <td style={{ padding: '8px 12px', color: 'var(--text-4)' }}>{idx + 1}</td>
                            <td style={{ padding: '6px 12px' }}>
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt=""
                                  style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-2)' }}
                                  onError={e => { e.target.style.display = 'none' }}
                                />
                              ) : (
                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface-2)', color: 'var(--text-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                                  <PersonRegular fontSize={14} />
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '8px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {`${item.last_name} ${item.first_name} ${item.middle_name || ''}`}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <code style={{ fontSize: 11.5, background: 'var(--surface-2)', padding: '2px 6px', borderRadius: 4 }}>
                                {item.personal_id}
                              </code>
                              {item.is_auto_id && (
                                <span style={{ fontSize: 9.5, color: '#f59e0b', fontWeight: 600, marginLeft: 6 }}>
                                  ({isRu ? 'Авто' : 'Auto'})
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{item.department || '—'}</td>
                            {!isStudents && <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{item.position || '—'}</td>}
                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{item.phone || '—'}</td>
                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{item.birth_date || '—'}</td>
                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                              {item.gender ? (
                                item.gender === 'male' ? (isRu ? 'Муж' : 'Erkak') : (isRu ? 'Жен' : 'Ayol')
                              ) : '—'}
                            </td>
                            <td style={{ padding: '8px 12px', minWidth: 150 }}>
                              {[item.region, item.district, item.address].filter(Boolean).join(', ') || '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            /* Upload file fields */
            <>
              {/* Org Select */}
              {organizations.length > 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {isRu ? 'Выберите организацию' : 'Tashkilotni tanlang'} <span style={{ color: 'var(--red)' }}>*</span>
                  </label>
                  <select
                    value={selectedOrgId}
                    onChange={e => setSelectedOrgId(e.target.value)}
                    style={{
                      padding: '9px 12px', borderRadius: 8,
                      border: '1px solid var(--border-2)', background: 'var(--bg)',
                      color: 'var(--text-1)', fontSize: 13, outline: 'none', width: '100%'
                    }}
                  >
                    <option value="">{isRu ? '-- Выберите --' : '-- Tanlang --'}</option>
                    {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
              )}

              {/* Download template */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', background: 'var(--bg)', borderRadius: 10,
                border: '1px solid var(--border-2)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <DocumentTableRegular fontSize={24} style={{ color: '#107c41' }} />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-1)' }}>
                      {isRu ? 'Шаблон Excel' : 'Excel shablon fayli'}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-4)' }}>
                      {isRu ? 'Заполните данные по этому шаблону' : 'Ma\'lumotlarni ushbu shablon asosida to\'ldiring'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  style={{
                    padding: '6px 14px', borderRadius: 6,
                    background: '#107c41', border: '1px solid #107c41',
                    color: '#ffffff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#0e6233'; e.currentTarget.style.borderColor = '#0e6233' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#107c41'; e.currentTarget.style.borderColor = '#107c41' }}
                >
                  {isRu ? 'Скачать' : 'Yuklash'}
                </button>
              </div>

              {/* Drag & Drop zone */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={handleUploadClick}
                style={{
                  border: dragActive 
                    ? '2px dashed var(--accent)' 
                    : file 
                      ? '2px solid rgba(16, 124, 65, 0.4)' 
                      : '2px dashed var(--border-2)',
                  borderRadius: 12,
                  padding: '32px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: dragActive 
                    ? 'var(--accent-bg)' 
                    : file 
                      ? 'rgba(16, 124, 65, 0.03)' 
                      : 'var(--bg)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".zip"
                  style={{ display: 'none' }}
                />
                {file ? (
                  <>
                    <ArchiveRegular fontSize={40} style={{ color: 'var(--accent)' }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', wordBreak: 'break-all' }}>
                        {file.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </div>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--accent)', fontWeight: 600 }}>
                      {isRu ? 'Нажмите, чтобы заменить файл' : 'Faylni almashtirish uchun bosing'}
                    </div>
                  </>
                ) : (
                  <>
                    <ArrowUploadRegular fontSize={40} style={{ color: dragActive ? 'var(--accent)' : 'var(--text-4)' }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
                        {isRu 
                          ? 'Перетащите ZIP архив сюда или кликните для выбора' 
                          : 'ZIP arxivini bu yerga sudrab olib keling yoki tanlash uchun bosing'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 6 }}>
                        {isRu 
                          ? 'Архив должен содержать один Excel файл и фотографии сотрудников' 
                          : 'Arxiv tarkibida bitta Excel fayli va xodimlarning rasmlari bo\'lishi kerak'}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24, flexShrink: 0 }}>
          {isPreviewMode ? (
            <>
              <button
                type="button"
                disabled={importing}
                onClick={() => setPreviewItems(null)}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  background: 'var(--surface-2)', border: '1px solid var(--border-2)',
                  color: 'var(--text-1)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  opacity: importing ? 0.6 : 1,
                }}
              >
                {isRu ? 'Назад' : 'Orqaga'}
              </button>
              <button
                type="button"
                disabled={importing || previewItems.length === 0}
                onClick={handleConfirmSave}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 20px', borderRadius: 8,
                  background: 'var(--accent)',
                  border: 'none',
                  color: '#fff',
                  fontSize: 13, fontWeight: 600,
                  cursor: importing ? 'not-allowed' : 'pointer',
                  opacity: importing ? 0.8 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {importing ? (
                  <>
                    <ArrowSyncRegular fontSize={14} style={{ animation: 'spin 1s linear infinite' }} />
                    {isRu ? 'Сохранение...' : 'Saqlanmoqda...'}
                  </>
                ) : (
                  <>
                    <CheckmarkRegular fontSize={14} />
                    {isRu ? 'Сохранить' : 'Saqlash'}
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={importing}
                onClick={onClose}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  background: 'var(--surface-2)', border: '1px solid var(--border-2)',
                  color: 'var(--text-1)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  opacity: importing ? 0.6 : 1,
                }}
              >
                {isRu ? 'Отмена' : 'Bekor qilish'}
              </button>
              <button
                type="button"
                disabled={importing || !file || !selectedOrgId}
                onClick={handlePreview}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 16px', borderRadius: 8,
                  background: file && selectedOrgId ? 'var(--accent)' : 'var(--border-2)',
                  border: 'none',
                  color: file && selectedOrgId ? '#fff' : 'var(--text-4)',
                  fontSize: 13, fontWeight: 600,
                  cursor: file && selectedOrgId && !importing ? 'pointer' : 'not-allowed',
                  opacity: importing ? 0.8 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {importing ? (
                  <>
                    <ArrowSyncRegular fontSize={14} style={{ animation: 'spin 1s linear infinite' }} />
                    {isRu ? 'Чтение ZIP...' : 'ZIP o\'qilmoqda...'}
                  </>
                ) : (
                  <>
                    <EyeRegular fontSize={14} />
                    {isRu ? 'Посмотреть' : 'Ko\'rish'}
                  </>
                )}
              </button>
            </>
          )}
        </div>

        <style>{`
          @keyframes scaleUp {
            from { opacity: 0; transform: scale(0.96) translateY(4px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>
      </div>
    </div>
  )
}

function ExportModal({ onClose, orgFilter, organizations, isStudents, isRu, toast, debouncedSearch, statusFilter, hasFaceFilter }) {
  const [selectedOrgId, setSelectedOrgId] = useState(orgFilter || (organizations.length === 1 ? String(organizations[0].id) : ''))
  const [depts, setDepts] = useState([])
  const [loadingDepts, setLoadingDepts] = useState(false)
  const [selectedDeptIds, setSelectedDeptIds] = useState([])
  const [exporting, setExporting] = useState(false)
  const [deptSearch, setDeptSearch] = useState('')

  // Fetch departments when selectedOrgId changes
  useEffect(() => {
    if (!selectedOrgId) {
      setDepts([])
      setSelectedDeptIds([])
      setDeptSearch('')
      return
    }
    setLoadingDepts(true)
    fetch(`/api/organizations/${selectedOrgId}/employee-catalogs`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        const list = Array.isArray(data?.departments) ? data.departments : []
        setDepts(list)
        // Select all by default
        setSelectedDeptIds(list.map(d => String(d.id)))
        setDeptSearch('')
      })
      .catch(err => {
        console.error(err)
      })
      .finally(() => {
        setLoadingDepts(false)
      })
  }, [selectedOrgId])

  const toggleDept = (id) => {
    const sid = String(id)
    setSelectedDeptIds(prev => prev.includes(sid) ? prev.filter(x => x !== sid) : [...prev, sid])
  }

  // Filter departments by search text
  const filteredDepts = useMemo(() => {
    const q = deptSearch.trim().toLowerCase()
    if (!q) return depts
    return depts.filter(d => d.name?.toLowerCase().includes(q))
  }, [depts, deptSearch])

  const allVisibleSelected = filteredDepts.length > 0 && filteredDepts.every(d => selectedDeptIds.includes(String(d.id)))

  const handleSelectAll = () => {
    const visibleIds = filteredDepts.map(d => String(d.id))
    if (allVisibleSelected) {
      // Deselect only currently visible matching departments
      setSelectedDeptIds(prev => prev.filter(id => !visibleIds.includes(id)))
    } else {
      // Select all currently visible matching departments
      setSelectedDeptIds(prev => {
        const next = [...prev]
        visibleIds.forEach(id => {
          if (!next.includes(id)) next.push(id)
        })
        return next
      })
    }
  }

  const handleExport = async (e) => {
    e?.preventDefault()
    if (!selectedOrgId) {
      toast.error(isRu ? 'Пожалуйста, выберите организацию' : 'Iltimos, tashkilotni tanlang')
      return
    }
    setExporting(true)
    try {
      // Fetch matching employees with paginate=false
      const params = new URLSearchParams({
        employee_type: isStudents ? 'students' : 'staff',
        paginate: 'false',
        organization_id: selectedOrgId,
      })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (hasFaceFilter) params.set('has_face', hasFaceFilter)
      if (statusFilter) {
        params.set('has_access', statusFilter === 'active' ? 'true' : 'false')
      }

      const res = await fetch(`/api/employees?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      let data = await res.json()
      if (!Array.isArray(data) || data.length === 0) {
        toast.error(isRu ? 'Нет данных для экспорта' : "Eksport qilish uchun ma'lumotlar mavjud emas")
        return
      }

      // Filter on client side by selected departments if not all are selected
      if (depts.length > 0 && selectedDeptIds.length < depts.length) {
        const allowedIds = new Set(selectedDeptIds.map(Number))
        data = data.filter(emp => emp.department_id && allowedIds.has(Number(emp.department_id)))
      }

      if (data.length === 0) {
        toast.error(isRu ? 'Выбранные отделы не содержат сотрудников' : "Tanlangan bo'limlarda xodimlar mavjud emas")
        return
      }

      // Format data for excel
      const excelRows = data.map((emp, idx) => {
        const row = {
          "№": idx + 1,
          [isRu ? "ФИО" : "F.I.SH"]: emp.full_name,
          [isRu ? "Личный ID" : "Shaxsiy ID"]: emp.personal_id || '',
          [isStudents ? (isRu ? "Класс / Группа" : "Sinf / Guruh") : (isRu ? "Отдел" : "Bo'lim")]: emp.department || '',
        }
        if (!isStudents) {
          row[isRu ? "Должность" : "Lavozim"] = emp.position || ''
        }
        row[isRu ? "Организация" : "Tashkilot"] = emp.organization_name || ''
        row[isRu ? "Смена (Время)" : "Smena (Vaqt)"] = (emp.effective_start_time || emp.effective_end_time) 
          ? `${emp.effective_start_time || ''} - ${emp.effective_end_time || ''}` 
          : ''
        row[isRu ? "Наличие фото" : "Yuz shabloni"] = emp.has_embedding 
          ? (isRu ? "Есть" : "Mavjud") 
          : (isRu ? "Нет" : "Yo'q")
        row[isRu ? "Статус" : "Holat"] = emp.status || ''
        row[isRu ? "Телефон" : "Telefon"] = emp.phone || ''
        if (isStudents) {
          row[isRu ? "Телефон родителей" : "Ota-onasi telefoni"] = emp.parent_phone || ''
        }
        row[isRu ? "Адрес" : "Manzil"] = emp.address || ''
        row[isRu ? "Дата рождения" : "Tug'ilgan sana"] = emp.birth_date || ''
        row[isRu ? "Пол" : "Jinsi"] = emp.gender || ''
        return row
      })

      const XLSX = await import('xlsx')
      const ws = XLSX.utils.json_to_sheet(excelRows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, isStudents ? (isRu ? "Учащиеся" : "O'quvchilar") : (isRu ? "Сотрудники" : "Xodimlar"))

      // Auto-fit columns
      const maxLens = {}
      excelRows.forEach(row => {
        Object.keys(row).forEach(key => {
          const val = String(row[key] || '')
          maxLens[key] = Math.max(maxLens[key] || key.length, val.length)
        })
      })
      ws['!cols'] = Object.keys(maxLens).map(key => ({
        wch: Math.min(Math.max(maxLens[key] + 4, 10), 50)
      }))

      const filename = isStudents 
        ? (isRu ? "studenty_export.xlsx" : "oquvchilar_eksport.xlsx")
        : (isRu ? "sotrudniki_export.xlsx" : "xodimlar_eksport.xlsx")

      XLSX.writeFile(wb, filename)
      toast.success(isRu ? 'Экспорт успешно завершен' : 'Eksport muvaffaqiyatli yakunlandi')
      onClose()
    } catch (err) {
      console.error(err)
      toast.error(isRu ? 'Ошибка при экспорте' : 'Eksport qilishda xatolik yuz berdi')
    } finally {
      setExporting(false)
    }
  }

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
          width: '100%', maxWidth: 500,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, padding: 24, maxHeight: '90vh', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 16,
          animation: 'scaleUp 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            {isStudents 
              ? (isRu ? 'Экспорт учащихся' : 'O\'quvchilarni eksport qilish')
              : (isRu ? 'Экспорт сотрудников' : 'Xodimlarni eksport qilish')}
          </h3>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>
            <DismissCircleRegular fontSize={20} />
          </button>
        </div>

        <div>
          {/* Org Selector if multiple */}
          {organizations.length > 1 && !orgFilter ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {isRu ? 'Организация' : 'Tashkilot'} <span style={{ color: '#f43f5e' }}>*</span>
              </label>
              <select
                value={selectedOrgId}
                onChange={e => setSelectedOrgId(e.target.value)}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 7,
                  border: '1px solid var(--border-2)', background: 'var(--bg)',
                  color: 'var(--text-1)', fontSize: 13, outline: 'none',
                }}
              >
                <option value="">{isRu ? 'Выберите организацию' : 'Tashkilotni tanlang'}</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
          ) : null}

          {/* Department Selection */}
          {selectedOrgId && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  {isStudents 
                    ? (isRu ? 'Классы / Группы' : 'Sinflar / Guruhlar') 
                    : (isRu ? 'Отделы / Департаменты' : "Bo'limlar")}
                </span>
                {filteredDepts.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    style={{
                      background: 'transparent', border: 'none',
                      color: 'var(--accent)', fontSize: 11.5, fontWeight: 600,
                      cursor: 'pointer', padding: 0
                    }}
                  >
                    {allVisibleSelected 
                      ? (isRu ? 'Снять все' : 'Barchasini bekor qilish') 
                      : (isRu ? 'Выбрать все' : 'Barchasini tanlash')}
                  </button>
                )}
              </div>

              {/* Search input for departments */}
              {!loadingDepts && depts.length > 0 && (
                <div style={{ position: 'relative', width: '100%', marginBottom: 4 }}>
                  <SearchRegular 
                    fontSize={14} 
                    style={{ 
                      position: 'absolute', 
                      left: 10, 
                      top: '50%', 
                      transform: 'translateY(-50%)', 
                      color: 'var(--text-4)' 
                    }} 
                  />
                  <input
                    type="text"
                    value={deptSearch}
                    onChange={e => setDeptSearch(e.target.value)}
                    placeholder={isStudents 
                      ? (isRu ? 'Поиск классов...' : 'Sinflarni qidirish...') 
                      : (isRu ? 'Поиск отделов...' : 'Bo\'limlarni qidirish...')}
                    style={{
                      width: '100%',
                      padding: '7px 10px 7px 32px',
                      borderRadius: 7,
                      border: '1px solid var(--border-2)',
                      background: 'var(--bg)',
                      color: 'var(--text-1)',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                  {deptSearch && (
                    <button
                      type="button"
                      onClick={() => setDeptSearch('')}
                      style={{
                        position: 'absolute',
                        right: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-3)',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <DismissCircleRegular fontSize={14} style={{ display: 'block' }} />
                    </button>
                  )}
                </div>
              )}

              {loadingDepts ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-4)' }}>
                  <ArrowSyncRegular fontSize={18} style={{ animation: 'spin 1s linear infinite' }} />
                </div>
              ) : depts.length === 0 ? (
                <div style={{ padding: '12px 10px', border: '1px dashed var(--border-2)', borderRadius: 8, background: 'var(--bg)', color: 'var(--text-4)', fontSize: 12.5, textAlign: 'center' }}>
                  {isStudents 
                    ? (isRu ? 'Нет созданных классов / групп' : 'Sinflar / guruhlar yaratilmagan')
                    : (isRu ? 'Нет созданных отделов' : 'Bo\'limlar yaratilmagan')}
                </div>
              ) : filteredDepts.length === 0 ? (
                <div style={{ padding: '12px 10px', border: '1px dashed var(--border-2)', borderRadius: 8, background: 'var(--bg)', color: 'var(--text-4)', fontSize: 12.5, textAlign: 'center' }}>
                  {isRu ? 'Ничего не найдено' : 'Hech narsa topilmadi'}
                </div>
              ) : (
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: 6, maxHeight: 220, overflowY: 'auto',
                  padding: 8, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border-2)',
                }}>
                  {filteredDepts.map(d => {
                    const checked = selectedDeptIds.includes(String(d.id))
                    return (
                      <label key={d.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 10px', borderRadius: 6,
                        background: checked ? 'var(--accent-bg)' : 'transparent',
                        border: `1px solid ${checked ? 'var(--accent-bd)' : 'var(--border-2)'}`,
                        cursor: 'pointer', fontSize: 12.5,
                      }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDept(d.id)}
                          style={{ accentColor: 'var(--accent)' }}
                        />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-1)' }}>
                          {d.name}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button
            type="button"
            disabled={exporting}
            onClick={onClose}
            style={{
              padding: '8px 16px', borderRadius: 8,
              background: 'var(--surface-2)', border: '1px solid var(--border-2)',
              color: 'var(--text-1)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              opacity: exporting ? 0.6 : 1,
            }}
          >
            {isRu ? 'Отмена' : 'Bekor qilish'}
          </button>
          <button
            type="button"
            disabled={exporting || !selectedOrgId || selectedDeptIds.length === 0}
            onClick={handleExport}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', borderRadius: 8,
              background: selectedOrgId && selectedDeptIds.length > 0 ? '#217346' : 'var(--border-2)',
              border: 'none',
              color: selectedOrgId && selectedDeptIds.length > 0 ? '#fff' : 'var(--text-4)',
              fontSize: 13, fontWeight: 600,
              cursor: selectedOrgId && selectedDeptIds.length > 0 && !exporting ? 'pointer' : 'not-allowed',
              opacity: exporting ? 0.8 : 1,
              transition: 'all 0.15s',
            }}
          >
            {exporting ? (
              <>
                <ArrowSyncRegular fontSize={14} style={{ animation: 'spin 1s linear infinite' }} />
                {isRu ? 'Экспорт...' : 'Eksport...'}
              </>
            ) : (
              <>
                <CheckmarkRegular fontSize={14} />
                {isRu ? 'Экспорт' : 'Eksport'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────────────

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
const toolbarStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 14 }
const errBannerStyle = { marginBottom: 20, padding: 14, background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, border: '1px solid var(--red-bd)' }
const inpStyle = {
  padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-2)',
  background: 'var(--bg)', color: 'var(--text-1)', fontSize: 13, outline: 'none',
  height: 36, boxSizing: 'border-box',
}
const tableStyle = { width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }
const thStyle = {
  textAlign: 'left', padding: '10px 12px', fontSize: 11,
  fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase',
  letterSpacing: 0.4, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
}
const tdStyle = { padding: '12px', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }
const emptyStyle = { padding: 24, textAlign: 'center', color: 'var(--text-4)', fontSize: 13, background: 'var(--bg)', borderRadius: 8, border: '1px dashed var(--border-2)' }
const avatarImg = { width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }
const avatarFallback = { width: 36, height: 36, borderRadius: '50%', background: 'var(--surface-2)', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
