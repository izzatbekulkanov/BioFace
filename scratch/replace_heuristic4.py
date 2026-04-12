import re
from pathlib import Path

path_mapping = {
    'M10 18a8 8 0 100-16 8 8 0 000 16Zm3.707-9.293a1 1 0 10-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4Z': 'fa-solid fa-circle-check',
    'M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z': 'fa-solid fa-xmark',
    'M4 4v5h.582m14.835 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0A8.003 8.003 0 0 1 5 15m14.419 0H15': 'fa-solid fa-rotate',
    'M6.5 4.5a1 1 0 0 0-1.5.866v9.268a1 1 0 0 0 1.5.866l8-4.634a1 1 0 0 0 0-1.732l-8-4.634Z': 'fa-solid fa-play',
    'M17 1l4 4-4 4M3 11a8 8 0 0 1 13.657-5.657L21 9M7 23l-4-4 4-4m14-2a8 8 0 0 1-13.657 5.657L3 15': 'fa-solid fa-clock-rotate-left',
    'M6 5.75A1.75 1.75 0 0 1 7.75 4h4.5A1.75 1.75 0 0 1 14 5.75v8.5A1.75 1.75 0 0 1 12.25 16h-4.5A1.75 1.75 0 0 1 6 14.25v-8.5Z': 'fa-solid fa-stop',
    'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636': 'fa-solid fa-ban',
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z': 'fa-solid fa-shield-halved',
    'M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z': 'fa-solid fa-lock',
    'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z': 'fa-solid fa-phone',
    'M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z': 'fa-solid fa-ellipsis-vertical',
    'M5 12h14M12 5l7 7-7 7': 'fa-solid fa-arrow-right-long',
    'M11 17l-5-5m0 0l5-5m-5 5h12': 'fa-solid fa-arrow-left-long'
}

heuristic_words = {
    'qoshish': 'fa-solid fa-plus',
    'tasdiq': 'fa-solid fa-check',
    'saqlash': 'fa-solid fa-floppy-disk',
    'izlash': 'fa-solid fa-magnifying-glass',
    'tahrir': 'fa-solid fa-pen-to-square',
    'ochir': 'fa-solid fa-trash-can',
    'qidir': 'fa-solid fa-magnifying-glass',
    'batafsil': 'fa-solid fa-circle-info',
    'yuborish': 'fa-solid fa-paper-plane',
    'yuklab': 'fa-solid fa-download',
    'parol': 'fa-solid fa-lock',
    'login': 'fa-solid fa-right-to-bracket',
    'yopish': 'fa-solid fa-xmark',
    'tozalash': 'fa-solid fa-eraser',
    'uzish': 'fa-solid fa-plug-circle-xmark',
    'korish': 'fa-solid fa-eye'
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
    offset = 0
    
    def replacer(match):
        global total_replaced
        full_svg = match.group(0)
        attrs = match.group(1)
        inner = match.group(2)
        
        if len(inner.strip()) > 500:
            return full_svg # skip large illustrations
            
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
             start_idx = max(0, match.start() - 30)
             end_idx = min(len(content), match.end() + 30)
             context = content[start_idx:end_idx].lower()
             for word, cls in heuristic_words.items():
                 if word in context:
                     matched_fa = cls
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

print(f"Replaced {total_replaced} final small SVGs!")
