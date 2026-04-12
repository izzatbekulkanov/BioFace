import re
from pathlib import Path

path_mapping = {
    'M4 8h16M4 16h16': 'fa-solid fa-grip-lines',
    'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z': 'fa-solid fa-circle-exclamation',
    'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z': 'fa-solid fa-cloud',
    'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z': 'fa-solid fa-grid-2',
    'M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z': 'fa-solid fa-ellipsis',
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
        
        # Spinners
        if "animate-spin" in attrs:
            cls_match = re.search(r'class="([^"]+)"', attrs)
            id_match = re.search(r'id="([^"]+)"', attrs)
            id_str = f'id="{id_match.group(1)}"' if id_match else ""
            clean_classes = []
            if cls_match:
                for c in cls_match.group(1).split():
                    if not c.startswith('w-') and not c.startswith('h-') and 'shrink' not in c and 'block' not in c and 'inline' not in c:
                        clean_classes.append(c)
            final_class = f"fa-solid fa-circle-notch {' '.join(clean_classes)}".strip()
            total_replaced += 1
            return f'<i {id_str} class="{final_class}"></i>'

        # Known paths
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
                    
        # Special logic for {{ m.icon }} in settings
        if "{{ m.icon|safe }}" in inner:
            matched_fa = "{{ m.icon }}"
            
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
