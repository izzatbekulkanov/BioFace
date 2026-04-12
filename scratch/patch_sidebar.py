from pathlib import Path
content = Path("/Users/macbookpro/Documents/GitHub/BioFace/templates/components/sidebar.html").read_text()

content = content.replace('''<svg class="w-5 h-5 shrink-0
                            {% if is_active %}text-blue-600 dark:text-blue-400{% else %}text-gray-400 group-hover:text-blue-600{% endif %}"
                     fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {{ icon_path | safe }}
                </svg>''', '''<i class="{{ icon_path }} w-5 text-center shrink-0 text-lg {% if is_active %}text-blue-600 dark:text-blue-400{% else %}text-gray-400 group-hover:text-blue-600{% endif %}"></i>''')

content = content.replace('''<svg class="w-5 h-5 shrink-0 {% if is_reports %}text-red-500{% else %}text-gray-400{% endif %}"
                                 fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {{ item.icon | safe }}
                            </svg>''', '''<i class="{{ item.icon }} w-5 text-center text-lg shrink-0 {% if is_reports %}text-red-500{% else %}text-gray-400{% endif %}"></i>''')

Path("/Users/macbookpro/Documents/GitHub/BioFace/templates/components/sidebar.html").write_text(content)
print("Sidebar patched.")
