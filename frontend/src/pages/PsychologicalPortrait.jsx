import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BrainCircuitRegular,
  ArrowSyncRegular,
  PersonRegular,
  CalendarRegular,
  HeartRegular,
  ChartMultipleRegular,
  EmojiRegular,
  InfoRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import Skeleton from '../components/Skeleton'

/**
 * Psixologik Portret sahifasi.
 *
 * Backend:
 *   GET /api/psychological-portrait?organization_id=&year=&month=&day=&limit=
 *
 * Sahifa imkoniyatlari:
 *   • 4 ta katta stat kartasi (jami xodim, davr yozuvlari, qamrov %, daraja)
 *   • Yil/oy/kun filtrlari (server qaytarayotgan ro'yxatlar asosida)
 *   • O'rtacha emotsiya profili (top emotsiyalar foiz bilan)
 *   • Holat va manba breakdown (count bo'yicha bar)
 *   • So'nggi yozuvlar jadvali — xodim avatari, snapshot, holat pill, ishonchlilik, sana
 *   • Snapshot lightbox
 *   • Skeleton dastlabki yuklanishda
 */

const LEVEL_TONES = {
  stable:    { color: '#10b981', label_uz: 'Barqaror',          label_ru: 'Стабильный' },
  moderate:  { color: '#f59e0b', label_uz: "O'rtacha",          label_ru: 'Умеренный' },
  attention: { color: '#f43f5e', label_uz: 'Kuzatuv kerak',     label_ru: 'Требует внимания' },
}

export default function PsychologicalPortrait() {
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'

  const [data, setData] = useState(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const [year, setYear] = useState('all')
  const [month, setMonth] = useState('all')
  const [day, setDay] = useState('all')
  const [limit, setLimit] = useState(60)
  const [lightbox, setLightbox] = useState(null)

  const aliveRef = useRef(true)

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setRefreshing(true)
    try {
      const params = new URLSearchParams({ limit: String(limit) })
      if (year && year !== 'all')   params.set('year', year)
      if (month && month !== 'all') params.set('month', month)
      if (day && day !== 'all')     params.set('day', day)

      const res = await fetch(`/api/psychological-portrait?${params}`, { credentials: 'include' })
      if (!res.ok) {
        if (res.status === 401) throw new Error(isRu ? 'Не авторизован' : 'Avtorizatsiya talab qilinadi')
        throw new Error(`HTTP ${res.status}`)
      }
      const json = await res.json()
      if (aliveRef.current) {
        setData(json)
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
  }, [year, month, day, limit, isRu])

  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  useEffect(() => {
    setInitialLoading(true)
    load({ silent: true })
  }, [load])

  const showSkeleton = initialLoading && !data

  const filterYears  = data?.filters?.years  || []
  const filterMonths = data?.filters?.months || []
  const filterDays   = data?.filters?.days   || []
  const stats   = data?.stats   || {}
  const average = data?.average || {}
  const states  = data?.state_breakdown  || []
  const sources = data?.source_breakdown || []
  const items   = data?.items   || []

  const levelTone = LEVEL_TONES[stats.level] || { color: 'var(--text-4)', label_uz: '—', label_ru: '—' }

  const maxStateCount = useMemo(() => Math.max(1, ...states.map(s => s.count || 0)), [states])
  const maxSourceCount = useMemo(() => Math.max(1, ...sources.map(s => s.count || 0)), [sources])

  // average.emotion_scores — { key: 0..1 } -> top sorted
  const avgEmotions = useMemo(() => {
    const obj = average?.emotion_scores || {}
    return Object.entries(obj)
      .map(([k, v]) => ({ key: k, value: Number(v) || 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
  }, [average])

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={isRu ? '✦ Психология' : '✦ Psixologiya'}
        title={isRu ? 'Психологический портрет' : 'Psixologik portret'}
        sub={isRu
          ? 'Эмоциональная картина по сотрудникам (только для наблюдения)'
          : "Xodimlar bo'yicha emotsional manzara (faqat kuzatuv uchun)"}
        right={
          <button
            onClick={() => load()}
            disabled={refreshing || initialLoading}
            style={refreshBtnStyle(refreshing || initialLoading)}
          >
            <ArrowSyncRegular fontSize={16} style={{ animation: (refreshing || initialLoading) ? 'spin 1s linear infinite' : 'none' }} />
            {isRu ? 'Обновить' : 'Yangilash'}
          </button>
        }
      />
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .portrait-container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 24px 32px 80px;
        }
        .portrait-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
          margin-bottom: 18px;
        }
        @media (max-width: 900px) {
          .portrait-container {
            padding: 16px 16px 60px !important;
          }
          .portrait-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="portrait-container">
        {error && <div style={errBannerStyle}>{error}</div>}

        {/* Filtrlar */}
        <div style={{ ...cardStyle, marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ flex: '1 1 160px' }}>
              <FieldLabel>{isRu ? 'Год' : 'Yil'}</FieldLabel>
              <select value={year} onChange={e => { setYear(e.target.value); setMonth('all'); setDay('all') }} style={inpStyle}>
                <option value="all">{isRu ? 'Все' : 'Hammasi'}</option>
                {filterYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <FieldLabel>{isRu ? 'Месяц' : 'Oy'}</FieldLabel>
              <select value={month} onChange={e => { setMonth(e.target.value); setDay('all') }} style={inpStyle}>
                <option value="all">{isRu ? 'Все' : 'Hammasi'}</option>
                {filterMonths.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <FieldLabel>{isRu ? 'День' : 'Kun'}</FieldLabel>
              <select value={day} onChange={e => setDay(e.target.value)} style={inpStyle}>
                <option value="all">{isRu ? 'Все' : 'Hammasi'}</option>
                {filterDays.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <FieldLabel>{isRu ? 'Лимит записей' : 'Yozuv limiti'}</FieldLabel>
              <select value={limit} onChange={e => setLimit(Number(e.target.value))} style={inpStyle}>
                {[20, 60, 120, 200, 300].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            {(year !== 'all' || month !== 'all' || day !== 'all') && (
              <button
                type="button"
                onClick={() => { setYear('all'); setMonth('all'); setDay('all') }}
                style={{
                  height: 36, padding: '0 14px', borderRadius: 8,
                  background: 'var(--surface-2)', color: 'var(--text-2)',
                  border: '1px solid var(--border-2)', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {isRu ? 'Сбросить' : 'Tozalash'}
              </button>
            )}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-4)' }}>
            <InfoRegular fontSize={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {isRu
              ? 'Это не медицинский диагноз — только наблюдение и аналитика.'
              : 'Bu tibbiy tashxis emas — faqat kuzatuv va tahlil.'}
          </div>
        </div>

        {/* Stat kartalari */}
        {showSkeleton ? (
          <div style={{ marginBottom: 18 }}>
            <Skeleton.Stats count={4} />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 18 }}>
            <BigStatCard
              icon={<PersonRegular fontSize={20} />}
              label={isRu ? 'Сотрудники' : 'Xodimlar'}
              value={stats.total_employees ?? 0}
              hint={isRu ? 'В вашей зоне доступа' : "Sizning ruxsat doirangizda"}
              color="#3b82f6"
            />
            <BigStatCard
              icon={<ChartMultipleRegular fontSize={20} />}
              label={isRu ? 'Записи за период' : 'Davr yozuvlari'}
              value={stats.period_records ?? 0}
              hint={`${stats.selected_employees ?? 0} ${isRu ? 'сотр.' : 'xodim'}`}
              color="#a855f7"
            />
            <BigStatCard
              icon={<TopProgress percent={stats.coverage_percent ?? 0} />}
              label={isRu ? 'Покрытие' : 'Qamrov'}
              value={`${stats.coverage_percent ?? 0}%`}
              hint={isRu ? 'Доля сотрудников с записями' : 'Yozuvlari bor xodimlar foizi'}
              color="#22c55e"
            />
            <BigStatCard
              icon={<HeartRegular fontSize={20} />}
              label={isRu ? 'Уровень' : 'Daraja'}
              value={isRu ? levelTone.label_ru : levelTone.label_uz}
              hint={stats.latest_at ? formatDateTime(stats.latest_at) : (isRu ? 'Нет данных' : "Ma'lumot yo'q")}
              color={levelTone.color}
            />
          </div>
        )}

        {/* O'rtacha profil + Holat breakdown */}
        <div className="portrait-grid">
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>
              <EmojiRegular style={{ color: '#a855f7' }} />
              {isRu ? 'Средний профиль эмоций' : "O'rtacha emotsiya profili"}
            </h3>
            {showSkeleton ? (
              <div style={{ marginTop: 14 }}>
                <Skeleton width="60%" height={16} />
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} width="100%" height={12} />)}
                </div>
              </div>
            ) : (
              <>
                <div style={{ marginTop: 8, padding: 12, background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    {isRu ? 'Ключевой профиль' : 'Asosiy profil'}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 15, fontWeight: 700 }}>
                    {(isRu ? average?.profile_text_ru : average?.profile_text_uz) || '—'}
                  </div>
                </div>
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {avgEmotions.length === 0 ? (
                    <div style={{ color: 'var(--text-4)', fontSize: 13 }}>
                      {isRu ? 'Эмоции отсутствуют' : "Emotsiya ma'lumoti yo'q"}
                    </div>
                  ) : avgEmotions.map(e => {
                    const pct = Math.round((e.value || 0) * 100)
                    const tone = emotionTone(e.key)
                    return (
                      <div key={e.key} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 50px', alignItems: 'center', gap: 10 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{labelEmotion(e.key, isRu)}</div>
                        <div style={{ background: 'var(--bg)', borderRadius: 999, height: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
                          <div style={{
                            width: `${pct}%`, height: '100%', borderRadius: 999,
                            background: tone, transition: 'width 0.4s ease',
                          }} />
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: tone, textAlign: 'right' }}>{pct}%</div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>
              <ChartMultipleRegular style={{ color: '#3b82f6' }} />
              {isRu ? 'Распределение состояний' : 'Holatlar taqsimoti'}
            </h3>
            {showSkeleton ? (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} width="100%" height={18} />)}
              </div>
            ) : states.length === 0 ? (
              <div style={{ marginTop: 14, padding: 16, color: 'var(--text-4)', fontSize: 13, textAlign: 'center' }}>
                {isRu ? 'Нет данных за период' : "Tanlangan davr uchun yozuv yo'q"}
              </div>
            ) : (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {states.map(s => {
                  const pct = Math.round(100 * (s.count || 0) / maxStateCount)
                  const tone = emotionTone(s.state_key)
                  return (
                    <div key={s.state_key} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 50px', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {labelEmotion(s.state_key, isRu)}
                      </div>
                      <div style={{ background: 'var(--bg)', borderRadius: 6, height: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: tone + '88', borderRadius: 6 }} />
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', textAlign: 'right' }}>{s.count}</div>
                    </div>
                  )
                })}
              </div>
            )}

            {!showSkeleton && sources.length > 0 && (
              <>
                <div style={{ marginTop: 16, fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  {isRu ? 'Источники' : 'Manbalar'}
                </div>
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {sources.map(s => (
                    <span key={s.source} style={{
                      padding: '4px 10px', borderRadius: 999,
                      background: 'var(--surface-2)', border: '1px solid var(--border-2)',
                      color: 'var(--text-2)', fontSize: 11, fontWeight: 600,
                    }}>
                      {s.source} · {s.count}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* So'nggi yozuvlar jadvali */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
            <h3 style={cardTitleStyle}>
              <BrainCircuitRegular style={{ color: '#a855f7' }} />
              {isRu ? "Последние записи" : "So'nggi yozuvlar"}
            </h3>
            <div style={{ fontSize: 12, color: 'var(--text-4)' }}>
              {items.length} {isRu ? 'результат' : 'natija'}
            </div>
          </div>

          {showSkeleton ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: 6 }).map((_, i) => <Skeleton.Row key={i} />)}
            </div>
          ) : items.length === 0 ? (
            <div style={emptyStyle}>
              {isRu ? 'Записей за выбранный период нет.' : "Tanlangan davr uchun yozuv yo'q."}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {[
                      isRu ? 'Сотрудник' : 'Xodim',
                      isRu ? 'Профиль' : 'Profil',
                      isRu ? 'Топ эмоции' : 'Top emotsiyalar',
                      isRu ? 'Уверенность' : 'Ishonchlilik',
                      isRu ? 'Дата' : 'Sana',
                      isRu ? 'Снимок' : 'Snapshot',
                    ].map((h, i) => <th key={i} style={thStyle}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {items.map(it => (
                    <tr key={it.id}>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {it.employee?.avatar
                            ? <img src={it.employee.avatar} alt="" style={avatarImg} onError={e => { e.target.style.display = 'none' }} />
                            : <div style={avatarFallback}><PersonRegular fontSize={16} /></div>}
                          <div>
                            <div style={{ fontWeight: 600 }}>{it.employee?.full_name || '—'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-4)' }}>
                              {it.employee?.personal_id || `#${it.employee?.id || it.id}`}
                              {it.employee?.organization_name && <> · {it.employee.organization_name}</>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <StatePill stateKey={it.state_key} text={isRu ? it.state_ru || it.profile_text_ru : it.state_uz || it.profile_text_uz} />
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {((isRu ? it.top_emotions_ru : it.top_emotions_uz) || []).slice(0, 3).map((e, i) => {
                            const text = (e && typeof e === 'object')
                              ? (e.label || (isRu ? e.label_ru : e.label_uz) || labelEmotion(e.key, isRu))
                              : String(e ?? '')
                            const pct = e && typeof e === 'object' && e.percent != null
                              ? ` ${Number(e.percent).toFixed(0)}%`
                              : ''
                            return (
                              <span key={i} style={{
                                fontSize: 11, padding: '2px 7px', borderRadius: 999,
                                background: 'var(--surface-2)', border: '1px solid var(--border-2)',
                                color: 'var(--text-2)',
                              }}>{text}{pct}</span>
                            )
                          })}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <ConfidenceBar value={it.confidence} />
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                          <CalendarRegular fontSize={13} style={{ color: 'var(--text-4)' }} />
                          {it.state_date}
                        </div>
                        {it.assessed_at && (
                          <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>{formatDateTime(it.assessed_at)}</div>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {it.snapshot_url ? (
                          <button
                            onClick={() => setLightbox(it)}
                            title={isRu ? 'Открыть снимок' : 'Snapshot ochish'}
                            style={{
                              width: 44, height: 44, borderRadius: 6,
                              padding: 0, border: '1px solid var(--border-2)',
                              background: 'var(--bg)', cursor: 'pointer', overflow: 'hidden',
                            }}
                          >
                            <img
                              src={it.snapshot_url}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              onError={e => { e.currentTarget.style.display = 'none' }}
                            />
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-4)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && lightbox.snapshot_url && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9998,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 32, cursor: 'zoom-out',
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', textAlign: 'center' }}>
            <img src={lightbox.snapshot_url} alt="" style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 12 }} />
            <div style={{ marginTop: 12, color: '#fff', fontSize: 13 }}>
              <div style={{ fontWeight: 700 }}>{lightbox.employee?.full_name || '—'}</div>
              <div style={{ opacity: 0.7, marginTop: 4 }}>
                {(isRu ? lightbox.profile_text_ru : lightbox.profile_text_uz) || lightbox.state_key}
                {' · '}{lightbox.state_date}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers / pieces
// ────────────────────────────────────────────────────────────────────────────

const EMOTION_LABELS_UZ = {
  happy: 'baxtli', sad: "g'amgin", anger: "g'azab", angry: "g'azab",
  fear: 'qo\'rquv', disgust: 'jirkanish', surprise: 'hayrat',
  neutral: 'xotirjam', contempt: 'mensimaslik',
  undetermined: 'aniqlanmadi',
}
const EMOTION_LABELS_RU = {
  happy: 'счастье', sad: 'грусть', anger: 'гнев', angry: 'гнев',
  fear: 'страх', disgust: 'отвращение', surprise: 'удивление',
  neutral: 'спокойствие', contempt: 'презрение',
  undetermined: 'не определено',
}
const EMOTION_COLORS = {
  happy: '#22c55e', neutral: '#3b82f6', sad: '#64748b',
  anger: '#f43f5e', angry: '#f43f5e', fear: '#a855f7',
  disgust: '#84cc16', surprise: '#06b6d4', contempt: '#f59e0b',
  undetermined: '#94a3b8',
}

function labelEmotion(key, isRu) {
  const k = String(key || '').toLowerCase()
  return (isRu ? EMOTION_LABELS_RU[k] : EMOTION_LABELS_UZ[k]) || key || '—'
}

function emotionTone(key) {
  return EMOTION_COLORS[String(key || '').toLowerCase()] || '#64748b'
}

function formatDateTime(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function BigStatCard({ icon, label, value, hint, color }) {
  return (
    <div style={{
      padding: '16px 18px', background: 'var(--surface)',
      border: '1px solid var(--border)', borderRadius: 12,
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
        background: color + '22', color, border: `1px solid ${color}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
        {hint && <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hint}</div>}
      </div>
    </div>
  )
}

function TopProgress({ percent }) {
  const p = Math.max(0, Math.min(100, percent || 0))
  return (
    <div style={{ position: 'relative', width: 22, height: 22 }}>
      <svg viewBox="0 0 36 36" style={{ width: 22, height: 22 }}>
        <circle cx="18" cy="18" r="14" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" fill="none" />
        <circle cx="18" cy="18" r="14" stroke="currentColor" strokeWidth="4" fill="none"
          strokeDasharray={`${(p / 100) * 88} 88`} strokeLinecap="round"
          transform="rotate(-90 18 18)" />
      </svg>
    </div>
  )
}

function StatePill({ stateKey, text }) {
  const tone = emotionTone(stateKey)
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 999,
      background: tone + '22', color: tone, border: `1px solid ${tone}55`,
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {text || stateKey || '—'}
    </span>
  )
}

function ConfidenceBar({ value }) {
  if (value == null) return <span style={{ color: 'var(--text-4)' }}>—</span>
  const pct = Math.round((Number(value) || 0) * 100)
  const color = pct >= 75 ? '#10b981' : pct >= 45 ? '#f59e0b' : '#f43f5e'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--bg)', borderRadius: 999, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color }}>{pct}%</span>
    </div>
  )
}

function FieldLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>
      {children}
    </div>
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

const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }
const cardTitleStyle = { fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }
const errBannerStyle = { marginBottom: 18, padding: 12, background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, border: '1px solid var(--red-bd)' }
const inpStyle = {
  width: '100%', padding: '8px 11px', borderRadius: 7,
  border: '1px solid var(--border-2)', background: 'var(--bg)',
  color: 'var(--text-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  height: 36,
}
const tableStyle = { width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }
const thStyle = {
  textAlign: 'left', padding: '10px 12px', fontSize: 11,
  fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase',
  letterSpacing: 0.4, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
}
const tdStyle = { padding: '10px 12px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
const emptyStyle = { padding: 32, textAlign: 'center', color: 'var(--text-4)', fontSize: 13, background: 'var(--bg)', borderRadius: 8, border: '1px dashed var(--border-2)' }
const avatarImg = { width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }
const avatarFallback = { width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-2)', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
