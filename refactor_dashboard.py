import os
import re

html_path = 'templates/dashboard.html'
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Pre-clean overlaps to avoid duplicating or conflicting classes
html = html.replace('dashboard-kpi-grid mt-4 grid gap-3 grid-cols-2 lg:grid-cols-4 xl:grid-cols-8', 'dashboard-kpi-grid')
html = html.replace('dashboard-kpi rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-800 dark:bg-gray-950/50', 'dashboard-kpi')
html = html.replace('dashboard-subcard rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/50', 'dashboard-subcard')
html = html.replace('dashboard-empty rounded-3xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center dark:border-gray-700 dark:bg-gray-900', 'dashboard-empty px-6 py-12 text-center')

replacements = {
    'dashboard-page': '',
    'dashboard-card': 'rounded-[1.5rem] border border-slate-200 bg-gradient-to-b from-white/90 to-slate-50/95 p-[1.05rem] shadow-[0_24px_44px_-34px_rgba(15,23,42,0.34)] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_32px_56px_-38px_rgba(15,23,42,0.38)] dark:border-slate-700 dark:from-gray-900/90 dark:to-slate-900/95 dark:shadow-[0_28px_52px_-32px_rgba(2,6,23,0.82)] dark:hover:shadow-[0_36px_60px_-36px_rgba(2,6,23,0.88)]',
    'dashboard-section': 'relative overflow-hidden p-4',
    'dashboard-hero-backdrop': 'absolute inset-0 pointer-events-none',
    'dashboard-hero-orb orb-one': 'absolute rounded-full blur-[18px] opacity-55 -top-8 -right-8 w-40 h-40 bg-[radial-gradient(circle,rgba(96,165,250,0.42),transparent_68%)]',
    'dashboard-hero-orb orb-two': 'absolute rounded-full blur-[18px] opacity-55 left-[18%] -bottom-8 w-32 h-32 bg-[radial-gradient(circle,rgba(52,211,153,0.28),transparent_70%)]',
    'dashboard-hero-orb orb-three': 'absolute rounded-full blur-[18px] opacity-55 top-[30%] right-[34%] w-24 h-24 bg-[radial-gradient(circle,rgba(14,165,233,0.22),transparent_70%)]',
    'dashboard-hero-copy': 'relative z-10',
    'dashboard-hero-pill-row': 'flex flex-wrap gap-2',
    'dashboard-hero-pill is-muted': 'inline-flex items-center px-[0.78rem] py-[0.45rem] rounded-full border border-slate-400/20 bg-white/72 text-slate-600 text-[0.68rem] font-extrabold tracking-[0.14em] uppercase dark:border-slate-700/82 dark:bg-slate-900/68 dark:text-slate-300',
    'dashboard-hero-pill': 'inline-flex items-center px-[0.78rem] py-[0.45rem] rounded-full border border-blue-400/24 bg-blue-50/80 text-blue-700 text-[0.68rem] font-extrabold tracking-[0.14em] uppercase dark:border-blue-400/28 dark:bg-blue-900/22 dark:text-blue-200',
    'dashboard-hero-ticker': 'inline-flex items-center gap-[0.55rem] px-[0.88rem] py-[0.62rem] rounded-full border border-slate-400/20 bg-white/68 text-slate-700 text-[0.78rem] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-slate-700/82 dark:bg-slate-900/70 dark:text-slate-200 before:content-[\'\'] before:w-[0.45rem] before:h-[0.45rem] before:rounded-full before:bg-blue-600 before:shadow-[0_0_0_6px_rgba(59,130,246,0.16)]',
    'dashboard-hero-mini-card is-emerald': 'rounded-[1.05rem] border border-white/52 p-[0.95rem] bg-[linear-gradient(135deg,rgba(236,253,245,0.92),rgba(209,250,229,0.78))] backdrop-blur-[16px] shadow-[0_18px_30px_-28px_rgba(15,23,42,0.28)] dark:border-slate-700/82 dark:bg-[linear-gradient(135deg,rgba(6,78,59,0.42),rgba(5,46,22,0.34))]',
    'dashboard-hero-mini-card is-sky': 'rounded-[1.05rem] border border-white/52 p-[0.95rem] bg-[linear-gradient(135deg,rgba(239,246,255,0.94),rgba(224,242,254,0.8))] backdrop-blur-[16px] shadow-[0_18px_30px_-28px_rgba(15,23,42,0.28)] dark:border-slate-700/82 dark:bg-[linear-gradient(135deg,rgba(14,116,144,0.36),rgba(15,23,42,0.4))]',
    'dashboard-hero-mini-card is-amber': 'rounded-[1.05rem] border border-white/52 p-[0.95rem] bg-[linear-gradient(135deg,rgba(255,251,235,0.94),rgba(254,243,199,0.78))] backdrop-blur-[16px] shadow-[0_18px_30px_-28px_rgba(15,23,42,0.28)] dark:border-slate-700/82 dark:bg-[linear-gradient(135deg,rgba(120,53,15,0.42),rgba(15,23,42,0.4))]',
    'dashboard-hero-panel-top': 'flex flex-col md:flex-row items-start justify-between gap-4',
    'dashboard-hero-panel-kicker': 'text-[0.7rem] font-extrabold tracking-[0.16em] uppercase text-blue-600 dark:text-sky-300',
    'dashboard-hero-panel-title': 'mt-[0.35rem] text-[1.2rem] font-extrabold leading-[1.2] text-slate-900 dark:text-slate-50',
    'dashboard-hero-panel-text': 'mt-[0.75rem] text-[0.82rem] leading-[1.6] text-slate-600 dark:text-slate-300',
    'dashboard-hero-panel': 'relative z-10 h-full rounded-[1.2rem] border border-slate-400/16 p-4 bg-white/76 shadow-[inset_0_1px_0_rgba(255,255,255,0.62)] backdrop-blur-[18px] dark:border-slate-700/82 dark:bg-slate-950/72',
    'dashboard-hero-score-ring': 'relative inline-flex flex-col items-center justify-center w-[5.3rem] h-[5.3rem] md:w-[4.8rem] md:h-[4.8rem] rounded-full shrink-0 bg-[conic-gradient(rgb(37,99,235)_0_var(--score),rgba(148,163,184,0.18)_var(--score)_100%)] before:content-[\'\'] before:absolute before:inset-[0.45rem] before:rounded-full before:bg-white/92 dark:before:bg-slate-900/96',
    'dashboard-hero-score-value': 'relative z-10 text-[1.2rem] font-extrabold text-slate-900 leading-none dark:text-slate-50',
    'dashboard-hero-score-label': 'relative z-10 mt-[0.12rem] text-[0.62rem] font-bold text-slate-500 dark:text-slate-400',
    'dashboard-hero-meter-row': 'flex items-center justify-between gap-3 text-[0.78rem] text-slate-600 dark:text-slate-300 [&>strong]:text-slate-900 [&>strong]:dark:text-slate-50',
    'dashboard-hero-meter-track': 'h-[0.42rem] rounded-full bg-slate-200/92 overflow-hidden dark:bg-slate-800/92',
    'dashboard-hero-meter-bar is-emerald': 'h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600',
    'dashboard-hero-meter-bar is-sky': 'h-full rounded-full bg-gradient-to-r from-sky-400 to-sky-600',
    'dashboard-hero-meter-bar is-amber': 'h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600',
    'dashboard-hero-meter': 'flex flex-col gap-[0.42rem]',
    'dashboard-hero-info-card': 'rounded-[0.95rem] border border-slate-400/16 bg-white/64 px-[0.72rem] py-[0.78rem] md:px-[0.65rem] md:py-[0.7rem] dark:border-slate-700/82 dark:bg-slate-900/62',
    'dashboard-hero-info-label': 'text-[0.65rem] font-bold tracking-[0.12em] uppercase text-slate-500 dark:text-slate-400',
    'dashboard-hero-info-value': 'mt-[0.35rem] text-[1.2rem] font-extrabold text-slate-900 dark:text-slate-50',
    'dashboard-kpi-head': 'flex items-start justify-between gap-3',
    'dashboard-kpi-icon': 'inline-flex items-center justify-center w-8 h-8 rounded-[0.9rem] bg-blue-50/90 text-blue-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] dark:bg-blue-900/28 dark:text-blue-200',
    'dashboard-kpi-grid': 'mt-4 grid gap-3 grid-cols-2 lg:grid-cols-4 xl:grid-cols-8',
    'dashboard-kpi': 'flex flex-col justify-between rounded-[1rem] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.8),rgba(248,250,252,0.96))] px-[0.9rem] py-[0.85rem] dark:border-slate-700 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(17,24,39,0.96))]',
    'dashboard-subcard': 'rounded-[0.95rem] border border-slate-200 bg-slate-50/50 p-[0.85rem] dark:border-slate-800 dark:bg-slate-900/50',
    'dashboard-empty': 'rounded-3xl border border-dashed border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900',
    'dashboard-hero': 'rounded-[1.7rem] border-slate-400/20 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.2),transparent_26%),radial-gradient(circle_at_left_bottom,rgba(16,185,129,0.12),transparent_22%),linear-gradient(135deg,rgba(255,255,255,0.94),rgba(248,250,252,0.98))] dark:border-blue-500/20 dark:bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.26),transparent_28%),radial-gradient(circle_at_left_bottom,rgba(14,165,233,0.16),transparent_24%),linear-gradient(135deg,rgba(2,6,23,0.94),rgba(15,23,42,0.98))]',
}

# Order by length of key in descending order to avoid partial matches
sorted_keys = sorted(replacements.keys(), key=len, reverse=True)
for old_cls in sorted_keys:
    html = html.replace(old_cls, replacements[old_cls])

# Other generic replacements
html = html.replace('class="mt-3 text-2xl font-bold text-gray-900 dark:text-white"', 'class="mt-3 text-[1.7rem] leading-[1.15] font-bold text-gray-900 dark:text-white"')
html = html.replace('class="mt-1 text-2xl font-bold text-gray-900 dark:text-white"', 'class="mt-1 text-[1.7rem] leading-[1.15] font-bold text-gray-900 dark:text-white"')

html = re.sub(r'\bh-80\b', 'h-[18.5rem] lg:h-[16rem]', html)
html = re.sub(r'\bh-64\b', 'h-[15.5rem] lg:h-[13.75rem]', html)
html = re.sub(r'\bh-56\b', 'h-[13.5rem]', html)

# Clean up extra spaces inside class strings only
def clean_class_spaces(match):
    cls = match.group(1)
    cls = re.sub(r'\s+', ' ', cls).strip()
    return f'class="{cls}"'

html = re.sub(r'class="([^"]+)"', clean_class_spaces, html)

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Dashboard HTML successfully updated.")