from pathlib import Path

content = Path("/Users/macbookpro/Documents/GitHub/BioFace/templates/camera_info.html").read_text()

# 1. Main refresh button
content = content.replace(
    '''<svg id="btn-refresh-all-icon" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356-2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0A8.003 8.003 0 015.03 15m14.389 0H15"/>
                </svg>''',
    '''<i id="btn-refresh-all-icon" class="fa-solid fa-rotate h-4 w-4 text-[1rem]"></i>'''
)

# 2. Generate ID
content = content.replace(
    '''<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                                </svg>''',
    '''<i class="fa-solid fa-bolt"></i>'''
)

# 3. Dropzone
content = content.replace(
    '''<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 0115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                                </svg>''',
    '''<i class="fa-solid fa-cloud-arrow-up text-[1.25rem]"></i>'''
)

# 4. Browse button
content = content.replace(
    '''<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7h5l2 2h11v10a2 2 0 01-2 2H3a2 2 0 01-2-2V9a2 2 0 012-2z"/>
                                </svg>''',
    '''<i class="fa-solid fa-folder-open"></i>'''
)

# 5. Import from camera
content = content.replace(
    '''<svg id="btn-import-from-camera-icon" class="h-4 w-4 transition group-hover:scale-105" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M8 12l4 4m0 0l4-4m-4 4V3"/>
                        </svg>''',
    '''<i id="btn-import-from-camera-icon" class="fa-solid fa-download h-4 w-4 text-[1rem] transition group-hover:scale-105"></i>'''
)

# 6. Refresh Users inside card
content = content.replace(
    '''<svg id="btn-refresh-users-icon" class="h-4 w-4 transition group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356-2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0A8.003 8.003 0 015.03 15m14.389 0H15"/>
                        </svg>''',
    '''<i id="btn-refresh-users-icon" class="fa-solid fa-rotate h-4 w-4 text-[1rem] transition group-hover:rotate-12"></i>'''
)

# 7. Sync metadata
content = content.replace(
    '''<svg id="btn-sync-metadata-icon" class="h-4 w-4 transition group-hover:rotate-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h6m-6 4h10M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"/>
                        </svg>''',
    '''<i id="btn-sync-metadata-icon" class="fa-solid fa-sliders h-4 w-4 text-[1rem] transition group-hover:rotate-6"></i>'''
)

Path("/Users/macbookpro/Documents/GitHub/BioFace/templates/camera_info.html").write_text(content)
print("Finished patching camera_info.html")
