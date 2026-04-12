import os, glob, re

template_dir = '/Users/macbookpro/Documents/GitHub/BioFace/templates'

def refactor_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    orig = content
    
    # 1. Update tables: replace convoluted tailwind classes on tables with .table-standard
    # Pattern: <table class="w-full text-left text-sm text-gray-500..."> => <table class="table-standard">
    table_pattern = r'<table\s+class="[^"]*?(?:w-full text-left text-sm)[^"]*?"'
    content = re.sub(table_pattern, '<table class="table-standard"', content)
    
    # And remove the dark/light classes from thead (since CSS handles it)
    # Pattern: <thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-600 dark:bg-gray-800 dark:text-gray-300">
    # we can just leave it as <thead> or <thead class="bg-gray-50...">, wait, our CSS takes over so we can strip classes from thead, th, tbody, tr, td
    thead_pattern = r'<thead\s+class="[^"]*?(?:bg-gray-50|text-xs|uppercase)[^"]*?"'
    content = re.sub(thead_pattern, '<thead>', content)

    # 2. Add animate-fade-in to the main container
    # Most pages have: <div class="mb-6 flex flex-col..."> or <div class="dashboard-page..."> or <div class="space-y-6"> right after block content
    # I will replace `{% block content %}\n<div class="` with `{% block content %}\n<div class="animate-fade-in `
    fade_pattern = r'({%\s*block\s+content\s*%}\s*<div\s+class=")'
    # only add if not already there
    if 'animate-fade-in' not in content:
        content = re.sub(fade_pattern, r'\1animate-fade-in ', content)

    # Note: I'll also add it to elements like <div class="max-w-...
    fade_pattern2 = r'({%\s*block\s+content\s*%}\s*<main\s+class=")'
    if 'animate-fade-in' not in content:
        content = re.sub(fade_pattern2, r'\1animate-fade-in ', content)

    if content != orig:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Refactored empty states/tables/animations: {filepath}")

for f in glob.glob(f'{template_dir}/**/*.html', recursive=True):
    refactor_file(f)
