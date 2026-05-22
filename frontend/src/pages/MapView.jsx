import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useTheme } from 'next-themes'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { CameraRegular, Wifi4Regular, WifiOffRegular, ArrowSyncRegular } from '@fluentui/react-icons'

const MOCK = [
  { id:1, name:'Asosiy Kirish', locationUz:'A-blok, 1-qavat',  locationRu:'Корпус A, 1-й этаж', lat:41.2995, lng:69.2401, status:'online',  lastSeenUz:'Hozir',            lastSeenRu:'Сейчас',          ip:'192.168.1.101', firmware:'3.2.1' },
  { id:2, name:'Orqa Eshik',   locationUz:'B-blok, Orqa',     locationRu:'Корпус B, сзади',    lat:41.3055, lng:69.2495, status:'offline', lastSeenUz:'2 soat oldin',     lastSeenRu:'2 часа назад',    ip:'192.168.1.102', firmware:'3.1.8' },
  { id:3, name:'Kutubxona',    locationUz:'C-blok, 2-qavat',  locationRu:'Корпус C, 2-й этаж', lat:41.3020, lng:69.2450, status:'online',  lastSeenUz:'1 daqiqa oldin',   lastSeenRu:'1 минута назад',  ip:'192.168.1.103', firmware:'3.2.1' },
  { id:4, name:'Sport Zal',    locationUz:'D-blok',           locationRu:'Корпус D',           lat:41.2970, lng:69.2520, status:'online',  lastSeenUz:'30 sekund oldin',  lastSeenRu:'30 секунд назад', ip:'192.168.1.104', firmware:'3.2.0' },
]

const parseCoords = (locStr) => {
  if (!locStr) return null
  const match = locStr.match(/(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)/)
  if (match) {
    const lat = parseFloat(match[1])
    const lng = parseFloat(match[2])
    if (!isNaN(lat) && !isNaN(lng)) {
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng }
      }
    }
  }
  return null
}

const cleanLocation = (locStr) => {
  if (!locStr) return ''
  let cleaned = locStr.replace(/-?\d+(?:\.\d+)?\s*[,;\s]\s*-?\d+(?:\.\d+)?/, '').trim()
  cleaned = cleaned.replace(/^\((.*)\)$/, '$1').replace(/\(\s*\)/g, '').trim()
  cleaned = cleaned.replace(/^[,;\s\-]+|[,;\s\-]+$/g, '').trim()
  return cleaned || locStr
}

function Dot({ on }) {
  return <span style={{ width:7, height:7, borderRadius:'50%', background: on ? 'var(--green)' : 'var(--red)', display:'inline-block' }} />
}

function MapController({ selectedCoords }) {
  const map = useMap()
  useEffect(() => {
    if (selectedCoords) {
      map.setView([selectedCoords.lat, selectedCoords.lng], 16, { animate: true, duration: 1 })
    }
  }, [selectedCoords, map])
  return null
}

export default function MapView({ isLoggedIn = false }) {
  const { t, i18n } = useTranslation()
  const { resolvedTheme } = useTheme()
  const [activeTheme, setActiveTheme] = useState(() => {
    return localStorage.getItem('bf_theme') || 'dark'
  })
  const [devices, setDevices]   = useState([])
  const [selected, setSelected] = useState(null)
  const [spin, setSpin]         = useState(false)

  useEffect(() => {
    if (resolvedTheme) {
      setActiveTheme(resolvedTheme)
    }
  }, [resolvedTheme])

  const lang   = i18n.language
  const isDark = activeTheme === 'dark'
  const loc = (dev) => lang === 'ru' ? dev.locationRu : dev.locationUz
  const lastSeen = (dev) => lang === 'ru' ? dev.lastSeenRu : dev.lastSeenUz

  const refresh = async () => {
    setSpin(true)
    try {
      const url = isLoggedIn ? '/api/cameras' : '/api/public/cameras'
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        const cams = Array.isArray(data) ? data : data.items || []
        const mapped = cams.map(c => {
          const coords = parseCoords(c.location)
          let lastSeenTextUz = '—'
          let lastSeenTextRu = '—'
          if (c.last_seen_at) {
            try {
              const date = new Date(c.last_seen_at)
              if (!isNaN(date.getTime())) {
                lastSeenTextUz = date.toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                lastSeenTextRu = date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
              }
            } catch {}
          }
          return {
            id: c.id,
            name: c.name,
            locationUz: cleanLocation(c.location) || 'Tashkilot hududi',
            locationRu: cleanLocation(c.location) || 'Территория организации',
            lat: coords ? coords.lat : null,
            lng: coords ? coords.lng : null,
            status: c.is_online ? 'online' : 'offline',
            lastSeenUz: lastSeenTextUz,
            lastSeenRu: lastSeenTextRu,
            ip: c.external_ip || '—',
            firmware: c.firmware_version || '—',
          }
        })
        setDevices(mapped)
      }
    } catch (err) {
      console.error("Failed to load cameras on map:", err)
    }
    setSpin(false)
  }
  useEffect(() => { refresh() }, [isLoggedIn])

  const online  = devices.filter(d => d.status === 'online').length
  const offline = devices.filter(d => d.status === 'offline').length
  const selDev  = devices.find(d => d.id === selected)

  const tileUrl = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'

  return (
    <div style={{ display:'flex', height:'calc(100vh - 52px)', background:'var(--bg)' }}>

      {/* Sidebar */}
      <aside style={{ width:300, flexShrink:0, background:'var(--surface)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* Header */}
        <div style={{ padding:'16px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <CameraRegular fontSize={18} color="var(--accent)" />
              <span style={{ fontWeight:700, fontSize:14, color:'var(--text-1)' }}>{t('map.devices')}</span>
            </div>
            <button onClick={refresh} title={t('map.refresh')} style={{ background:'var(--surface-2)', border:'1px solid var(--border-3)', borderRadius:7, padding:'5px 7px', cursor:'pointer', color:'var(--text-3)', display:'flex', alignItems:'center' }}>
              <ArrowSyncRegular fontSize={14} style={{ animation: spin ? 'spin 0.7s linear infinite' : 'none' }} />
            </button>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <div style={{ flex:1, background:'var(--green-bg)', border:'1px solid var(--green-bd)', borderRadius:8, padding:'9px 12px', textAlign:'center' }}>
              <div style={{ fontSize:20, fontWeight:700, color:'var(--green)' }}>{online}</div>
              <div style={{ fontSize:11, color:'var(--green)', opacity:0.6, marginTop:2 }}>{t('map.online')}</div>
            </div>
            <div style={{ flex:1, background:'var(--red-bg)', border:'1px solid var(--red-bd)', borderRadius:8, padding:'9px 12px', textAlign:'center' }}>
              <div style={{ fontSize:20, fontWeight:700, color:'var(--red)' }}>{offline}</div>
              <div style={{ fontSize:11, color:'var(--red)', opacity:0.6, marginTop:2 }}>{t('map.offline')}</div>
            </div>
          </div>
        </div>

        {/* Device list */}
        <div style={{ overflowY:'auto', flex:1, padding:'8px' }}>
          {devices.map(dev => {
            const isOn  = dev.status === 'online'
            const isSel = selected === dev.id
            return (
              <div key={dev.id} onClick={() => setSelected(dev.id === selected ? null : dev.id)} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderRadius:9, background: isSel ? 'var(--accent-bg)' : 'transparent', border: `1px solid ${isSel ? 'var(--accent-bd)' : 'transparent'}`, cursor:'pointer', marginBottom:3 }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--surface-2)' }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ width:36, height:36, borderRadius:9, background: isOn ? 'var(--green-bg)' : 'var(--surface-2)', border: `1px solid ${isOn ? 'var(--green-bd)' : 'var(--border-3)'}`, display:'flex', alignItems:'center', justifyContent:'center', color: isOn ? 'var(--green)' : 'var(--text-4)', flexShrink:0 }}>
                  <CameraRegular fontSize={17} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:13, color:'var(--text-1)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{dev.name}</div>
                  <div style={{ fontSize:11, color:'var(--text-4)', marginTop:2 }}>{loc(dev)}</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:3 }}>
                  <Dot on={isOn} />
                  {isOn ? <Wifi4Regular fontSize={12} color="var(--green)" /> : <WifiOffRegular fontSize={12} color="var(--red)" />}
                </div>
              </div>
            )
          })}
        </div>

        {/* Selected detail */}
        {selDev && (
          <div style={{ borderTop:'1px solid var(--border)', padding:'14px 16px', background:'var(--surface-3)' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--accent-tx)', marginBottom:10 }}>{selDev.name}</div>
            {[['IP', selDev.ip], ['Firmware', selDev.firmware], [t('map.lastSeen'), lastSeen(selDev)]].map(([k, v]) => (
              <div key={k} style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <span style={{ fontSize:11, color:'var(--text-4)' }}>{k}</span>
                <span style={{ fontSize:11, color:'var(--text-1)', fontFamily:'monospace' }}>{v}</span>
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* Map */}
      <div style={{ flex:1, position:'relative' }}>
        <MapContainer center={[41.3005, 69.2455]} zoom={14} style={{ width:'100%', height:'100%' }} zoomControl={false}>
          <TileLayer key={isDark ? 'dark' : 'light'} attribution='&copy; CARTO' url={tileUrl} />
          <MapController selectedCoords={selDev && typeof selDev.lat === 'number' && typeof selDev.lng === 'number' ? { lat: selDev.lat, lng: selDev.lng } : null} />
          {devices.map(dev => {
            if (typeof dev.lat !== 'number' || typeof dev.lng !== 'number') return null
            return (
              <CircleMarker key={dev.id} center={[dev.lat, dev.lng]}
                radius={selected === dev.id ? 13 : 9}
                pathOptions={{ color: dev.status==='online'?'var(--green)':'var(--red)', fillColor: dev.status==='online'?'var(--green)':'var(--red)', fillOpacity:0.9, weight: selected===dev.id?3:1 }}
                eventHandlers={{ click: () => setSelected(dev.id === selected ? null : dev.id) }}
              >
                <Popup>
                  <div style={{ fontFamily:'system-ui', fontSize:12, minWidth:140 }}>
                    <strong style={{ display:'block', marginBottom:3 }}>{dev.name}</strong>
                    <span style={{ color: dev.status==='online'?'var(--green)':'var(--red)' }}>● {dev.status}</span><br />
                    <span style={{ color:'var(--text-3)' }}>{loc(dev)}</span>
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>

        {/* Legend */}
        <div style={{ position:'absolute', bottom:18, right:16, zIndex:1000, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'11px 14px', fontSize:12, boxShadow:'var(--shadow)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
            <Dot on={true} /> <span style={{ color:'var(--text-3)' }}>{t('map.online')} ({online})</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Dot on={false} /> <span style={{ color:'var(--text-3)' }}>{t('map.offline')} ({offline})</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .leaflet-container { background: var(--bg) !important; }
        .leaflet-popup-content-wrapper { background: var(--surface) !important; border: 1px solid var(--border) !important; color: var(--text-1) !important; box-shadow: var(--shadow) !important; }
        .leaflet-popup-tip { background: var(--surface) !important; }
        .leaflet-popup-close-button { color: var(--text-3) !important; }
        .leaflet-control-attribution { background: var(--surface) !important; color: var(--text-3) !important; border-top: 1px solid var(--border) !important; border-left: 1px solid var(--border) !important; font-size: 10px !important; }
        .leaflet-control-attribution a { color: var(--accent-tx) !important; }
      `}</style>
    </div>
  )
}
