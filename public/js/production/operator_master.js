/**
 * WTRACK - MASTER DATA OPERATOR MESIN PRODUKSI
 * Folder: /js/production/operator_master.js
 * Mengelola database operator mesin, shift, cabang, dan sertifikasi/penugasan mesin.
 */

(function(root) {
    'use strict';

    const STORAGE_KEY = 'wtrack_operators_v1';
    let branchFilter = 'all';
    let searchQuery = '';

    const DEFAULT_OPERATORS = [
        {
            id: 'OPR-DM1-01',
            name: 'Budi Santoso',
            branch: 'DM 1',
            role: 'Operator Flatbed & UV',
            machines: ['SQ IMPALA 5', 'DOCAN', 'YH 13'],
            shift: 'Shift 1 (Pagi)',
            phone: '0812-8899-001',
            status: 'active'
        },
        {
            id: 'OPR-DM1-02',
            name: 'Hendra Gunawan',
            branch: 'DM 1',
            role: 'Operator Laser & Cutting',
            machines: ['LASER', 'SUMMA'],
            shift: 'Shift 1 (Pagi)',
            phone: '0812-8899-002',
            status: 'active'
        },
        {
            id: 'OPR-DM2-01',
            name: 'Rian Hidayat',
            branch: 'DM 2',
            role: 'Operator Indoor Printing',
            machines: ['EPSON S80 - Unit 1', 'EPSON S80 - Unit 2', 'EPSON S60X2 - Unit 1', 'EPSON S60X2 - Unit 2'],
            shift: 'Shift 1 (Pagi)',
            phone: '0813-1122-003',
            status: 'active'
        },
        {
            id: 'OPR-DM2-02',
            name: 'Agus Prasetyo',
            branch: 'DM 2',
            role: 'Operator Outdoor Solvent',
            machines: ['Mesin 512i lebar 3.2 - Unit 1', 'Mesin 512i lebar 3.2 - Unit 2', 'Mesin 1024 i lebar 3.2 - Unit 1'],
            shift: 'Shift 1 (Pagi)',
            phone: '0813-1122-004',
            status: 'active'
        },
        {
            id: 'OPR-DM2-03',
            name: 'Dani Saputra',
            branch: 'DM 2',
            role: 'Operator Finishing & Die-Cut',
            machines: ['JWEI 3.2', 'JWEI 1.6 - Unit 1', 'LATEX'],
            shift: 'Shift 2 (Siang)',
            phone: '0813-1122-005',
            status: 'active'
        },
        {
            id: 'OPR-DM2-04',
            name: 'Eko Wahyudi',
            branch: 'DM 2',
            role: 'Operator UV & Roll-to-Roll',
            machines: ['UV PULMEN', 'EPSON S80 - Unit 3'],
            shift: 'Shift 2 (Siang)',
            phone: '0813-1122-006',
            status: 'active'
        },
        {
            id: 'OPR-DM3-01',
            name: 'Joko Susilo',
            branch: 'DM 3',
            role: 'Operator Superwide 5M',
            machines: ['EFI MATAN 5M - Unit 1', 'EFI MATAN 5M - Unit 2', 'Seaming'],
            shift: 'Shift 1 (Pagi)',
            phone: '0815-5544-007',
            status: 'active'
        },
        {
            id: 'OPR-DM3-02',
            name: 'Arif Wicaksono',
            branch: 'DM 3',
            role: 'Operator Proofing & Seaming',
            machines: ['Roland ECO (Proof)', 'Seaming'],
            shift: 'Shift 1 (Pagi)',
            phone: '0815-5544-008',
            status: 'active'
        },
        {
            id: 'OPR-CIK-01',
            name: 'Fajar Ramadhan',
            branch: 'Cikokol',
            role: 'Operator Digital Press A3+',
            machines: ['HP Indigo A3'],
            shift: 'Shift 1 (Pagi)',
            phone: '0817-7788-009',
            status: 'active'
        }
    ];

    function read() {
        try {
            const raw = root.localStorage?.getItem(STORAGE_KEY);
            if (raw !== null && raw !== undefined) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch (e) {
            console.warn('[OperatorMaster] Gagal membaca storage lokal:', e);
        }
        write(DEFAULT_OPERATORS);
        return DEFAULT_OPERATORS;
    }

    function write(list) {
        try {
            if (root.localStorage) {
                root.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
            }
        } catch (e) {
            console.warn('[OperatorMaster] Gagal menyimpan storage lokal:', e);
        }
    }

    function filterBranch(branch) {
        branchFilter = branch || 'all';
        render();
    }

    function search(query) {
        searchQuery = (query || '').toLowerCase().trim();
        render();
        const input = root.document?.getElementById('operator-search');
        if (input) {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        }
    }

    function normalizeBranch(b) {
        if (!b) return 'DM 2';
        const s = String(b).trim().toLowerCase();
        if (s === 'dm 1' || s === 'dm1') return 'DM 1';
        if (s === 'dm 2' || s === 'dm2' || s === 'pusat') return 'DM 2';
        if (s === 'dm 3' || s === 'dm3') return 'DM 3';
        if (s === 'cikokol') return 'Cikokol';
        return 'DM 2';
    }

    function getOperatorsForMachine(machineName, branch) {
        const all = read();
        const targetBranch = branch ? normalizeBranch(branch) : null;
        return all.filter(op => {
            if (op.status !== 'active') return false;
            if (targetBranch && normalizeBranch(op.branch) !== targetBranch) return false;
            if (!machineName) return true;
            return Array.isArray(op.machines) && op.machines.some(m => {
                const mNorm = String(m).toLowerCase();
                const targetNorm = String(machineName).toLowerCase();
                return mNorm === targetNorm || mNorm.includes(targetNorm) || targetNorm.includes(mNorm);
            });
        });
    }

    function getOperatorsForBranch(branch) {
        const all = read();
        const targetBranch = normalizeBranch(branch);
        return all.filter(op => normalizeBranch(op.branch) === targetBranch && op.status === 'active');
    }

    function getBranchCodes() {
        let branchCodes = ['DM 1', 'DM 2', 'DM 3', 'Cikokol'];
        if (root.BranchMaster && typeof root.BranchMaster.getAllCodes === 'function') {
            const dynamicCodes = root.BranchMaster.getAllCodes();
            if (Array.isArray(dynamicCodes) && dynamicCodes.length > 0) branchCodes = dynamicCodes;
        }
        return branchCodes;
    }

    function add() {
        const branchSelect = root.document?.getElementById('opr-branch');
        if (branchSelect) {
            const codes = getBranchCodes();
            branchSelect.innerHTML = codes.map(b => `<option value="${b}">${b}</option>`).join('');
        }

        const set = (key, val) => { const el = root.document?.getElementById(key); if (el) el.value = val; };
        const defaultBranch = branchFilter !== 'all' ? branchFilter : 'DM 1';
        const defaultRole = 'Operator Indoor Printing';

        set('opr-edit-id', '');
        set('opr-code', `OPR-AUTO-${Math.floor(100 + Math.random() * 900)}`);
        set('opr-name', '');
        set('opr-branch', defaultBranch);
        set('opr-role', defaultRole);
        set('opr-shift', 'Shift 1 (Pagi)');
        set('opr-phone', '');
        set('opr-status', 'active');
        set('opr-notes', '');

        renderMachineCheckboxes([], defaultBranch, defaultRole);

        const title = root.document?.getElementById('opr-form-title');
        if (title) title.textContent = 'Tambah Operator Baru';

        const dialog = root.document?.getElementById('operator-editor');
        if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
        const nameInput = root.document?.getElementById('opr-name');
        if (nameInput) nameInput.focus();
    }

    function edit(id) {
        const row = read().find(m => m.id === id);
        if (!row) return;

        const branchSelect = root.document?.getElementById('opr-branch');
        if (branchSelect) {
            const codes = getBranchCodes();
            branchSelect.innerHTML = codes.map(b => `<option value="${b}">${b}</option>`).join('');
        }

        const set = (key, val) => { const el = root.document?.getElementById(key); if (el) el.value = val; };
        set('opr-edit-id', row.id);
        set('opr-code', row.id);
        set('opr-name', row.name);
        set('opr-branch', row.branch);
        set('opr-role', row.role);
        set('opr-shift', row.shift);
        set('opr-phone', row.phone || '');
        set('opr-status', row.status);
        set('opr-notes', row.notes || '');

        renderMachineCheckboxes(row.machines || [], row.branch, row.role);

        const title = root.document?.getElementById('opr-form-title');
        if (title) title.textContent = `Edit Operator: ${row.name}`;

        const dialog = root.document?.getElementById('operator-editor');
        if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
    }

    function matchMachineToRole(machine, role) {
        if (!role) return true;
        const r = String(role).toLowerCase().trim();
        const cat = String(machine.category || '').toLowerCase().trim();
        const name = String(machine.name || '').toLowerCase().trim();

        // Peran general / all-round
        if (r === 'leader shift' || r.includes('semua') || r === 'all' || r === 'operator cetak') {
            return true;
        }

        // 1. Operator Indoor: HANYA mesin indoor, mesin outdoor DILARANG tampil
        if (r.includes('indoor')) {
            if (cat.includes('outdoor') || name.includes('512') || name.includes('1024') || name.includes('matan')) return false;
            return cat.includes('indoor') || name.includes('epson') || name.includes('latex') || name.includes('pulmen') || name.includes('jwei');
        }

        // 2. Operator Outdoor: HANYA mesin outdoor, mesin indoor DILARANG tampil
        if (r.includes('outdoor')) {
            if (cat.includes('indoor') || name.includes('epson') || name.includes('latex')) return false;
            return cat.includes('outdoor') || name.includes('512') || name.includes('1024') || name.includes('konica') || name.includes('seiko') || name.includes('matan');
        }

        // 3. Superwide 5M
        if (r.includes('superwide') || r.includes('5m')) {
            if (cat.includes('indoor')) return false;
            return name.includes('5m') || name.includes('matan') || name.includes('seaming');
        }

        // 4. Flatbed & UV
        if (r.includes('flatbed') || r.includes('uv')) {
            return cat.includes('flatbed') || cat.includes('uv') || name.includes('impala') || name.includes('docan') || name.includes('yh') || name.includes('pulmen');
        }

        // 5. Laser & Cutting
        if (r.includes('laser') || r.includes('cutting')) {
            return cat.includes('cutting') || cat.includes('laser') || cat.includes('cnc') || name.includes('laser') || name.includes('summa') || name.includes('jwei');
        }

        // 6. Finishing & Die-Cut
        if (r.includes('finishing') || r.includes('die-cut') || r.includes('seaming')) {
            return cat.includes('finishing') || name.includes('jwei') || name.includes('seaming') || cat.includes('cutting');
        }

        // 7. Digital Press A3+
        if (r.includes('digital press') || r.includes('a3') || r.includes('offset') || r.includes('indigo')) {
            return cat.includes('digital offset') || cat.includes('a3') || name.includes('indigo');
        }

        return true;
    }

    function onRoleOrBranchChange() {
        const checkedBoxes = root.document?.querySelectorAll('.operator-machine-check:checked');
        const checked = checkedBoxes ? Array.from(checkedBoxes).map(cb => cb.value) : [];

        const branch = root.document?.getElementById('opr-branch')?.value;
        const role = root.document?.getElementById('opr-role')?.value;

        renderMachineCheckboxes(checked, branch, role);
    }

    function renderMachineCheckboxes(assignedMachines, currentBranch, currentRole) {
        const container = root.document?.getElementById('opr-machines-container');
        if (!container) return;

        const branch = currentBranch || root.document?.getElementById('opr-branch')?.value || 'DM 1';
        const role = currentRole !== undefined ? currentRole : (root.document?.getElementById('opr-role')?.value || '');
        let availableMachines = [];

        if (root.MachineMaster && typeof root.MachineMaster.read === 'function') {
            const allMachines = root.MachineMaster.read();
            availableMachines = allMachines.filter(m => normalizeBranch(m.branch) === normalizeBranch(branch) && m.status !== 'maintenance');
            if (role) {
                availableMachines = availableMachines.filter(m => matchMachineToRole(m, role));
            }
        }

        // Update badge filter info
        const infoBadge = root.document?.getElementById('opr-machine-filter-info');
        if (infoBadge) {
            let label = 'Semua Mesin';
            const r = String(role || '').toLowerCase();
            if (r.includes('indoor')) label = 'Khusus Mesin Indoor';
            else if (r.includes('outdoor')) label = 'Khusus Mesin Outdoor';
            else if (r.includes('flatbed') || r.includes('uv')) label = 'Khusus Flatbed & UV';
            else if (r.includes('superwide') || r.includes('5m')) label = 'Khusus Superwide 5M';
            else if (r.includes('laser') || r.includes('cutting')) label = 'Khusus Laser & Cutting';
            else if (r.includes('digital press') || r.includes('a3')) label = 'Khusus Digital Press A3+';
            else if (r.includes('finishing')) label = 'Khusus Finishing';
            infoBadge.textContent = label;
        }

        if (availableMachines.length === 0) {
            container.innerHTML = `<span class="text-muted extra-small py-2"><i class="bi bi-info-circle me-1"></i>Tidak ada mesin dengan kategori "${role}" di cabang ${branch}.</span>`;
            return;
        }

        container.innerHTML = availableMachines.map(m => {
            const isChecked = Array.isArray(assignedMachines) && assignedMachines.some(am => am === m.name || am.includes(m.name) || m.name.includes(am));
            const catBadge = m.category ? `<span class="badge bg-light text-muted border ms-1" style="font-size:9.5px;">${m.category}</span>` : '';
            return `
                <div class="form-check form-check-inline me-3 mb-1.5 py-0.5">
                    <input class="form-check-input operator-machine-check" type="checkbox" id="chk-m-${m.id}" value="${m.name}" ${isChecked ? 'checked' : ''}>
                    <label class="form-check-label extra-small text-dark fw-medium" for="chk-m-${m.id}" style="cursor:pointer;">
                        ${m.name} ${catBadge}
                    </label>
                </div>
            `;
        }).join('');
    }

    function save(e) {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();

        const get = (key) => root.document?.getElementById(key)?.value || '';
        const id = get('opr-edit-id').trim();
        const code = get('opr-code').trim() || `OPR-${Date.now()}`;
        const name = get('opr-name').trim();
        const branch = get('opr-branch').trim();
        const role = get('opr-role').trim();
        const shift = get('opr-shift').trim();
        const phone = get('opr-phone').trim();
        const status = get('opr-status').trim() || 'active';
        const notes = get('opr-notes').trim();

        if (!name) {
            if (typeof root.alert === 'function') root.alert('Nama Operator wajib diisi.');
            return;
        }

        const checkedBoxes = root.document?.querySelectorAll('.operator-machine-check:checked');
        const machines = checkedBoxes ? Array.from(checkedBoxes).map(cb => cb.value) : [];

        const list = read();
        if (id) {
            const idx = list.findIndex(m => m.id === id);
            if (idx >= 0) {
                list[idx] = { ...list[idx], name, branch, role, shift, machines, phone, status, notes };
            }
        } else {
            list.unshift({
                id: code,
                name,
                branch,
                role,
                shift,
                machines,
                phone,
                status,
                notes
            });
        }

        write(list);
        const dialog = root.document?.getElementById('operator-editor');
        if (dialog && typeof dialog.close === 'function') dialog.close();

        render();
        if (typeof root.showToast === 'function') {
            root.showToast(`✅ Data Operator ${name} berhasil disimpan.`, 'success');
        }
    }

    function toggleStatus(id) {
        const list = read();
        const row = list.find(m => m.id === id);
        if (!row) return;

        row.status = (row.status === 'active') ? 'off' : 'active';
        write(list);
        render();

        if (typeof root.showToast === 'function') {
            root.showToast(`Status ${row.name}: ${row.status === 'active' ? 'Aktif' : 'Libur'}`);
        }
    }

    function deleteOperator(id) {
        const list = read();
        const row = list.find(m => m.id === id);
        if (!row) return;

        if (typeof root.confirm === 'function' && !root.confirm(`Hapus operator "${row.name}" dari sistem?`)) {
            return;
        }

        const filtered = list.filter(m => m.id !== id);
        write(filtered);
        render();

        if (typeof root.showToast === 'function') {
            root.showToast(`🗑️ Operator ${row.name} dihapus.`);
        }
    }

    function init() {
        if (!root.document) return;
        let view = root.document.getElementById('view-operator-master');
        if (!view) {
            view = root.document.createElement('div');
            view.id = 'view-operator-master';
            view.className = 'view-section';
            view.style.display = 'none';
            const poolEl = root.document.getElementById('view-pool') || root.document.getElementById('view-machine-master') || root.document.getElementById('view-material-master');
            if (poolEl && poolEl.parentElement) poolEl.parentElement.appendChild(view);
        }
    }

    function open() {
        init();
        const navEl = root.document?.getElementById('nav-operator-master');
        if (typeof root.switchTab === 'function') {
            root.switchTab('operator-master', navEl);
        } else {
            root.document?.querySelectorAll('.view-section').forEach(v => {
                v.classList.remove('active');
                v.style.display = 'none';
            });
            const target = root.document?.getElementById('view-operator-master');
            if (target) {
                target.classList.add('active');
                target.style.display = 'block';
            }
        }
        render();
    }

    function render() {
        init();
        const container = root.document?.getElementById('view-operator-master');
        if (!container) return;

        const database = read();
        const countTotal = database.length;
        const branchCodes = getBranchCodes();

        // Filtering
        const filtered = database.filter(m => {
            const matchBranch = branchFilter === 'all' || normalizeBranch(m.branch) === normalizeBranch(branchFilter);
            const matchSearch = !searchQuery || (
                (m.name || '').toLowerCase().includes(searchQuery) ||
                (m.id || '').toLowerCase().includes(searchQuery) ||
                (m.role || '').toLowerCase().includes(searchQuery) ||
                (m.branch || '').toLowerCase().includes(searchQuery) ||
                (m.shift || '').toLowerCase().includes(searchQuery) ||
                (Array.isArray(m.machines) && m.machines.some(mach => String(mach).toLowerCase().includes(searchQuery)))
            );
            return matchBranch && matchSearch;
        });

        const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

        const tabBtn = (val, label, count) => `
            <button type="button" class="mm-tab ${branchFilter === val ? 'is-active' : ''}" onclick="window.OperatorMaster.filterBranch('${val}')" aria-pressed="${branchFilter === val}">
                ${label} <span>${count}</span>
            </button>
        `;

        const tabsHtml = [
            tabBtn('all', 'Semua Cabang', countTotal),
            ...branchCodes.map(code => {
                const count = database.filter(o => normalizeBranch(o.branch) === normalizeBranch(code)).length;
                return tabBtn(code, code, count);
            })
        ].join('');

        const rowsHtml = filtered.length === 0 ? `
            <tr>
                <td colspan="8" class="mm-empty" style="text-align: center; padding: 40px 0; color: #667085;">
                    <i class="bi bi-person-x" style="font-size: 28px; display: block; margin-bottom: 8px; color: #98a2b3;"></i>
                    Tidak ada operator yang cocok dengan filter.
                </td>
            </tr>
        ` : filtered.map((row, idx) => {
            const isActive = row.status === 'active';
            const statusClass = isActive ? 'badge-success' : 'badge-warning';
            const statusText = isActive ? 'Aktif' : (row.status === 'leave' ? 'Cuti' : 'Libur');

            const machineBadges = Array.isArray(row.machines) && row.machines.length > 0
                ? row.machines.map(m => `<span class="aerotrack-badge me-1 mb-1" style="font-size:11px;"><i class="bi bi-cpu me-1 text-primary"></i>${esc(m)}</span>`).join('')
                : '<span class="text-muted extra-small">Belum ditugaskan mesin</span>';

            const branchBadgeClass = (row.branch === 'DM 1') ? 'badge-info' :
                                   (row.branch === 'DM 2') ? 'badge-primary' :
                                   (row.branch === 'DM 3') ? 'badge-warning' : 'badge-success';

            return `
                <tr>
                    <td class="text-center aerotrack-num" style="width: 44px; color: #667085; font-size: 11px;">${idx + 1}</td>
                    <td style="width: 200px;">
                        <span class="mm-name d-block" style="font-size: 13px; font-weight: 600; color: #101828;">${esc(row.name)}</span>
                        <span class="mm-alias font-monospace text-muted" style="font-size: 11px;">${esc(row.id)}</span>
                    </td>
                    <td style="width: 110px;">
                        <span class="aerotrack-badge ${branchBadgeClass} fw-semibold">${esc(row.branch)}</span>
                    </td>
                    <td style="width: 170px;">
                        <span class="text-dark fw-medium" style="font-size: 12.5px;">${esc(row.role)}</span>
                    </td>
                    <td style="min-width: 240px;">
                        <div class="d-flex flex-wrap align-items-center">${machineBadges}</div>
                    </td>
                    <td style="width: 140px;">
                        <span class="d-block text-dark fw-medium" style="font-size: 12px;"><i class="bi bi-clock me-1 text-muted"></i>${esc(row.shift)}</span>
                        ${row.phone ? `<span class="text-muted" style="font-size: 11px;"><i class="bi bi-telephone me-1"></i>${esc(row.phone)}</span>` : ''}
                    </td>
                    <td style="width: 100px;">
                        <span class="aerotrack-badge ${statusClass}" style="cursor: pointer;" onclick="window.OperatorMaster.toggleStatus('${row.id}')" title="Klik untuk ubah status aktif/libur">
                            <span class="status-indicator"></span> ${statusText}
                        </span>
                    </td>
                    <td class="text-end" style="width: 90px;">
                        <button type="button" class="btn btn-sm btn-light border py-0.5 px-2 text-primary aerotrack-input me-1" style="height:28px; font-size:11.5px;" onclick="window.OperatorMaster.edit('${row.id}')" title="Edit Data Operator">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-light border py-0.5 px-1.5 text-danger aerotrack-input" style="height:28px; font-size:11.5px;" onclick="window.OperatorMaster.deleteOperator('${row.id}')" title="Hapus Operator">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        container.innerHTML = `
            <section class="operator-master material-master">
                <!-- Heading -->
                <header class="mm-heading">
                    <div>
                        <div class="mm-eyebrow">Produksi & Workstation</div>
                        <h4>Database Operator Mesin</h4>
                        <p>Kelola alokasi operator produksi, shift kerja, dan penugasan mesin pada 4 Branch (DM 1, DM 2, DM 3, dan Cikokol).</p>
                    </div>
                    <div class="mm-heading-actions">
                        <button type="button" class="mm-button mm-button-primary" onclick="window.OperatorMaster.add()">
                            <i class="bi bi-person-plus-fill me-1"></i> Tambah Operator
                        </button>
                    </div>
                </header>

                <!-- Card Container -->
                <div class="mm-card">
                    <!-- Toolbar & Filter Tabs -->
                    <div class="mm-toolbar">
                        <div class="mm-tabs" aria-label="Filter cabang operator">
                            ${tabsHtml}
                        </div>
                        <label class="mm-search">
                            <i class="bi bi-search"></i>
                            <input id="operator-search" placeholder="Cari nama, mesin, atau peran..." value="${esc(searchQuery)}" oninput="window.OperatorMaster.search(this.value)">
                        </label>
                    </div>

                    <!-- Table -->
                    <div class="mm-table-scroll">
                        <table class="mm-table">
                            <colgroup>
                                <col style="width: 44px;">
                                <col style="width: 200px;">
                                <col style="width: 110px;">
                                <col style="width: 170px;">
                                <col style="min-width: 240px;">
                                <col style="width: 140px;">
                                <col style="width: 100px;">
                                <col style="width: 90px;">
                            </colgroup>
                            <thead>
                                <tr>
                                    <th class="text-center">NO</th>
                                    <th>NAMA OPERATOR</th>
                                    <th>CABANG</th>
                                    <th>PERAN / POSISI</th>
                                    <th>MESIN YANG DIJALANKAN</th>
                                    <th>SHIFT & KONTAK</th>
                                    <th>STATUS</th>
                                    <th class="text-end">AKSI</th>
                                </tr>
                            </thead>
                            <tbody id="operator-tbody">
                                ${rowsHtml}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Modal Dialog Editor -->
                <dialog id="operator-editor" class="mm-editor" style="max-width: 620px; width: 95%;">
                    <form onsubmit="window.OperatorMaster.save(event)">
                        <div class="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                            <h5 id="opr-form-title" class="mb-0 fw-bold" style="font-size:15px; color:#101828;">Tambah Operator Baru</h5>
                            <button type="button" class="btn-close" style="font-size: 11px;" onclick="document.getElementById('operator-editor').close()"></button>
                        </div>

                        <input type="hidden" id="opr-edit-id">

                        <div class="row g-2 mb-2">
                            <div class="col-md-5">
                                <label class="form-label extra-small fw-semibold mb-1">ID Operator / Kode *</label>
                                <input id="opr-code" class="form-control form-control-sm aerotrack-input font-monospace" placeholder="OPR-DM1-01" required>
                            </div>
                            <div class="col-md-7">
                                <label class="form-label extra-small fw-semibold mb-1">Nama Lengkap *</label>
                                <input id="opr-name" class="form-control form-control-sm aerotrack-input" placeholder="Contoh: Rian Hidayat" required>
                            </div>
                        </div>

                        <div class="row g-2 mb-2">
                            <div class="col-md-6">
                                <label class="form-label extra-small fw-semibold mb-1">Cabang *</label>
                                <select id="opr-branch" class="form-select form-select-sm" data-no-custom-dropdown="true" onchange="window.OperatorMaster.onRoleOrBranchChange()">
                                    ${branchCodes.map(b => `<option value="${b}">${b}</option>`).join('')}
                                </select>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label extra-small fw-semibold mb-1">Peran / Posisi</label>
                                <select id="opr-role" class="form-select form-select-sm" data-no-custom-dropdown="true" onchange="window.OperatorMaster.onRoleOrBranchChange()">
                                    <option value="Operator Indoor Printing">Operator Indoor Printing</option>
                                    <option value="Operator Outdoor Solvent">Operator Outdoor Solvent</option>
                                    <option value="Operator Flatbed & UV">Operator Flatbed & UV</option>
                                    <option value="Operator Superwide 5M">Operator Superwide 5M</option>
                                    <option value="Operator Digital Press A3+">Operator Digital Press A3+</option>
                                    <option value="Operator Laser & Cutting">Operator Laser & Cutting</option>
                                    <option value="Operator Finishing & Die-Cut">Operator Finishing & Die-Cut</option>
                                    <option value="Operator Cetak (Semua Kategori)">Operator Cetak (Semua Kategori)</option>
                                    <option value="Leader Shift">Leader Shift / All-Round</option>
                                </select>
                            </div>
                        </div>

                        <div class="row g-2 mb-3">
                            <div class="col-md-4">
                                <label class="form-label extra-small fw-semibold mb-1">Shift Kerja</label>
                                <select id="opr-shift" class="form-select form-select-sm" data-no-custom-dropdown="true">
                                    <option value="Shift 1 (Pagi)">Shift 1 (Pagi)</option>
                                    <option value="Shift 2 (Siang)">Shift 2 (Siang)</option>
                                    <option value="Shift 3 (Malam)">Shift 3 (Malam)</option>
                                </select>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label extra-small fw-semibold mb-1">No. Kontak / WA</label>
                                <input id="opr-phone" class="form-control form-control-sm aerotrack-input" placeholder="0812-xxx-xxx">
                            </div>
                            <div class="col-md-4">
                                <label class="form-label extra-small fw-semibold mb-1">Status Keaktifan</label>
                                <select id="opr-status" class="form-select form-select-sm" data-no-custom-dropdown="true">
                                    <option value="active">Aktif Bekerja</option>
                                    <option value="off">Libur</option>
                                    <option value="leave">Cuti</option>
                                </select>
                            </div>
                        </div>

                        <!-- Mesin yang Dijalankan -->
                        <div class="mb-3 p-3 bg-light rounded-3 border">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <label class="form-label extra-small fw-bold text-dark mb-0">
                                    <i class="bi bi-cpu me-1 text-primary"></i>Mesin yang Dijalankan (Sertifikasi Mesin)
                                </label>
                                <span id="opr-machine-filter-info" class="badge bg-white text-primary border" style="font-size: 10px; font-weight: 600;">
                                    Khusus Mesin Indoor
                                </span>
                            </div>
                            <div id="opr-machines-container" class="d-flex flex-wrap align-items-center">
                                <!-- Checkboxes rendered by renderMachineCheckboxes() -->
                            </div>
                        </div>

                        <div class="mb-3">
                            <label class="form-label extra-small fw-semibold mb-1">Catatan Tambahan</label>
                            <input id="opr-notes" class="form-control form-control-sm aerotrack-input" placeholder="Keahlian khusus, catatan mesin, dll...">
                        </div>

                        <div class="mm-editor-footer d-flex justify-content-end gap-2 pt-2 border-top">
                            <button type="button" class="btn btn-sm btn-light border px-3 aerotrack-input" onclick="document.getElementById('operator-editor').close()">Batal</button>
                            <button type="submit" class="btn btn-sm btn-wellen-action px-3.5 aerotrack-input fw-semibold">Simpan Data Operator</button>
                        </div>
                    </form>
                </dialog>
            </section>
        `;
    }

    const api = {
        read,
        write,
        init,
        open,
        render,
        add,
        edit,
        save,
        toggleStatus,
        deleteOperator,
        filterBranch,
        search,
        getOperatorsForMachine,
        getOperatorsForBranch,
        renderMachineCheckboxes,
        matchMachineToRole,
        onRoleOrBranchChange
    };

    root.OperatorMaster = api;
    root.document?.addEventListener('DOMContentLoaded', () => {
        init();
    });

})(typeof window !== 'undefined' ? window : globalThis);
