import os
import re

html_path = 'templates/commands.html'

with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Add group class to options so that has-[:checked] styles apply to children
html = html.replace('camera-command-option', 'group camera-command-option')

replacements_html = {
    'camera-hero': 'overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-600 shadow-xl',
    'camera-hero-grid': 'grid gap-4 p-5 xl:grid-cols-3',
    'camera-hero-badge': 'inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80 backdrop-blur-sm w-max mb-4',
    'camera-hero-title': 'text-3xl font-bold tracking-tight text-white',
    'camera-hero-text': 'max-w-3xl text-sm leading-6 text-blue-100 mt-2',
    'camera-hero-actions': 'mt-4 flex flex-wrap items-center gap-3',
    'camera-soft-chip camera-soft-chip-light': 'inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90 hover:bg-white/20 transition',
    'camera-summary-grid': 'grid gap-3 sm:grid-cols-2 xl:col-span-2',
    'camera-summary-card': 'rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm relative overflow-hidden',
    'camera-summary-top': 'absolute right-4 top-4 text-white/20 text-4xl',
    'camera-summary-icon': 'block',
    'camera-summary-label': 'text-xs font-semibold uppercase tracking-wide text-white/80',
    'camera-summary-value': 'mt-2 text-2xl font-bold text-white',
    'camera-summary-meta': 'mt-1 text-xs text-white/80',
    
    'camera-readonly-banner px-4 py-3 text-sm': 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 px-4 py-3 text-sm border border-amber-200 dark:border-amber-900/40 rounded-2xl mb-6',
    
    'camera-panel p-5 disabled-section': 'rounded-3xl border border-gray-200 bg-white/80 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80 overflow-hidden p-5 disabled-section',
    'camera-panel p-5': 'rounded-3xl border border-gray-200 bg-white/80 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80 overflow-hidden p-5',
    'camera-panel': 'rounded-3xl border border-gray-200 bg-white/80 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80 overflow-hidden',
    
    'camera-panel-header': 'flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between mb-4',
    'camera-panel-eyebrow': 'text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-1',
    'camera-panel-title': 'text-lg font-semibold text-gray-900 dark:text-white',
    
    'camera-field-label text-sm': 'flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5',
    'camera-field-icon': 'text-gray-400 dark:text-gray-500',
    'camera-field': 'space-y-1.5',
    
    'camera-highlight-box text-center': 'rounded-2xl border border-gray-100 bg-gray-50/50 p-4 dark:border-gray-700/50 dark:bg-gray-800/50 text-center',
    'camera-highlight-box': 'rounded-2xl border border-gray-100 bg-gray-50/50 p-4 dark:border-gray-700/50 dark:bg-gray-800/50',
    
    'group camera-command-option': 'group flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-3 cursor-pointer transition hover:bg-blue-50/50 hover:border-blue-200 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:bg-blue-900/20 dark:hover:border-blue-800/50 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 dark:has-[:checked]:bg-blue-900/30',
    'camera-command-icon': 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 group-has-[:checked]:bg-blue-100 group-has-[:checked]:text-blue-600 dark:group-has-[:checked]:bg-blue-900/50 dark:group-has-[:checked]:text-blue-400 transition',
    'camera-command-title block text-sm': 'font-semibold text-gray-900 dark:text-white block text-sm group-has-[:checked]:text-blue-700 dark:group-has-[:checked]:text-blue-300 transition',
    'camera-command-desc block text-xs': 'text-gray-500 dark:text-gray-400 mt-0.5 block text-xs',
    
    'camera-terminal-shell flex h-full min-h-[420px] flex-col': 'overflow-hidden rounded-3xl border border-gray-200 bg-slate-950 shadow-sm dark:border-gray-800 flex h-full min-h-[420px] flex-col',
    'camera-terminal-head shrink-0': 'flex items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-4 py-3 shrink-0',
    'camera-terminal-body w-full h-full text-sm': 'flex-1 overflow-auto p-4 font-mono text-sm text-gray-300'
}

sorted_keys = sorted(replacements_html.keys(), key=len, reverse=True)
for key in sorted_keys:
    html = html.replace(key, replacements_html[key])

# Clean up any leftover duplicate classes or spaces
html = re.sub(r'class="([^"]+)"', lambda m: f'class="{" ".join(m.group(1).split())}"', html)

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)
print("commands.html successfully updated.")
