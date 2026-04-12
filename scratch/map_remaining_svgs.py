import re
from pathlib import Path

svg_pattern = re.compile(r'<svg([^>]*)>(.*?)</svg>', re.DOTALL)

templates_dir = Path("/Users/macbookpro/Documents/GitHub/BioFace/templates")
svgs = []

for filepath in templates_dir.rglob("*.html"):
    if not filepath.is_file(): continue
    content = filepath.read_text()
    for match in svg_pattern.finditer(content):
        attrs = match.group(1)
        inner = match.group(2)
        # find nearby text (before or after)
        
        # very simple nearby match
        start_idx = max(0, match.start() - 15)
        end_idx = min(len(content), match.end() + 15)
        context = content[start_idx:match.start()] + " [ICON] " + content[match.end():end_idx]
        
        svgs.append({
            'file': filepath.name,
            'attrs': attrs,
            'inner': inner.strip()[:100],
            'context': context.replace('\n', ' ').strip()
        })

print(f"Remaining SVGs: {len(svgs)}")
for svg in svgs[:30]:
    print(f"- {svg['file']} | {svg['context']} | {svg['inner'][:50]}")
