import re

with open('templates/dashboard.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Change all fa-solid to fa-duotone in the dashboard
html = html.replace('fa-solid', 'fa-duotone')

# Restore the KPI icons that were removed
# 1. Organizations
kpi_org_match = r'(<article class="rounded-3xl border border-gray-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80">)\s*<p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">({% if lang == \'ru\' %}Организации{% else %}Tashkilotlar{% endif %})</p>\s*<p id="kpi-organizations" class="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{{ summary.organizations }}</p>\s*</article>'
kpi_org_rep = r'''\1
            <div class="flex items-start justify-between gap-3">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">\2</p>
                <span class="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-blue-50/80 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"><i class="fa-duotone fa-buildings"></i></span>
            </div>
            <p id="kpi-organizations" class="mt-3 text-[1.7rem] leading-[1.15] font-bold text-gray-900 dark:text-white">{{ summary.organizations }}</p>
        </article>'''
html = re.sub(kpi_org_match, kpi_org_rep, html)

# 2. Users
kpi_user_match = r'(<article class="rounded-3xl border border-gray-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80">)\s*<p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">({% if lang == \'ru\' %}Пользователи{% else %}Foydalanuvchilar{% endif %})</p>\s*<p id="kpi-users-primary" class="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{{ summary.users }}</p>\s*</article>'
kpi_user_rep = r'''\1
            <div class="flex items-start justify-between gap-3">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">\2</p>
                <span class="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-50/80 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"><i class="fa-duotone fa-users"></i></span>
            </div>
            <p id="kpi-users-primary" class="mt-3 text-[1.7rem] leading-[1.15] font-bold text-gray-900 dark:text-white">{{ summary.users }}</p>
        </article>'''
html = re.sub(kpi_user_match, kpi_user_rep, html)

# 3. Employees
kpi_emp_match = r'(<article class="rounded-3xl border border-gray-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80">)\s*<p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">({% if lang == \'ru\' %}Сотрудники{% else %}Xodimlar{% endif %})</p>\s*<p id="kpi-employees" class="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{{ summary.employees }}</p>\s*</article>'
kpi_emp_rep = r'''\1
            <div class="flex items-start justify-between gap-3">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">\2</p>
                <span class="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-purple-50/80 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"><i class="fa-duotone fa-id-badge"></i></span>
            </div>
            <p id="kpi-employees" class="mt-3 text-[1.7rem] leading-[1.15] font-bold text-gray-900 dark:text-white">{{ summary.employees }}</p>
        </article>'''
html = re.sub(kpi_emp_match, kpi_emp_rep, html)

# 4. Cameras
kpi_cam_match = r'(<article class="rounded-3xl border border-gray-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80">)\s*<p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">({% if lang == \'ru\' %}Камеры{% else %}Kameralar{% endif %})</p>\s*<p class="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{{ summary.active_cameras }}/{{ summary.cameras }}</p>\s*</article>'
kpi_cam_rep = r'''\1
            <div class="flex items-start justify-between gap-3">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">\2</p>
                <span class="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-cyan-50/80 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400"><i class="fa-duotone fa-camera-cctv"></i></span>
            </div>
            <p class="mt-3 text-[1.7rem] leading-[1.15] font-bold text-gray-900 dark:text-white">{{ summary.active_cameras }}/{{ summary.cameras }}</p>
        </article>'''
html = re.sub(kpi_cam_match, kpi_cam_rep, html)

# 5. Present
kpi_pres_match = r'(<article class="rounded-3xl border border-gray-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80">)\s*<p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">({% if lang == \'ru\' %}Пришли{% else %}Kelgan{% endif %})</p>\s*<p id="kpi-present" class="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{{ summary.present_today }}</p>\s*</article>'
kpi_pres_rep = r'''\1
            <div class="flex items-start justify-between gap-3">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">\2</p>
                <span class="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-50/80 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"><i class="fa-duotone fa-circle-check"></i></span>
            </div>
            <p id="kpi-present" class="mt-3 text-[1.7rem] leading-[1.15] font-bold text-emerald-600 dark:text-emerald-400">{{ summary.present_today }}</p>
        </article>'''
html = re.sub(kpi_pres_match, kpi_pres_rep, html)

# 6. Absent
kpi_abs_match = r'(<article class="rounded-3xl border border-gray-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80">)\s*<p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">({% if lang == \'ru\' %}Нет{% else %}Kelmadi{% endif %})</p>\s*<p id="kpi-absent" class="mt-2 text-2xl font-bold text-slate-600 dark:text-slate-400">{{ summary.absent_today }}</p>\s*</article>'
kpi_abs_rep = r'''\1
            <div class="flex items-start justify-between gap-3">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">\2</p>
                <span class="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100/80 text-slate-600 dark:bg-slate-800 dark:text-slate-400"><i class="fa-duotone fa-user-xmark"></i></span>
            </div>
            <p id="kpi-absent" class="mt-3 text-[1.7rem] leading-[1.15] font-bold text-slate-700 dark:text-slate-300">{{ summary.absent_today }}</p>
        </article>'''
html = re.sub(kpi_abs_match, kpi_abs_rep, html)

# 7. Late
kpi_late_match = r'(<article class="rounded-3xl border border-gray-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80">)\s*<p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">({% if lang == \'ru\' %}Опоздали{% else %}Kechikkan{% endif %})</p>\s*<p id="kpi-late" class="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">{{ summary.late_today }}</p>\s*</article>'
kpi_late_rep = r'''\1
            <div class="flex items-start justify-between gap-3">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">\2</p>
                <span class="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-amber-50/80 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"><i class="fa-duotone fa-clock"></i></span>
            </div>
            <p id="kpi-late" class="mt-3 text-[1.7rem] leading-[1.15] font-bold text-amber-600 dark:text-amber-400">{{ summary.late_today }}</p>
        </article>'''
html = re.sub(kpi_late_match, kpi_late_rep, html)

# 8. Late Rate
kpi_rate_match = r'(<article class="rounded-3xl border border-gray-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80">)\s*<p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">({% if lang == \'ru\' %}Доля опозданий{% else %}Kechikish ulushi{% endif %})</p>\s*<p class="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">{{ \'\%\.0f\'\|format\(late_rate\) }}%</p>\s*</article>'
kpi_rate_rep = r'''\1
            <div class="flex items-start justify-between gap-3">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">\2</p>
                <span class="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-rose-50/80 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"><i class="fa-duotone fa-wave-pulse"></i></span>
            </div>
            <p class="mt-3 text-[1.7rem] leading-[1.15] font-bold text-rose-600 dark:text-rose-400">{{ '%.0f'|format(late_rate) }}%</p>
        </article>'''
html = re.sub(kpi_rate_match, kpi_rate_rep, html)


with open('templates/dashboard.html', 'w', encoding='utf-8') as f:
    f.write(html)
