import os
import re
from pathlib import Path
from collections import defaultdict

svg_pattern = re.compile(r'<svg.*?</svg>', re.DOTALL)
path_pattern = re.compile(r'd="([^"]+)"')

templates_dir = Path("/Users/macbookpro/Documents/GitHub/BioFace/templates")

signatures = defaultdict(list)

for folder, dirs, files in os.walk(templates_dir):
    for filename in files:
        if filename.endswith(".html"):
            path = Path(folder) / filename
            content = path.read_text()
            svgs = svg_pattern.findall(content)
            for svg in svgs:
                paths = tuple(sorted(path_pattern.findall(svg)))
                # A signature is the combined `d` strings, hashed or just truncated.
                if not paths:
                    continue
                
                sig = hash(paths)
                signatures[sig].append((svg, paths, str(path)))

print(f"Found {len(signatures)} unique SVGs")
# We'll just print out a mapping script template
with open("scratch/replace_script.py", "w") as f:
    f.write("import os, re, glob\n\n")
    f.write("replacements = [\n")
    for sig, instances in signatures.items():
        sample_svg = instances[0][0]
        paths = instances[0][1]
        
        # We need a FA class.
        # Let's provide a hint from classes in the SVG.
        cls_match = re.search(r'class="([^"]+)"', sample_svg)
        cls_text = cls_match.group(1) if cls_match else ""
        
        # Write out
        f.write("    # Sample: " + repr(sample_svg[:80]) + "... Paths: " + repr(paths[0][:30]) + "...\n")
        f.write(f"    (r'{paths[0]}', 'fa-solid fa-star', '{cls_text}'),\n")
        
    f.write("]\n")

print("Created replace_script.py")
