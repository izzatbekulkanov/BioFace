import sys
import re

def optimize_webapp():
    file_path = '/home/smartgate/BioFace/backend/static/telegram_webapp/index.html'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Reduce backdrop-filter for glass cards and remove !important where possible
    # In injected CSS (near line 2286):
    # backdrop-filter: blur(28px) saturate(190%) !important;
    content = re.sub(r'backdrop-filter:\s*blur\(\d+px\)[^;]*!important;', 'backdrop-filter: blur(4px) !important;', content)
    content = re.sub(r'-webkit-backdrop-filter:\s*blur\(\d+px\)[^;]*!important;', '-webkit-backdrop-filter: blur(4px) !important;', content)
    
    # In regular CSS
    content = re.sub(r'backdrop-filter:\s*blur\(\d+px\)[^;]*;', 'backdrop-filter: blur(4px);', content)
    content = re.sub(r'-webkit-backdrop-filter:\s*blur\(\d+px\)[^;]*;', '-webkit-backdrop-filter: blur(4px);', content)

    # 2. Remove giant filter: blur(40px) abstract decorations in the Profile tab
    content = content.replace('filter: blur(40px);', 'display: none; /* removed for performance */')
    content = content.replace('filter: blur(60px);', 'display: none; /* removed for performance */')

    # 3. Simplify box-shadows that are too large
    content = re.sub(r'box-shadow:\s*0\s+20px\s+40px\s+-[0-9]+px\s+rgba\([^)]+\);', 'box-shadow: 0 4px 12px rgba(0,0,0,0.15);', content)
    content = re.sub(r'box-shadow:\s*0\s+25px\s+50px\s+-[0-9]+px\s+rgba\([^)]+\);', 'box-shadow: 0 4px 12px rgba(0,0,0,0.15);', content)
    content = re.sub(r'box-shadow:\s*0\s+10px\s+30px\s+-[0-9]+px\s+rgba\([^)]+\);', 'box-shadow: 0 4px 12px rgba(0,0,0,0.15);', content)
    content = re.sub(r'box-shadow:\s*0\s+10px\s+30px\s+rgba\([^)]+\);', 'box-shadow: 0 4px 12px rgba(0,0,0,0.15);', content)

    # 4. Turn off continuous heavy animations
    # pulse-ring, shimmer, etc.
    # We will just change infinite animations to run once, or reduce complexity
    content = content.replace('animation: pulse 2s infinite;', '/* animation removed */')
    content = content.replace('animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;', '/* animation removed */')
    
    # 5. Fix any solid opacity/transparency that depended on the heavy blur
    content = content.replace('background: rgba(30, 41, 59, 0.4);', 'background: rgba(30, 41, 59, 0.85);')
    content = content.replace('background: rgba(15, 23, 42, 0.4);', 'background: rgba(15, 23, 42, 0.85);')
    content = content.replace('background: rgba(255, 255, 255, 0.05);', 'background: rgba(255, 255, 255, 0.08);')

    # Wait, the injected glass card background was: background: linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(30, 41, 59, 0.3) 100%)
    content = re.sub(r'background:\s*linear-gradient\([^,]+,\s*rgba\(\d+,\s*\d+,\s*\d+,\s*0\.[1-6]\).*?\)', 'background: rgba(30, 41, 59, 0.95)', content)

    # Disable backdrop filter completely on the .glass-card CSS rule to be absolutely sure
    # Search for `.glass-card {` and add `backdrop-filter: none !important;`
    content = re.sub(r'(\.glass-card\s*\{[^}]*)backdrop-filter:\s*blur\([^)]*\)\s*!important;', r'\1backdrop-filter: none !important;', content)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("✅ WebApp performance optimized. Removed heavy blurs, massive shadows, and continuous animations.")

if __name__ == "__main__":
    optimize_webapp()
