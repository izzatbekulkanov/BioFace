import re

with open("/Users/macbookpro/Documents/GitHub/BioFace/templates/add_employee.html", "r") as f:
    text = f.read()

# I will replace everything between {% block content %} and <script src=...
start_marker = "{% block content %}"
end_marker = "<script src=\"/static/js/employees/org-assignment.js"

new_html = """
<div class="animate-fade-in space-y-4">

    <!-- ── HERO BANNER ── -->
    <section class="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-600 shadow-xl">
        <div class="grid gap-4 p-5 lg:grid-cols-3">
            <div class="space-y-4 lg:col-span-2">
                <div class="flex items-start gap-3">
                    <a href="{{ return_to_list_url or '/employees' }}" class="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white transition hover:bg-white/15">
                        <i class="fa-solid fa-arrow-left"></i>
                    </a>
                    <div>
                        <div class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80 backdrop-blur-sm">
                            <i class="fa-solid fa-user-tie"></i>
                            <span>{% if lang == "ru" %}Новый сотрудник{% else %}Yangi xodim qo'shish{% endif %}</span>
                        </div>
                        <h1 class="mt-3 text-3xl font-bold tracking-tight text-white">{{ employee_form_title or ("Добавить сотрудника" if lang == "ru" else "Yangi xodim qo'shish") }}</h1>
                        <p class="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
                            {{ employee_form_description or ("Заполните данные для нового сотрудника." if lang == "ru" else "Yangi xodim uchun ma'lumotlarni to'ldiring: ism, lavozim va grafikni belgilang.") }}
                        </p>
                    </div>
                </div>
            </div>

            <div class="rounded-3xl border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
                <p class="text-xs font-semibold uppercase tracking-wide text-white/80">{% if lang == "ru" %}Что заполняется{% else %}Nimalar kiritiladi{% endif %}</p>
                <div class="mt-3 space-y-3 text-sm text-white/80">
                    <div class="rounded-2xl border border-white/10 bg-white/10 p-3">
                        <p class="font-semibold text-white">Shaxsiy ma'lumotlar & ID</p>
                        <p class="mt-1 text-xs leading-5 text-white/80">Ism-familiya, bo'lim va maxsus 7 xonali Tabel (ID).</p>
                    </div>
                    <div class="rounded-2xl border border-white/10 bg-white/10 p-3">
                        <p class="font-semibold text-white">Kameralarga obuna</p>
                        <p class="mt-1 text-xs leading-5 text-white/80">Tizim ISUP serveri yordamida yuz va vizual datani saqlaydi.</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- ── ERROR BOX ── -->
    <div id="formError" class="hidden rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300"></div>

    <form id="addEmployeeForm" onsubmit="saveNewEmployee(event)">
        <!-- ── MAIN CONTENT GRID ── -->
        <div class="grid gap-4 lg:grid-cols-3 xl:grid-cols-4">

            <!-- ── LEFT: FORM ── -->
            <section class="space-y-4 rounded-3xl border border-gray-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80 lg:col-span-2 xl:col-span-3">

                <!-- Section: Shaxsiy ma'lumotlar -->
                <div>
                    <p class="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">Asosiy axborotlar</p>
                    <h2 class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">Foydalanuvchi ma'lumotlari va Tabel ID</h2>
                </div>

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                        <label class="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">{{ t.first_name }} <span class="text-red-500">*</span></label>
                        <div class="flex overflow-hidden rounded-2xl border border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition">
                            <span class="flex w-10 shrink-0 items-center justify-center border-r border-gray-300 text-gray-400 dark:border-gray-700"><i class="fa-solid fa-user text-xs"></i></span>
                            <input type="text" id="firstName" placeholder="Ism" class="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white" required>
                        </div>
                    </div>
                    <div>
                        <label class="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">{{ t.last_name }} <span class="text-red-500">*</span></label>
                        <div class="flex overflow-hidden rounded-2xl border border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition">
                            <span class="flex w-10 shrink-0 items-center justify-center border-r border-gray-300 text-gray-400 dark:border-gray-700"><i class="fa-solid fa-user text-xs"></i></span>
                            <input type="text" id="lastName" placeholder="Familiya" class="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white" required>
                        </div>
                    </div>
                    <div>
                        <label class="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">Otasining ismi</label>
                        <div class="flex overflow-hidden rounded-2xl border border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition">
                            <span class="flex w-10 shrink-0 items-center justify-center border-r border-gray-300 text-gray-400 dark:border-gray-700"><i class="fa-solid fa-user text-xs"></i></span>
                            <input type="text" id="middleName" placeholder="Otasining rusmiyoti" class="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white">
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                        <label class="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">Xodim turi</label>
                        <select id="employeeType" class="w-full rounded-2xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white transition">
                            <option value="" {% if not default_employee_type %}selected{% endif %}>Tanlanmagan</option>
                            <option value="oquvchi" {% if default_employee_type == 'oquvchi' %}selected{% endif %}>O'quvchi</option>
                            <option value="oqituvchi" {% if default_employee_type == 'oqituvchi' %}selected{% endif %}>O'qituvchi</option>
                            <option value="hodim" {% if default_employee_type == 'hodim' %}selected{% endif %}>Xodim</option>
                        </select>
                    </div>
                    <div>
                        <label class="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">Shaxsiy tabel / ID</label>
                        <div class="flex">
                            <div class="flex overflow-hidden rounded-l-2xl border border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition flex-1">
                                <span class="flex w-10 shrink-0 items-center justify-center border-r border-gray-300 text-gray-400 dark:border-gray-700"><i class="fa-solid fa-id-card text-xs"></i></span>
                                <input type="text" id="personalId" maxlength="7" inputmode="numeric" autocomplete="off" readonly placeholder="7 xonali ID" class="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-gray-900 font-mono outline-none placeholder:text-gray-400 dark:text-white">
                            </div>
                            <button type="button" id="btnGeneratePersonalId" onclick="generatePersonalId()" class="rounded-r-2xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 shrink-0">
                                <i class="fa-solid fa-rotate-right mr-1"></i> Generatsiya
                            </button>
                        </div>
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between mt-1">
                            <label class="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                                <input type="checkbox" id="manualPersonalId" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" onchange="toggleManualPersonalId()">
                                Qo'lda kiritish
                            </label>
                            <p id="personalIdHint" class="text-[11px] text-gray-500 mt-1 sm:mt-0">ID 7 raqamdan iborat va 0 dan boshlanmaydi.</p>
                        </div>
                    </div>
                </div>

                <!-- Divider -->
                <div class="border-t border-gray-100 pt-4 dark:border-gray-800 mt-2">
                    <p class="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">Lavozim va Reja</p>
                    <h2 class="mt-1 text-base font-semibold text-gray-900 dark:text-white">Ish joyi va grafik biriktirish</h2>
                </div>

                {% set org_assignment_title = "Tashkiliy birikma" %}
                {% set org_assignment_description = "Tashkilot tanlang, keyin bo'lim va lavozimni belgilang." %}
                {% set org_assignment_badge = "Tashkilot avtomatik tanlandi" %}
                {% set org_assignment_selected_org_id = default_organization_id %}
                {% set org_assignment_org_help = "Siz faqat shu tashkilotga biriktirilgansiz." if single_organization_mode else "Faqat ruxsat berilganlar." %}
                {% set org_assignment_department_id = "" %}
                {% set org_assignment_department_name = "" %}
                {% set org_assignment_department_help = "Avval tashkilotni tanlang." %}
                {% set org_assignment_position_id = "" %}
                {% set org_assignment_position_name = "" %}
                {% set org_assignment_position_help = "Avval bo'limni tanlang." %}
                
                <div class="grid grid-cols-1 gap-6 bg-gray-50/50 dark:bg-gray-800/30 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 -mx-1">
                    {% include "employees/partials/org_assignment_fields.html" %}
                </div>

                <div class="grid grid-cols-1 gap-6 bg-gray-50/50 dark:bg-gray-800/30 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 mt-4 -mx-1">
                    {% include "employees/partials/schedule_fields.html" %}
                    
                    <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
                        <label class="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">Kameralarni Tanlash <span class="text-xs text-gray-500 font-normal ml-2">(Yuz ruxsatnomasi uchun)</span></label>
                        <div id="cam-list" class="flex flex-wrap gap-2 p-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl min-h-[48px] text-sm text-gray-400">
                            Avval tashkilotni tanlang...
                        </div>
                        <input type="hidden" id="selectedCameras" value="[]">
                    </div>
                    
                    <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
                        <label class="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">Shaxsiy Ish Vaqti</label>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">Grafik bo'lmasa yoki undan farq qilsa foydalaniladi. Aks holda bo'sh qoldiring.</p>
                        
                        <div class="grid gap-4 grid-cols-1 sm:grid-cols-2">
                            <div>
                                <div class="flex overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition">
                                    <span class="flex w-10 shrink-0 items-center justify-center border-r border-gray-300 text-gray-400 dark:border-gray-700"><i class="fa-solid fa-clock text-xs"></i></span>
                                    <input type="time" id="startTime" class="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-gray-900 outline-none dark:text-white">
                                </div>
                            </div>
                            <div>
                                <div class="flex overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition">
                                    <span class="flex w-10 shrink-0 items-center justify-center border-r border-gray-300 text-gray-400 dark:border-gray-700"><i class="fa-solid fa-clock text-xs"></i></span>
                                    <input type="time" id="endTime" class="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-gray-900 outline-none dark:text-white">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Divider -->
                <div class="border-t border-gray-100 pt-4 dark:border-gray-800 mt-2">
                    <p class="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">Yuz Metadatalari</p>
                    <h2 class="mt-1 text-base font-semibold text-gray-900 dark:text-white">O'tish punkti uchi rasm yuklash</h2>
                </div>

                <div class="col-span-1 md:col-span-2">
                    <label class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Yuz rasmi yuklash (Ixtiyoriy)</label>
                    <input class="hidden" id="image" type="file" accept="image/*">
                    <div id="emp-image-dropzone" class="relative rounded-2xl border-2 border-dashed border-blue-300 bg-gradient-to-br from-blue-50 via-indigo-50 to-sky-50 dark:border-gray-600 dark:from-gray-800/50 dark:via-gray-800/30 dark:to-gray-800/10 p-5 transition-all cursor-pointer hover:shadow-md hover:border-blue-400 dark:hover:border-gray-500">
                        <div id="emp-upload-empty" class="flex items-center gap-4">
                            <div class="w-14 h-14 rounded-2xl bg-white dark:bg-gray-800 shadow-sm border border-blue-100 dark:border-gray-700 flex items-center justify-center text-blue-600 dark:text-gray-300 shrink-0">
                                <i class="fa-solid fa-cloud-arrow-up text-xl"></i>
                            </div>
                            <div class="min-w-0">
                                <p class="text-sm font-semibold text-gray-800 dark:text-gray-100">Rasmni bu yerga tashlang yoki fayl tanlang</p>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">JPG, PNG. Yuz aniq markazda ko'rinishi tavsiya qilinadi.</p>
                                <button type="button" id="emp-btn-open-file" class="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition">
                                    <i class="fa-solid fa-folder-open"></i> Tanlash
                                </button>
                            </div>
                        </div>

                        <div id="emp-upload-preview" class="hidden items-center gap-4">
                            <img id="emp-upload-preview-img" src="" alt="Preview" class="w-20 h-20 rounded-2xl object-cover ring-2 ring-white dark:ring-gray-800 shadow-md">
                            <div class="min-w-0 flex-1">
                                <p id="emp-upload-file-name" class="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate"></p>
                                <p id="emp-upload-file-size" class="text-xs text-gray-500 dark:text-gray-400 mt-1"></p>
                                <div class="mt-2 flex items-center gap-2">
                                    <button type="button" id="emp-btn-change-file" class="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition">Almashtirish</button>
                                    <button type="button" id="emp-btn-remove-file" class="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition">O'chirish</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="mt-6 flex flex-col gap-3 border-t border-gray-100 pt-5 dark:border-gray-800 sm:flex-row sm:items-center">
                    <a href="{{ return_to_list_url or '/employees' }}" class="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 sm:w-auto w-full">
                        <i class="fa-solid fa-arrow-left"></i>
                        <span>Bekor qilish</span>
                    </a>
                    <button type="submit" class="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 sm:w-auto w-full">
                        <i id="saveSpinner" class="fa-solid fa-circle-notch animate-spin" style="display:none"></i>
                        <i class="fa-solid fa-floppy-disk"></i>
                        <span>Saqlash va davom etish</span>
                    </button>
                </div>
            </section>

            <!-- ── RIGHT: SUMMARY PANEL ── -->
            <aside class="space-y-4 xl:col-span-1">
                <section class="rounded-3xl border border-gray-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80 text-center">
                    <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-blue-50 text-2xl text-blue-600 dark:from-indigo-900/40 dark:to-blue-900/40 dark:text-blue-400">
                        <i class="fa-duotone fa-user-shield"></i>
                    </div>
                    <h3 class="mt-3 text-sm font-bold text-gray-900 dark:text-white">Tasdiqlash tartibi</h3>
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Shaxs ma'lumotlari tasdiqlangandan keyin markaziy server va tanlangan kameralar ISUP ma'lumotlar bazasiga sinxron qilinadi.</p>
                </section>
                
                <section class="rounded-3xl border border-gray-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80">
                    <p class="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">Eslatmalar</p>
                    <ul class="mt-3 space-y-3 text-xs text-gray-600 dark:text-gray-400 list-disc list-inside">
                        <li>ISUP tizimi 1 yuz rasmini birdaniga ko'p kameralarda tarqatadi.</li>
                        <li>Shaxsiy raqam (ID) qurilmalarda parolingizni bilmasdan tasdiqlash uchun xizmat qiladi.</li>
                        <li>Yuklangan suratlarni JPG/PNG ekaniga e'tibor bering.</li>
                    </ul>
                </section>
            </aside>
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
