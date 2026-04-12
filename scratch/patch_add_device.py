from pathlib import Path

content = Path("/Users/macbookpro/Documents/GitHub/BioFace/templates/add_device.html").read_text()

# 1. Expand container
content = content.replace(
    'class="bg-white border border-gray-200 rounded-xl shadow-sm dark:bg-gray-800 dark:border-gray-700 max-w-2xl mx-auto overflow-hidden"',
    'class="bg-white border border-gray-200 rounded-2xl shadow-sm dark:bg-gray-900 dark:border-gray-800 w-full overflow-hidden"'
)

# 2. Replace the copy SVGs with FontAwesome
svg_copy = '''<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>'''
fa_copy = '''<i class="fa-regular fa-copy text-lg"></i>'''
content = content.replace(svg_copy, fa_copy)

# 3. Enhance some labels with icons for a more PRO feel
# Name
content = content.replace(
    '<label class="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Kamera Nomi <span class="text-red-500">*</span></label>',
    '<label class="block text-sm font-semibold text-gray-900 dark:text-white mb-2"><i class="fa-solid fa-video text-gray-400 mr-2"></i>Kamera Nomi <span class="text-red-500">*</span></label>'
)
# MAC
content = content.replace(
    '<label class="block text-sm font-semibold text-gray-900 dark:text-white mb-2">MAC Manzili</label>',
    '<label class="block text-sm font-semibold text-gray-900 dark:text-white mb-2"><i class="fa-solid fa-network-wired text-gray-400 mr-2"></i>MAC Manzili</label>'
)
# Serial
content = content.replace(
    '<label class="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Seriya Raqami</label>',
    '<label class="block text-sm font-semibold text-gray-900 dark:text-white mb-2"><i class="fa-solid fa-barcode text-gray-400 mr-2"></i>Seriya Raqami</label>'
)
# Model
content = content.replace(
    '<label class="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Model (Limit uchun)</label>',
    '<label class="block text-sm font-semibold text-gray-900 dark:text-white mb-2"><i class="fa-solid fa-layer-group text-gray-400 mr-2"></i>Model (Limit uchun)</label>'
)
# Org
content = content.replace(
    '<label class="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Tashkilot</label>',
    '<label class="block text-sm font-semibold text-gray-900 dark:text-white mb-2"><i class="fa-solid fa-building text-gray-400 mr-2"></i>Tashkilot</label>'
)
# Auth
content = content.replace(
    '<label class="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Kamera Logini</label>',
    '<label class="block text-sm font-semibold text-gray-900 dark:text-white mb-2"><i class="fa-solid fa-user text-gray-400 mr-2"></i>Kamera Logini</label>'
)
content = content.replace(
    '<label class="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Kamera Paroli</label>',
    '<label class="block text-sm font-semibold text-gray-900 dark:text-white mb-2"><i class="fa-solid fa-key text-gray-400 mr-2"></i>Kamera Paroli</label>'
)
# ISUP
content = content.replace(
    '<label class="block text-sm font-semibold text-gray-900 dark:text-white mb-2">ISUP Paroli (Maxfiy) <span class="text-red-500">*</span></label>',
    '<label class="block text-sm font-semibold text-gray-900 dark:text-white mb-2"><i class="fa-solid fa-shield-halved text-gray-400 mr-2"></i>ISUP Paroli (Maxfiy) <span class="text-red-500">*</span></label>'
)
content = content.replace(
    '<label class="block text-sm font-semibold text-gray-900 dark:text-white mb-2">ISUP Device ID (ixtiyoriy)</label>',
    '<label class="block text-sm font-semibold text-gray-900 dark:text-white mb-2"><i class="fa-solid fa-id-badge text-gray-400 mr-2"></i>ISUP Device ID (ixtiyoriy)</label>'
)

Path("/Users/macbookpro/Documents/GitHub/BioFace/templates/add_device.html").write_text(content)
print("Updated add_device.html")
