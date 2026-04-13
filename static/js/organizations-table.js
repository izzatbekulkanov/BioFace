(function () {
    const state = {
        all: [],
        filtered: [],
        page: 1,
        pageSize: 25,
    };

    function $(id) {
        return document.getElementById(id);
    }

    function parseOrganizationsData() {
        const node = $("organizations-json");
        if (!node) return [];
        try {
            const parsed = JSON.parse(node.textContent || "[]");
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    function initialsFromName(value) {
        const safe = String(value || "").trim();
        if (!safe) return "?";
        return safe.split(/\s+/).slice(0, 2).map((item) => item[0]).join("").toUpperCase();
    }

    function notify(kind, message, options) {
        if (window.AppNotify && typeof window.AppNotify[kind] === "function") {
            window.AppNotify[kind](message, options || {});
            return;
        }
        if (kind === "error") {
            console.error(message);
        }
    }

    function statusMeta(statusRaw) {
        const safe = String(statusRaw || "").toLowerCase();
        if (safe.includes("active")) {
            return {
                key: "active",
                label: "Faol",
                className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
            };
        }
        if (safe.includes("expired")) {
            return {
                key: "expired",
                label: "Tugagan",
                className: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
            };
        }
        return {
            key: "pending",
            label: "Kutilmoqda",
            className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
        };
    }

    function workTime(org) {
        const start = org.default_start_time || "09:00";
        const end = org.default_end_time || "18:00";
        return `${start} - ${end}`;
    }

    function pageCount() {
        return Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
    }

    function clampPage() {
        state.page = Math.min(Math.max(1, state.page), pageCount());
    }

    function sortOrganizations(items) {
        return [...items].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "uz"));
    }

    function renderCountLine() {
        $("organizations-count").textContent = `${state.filtered.length} ta ko'rinmoqda / ${state.all.length} jami tashkilot`;
    }

    function renderTypeOptions() {
        const select = $("organizations-type");
        const current = String(select.value || "");
        const types = [...new Set(state.all.map((org) => String(org.organization_type_label || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "uz"));
        select.innerHTML = '<option value="">Barcha turlar</option>' + types.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join("");
        if (types.includes(current)) {
            select.value = current;
        }
    }

    function renderPagination() {
        const totalPages = pageCount();
        const total = state.filtered.length;
        const start = total === 0 ? 0 : ((state.page - 1) * state.pageSize) + 1;
        const end = Math.min(total, state.page * state.pageSize);
        $("organizations-prev-page").disabled = state.page <= 1;
        $("organizations-next-page").disabled = state.page >= totalPages;
        $("organizations-page-info").textContent = `${start}-${end} / ${total} ta natija`;

        const root = $("organizations-page-numbers");
        root.innerHTML = "";
        const pages = [];
        const from = Math.max(1, state.page - 2);
        const to = Math.min(totalPages, state.page + 2);
        for (let page = from; page <= to; page += 1) {
            pages.push(page);
        }
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
                root.appendChild(dots);
                return;
            }
            const button = document.createElement("button");
            button.type = "button";
            button.className = item === state.page
                ? "inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-2xl bg-slate-900 px-3 text-sm font-semibold text-white shadow-sm dark:bg-white dark:text-slate-900"
                : "inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-2xl border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700";
            button.textContent = String(item);
            button.addEventListener("click", () => {
                state.page = Number(item);
                renderTable();
            });
            root.appendChild(button);
        });
    }

    function rowMarkup(org, absoluteIndex) {
        const status = statusMeta(org.subscription_status);
        return `
            <tr class="align-top transition hover:bg-gray-50/80 dark:hover:bg-gray-800/40">
                <td class="px-4 py-3 text-center text-sm font-semibold text-gray-500 dark:text-gray-400">${absoluteIndex}</td>
                <td class="px-4 py-3">
                    <div class="flex min-w-[14rem] items-center gap-3">
                        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            ${escapeHtml(initialsFromName(org.name))}
                        </div>
                        <div class="min-w-0">
                            <div class="flex flex-wrap items-center gap-2">
                                <div class="truncate font-semibold text-gray-900 dark:text-white">${escapeHtml(org.name || "-")}</div>
                                <span class="inline-flex rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white dark:bg-white dark:text-slate-900">ID ${Number(org.id || 0)}</span>
                            </div>
                            <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">Ro'yxatdagi premium karta</div>
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3">
                    <span class="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">${escapeHtml(org.organization_type_label || "-")}</span>
                </td>
                <td class="px-4 py-3">
                    <span class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}">${status.label}</span>
                </td>
                <td class="px-4 py-3">
                    <span class="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">${escapeHtml(workTime(org))}</span>
                </td>
                <td class="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">${Number(org.employees_count || 0)}</td>
                <td class="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">${Number(org.devices_count || 0)}</td>
                <td class="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">${Number(org.users_count || 0)}</td>
                <td class="px-4 py-3">
                    <div class="flex justify-end gap-2">
                        <a href="/organization-info?id=${encodeURIComponent(org.id)}" class="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-300" title="Kirish">
                            <i class="fa-duotone fa-arrow-up-right-from-square"></i>
                        </a>
                        <a href="/organizations/${encodeURIComponent(org.id)}/edit" class="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-700 transition hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300" title="Tahrirlash">
                            <i class="fa-duotone fa-pen-to-square"></i>
                        </a>
                        <button type="button" data-delete-id="${Number(org.id)}" data-delete-name="${escapeHtml(org.name || "Tashkilot")}" class="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-300" title="O'chirish">
                            <i class="fa-duotone fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    function attachDeleteHandlers() {
        $("organizations-table-body").querySelectorAll("[data-delete-id]").forEach((button) => {
            button.addEventListener("click", () => deleteOrg(button.dataset.deleteId, button.dataset.deleteName));
        });
    }

    function renderTable() {
        clampPage();
        const startIndex = (state.page - 1) * state.pageSize;
        const rows = sortOrganizations(state.filtered).slice(startIndex, startIndex + state.pageSize);
        if (rows.length === 0) {
            $("organizations-table-body").innerHTML = `
                <tr>
                    <td colspan="9" class="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                        <div class="mx-auto max-w-sm space-y-2">
                            <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-gray-800">
                                <i class="fa-duotone fa-buildings text-lg"></i>
                            </div>
                            <div class="font-semibold text-gray-700 dark:text-gray-200">Qidiruvga mos tashkilot topilmadi.</div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">Filterlarni yengillashtiring yoki qidiruv matnini o'zgartiring.</div>
                        </div>
                    </td>
                </tr>
            `;
            renderPagination();
            return;
        }
        $("organizations-table-body").innerHTML = rows.map((org, index) => rowMarkup(org, startIndex + index + 1)).join("");
        attachDeleteHandlers();
        renderPagination();
    }

    function currentFilters() {
        return {
            search: String($("organizations-search").value || "").trim().toLowerCase(),
            status: String($("organizations-status").value || ""),
            type: String($("organizations-type").value || ""),
        };
    }

    function applyFilters(resetPage) {
        const filters = currentFilters();
        if (resetPage !== false) {
            state.page = 1;
        }
        state.filtered = state.all.filter((org) => {
            const typeLabel = String(org.organization_type_label || "");
            const status = statusMeta(org.subscription_status);
            const haystack = `${org.name || ""} ${typeLabel}`.toLowerCase();
            const searchMatch = !filters.search || haystack.includes(filters.search);
            const statusMatch = !filters.status || status.key === filters.status;
            const typeMatch = !filters.type || typeLabel === filters.type;
            return searchMatch && statusMatch && typeMatch;
        });
        renderCountLine();
        renderTable();
    }

    async function deleteOrg(id, name) {
        let confirmed = false;
        if (window.AppDialog && typeof window.AppDialog.confirm === "function") {
            confirmed = await window.AppDialog.confirm({
                title: "Tashkilotni o'chirish",
                message: `${name} tashkilotini o'chirmoqchimisiz?`,
                tone: "danger",
                confirmText: "O'chirish",
                cancelText: "Bekor qilish",
            });
        } else {
            confirmed = window.confirm(`${name} tashkilotini o'chirmoqchimisiz?`);
        }
        if (!confirmed) return;

        try {
            const res = await fetch(`/api/organizations/${Number(id)}`, { method: "DELETE" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.ok === false) {
                throw new Error(data.detail || data.message || "O'chirishda xatolik.");
            }
            state.all = state.all.filter((org) => Number(org.id) !== Number(id));
            renderTypeOptions();
            applyFilters(false);
            notify("success", "Tashkilot o'chirildi");
        } catch (error) {
            notify("error", error.message || "O'chirishda xatolik.");
        }
    }

    function resetFilters() {
        $("organizations-search").value = "";
        $("organizations-status").value = "";
        $("organizations-type").value = "";
        $("organizations-page-size").value = "25";
        state.pageSize = 25;
        applyFilters();
    }

    function init() {
        state.all = parseOrganizationsData();
        renderTypeOptions();
        $("organizations-search").addEventListener("input", () => applyFilters());
        $("organizations-search").addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                applyFilters();
            }
        });
        $("organizations-status").addEventListener("change", () => applyFilters());
        $("organizations-type").addEventListener("change", () => applyFilters());
        $("organizations-page-size").addEventListener("change", (event) => {
            state.pageSize = Number(event.target.value || 25);
            applyFilters();
        });
        $("organizations-apply").addEventListener("click", () => applyFilters());
        $("organizations-reset").addEventListener("click", resetFilters);
        $("organizations-prev-page").addEventListener("click", () => {
            if (state.page > 1) {
                state.page -= 1;
                renderTable();
            }
        });
        $("organizations-next-page").addEventListener("click", () => {
            if (state.page < pageCount()) {
                state.page += 1;
                renderTable();
            }
        });
        applyFilters();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
