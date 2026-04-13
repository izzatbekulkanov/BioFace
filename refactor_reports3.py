import re

with open("templates/reports.html", "r", encoding="utf-8") as f:
    content = f.read()

new_header = """{% extends "base.html" %}

{% block content %}
    <div class="animate-fade-in space-y-4">
        <section class="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-600 shadow-xl">
            <div class="grid gap-4 p-5 xl:grid-cols-3">
                <div class="space-y-4 xl:col-span-2">
                    <div class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80 backdrop-blur-sm">
                        <i class="fa-solid fa-chart-mixed"></i>
                        <span>{% if lang == "ru" %}Отчеты и статистика{% else %}Hisobot va statistika{% endif %}</span>
                    </div>

                    <div class="space-y-2">
                        <h1 class="text-3xl font-bold tracking-tight text-white">{{ t.reports_title }}</h1>
                        <p class="max-w-3xl text-sm leading-6 text-blue-100">
                            {% if lang == 'ru' %}
                                Отчёт показывает опоздавших и отсутствующих сотрудников только по вашим организациям в удобном формате.
                            {% else %}
                                Hisobot faqat sizga birikkan tashkilotlar bo'yicha kech kelgan va kelmagan xodimlarni premium, lekin zich ritmda ko'rsatadi.
                            {% endif %}
                        </p>
                    </div>

                    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div class="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                            <p class="text-xs font-semibold uppercase tracking-wide text-white/80">{% if lang == 'ru' %}Всего{% else %}Jami xodimlar{% endif %}</p>
                            <p class="mt-2 text-2xl font-bold text-white">{{ total_employees }}</p>
                            <p class="mt-1 text-xs text-white/80">{% if lang == 'ru' %}По всем организациям{% else %}Barcha tashkilotlar bo'yicha{% endif %}</p>
                        </div>
                        <div class="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                            <p class="text-xs font-semibold uppercase tracking-wide text-white/80">{% if lang == 'ru' %}Опоздавшие{% else %}Kech kelganlar{% endif %}</p>
                            <p class="mt-2 text-2xl font-bold text-white">{{ late_count }}</p>
                            <p class="mt-1 text-xs text-white/80">{% if lang == 'ru' %}Зафиксировано сегодня{% else %}Bugun aniqlangan{% endif %}</p>
                        </div>
                        <div class="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                            <p class="text-xs font-semibold uppercase tracking-wide text-white/80">{% if lang == 'ru' %}Отсутствующие{% else %}Kelmaganlar{% endif %}</p>
                            <p class="mt-2 text-2xl font-bold text-white">{{ absent_count }}</p>
                            <p class="mt-1 text-xs text-white/80">{% if lang == 'ru' %}Сотрудники вне офиса{% else %}Ofisdan tashqarida{% endif %}</p>
                        </div>
                        <div class="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                            <p class="text-xs font-semibold uppercase tracking-wide text-white/80">{% if lang == 'ru' %}Показано{% else %}Ko'rinayotganlar{% endif %}</p>
                            <p class="mt-2 text-2xl font-bold text-white" id="reports-visible-count">0</p>
                            <p class="mt-1 text-xs text-white/80">{% if lang == 'ru' %}Результат фильтра{% else %}Filtr natijasi{% endif %}</p>
                        </div>
                    </div>
                </div>

                <div class="flex flex-col justify-between gap-4 rounded-3xl border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
                    <div class="space-y-2">
                        <p class="text-xs font-semibold uppercase tracking-wide text-white/80">{% if lang == "ru" %}Быстрые действия{% else %}Tez amallar{% endif %}</p>
                        <h2 class="text-xl font-semibold text-white">{% if lang == "ru" %}Экспорт данных{% else %}Eksport qilish{% endif %}</h2>
                        <p class="text-sm leading-6 text-white/80">
                            {% if lang == "ru" %}Вы можете экспортировать список опоздавших и отсутствующих или просто распечатать текущий отчет.{% else %}Kech kelganlar va kelmaganlar ro'yxatini tahlil qilish uchun chop etish yoki PDF da saqlash mumkin.{% endif %}
                        </p>
                    </div>

                    <div class="space-y-3">
                        <button type="button" onclick="window.print()" class="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-blue-50">
                            <i class="fa-solid fa-print"></i>
                            <span>{% if lang == "ru" %}Печать отчета{% else %}Hisobotni chop etish{% endif %}</span>
                        </button>
                    </div>
                </div>
            </div>
        </section>

        <section class="rounded-3xl border border-gray-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80">
            <div class="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <p class="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                        {% if lang == "ru" %}Компактный фильтр{% else %}Compact filter{% endif %}</p>
                    <h2 class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{% if lang == "ru" %}Поиск и быстрые срезы{% else %}Qidiruv va tez kesimlar{% endif %}</h2>
                </div>
                <div class="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    <i class="fa-solid fa-filter"></i>
                    <span>{% if lang == "ru" %}Организация, статус и поиск{% else %}Tashkilot, status va qidiruv kesimi{% endif %}</span>
                </div>
            </div>

            <div class="mt-4 grid gap-3 items-end xl:grid-cols-12">
                <label class="block xl:col-span-3">
                    <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{% if lang == "ru" %}Поиск{% else %}Qidiruv{% endif %}</span>
                    <span class="flex overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                        <span class="flex w-11 shrink-0 items-center justify-center border-r border-gray-200 text-gray-400 dark:border-gray-700">
                            <i class="fa-solid fa-magnifying-glass"></i>
                        </span>
                        <input id="reports-search-filter" type="text" placeholder="{% if lang == 'ru' %}ФИО{% else %}F.I.O, familiya{% endif %}" class="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white">
                    </span>
                </label>

                <label class="block xl:col-span-4">
                    <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{% if lang == "ru" %}Организация{% else %}Tashkilot{% endif %}</span>
                    <select id="reports-org-filter" class="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:ring-blue-900/40">
                        <option value="all">{% if lang == 'ru' %}Все организации{% else %}Barcha tashkilotlar{% endif %}</option>
                    </select>
                </label>

                <label class="block xl:col-span-4">
                    <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{% if lang == "ru" %}Статус{% else %}Holat{% endif %}</span>
                    <select id="reports-status-filter" class="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:ring-blue-900/40">
                        <option value="all">{% if lang == 'ru' %}Все{% else %}Barchasi{% endif %}</option>
                        <option value="late">{% if lang == 'ru' %}Опоздавшие{% else %}Kech kelganlar{% endif %}</option>
                        <option value="absent">{% if lang == 'ru' %}Отсутствующие{% else %}Umuman kelmaganlar{% endif %}</option>
                    </select>
                </label>

                <div class="xl:col-span-1">
                    <button id="reports-reset-filter" class="inline-flex w-full h-[42px] items-center justify-center rounded-2xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700" title="Tozalash">
                        <i class="fa-solid fa-filter-slash"></i>
                    </button>
                </div>
            </div>
        </section>

        <section class="overflow-hidden rounded-3xl border border-gray-200 bg-white/80 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80">"""

# Find everything before the table section
content = re.sub(r'\{% extends "base\.html" %\}.*?<section class="overflow-hidden rounded-3xl border border-gray-200 bg-white/80 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80">', new_header, content, flags=re.DOTALL)

with open("templates/reports.html", "w", encoding="utf-8") as f:
    f.write(content)

