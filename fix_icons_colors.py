import re
import os

files_to_check = [
    'templates/dashboard.html',
    'templates/devices.html',
    'templates/organizations.html',
    'static/js/devices-table.js',
    'static/js/organizations-table.js',
]

for fp in files_to_check:
    if os.path.exists(fp):
        with open(fp, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Change fa-solid to fa-duotone
        content = content.replace('fa-solid', 'fa-duotone')
        
        # Fix potential dark text on dark bg issues:
        # If there's bg-black/20 but missing text-white
        content = content.replace('bg-black/20 p-4', 'bg-black/20 p-4 text-white')
        
        # In devices-table.js and organizations-table.js, check for bg-white/50 missing dark:text-white
        content = content.replace('text-gray-900 truncate', 'text-gray-900 dark:text-white truncate')
        
        with open(fp, 'w', encoding='utf-8') as f:
            f.write(content)

print("Icons and dark text fixed.")
