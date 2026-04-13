import os
import re

html_path = 'templates/devices.html'
js_path = 'static/js/devices-table.js'
css_path = 'static/css/global-overrides.css'

# Update HTML
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

replacements_html = {
    'camera-hero': 'overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-600 shadow-xl',
    'camera-hero-grid': 'grid gap-4 p-5 xl:grid-cols-3',
    'camera-hero-badge': 'inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80 backdrop-blur-sm w-max mb-4',
    'camera-hero-title': 'text-3xl font-bold tracking-tight text-white',
    'camera-hero-text': 'max-w-3xl text-sm leading-6 text-blue-100 mt-2',
    'camera-hero-actions': 'mt-4 flex flex-wrap items-center gap-3',
    'camera-soft-chip camera-soft-chip-light': 'inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90 hover:bg-white/20 transition',
    'camera-soft-chip': 'inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-xs font-medium text-white/80 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
    'camera-summary-grid': 'grid gap-3 sm:grid-cols-2 xl:col-span-2',
    'camera-summary-card': 'rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm relative overflow-hidden',
    'camera-summary-top': 'absolute right-4 top-4 text-white/20 text-4xl',
    'camera-summary-icon': 'block',
    'camera-summary-label': 'text-xs font-semibold uppercase tracking-wide text-white/80',
    'camera-summary-value': 'mt-2 text-2xl font-bold text-white',
    'camera-summary-meta': 'mt-1 text-xs text-white/80',
    'camera-panel': 'rounded-3xl border border-gray-200 bg-white/80 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80',
    'camera-panel-header': 'flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between mb-4',
    'camera-panel-eyebrow': 'text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-1',
    'camera-panel-title': 'text-lg font-semibold text-gray-900 dark:text-white',
    'camera-panel-text': 'text-sm text-gray-500 dark:text-gray-400 mt-1',
    'camera-readonly-banner': 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 px-4 py-3 text-sm'
}

sorted_keys = sorted(replacements_html.keys(), key=len, reverse=True)
for key in sorted_keys:
    html = html.replace(key, replacements_html[key])

# Clean up any leftover duplicate classes or spaces
html = re.sub(r'class="([^"]+)"', lambda m: f'class="{" ".join(m.group(1).split())}"', html)

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)
print("devices.html successfully updated.")

# Update JS
with open(js_path, 'r', encoding='utf-8') as f:
    js = f.read()

replacements_js = {
    'camera-action-btn': 'inline-flex h-8 w-8 items-center justify-center rounded-lg border transition shadow-sm',
    'camera-device-card': 'flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white/50 p-4 shadow-sm transition hover:bg-gray-50/50 dark:border-gray-700/50 dark:bg-gray-800/50 dark:hover:bg-gray-800/80 relative',
    'camera-device-topline': 'absolute left-0 top-0 h-1 w-full',
    'camera-device-head-left': 'flex items-start gap-3 min-w-0',
    'camera-device-head': 'flex items-start justify-between gap-4 mb-4',
    'camera-device-icon': 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
    'camera-device-name': 'text-sm font-semibold text-gray-900 dark:text-white truncate',
    'camera-device-location': 'text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5',
    'camera-status-pill': 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide',
    'camera-device-grid': 'grid grid-cols-2 gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-3 dark:border-gray-700/50 dark:bg-gray-800/50 mb-4',
    'camera-device-metric-label': 'flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400',
    'camera-device-metric-value': 'text-sm font-semibold text-gray-900 dark:text-white truncate',
    'camera-device-metric': 'flex flex-col gap-1',
    'camera-usage-card': 'rounded-xl border border-gray-100 bg-gray-50/50 p-3 dark:border-gray-700/50 dark:bg-gray-800/50 mb-4',
    'camera-usage-bar': 'h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700',
    'camera-usage-fill': 'h-full rounded-full transition-all duration-500',
    'camera-action-row-left': 'flex items-center gap-2',
    'camera-action-row': 'mt-auto flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-700/50',
    'camera-soft-chip': 'inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300',
    'camera-panel': 'rounded-3xl border border-gray-200 bg-white/80 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80',
}

sorted_js_keys = sorted(replacements_js.keys(), key=len, reverse=True)
for key in sorted_js_keys:
    js = js.replace(key, replacements_js[key])

js = js.replace('const statusClass = online ? "online" : "offline";', 'const statusClass = online ? "bg-emerald-500" : "bg-rose-500";')
js = js.replace('camera-device-topline ${statusClass}', 'absolute left-0 top-0 h-1 w-full ${statusClass}')
js = js.replace('camera-status-pill ${statusClass}', 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${online ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/30 dark:bg-emerald-900/20 dark:text-emerald-400" : "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/30 dark:bg-rose-900/20 dark:text-rose-400"}')

with open(js_path, 'w', encoding='utf-8') as f:
    f.write(js)
print("devices-table.js successfully updated.")

# Update CSS
with open(css_path, 'r', encoding='utf-8') as f:
    css_content = f.read()

start_marker = "/* Device Fleet & Camera UI */"
end_marker = "/* Camera Form Panel */"

if start_marker in css_content and end_marker in css_content:
    start_idx = css_content.find(start_marker)
    end_idx = css_content.find(end_marker)
    new_css = css_content[:start_idx] + css_content[end_idx:]
    with open(css_path, 'w', encoding='utf-8') as f:
        f.write(new_css)
    print("CSS overrides successfully removed.")
else:
    print("Could not find markers in CSS.")
