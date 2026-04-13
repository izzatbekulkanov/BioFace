import re

with open("templates/reports.html", "r", encoding="utf-8") as f:
    content = f.read()

# Add the table header title block
new_table_start = """<section class="overflow-hidden rounded-3xl border border-gray-200 bg-white/80 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80">
            <div class="flex flex-col gap-2 border-b border-gray-100 px-4 py-4 dark:border-gray-800 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{% if lang == "ru" %}Список нарушений{% else %}Qoidabuzarliklar reyestri{% endif %}</h2>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{% if lang == "ru" %}Детализированная таблица опозданий и отсутствий{% else %}Kechikish va kelmaslik holatlari bitta ixcham jadvalda{% endif %}</p>
                </div>
                <div class="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white dark:bg-white dark:text-slate-900">
                    <i class="fa-solid fa-table-list"></i>
                    <span>{% if lang == "ru" %}Плотный режим{% else %}Zich ko'rinish{% endif %}</span>
                </div>
            </div>
    <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
            <thead class="bg-gray-50 dark:bg-gray-950">
                <tr>
                    <th class="w-16 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">#</th>
                    <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t.employee }}</th>
                    <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tashkilot</th>
                    <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t.camera }}</th>
                    <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t.arrival_time }}</th>
                    <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t.delay }}</th>
                    <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t.status }}</th>
                </tr>
            </thead>"""

content = re.sub(
    r'<section class="overflow-hidden rounded-3xl border border-gray-200 bg-white/80 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80">\s*<div class="overflow-x-auto">\s*<table class="table-standard">\s*<thead>\s*<tr>.*?</tr>\s*</thead>',
    new_table_start,
    content,
    flags=re.DOTALL
)

# Also fix the closing tag for the table block if it's </div> instead of </section>
# Check the end of the file
if content.endswith('</div>\n</div>\n\n<script id="reports-late-json"'):
    content = content.replace('</div>\n</div>\n\n<script id="reports-late-json"', '</section>\n\n<script id="reports-late-json"')
# Wait, let's just make sure the closing tags match:
content = content.replace('        </div>\n    </div>\n</div>\n\n<script', '        </div>\n    </div>\n</section>\n\n<script')

with open("templates/reports.html", "w", encoding="utf-8") as f:
    f.write(content)
