import re
from pathlib import Path

content = Path("/Users/macbookpro/Documents/GitHub/BioFace/templates/components/navbar.html").read_text()

# 1. HTML Icons replacement
# Telegram
content = re.sub(
    r'<span data-service-root="telegram".*?</span>\s*</span>',
    '''<span data-service-root="telegram" class="inline-flex items-center rounded-full border border-gray-200 bg-white p-1 text-[0.8rem] shadow-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700/70" title="Telegram">
                    <span data-service-icon-wrap class="relative flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 dark:bg-gray-700/70">
                    <img data-service-icon src="/static/img/telegram.svg" class="h-4 w-4" alt="Telegram">
                    <span data-service-dot class="absolute -right-0 -top-0 h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                    </span>
                </span>''',
    content,
    flags=re.DOTALL
)

# ISUP
content = re.sub(
    r'<span data-service-root="isup".*?</span>\s*</span>',
    '''<span data-service-root="isup" class="inline-flex items-center rounded-full border border-gray-200 bg-white p-1 text-[0.8rem] shadow-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700/70" title="ISUP">
                    <span data-service-icon-wrap class="relative flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 dark:bg-gray-700/70">
                    <img data-service-icon src="/static/img/isup.svg" class="h-4 w-4 grayscale dark:invert dark:grayscale-0 dark:brightness-200" alt="ISUP">
                    <span data-service-dot class="absolute -right-0 -top-0 h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                    </span>
                </span>''',
    content,
    flags=re.DOTALL
)

# Redis
content = re.sub(
    r'<span data-service-root="redis".*?</span>\s*</span>',
    '''<span data-service-root="redis" class="inline-flex items-center rounded-full border border-gray-200 bg-white p-1 text-[0.8rem] shadow-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700/70" title="Redis">
                    <span data-service-icon-wrap class="relative flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 dark:bg-gray-700/70">
                    <img data-service-icon src="/static/img/redis.svg" class="h-4 w-4 grayscale dark:invert dark:grayscale-0 dark:brightness-200" alt="Redis">
                    <span data-service-dot class="absolute -right-0 -top-0 h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                    </span>
                </span>''',
    content,
    flags=re.DOTALL
)

# Also update the rootClassMap and iconWrapClassMap inside the script
content = content.replace(
    'loading: "inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white pl-1.5 pr-2.5 py-1 text-[0.8rem] font-medium text-gray-600 shadow-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700/70"',
    'loading: "inline-flex items-center rounded-full border border-gray-200 bg-white p-1 text-[0.8rem] shadow-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700/70"'
)
content = content.replace(
    'online: "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/80 pl-1.5 pr-2.5 py-1 text-[0.8rem] font-medium text-emerald-700 shadow-sm transition hover:bg-emerald-100/70 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"',
    'online: "inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50/80 p-1 text-[0.8rem] shadow-sm transition hover:bg-emerald-100/70 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/30"'
)
content = content.replace(
    'offline: "inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50/80 pl-1.5 pr-2.5 py-1 text-[0.8rem] font-medium text-rose-700 shadow-sm transition hover:bg-rose-100/70 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-300 dark:hover:bg-rose-900/30"',
    'offline: "inline-flex items-center rounded-full border border-rose-200 bg-rose-50/80 p-1 text-[0.8rem] shadow-sm transition hover:bg-rose-100/70 dark:border-rose-900/60 dark:bg-rose-900/20 dark:hover:bg-rose-900/30"'
)
content = content.replace(
    'error: "inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/80 pl-1.5 pr-2.5 py-1 text-[0.8rem] font-medium text-amber-700 shadow-sm transition hover:bg-amber-100/70 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/30"',
    'error: "inline-flex items-center rounded-full border border-amber-200 bg-amber-50/80 p-1 text-[0.8rem] shadow-sm transition hover:bg-amber-100/70 dark:border-amber-900/60 dark:bg-amber-900/20 dark:hover:bg-amber-900/30"'
)

# And iconWrapClassMap
content = content.replace(' relative flex h-5 w-5 ', ' relative flex h-6 w-6 ')
content = content.replace(' absolute -right-0.5 -top-0.5 ', ' absolute -right-0 -top-0 ')

Path("/Users/macbookpro/Documents/GitHub/BioFace/templates/components/navbar.html").write_text(content)
print("Navbar updated")
