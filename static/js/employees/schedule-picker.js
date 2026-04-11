(function () {
    function escHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function createSchedulePicker(options) {
        const config = options || {};
        const select = document.getElementById(config.selectId || 'scheduleId');
        const help = document.getElementById(config.helpId || 'scheduleHelp');
        const initialSelectedId = String(select?.dataset?.selectedScheduleId || '').trim();

        function setHelp(message, tone) {
            if (!help) return;
            help.textContent = message;
            help.className = tone === 'error'
                ? 'mt-1 text-xs text-red-600 dark:text-red-400'
                : 'mt-1 text-xs text-slate-500 dark:text-slate-400';
        }

        function setLoading(message) {
            if (select) {
                select.disabled = true;
                select.innerHTML = `<option value="">${escHtml(message)}</option>`;
            }
            setHelp(message);
        }

        function setEmpty(message) {
            if (select) {
                select.disabled = false;
                select.innerHTML = `<option value="">-- Smena tanlanmagan --</option>`;
                select.value = '';
            }
            setHelp(message);
        }

        async function loadSchedules(orgId) {
            const normalizedOrgId = Number(orgId || 0);
            if (!select) return [];
            if (!normalizedOrgId) {
                setEmpty("Avval tashkilotni tanlang.");
                return [];
            }

            setLoading("Smenalar yuklanmoqda...");
            try {
                const response = await fetch(`/api/organizations/${normalizedOrgId}/schedules`);
                const payload = await response.json().catch(() => ({}));
                if (!response.ok || payload.ok === false) {
                    throw new Error(payload.detail || "Smenalarni yuklab bo'lmadi");
                }
                const rows = Array.isArray(payload.items) ? payload.items : [];
                const optionsHtml = ['<option value="">-- Smena tanlanmagan --</option>'].concat(
                    rows.map((item) => {
                        const flexible = item.is_flexible ? ' • Erkin' : '';
                        return `<option value="${escHtml(item.id)}">${escHtml(item.name)} (${escHtml(item.start_time)} - ${escHtml(item.end_time)}${flexible})</option>`;
                    })
                );
                select.innerHTML = optionsHtml.join('');
                select.disabled = false;

                const selectedValue = String(config.selectedId ?? initialSelectedId ?? '').trim();
                if (selectedValue && rows.some((item) => String(item.id) === selectedValue)) {
                    select.value = selectedValue;
                } else {
                    select.value = '';
                }
                config.selectedId = select.value || '';
                setHelp(
                    rows.length
                        ? "Smena tanlang yoki bo'sh qoldiring."
                        : "Bu tashkilot uchun smena yaratilmagan. /shifts sahifasida qo'shing."
                );
                return rows;
            } catch (error) {
                select.disabled = false;
                select.innerHTML = '<option value="">-- Smena tanlanmagan --</option>';
                select.value = '';
                setHelp(error.message || "Smenalarni yuklab bo'lmadi", 'error');
                return [];
            }
        }

        select?.addEventListener('change', () => {
            config.selectedId = String(select.value || '').trim();
            if (config.selectedId) {
                setHelp("Smena biriktirildi. Istasangiz pastdagi vaqt bilan override qilishingiz mumkin.");
            } else {
                setHelp("Smena tanlanmagan. Tashkilot default yoki shaxsiy vaqt ishlatiladi.");
            }
        });

        return {
            loadSchedules,
            getValue() {
                return String(select?.value || '').trim();
            },
            setSelected(value) {
                config.selectedId = String(value || '').trim();
                if (select) {
                    select.value = config.selectedId;
                }
            },
        };
    }

    window.EmployeeSchedulePicker = {
        create: createSchedulePicker,
    };
})();
