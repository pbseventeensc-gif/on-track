/**
 * WTRACK - BATCH & BULK PRODUCTION SCHEDULER
 * Folder: /js/production/spk_scheduler.js
 * Memfasilitasi alokasi dan penjadwalan masal puluhan/ratusan SPK sekaligus
 * ke Mesin, Operator, Shift, dan Prioritas produksi.
 */

(function(root) {
    'use strict';

    let currentSource = 'preview'; // 'preview' | 'main'
    let currentSelectedTargetIds = [];

    /**
     * Menjadwalkan banyak SPK secara batch dalam 1 kali proses
     * @param {Array} spkList - Array data SPK
     * @param {Array<string>} targetIds - Kumpulan ID / indeks SPK yang akan dijadwalkan
     * @param {Object} options - Parameter jadwal (branch, machineName, operatorName, shift, priority, date, notes)
     */
    function scheduleBatchSPK(spkList, targetIds, options) {
        if (!Array.isArray(spkList) || !Array.isArray(targetIds) || targetIds.length === 0) {
            throw new Error("Pilih minimal 1 SPK untuk dijadwalkan");
        }
        if (!options || !options.branch || !options.machineName) {
            throw new Error("Cabang dan Mesin wajib ditentukan");
        }

        const idSet = new Set(targetIds.map(String));

        return spkList.map((item, idx) => {
            const sid = String(item.spkId || item.id || idx);
            if (!idSet.has(sid) && !idSet.has(String(idx))) {
                return item;
            }

            return {
                ...item,
                productionBranch: options.branch,
                branch: options.branch,
                originBranch: options.branch,
                machineName: options.machineName,
                machine: options.machineName,
                machineId: options.machineId || item.machineId || '',
                assignedOperatorId: options.operatorId || '',
                assignedOperator: options.operatorName || '-',
                productionShift: options.shift || 'Shift 1 (Pagi)',
                priority: options.priority || 'normal',
                scheduledDate: options.scheduledDate || new Date().toISOString().slice(0, 10),
                scheduleNotes: options.notes || '',
                productionStatus: (item.productionStatus === 'printing' || item.productionStatus === 'completed')
                    ? item.productionStatus
                    : 'scheduled',
                scheduledAt: new Date().toISOString()
            };
        });
    }

    /**
     * Menghitung total beban kerja mesin (jumlah order & kuantitas)
     */
    function calculateMachineWorkload(spkList, machineName) {
        if (!Array.isArray(spkList) || !machineName) {
            return { totalJobs: 0, totalQty: 0 };
        }

        const targetNorm = String(machineName).toLowerCase().trim();
        const activeJobs = spkList.filter(s => {
            const m = String(s.machineName || s.machine || '').toLowerCase().trim();
            const isMatch = m === targetNorm || m.includes(targetNorm) || targetNorm.includes(m);
            const isPending = s.productionStatus !== 'completed' && s.productionStatus !== 'delivered';
            return isMatch && isPending;
        });

        const totalJobs = activeJobs.length;
        const totalQty = activeJobs.reduce((sum, s) => {
            const raw = parseFloat(String(s.qty || '1').replace(/[^\d.]/g, '')) || 1;
            return sum + raw;
        }, 0);

        return { totalJobs, totalQty };
    }

    // Membuka modal penjadwalan masal
    function openBulkScheduleModal(source) {
        currentSource = source || 'preview';
        currentSelectedTargetIds = [];

        if (currentSource === 'preview') {
            const checked = root.document?.querySelectorAll('.spk-preview-row-checkbox:checked');
            if (!checked || checked.length === 0) {
                if (typeof root.alert === 'function') root.alert("Pilih minimal satu SPK di tabel preview untuk dijadwalkan!");
                return;
            }
            currentSelectedTargetIds = Array.from(checked).map(cb => cb.getAttribute('data-index'));
        } else {
            const checked = root.document?.querySelectorAll('.main-spk-row-checkbox:checked');
            if (!checked || checked.length === 0) {
                if (typeof root.alert === 'function') root.alert("Pilih minimal satu SPK di antrian untuk dijadwalkan!");
                return;
            }
            currentSelectedTargetIds = Array.from(checked).map(cb => cb.value);
        }

        const counterEl = root.document?.getElementById('bulk-schedule-count');
        if (counterEl) counterEl.textContent = `${currentSelectedTargetIds.length} SPK Terpilih`;

        const dateInput = root.document?.getElementById('sched-target-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().slice(0, 10);
        }

        // Default Branch DM 2
        const branchSelect = root.document?.getElementById('sched-branch');
        const defaultBranch = branchSelect?.value || 'DM 2';
        onScheduleBranchChange(defaultBranch);

        const modalEl = root.document?.getElementById('modal-spk-bulk-schedule');
        if (modalEl && typeof root.bootstrap !== 'undefined' && root.bootstrap.Modal) {
            root.bootstrap.Modal.getOrCreateInstance(modalEl).show();
        }
    }

    function onScheduleBranchChange(branch) {
        const machineSelect = root.document?.getElementById('sched-machine');
        if (!machineSelect) return;

        let machines = [];
        if (root.MachineMaster && typeof root.MachineMaster.read === 'function') {
            const all = root.MachineMaster.read();
            machines = all.filter(m => {
                const b = String(m.branch || '').toLowerCase();
                const target = String(branch).toLowerCase();
                return (b === target || b.replace(/\s+/g, '') === target.replace(/\s+/g, '')) && m.status !== 'maintenance';
            });
        }

        if (machines.length === 0) {
            machineSelect.innerHTML = `<option value="">Tidak ada mesin aktif di cabang ini</option>`;
            onScheduleMachineChange('');
            return;
        }

        machineSelect.innerHTML = machines.map(m => `<option value="${m.name}" data-id="${m.id}">${m.name} (${m.category || m.maxWidth || ''})</option>`).join('');

        onScheduleMachineChange(machines[0].name);
    }

    function onScheduleMachineChange(machineName) {
        const operatorSelect = root.document?.getElementById('sched-operator');
        if (!operatorSelect) return;

        const branch = root.document?.getElementById('sched-branch')?.value || 'DM 2';
        let operators = [];

        if (root.OperatorMaster && typeof root.OperatorMaster.getOperatorsForMachine === 'function') {
            operators = root.OperatorMaster.getOperatorsForMachine(machineName, branch);
        }

        if (operators.length === 0 && root.OperatorMaster && typeof root.OperatorMaster.getOperatorsForBranch === 'function') {
            // Fallback: semua operator di cabang tersebut
            operators = root.OperatorMaster.getOperatorsForBranch(branch);
        }

        if (operators.length === 0) {
            operatorSelect.innerHTML = `<option value="" data-id="">Operator Bebas (Auto-Assign)</option>`;
            return;
        }

        operatorSelect.innerHTML = `
            <option value="" data-id="">Operator Bebas (Auto-Assign)</option>
            ${operators.map(o => `<option value="${o.name}" data-id="${o.id}">${o.name} (${o.role} - ${o.shift})</option>`).join('')}
        `;
    }

    function applyBulkSchedule() {
        if (currentSelectedTargetIds.length === 0) return;

        const get = id => root.document?.getElementById(id)?.value || '';
        const branch = get('sched-branch') || 'DM 2';
        const machineSelect = root.document?.getElementById('sched-machine');
        const machineName = machineSelect?.value || '';
        const selectedMachineOpt = machineSelect?.selectedOptions ? machineSelect.selectedOptions[0] : null;
        const machineId = selectedMachineOpt ? selectedMachineOpt.getAttribute('data-id') : '';

        const operatorSelect = root.document?.getElementById('sched-operator');
        const operatorName = operatorSelect?.value || 'Operator Bebas';
        const selectedOperatorOpt = operatorSelect?.selectedOptions ? operatorSelect.selectedOptions[0] : null;
        const operatorId = selectedOperatorOpt ? selectedOperatorOpt.getAttribute('data-id') : '';

        const shift = get('sched-shift') || 'Shift 1 (Pagi)';
        const priority = get('sched-priority') || 'normal';
        const scheduledDate = get('sched-target-date') || new Date().toISOString().slice(0, 10);
        const notes = get('sched-notes') || '';

        if (!machineName) {
            if (typeof root.alert === 'function') root.alert("Pilih mesin produksi terlebih dahulu!");
            return;
        }

        const options = {
            branch,
            machineName,
            machineId,
            operatorName,
            operatorId,
            shift,
            priority,
            scheduledDate,
            notes
        };

        try {
            if (currentSource === 'preview') {
                if (root.spkManager && Array.isArray(root.spkManager.getPreviewList ? root.spkManager.getPreviewList() : null)) {
                    // updated via API
                } else if (root.currentSPKPreviewList) {
                    root.currentSPKPreviewList = scheduleBatchSPK(root.currentSPKPreviewList, currentSelectedTargetIds, options);
                } else if (root.spkManager && typeof root.spkManager.setSPKPreviewData === 'function') {
                    // Handle via preview table update
                }

                // Update visual preview table
                currentSelectedTargetIds.forEach(idxStr => {
                    const idx = parseInt(idxStr, 10);
                    const bSel = root.document?.querySelector(`.spk-preview-branch-select[data-index="${idx}"]`);
                    const mSel = root.document?.querySelector(`.spk-preview-machine-select[data-index="${idx}"]`);
                    if (bSel) bSel.value = branch;
                    if (mSel) {
                        mSel.innerHTML = `<option value="${machineName}" selected>${machineName}</option>`;
                    }
                });

                if (root.spkManager && typeof root.spkManager.renderSPKPreviewTable === 'function') {
                    root.spkManager.renderSPKPreviewTable();
                }
            } else {
                // Main SPK queue
                const stored = root.localStorage?.getItem('wtrack_spk_orders');
                let list = stored ? JSON.parse(stored) : [];
                list = scheduleBatchSPK(list, currentSelectedTargetIds, options);
                root.localStorage?.setItem('wtrack_spk_orders', JSON.stringify(list));

                if (root.spkManager && typeof root.spkManager.renderSPKView === 'function') {
                    root.spkManager.renderSPKView();
                }
            }

            const modalEl = root.document?.getElementById('modal-spk-bulk-schedule');
            if (modalEl && typeof root.bootstrap !== 'undefined' && root.bootstrap.Modal) {
                const inst = root.bootstrap.Modal.getInstance(modalEl);
                if (inst) inst.hide();
            }

            if (typeof root.showToast === 'function') {
                root.showToast(`⚡ Berhasil menjadwalkan ${currentSelectedTargetIds.length} SPK ke ${machineName} (${branch}).`, 'success');
            }
        } catch (err) {
            if (typeof root.alert === 'function') root.alert(err.message || "Gagal menjadwalkan SPK");
        }
    }

    const api = {
        scheduleBatchSPK,
        calculateMachineWorkload,
        openBulkScheduleModal,
        onScheduleBranchChange,
        onScheduleMachineChange,
        applyBulkSchedule
    };

    root.SPKScheduler = api;

})(typeof window !== 'undefined' ? window : globalThis);
