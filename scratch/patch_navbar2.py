import re
from pathlib import Path

content = Path("/Users/macbookpro/Documents/GitHub/BioFace/templates/components/navbar.html").read_text()

# Bell
content = content.replace(
    '<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>',
    '<i class="fa-solid fa-bell text-[1.15rem]"></i>'
)

# Bell inside drop
content = content.replace(
    '<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',
    '<i class="fa-solid fa-triangle-exclamation"></i>'
)

# Dark mode Sun
content = content.replace(
    '<svg id="icon-sun" class="hidden h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"/>\n                </svg>',
    '<i id="icon-sun" class="fa-solid fa-sun hidden text-[1.15rem] text-yellow-400 drop-shadow-sm"></i>'
)
# Dark mode Moon
content = content.replace(
    '<svg id="icon-moon" class="h-5 w-5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>\n                </svg>',
    '<i id="icon-moon" class="fa-solid fa-moon text-[1.15rem] text-slate-600 dark:text-slate-300"></i>'
)

# Camera Alert btn inner SVG
content = content.replace(
    '''<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>''',
    '''<i class="fa-solid fa-camera-cctv text-[1.15rem]"></i>'''
)

Path("/Users/macbookpro/Documents/GitHub/BioFace/templates/components/navbar.html").write_text(content)
print("Finished FA navbar replacement")
