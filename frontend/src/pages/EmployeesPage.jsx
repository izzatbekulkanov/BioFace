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
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import Skeleton from '../components/Skeleton'
import { useToast } from '../components/Toaster'

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

  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [totalPages, setTotalPages] = useState(0)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const aliveRef = useRef(true)

  // Delete dialog state
  const [deleting, setDeleting] = useState(null)   // employee object or null

  // Debounce qidiruv (350ms)
  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(h)
  }, [search])

  // Mode o'zgarsa — sahifani 1 ga qaytaramiz
  useEffect(() => {
    setPage(1)
    setSearch('')
    setDebouncedSearch('')
    setInitialLoading(true)
  }, [mode])

  // Search yoki page_size o'zgarsa, sahifani 1 ga
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, pageSize])

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setRefreshing(true)
    try {
      const params = new URLSearchParams({
        employee_type: mode,
        page: String(page),
        page_size: String(pageSize),
      })
      if (debouncedSearch) params.set('search', debouncedSearch)

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
  }, [mode, page, pageSize, debouncedSearch, isRu])

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

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={isRu ? `✦ ${titleRu}` : `✦ ${titleUz}`}
        title={isRu ? titleRu : titleUz}
        sub={isStudents
          ? (isRu ? 'Учащиеся школ, студенты колледжей' : "Maktab o'quvchilari, kollej talabalari")
          : (isRu ? 'Сотрудники и преподаватели' : "Hodimlar va o'qituvchilar")}
        right={
          <div style={{ display: 'flex', gap: 8 }}>
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

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 32px 80px' }}>
        {error && <div style={errBannerStyle}>{error}</div>}

        <div style={cardStyle}>
          <div style={toolbarStyle}>
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
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={isRu ? 'Поиск по ФИО, ID, отделу' : "F.I.SH, ID, bo'lim bo'yicha qidiruv"}
                style={{ minWidth: 240, ...inpStyle }}
              />
              <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} style={inpStyle}>
                {[20, 50, 100, 200].map(n => (
                  <option key={n} value={n}>{n} {isRu ? '/ стр.' : '/ sahifa'}</option>
                ))}
              </select>
            </div>
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
                      {[
                        isRu ? 'ФИО' : 'F.I.SH',
                        isRu ? 'Личный ID' : 'Shaxsiy ID',
                        isStudents
                          ? (isRu ? 'Класс / группа' : 'Sinf / guruh')
                          : (isRu ? 'Отдел / должность' : "Bo'lim / lavozim"),
                        isRu ? 'Организация' : 'Tashkilot',
                        isRu ? 'График' : 'Smena',
                        isRu ? 'Статус' : 'Holat',
                        '',
                      ].map((h, i) => <th key={i} style={thStyle}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(emp => (
                      <tr key={emp.id}>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => navigate(`/employees/${emp.id}`)}>
                            {emp.avatar
                              ? <img src={emp.avatar} alt="" style={avatarImg} onError={e => { e.target.style.display = 'none' }} />
                              : <div style={avatarFallback}><PersonRegular fontSize={18} /></div>}
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-1)' }}>{emp.full_name || `#${emp.id}`}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-4)' }}>
                                {emp.employee_type
                                  ? <TypePill type={emp.employee_type} />
                                  : <span>ID: {emp.id}</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <code style={{ fontSize: 12, color: 'var(--text-1)' }}>{emp.personal_id || '—'}</code>
                        </td>
                        <td style={tdStyle}>
                          <div>{emp.department || <span style={{ color: 'var(--text-4)' }}>—</span>}</div>
                          {emp.position && <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>{emp.position}</div>}
                        </td>
                        <td style={tdStyle}>
                          {emp.organization_name || <span style={{ color: 'var(--text-4)' }}>—</span>}
                        </td>
                        <td style={tdStyle}>
                          {(emp.effective_start_time || emp.effective_end_time) ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                              <ClockRegular fontSize={12} style={{ color: 'var(--text-4)' }} />
                              {emp.effective_start_time || '—'} – {emp.effective_end_time || '—'}
                            </div>
                          ) : <span style={{ color: 'var(--text-4)' }}>—</span>}
                          {emp.schedule_name && (
                            <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>{emp.schedule_name}</div>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <AccessPill status={emp.status} isRu={isRu} />
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => navigate(`/employees/${emp.id}`)}
                              style={iconBtn('subtle')}
                              title={isRu ? 'Просмотр' : "Ko'rish"}
                            >
                              <EyeRegular fontSize={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate(`/employees/${emp.id}/edit`)}
                              style={iconBtn('subtle')}
                              title={isRu ? 'Редактировать' : 'Tahrirlash'}
                            >
                              <EditRegular fontSize={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleting(emp)}
                              style={iconBtn('danger')}
                              title={isRu ? 'Удалить' : "O'chirish"}
                            >
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
      const res = await fetch(`/api/employees/${employee.id}?${params}`, {
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
    <div style={{
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
