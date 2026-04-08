import re

file_path = r"routers\pages.py"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Pattern to match: templates.TemplateResponse("template.html", {
# Replace with: templates.TemplateResponse(request=request, name="template.html", context={
pattern = r'templates\.TemplateResponse\(\s*"([^"]+)"\s*,\s*\{'
replacement = r'templates.TemplateResponse(request=request, name="\1", context={'

new_content = re.sub(pattern, replacement, content)

# Also fix the one with just context variable
pattern2 = r'templates\.TemplateResponse\(\s*"([^"]+)"\s*,\s+(\w+)\s*\)'
replacement2 = r'templates.TemplateResponse(request=request, name="\1", context=\2)'
new_content = re.sub(pattern2, replacement2, new_content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Fixed pages.py")
