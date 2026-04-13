import os

fp = 'templates/commands.html'
if os.path.exists(fp):
    with open(fp, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Change fa-solid to fa-duotone
    content = content.replace('fa-solid', 'fa-duotone')
    
    with open(fp, 'w', encoding='utf-8') as f:
        f.write(content)
print("Icons in commands.html fixed.")
