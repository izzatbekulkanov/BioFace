import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useTheme } from 'next-themes'
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { Button } from '@fluentui/react-components'
import { ArrowClockwiseRegular, PeopleRegular, DismissRegular } from '@fluentui/react-icons'

const createPulseIcon = (color = '#10b981') => {
  return L.divIcon({
    className: 'custom-neon-icon',
    html: `
      <div class="neon-pulse-marker" style="--marker-color: ${color}">
        <div class="neon-ring"></div>
        <div class="neon-ring-2"></div>
        <div class="neon-core"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  })
}
const createEmployeeMarkerIcon = (emp) => {
  const imageUrl = emp.image_url 
    ? (emp.image_url.startsWith('http') ? emp.image_url : emp.image_url) 
    : null
  
  const borderColor = emp.is_online ? '#10b981' : '#9ca3af' // Green if online, grey if offline
  const glowShadow = emp.is_online 
    ? '0 0 12px #10b981, 0 0 24px rgba(16, 185, 129, 0.5)' 
    : 'none'
  
  const innerHtml = imageUrl 
    ? `<img src="${imageUrl}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2.5px solid ${borderColor}; box-shadow: ${glowShadow}; display: block;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />` +
      `<div style="display: none; width: 40px; height: 40px; border-radius: 50%; border: 2.5px solid ${borderColor}; box-shadow: ${glowShadow}; background: var(--surface-2, #242424); color: var(--text-1, #ffffff); align-items: center; justify-content: center; font-size: 13px; font-weight: 700; text-transform: uppercase;">${(emp.first_name || '').charAt(0)}${(emp.last_name || '').charAt(0)}</div>`
    : `<div style="width: 40px; height: 40px; border-radius: 50%; border: 2.5px solid ${borderColor}; box-shadow: ${glowShadow}; background: var(--surface-2, #242424); color: var(--text-1, #ffffff); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; text-transform: uppercase;">${(emp.first_name || '').charAt(0)}${(emp.last_name || '').charAt(0)}</div>`

  return L.divIcon({
    className: 'custom-employee-marker-icon',
    html: `
      <div style="position: relative; width: 46px; height: 46px; display: flex; align-items: center; justify-content: center;">
        ${innerHtml}
        ${emp.is_online ? `
          <div style="
            position: absolute; bottom: 1px; right: 1px;
            width: 11px; height: 11px; border-radius: 50%;
            background: #10b981; border: 1.5px solid var(--surface-1, #141414);
            box-shadow: 0 0 5px #10b981;
          "></div>
        ` : ''}
      </div>
    `,
    iconSize: [46, 46],
    iconAnchor: [23, 23]
  })
}

function MapController({ selectedCoords }) {
  const map = useMap()
  useEffect(() => {
    if (selectedCoords && selectedCoords.latitude && selectedCoords.longitude) {
      map.setView([selectedCoords.latitude, selectedCoords.longitude], 15, { animate: true })
    }
  }, [selectedCoords, map])
  return null
}

export default function Tracking() {
  const { i18n } = useTranslation()
  const { resolvedTheme } = useTheme()
  const [activeTheme, setActiveTheme] = useState(() => {
    return localStorage.getItem('bf_theme') || 'dark'
  })
  
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEmp, setSelectedEmp] = useState(null)
  const [geoJsonData, setGeoJsonData] = useState(null)
  const [selectedEmpDetail, setSelectedEmpDetail] = useState(null)


  const isRu = i18n.language === 'ru'
  const isDark = activeTheme === 'dark'
  const maskColor = isDark ? '#0d0d0d' : '#f3f2f1'

  useEffect(() => {
    if (resolvedTheme) {
      setActiveTheme(resolvedTheme)
    }
  }, [resolvedTheme])

  // Load Uzbekistan boundary GeoJSON
  useEffect(() => {
    fetch('/uzbekistan.json')
      .then(res => res.json())
      .then(data => setGeoJsonData(data))
      .catch(err => console.error("Failed to load Uzbekistan GeoJSON:", err))
  }, [])

  const fetchTrackingData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/organizations/tracking-data')
      if (res.ok) {
        const data = await res.json()
        setEmployees(data)
      }
    } catch (err) {
      console.error("Failed to fetch tracking data:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTrackingData()
    // Auto-refresh every 15 seconds
    const interval = setInterval(fetchTrackingData, 15000)
    return () => clearInterval(interval)
  }, [])

  const filteredEmployees = useMemo(() => {
    return employees
      .filter(emp => {
        if (!emp.in_working_hours) return false
        const name = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase()
        return name.includes(searchQuery.toLowerCase()) || 
               (emp.personal_id || '').toLowerCase().includes(searchQuery.toLowerCase())
      })
      .sort((a, b) => {
        if (a.is_online && !b.is_online) return -1
        if (!a.is_online && b.is_online) return 1
        return 0
      })
  }, [employees, searchQuery])

  const tileUrl = isDark 
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' 
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png'
  const labelsUrl = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png'

  return (
    <div style={{ display: 'flex', flex: 1, height: 'calc(100vh - 64px)', overflow: 'hidden', background: maskColor }}>
      {/* Sidebar */}
      <div style={{
        width: 320,
        background: isDark ? '#141414' : '#ffffff',
        borderRight: '1px solid var(--border-2)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10
      }}>
        {/* Sidebar Header */}
        <div style={{ padding: 16, borderBottom: '1px solid var(--border-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-1)' }}>
              <PeopleRegular fontSize={20} />
              {isRu ? 'Отслеживание' : 'Kuzatuv (Tracking)'}
            </h3>
            <Button
              icon={<ArrowClockwiseRegular />}
              appearance="subtle"
              onClick={fetchTrackingData}
              disabled={loading}
            />
          </div>
          
          <input
            type="text"
            placeholder={isRu ? "Поиск по имени..." : "Ism bo'yicha qidiruv..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid var(--border-3)',
              background: 'var(--surface-1)',
              color: 'var(--text-1)',
              outline: 'none',
              fontSize: 13,
              marginBottom: 10
            }}
          />

          <div style={{ fontSize: 11.5, color: 'var(--text-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{isRu ? 'Только в рабочее время' : 'Faqat ish vaqtidagilar'}</span>
            <span style={{ fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 4px #10b981' }} />
              Online: {employees.filter(e => e.is_online).length}
            </span>
          </div>
        </div>

        {/* Sidebar Employee List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredEmployees.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-4)' }}>
              {isRu ? 'Сотрудники не найдены' : 'Xodimlar topilmadi'}
            </div>
          ) : (
            filteredEmployees.map(emp => {
              const name = `${emp.first_name || ''} ${emp.last_name || ''}`
              const hasLoc = emp.latitude !== null && emp.longitude !== null
              return (
                <div
                  key={emp.id}
                  onClick={() => {
                    if (hasLoc) {
                      setSelectedEmp(emp)
                    }
                  }}
                  style={{
                    padding: 12,
                    borderBottom: '1px solid var(--border-2)',
                    cursor: hasLoc ? 'pointer' : 'default',
                    background: selectedEmp?.id === emp.id ? 'var(--surface-2)' : 'transparent',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => {
                    if (hasLoc) e.currentTarget.style.background = 'var(--surface-2)'
                  }}
                  onMouseLeave={e => {
                    if (hasLoc && selectedEmp?.id !== emp.id) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: 13 }}>{name}</span>
                    <span style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: emp.is_online ? '#10b981' : '#9ca3af',
                      boxShadow: emp.is_online ? '0 0 6px #10b981' : 'none'
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    {emp.department} • {emp.position}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{isRu ? 'Время:' : 'Ish vaqti:'} {emp.work_time}</span>
                    {hasLoc ? (
                      <span style={{ color: '#10b981', fontWeight: 600 }}>{isRu ? 'На xарте' : 'Xaritada'}</span>
                    ) : (
                      <span style={{ color: 'var(--text-4)' }}>
                        {emp.in_working_hours ? (isRu ? 'Нет GPS' : 'GPS yo\'q') : (isRu ? 'Скрыто' : 'Yashirilgan')}
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
        <MapContainer 
          center={[41.3005, 69.2455]} 
          zoom={6} 
          style={{ width: '100%', height: '100%' }}
          zoomControl={true}
        >
          <TileLayer key={`base-${isDark ? 'dark' : 'light'}`} attribution='&copy; CARTO' url={tileUrl} />
          
          <MapController selectedCoords={selectedEmp} />

          {geoJsonData && (
            <GeoJSON
              key={`border-${isDark ? 'dark' : 'light'}`}
              data={geoJsonData}
              pathOptions={{
                color: '#00d2ff',
                weight: 2,
                fillColor: 'transparent',
                opacity: 0.8
              }}
            />
          )}

          <TileLayer 
            key={`labels-${isDark ? 'dark' : 'light'}`} 
            url={labelsUrl} 
          />

          {employees.map(emp => {
            if (emp.latitude === null || emp.longitude === null) return null
            const name = `${emp.first_name || ''} ${emp.last_name || ''}`
            const empIcon = createEmployeeMarkerIcon(emp)
            return (
              <Marker
                key={`emp-${emp.id}`}
                position={[emp.latitude, emp.longitude]}
                icon={empIcon}
                eventHandlers={{
                  click: () => {
                    setSelectedEmpDetail(emp)
                  }
                }}
              />
            )
          })}
        </MapContainer>

        {/* Custom Employee Detail Modal */}
        {selectedEmpDetail && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: 20, boxSizing: 'border-box'
          }} onClick={() => setSelectedEmpDetail(null)}>
            <div style={{
              background: isDark ? '#141414' : '#ffffff', 
              border: '1px solid var(--border-2)',
              borderRadius: 16, width: '100%', maxWidth: 360, padding: 24,
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)', textAlign: 'center',
              position: 'relative'
            }} onClick={e => e.stopPropagation()}>
              <button onClick={() => setSelectedEmpDetail(null)} style={{
                position: 'absolute', top: 16, right: 16, background: 'none', border: 'none',
                color: 'var(--text-3)', cursor: 'pointer', display: 'flex'
              }}>
                <DismissRegular fontSize={20} />
              </button>

              {/* Profile Photo */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                {selectedEmpDetail.image_url ? (
                  <img src={selectedEmpDetail.image_url} style={{
                    width: 90, height: 90, borderRadius: '50%', objectFit: 'cover',
                    border: `3px solid ${selectedEmpDetail.is_online ? '#10b981' : '#9ca3af'}`,
                    boxShadow: selectedEmpDetail.is_online ? '0 0 15px #10b981' : 'none'
                  }} />
                ) : (
                  <div style={{
                    width: 90, height: 90, borderRadius: '50%', background: 'var(--surface-2, #242424)',
                    border: `3px solid ${selectedEmpDetail.is_online ? '#10b981' : '#9ca3af'}`,
                    color: 'var(--text-1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 26, fontWeight: 700, textTransform: 'uppercase'
                  }}>
                    {(selectedEmpDetail.first_name || '').charAt(0)}{(selectedEmpDetail.last_name || '').charAt(0)}
                  </div>
                )}
              </div>

              <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: 'var(--text-1)' }}>
                {selectedEmpDetail.first_name} {selectedEmpDetail.last_name}
              </h3>
              <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 16 }}>
                {selectedEmpDetail.department} • {selectedEmpDetail.position}
              </div>

              <div style={{ borderTop: '1px solid var(--border-2)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-4)' }}>{isRu ? 'Статус:' : 'Holati:'}</span>
                  <span style={{ fontWeight: 600, color: selectedEmpDetail.is_online ? '#10b981' : 'var(--text-3)' }}>
                    {selectedEmpDetail.is_online ? (isRu ? '● Онлайн' : '● Online') : (isRu ? '○ Оффлайн' : '○ Offline')}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-4)' }}>{isRu ? 'Рабочее время:' : 'Ish vaqti:'}</span>
                  <span style={{ color: 'var(--text-1)' }}>{selectedEmpDetail.work_time}</span>
                </div>
                {selectedEmpDetail.last_location_time && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-4)' }}>{isRu ? 'Активен:' : 'Oxirgi faollik:'}</span>
                    <span style={{ color: 'var(--text-1)' }}>{new Date(selectedEmpDetail.last_location_time).toLocaleString()}</span>
                  </div>
                )}
                {selectedEmpDetail.phone && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-4)' }}>{isRu ? 'Телефон:' : 'Telefon:'}</span>
                    <span style={{ color: 'var(--text-1)' }}>{selectedEmpDetail.phone}</span>
                  </div>
                )}
              </div>

              <button onClick={() => setSelectedEmpDetail(null)} style={{
                marginTop: 20, width: '100%', padding: '10px', borderRadius: 8,
                background: 'var(--accent)', border: 'none', color: '#fff',
                fontWeight: 600, cursor: 'pointer'
              }}>
                {isRu ? 'Закрыть' : 'Yopish'}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        /* Override default Leaflet divIcon styles to allow neon shadows */
        .custom-employee-marker-icon {
          background: transparent !important;
          border: none !important;
        }

        /* Custom Neon Pulse Styles */
        .neon-pulse-marker {
          position: relative;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .neon-core {
          width: 9px;
          height: 9px;
          background: var(--marker-color, #10b981);
          border-radius: 50%;
          box-shadow: 0 0 8px var(--marker-color, #10b981), 0 0 16px var(--marker-color, #10b981);
          animation: neon-breathe 2s ease-in-out infinite alternate;
          z-index: 2;
        }
        .neon-ring {
          position: absolute;
          border: 1.5px solid var(--marker-color, #10b981);
          border-radius: 50%;
          height: 100%;
          width: 100%;
          box-shadow: 0 0 6px var(--marker-color, #10b981);
          animation: neon-pulsate 1.8s ease-out infinite;
          opacity: 0;
          z-index: 1;
        }
        .neon-ring-2 {
          position: absolute;
          border: 1.5px solid var(--marker-color, #10b981);
          border-radius: 50%;
          height: 100%;
          width: 100%;
          box-shadow: 0 0 6px var(--marker-color, #10b981);
          animation: neon-pulsate 1.8s ease-out infinite 0.9s;
          opacity: 0;
          z-index: 1;
        }

        @keyframes neon-pulsate {
          0% {
            transform: scale(0.25);
            opacity: 0;
          }
          30% {
            opacity: 0.7;
          }
          100% {
            transform: scale(2.2);
            opacity: 0;
          }
        }
        @keyframes neon-breathe {
          0% {
            transform: scale(0.9);
            box-shadow: 0 0 6px var(--marker-color, #10b981), 0 0 12px var(--marker-color, #10b981);
          }
          100% {
            transform: scale(1.1);
            box-shadow: 0 0 12px var(--marker-color, #10b981), 0 0 24px var(--marker-color, #10b981);
          }
        }
      `}</style>
    </div>
  )
}
