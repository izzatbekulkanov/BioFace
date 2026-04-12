from pathlib import Path

path = Path("/Users/macbookpro/Documents/GitHub/BioFace/templates/base.html")
content = path.read_text()

# Inject Google Fonts
if "fonts.googleapis.com" not in content:
    content = content.replace(
        '<!-- FontAwesome Premium Icons -->',
        '''<!-- Google Fonts (Premium Typography) -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <!-- FontAwesome Premium Icons -->'''
    )

# Fix Toast SVGs
content = content.replace(
    '''const map = {
                    success: '<svg viewBox="0 0 20 20" aria-hidden="true"><path fill="currentColor" d="M10 18a8 8 0 100-16 8 8 0 000 16Zm3.707-9.293a1 1 0 10-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4Z"/></svg>',
                    error: '<svg viewBox="0 0 20 20" aria-hidden="true"><path fill="currentColor" d="M10 18a8 8 0 100-16 8 8 0 000 16Zm3.536-10.95a1 1 0 10-1.414-1.414L10 7.757 7.879 5.636a1 1 0 10-1.415 1.414L8.586 9.17l-2.122 2.122a1 1 0 001.415 1.414L10 10.586l2.121 2.12a1 1 0 001.415-1.413L11.414 9.17l2.122-2.12Z"/></svg>',
                    warning: '<svg viewBox="0 0 20 20" aria-hidden="true"><path fill="currentColor" d="M8.257 3.099c.765-1.36 2.72-1.36 3.486 0l6.35 11.29c.75 1.334-.214 2.99-1.742 2.99H3.65c-1.528 0-2.492-1.656-1.742-2.99l6.35-11.29ZM11 13a1 1 0 10-2 0 1 1 0 002 0Zm-1-6a1 1 0 00-1 1v3a1 1 0 102 0V8a1 1 0 00-1-1Z"/></svg>',
                    info: '<svg viewBox="0 0 20 20" aria-hidden="true"><path fill="currentColor" d="M18 10A8 8 0 112 10a8 8 0 0116 0Zm-7-1a1 1 0 10-2 0v4a1 1 0 102 0V9Zm-1-4a1.25 1.25 0 100 2.5A1.25 1.25 0 0010 5Z"/></svg>',
                };''',
    '''const map = {
                    success: '<i class="fa-solid fa-circle-check text-xl pt-0.5"></i>',
                    error: '<i class="fa-solid fa-circle-xmark text-xl pt-0.5"></i>',
                    warning: '<i class="fa-solid fa-triangle-exclamation text-xl pt-0.5"></i>',
                    info: '<i class="fa-solid fa-circle-info text-xl pt-0.5"></i>',
                };'''
)

# Toast Close button
content = content.replace(
    '''close.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path fill="currentColor" d="M5.22 5.22a.75.75 0 011.06 0L10 8.94l3.72-3.72a.75.75 0 011.06 1.06L11.06 10l3.72 3.72a.75.75 0 11-1.06 1.06L10 11.06l-3.72 3.72a.75.75 0 11-1.06-1.06L8.94 10 5.22 6.28a.75.75 0 010-1.06Z"/></svg>';''',
    '''close.innerHTML = '<i class="fa-solid fa-xmark text-sm block"></i>';'''
)

# Global modal fix if any inline
# I noticed line 68 has `<i class="fa-solid fa-xmark"></i>` from my previous run maybe? Or it was already there. Keep it.

path.write_text(content)
print("Base template and toasts updated!")
