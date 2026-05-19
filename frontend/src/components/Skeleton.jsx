/**
 * Skeleton — ma'lumot yuklanayotganda ko'rsatiladigan placeholder bloklar.
 * Loyiha bo'ylab umumiy "shimmer" stili bilan yagona ko'rinish.
 *
 * Foydalanish:
 *   <Skeleton width="100%" height={20} />
 *   <Skeleton.Card />
 *   <Skeleton.Stat />
 */
import { useEffect } from 'react'

const STYLE_ID = 'bf-skeleton-style'

function ensureKeyframes() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const tag = document.createElement('style')
  tag.id = STYLE_ID
  tag.innerHTML = `
    @keyframes bfShimmer {
      0%   { background-position: -400px 0; }
      100% { background-position: 400px 0; }
    }
    .bf-skeleton {
      background: linear-gradient(
        90deg,
        var(--surface-2) 0%,
        var(--border) 50%,
        var(--surface-2) 100%
      );
      background-size: 800px 100%;
      animation: bfShimmer 1.4s linear infinite;
      border-radius: 6px;
      display: inline-block;
    }
  `
  document.head.appendChild(tag)
}

export default function Skeleton({ width = '100%', height = 14, radius = 6, style = {} }) {
  useEffect(ensureKeyframes, [])
  return (
    <span
      className="bf-skeleton"
      style={{
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
    />
  )
}

// Statistika kartasi shakli (label + qiymat)
Skeleton.Stat = function StatSkeleton() {
  return (
    <div style={{ padding: 14, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
      <Skeleton width={70} height={10} />
      <div style={{ marginTop: 8 }}>
        <Skeleton width={120} height={18} />
      </div>
    </div>
  )
}

// Bitta katta karta (sarlavha + ichki tarkib)
Skeleton.Card = function CardSkeleton({ rows = 3 }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
      <Skeleton width={180} height={18} />
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} width={`${70 + (i % 3) * 10}%`} height={12} />
        ))}
      </div>
    </div>
  )
}

// Statlar gridi
Skeleton.Stats = function StatsSkeleton({ count = 6 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => <Skeleton.Stat key={i} />)}
    </div>
  )
}

// Tugmalar bloki
Skeleton.Button = function ButtonSkeleton({ width = 110 }) {
  return <Skeleton width={width} height={32} radius={7} />
}

// Endpoint qatorlari (API helper uchun)
Skeleton.Row = function RowSkeleton() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
      <Skeleton width={44} height={18} radius={4} />
      <Skeleton width="40%" height={12} />
      <div style={{ flex: 1 }} />
      <Skeleton width={120} height={10} />
    </div>
  )
}
