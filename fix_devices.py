import re

with open('templates/devices.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Fix the soft chips in light mode (they were bg-white/10 text-white/80 which makes them invisible on white bg)
bad_chip = r'inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-xs font-medium text-white/80 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
good_chip = r'inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300'

html = html.replace(bad_chip, good_chip)

with open('templates/devices.html', 'w', encoding='utf-8') as f:
    f.write(html)
