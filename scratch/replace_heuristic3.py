import re
from pathlib import Path

path_mapping = {
    'M3 7h18M5 7v12a2 2 0 002 2h10a2 2 0 002-2V7M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2': 'fa-solid fa-server',
    'M4 4v5h.582m14.836 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-14.835-2m14.835 2H15': 'fa-solid fa-rotate',
    'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z': 'fa-solid fa-users',
    'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m-1 4h1m4-8h1m-1 4h1m-1 4h1': 'fa-solid fa-building',
    'M9 12h6m-6 4h6M8 6h8m-9 14h10a2 2 0 002-2V8.5L14.5 4H7a2 2 0 00-2 2v12a2 2 0 002 2z': 'fa-solid fa-address-card',
    'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z': 'fa-solid fa-camera-cctv',
    'M3 4a1 1 0 011-1h16a1 1 0 01.8 1.6L14 13v5a1 1 0 01-1.447.894l-2-1A1 1 0 0110 17v-4L3.2 4.6A1 1 0 013 4z': 'fa-solid fa-filter',
    'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2M10 18h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z': 'fa-solid fa-copy',
    'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z': 'fa-solid fa-user'
}

svg_pattern = re.compile(r'<svg([^>]*)>(.*?)</svg>', re.DOTALL)
path_pattern = re.compile(r'd="([^"]+)"')

templates_dir = Path("/Users/macbookpro/Documents/GitHub/BioFace/templates")
total_replaced = 0

for filepath in templates_dir.rglob("*.html"):
    if not filepath.is_file(): continue
    if "sidebar.html" in str(filepath): continue
    
    content = filepath.read_text()
    new_content = content
    
    def replacer(match):
        global total_replaced
        full_svg = match.group(0)
        attrs = match.group(1)
        inner = match.group(2)
        
        paths = path_pattern.findall(inner)
        matched_fa = None
        for p in paths:
            if p in path_mapping:
                matched_fa = path_mapping[p]
                break
        comb = "".join(paths)
        if not matched_fa:
            for known_path, fa_cls in path_mapping.items():
                if known_path.replace(" ", "") == comb.replace(" ", ""):
                    matched_fa = fa_cls
                    break
                    
        if not matched_fa:
            return full_svg
            
        cls_match = re.search(r'class="([^"]+)"', attrs)
        cls_str = cls_match.group(1) if cls_match else ""
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
