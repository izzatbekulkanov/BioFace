#!/usr/bin/env python
import re

# Fix auth.py (already done)
# Fix pages.py

pages_path = "routers/pages.py"

with open(pages_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace all remaining TemplateResponse patterns
#  from: templates.TemplateResponse("name.html", {
#  to:   templates.TemplateResponse(request=request, name="name.html", context={
content = re.sub(
    r'templates\.TemplateResponse\("([^"]+)",\s*\{',
    r'templates.TemplateResponse(request=request, name="\1", context={',
    content
)

# Replace patterns with variable context
#  from: templates.TemplateResponse("name.html", context)
#  to:   templates.TemplateResponse(request=request, name="name.html", context=context)
content = re.sub(
    r'templates\.TemplateResponse\("([^"]+)",\s+(\w+)\)',
    r'templates.TemplateResponse(request=request, name="\1", context=\2)',
    content
)

with open(pages_path, "w", encoding="utf-8") as f:
    f.write(content)

print("✓ Fixed routers/pages.py")
