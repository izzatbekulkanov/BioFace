import os, glob, re

template_dir = '/Users/macbookpro/Documents/GitHub/BioFace/templates'

card_patterns = [
    r'rounded-2xl\s+border\s+border-(?:gray|slate)-[23]00\s+bg-white(.*?)shadow-s[ma](.*?)dark:border-(?:gray|slate)-[78]00\s+dark:bg-(?:gray|slate)-[89]00(?:/80|/90)?',
    r'rounded-xl\s+border\s+border-(?:gray|slate)-[23]00\s+bg-white(.*?)shadow-sm(.*?)dark:border-(?:gray|slate)-[78]00\s+dark:bg-(?:gray|slate)-[89]00(?:/80)?'
]

input_patterns = [
    r'rounded-xl\s+border\s+border-(?:gray|slate)-300\s+bg-(?:gray|slate)-50\s+px-3\s+py-2\s+text-sm\s+text-(?:gray|slate)-900\s+outline-none\s+focus:border-(?:blue|indigo)-500\s+focus:ring(?:-\d+)?\s+focus:ring-(?:blue|indigo)-200\s+dark:border-(?:gray|slate)-700\s+dark:bg-(?:gray|slate)-800\s+dark:text-white\s+dark:focus:ring-(?:blue|indigo)-900/40',
    r'rounded-xl\s+border\s+border-(?:gray|slate)-200\s+bg-white\s+px-4\s+py-3\s+(?:pr-10\s+)?text-sm\s+text-(?:gray|slate)-900\s+shadow-sm\s+focus:border-(?:blue|indigo)-500\s+focus:ring-(?:blue|indigo)-500(.*?)dark:border-(?:gray|slate)-700\s+dark:bg-(?:gray|slate)-900\s+dark:text-white'
]

button_brand_patterns = [
    r'bg-(?:blue|indigo)-600\s+text-white\s+hover:bg-(?:blue|indigo)-700\s+focus:ring-4\s+focus:ring-(?:blue|indigo)-300\s+font-medium\s+rounded-lg\s+text-sm\s+px-5\s+py-2.5',
    r'bg-blue-600\s+text-white\s+hover:bg-blue-700\s+[^"]+rounded-xl'
]

def refactor_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    orig_content = content

    for p in card_patterns:
        # replace finding with 'card-standard' + whatever was caught in (.*?)
        # Actually it's safer to just replace the matched text with card-standard if no groups,
        # but since I have groups, I should preserve them.
        def repl_card(m):
            return 'card-standard' + ''.join(m.groups())
        content = re.sub(p, repl_card, content)

    for p in input_patterns:
        def repl_input(m):
            group_content = ''.join(m.groups()) if m.groups() else ''
            return 'form-input' + group_content
        content = re.sub(p, repl_input, content)

    for p in button_brand_patterns:
        content = re.sub(p, 'btn-brand', content)

    if content != orig_content:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Refactored {filepath}")

for f in glob.glob(f'{template_dir}/**/*.html', recursive=True):
    refactor_file(f)
