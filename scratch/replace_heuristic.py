import os
import re
from pathlib import Path

# Common Heroicons -> FA map
path_mapping = {
    'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z': 'fa-solid fa-pen-to-square',
    'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16': 'fa-solid fa-trash-can',
    'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4V6a2 2 0 00-2-2H9a2 2 0 00-2 2v1m4 6v6m4-6v6': 'fa-solid fa-trash-can',
    'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z': 'fa-solid fa-magnifying-glass',
    'M12 6v6m0 0v6m0-6h6m-6 0H6': 'fa-solid fa-plus',
    'M12 4v16m8-8H4': 'fa-solid fa-plus',
    'M6 18L18 6M6 6l12 12': 'fa-solid fa-xmark',
    'M15 19l-7-7 7-7': 'fa-solid fa-chevron-left',
    'M9 5l7 7-7 7': 'fa-solid fa-chevron-right',
    'M19 9l-7 7-7-7': 'fa-solid fa-chevron-down',
    'M5 15l7-7 7 7': 'fa-solid fa-chevron-up',
    'M4 6h16M4 12h16M4 18h16': 'fa-solid fa-bars',
    'M15 12a3 3 0 11-6 0 3 3 0 016 0z': 'fa-solid fa-eye',
    'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z': 'fa-solid fa-clock-rotate-left',
    'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15': 'fa-solid fa-rotate-right',
    'M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4': 'fa-solid fa-download',
    'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z': 'fa-solid fa-envelope',
    'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z': 'fa-solid fa-circle-info',
    'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z': 'fa-solid fa-circle-exclamation',
    'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z': 'fa-solid fa-circle-check',
    'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6': 'fa-solid fa-house',
    'M10 19l-7-7m0 0l7-7m-7 7h18': 'fa-solid fa-arrow-left',
    'M14 5l7 7m0 0l-7 7m7-7H3': 'fa-solid fa-arrow-right',
    'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1': 'fa-solid fa-right-from-bracket',
    'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z': 'fa-solid fa-grid-2',
    'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z': 'fa-solid fa-calendar-days',
    'M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9': 'fa-solid fa-flag-checkered',
    'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z': 'fa-solid fa-chart-simple',
    'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12': 'fa-solid fa-cloud-arrow-up',
    'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z': 'fa-solid fa-file-arrow-down',
    'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4': 'fa-solid fa-download',
    'M5 13l4 4L19 7': 'fa-solid fa-check',
    'M13 5l7 7-7 7M5 5l7 7-7 7': 'fa-solid fa-angles-right',
    'M11 19l-7-7 7-7m8 14l-7-7 7-7': 'fa-solid fa-angles-left'
}

# Expand by looking at text
heuristic_words = {
    'tahrir': 'fa-solid fa-pen-to-square',
    'edit': 'fa-solid fa-pen-to-square',
    'o\'chir': 'fa-solid fa-trash-can',
    'delete': 'fa-solid fa-trash-can',
    'saqla': 'fa-solid fa-floppy-disk',
    'orqaga': 'fa-solid fa-arrow-left',
    'izlash': 'fa-solid fa-magnifying-glass',
    'chiqish': 'fa-solid fa-right-from-bracket',
    'yuklash': 'fa-solid fa-download',
    'eksport': 'fa-solid fa-file-export',
    'export': 'fa-solid fa-file-export',
    'bosh sahifa': 'fa-solid fa-house',
}

svg_pattern = re.compile(r'<svg([^>]*)>(.*?)</svg>', re.DOTALL)
path_pattern = re.compile(r'd="([^"]+)"')

templates_dir = Path("/Users/macbookpro/Documents/GitHub/BioFace/templates")
total_replaced = 0

for filepath in templates_dir.rglob("*.html"):
    if not filepath.is_file(): continue
    if "components/sidebar.html" in str(filepath): continue # Already done
    
    content = filepath.read_text()
    new_content = content
    offset = 0
    
    def replacer(match):
        global total_replaced
        full_svg = match.group(0)
        attrs = match.group(1)
        inner = match.group(2)
        
        # Get paths
        paths = path_pattern.findall(inner)
        matched_fa = None
        
        # 1. Exact path match (single or multiple paths combined)
        for p in paths:
            if p in path_mapping:
                matched_fa = path_mapping[p]
                break
                
        # Combine paths
        comb = "".join(paths)
        if not matched_fa:
            for known_path, fa_cls in path_mapping.items():
                if known_path.replace(" ", "") == comb.replace(" ", ""):
                    matched_fa = fa_cls
                    break
        
        if not matched_fa:
            return full_svg # skip if unknown
            
        # Extract class
        cls_match = re.search(r'class="([^"]+)"', attrs)
        cls_str = cls_match.group(1) if cls_match else ""
        
        # filter out text-blue-600, w-5, h-5? Actually, keep text colors but remove w- and h-?
        # A good FA icon handles w/h natively but keeping `text-...` is important.
        clean_classes = []
        for c in cls_str.split():
            if not c.startswith('w-') and not c.startswith('h-') and 'shrink' not in c and 'block' not in c and 'inline' not in c:
                clean_classes.append(c)
                
        final_class = f"{matched_fa} {' '.join(clean_classes)}".strip()
        total_replaced += 1
        return f'<i class="{final_class}"></i>'

    new_content = svg_pattern.sub(replacer, content)
    
    if new_content != content:
        filepath.write_text(new_content)

print(f"Replaced {total_replaced} SVGs!")
