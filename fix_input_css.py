with open('src/input.css', 'r') as f:
    css = f.read()

if '@source "../static/js";' not in css:
    css = css.replace('@source "../templates";', '@source "../templates";\n@source "../static/js";')
    with open('src/input.css', 'w') as f:
        f.write(css)
    print("Added static/js to Tailwind sources.")
