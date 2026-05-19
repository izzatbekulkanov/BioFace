import { useTranslation } from 'react-i18next'
import { PlugConnectedRegular, OpenRegular } from '@fluentui/react-icons'
import PageHero from '../components/PageHero'

/**
 * API Helper — alohida sahifa (avval Sozlamalar ichidagi tab edi).
 * Tez-tez ishlatiladigan API endpointlar ro'yxati.
 *
 * Bu sahifa to'liq statik ma'lumotni ko'rsatadi, shuning uchun
 * skeleton loader kerak emas — kontent darhol render bo'ladi.
 */
export default function ApiHelper() {
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'

  const groups = [
    {
      title: isRu ? 'Дашборд' : 'Boshqaruv paneli',
      items: [
        { method: 'GET', path: '/api/dashboard/metrics', desc: isRu ? 'Метрики дашборда' : 'Dashboard metrikalari' },
        { method: 'GET', path: '/api/dashboard/weekly-trend', desc: isRu ? 'Недельный тренд' : 'Haftalik trend' },
        { method: 'GET', path: '/api/dashboard/recent-events', desc: isRu ? 'Последние события' : 'Oxirgi hodisalar' },
      ],
    },
    {
      title: isRu ? 'Камеры' : 'Kameralar',
      items: [
        { method: 'GET', path: '/api/cameras', desc: isRu ? 'Список камер' : "Kameralar ro'yxati" },
        { method: 'POST', path: '/api/cameras/{id}/command', desc: isRu ? 'Отправить команду камере' : 'Kameraga buyruq yuborish' },
      ],
    },
    {
      title: isRu ? 'Сотрудники и организации' : 'Xodimlar va tashkilotlar',
      items: [
        { method: 'GET', path: '/api/employees/search', desc: isRu ? 'Поиск сотрудников' : 'Xodimlarni qidirish' },
        { method: 'GET', path: '/api/organizations', desc: isRu ? 'Список организаций' : "Tashkilotlar ro'yxati" },
        { method: 'GET', path: '/api/holidays', desc: isRu ? 'Праздники' : 'Bayramlar' },
      ],
    },
    {
      title: isRu ? 'Система' : 'Tizim',
      items: [
        { method: 'GET', path: '/api/settings', desc: isRu ? 'Настройки системы' : 'Tizim sozlamalari' },
        { method: 'PUT', path: '/api/settings', desc: isRu ? 'Сохранить настройки' : 'Sozlamalarni saqlash' },
        { method: 'GET', path: '/api/isup-status', desc: isRu ? 'Статус ISUP' : 'ISUP holati' },
        { method: 'GET', path: '/api/redis/status', desc: isRu ? 'Статус Redis' : 'Redis holati' },
      ],
    },
  ]

  const methodColors = { GET: '#10b981', POST: '#3b82f6', PUT: '#f59e0b', DELETE: '#ef4444', PATCH: '#a855f7' }

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge="✦ API"
        title="API Helper"
        sub={isRu ? 'Часто используемые конечные точки' : 'Tez-tez ishlatiladigan endpointlar'}
        right={
          <a
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 16px', borderRadius: 8,
              background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)',
              color: '#fff', fontSize: 13, fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <OpenRegular fontSize={16} /> Swagger /docs
          </a>
        }
      />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px 80px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {groups.map(group => (
            <div key={group.title} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 0, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <PlugConnectedRegular style={{ color: 'var(--accent)' }} /> {group.title}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {group.items.map((ep, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', background: 'var(--bg)', borderRadius: 8,
                      border: '1px solid var(--border)',
                    }}
                  >
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
                      background: (methodColors[ep.method] || '#64748b') + '22',
                      color: methodColors[ep.method] || '#64748b',
                      textTransform: 'uppercase', minWidth: 50, textAlign: 'center',
                      letterSpacing: 0.5,
                    }}>
                      {ep.method}
                    </span>
                    <code style={{ fontSize: 12, color: 'var(--text-1)', fontFamily: 'monospace', flex: 1, wordBreak: 'break-all' }}>{ep.path}</code>
                    <span style={{ fontSize: 11, color: 'var(--text-4)', textAlign: 'right', maxWidth: 260 }}>{ep.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
