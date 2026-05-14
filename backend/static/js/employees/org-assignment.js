(function () {
    function escHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function normalizeCatalogValue(value) {
        return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
    }

    function setCatalogActionEnabled(button, enabled) {
        if (!button) {
            return;
        }
        button.disabled = !enabled;
    }

    function createCatalogSelector(config) {
        const input = document.getElementById(config.inputId);
        const hidden = document.getElementById(config.hiddenId);
        const dropdown = document.getElementById(config.dropdownId);
        const help = document.getElementById(config.helpId);
        let options = [];
        let selectedId = Number(hidden?.value || 0) || null;
        let selectedName = String(input?.value || '').trim();

        function emitChange() {
            if (typeof config.onChange === 'function') {
                config.onChange({
                    id: selectedId,
                    name: selectedName,
                    options: options.slice(),
                });
            }
        }

        function hideDropdown() {
            dropdown?.classList.add('hidden');
        }

        function updateHelp(message, tone) {
            if (!help) {
                return;
            }
            help.textContent = message;
            help.className = tone === 'error'
                ? 'mt-1 text-xs text-red-600 dark:text-red-400'
                : 'mt-1 text-xs text-slate-500 dark:text-slate-400';
        }

        function getFilteredOptions() {
            const query = normalizeCatalogValue(input?.value);
            if (!query) {
                return options.slice(0, 80);
            }
            return options
                .filter((item) => normalizeCatalogValue(item.name).includes(query))
                .slice(0, 80);
        }

        function setSelected(item) {
            selectedId = item ? Number(item.id) : null;
            selectedName = item ? String(item.name || '').trim() : '';
            if (hidden) {
                hidden.value = selectedId ? String(selectedId) : '';
            }
            if (input) {
                input.value = selectedName;
            }
            updateHelp(
                item
                    ? `${config.selectedLabel}: ${selectedName}`
                    : (options.length ? config.idleMessage : config.emptyMessage)
            );
            hideDropdown();
            emitChange();
        }

        function renderDropdown() {
            if (!input || !dropdown || input.disabled) {
                hideDropdown();
                return;
            }
            const filtered = getFilteredOptions();
            if (!filtered.length) {
                dropdown.innerHTML = `<div class="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">${escHtml(config.noResultsMessage)}</div>`;
                dropdown.classList.remove('hidden');
                return;
            }
            dropdown.innerHTML = filtered.map((item) => {
                const active = Number(item.id) === selectedId;
                const activeClasses = 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
                const idleClasses = 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/60';
                return `
                    <button type="button" data-option-id="${item.id}" class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${active ? activeClasses : idleClasses}">
                        <span>${escHtml(item.name)}</span>
                        ${active ? '<span class="text-xs font-semibold">Tanlangan</span>' : ''}
                    </button>
                `;
            }).join('');
            dropdown.classList.remove('hidden');
            dropdown.querySelectorAll('[data-option-id]').forEach((button) => {
                button.addEventListener('click', () => {
                    const item = options.find((entry) => Number(entry.id) === Number(button.dataset.optionId));
                    if (item) {
                        setSelected(item);
                    }
                });
            });
        }

        function setOptions(nextOptions) {
            options = Array.isArray(nextOptions) ? nextOptions : [];
            if (selectedId) {
                const matchedById = options.find((item) => Number(item.id) === selectedId);
                if (matchedById) {
                    setSelected(matchedById);
                    return;
                }
            }
            if (selectedName) {
                const matchedByName = options.find(
                    (item) => normalizeCatalogValue(item.name) === normalizeCatalogValue(selectedName)
                );
                if (matchedByName) {
                    setSelected(matchedByName);
                    return;
                }
            }
            setSelected(null);
        }

        function setLoading(message) {
            if (input) {
                input.disabled = true;
            }
            hideDropdown();
            updateHelp(message);
        }

        function setDisabled(message) {
            if (input) {
                input.disabled = true;
                input.value = '';
            }
            selectedId = null;
            selectedName = '';
            if (hidden) {
                hidden.value = '';
            }
            hideDropdown();
            updateHelp(message);
            emitChange();
        }

        function setReady() {
            if (input) {
                input.disabled = false;
            }
            updateHelp(
                selectedId && selectedName
                    ? `${config.selectedLabel}: ${selectedName}`
                    : (options.length ? config.idleMessage : config.emptyMessage)
            );
        }

        function ensureResolved() {
            const typedValue = String(input?.value || '').trim();
            if (!typedValue) {
                setSelected(null);
                return { ok: true, id: null, name: '' };
            }
            if (selectedId && normalizeCatalogValue(selectedName) === normalizeCatalogValue(typedValue)) {
                return { ok: true, id: selectedId, name: selectedName };
            }
            const matched = options.find(
                (item) => normalizeCatalogValue(item.name) === normalizeCatalogValue(typedValue)
            );
            if (matched) {
                setSelected(matched);
                return { ok: true, id: Number(matched.id), name: String(matched.name || '') };
            }
            return { ok: false, message: config.unresolvedMessage };
        }

        function getSelection() {
            return { id: selectedId, name: selectedName };
        }

        input?.addEventListener('focus', renderDropdown);
        input?.addEventListener('click', renderDropdown);
        input?.addEventListener('input', () => {
            if (selectedId && normalizeCatalogValue(input.value) !== normalizeCatalogValue(selectedName)) {
                selectedId = null;
                selectedName = '';
                if (hidden) {
                    hidden.value = '';
                }
                emitChange();
            }
            updateHelp(
                input.value.trim()
                    ? config.typingMessage
                    : (options.length ? config.idleMessage : config.emptyMessage)
            );
            renderDropdown();
        });
        input?.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                hideDropdown();
                return;
            }
            if (event.key === 'Enter') {
                const filtered = getFilteredOptions();
                if (filtered.length === 1) {
                    event.preventDefault();
                    setSelected(filtered[0]);
                }
            }
        });

        return {
            hideDropdown,
            setOptions,
            setLoading,
            setDisabled,
            setReady,
            ensureResolved,
            getSelection,
            setSelected,
        };
    }

    function createOrgAssignment(options) {
        const config = options || {};
        const organizationSelect = document.getElementById(config.organizationSelectId || 'inpOrg');
        const departmentButton = document.getElementById(config.departmentButtonId || 'addDepartmentBtn');
        const positionButton = document.getElementById(config.positionButtonId || 'addPositionBtn');
        let catalogState = { organizationId: null, departments: [], positions: [] };
        let catalogModalState = null;

        function setFormError(message) {
            if (typeof config.setFormError === 'function') {
                config.setFormError(message);
            }
        }

        function getSelectedOrganizationId() {
            const parsed = Number(organizationSelect?.value || 0);
            return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
        }

        function getSelectedOrganizationName() {
            return organizationSelect?.options?.[organizationSelect.selectedIndex]?.text?.trim() || '';
        }

        function getDepartmentScopedPositions() {
            const departmentSelection = departmentSelector.getSelection();
            if (!departmentSelection.id) {
                return [];
            }
            return (catalogState.positions || []).filter(
                (item) => Number(item.department_id || 0) === Number(departmentSelection.id)
            );
        }

        function syncPositionSelectorForDepartment() {
            if (!catalogState.organizationId) {
                positionSelector.setDisabled("Avval tashkilotni tanlang.");
                setCatalogActionEnabled(positionButton, false);
                return;
            }

            const departmentSelection = departmentSelector.getSelection();
            if (!departmentSelection.id) {
                positionSelector.setDisabled("Avval bo'limni tanlang.");
                setCatalogActionEnabled(positionButton, false);
                return;
            }

            positionSelector.setOptions(getDepartmentScopedPositions());
            positionSelector.setReady();
            setCatalogActionEnabled(positionButton, true);
        }

        const departmentSelector = createCatalogSelector({
            inputId: config.departmentInputId || 'departmentSearch',
            hiddenId: config.departmentHiddenId || 'departmentId',
            dropdownId: config.departmentDropdownId || 'departmentDropdown',
            helpId: config.departmentHelpId || 'departmentHelp',
            selectedLabel: "Tanlangan bo'lim",
            idleMessage: "Bo'limni qidiring yoki + orqali yangisini qo'shing.",
            emptyMessage: "Bu tashkilotda bo'lim topilmadi. + orqali qo'shing.",
            noResultsMessage: "Mos bo'lim topilmadi. + orqali yangi bo'lim yarating.",
            unresolvedMessage: "Bo'limni ro'yxatdan tanlang yoki + orqali yarating.",
            typingMessage: "Mos bo'limni tanlang yoki + orqali yarating.",
            onChange: () => {
                syncPositionSelectorForDepartment();
                if (typeof config.onDepartmentChange === 'function') {
                    config.onDepartmentChange(departmentSelector.getSelection());
                }
            },
        });

        const positionSelector = createCatalogSelector({
            inputId: config.positionInputId || 'positionSearch',
            hiddenId: config.positionHiddenId || 'positionId',
            dropdownId: config.positionDropdownId || 'positionDropdown',
            helpId: config.positionHelpId || 'positionHelp',
            selectedLabel: "Tanlangan lavozim",
            idleMessage: "Lavozimni qidiring yoki + orqali yangisini qo'shing.",
            emptyMessage: "Bu bo'limda lavozim topilmadi. + orqali qo'shing.",
            noResultsMessage: "Mos lavozim topilmadi. + orqali yangi lavozim yarating.",
            unresolvedMessage: "Lavozimni ro'yxatdan tanlang yoki + orqali yarating.",
            typingMessage: "Mos lavozimni tanlang yoki + orqali yarating.",
        });

        async function loadCatalogs(orgId) {
            if (!orgId) {
                catalogState = { organizationId: null, departments: [], positions: [] };
                departmentSelector.setDisabled("Avval tashkilotni tanlang.");
                positionSelector.setDisabled("Avval bo'limni tanlang.");
                setCatalogActionEnabled(departmentButton, false);
                setCatalogActionEnabled(positionButton, false);
                return;
            }

            departmentSelector.setLoading("Bo'limlar yuklanmoqda...");
            positionSelector.setDisabled("Avval bo'limni tanlang.");
            setCatalogActionEnabled(departmentButton, true);
            setCatalogActionEnabled(positionButton, false);

            try {
                const response = await fetch(`/api/organizations/${orgId}/employee-catalogs`);
                const payload = await response.json();
                if (!response.ok || payload.ok === false) {
                    throw new Error(payload.detail || "Kataloglarni yuklab bo'lmadi");
                }
                catalogState = {
                    organizationId: orgId,
                    departments: Array.isArray(payload.departments) ? payload.departments : [],
                    positions: Array.isArray(payload.positions) ? payload.positions : [],
                };
                departmentSelector.setOptions(catalogState.departments);
                departmentSelector.setReady();
                syncPositionSelectorForDepartment();
            } catch (error) {
                catalogState = { organizationId: orgId, departments: [], positions: [] };
                departmentSelector.setDisabled(error.message || "Bo'limlarni yuklab bo'lmadi.");
                positionSelector.setDisabled("Bo'limlar yuklanmaguncha lavozim tanlanmaydi.");
                setCatalogActionEnabled(departmentButton, false);
                setCatalogActionEnabled(positionButton, false);
            }
        }

        function buildCatalogModalBody(type) {
            const wrapper = document.createElement('div');
            wrapper.className = 'space-y-4';

            const info = document.createElement('div');
            info.className = 'rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300';
            const departmentSelection = departmentSelector.getSelection();
            info.innerHTML = type === 'department'
                ? `<div><span class="font-semibold text-slate-900 dark:text-slate-100">Tashkilot:</span> ${escHtml(getSelectedOrganizationName())}</div>`
                : `<div><span class="font-semibold text-slate-900 dark:text-slate-100">Tashkilot:</span> ${escHtml(getSelectedOrganizationName())}</div><div class="mt-1"><span class="font-semibold text-slate-900 dark:text-slate-100">Bo'lim:</span> ${escHtml(departmentSelection.name || '-')}</div>`;

            const fieldWrap = document.createElement('div');
            const label = document.createElement('label');
            label.className = 'mb-2 block text-sm font-medium text-slate-900 dark:text-slate-100';
            label.textContent = type === 'department' ? "Bo'lim nomi" : "Lavozim nomi";

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white';
            input.placeholder = type === 'department'
                ? "Masalan: Axborot texnologiyalari"
                : "Masalan: Dasturchi";

            const error = document.createElement('div');
            error.className = 'hidden mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300';

            fieldWrap.appendChild(label);
            fieldWrap.appendChild(input);
            fieldWrap.appendChild(error);

            const actions = document.createElement('div');
            actions.className = 'flex items-center justify-end gap-3';

            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';
            cancelBtn.textContent = 'Bekor qilish';
            cancelBtn.addEventListener('click', () => {
                window.AppModal?.close('catalog_cancel');
            });

            const saveBtn = document.createElement('button');
            saveBtn.type = 'button';
            saveBtn.className = 'inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800';

            const spinner = document.createElement('span');
            spinner.className = 'hidden h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white';

            const saveText = document.createElement('span');
            saveText.textContent = 'Saqlash';
            saveBtn.appendChild(spinner);
            saveBtn.appendChild(saveText);
            saveBtn.addEventListener('click', () => {
                void saveCatalogModalItem();
            });

            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    void saveCatalogModalItem();
                }
            });

            actions.appendChild(cancelBtn);
            actions.appendChild(saveBtn);
            wrapper.appendChild(info);
            wrapper.appendChild(fieldWrap);
            wrapper.appendChild(actions);

            return { wrapper, input, error, saveBtn, spinner };
        }

        function openCatalogModal(type) {
            const orgId = getSelectedOrganizationId();
            if (!orgId) {
                setFormError(
                    type === 'department'
                        ? "Bo'lim qo'shishdan oldin tashkilotni tanlang."
                        : "Lavozim qo'shishdan oldin tashkilotni tanlang."
                );
                return;
            }
            if (type === 'position' && !departmentSelector.getSelection().id) {
                setFormError("Lavozim qo'shishdan oldin bo'limni tanlang.");
                return;
            }
            setFormError('');
            const modalBody = buildCatalogModalBody(type);
            catalogModalState = {
                type,
                ...modalBody,
            };
            window.AppModal?.open({
                title: type === 'department' ? "Yangi bo'lim qo'shish" : "Yangi lavozim qo'shish",
                size: 'md',
                bodyNode: modalBody.wrapper,
                onClose: () => {
                    catalogModalState = null;
                },
            });
            window.setTimeout(() => modalBody.input.focus(), 0);
        }

        async function saveCatalogModalItem() {
            const modal = catalogModalState;
            const orgId = getSelectedOrganizationId();
            if (!modal || !modal.type || !orgId) {
                window.AppModal?.close('catalog_missing');
                return;
            }
            const name = String(modal.input.value || '').trim().replace(/\s+/g, ' ');
            if (!name) {
                modal.error.textContent = modal.type === 'department'
                    ? "Bo'lim nomini kiriting."
                    : "Lavozim nomini kiriting.";
                modal.error.classList.remove('hidden');
                return;
            }

            modal.error.classList.add('hidden');
            modal.spinner.classList.remove('hidden');
            modal.saveBtn.disabled = true;

            try {
                const endpoint = modal.type === 'department' ? 'departments' : 'positions';
                const payload = { name };
                if (modal.type === 'position') {
                    payload.department_id = Number(departmentSelector.getSelection().id || 0);
                }
                const response = await fetch(`/api/organizations/${orgId}/${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                const data = await response.json();
                if (!response.ok || data.ok === false || !data.item) {
                    throw new Error(data.detail || 'Saqlashda xatolik');
                }
                if (modal.type === 'department') {
                    catalogState.departments = [
                        ...catalogState.departments.filter((item) => Number(item.id) !== Number(data.item.id)),
                        data.item,
                    ].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'uz'));
                    departmentSelector.setOptions(catalogState.departments);
                    departmentSelector.setSelected(data.item);
                } else {
                    catalogState.positions = [
                        ...catalogState.positions.filter((item) => Number(item.id) !== Number(data.item.id)),
                        data.item,
                    ].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'uz'));
                    syncPositionSelectorForDepartment();
                    positionSelector.setSelected(data.item);
                }
                window.AppModal?.close('catalog_saved');
            } catch (error) {
                modal.error.textContent = error.message || 'Saqlashda xatolik';
                modal.error.classList.remove('hidden');
                modal.spinner.classList.add('hidden');
                modal.saveBtn.disabled = false;
            }
        }

        function handleOutsideClick(event) {
            if (!event.target.closest('#departmentSearch') && !event.target.closest('#departmentDropdown')) {
                departmentSelector.hideDropdown();
            }
            if (!event.target.closest('#positionSearch') && !event.target.closest('#positionDropdown')) {
                positionSelector.hideDropdown();
            }
        }

        departmentButton?.addEventListener('click', () => openCatalogModal('department'));
        positionButton?.addEventListener('click', () => openCatalogModal('position'));
        document.addEventListener('click', handleOutsideClick);

        departmentSelector.setDisabled("Avval tashkilotni tanlang.");
        positionSelector.setDisabled("Avval bo'limni tanlang.");
        setCatalogActionEnabled(departmentButton, Boolean(getSelectedOrganizationId()));
        setCatalogActionEnabled(positionButton, false);

        return {
            departmentSelector,
            positionSelector,
            getSelectedOrganizationId,
            getSelectedOrganizationName,
            loadCatalogs,
            openCatalogModal,
            syncPositionSelectorForDepartment,
            destroy() {
                document.removeEventListener('click', handleOutsideClick);
            },
        };
    }

    window.EmployeeOrgAssignment = {
        create: createOrgAssignment,
    };
})();
