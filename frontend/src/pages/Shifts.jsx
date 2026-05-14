import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  CalendarClockRegular, CalendarLtrRegular, BuildingRegular,
  PeopleRegular, PulseSquareRegular, FilterRegular,
  ArrowSyncRegular, DocumentCopyRegular, SearchRegular,
  CheckmarkSquareRegular, DeleteRegular, EditRegular, AddRegular
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import CustomSelect from '../components/CustomSelect'
import { useConfirm } from '../components/ConfirmDialog'

export default function Shifts() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const isRu = i18n.language === 'ru'

  // --- States ---
  const [loading, setLoading] = useState(true)
  const [filterOptions, setFilterOptions] = useState({ organizations: [], departments: [], positions: [] })
  
  // Table
  const [employees, setEmployees] = useState([])
  const [stats, setStats] = useState({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  
  // Filters
  const [search, setSearch] = useState('')
  const [orgFilter, setOrgFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  
  // Schedule Manager
  const [scheduleOrg, setScheduleOrg] = useState('')
  const [schedules, setSchedules] = useState([])
  const [scheduleLoading, setScheduleLoading] = useState(false)

  // Holidays
  const [holidayOrg, setHolidayOrg] = useState('global')
  const [holidays, setHolidays] = useState([])
  const [holidayLoading, setHolidayLoading] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())

  // Initial Load
  useEffect(() => {
    fetch('/api/employees/filter-options')
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setFilterOptions(data)
          if (data.organizations?.length > 0) {
            setScheduleOrg(data.organizations[0].id.toString())
          }
        }
      })
      .catch(console.error)
  }, [])

  // Load Employees
  const loadEmployees = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('page', page)
      params.append('page_size', pageSize)
      if (search) params.append('query', search)
      if (orgFilter) params.append('organization_id', orgFilter)
      if (deptFilter) params.append('department', deptFilter)
      if (typeFilter) params.append('employee_type', typeFilter)
      
      const res = await fetch(`/api/employees/search?${params.toString()}`)
      const data = await res.json()
      if (data.ok) {
        setEmployees(data.items || [])
        setStats(data.stats || {})
        setTotalPages(data.total_pages || 1)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, orgFilter, deptFilter, typeFilter])

  useEffect(() => { loadEmployees() }, [loadEmployees])

  // Load Schedules
  const loadSchedules = useCallback(async () => {
    if (!scheduleOrg) return
    setScheduleLoading(true)
    try {
      const res = await fetch(`/api/organizations/${scheduleOrg}/schedules`)
      const data = await res.json()
      if (data.ok) setSchedules(data.items || [])
    } catch (e) {
      console.error(e)
    } finally {
      setScheduleLoading(false)
    }
  }, [scheduleOrg])

  useEffect(() => { loadSchedules() }, [loadSchedules])

  // Load Holidays
  const loadHolidays = useCallback(async () => {
    setHolidayLoading(true)
    try {
      const y = currentDate.getFullYear()
      const m = currentDate.getMonth() + 1
      const params = new URLSearchParams()
      params.append('year', y)
      params.append('month', m.toString().padStart(2, '0'))
      if (holidayOrg !== 'global') params.append('organization_id', holidayOrg)

      const res = await fetch(`/api/holidays?${params.toString()}`)
      const data = await res.json()
      if (data.ok) setHolidays(data.items || [])
    } catch (e) {
      console.error(e)
    } finally {
      setHolidayLoading(false)
    }
  }, [currentDate, holidayOrg])

  useEffect(() => { loadHolidays() }, [loadHolidays])

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={`✦ ${isRu ? 'Система' : 'Tizim'}`}
        title={isRu ? 'Смены' : 'Smenalar'}
        sub={isRu ? 'Персональные и организационные графики сотрудников и учащихся.' : 'Hodim va o\'quvchilarning shaxsiy, tayyor va tashkilot smenalari nazorati.'}
      />

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 32px 80px' }}>
        
        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <PeopleRegular /> {isRu ? 'Всего профилей' : 'Jami profillar'}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.total_employees || 0}</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <BuildingRegular /> {isRu ? 'Организации' : 'Tashkilotlar'}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.organization_count || 0}</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CalendarLtrRegular /> {isRu ? 'Выходные' : 'Dam olish kunlari'}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{holidays.length || 0}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24, marginBottom: 24 }}>
          {/* Schedule Manager */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', borderTopLeftRadius: 12, borderTopRightRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{isRu ? 'Управление сменами' : 'Smenalar boshqaruvi'}</h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-4)' }}>{isRu ? 'Графики организации' : 'Tashkilot grafiki'}</p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ width: 140 }}>
                  <CustomSelect 
                    value={scheduleOrg}
                    onChange={setScheduleOrg}
                    options={filterOptions.organizations.map(o => ({ label: o.name, value: o.id.toString() }))}
                    placeholder={isRu ? 'Организация' : 'Tashkilot'}
                  />
                </div>
                <button style={{ background: 'var(--accent)', border: 'none', color: '#fff', padding: '0 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AddRegular />
                </button>
              </div>
            </div>
            <div style={{ padding: 20, flex: 1, overflowY: 'auto', minHeight: 200 }}>
              {scheduleLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-4)' }}><ArrowSyncRegular style={{ animation: 'spin 1s linear infinite', fontSize: 24 }} /></div>
              ) : schedules.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-4)' }}>{isRu ? 'Смены не найдены' : 'Smenalar topilmadi'}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {schedules.map(sch => (
                    <div key={sch.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{sch.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-4)' }}>{sch.start_time} - {sch.end_time} • {sch.is_flexible ? 'Erkin' : 'Qat\'iy'}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                         <button style={{ background: 'var(--surface)', border: '1px solid var(--border-3)', color: 'var(--text-1)', padding: 6, borderRadius: 6, cursor: 'pointer' }}><EditRegular /></button>
                         <button style={{ background: 'var(--red-bg)', border: '1px solid var(--red-bd)', color: 'var(--red)', padding: 6, borderRadius: 6, cursor: 'pointer' }}><DeleteRegular /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Holiday Manager */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', borderTopLeftRadius: 12, borderTopRightRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{isRu ? 'Праздники и выходные' : 'Dam olish kunlari'}</h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-4)' }}>{currentDate.getFullYear()}-{String(currentDate.getMonth()+1).padStart(2, '0')}</p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ width: 140 }}>
                  <CustomSelect 
                    value={holidayOrg}
                    onChange={setHolidayOrg}
                    options={[
                      { label: isRu ? 'Глобально' : 'Global bayramlar', value: 'global' },
                      ...filterOptions.organizations.map(o => ({ label: o.name, value: o.id.toString() }))
                    ]}
                  />
                </div>
                <button style={{ background: 'var(--red)', border: 'none', color: '#fff', padding: '0 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AddRegular />
                </button>
              </div>
            </div>
            <div style={{ padding: 20, flex: 1, overflowY: 'auto', minHeight: 200 }}>
              {holidayLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-4)' }}><ArrowSyncRegular style={{ animation: 'spin 1s linear infinite', fontSize: 24 }} /></div>
              ) : holidays.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-4)' }}>{isRu ? 'Записей нет' : 'Yozuvlar yo\'q'}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {holidays.map(h => (
                    <div key={h.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 8, background: h.is_weekend ? 'var(--yellow-bg)' : 'var(--red-bg)', color: h.is_weekend ? 'var(--yellow)' : 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CalendarLtrRegular />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{h.title}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-4)' }}>{h.date} • {h.is_weekend ? (isRu ? 'Выходной' : 'Dam olish') : (isRu ? 'Праздник' : 'Bayram')}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                         <button style={{ background: 'var(--surface)', border: '1px solid var(--border-3)', color: 'var(--text-1)', padding: 6, borderRadius: 6, cursor: 'pointer' }}><EditRegular /></button>
                         <button style={{ background: 'var(--red-bg)', border: '1px solid var(--red-bd)', color: 'var(--red)', padding: 6, borderRadius: 6, cursor: 'pointer' }}><DeleteRegular /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Employee Table */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
           <div style={{ padding: 16, borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 12, background: 'var(--surface-2)', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
              <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', background: 'var(--bg)', border: '1px solid var(--border-2)', borderRadius: 8, padding: '0 12px' }}>
                <SearchRegular style={{ color: 'var(--text-4)' }} />
                <input 
                  type="text" 
                  placeholder={isRu ? 'Поиск: ФИО или ID' : 'Qidiruv: F.I.Sh. yoki ID'}
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'var(--text-1)', outline: 'none', fontSize: 13 }} 
                />
              </div>
              <div style={{ width: 180 }}>
                 <CustomSelect 
                    value={orgFilter}
                    onChange={v => { setOrgFilter(v); setPage(1); }}
                    options={[{label: isRu ? 'Все организации' : 'Barcha tashkilotlar', value: ''}, ...filterOptions.organizations.map(o => ({ label: o.name, value: o.id.toString() }))]}
                    placeholder={isRu ? 'Организация' : 'Tashkilot'}
                 />
              </div>
              <div style={{ width: 140 }}>
                 <CustomSelect 
                    value={typeFilter}
                    onChange={v => { setTypeFilter(v); setPage(1); }}
                    options={[{label: 'Tur: Barchasi', value: ''}, {label: 'Hodim', value: 'hodim'}, {label: 'O\'qituvchi', value: 'oqituvchi'}, {label: 'O\'quvchi', value: 'oquvchi'}]}
                    placeholder="Tur"
                 />
              </div>
           </div>
           
           <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                 <thead>
                   <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                     <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-4)', fontWeight: 600, width: 40 }}><CheckmarkSquareRegular /></th>
                     <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-4)', fontWeight: 600 }}>{isRu ? 'Пользователь' : 'Foydalanuvchi'}</th>
                     <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-4)', fontWeight: 600 }}>{isRu ? 'Организация' : 'Tashkilot'}</th>
                     <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-4)', fontWeight: 600 }}>{isRu ? 'Тип' : 'Tur'}</th>
                     <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-4)', fontWeight: 600 }}>{isRu ? 'Смена' : 'Smena'}</th>
                   </tr>
                 </thead>
                 <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          {Array.from({ length: 5 }).map((_, j) => (
                            <td key={j} style={{ padding: '12px 16px' }}>
                              <div style={{ height: 16, background: 'var(--surface-2)', borderRadius: 4, width: '60%', animation: 'pulse 1.5s infinite ease-in-out' }} />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : employees.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text-4)' }}>{isRu ? 'Нет данных' : 'Ma\'lumot yo\'q'}</td>
                      </tr>
                    ) : (
                      employees.map(emp => (
                        <tr key={emp.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                           <td style={{ padding: '12px 16px' }}><input type="checkbox" style={{ cursor: 'pointer' }} /></td>
                           <td style={{ padding: '12px 16px' }}>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{emp.first_name} {emp.last_name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-4)' }}>ID: {emp.personal_id || '-'}</div>
                           </td>
                           <td style={{ padding: '12px 16px', fontSize: 13 }}>{emp.organization_name || '-'}</td>
                           <td style={{ padding: '12px 16px', fontSize: 13 }}>{emp.employee_type_label || '-'}</td>
                           <td style={{ padding: '12px 16px', fontSize: 13 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ background: 'var(--surface-2)', padding: '4px 8px', borderRadius: 6, fontWeight: 600, fontSize: 12, color: 'var(--text-1)' }}>
                                   {emp.schedule_name || 'Tashkilot Default'}
                                </div>
                              </div>
                           </td>
                        </tr>
                      ))
                    )}
                 </tbody>
              </table>
           </div>
           
           {/* Pagination */}
           {totalPages > 1 && (
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg)', borderTop: '1px solid var(--border)', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
                <div style={{ fontSize: 13, color: 'var(--text-4)' }}>
                  {isRu ? `Страница ${page} из ${totalPages}` : `Sahifa ${page} / ${totalPages}`}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '6px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: page === 1 ? 'var(--text-4)' : 'var(--text-1)', cursor: page === 1 ? 'not-allowed' : 'pointer' }}>
                    {isRu ? 'Назад' : 'Orqaga'}
                  </button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '6px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: page === totalPages ? 'var(--text-4)' : 'var(--text-1)', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}>
                    {isRu ? 'Далее' : 'Oldinga'}
                  </button>
                </div>
             </div>
           )}
        </div>

      </div>
    </div>
  )
}
