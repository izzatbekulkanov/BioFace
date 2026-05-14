import os
from pathlib import Path
import re

def resolve_conflicts(directory):
    for root, _, files in os.walk(directory):
        if '.venv' in root or '.git' in root:
            continue
        for file in files:
            if not file.endswith('.py'):
                continue
            path = Path(root) / file
            try:
                content = path.read_text(encoding='utf-8')
            except:
                continue
                
            if '<<<<<<<< HEAD' not in content and '<<<<<<< HEAD' not in content:
                continue
                
            print(f"Resolving {path}")
            # Regex to match the conflict block and keep only the bottom part
            # Syntax:
            # <<<<<<<< HEAD:path
            # (top part)
            # ========
            # (bottom part)
            # >>>>>>>> commit:path
            
            # Using regex substitution
            pattern = re.compile(r'<{7,8} HEAD.*?\n(.*?)\n={7,8}\n(.*?)\n>{7,8} [a-f0-9]+:.*?\n', re.DOTALL)
            
            new_content = pattern.sub(r'\2\n', content)
            path.write_text(new_content, encoding='utf-8')

resolve_conflicts(r"i:\Github\BioFace")
