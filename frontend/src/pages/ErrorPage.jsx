/**
 * ErrorPage — universal xato sahifasi.
 * 404, 403, 500, 503 va boshqa barcha xatoliklar uchun.
 * Props:
 *   status  – HTTP status kodi (number yoki string), yo'q bo'lsa 404
 *   message – qo'shimcha xabar (ixtiyoriy)
 */
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  WarningRegular,
  LockClosedRegular,
  PlugDisconnectedRegular,
  WrenchRegular,
  HomeRegular,
  ArrowLeftRegular,
  DocumentSearchRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'

/* ─────────────────────────────────────────────── status metadata ── */
const STATUS_MAP = {
  400: {
    icon: WarningRegular,
    color: '#f0a30a',
    gradientFrom: '#2d1e00',
    gradientTo:   '#1a1200',
    titleUz: 'Noto\'g\'ri So\'rov',
    titleRu: 'Неверный запрос',
    descUz:  'Yuborgan so\'rovingiz noto\'g\'ri formatda yoki majburiy maydonlar yetishmayapti.',
    descRu:  'Ваш запрос имеет неверный формат или отсутствуют обязательные поля.',
    code: '400',
  },
  401: {
    icon: LockClosedRegular,
    color: '#f7630c',
    gradientFrom: '#2a1500',
    gradientTo:   '#190d00',
    titleUz: 'Autentifikatsiya Kerak',
    titleRu: 'Требуется авторизация',
    descUz:  'Bu sahifaga kirish uchun avval tizimga kiring.',
    descRu:  'Для доступа к этой странице необходимо войти в систему.',
    code: '401',
  },
  403: {
    icon: LockClosedRegular,
    color: '#c50f1f',
    gradientFrom: '#2a0008',
    gradientTo:   '#1a0005',
    titleUz: 'Ruxsat Yo\'q',
    titleRu: 'Доступ запрещён',
    descUz:  'Sizda bu sahifani ko\'rish uchun yetarli huquqlar mavjud emas.',
    descRu:  'У вас недостаточно прав для просмотра этой страницы.',
    code: '403',
  },
  404: {
    icon: DocumentSearchRegular,
    color: '#0078d4',
    gradientFrom: '#001428',
    gradientTo:   '#000a18',
    titleUz: 'Sahifa Topilmadi',
    titleRu: 'Страница не найдена',
    descUz:  'Siz qidirayotgan sahifa o\'chirilgan, ko\'chirilgan yoki hech qachon mavjud bo\'lmagan.',
    descRu:  'Страница, которую вы ищете, удалена, перемещена или никогда не существовала.',
    code: '404',
  },
  408: {
    icon: PlugDisconnectedRegular,
    color: '#f0a30a',
    gradientFrom: '#2d1e00',
    gradientTo:   '#1a1200',
    titleUz: 'So\'rov Vaqti Tugadi',
    titleRu: 'Время запроса истекло',
    descUz:  'Server javob berish uchun juda ko\'p vaqt sarfladi. Qayta urinib ko\'ring.',
    descRu:  'Сервер слишком долго отвечал. Попробуйте снова.',
    code: '408',
  },
  429: {
    icon: WarningRegular,
    color: '#f0a30a',
    gradientFrom: '#2d1e00',
    gradientTo:   '#1a1200',
    titleUz: 'Juda Ko\'p So\'rovlar',
    titleRu: 'Слишком много запросов',
    descUz:  'Siz juda tez-tez so\'rov yuborayapsiz. Bir oz kuting va qayta urinib ko\'ring.',
    descRu:  'Вы отправляете запросы слишком часто. Подождите немного и попробуйте снова.',
    code: '429',
  },
  500: {
    icon: WrenchRegular,
    color: '#6264a7',
    gradientFrom: '#0d0d28',
    gradientTo:   '#08081a',
    titleUz: 'Ichki Server Xatosi',
    titleRu: 'Внутренняя ошибка сервера',
    descUz:  'Serverda kutilmagan xato yuz berdi. Texnik jamoa xabardor qilingan.',
    descRu:  'На сервере произошла непредвиденная ошибка. Техническая команда уже уведомлена.',
    code: '500',
  },
  502: {
    icon: PlugDisconnectedRegular,
    color: '#038387',
    gradientFrom: '#002020',
    gradientTo:   '#001414',
    titleUz: 'Noto\'g\'ri Javob',
    titleRu: 'Неверный ответ шлюза',
    descUz:  'Server yuqori darajali xizmatdan noto\'g\'ri javob oldi.',
    descRu:  'Сервер получил неверный ответ от вышестоящего сервиса.',
    code: '502',
  },
  503: {
    icon: PlugDisconnectedRegular,
    color: '#038387',
    gradientFrom: '#002020',
    gradientTo:   '#001414',
    titleUz: 'Xizmat Mavjud Emas',
    titleRu: 'Служба недоступна',
    descUz:  'Server hozir texnik ishlar sababli to\'xtatilgan. Tez orada qayta ishga tushadi.',
    descRu:  'Сервер временно остановлен из-за технических работ. Скоро снова будет доступен.',
    code: '503',
  },
  504: {
    icon: PlugDisconnectedRegular,
    color: '#f0a30a',
    gradientFrom: '#2d1e00',
    gradientTo:   '#1a1200',
    titleUz: 'Gateway Timeout',
    titleRu: 'Таймаут шлюза',
    descUz:  'Serverlar o\'rtasida aloqa vaqti tugadi. Keyinroq urinib ko\'ring.',
    descRu:  'Истекло время соединения между серверами. Попробуйте позже.',
    code: '504',
  },
}

const DEFAULT_STATUS = STATUS_MAP[404]

/* ─────────────────────────────────────────────────────────────── */

function OrbitRing({ radius, speed, color, opacity = 0.12 }) {
  return (
    <div style={{
      position: 'absolute',
      width: radius * 2,
      height: radius * 2,
      borderRadius: '50%',
      border: `1px solid ${color}`,
      opacity,
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      animation: `orbit-spin ${speed}s linear infinite`,
    }} />
  )
}

export default function ErrorPage({ status: statusProp, message }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { i18n }  = useTranslation()
  const isRu      = i18n.language === 'ru'

  // Accept status from prop OR from location.state
  const statusCode = statusProp
    || location?.state?.status
    || 404

  const meta = STATUS_MAP[Number(statusCode)] || DEFAULT_STATUS
  const Icon = meta.icon

  const title = isRu ? meta.titleRu : meta.titleUz
  const desc  = message || (isRu ? meta.descRu : meta.descUz)

  return (
    <>
      {/* ── Hero ── */}
      <PageHero
        badge={`✦ ${isRu ? 'Xatolik' : 'Xatolik'} ${meta.code}`}
        title={title}
        sub={isRu ? 'BioFace Boshqaruv Tizimi' : 'BioFace Boshqaruv Tizimi'}
        backPath="/"
      />

      {/* ── Animated Background Scene ── */}
      <div style={{
        flex: 1,
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        background: `radial-gradient(ellipse at 50% 40%, ${meta.gradientFrom} 0%, var(--bg) 70%)`,
        padding: '48px 24px',
      }}>

        {/* Animated orbit rings */}
        <OrbitRing radius={140} speed={18} color={meta.color} opacity={0.10} />
        <OrbitRing radius={220} speed={28} color={meta.color} opacity={0.07} />
        <OrbitRing radius={320} speed={42} color={meta.color} opacity={0.05} />

        {/* Floating glow dots */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
        }}>
          {[
            { top: '15%', left: '12%',  size: 6,  delay: '0s',   dur: '4.2s' },
            { top: '72%', left: '8%',   size: 4,  delay: '1.1s', dur: '5.1s' },
            { top: '30%', right: '10%', size: 8,  delay: '0.5s', dur: '6.3s' },
            { top: '80%', right: '15%', size: 5,  delay: '2.3s', dur: '4.8s' },
            { top: '55%', left: '25%',  size: 3,  delay: '1.8s', dur: '3.9s' },
            { top: '20%', right: '28%', size: 4,  delay: '0.9s', dur: '5.7s' },
          ].map((dot, i) => (
            <div key={i} style={{
              position: 'absolute',
              top: dot.top, left: dot.left, right: dot.right,
              width: dot.size, height: dot.size,
              borderRadius: '50%',
              background: meta.color,
              opacity: 0.35,
              animation: `float-dot ${dot.dur} ${dot.delay} ease-in-out infinite alternate`,
            }} />
          ))}
        </div>

        {/* ── Main Card ── */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 24,
          boxShadow: `0 0 80px ${meta.color}22, 0 24px 64px #00000040`,
          padding: '48px 48px 40px',
          maxWidth: 560,
          width: '100%',
          textAlign: 'center',
          backdropFilter: 'blur(12px)',
        }}>

          {/* Status code badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: `${meta.color}18`,
            border: `1px solid ${meta.color}40`,
            borderRadius: 100,
            padding: '4px 16px',
            marginBottom: 24,
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, letterSpacing: 1.5, textTransform: 'uppercase' }}>
              {isRu ? 'Xatolik' : 'Xatolik'} {meta.code}
            </span>
          </div>

          {/* Big animated icon */}
          <div style={{
            width: 96, height: 96,
            borderRadius: '50%',
            background: `${meta.color}15`,
            border: `2px solid ${meta.color}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 28px',
            boxShadow: `0 0 40px ${meta.color}25`,
            animation: 'icon-pulse 2.5s ease-in-out infinite',
          }}>
            <Icon style={{ fontSize: 44, color: meta.color }} />
          </div>

          {/* Title */}
          <h2 style={{
            fontSize: 26, fontWeight: 800,
            color: 'var(--text-1)',
            margin: '0 0 12px',
            letterSpacing: -0.5,
          }}>
            {title}
          </h2>

          {/* Description */}
          <p style={{
            fontSize: 14, lineHeight: 1.65,
            color: 'var(--text-3)',
            margin: '0 0 32px',
          }}>
            {desc}
          </p>

          {/* Path chip */}
          <div style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '8px 14px',
            marginBottom: 32,
            fontSize: 12,
            color: 'var(--text-4)',
            fontFamily: 'monospace',
            wordBreak: 'break-all',
            textAlign: 'left',
          }}>
            <span style={{ color: meta.color, marginRight: 6 }}>URL:</span>
            {location.pathname}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              id="error-page-go-home"
              onClick={() => navigate('/')}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '11px 24px',
                background: meta.color,
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                boxShadow: `0 4px 20px ${meta.color}40`,
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <HomeRegular style={{ fontSize: 16 }} />
              {isRu ? 'Bosh sahifaga' : 'Bosh sahifaga'}
            </button>

            <button
              id="error-page-go-back"
              onClick={() => navigate(-1)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '11px 24px',
                background: 'var(--surface-2)',
                color: 'var(--text-2)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.18s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-3)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <ArrowLeftRegular style={{ fontSize: 16 }} />
              {isRu ? 'Orqaga' : 'Orqaga'}
            </button>
          </div>

          {/* Help links */}
          <div style={{
            marginTop: 28,
            paddingTop: 20,
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: 20,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}>
            {[
              { label: isRu ? 'Asosiy sahifa' : 'Dashboard',  path: '/dashboard' },
              { label: isRu ? 'Xodimlar' : 'Xodimlar',        path: '/users/staff' },
              { label: isRu ? 'Qurilmalar' : 'Qurilmalar',    path: '/devices' },
              { label: isRu ? 'Sozlamalar' : 'Sozlamalar',    path: '/settings' },
            ].map(link => (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  color: meta.color, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', textDecoration: 'underline',
                  textUnderlineOffset: 3, opacity: 0.8,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0.8' }}
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Keyframe animations ── */}
      <style>{`
        @keyframes orbit-spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to   { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes float-dot {
          from { transform: translateY(0px) scale(1); }
          to   { transform: translateY(-12px) scale(1.3); }
        }
        @keyframes icon-pulse {
          0%, 100% { box-shadow: 0 0 40px ${meta.color}25, 0 0 0 0 ${meta.color}30; }
          50%       { box-shadow: 0 0 60px ${meta.color}40, 0 0 0 8px transparent; }
        }
      `}</style>
    </>
  )
}
