(function () {
    const organizationNames = window.__DEVICE_ORGS__ || {};
    const permissions = window.__DEVICE_PERMISSIONS__ || {};
    const state = { cameras: [], filtered: [], page: 1, pageSize: 50 };

    function $(id) { return document.getElementById(id); }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    function notify(kind, message, options) {
        const appNotify = window.AppNotify;
        if (appNotify && typeof appNotify[kind] === "function") {
            appNotify[kind](message, options || {});
            return;
        }
        if (kind === "error") console.error(message);
    }

    function formatDate(value) {
        if (!value) return "Aloqa yo'q";
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return "Noma'lum";
        return parsed.toLocaleString("uz-UZ", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    function usedPercent(camera) {
        const used = Number(camera.used_faces || 0);
        const max = Number(camera.max_memory || 0);
        if (!max) return 0;
        return Math.max(0, Math.min(100, Math.round((used / max) * 100)));
    }

    function usageTone(percent) {
        if (percent >= 85) return "rose";
        if (percent >= 60) return "amber";
        return "blue";
    }

    function pageCount() {
        return Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
    }

    function clampPage() {
        state.page = Math.min(Math.max(1, state.page), pageCount());
    }

    function sortCameras(cameras) {
        return [...cameras].sort((a, b) => {
            if (Boolean(a.is_online) !== Boolean(b.is_online)) {
                return a.is_online ? -1 : 1;
            }
            return String(a.name || "").localeCompare(String(b.name || ""), "uz");
        });
    }

    function renderStats(total, filtered) {
        const onlineTotal = total.filter((camera) => camera.is_online).length;
        $("stat-total").textContent = String(total.length);
        $("stat-online").textContent = String(onlineTotal);
        $("stat-offline").textContent = String(total.length - onlineTotal);
        $("stat-filtered").textContent = String(filtered.length);
    }

    function renderCountLine(total, filtered) {
        const filteredOnline = filtered.filter((camera) => camera.is_online).length;
        $("cam-count").textContent = `${filteredOnline} faol / ${filtered.length} filter natija / ${total.length} jami kamera`;
    }

    function renderPagination() {
        const totalPages = pageCount();
        const total = state.filtered.length;
        const start = total === 0 ? 0 : ((state.page - 1) * state.pageSize) + 1;
        const end = Math.min(total, state.page * state.pageSize);
        $("page-prev").disabled = state.page <= 1;
        $("page-next").disabled = state.page >= totalPages;
        $("pagination-summary").textContent = `${start}-${end} / ${total} ta natija`;

        const numbers = $("page-numbers");
        numbers.innerHTML = "";
        const pages = [];
        const from = Math.max(1, state.page - 2);
        const to = Math.min(totalPages, state.page + 2);
        for (let page = from; page <= to; page += 1) pages.push(page);
        if (from > 1) {
            pages.unshift(1);
            if (from > 2) pages.splice(1, 0, "dots-left");
        }
        if (to < totalPages) {
            if (to < totalPages - 1) pages.push("dots-right");
            pages.push(totalPages);
        }

        pages.forEach((item) => {
            if (String(item).startsWith("dots")) {
                const dots = document.createElement("span");
                dots.className = "px-1 text-sm text-gray-400";
                dots.textContent = "...";
                numbers.appendChild(dots);
                return;
            }
            const button = document.createElement("button");
            button.type = "button";
            button.className = item === state.page
                ? "inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white shadow-sm"
                : "inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-xl border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700";
            button.textContent = String(item);
            button.addEventListener("click", () => {
                state.page = Number(item);
                renderCards();
            });
            numbers.appendChild(button);
        });
    }

    function attachDeleteHandlers() {
        const cards = $("cam-cards");
        if (!cards) return;
        cards.querySelectorAll("[data-delete-id]").forEach((button) => {
            button.addEventListener("click", () => deleteCamera(button.dataset.deleteId, button.dataset.deleteName));
        });
    }

    function renderEmptyCards() {
        $("cam-cards").innerHTML = `
            <div class="rounded-[24px] border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400 sm:col-span-2 xl:col-span-3 2xl:col-span-4">
                <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-gray-400 shadow-sm dark:bg-gray-800 dark:text-gray-500">
                    <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                    </svg>
                </div>
                Qidiruvga mos kamera topilmadi.
            </div>
        `;
        renderPagination();
    }

    function actionButton({ href, title, tone, icon, dataDeleteId, dataDeleteName }) {
        const toneClasses = {
            blue: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-300",
            emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300",
            amber: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300",
            rose: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-300",
        };
        const sharedClass = `inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${toneClasses[tone] || toneClasses.blue}`;
        if (href) {
            return `
                <a href="${href}" class="${sharedClass}" title="${title}">
                    ${icon}
                </a>
            `;
        }
        return `
            <button
                type="button"
                data-delete-id="${dataDeleteId}"
                data-delete-name="${dataDeleteName}"
                class="${sharedClass}"
                title="${title}"
            >
                ${icon}
            </button>
        `;
    }

    function cameraCard(camera, absoluteIndex) {
        const percent = usedPercent(camera);
        const tone = usageTone(percent);
        const orgName = organizationNames[String(camera.organization_id)] || "Biriktirilmagan";
        const online = Boolean(camera.is_online);
        const statusClass = online
            ? "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-900/40"
            : "bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:ring-rose-900/40";
        const progressClass = tone === "rose" ? "bg-rose-500" : (tone === "amber" ? "bg-amber-500" : "bg-blue-500");
        const topGlow = online
            ? "from-emerald-500 via-cyan-500 to-blue-500"
            : "from-rose-500 via-orange-500 to-amber-500";
        const manageAllowed = Boolean(permissions.canManage);
        const detailButton = actionButton({
            href: `/camera-info?id=${camera.id}`,
            title: "Batafsil",
            tone: "blue",
            icon: `
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
            `,
        });
        const commandButton = manageAllowed ? actionButton({
            href: `/commands?cam=${camera.id}`,
            title: "Buyruqlar",
            tone: "emerald",
            icon: `
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
            `,
        }) : "";
        const editButton = manageAllowed ? actionButton({
            href: `/devices/edit?id=${camera.id}`,
            title: "Tahrirlash",
            tone: "amber",
            icon: `
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                </svg>
            `,
        }) : "";
        const deleteButton = manageAllowed ? actionButton({
            title: "O'chirish",
            tone: "rose",
            dataDeleteId: camera.id,
            dataDeleteName: escapeHtml(camera.name || "Kamera"),
            icon: `
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
            `,
        }) : "";

        return `
            <article class="group relative overflow-hidden rounded-[24px] border border-gray-200 bg-white/95 p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-gray-800 dark:bg-gray-900/95">
                <div class="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${topGlow}"></div>
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-600 dark:bg-gray-800 dark:text-gray-300">#${absoluteIndex}</span>
                            <span class="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">${escapeHtml(orgName)}</span>
                        </div>
                        <h3 class="mt-2.5 truncate text-base font-bold text-gray-900 dark:text-white" title="${escapeHtml(camera.name || "-")}">${escapeHtml(camera.name || "-")}</h3>
                        <p class="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">${escapeHtml(camera.location || "Lokatsiya ko'rsatilmagan")}</p>
                    </div>
                    <span class="inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${statusClass}">
                        <span class="h-2 w-2 rounded-full ${online ? "bg-emerald-500" : "bg-rose-500"}"></span>
                        ${online ? "Online" : "Offline"}
                    </span>
                </div>

                <div class="mt-4 grid grid-cols-2 gap-2.5">
                    <div class="rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-gray-800/80">
                        <div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Device ID</div>
                        <div class="mt-1 truncate font-mono text-sm text-gray-800 dark:text-gray-100" title="${escapeHtml(camera.isup_device_id || "—")}">${escapeHtml(camera.isup_device_id || "—")}</div>
                    </div>
                    <div class="rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-gray-800/80">
                        <div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">MAC</div>
                        <div class="mt-1 truncate font-mono text-sm text-gray-800 dark:text-gray-100" title="${escapeHtml(camera.mac_address || "—")}">${escapeHtml(camera.mac_address || "—")}</div>
                    </div>
                    <div class="rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-gray-800/80">
                        <div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Model</div>
                        <div class="mt-1 truncate text-sm font-medium text-gray-800 dark:text-gray-100">${escapeHtml(camera.model || "Noma'lum")}</div>
                    </div>
                    <div class="rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-gray-800/80">
                        <div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Bugungi hodisa</div>
                        <div class="mt-1 text-sm font-semibold text-gray-900 dark:text-white">${Number(camera.events_today || 0)} ta</div>
                    </div>
                </div>

                <div class="mt-4 rounded-[20px] border border-gray-100 bg-gray-50/80 px-4 py-3.5 dark:border-gray-800 dark:bg-gray-950/50">
                    <div class="flex items-center justify-between gap-3 text-sm">
                        <span class="font-semibold text-gray-700 dark:text-gray-200">Yuz bazasi</span>
                        <span class="text-xs font-semibold text-gray-500 dark:text-gray-400">${Number(camera.used_faces || 0)}/${Number(camera.max_memory || 0)} · ${percent}%</span>
                    </div>
                    <div class="mt-3 h-2 rounded-full bg-white dark:bg-gray-800">
                        <div class="h-2 rounded-full ${progressClass}" style="width:${percent}%"></div>
                    </div>
                    <div class="mt-3 flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span>${tone === "rose" ? "Xotira yuqori band" : (tone === "amber" ? "Bandlik nazoratda" : "Bandlik me'yorida")}</span>
                        <span>${escapeHtml(formatDate(camera.last_seen_at))}</span>
                    </div>
                </div>

                <div class="mt-4 flex items-center justify-between gap-3">
                    <div class="flex flex-wrap items-center gap-2">
                        ${detailButton}
                        ${commandButton}
                        ${editButton}
                        ${deleteButton}
                    </div>
                    ${manageAllowed ? "" : `
                        <span class="inline-flex rounded-full bg-gray-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                            Read only
                        </span>
                    `}
                </div>
            </article>
        `;
    }

    function renderCards() {
        clampPage();
        const startIndex = (state.page - 1) * state.pageSize;
        const cards = sortCameras(state.filtered).slice(startIndex, state.page * state.pageSize);
        if (cards.length === 0) {
            renderEmptyCards();
            return;
        }
        $("cam-cards").innerHTML = cards.map((camera, index) => cameraCard(camera, startIndex + index + 1)).join("");
        attachDeleteHandlers();
        renderPagination();
    }

    function currentFilters() {
        return {
            search: String($("filter-search").value || "").trim().toLowerCase(),
            org: String($("filter-org").value || ""),
            status: String($("filter-status").value || ""),
        };
    }

    function applyFilters(resetPage) {
        const filters = currentFilters();
        if (resetPage !== false) state.page = 1;
        state.filtered = state.cameras.filter((camera) => {
            const searchHaystack = [
                camera.name,
                camera.location,
                camera.mac_address,
                camera.isup_device_id,
                camera.model,
                organizationNames[String(camera.organization_id)] || "",
            ].join(" ").toLowerCase();
            const searchMatch = !filters.search || searchHaystack.includes(filters.search);
            const orgMatch = !filters.org || String(camera.organization_id || "") === filters.org;
            const statusMatch = !filters.status
                || (filters.status === "online" && camera.is_online)
                || (filters.status === "offline" && !camera.is_online);
            return searchMatch && orgMatch && statusMatch;
        });
        renderStats(state.cameras, state.filtered);
        renderCountLine(state.cameras, state.filtered);
        renderCards();
    }

    async function deleteCamera(id, name) {
        if (!permissions.canManage) return;

        let confirmed = false;
        if (window.AppDialog && typeof window.AppDialog.confirm === "function") {
            confirmed = await window.AppDialog.confirm({
                title: "Kamerani o'chirish",
                message: `${name} kamerasini o'chirmoqchimisiz? Shu kameraga bog'liq yozuvlar ham ta'sirlanishi mumkin.`,
                tone: "danger",
                confirmText: "O'chirish",
                cancelText: "Bekor qilish",
            });
        } else {
            confirmed = window.confirm(`${name} kamerasini o'chirmoqchimisiz?`);
        }
        if (!confirmed) return;

        try {
            const response = await fetch(`/api/cameras/${Number(id)}`, { method: "DELETE" });
            let payload = {};
            try { payload = await response.json(); } catch (_) { payload = {}; }
            if (!response.ok) throw new Error(payload.detail || payload.message || "Kamerani o'chirib bo'lmadi");
            state.cameras = state.cameras.filter((camera) => camera.id !== Number(id));
            applyFilters(false);
            notify("success", `${name} kamerasi o'chirildi.`);
        } catch (error) {
            notify("error", error.message || "Kamerani o'chirishda xatolik yuz berdi.");
        }
    }

    async function loadCameras() {
        try {
            const response = await fetch("/api/cameras");
            let payload = [];
            try { payload = await response.json(); } catch (_) { payload = []; }
            if (!response.ok) throw new Error(payload.detail || payload.message || "Kameralarni yuklab bo'lmadi");
            state.cameras = Array.isArray(payload) ? payload : [];
            applyFilters();
        } catch (error) {
            $("cam-cards").innerHTML = `
                <div class="rounded-[24px] border border-rose-200 bg-rose-50 px-6 py-12 text-center text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-300 sm:col-span-2 xl:col-span-3 2xl:col-span-4">
                    Kameralarni yuklashda xatolik: ${escapeHtml(error.message || "noma'lum xato")}
                </div>
            `;
            $("cam-count").textContent = "Kameralar yuklanmadi";
            renderStats([], []);
            renderPagination();
            notify("error", error.message || "Kameralarni yuklashda xatolik yuz berdi.");
        }
    }

    function resetFilters() {
        $("filter-search").value = "";
        $("filter-org").value = "";
        $("filter-status").value = "";
        $("filter-page-size").value = "50";
        state.pageSize = 50;
        applyFilters();
    }

    function init() {
        $("filter-search").addEventListener("input", () => applyFilters());
        $("filter-search").addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                applyFilters();
            }
        });
        $("filter-org").addEventListener("change", () => applyFilters());
        $("filter-status").addEventListener("change", () => applyFilters());
        $("filter-page-size").addEventListener("change", (event) => {
            state.pageSize = Number(event.target.value || 50);
            applyFilters();
        });
        $("filters-apply").addEventListener("click", () => applyFilters());
        $("filters-reset").addEventListener("click", resetFilters);
        $("page-prev").addEventListener("click", () => {
            if (state.page > 1) {
                state.page -= 1;
                renderCards();
            }
        });
        $("page-next").addEventListener("click", () => {
            if (state.page < pageCount()) {
                state.page += 1;
                renderCards();
            }
        });
        state.pageSize = Number($("filter-page-size").value || 50);
        loadCameras();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
