#!/usr/bin/env python3
import re

file_path = r"routers\pages.py"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Count old patterns
old_count = len(re.findall(r'templates\.TemplateResponse\("', content))
print(f"Found {old_count} patterns to fix...")

# Fix pattern: templates.TemplateResponse("name.html", { => templates.TemplateResponse(request=request, name="name.html", context={
content = re.sub(
    r'templates\.TemplateResponse\("([^"]+)",\s*\{',
    r'templates.TemplateResponse(request=request, name="\1", context={',
    content
)

# Write back
with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

# Verify
with open(file_path, "r", encoding="utf-8") as f:
    new_content = f.read()
new_count = len(re.findall(r'templates\.TemplateResponse\("', new_content))

print(f"✓ Fixed {old_count - new_count} patterns")
print(f"✗ Remaining: {new_count}")
