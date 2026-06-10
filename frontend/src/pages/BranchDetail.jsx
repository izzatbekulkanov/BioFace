import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MapContainer, TileLayer, Circle, CircleMarker } from 'react-leaflet'
import {
  BuildingRegular,
  ArrowSyncRegular,
  ChevronLeftRegular,
  LocationRegular,
  PersonRegular,
  PeopleRegular,
  CameraRegular,
  ShieldRegular,
  EyeRegular
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import Skeleton from '../components/Skeleton'
import { useToast } from '../components/Toaster'
import 'leaflet/dist/leaflet.css'

// Styling Constants aligned with OrganizationDetail design tokens
const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }
const cardTitleStyle = { fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }
const inpStyle = {
  padding: '8px 10px', borderRadius: 7,
  border: '1px solid var(--border-2)', background: 'var(--bg)',
  color: 'var(--text-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  width: '100%', maxWidth: 220
}

const tableStyle = { width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }
const thStyle = {
  textAlign: 'left', padding: '10px 12px', fontSize: 11,
  fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase',
  letterSpacing: 0.4, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
}
const tableRowStyle = { borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }
const tableCellStyle = { padding: '12px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }

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

const errBannerStyle = { marginBottom: 20, padding: 14, background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, border: '1px solid var(--red-bd)' }
const infoTitleStyle = { fontSize: 11, fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.5 }
const infoValueStyle = { fontSize: 18, fontWeight: 700, color: 'var(--text-1)', marginTop: 4 }

const refreshBtnStyle = (loading) => ({
  display: 'flex', alignItems: 'center', gap: 7,
  padding: '8px 16px', borderRadius: 8,
  background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)',
  color: '#fff', fontSize: 13, fontWeight: 600,
  cursor: loading ? 'not-allowed' : 'pointer',
  opacity: loading ? 0.6 : 1,
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
    padding: '8px 16px', borderRadius: 8,
    background: t.bg, color: t.color,
    border: t.border || 'none',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
    textDecoration: 'none',
  }
}

export default function BranchDetail() {
  const { id: orgId, branchId } = useParams()
  const { t, i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const navigate = useNavigate()
  const toast = useToast()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('employees')
  const [searchQuery, setSearchQuery] = useState('')

  const aliveRef = useRef(true)

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    try {
      const res = await fetch(`/api/organizations/${orgId}/branches/${branchId}`, { credentials: 'include' })
      if (!res.ok) {
        if (res.status === 404) throw new Error(isRu ? 'Филиал не найден' : 'Filial topilmadi')
        throw new Error(`HTTP ${res.status}`)
      }
      const resData = await res.json()
      if (resData.org_uuid && resData.branch?.uuid && (orgId !== resData.org_uuid || branchId !== resData.branch.uuid)) {
        navigate(`/organizations/${resData.org_uuid}/branches/${resData.branch.uuid}`, { replace: true })
        return
      }
      if (aliveRef.current) {
        setData(resData)
        setError('')
      }
    } catch (e) {
      if (aliveRef.current) setError(e.message)
    } finally {
      if (aliveRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [orgId, branchId, isRu, navigate])

  useEffect(() => {
    aliveRef.current = true
    load()
    return () => { aliveRef.current = false }
  }, [load])

  const branch = data?.branch
  const devices = data?.devices || []
  const employeesAll = data?.employees || []
  const users = data?.users || []

  const [togglingCamId, setTogglingCamId] = useState(null)

  const handleToggleCameraBranch = async (camId, currentBranchId) => {
    setTogglingCamId(camId)
    const assignToThis = currentBranchId !== branch?.id
    const targetBranchId = assignToThis ? branch?.id : 0

    try {
      const res = await fetch(`/api/cameras/${camId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          branch_id: targetBranchId
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData?.detail || `HTTP ${res.status}`)
      }

      toast.success(
        assignToThis
          ? (isRu ? 'Камера успешно привязана к этому филиалу' : 'Kamera ushbu filialga muvaffaqiyatli biriktirildi')
          : (isRu ? 'Камера успешно отвязана от филиала' : 'Kamera filialdan ajratildi')
      )
      await load({ silent: true })
    } catch (e) {
      toast.error(e.message)
    } finally {
      setTogglingCamId(null)
    }
  }

  // Split employees into staff and students
  const staff = employeesAll.filter(e => !['oquvchi', 'student', 'talaba'].includes(e.employee_type?.toLowerCase()))
  const students = employeesAll.filter(e => ['oquvchi', 'student', 'talaba'].includes(e.employee_type?.toLowerCase()))

  // Tab configurations
  const tabs = [
    { id: 'employees', label: isRu ? 'Сотрудники' : 'Xodimlar', count: staff.length, icon: PersonRegular },
    { id: 'students', label: isRu ? 'Студенты' : 'Talabalar', count: students.length, icon: PeopleRegular },
    { id: 'cameras', label: isRu ? 'Камеры' : 'Kameralar', count: devices.filter(d => d.branch_id === branch?.id).length, icon: CameraRegular },
    { id: 'users', label: isRu ? 'Пользователи' : 'Foydalanuvchilar', count: users.length, icon: ShieldRegular },
  ]

  // Filter lists based on tab and search query
  const getFilteredItems = () => {
    const q = searchQuery.toLowerCase().trim()
    if (activeTab === 'employees') {
      return staff.filter(e => 
        `${e.first_name} ${e.last_name} ${e.middle_name || ''}`.toLowerCase().includes(q) ||
        (e.personal_id || '').toLowerCase().includes(q)
      )
    }
    if (activeTab === 'students') {
      return students.filter(e => 
        `${e.first_name} ${e.last_name} ${e.middle_name || ''}`.toLowerCase().includes(q) ||
        (e.personal_id || '').toLowerCase().includes(q)
      )
    }
    if (activeTab === 'cameras') {
      return devices.filter(d => 
        (d.name || '').toLowerCase().includes(q) ||
        (d.mac_address || '').toLowerCase().includes(q) ||
        (d.isup_device_id || '').toLowerCase().includes(q)
      )
    }
    if (activeTab === 'users') {
      return users.filter(u => 
        `${u.first_name || ''} ${u.last_name || ''} ${u.name}`.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      )
    }
    return []
  }

  const filteredItems = getFilteredItems()

  const tabButtonStyle = (isActive) => ({
    padding: '8px 16px',
    borderRadius: 8,
    background: isActive ? 'var(--surface-3)' : 'transparent',
    border: 'none',
    color: isActive ? 'var(--accent)' : 'var(--text-3)',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    transition: 'all 0.15s ease',
  })

  if (error) {
    return (
      <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)' }}>
        <PageHero
          badge={isRu ? 'Организация' : 'Tashkilot'}
          title={isRu ? 'Ошибка' : 'Xatolik'}
          sub={isRu ? 'Не удалось загрузить данные филиала' : 'Filial ma\'lumotlarini yuklab bo\'lmadi'}
          right={
            <button
              onClick={() => navigate(`/organizations/${orgId}`)}
              style={smallBtn('subtle')}
            >
              <ChevronLeftRegular fontSize={16} />
              {isRu ? 'Назад к организации' : 'Tashkilotga qaytish'}
            </button>
          }
        />
        <div className="branch-detail-container">
          <div style={errBannerStyle}>{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <style>{`
        .branch-detail-container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 24px 32px 80px;
          box-sizing: border-box;
        }
        .branch-detail-grid {
          display: grid;
          grid-template-columns: 380px 1fr;
          gap: 24px;
          margin-bottom: 24px;
        }
        @media (max-width: 900px) {
          .branch-detail-container {
            padding: 16px 16px 60px;
          }
          .branch-detail-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
        }
      `}</style>

      <PageHero
        badge={
          loading ? (
            <Skeleton width={80} height={12} style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 100%)' }} />
          ) : (
            branch?.organization_name || (isRu ? 'Организация' : 'Tashkilot')
          )
        }
        title={
          loading ? (
            <Skeleton width={200} height={22} style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 100%)' }} />
          ) : (
            branch?.name
          )
        }
        sub={
          loading ? (
            <Skeleton width={180} height={14} style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 100%)' }} />
          ) : (
            branch?.address || (isRu ? 'Просмотр ресурсов филиала' : 'Filial resurslarini ko\'rish')
          )
        }
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => navigate(`/organizations/${orgId}`)}
              style={smallBtn('subtle')}
            >
              <ChevronLeftRegular fontSize={16} />
              {isRu ? 'Назад' : 'Orqaga'}
            </button>
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

      <div className="branch-detail-container">
        {loading ? (
          <div className="branch-detail-grid">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={cardStyle}>
                <Skeleton width={120} height={14} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
                  <Skeleton width="100%" height={34} />
                  <Skeleton width="100%" height={34} />
                  <Skeleton width="100%" height={34} />
                </div>
              </div>
              <div style={{ ...cardStyle, height: 320 }} />
            </div>
            <div style={cardStyle}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                <Skeleton width={80} height={32} />
                <Skeleton width={80} height={32} />
                <Skeleton width={80} height={32} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Skeleton width="100%" height={40} />
                <Skeleton width="100%" height={40} />
                <Skeleton width="100%" height={40} />
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Info row */}
            <div style={{ ...cardStyle, marginBottom: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
              <div>
                <div style={infoTitleStyle}>{isRu ? 'Сотрудники' : 'Xodimlar soni'}</div>
                <div style={infoValueStyle}>
                  {staff.length}
                </div>
              </div>
              <div>
                <div style={infoTitleStyle}>{isRu ? 'Студенты' : 'Talabalar soni'}</div>
                <div style={infoValueStyle}>
                  {students.length}
                </div>
              </div>
              <div>
                <div style={infoTitleStyle}>{isRu ? 'Камеры' : 'Kameralar soni'}</div>
                <div style={infoValueStyle}>
                  {devices.filter(d => d.branch_id === branch?.id).length}
                </div>
              </div>
              <div>
                <div style={infoTitleStyle}>{isRu ? 'Пользователи' : 'Foydalanuvchilar'}</div>
                <div style={infoValueStyle}>
                  {users.length}
                </div>
              </div>
            </div>

            <div className="branch-detail-grid">
              {/* Left Column: Branch Details & Map */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={cardStyle}>
                  <h3 style={cardTitleStyle}>
                    <BuildingRegular style={{ color: 'var(--accent)' }} />
                    {isRu ? 'Информация о филиале' : 'Filial ma\'lumotlari'}
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border-2)', paddingBottom: 10 }}>
                      <span style={{ width: 110, fontSize: 13, color: 'var(--text-4)', fontWeight: 500 }}>{isRu ? 'Название:' : 'Nomi:'}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 600 }}>{branch?.name}</span>
                    </div>
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border-2)', paddingBottom: 10 }}>
                      <span style={{ width: 110, fontSize: 13, color: 'var(--text-4)', fontWeight: 500 }}>{isRu ? 'Адрес:' : 'Manzil:'}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <LocationRegular fontSize={14} style={{ color: 'var(--text-3)' }} />
                        {branch?.address || '—'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border-2)', paddingBottom: 10 }}>
                      <span style={{ width: 110, fontSize: 13, color: 'var(--text-4)', fontWeight: 500 }}>{isRu ? 'Радиус:' : 'Radiusi:'}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 600 }}>{`${branch?.radius || 100} m`}</span>
                    </div>
                    <div style={{ display: 'flex', paddingBottom: 2 }}>
                      <span style={{ width: 110, fontSize: 13, color: 'var(--text-4)', fontWeight: 500 }}>{isRu ? 'Координаты:' : 'Koordinatalar:'}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 600 }}>
                        {branch?.latitude && branch?.longitude ? `${branch.latitude.toFixed(6)}, ${branch.longitude.toFixed(6)}` : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Read-only GPS Map */}
                {branch?.latitude && branch?.longitude && (
                  <div style={{ ...cardStyle, padding: 4, overflow: 'hidden', height: 320 }}>
                    <MapContainer
                      center={[parseFloat(branch.latitude), parseFloat(branch.longitude)]}
                      zoom={17}
                      style={{ width: '100%', height: '100%', borderRadius: 10 }}
                      zoomControl={true}
                      scrollWheelZoom={false}
                    >
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      />
                      <CircleMarker
                        center={[parseFloat(branch.latitude), parseFloat(branch.longitude)]}
                        radius={6}
                        pathOptions={{ color: '#ffffff', fillColor: '#4f46e5', fillOpacity: 1, weight: 2 }}
                      />
                      <Circle
                        center={[parseFloat(branch.latitude), parseFloat(branch.longitude)]}
                        radius={parseFloat(branch.radius) || 100}
                        pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.12, weight: 1.5, dashArray: '4, 4' }}
                      />
                    </MapContainer>
                  </div>
                )}
              </div>

              {/* Right Column: Tabbed Resource Views */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Tab Header Controls */}
                <div style={{ ...cardStyle, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {tabs.map(t => {
                      const Icon = t.icon
                      return (
                        <button
                          key={t.id}
                          onClick={() => { setActiveTab(t.id); setSearchQuery('') }}
                          style={tabButtonStyle(activeTab === t.id)}
                        >
                          <Icon fontSize={15} />
                          {t.label}
                          <span style={{
                            padding: '2px 7px', borderRadius: 6,
                            background: activeTab === t.id ? 'var(--accent)' : 'var(--border-2)',
                            color: activeTab === t.id ? '#ffffff' : 'var(--text-3)',
                            fontSize: 10.5, fontWeight: 700
                          }}>
                            {t.count}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Tab Filter Search bar */}
                  <input
                    type="text"
                    placeholder={isRu ? 'Поиск...' : 'Qidirish...'}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={inpStyle}
                  />
                </div>

                {/* List Content Table Card */}
                <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                  {filteredItems.length === 0 ? (
                    <div style={emptyStyle}>
                      {isRu ? 'Ничего не найдено' : 'Hech narsa topilmadi'}
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={tableStyle}>
                        <thead>
                          <tr>
                            {activeTab === 'employees' && [
                              isRu ? 'ФИО сотрудника' : 'Xodim F.I.Sh',
                              'Personal ID',
                              isRu ? 'Bo\'lim' : 'Bo\'lim',
                              isRu ? 'Lavozim' : 'Lavozim',
                              isRu ? 'Telefon' : 'Telefon',
                              ''
                            ].map((h, i) => <th key={i} style={thStyle}>{h}</th>)}

                            {activeTab === 'students' && [
                              isRu ? 'ФИО студента' : 'Talaba F.I.Sh',
                              'Personal ID',
                              isRu ? 'Sinf / Bo\'lim' : 'Sinf / Bo\'lim',
                              isRu ? 'Telefon' : 'Telefon',
                              ''
                            ].map((h, i) => <th key={i} style={thStyle}>{h}</th>)}

                            {activeTab === 'cameras' && [
                              isRu ? 'Название камеры' : 'Kamera nomi',
                              'Mac-Address',
                              'ISUP ID',
                              isRu ? 'Статус' : 'Holat',
                              isRu ? 'Филиал' : 'Filial',
                              ''
                            ].map((h, i) => <th key={i} style={thStyle}>{h}</th>)}

                            {activeTab === 'users' && [
                              isRu ? 'Имя пользователя' : 'Foydalanuvchi nomi',
                              'Email',
                              isRu ? 'Роль' : 'Roli',
                              isRu ? 'Статус' : 'Holat',
                              ''
                            ].map((h, i) => <th key={i} style={thStyle}>{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {activeTab === 'employees' && filteredItems.map(e => (
                            <tr key={e.id} style={tableRowStyle}>
                              <td style={{ ...tableCellStyle, fontWeight: 600 }}>
                                <Link to={`/employees/${e.id}`} style={{ color: 'var(--text-1)', textDecoration: 'none' }}>
                                  {e.last_name} {e.first_name} {e.middle_name || ''}
                                </Link>
                              </td>
                              <td style={tableCellStyle}>{e.personal_id || '—'}</td>
                              <td style={tableCellStyle}>{e.department || '—'}</td>
                              <td style={tableCellStyle}>{e.position || '—'}</td>
                              <td style={tableCellStyle}>{e.phone || '—'}</td>
                              <td style={{ ...tableCellStyle, textAlign: 'right' }}>
                                <Link to={`/employees/${e.id}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                                  <EyeRegular fontSize={16} />
                                </Link>
                              </td>
                            </tr>
                          ))}

                          {activeTab === 'students' && filteredItems.map(e => (
                            <tr key={e.id} style={tableRowStyle}>
                              <td style={{ ...tableCellStyle, fontWeight: 600 }}>
                                <Link to={`/employees/${e.id}`} style={{ color: 'var(--text-1)', textDecoration: 'none' }}>
                                  {e.last_name} {e.first_name} {e.middle_name || ''}
                                </Link>
                              </td>
                              <td style={tableCellStyle}>{e.personal_id || '—'}</td>
                              <td style={tableCellStyle}>{e.department || '—'}</td>
                              <td style={tableCellStyle}>{e.phone || '—'}</td>
                              <td style={{ ...tableCellStyle, textAlign: 'right' }}>
                                <Link to={`/employees/${e.id}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                                  <EyeRegular fontSize={16} />
                                </Link>
                              </td>
                            </tr>
                          ))}

                          {activeTab === 'cameras' && filteredItems.map(d => {
                            const isCurrentBranch = d.branch_id === branch?.id
                            return (
                              <tr key={d.id} style={tableRowStyle}>
                                <td style={{ ...tableCellStyle, fontWeight: 600 }}>
                                  <Link to={`/devices/${d.id}`} style={{ color: 'var(--text-1)', textDecoration: 'none' }}>
                                    {d.name}
                                  </Link>
                                </td>
                                <td style={tableCellStyle}>{d.mac_address}</td>
                                <td style={tableCellStyle}>{d.isup_device_id || '—'}</td>
                                <td style={tableCellStyle}>
                                  <span style={{
                                    padding: '3px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 700,
                                    background: d.is_online ? 'rgba(16,124,16,0.1)' : 'rgba(244,63,94,0.1)',
                                    color: d.is_online ? '#107c10' : '#f43f5e'
                                  }}>
                                    {d.is_online ? (isRu ? 'Онлайн' : 'Onlayn') : (isRu ? 'Оффлайн' : 'Oflayn')}
                                  </span>
                                </td>
                                <td style={tableCellStyle}>
                                  {isCurrentBranch ? (
                                    <span style={{
                                      padding: '3px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 700,
                                      background: 'rgba(16,124,16,0.1)', color: '#107c10'
                                    }}>
                                      {isRu ? 'В этом филиале' : 'Shu filialda'}
                                    </span>
                                  ) : d.branch_id ? (
                                    <span style={{
                                      padding: '3px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 700,
                                      background: 'rgba(255,193,7,0.1)', color: '#b78103'
                                    }}>
                                      {d.branch_name}
                                    </span>
                                  ) : (
                                    <span style={{
                                      padding: '3px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 700,
                                      background: 'var(--surface-3)', color: 'var(--text-3)'
                                    }}>
                                      {isRu ? 'Не привязан' : 'Biriktirilmagan'}
                                    </span>
                                  )}
                                </td>
                                <td style={{ ...tableCellStyle, textAlign: 'right' }}>
                                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                                    {isCurrentBranch ? (
                                      <button
                                        onClick={() => handleToggleCameraBranch(d.id, d.branch_id)}
                                        disabled={togglingCamId !== null}
                                        style={{
                                          ...smallBtn('danger'),
                                          padding: '5px 10px',
                                          fontSize: 12,
                                          opacity: togglingCamId !== null ? 0.6 : 1,
                                          cursor: togglingCamId !== null ? 'not-allowed' : 'pointer'
                                        }}
                                      >
                                        {togglingCamId === d.id ? '...' : (isRu ? 'Убрать' : 'Ajratish')}
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => handleToggleCameraBranch(d.id, d.branch_id)}
                                        disabled={togglingCamId !== null}
                                        style={{
                                          ...smallBtn('accent'),
                                          padding: '5px 10px',
                                          fontSize: 12,
                                          opacity: togglingCamId !== null ? 0.6 : 1,
                                          cursor: togglingCamId !== null ? 'not-allowed' : 'pointer'
                                        }}
                                      >
                                        {togglingCamId === d.id ? '...' : (isRu ? "Добавить" : "Qo'shish")}
                                      </button>
                                    )}
                                    <Link to={`/devices/${d.id}`} style={{ color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                                      <EyeRegular fontSize={16} />
                                    </Link>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}

                          {activeTab === 'users' && filteredItems.map(u => (
                            <tr key={u.id} style={tableRowStyle}>
                              <td style={{ ...tableCellStyle, fontWeight: 600 }}>
                                <Link to={`/users/${u.id}/edit`} style={{ color: 'var(--text-1)', textDecoration: 'none' }}>
                                  {u.last_name || ''} {u.first_name || ''} ({u.name})
                                </Link>
                              </td>
                              <td style={tableCellStyle}>{u.email}</td>
                              <td style={tableCellStyle}>
                                <span style={{
                                  padding: '2px 7px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                  background: 'var(--surface-3)', color: 'var(--text-2)'
                                }}>
                                  {u.role}
                                </span>
                              </td>
                              <td style={tableCellStyle}>
                                <span style={{
                                  padding: '3px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 700,
                                  background: u.status === 'active' ? 'rgba(16,124,16,0.1)' : 'rgba(244,63,94,0.1)',
                                  color: u.status === 'active' ? '#107c10' : '#f43f5e'
                                }}>
                                  {u.status === 'active' ? (isRu ? 'Актив' : 'Faol') : (isRu ? 'Блок' : 'Bloklangan')}
                                </span>
                              </td>
                              <td style={{ ...tableCellStyle, textAlign: 'right' }}>
                                <Link to={`/users/${u.id}/edit`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                                  <EyeRegular fontSize={16} />
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
