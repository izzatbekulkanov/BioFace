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
            <div class="camera-panel px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400 sm:col-span-2 xl:col-span-3 2xl:col-span-4">
                <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400">
                    <i class="fa-duotone fa-video-slash text-2xl"></i>
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
        const sharedClass = `camera-action-btn ${toneClasses[tone] || toneClasses.blue}`;
        if (href) {
            return `
                <a href="${href}" class="${sharedClass}" title="${title}" aria-label="${title}">
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
                aria-label="${title}"
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
        const statusClass = online ? "online" : "offline";
        const progressClass = tone === "rose"
            ? "linear-gradient(90deg, #f43f5e 0%, #fb7185 100%)"
            : (tone === "amber"
                ? "linear-gradient(90deg, #f59e0b 0%, #f97316 100%)"
                : "linear-gradient(90deg, #2563eb 0%, #06b6d4 100%)");
        const manageAllowed = Boolean(permissions.canManage);
        const detailButton = actionButton({
            href: `/camera-info?id=${camera.id}`,
            title: "Batafsil",
            tone: "blue",
            icon: `
                <i class="fa-duotone fa-circle-info"></i>
            `,
        });
        const commandButton = manageAllowed ? actionButton({
            href: `/commands?cam=${camera.id}`,
            title: "Buyruqlar",
            tone: "emerald",
            icon: `
                <i class="fa-duotone fa-terminal"></i>
            `,
        }) : "";
        const editButton = manageAllowed ? actionButton({
            href: `/devices/edit?id=${camera.id}`,
            title: "Tahrirlash",
            tone: "amber",
            icon: `
                <i class="fa-duotone fa-pen-to-square"></i>
            `,
        }) : "";
        const deleteButton = manageAllowed ? actionButton({
            title: "O'chirish",
            tone: "rose",
            dataDeleteId: camera.id,
            dataDeleteName: escapeHtml(camera.name || "Kamera"),
            icon: `
                <i class="fa-duotone fa-trash-can"></i>
            `,
        }) : "";

        return `
            <article class="camera-device-card ${online ? "is-online" : "is-offline"}">
                <div class="camera-device-topline ${statusClass}"></div>
                <div class="camera-device-head">
                    <div class="camera-device-head-left min-w-0">
                        <div class="camera-device-icon">
                            <i class="fa-duotone fa-camera-cctv"></i>
                        </div>
                        <div class="min-w-0">
                            <div class="flex flex-wrap items-center gap-2">
                                <span class="camera-soft-chip">#${absoluteIndex}</span>
                                <span class="camera-soft-chip">
                                    <i class="fa-duotone fa-building"></i>
                                    ${escapeHtml(orgName)}
                                </span>
                            </div>
                            <div class="camera-device-name truncate" title="${escapeHtml(camera.name || "-")}">${escapeHtml(camera.name || "-")}</div>
                            <div class="camera-device-location truncate">${escapeHtml(camera.location || "Lokatsiya ko'rsatilmagan")}</div>
                        </div>
                    </div>
                    <span class="camera-status-pill ${statusClass}">
                        <span class="h-2 w-2 rounded-full ${online ? "bg-emerald-500" : "bg-rose-500"}"></span>
                        ${online ? "Online" : "Offline"}
                    </span>
                </div>

                <div class="camera-device-grid">
                    <div class="camera-device-metric">
                        <div class="camera-device-metric-label">
                            <i class="fa-duotone fa-id-badge"></i>
                            Device ID
                        </div>
                        <div class="camera-device-metric-value truncate font-mono" title="${escapeHtml(camera.isup_device_id || "—")}">${escapeHtml(camera.isup_device_id || "—")}</div>
                    </div>
                    <div class="camera-device-metric">
                        <div class="camera-device-metric-label">
                            <i class="fa-duotone fa-network-wired"></i>
                            MAC
                        </div>
                        <div class="camera-device-metric-value truncate font-mono" title="${escapeHtml(camera.mac_address || "—")}">${escapeHtml(camera.mac_address || "—")}</div>
                    </div>
                    <div class="camera-device-metric">
                        <div class="camera-device-metric-label">
                            <i class="fa-duotone fa-microchip-ai"></i>
                            Model
                        </div>
                        <div class="camera-device-metric-value truncate">${escapeHtml(camera.model || "Noma'lum")}</div>
                    </div>
                    <div class="camera-device-metric">
                        <div class="camera-device-metric-label">
                            <i class="fa-duotone fa-calendar-lines-pen"></i>
                            Bugungi davomat
                        </div>
                        <div class="camera-device-metric-value" title="Raw event: ${Number(camera.today_raw_event_count || 0)}">${Number(camera.today_attendance_count || camera.events_today || 0)} ta</div>
                    </div>
                </div>

                <div class="camera-usage-card">
                    <div class="flex items-center justify-between gap-3 text-sm">
                        <span class="font-semibold text-gray-700 dark:text-gray-200">Yuz bazasi sig'imi</span>
                        <span class="text-xs font-semibold text-gray-500 dark:text-gray-400">${Number(camera.used_faces || 0)}/${Number(camera.max_memory || 0)} · ${percent}%</span>
                    </div>
                    <div class="camera-usage-bar mt-3">
                        <div class="camera-usage-fill" style="width:${percent}%; background:${progressClass};"></div>
                    </div>
                    <div class="mt-3 flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span>${tone === "rose" ? "Xotira yuqori band" : (tone === "amber" ? "Bandlik nazoratda" : "Bandlik me'yorida")}</span>
                        <span class="inline-flex items-center gap-1">
                            <i class="fa-duotone fa-clock-rotate-left"></i>
                            ${escapeHtml(formatDate(camera.last_seen_at))}
                        </span>
                    </div>
                </div>

                <div class="camera-action-row">
                    <div class="camera-action-row-left">
                        ${detailButton}
                        ${commandButton}
                        ${editButton}
                        ${deleteButton}
                    </div>
                    ${manageAllowed ? "" : `
                        <span class="camera-soft-chip">
                            <i class="fa-duotone fa-eye"></i>
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
                <div class="camera-panel px-6 py-12 text-center text-sm text-rose-700 dark:text-rose-300 sm:col-span-2 xl:col-span-3 2xl:col-span-4">
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
