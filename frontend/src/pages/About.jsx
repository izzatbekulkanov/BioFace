import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  CameraRegular, ShieldLockRegular, PeopleRegular,
  ChartMultipleRegular, PersonRegular, CalculatorRegular,
  BookRegular, ArrowRightRegular, CheckmarkCircleRegular,
  BuildingRegular, CodeRegular,
} from '@fluentui/react-icons'

const STEP_COLORS  = ['#0078d4', '#038387', '#6264a7', '#8764b8']
const PROB_COLORS  = ['#0078d4', '#038387', '#6264a7', '#8764b8']
const AUDIENCE_COLORS = ['#0078d4', '#038387', '#6264a7', '#8764b8']
const STACK_COLORS = ['#0078d4', '#038387', '#6264a7', '#8764b8']

const STATS = [
  { val: '99.9%', labelKey: 'about.stats.uptime'    },
  { val: '<0.5s', labelKey: 'about.stats.speed'     },
  { val: '10k+',  labelKey: 'about.stats.profiles'  },
  { val: '24/7',  labelKey: 'about.stats.monitoring' },
]

const sectionTitle = {
  fontSize: 14, fontWeight: 700, color: 'var(--text-1)',
  marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
}

export default function About() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const steps = [
    { n:1, color: STEP_COLORS[0], icon: <CameraRegular fontSize={20}/>,        title: t('about.steps.s1title'), desc: t('about.steps.s1desc') },
    { n:2, color: STEP_COLORS[1], icon: <ChartMultipleRegular fontSize={20}/>, title: t('about.steps.s2title'), desc: t('about.steps.s2desc') },
    { n:3, color: STEP_COLORS[2], icon: <ShieldLockRegular fontSize={20}/>,    title: t('about.steps.s3title'), desc: t('about.steps.s3desc') },
    { n:4, color: STEP_COLORS[3], icon: <BookRegular fontSize={20}/>,          title: t('about.steps.s4title'), desc: t('about.steps.s4desc') },
  ]

  const probs = [
    { color: PROB_COLORS[0], icon: <BookRegular fontSize={18}/>,         title: t('about.problems.p1title'), desc: t('about.problems.p1desc') },
    { color: PROB_COLORS[1], icon: <ShieldLockRegular fontSize={18}/>,   title: t('about.problems.p2title'), desc: t('about.problems.p2desc') },
    { color: PROB_COLORS[2], icon: <CalculatorRegular fontSize={18}/>,   title: t('about.problems.p3title'), desc: t('about.problems.p3desc') },
    { color: PROB_COLORS[3], icon: <PeopleRegular fontSize={18}/>,       title: t('about.problems.p4title'), desc: t('about.problems.p4desc') },
  ]

  const audience = [
    { color: AUDIENCE_COLORS[0], icon: <PersonRegular fontSize={20}/>,      title: t('about.audience.a1title'), desc: t('about.audience.a1desc') },
    { color: AUDIENCE_COLORS[1], icon: <CalculatorRegular fontSize={20}/>,  title: t('about.audience.a2title'), desc: t('about.audience.a2desc') },
    { color: AUDIENCE_COLORS[2], icon: <ShieldLockRegular fontSize={20}/>,  title: t('about.audience.a3title'), desc: t('about.audience.a3desc') },
    { color: AUDIENCE_COLORS[3], icon: <BuildingRegular fontSize={20}/>,    title: t('about.audience.a4title'), desc: t('about.audience.a4desc') },
  ]

  const stack = [
    { color: STACK_COLORS[0], icon: <CodeRegular fontSize={18}/>,         name: 'FastAPI',         desc: 'Backend API'  },
    { color: STACK_COLORS[1], icon: <CameraRegular fontSize={18}/>,        name: 'Hikvision ISUP', desc: 'SDK / ISUP'   },
    { color: STACK_COLORS[2], icon: <ChartMultipleRegular fontSize={18}/>, name: 'React + Vite',   desc: 'Frontend UI'  },
    { color: STACK_COLORS[3], icon: <ShieldLockRegular fontSize={18}/>,    name: 'SQLite / JWT',   desc: 'DB / Auth'    },
  ]

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', padding: '40px 24px 80px', overflowY: 'auto' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'inline-block', background: 'var(--accent-bg)', border: '1px solid var(--accent-bd)', borderRadius: 100, padding: '4px 14px', marginBottom: 14, fontSize: 12, color: 'var(--accent-tx)' }}>
            ✦ {t('about.heading')}
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: 'var(--white)', marginBottom: 8, letterSpacing: -0.5 }}>BioFace</h1>
          <p style={{ fontSize: 14, color: 'var(--text-4)', maxWidth: 520, lineHeight: 1.7 }}>{t('about.sub')}</p>
        </div>

        {/* Stats bar */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, display: 'flex', marginBottom: 24, overflow: 'hidden' }}>
          {STATS.map((s, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', padding: '20px 10px', borderRight: i < STATS.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', letterSpacing: -0.5 }}>{s.val}</div>
              <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>{t(s.labelKey)}</div>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px', marginBottom: 16 }}>
          <div style={sectionTitle}><CheckmarkCircleRegular fontSize={17} color="#0078d4" />{t('about.howTitle')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {steps.map(s => (
              <div key={s.n} style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '16px 14px' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = s.color + '55'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-2)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: s.color, color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.n}</div>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: s.color + '18', border: `1px solid ${s.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>{s.icon}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 5 }}>{s.title}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-4)', lineHeight: 1.55 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Problems */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ ...sectionTitle, paddingLeft: 2 }}><ShieldLockRegular fontSize={17} color="#0078d4" />{t('about.probTitle')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {probs.map((p, i) => (
              <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = p.color + '44'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ width: 38, height: 38, borderRadius: 9, background: p.color + '18', border: `1px solid ${p.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: p.color, marginBottom: 10 }}>{p.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 5 }}>{p.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', lineHeight: 1.6 }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Audience */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px', marginBottom: 16 }}>
          <div style={sectionTitle}><PeopleRegular fontSize={17} color="#0078d4" />{t('about.audTitle')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {audience.map((a, i) => (
              <div key={i} style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '16px' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = a.color + '55'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-2)'}
              >
                <div style={{ width: 40, height: 40, borderRadius: 10, background: a.color + '18', border: `1px solid ${a.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: a.color, marginBottom: 10 }}>{a.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 5 }}>{a.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', lineHeight: 1.6 }}>{a.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Stack */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px', marginBottom: 16 }}>
          <div style={sectionTitle}><CodeRegular fontSize={17} color="#0078d4" />{t('about.stackTitle')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {stack.map((s, i) => (
              <div key={i} style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}
                onMouseEnter={e => e.currentTarget.style.borderColor = s.color + '55'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-2)'}
              >
                <div style={{ width: 36, height: 36, borderRadius: 9, background: s.color + '18', border: `1px solid ${s.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, flexShrink: 0 }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Author */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--accent-bd)', borderRadius: 14, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 18, marginBottom: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0 }}>IU</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', marginBottom: 5 }}>{t('about.authorName')}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-4)', lineHeight: 1.65 }}>{t('about.authorDesc')}</div>
          </div>
        </div>

        {/* CTA */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--accent-bd)', borderRadius: 14, padding: '28px', textAlign: 'center' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--white)', marginBottom: 8 }}>{t('about.ctaTitle')}</h2>
          <p style={{ color: 'var(--text-4)', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>{t('about.ctaDesc')}</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/login')} style={{ padding: '9px 20px', borderRadius: 7, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-h)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--accent)'}
            ><ArrowRightRegular fontSize={15} />{t('about.ctaLogin')}</button>
            <button onClick={() => navigate('/contact')} style={{ padding: '9px 20px', borderRadius: 7, background: 'var(--accent-bg)', border: '1px solid var(--accent-bd)', color: 'var(--accent-tx)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-bd)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--accent-bg)'}
            >{t('about.ctaContact')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
