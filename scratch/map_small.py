import re
from pathlib import Path

svg_pattern = re.compile(r'<svg([^>]*)>(.*?)</svg>', re.DOTALL)
templates_dir = Path("/Users/macbookpro/Documents/GitHub/BioFace/templates")
svgs = []

for filepath in templates_dir.rglob("*.html"):
    if not filepath.is_file(): continue
    if filepath.name == "sidebar.html": continue # Done
    content = filepath.read_text()
    for match in svg_pattern.finditer(content):
        attrs = match.group(1)
        inner = match.group(2)
        if len(inner.strip()) < 500: # IT IS AN ICON
            svgs.append(match.group(0))

print(f"There are {len(svgs)} small icon SVGs to replace.")
