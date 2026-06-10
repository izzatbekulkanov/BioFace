import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useTheme } from 'next-themes'
import { MapContainer, TileLayer, Marker, Popup, Polyline, GeoJSON, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

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

function MapController({ allCoords }) {
  const map = useMap()

  useEffect(() => {
    if (map && !map.getPane('labelsPane')) {
      const pane = map.createPane('labelsPane')
      pane.style.zIndex = '350'
      pane.style.pointerEvents = 'none'
    }
  }, [map])

  // Fit bounds to show all active branch markers on load
  useEffect(() => {
    if (allCoords && allCoords.length > 0) {
      const bounds = allCoords.map(c => [c.lat, c.lng])
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 })
    }
  }, [allCoords, map])

  return null
}

export default function MapView({ isLoggedIn = false }) {
  const { i18n } = useTranslation()
  const { resolvedTheme } = useTheme()
  const [activeTheme, setActiveTheme] = useState(() => {
    return localStorage.getItem('bf_theme') || 'dark'
  })
  const [devices, setDevices]   = useState([])
  const [spin, setSpin]         = useState(false)
  const [geoJsonData, setGeoJsonData] = useState(null)

  useEffect(() => {
    if (resolvedTheme) {
      setActiveTheme(resolvedTheme)
    }
  }, [resolvedTheme])

  // Load Uzbekistan boundary GeoJSON (High Precision)
  useEffect(() => {
    fetch('/uzbekistan.json')
      .then(res => res.json())
      .then(data => setGeoJsonData(data))
      .catch(err => console.error("Failed to load Uzbekistan GeoJSON:", err))
  }, [])

  const isRu = i18n.language === 'ru'
  const isDark = activeTheme === 'dark'
  const maskColor = isDark ? '#0d0d0d' : '#f3f2f1'

  const refresh = async () => {
    setSpin(true)
    try {
      const url = isLoggedIn ? '/api/branches' : '/api/public/branches'
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        const branches = Array.isArray(data) ? data : data.items || []
        const mapped = branches.map(b => {
          let lat = typeof b.latitude === 'number' ? b.latitude : null
          let lng = typeof b.longitude === 'number' ? b.longitude : null
          if (lat === null || lng === null) {
            const coords = parseCoords(b.address)
            if (coords) {
              lat = coords.lat
              lng = coords.lng
            }
          }
          return {
            id: b.id,
            name: b.name,
            organization_name: b.organization_name || '—',
            address: cleanLocation(b.address) || (isRu ? 'Адрес не указан' : 'Manzil ko\'rsatilmagan'),
            lat: lat,
            lng: lng,
            devices_count: b.devices_count || 0,
            radius: b.radius || 100,
          }
        })
        setDevices(mapped)
      }
    } catch (err) {
      console.error("Failed to load branches on map:", err)
    }
    setSpin(false)
  }

  useEffect(() => { refresh() }, [isLoggedIn])

  const linePositions = useMemo(() => {
    const activeCoords = devices
      .filter(d => typeof d.lat === 'number' && typeof d.lng === 'number')
      .map(d => ({ lat: d.lat, lng: d.lng }))
      
    if (activeCoords.length <= 2) return activeCoords;
    
    // Nearest-neighbor sorting to prevent connection lines from intersecting
    const remaining = [...activeCoords];
    const sorted = [];
    
    // Start with the westernmost point (lowest longitude)
    let currentIdx = 0;
    let minLng = remaining[0].lng;
    for (let i = 1; i < remaining.length; i++) {
      if (remaining[i].lng < minLng) {
        minLng = remaining[i].lng;
        currentIdx = i;
      }
    }
    
    sorted.push(remaining.splice(currentIdx, 1)[0]);
    
    while (remaining.length > 0) {
      let nearestIdx = 0;
      let minDistance = Infinity;
      const current = sorted[sorted.length - 1];
      
      for (let i = 0; i < remaining.length; i++) {
        const target = remaining[i];
        const dist = Math.pow(target.lat - current.lat, 2) + Math.pow(target.lng - current.lng, 2);
        if (dist < minDistance) {
          minDistance = dist;
          nearestIdx = i;
        }
      }
      
      sorted.push(remaining.splice(nearestIdx, 1)[0]);
    }
    
    return sorted;
  }, [devices])

  // Create an inverted mask covering the whole world except Uzbekistan and its enclaves
  const maskGeoJson = useMemo(() => {
    if (!geoJsonData) return null
    const worldCoords = [
      [-180, -85.05],
      [180, -85.05],
      [180, 85.05],
      [-180, 85.05],
      [-180, -85.05]
    ]
    const rings = [worldCoords]

    const geom = geoJsonData.features[0].geometry
    if (geom.type === 'MultiPolygon') {
      geom.coordinates.forEach(part => {
        // part[0] is the outer boundary of this part
        rings.push(part[0])
      })
    } else {
      // Polygon
      rings.push(geom.coordinates[0])
    }

    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: rings
      }
    }
  }, [geoJsonData])

  const tileUrl = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png'

  const labelsUrl = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png'

  const uzBounds = [
    [37.0, 55.0],
    [46.0, 74.0]
  ]

  // Render a clean loading spinner while the high-precision GeoJSON loads
  if (!geoJsonData) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'calc(100vh - 52px)', background: maskColor, color: 'var(--text-1)', fontFamily: 'system-ui' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '4px solid var(--border)', borderTopColor: '#00d2ff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <div>{isRu ? 'Загрузка карты...' : 'Xarita yuklanmoqda...'}</div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display:'flex', height:'calc(100vh - 52px)', background: maskColor }}>

      {/* Map */}
      <div style={{ flex:1, position:'relative', zIndex: 1 }}>
        <MapContainer 
          center={[41.3005, 69.2455]} 
          zoom={6} 
          maxBounds={uzBounds}
          maxBoundsViscosity={1.0}
          style={{ width:'100%', height:'100%' }} 
          zoomControl={false}
        >
          {/* Base tiles without labels */}
          <TileLayer key={`base-${isDark ? 'dark' : 'light'}`} attribution='&copy; CARTO' url={tileUrl} />
          
          <MapController allCoords={linePositions} />

          {/* Solid background mask to hide everything outside Uzbekistan */}
          <GeoJSON
            key={`mask-${isDark ? 'dark' : 'light'}`}
            data={maskGeoJson}
            pathOptions={{
              color: 'transparent',
              fillColor: maskColor,
              fillOpacity: 1.0,
              weight: 0
            }}
          />

          {/* Uzbekistan boundary border highlighted in havorang (light blue) */}
          <GeoJSON
            key={`border-${isDark ? 'dark' : 'light'}`}
            data={geoJsonData}
            pathOptions={{
              color: '#00d2ff', // Havorang / light blue
              weight: 3.5,
              fillColor: 'transparent',
              opacity: 1.0
            }}
          />

          {/* Transparent labels layer drawn on top of the mask and border */}
          <TileLayer 
            key={`labels-${isDark ? 'dark' : 'light'}`} 
            url={labelsUrl} 
            pane="labelsPane" 
          />
          
          {/* Glowing neon lines connecting all branches */}
          {linePositions.length > 1 && (
            <>
              {/* Outer Ambient Glow Line */}
              <Polyline
                positions={linePositions.map(c => [c.lat, c.lng])}
                pathOptions={{
                  color: '#10b981',
                  weight: 12,
                  opacity: 0.15
                }}
              />
              {/* Middle Conduit Glow Line */}
              <Polyline
                positions={linePositions.map(c => [c.lat, c.lng])}
                pathOptions={{
                  color: '#10b981',
                  weight: 6,
                  opacity: 0.4
                }}
              />
              {/* Inner Bright Core */}
              <Polyline
                positions={linePositions.map(c => [c.lat, c.lng])}
                pathOptions={{
                  color: '#a7f3d0',
                  weight: 2,
                  opacity: 0.9
                }}
              />
              {/* Marching Ants Conduit Flow */}
              <Polyline
                positions={linePositions.map(c => [c.lat, c.lng])}
                pathOptions={{
                  color: '#059669',
                  weight: 2.5,
                  opacity: 0.6,
                  className: 'neon-marching-ants'
                }}
              />
              {/* Cyan Data Packet Pulses */}
              <Polyline
                positions={linePositions.map(c => [c.lat, c.lng])}
                pathOptions={{
                  color: '#00d2ff',
                  weight: 3.5,
                  opacity: 0.95,
                  className: 'neon-data-packets-cyan'
                }}
              />
              {/* Yellow Data Packet Pulses (Fast) */}
              <Polyline
                positions={linePositions.map(c => [c.lat, c.lng])}
                pathOptions={{
                  color: '#fbbf24',
                  weight: 3,
                  opacity: 0.9,
                  className: 'neon-data-packets-yellow'
                }}
              />
            </>
          )}

          {/* Custom Pulsing Green Neon Markers */}
          {devices.map(dev => {
            if (typeof dev.lat !== 'number' || typeof dev.lng !== 'number') return null
            const pulseIcon = createPulseIcon('#10b981')
            return (
              <Marker
                key={`branch-${dev.id}`}
                position={[dev.lat, dev.lng]}
                icon={pulseIcon}
              >
                <Popup>
                  <div style={{ fontFamily:'system-ui', fontSize:12, minWidth:140 }}>
                    <strong style={{ display:'block', marginBottom:3 }}>{dev.name}</strong>
                    <span style={{ color:'var(--text-3)' }}>{dev.organization_name}</span><br />
                    <span style={{ color:'var(--text-4)' }}>{dev.address}</span>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>

      <style>{`
        .leaflet-container { background: ${maskColor} !important; }
        .leaflet-popup-content-wrapper { background: var(--surface) !important; border: 1px solid var(--border) !important; color: var(--text-1) !important; box-shadow: var(--shadow) !important; }
        .leaflet-popup-tip { background: var(--surface) !important; }
        .leaflet-popup-close-button { color: var(--text-3) !important; }
        .leaflet-control-attribution { display: none !important; }

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

        /* Marching neon dash animation for connections */
        .neon-marching-ants {
          stroke-dasharray: 12, 12;
          animation: dash-move 25s linear infinite;
        }

        /* Neon data packets animations */
        .neon-data-packets-cyan {
          stroke-dasharray: 8, 140;
          animation: packet-move-cyan 8s linear infinite;
        }
        .neon-data-packets-yellow {
          stroke-dasharray: 6, 200;
          animation: packet-move-yellow 5s linear infinite;
        }

        @keyframes dash-move {
          to {
            stroke-dashoffset: -1000;
          }
        }
        @keyframes packet-move-cyan {
          to {
            stroke-dashoffset: -1000;
          }
        }
        @keyframes packet-move-yellow {
          to {
            stroke-dashoffset: -1000;
          }
        }
      `}</style>
    </div>
  )
}
