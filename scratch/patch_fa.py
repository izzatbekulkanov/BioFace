from pathlib import Path

# base.html
base_path = Path("/Users/macbookpro/Documents/GitHub/BioFace/templates/base.html")
content = base_path.read_text()

# fix the faulty injection
content = content.replace(
"""    {% if menus.favicon_url %}
    <link rel="icon" href="/static/img/favicon.ico" type="image/x-icon">
    <!-- FontAwesome Premium Icons -->
    <link href="/static/fontawesome/css/all.min.css" rel="stylesheet">
    <link href="/static/css/output.css?v=20260317c" rel="stylesheet">
    <link href="/static/css/global-overrides.css?v=1" rel="stylesheet">
    {% endif %}""",
"""    {% if menus.favicon_url %}
    <link rel="icon" href="{{ menus.favicon_url }}" />
    {% endif %}
    <!-- FontAwesome Premium Icons -->
    <link href="/static/fontawesome/css/all.min.css" rel="stylesheet">
    <link href="/static/css/output.css?v=20260317c" rel="stylesheet">
    <link href="/static/css/global-overrides.css?v=20260407a" rel="stylesheet">"""
)

base_path.write_text(content)

# login.html
login_path = Path("/Users/macbookpro/Documents/GitHub/BioFace/templates/login.html")
login_content = login_path.read_text()
if "fontawesome" not in login_content:
    login_content = login_content.replace(
        '<link href="/static/css/output.css?v=20260317c" rel="stylesheet">',
        '<!-- FontAwesome Premium Icons -->\n    <link href="/static/fontawesome/css/all.min.css" rel="stylesheet">\n    <link href="/static/css/output.css?v=20260317c" rel="stylesheet">'
    )
    login_path.write_text(login_content)

print("Linked FA CSS.")
