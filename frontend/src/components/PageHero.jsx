/**
 * PageHero — barcha ichki sahifalar uchun umumiy hero banner.
 * Navbar (#0f172a) bilan to'q ko'k rangda tutash ko'rinadi,
 * pastga tomonga gradient ketadi.
 *
 * Props:
 *   badge    – kichik yuqori matn (masalan: "✦ Kameralar")
 *   title    – asosiy h1 sarlavha
 *   sub      – qo'shimcha kichik matn
 *   right    – o'ng tomondagi element (button va h.)
 *   backPath – chapda "<" tugma (ixtiyoriy)
 *   children – banner ichiga qo'shimcha kontent
 */
import { useNavigate } from 'react-router-dom'
import { ArrowLeftRegular } from '@fluentui/react-icons'

// Navbar va hero uchun bitta rang
const HERO_BG = 'linear-gradient(180deg, #0f172a 0%, #162035 60%, #1a2744 100%)'
const HERO_HEIGHT = 80   // barcha sahifada bir xil balandlik (padding)

export default function PageHero({ badge, title, sub, right, backPath, children }) {
  const navigate = useNavigate()

  return (
    <div style={{
      background: HERO_BG,
      // Navbar pastida gap bo'lmasligi uchun margin yo'q
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      padding: `${HERO_HEIGHT / 2 - 8}px 32px ${HERO_HEIGHT / 2 - 8}px`,
      minHeight: HERO_HEIGHT,
    }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>

          {/* Back button */}
          {backPath && (
            <button
              onClick={() => navigate(backPath)}
              style={{
                width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: '#fff',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.14)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            >
              <ArrowLeftRegular fontSize={16} />
            </button>
          )}

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {badge && (
              <div style={{
                fontSize: 11, color: 'rgba(255,255,255,0.45)',
                textTransform: 'uppercase', letterSpacing: 1.2,
                fontWeight: 600, marginBottom: 4,
              }}>
                {badge}
              </div>
            )}
            <h1 style={{
              fontSize: 20, fontWeight: 800, color: '#fff',
              margin: 0, letterSpacing: -0.3,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {title}
            </h1>
            {sub && (
              <div style={{
                fontSize: 12, color: 'rgba(255,255,255,0.38)',
                marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {sub}
              </div>
            )}
          </div>

          {/* Right slot */}
          {right && <div style={{ flexShrink: 0 }}>{right}</div>}
        </div>

        {/* Optional extra content inside hero */}
        {children}
      </div>
    </div>
  )
}
