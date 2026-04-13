import os

css_path = 'static/css/global-overrides.css'

with open(css_path, 'r', encoding='utf-8') as f:
    css_content = f.read()

start_marker = "/* --- CAMERA UI SYSTEM --- */"
end_marker = "/* --- EMPLOYEE UI SYSTEM --- */"

if start_marker in css_content and end_marker in css_content:
    start_idx = css_content.find(start_marker)
    end_idx = css_content.find(end_marker)
    new_css = css_content[:start_idx] + css_content[end_idx:]
    with open(css_path, 'w', encoding='utf-8') as f:
        f.write(new_css)
    print("CSS overrides successfully removed.")
else:
    print("Could not find markers in CSS.")
