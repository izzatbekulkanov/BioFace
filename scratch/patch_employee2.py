import re

with open("/Users/macbookpro/Documents/GitHub/BioFace/templates/add_employee.html", "r") as f:
    text = f.read()

start_marker = "{% block content %}"
end_marker = "<script src=\"/static/js/employees/org-assignment.js"

new_html = """
<div class="animate-fade-in space-y-6">

    <!-- ── HERO BANNER ── -->
    <section class="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-600 shadow-xl">
        <div class="grid gap-4 p-5 md:p-8 lg:grid-cols-3">
            <div class="space-y-4 lg:col-span-2">
                <div class="flex items-start gap-4">
                    <a href="{{ return_to_list_url or '/employees' }}" class="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white transition hover:bg-white/15">
                        <i class="fa-solid fa-arrow-left text-xl"></i>
                    </a>
                    <div>
                        <div class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-white/90 backdrop-blur-sm">
                            <i class="fa-solid fa-user-tie"></i>
                            <span>{% if lang == "ru" %}Новый сотрудник{% else %}Yangi xodim qo'shish{% endif %}</span>
                        </div>
                        <h1 class="mt-3 text-3xl font-bold tracking-tight text-white">{{ employee_form_title or ("Добавить сотрудника" if lang == "ru" else "Yangi xodim qo'shish") }}</h1>
                        <p class="mt-2 max-w-2xl text-sm leading-relaxed text-indigo-100">
                            {{ employee_form_description or ("Заполните данные для нового сотрудника." if lang == "ru" else "Tizimga yangi xodim qo'shish uchun zarur bo'lgan shaxsiy va lavozim ma'lumotlarini to'ldiring. Ma'lumotlar avtomat ravishda kameralar xotirasiga sinxronizatsiya qilinadi.") }}
                        </p>
                    </div>
                </div>
            </div>

            <div class="rounded-3xl border border-white/10 bg-black/20 p-5 backdrop-blur-sm">
                <p class="text-xs font-bold uppercase tracking-widest text-indigo-200">{% if lang == "ru" %}Что заполняется{% else %}Eslatmalar{% endif %}</p>
                <div class="mt-4 space-y-3 test-sm text-white/90">
                    <div class="flex items-center gap-3">
                        <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
                            <i class="fa-solid fa-id-card"></i>
                        </div>
                        <p class="text-xs leading-tight text-white/80"><span class="font-semibold text-white">ID (Tabel) raqami</span> barcha kameralarda xodimni yagona identifikatsiya qiladi.</p>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                            <i class="fa-solid fa-camera"></i>
                        </div>
                        <p class="text-xs leading-tight text-white/80"><span class="font-semibold text-emerald-100">Yuz rasmini kiritish</span> ushbu sahifadan bevosita amalga oshiriladi.</p>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-300">
                            <i class="fa-solid fa-clock"></i>
                        </div>
                        <p class="text-xs leading-tight text-white/80"><span class="font-semibold text-amber-100">Shaxsiy ish vaqti</span> kiritilsa tayyor smenadan ustun turadi.</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- ── ERROR BOX ── -->
    <div id="formError" class="hidden rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300"></div>

    <form id="addEmployeeForm" onsubmit="saveNewEmployee(event)">
        <!-- ── EXCLUSIVE FULL WIDTH FORM ── -->
        <div class="space-y-6">

            <!-- ── SECTION 1: ASOSIY MA'LUMOTLAR ── -->
            <section class="rounded-3xl border border-gray-200 bg-white/80 p-6 sm:p-8 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80">
                <div class="mb-6 flex items-center gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
                    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                        <i class="fa-solid fa-address-card text-lg"></i>
                    </div>
                    <div>
                        <h2 class="text-lg font-bold text-gray-900 dark:text-white">Asosiy ma'lumotlar</h2>
                        <p class="text-sm text-gray-500 dark:text-gray-400">Foydalanuvchi ma'lumotlari, ID va turkalarni belgilang.</p>
                    </div>
                </div>

                <div class="grid grid-cols-1 gap-6 sm:grid-cols-3">
                    <div>
                        <label class="mb-1.5 block text-sm font-semibold text-gray-900 dark:text-gray-200">{{ t.first_name }} <span class="text-red-500">*</span></label>
                        <div class="flex h-11 overflow-hidden rounded-xl border border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition">
                            <span class="flex w-10 shrink-0 items-center justify-center border-r border-gray-300 text-gray-400 dark:border-gray-700"><i class="fa-solid fa-user text-xs"></i></span>
                            <input type="text" id="firstName" placeholder="Ism" class="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white" required>
                        </div>
                    </div>
                    <div>
                        <label class="mb-1.5 block text-sm font-semibold text-gray-900 dark:text-gray-200">{{ t.last_name }} <span class="text-red-500">*</span></label>
                        <div class="flex h-11 overflow-hidden rounded-xl border border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition">
                            <span class="flex w-10 shrink-0 items-center justify-center border-r border-gray-300 text-gray-400 dark:border-gray-700"><i class="fa-solid fa-user text-xs"></i></span>
                            <input type="text" id="lastName" placeholder="Familiya" class="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white" required>
                        </div>
                    </div>
                    <div>
                        <label class="mb-1.5 block text-sm font-semibold text-gray-900 dark:text-gray-200">Otasining ismi</label>
                        <div class="flex h-11 overflow-hidden rounded-xl border border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition">
                            <span class="flex w-10 shrink-0 items-center justify-center border-r border-gray-300 text-gray-400 dark:border-gray-700"><i class="fa-solid fa-user text-xs"></i></span>
                            <input type="text" id="middleName" placeholder="Ixtiyoriy" class="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white">
                        </div>
                    </div>
                </div>

                <div class="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                        <label class="mb-1.5 block text-sm font-semibold text-gray-900 dark:text-gray-200">Xodim turi <span class="text-red-500">*</span></label>
                        <div class="relative flex h-11 items-center overflow-hidden rounded-xl border border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition">
                            <span class="flex w-10 shrink-0 items-center justify-center border-r border-gray-300 text-gray-400 dark:border-gray-700"><i class="fa-solid fa-briefcase text-xs"></i></span>
                            <select id="employeeType" class="min-w-0 flex-1 bg-transparent pl-3 pr-10 py-2.5 text-sm text-gray-900 outline-none dark:text-white appearance-none cursor-pointer h-full" required>
                                <option value="" {% if not default_employee_type %}selected{% endif %}>Tanlang...</option>
                                <option value="oquvchi" {% if default_employee_type == 'oquvchi' %}selected{% endif %}>O'quvchi</option>
                                <option value="oqituvchi" {% if default_employee_type == 'oqituvchi' %}selected{% endif %}>O'qituvchi</option>
                                <option value="hodim" {% if default_employee_type == 'hodim' %}selected{% endif %}>Xodim</option>
                            </select>
                            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500"><i class="fa-solid fa-chevron-down text-xs"></i></div>
                        </div>
                    </div>

                    <div>
                        <div class="flex items-end justify-between mb-1.5">
                            <label class="block text-sm font-semibold text-gray-900 dark:text-gray-200">Tabel (ID) Raqami <span class="text-red-500">*</span></label>
                            <label class="inline-flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-400 cursor-pointer">
                                <input type="checkbox" id="manualPersonalId" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5" onchange="toggleManualPersonalId()">
                                Qo'lda kiritish
                            </label>
                        </div>
                        <div class="flex h-11">
                            <div class="flex overflow-hidden rounded-l-xl border border-gray-300 bg-gray-50 border-r-0 dark:border-gray-700 dark:bg-gray-800 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition flex-1">
                                <span class="flex w-10 shrink-0 items-center justify-center border-r border-gray-300 text-gray-400 dark:border-gray-700"><i class="fa-solid fa-id-card text-xs"></i></span>
                                <input type="text" id="personalId" maxlength="7" inputmode="numeric" autocomplete="off" readonly placeholder="Qo'llanma: 7 xona" class="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-gray-900 font-mono outline-none placeholder:text-gray-400 dark:text-white h-full" required>
                            </div>
                            <button type="button" id="btnGeneratePersonalId" onclick="generatePersonalId()" class="rounded-r-xl border border-blue-600 border-l-0 bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 shrink-0 whitespace-nowrap h-11 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900">
                                <i class="fa-solid fa-rotate-right mr-1.5"></i>Generatsiya
                            </button>
                        </div>
                        <p id="personalIdHint" class="text-[11px] text-gray-500 mt-1.5 font-medium">Bazada takrorlanmaydigan avtomatik ID.</p>
                    </div>
                </div>
            </section>

            <!-- ── SECTION 2: ORGANIZATIONAL ── -->
            <section class="rounded-3xl border border-gray-200 bg-white/80 p-6 sm:p-8 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80">
                <div class="mb-6 flex items-center gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
                    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                        <i class="fa-solid fa-sitemap text-lg"></i>
                    </div>
                    <div>
                        <h2 class="text-lg font-bold text-gray-900 dark:text-white">Tashkiliy tuzilma va smena</h2>
                        <p class="text-sm text-gray-500 dark:text-gray-400">Xodim ish joyi, grafik va alohida ish vaqtlarini belgilang.</p>
                    </div>
                </div>

                {% set org_assignment_title = "Ish o'rni" %}
                {% set org_assignment_description = "" %}
                {% set org_assignment_badge = "Tashkilot avtomatik tanlandi" %}
                {% set org_assignment_selected_org_id = default_organization_id %}
                {% set org_assignment_org_help = "Siz faqat shu tashkilotga biriktirilgansiz." if single_organization_mode else "Ruxsat etilgan tashkilotlar." %}
                {% set org_assignment_department_id = "" %}
                {% set org_assignment_department_name = "" %}
                {% set org_assignment_department_help = "" %}
                {% set org_assignment_position_id = "" %}
                {% set org_assignment_position_name = "" %}
                {% set org_assignment_position_help = "" %}
                
                <div class="bg-gray-50/50 dark:bg-gray-800/30 p-5 sm:p-6 rounded-2xl border border-gray-100 dark:border-gray-700/50">
                    <div class="grid grid-cols-1 gap-6 relative">
                        {% include "employees/partials/org_assignment_fields.html" %}
                    </div>
                </div>

                <div class="mt-6 bg-gray-50/50 dark:bg-gray-800/30 p-5 sm:p-6 rounded-2xl border border-gray-100 dark:border-gray-700/50">
                    <div class="grid grid-cols-1 gap-6 relative">
                        {% include "employees/partials/schedule_fields.html" %}
                    </div>
                </div>

                <div class="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2">
                    <div class="bg-gray-50/50 dark:bg-gray-800/30 p-5 rounded-2xl border border-gray-100 dark:border-gray-700/50">
                        <label class="mb-1.5 block text-sm font-semibold text-gray-900 dark:text-gray-200">Shaxsiy Ish Vaqti</label>
                        <p class="mb-4 text-xs font-medium text-gray-500 dark:text-gray-400">Bo'sh qoldirilsa avtomatik smenadan oladi.</p>
                        
                        <div class="flex items-center gap-3">
                            <div class="flex h-11 flex-1 overflow-hidden rounded-xl border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition">
                                <span class="flex w-16 shrink-0 items-center justify-center border-r border-gray-200 text-gray-600 bg-gray-50 text-xs font-semibold dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400">
                                    Kelish
                                </span>
                                <input type="time" id="startTime" class="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-gray-900 outline-none dark:text-white w-full h-full">
                            </div>
                            <span class="text-gray-400"><i class="fa-solid fa-arrow-right"></i></span>
                            <div class="flex h-11 flex-1 overflow-hidden rounded-xl border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition">
                                <span class="flex w-16 shrink-0 items-center justify-center border-r border-gray-200 text-gray-600 bg-gray-50 text-xs font-semibold dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400">
                                    Ketish
                                </span>
                                <input type="time" id="endTime" class="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-gray-900 outline-none dark:text-white w-full h-full">
                            </div>
                        </div>
                    </div>
                    <div class="bg-gray-50/50 dark:bg-gray-800/30 p-5 rounded-2xl border border-gray-100 dark:border-gray-700/50 flex flex-col h-full">
                        <label class="mb-1.5 block text-sm font-semibold text-gray-900 dark:text-gray-200">Kameralarni Tanlash</label>
                        <p class="mb-4 text-xs font-medium text-gray-500 dark:text-gray-400">Xodim ruхsatnoma yuz rasmini oladigan nuqtalar.</p>
                        
                        <div id="cam-list" class="flex flex-wrap items-start gap-2 p-3 flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-y-auto max-h-[140px] shadow-inner text-sm text-gray-500 custom-scrollbar">
                            Avval tashkilotni tanlang...
                        </div>
                        <input type="hidden" id="selectedCameras" value="[]">
                    </div>
                </div>
            </section>

            <!-- ── SECTION 3: YUZ RASMI ── -->
            <section class="rounded-3xl border border-gray-200 bg-white/80 p-6 sm:p-8 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80">
                <div class="mb-6 flex items-center gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
                    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                        <i class="fa-solid fa-face-viewfinder text-lg"></i>
                    </div>
                    <div>
                        <h2 class="text-lg font-bold text-gray-900 dark:text-white">Obyektga o'tish yuz rasmi</h2>
                        <p class="text-sm text-gray-500 dark:text-gray-400">Maxsus qurilmalar orqali aniqlanuvchi biometrik tasvir.</p>
                    </div>
                </div>

                <div class="w-full">
                    <input class="hidden" id="image" type="file" accept="image/*">
                    <div id="emp-image-dropzone" class="relative overflow-hidden rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/30 p-8 sm:p-12 transition-all cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 group">
                        
                        <div id="emp-upload-empty" class="flex flex-col items-center justify-center text-center">
                            <div class="mb-4 flex h-16 w-16 items-center justify-center w-max rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 group-hover:scale-110 transition-transform">
                                <i class="fa-solid fa-cloud-arrow-up text-3xl"></i>
                            </div>
                            <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-2">Rasmni yuklash uchun ustiga bosing</h3>
                            <p class="text-sm font-medium text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-6">Yuzingiz aniq markazda, yorug'lik yetarli tushgan suratni (JPG, PNG) yuklang.</p>
                            
                            <button type="button" id="emp-btn-open-file" class="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 font-semibold text-white transition hover:bg-blue-700 shadow-sm">
                                <i class="fa-solid fa-image"></i> Kompyuterdan tanlash
                            </button>
                        </div>

                        <div id="emp-upload-preview" class="hidden items-center justify-center gap-6">
                            <div class="relative shrink-0">
                                <img id="emp-upload-preview-img" src="" alt="Preview" class="h-32 w-32 rounded-2xl object-cover shadow-lg ring-4 ring-white dark:ring-gray-800">
                                <div class="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow ring-2 ring-white dark:ring-gray-800">
                                    <i class="fa-solid fa-check text-sm"></i>
                                </div>
                            </div>
                            <div class="flex flex-col flex-1 max-w-sm border-l border-gray-200 dark:border-gray-700 pl-6">
                                <h4 id="emp-upload-file-name" class="text-base font-bold text-gray-900 dark:text-white truncate">rasm.jpg</h4>
                                <p id="emp-upload-file-size" class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">1.2 MB</p>
                                <div class="flex items-center gap-3">
                                    <button type="button" id="emp-btn-change-file" class="inline-flex h-9 items-center justify-center rounded-lg bg-blue-50 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50">Boshqa tashlash</button>
                                    <button type="button" id="emp-btn-remove-file" class="inline-flex h-9 items-center justify-center rounded-lg bg-red-50 px-4 text-sm font-semibold text-red-700 hover:bg-red-100 transition dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50">O'chirish</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="mt-8 flex flex-col gap-3 border-t border-gray-100 pt-6 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
                    <a href="{{ return_to_list_url or '/employees' }}" class="inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-6 font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 shadow-sm outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-600">
                        <i class="fa-solid fa-arrow-left"></i>
                        Ortga qaytish
                    </a>
                    <button type="submit" class="inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 font-bold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-900 shadow-lg shadow-blue-600/20">
                        <i id="saveSpinner" class="fa-solid fa-circle-notch animate-spin" style="display:none"></i>
                        <i class="fa-solid fa-floppy-disk"></i>
                        Barcha ma'lumotlarni saqlash
                    </button>
                </div>
            </section>
        </div>
    </form>
</div>
"""

start_pos = text.find(start_marker)
end_pos = text.find(end_marker)

if start_pos == -1 or end_pos == -1:
    print("Marks not found!")
else:
    new_contents = text[:start_pos + len(start_marker)] + "\n" + new_html + "\n" + text[end_pos:]
    with open("/Users/macbookpro/Documents/GitHub/BioFace/templates/add_employee.html", "w") as f:
        f.write(new_contents)
    print("Replaced successfully!")
