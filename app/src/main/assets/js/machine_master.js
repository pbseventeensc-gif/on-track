/**
 * WTRACK ERP - MASTER MESIN PRODUKSI
 * Mengelola pembagian unit mesin cetak & finishing pada 4 Branch:
 * DM 1, DM 2 (Indoor & Outdoor), DM 3, dan Cikokol.
 * Mendukung fitur Add (Tambah), Edit (Ubah), Toggle Status, dan Filter Cabang.
 */
(function (root) {
    'use strict';

    const STORAGE_KEY = 'wtrack_machines_v1';

    const DEFAULT_MACHINES = [
        // DM 1: Flatbed, CNC, Laser, Cutting
        { id: 'MSN-DM1-01', code: 'MSN-DM1-01', name: 'SQ IMPALA 5', branch: 'DM 1', category: 'Flatbed UV', width: '2.5m x 1.6m', status: 'active', notes: 'Rigid board & acrylic' },
        { id: 'MSN-DM1-02', code: 'MSN-DM1-02', name: 'SUMMA', branch: 'DM 1', category: 'Cutting Plotter', width: '1.6m', status: 'active', notes: 'Contour cut sticker' },
        { id: 'MSN-DM1-03', code: 'MSN-DM1-03', name: 'YH 13', branch: 'DM 1', category: 'UV Hybrid', width: '1.3m', status: 'active', notes: 'Roll & flatbed hybrid' },
        { id: 'MSN-DM1-04', code: 'MSN-DM1-04', name: 'LASER', branch: 'DM 1', category: 'CNC Laser Cutting', width: '1.3m x 2.5m', status: 'active', notes: 'Cutting & engraving acrylic/kayu' },
        { id: 'MSN-DM1-05', code: 'MSN-DM1-05', name: 'DOCAN', branch: 'DM 1', category: 'UV Flatbed', width: '2.5m x 1.3m', status: 'active', notes: 'UV printing media tebal' },

        // DM 2: Indoor (6 jenis mesin, total 12 unit)
        { id: 'MSN-DM2-IN-01', code: 'MSN-DM2-IN-01', name: 'EPSON S60X2 - Unit 1', branch: 'DM 2', category: 'Indoor', width: '1.6m', status: 'active', notes: 'Eco-solvent indoor' },
        { id: 'MSN-DM2-IN-02', code: 'MSN-DM2-IN-02', name: 'EPSON S60X2 - Unit 2', branch: 'DM 2', category: 'Indoor', width: '1.6m', status: 'active', notes: 'Eco-solvent indoor' },
        { id: 'MSN-DM2-IN-03', code: 'MSN-DM2-IN-03', name: 'EPSON S60X2 - Unit 3', branch: 'DM 2', category: 'Indoor', width: '1.6m', status: 'active', notes: 'Eco-solvent indoor' },
        { id: 'MSN-DM2-IN-04', code: 'MSN-DM2-IN-04', name: 'EPSON S80 - Unit 1', branch: 'DM 2', category: 'Indoor', width: '1.6m', status: 'active', notes: 'High-res sticker indoor' },
        { id: 'MSN-DM2-IN-05', code: 'MSN-DM2-IN-05', name: 'EPSON S80 - Unit 2', branch: 'DM 2', category: 'Indoor', width: '1.6m', status: 'active', notes: 'High-res sticker indoor' },
        { id: 'MSN-DM2-IN-06', code: 'MSN-DM2-IN-06', name: 'EPSON S80 - Unit 3', branch: 'DM 2', category: 'Indoor', width: '1.6m', status: 'active', notes: 'High-res sticker indoor' },
        { id: 'MSN-DM2-IN-07', code: 'MSN-DM2-IN-07', name: 'EPSON S80 - Unit 4', branch: 'DM 2', category: 'Indoor', width: '1.6m', status: 'active', notes: 'High-res sticker indoor' },
        { id: 'MSN-DM2-IN-08', code: 'MSN-DM2-IN-08', name: 'LATEX', branch: 'DM 2', category: 'Indoor', width: '1.6m', status: 'active', notes: 'HP Latex odorless printing' },
        { id: 'MSN-DM2-IN-09', code: 'MSN-DM2-IN-09', name: 'UV PULMEN', branch: 'DM 2', category: 'Indoor', width: '1.6m', status: 'active', notes: 'UV roll to roll' },
        { id: 'MSN-DM2-IN-10', code: 'MSN-DM2-IN-10', name: 'JWEI 3.2', branch: 'DM 2', category: 'Indoor', width: '3.2m', status: 'active', notes: 'Digital flatbed cutting lebar' },
        { id: 'MSN-DM2-IN-11', code: 'MSN-DM2-IN-11', name: 'JWEI 1.6 - Unit 1', branch: 'DM 2', category: 'Indoor', width: '1.6m', status: 'active', notes: 'Digital flatbed cutting 1.6m' },
        { id: 'MSN-DM2-IN-12', code: 'MSN-DM2-IN-12', name: 'JWEI 1.6 - Unit 2', branch: 'DM 2', category: 'Indoor', width: '1.6m', status: 'active', notes: 'Digital flatbed cutting 1.6m' },

        // DM 2: Outdoor (2 jenis mesin, total 8 unit)
        { id: 'MSN-DM2-OUT-01', code: 'MSN-DM2-OUT-01', name: '1024 i lebar 3.2 - Unit 1', branch: 'DM 2', category: 'Outdoor', width: '3.2m', status: 'active', notes: 'Konica 1024i printhead' },
        { id: 'MSN-DM2-OUT-02', code: 'MSN-DM2-OUT-02', name: '1024 i lebar 3.2 - Unit 2', branch: 'DM 2', category: 'Outdoor', width: '3.2m', status: 'active', notes: 'Konica 1024i printhead' },
        { id: 'MSN-DM2-OUT-03', code: 'MSN-DM2-OUT-03', name: '1024 i lebar 3.2 - Unit 3', branch: 'DM 2', category: 'Outdoor', width: '3.2m', status: 'active', notes: 'Konica 1024i printhead' },
        { id: 'MSN-DM2-OUT-04', code: 'MSN-DM2-OUT-04', name: '512i lebar 3.2 - Unit 1', branch: 'DM 2', category: 'Outdoor', width: '3.2m', status: 'active', notes: 'Seiko 512i high speed' },
        { id: 'MSN-DM2-OUT-05', code: 'MSN-DM2-OUT-05', name: '512i lebar 3.2 - Unit 2', branch: 'DM 2', category: 'Outdoor', width: '3.2m', status: 'active', notes: 'Seiko 512i high speed' },
        { id: 'MSN-DM2-OUT-06', code: 'MSN-DM2-OUT-06', name: '512i lebar 3.2 - Unit 3', branch: 'DM 2', category: 'Outdoor', width: '3.2m', status: 'active', notes: 'Seiko 512i high speed' },
        { id: 'MSN-DM2-OUT-07', code: 'MSN-DM2-OUT-07', name: '512i lebar 3.2 - Unit 4', branch: 'DM 2', category: 'Outdoor', width: '3.2m', status: 'active', notes: 'Seiko 512i high speed' },
        { id: 'MSN-DM2-OUT-08', code: 'MSN-DM2-OUT-08', name: '512i lebar 3.2 - Unit 5', branch: 'DM 2', category: 'Outdoor', width: '3.2m', status: 'active', notes: 'Seiko 512i high speed' },

        // DM 3: Outdoor Super-Wide, Seaming, Proofing
        { id: 'MSN-DM3-OUT-01', code: 'MSN-DM3-OUT-01', name: 'EFI MATAN 5M - Unit 1', branch: 'DM 3', category: 'Outdoor', width: '5.0m', status: 'active', notes: 'Super-wide 5 meter roll to roll' },
        { id: 'MSN-DM3-OUT-02', code: 'MSN-DM3-OUT-02', name: 'EFI MATAN 5M - Unit 2', branch: 'DM 3', category: 'Outdoor', width: '5.0m', status: 'active', notes: 'Super-wide 5 meter roll to roll' },
        { id: 'MSN-DM3-03', code: 'MSN-DM3-03', name: 'Seaming', branch: 'DM 3', category: 'Finishing', width: '-', status: 'active', notes: 'Mesin penyambung bahan banner' },
        { id: 'MSN-DM3-04', code: 'MSN-DM3-04', name: 'Roland ECO (Proof)', branch: 'DM 3', category: 'Proofing', width: '1.6m', status: 'active', notes: 'Khusus pekerjaan proofing & sampel' },

        // Cikokol: Digital Offset A3
        { id: 'MSN-CKK-01', code: 'MSN-CKK-01', name: 'HP Indigo A3', branch: 'Cikokol', category: 'Digital Offset A3', width: 'A3+ (33x48cm)', status: 'active', notes: 'Brosur, kartu nama, booklet' }
    ];

    let branchFilter = 'all';
    let searchQuery = '';

    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const arg = value => esc(JSON.stringify(String(value)));

    function read() {
        try {
            const raw = root.localStorage?.getItem(STORAGE_KEY);
            if (raw !== null && raw !== undefined) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch (e) {
            console.warn('[MachineMaster] Gagal membaca storage lokal:', e);
        }
        write(DEFAULT_MACHINES);
        return DEFAULT_MACHINES;
    }

    function write(list) {
        try {
            if (root.localStorage) {
                root.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
            }
        } catch (e) {
            console.warn('[MachineMaster] Gagal menyimpan storage lokal:', e);
        }
    }

    function filterBranch(branch) {
        branchFilter = branch || 'all';
        render();
    }

    function search(query) {
        searchQuery = (query || '').toLowerCase().trim();
        render();
        const input = root.document.getElementById('machine-search');
        if (input) {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        }
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
        const branchSelect = root.document?.getElementById('machine-branch');
        if (branchSelect) {
            const codes = getBranchCodes();
            branchSelect.innerHTML = codes.map(b => `<option value="${b}">${b}</option>`).join('');
        }

        const set = (key, val) => { const el = root.document.getElementById(key); if (el) el.value = val; };
        set('machine-edit-id', '');
        set('machine-code', `MSN-AUTO-${Math.floor(100 + Math.random() * 900)}`);
        set('machine-name', '');
        set('machine-branch', branchFilter !== 'all' ? branchFilter : 'DM 1');
        set('machine-category', 'Indoor');
        set('machine-width', '1.6m');
        set('machine-status', 'active');
        set('machine-notes', '');

        const title = root.document.getElementById('machine-form-title');
        if (title) title.textContent = 'Tambah Mesin Baru';

        const dialog = root.document.getElementById('machine-editor');
        if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
        const nameInput = root.document.getElementById('machine-name');
        if (nameInput) nameInput.focus();
    }

    function edit(id) {
        const row = read().find(m => m.id === id);
        if (!row) return;

        const branchSelect = root.document?.getElementById('machine-branch');
        if (branchSelect) {
            const codes = getBranchCodes();
            branchSelect.innerHTML = codes.map(b => `<option value="${b}">${b}</option>`).join('');
        }

        const set = (key, val) => { const el = root.document.getElementById(key); if (el) el.value = val; };
        set('machine-edit-id', row.id);
        set('machine-code', row.code || row.id);
        set('machine-name', row.name || '');
        set('machine-branch', row.branch || 'DM 1');
        set('machine-category', row.category || 'Indoor');
        set('machine-width', row.width || '');
        set('machine-status', row.status || 'active');
        set('machine-notes', row.notes || '');

        const title = root.document.getElementById('machine-form-title');
        if (title) title.textContent = `Edit Mesin · ${row.name}`;

        const dialog = root.document.getElementById('machine-editor');
        if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
        const nameInput = root.document.getElementById('machine-name');
        if (nameInput) nameInput.focus();
    }

    async function save() {
        try {
            const val = id => root.document.getElementById(id)?.value?.trim() || '';
            const id = val('machine-edit-id');
            const code = val('machine-code') || `MSN-${Date.now().toString().slice(-4)}`;
            const name = val('machine-name');
            const branch = val('machine-branch') || 'DM 1';
            const category = val('machine-category') || 'Indoor';
            const width = val('machine-width') || '-';
            const status = val('machine-status') || 'active';
            const notes = val('machine-notes') || '';

            if (!name) {
                root.alert?.('Nama mesin wajib diisi.');
                return;
            }

            const database = read();
            if (id) {
                const idx = database.findIndex(m => m.id === id);
                if (idx >= 0) {
                    database[idx] = { ...database[idx], code, name, branch, category, width, status, notes, updatedAt: new Date().toISOString() };
                }
            } else {
                database.push({
                    id: root.crypto?.randomUUID ? root.crypto.randomUUID() : `MSN_${Date.now()}`,
                    code,
                    name,
                    branch,
                    category,
                    width,
                    status,
                    notes,
                    createdAt: new Date().toISOString()
                });
            }

            write(database);
            render();
            const dialog = root.document.getElementById('machine-editor');
            if (dialog && typeof dialog.close === 'function') dialog.close();
            root.showToast?.('Data mesin berhasil disimpan.');
        } catch (err) {
            console.error('[MachineMaster] Gagal simpan:', err);
            root.alert?.('Gagal menyimpan data mesin: ' + err.message);
        }
    }

    async function toggleStatus(id) {
        try {
            const database = read();
            const row = database.find(m => m.id === id);
            if (!row) return;

            row.status = row.status === 'active' ? 'maintenance' : 'active';
            row.updatedAt = new Date().toISOString();
            write(database);
            render();
            root.showToast?.(`Status ${row.name} diubah menjadi ${row.status === 'active' ? 'Aktif' : 'Maintenance'}.`);
        } catch (err) {
            console.error('[MachineMaster] Gagal toggle status:', err);
        }
    }

    async function deleteMachine(id) {
        if (!confirm('Apakah Anda yakin ingin menghapus mesin ini dari database?')) return;
        const database = read().filter(m => m.id !== id);
        write(database);
        render();
        root.showToast?.('Mesin berhasil dihapus.');
    }

    function init() {
        if (root.document && !root.document.getElementById('view-machine-master')) {
            const view = root.document.createElement('div');
            view.id = 'view-machine-master';
            view.className = 'view-section';
            view.style.display = 'none';
            const poolEl = root.document.getElementById('view-pool') || root.document.getElementById('view-material-master');
            if (poolEl && poolEl.parentElement) poolEl.parentElement.appendChild(view);
        }
    }

    function open() {
        init();
        if (typeof root.switchTab === 'function') {
            root.switchTab('machine-master', root.document.getElementById('nav-machine-master'));
        }
        render();
    }

    function render() {
        const container = root.document.getElementById('view-machine-master');
        if (!container) return;

        const database = read();
        const countTotal = database.length;
        const countActive = database.filter(m => m.status === 'active').length;
        const countMaint = database.filter(m => m.status === 'maintenance').length;

        // Filtering
        const filtered = database.filter(m => {
            const matchBranch = branchFilter === 'all' || m.branch === branchFilter;
            const matchSearch = !searchQuery || (
                (m.name || '').toLowerCase().includes(searchQuery) ||
                (m.code || '').toLowerCase().includes(searchQuery) ||
                (m.category || '').toLowerCase().includes(searchQuery) ||
                (m.branch || '').toLowerCase().includes(searchQuery) ||
                (m.notes || '').toLowerCase().includes(searchQuery)
            );
            return matchBranch && matchSearch;
        });

        const branchCodes = getBranchCodes();
        const tabBtn = (val, label, count) => `
            <button type="button" class="mm-tab ${branchFilter === val ? 'is-active' : ''}" onclick="MachineMaster.filterBranch('${val}')" aria-pressed="${branchFilter === val}">
                ${label} <span>${count}</span>
            </button>
        `;

        const tabsHtml = [
            tabBtn('all', 'Semua Cabang', countTotal),
            ...branchCodes.map(code => {
                const count = database.filter(m => {
                    const b = (m.branch || '').trim().toLowerCase();
                    const target = code.trim().toLowerCase();
                    return b === target || (target.includes('cikokol') && b.includes('cikokol'));
                }).length;
                return tabBtn(code, code, count);
            })
        ].join('');

        container.innerHTML = `
            <section class="machine-master material-master">
                <!-- Heading -->
                <header class="mm-heading">
                    <div>
                        <div class="mm-eyebrow">Produksi & Workstation</div>
                        <h4>Database Mesin Produksi</h4>
                        <p>Kelola alokasi unit mesin fisik pada 4 Branch (DM 1, DM 2, DM 3, dan Cikokol).</p>
                    </div>
                    <div class="mm-heading-actions">
                        <button type="button" class="mm-button mm-button-primary" onclick="MachineMaster.add()">
                            <i class="bi bi-plus-lg me-1"></i> Tambah Mesin
                        </button>
                    </div>
                </header>

                <!-- Card Container -->
                <div class="mm-card">
                    <!-- Toolbar & Filter Tabs -->
                    <div class="mm-toolbar">
                        <div class="mm-tabs" aria-label="Filter cabang mesin">
                            ${tabsHtml}
                        </div>
                        <label class="mm-search">
                            <i class="bi bi-search"></i>
                            <input id="machine-search" placeholder="Cari nama mesin, kode, atau tipe..." value="${esc(searchQuery)}" oninput="MachineMaster.search(this.value)">
                        </label>
                    </div>

                    <!-- Table -->
                    <div class="mm-table-scroll">
                        <table class="mm-table">
                            <colgroup>
                                <col style="width: 140px;">
                                <col style="min-width: 220px;">
                                <col style="width: 110px;">
                                <col style="width: 150px;">
                                <col style="width: 130px;">
                                <col style="width: 120px;">
                                <col style="width: 110px;">
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>Kode Mesin</th>
                                    <th>Nama Unit Mesin</th>
                                    <th>Branch</th>
                                    <th>Sub-Kategori</th>
                                    <th>Kapasitas Lebar</th>
                                    <th>Status</th>
                                    <th class="mm-actions-heading">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filtered.length === 0 ? `
                                    <tr><td colspan="7" class="mm-empty">Tidak ada mesin yang sesuai filter pencarian.</td></tr>
                                ` : filtered.map(row => `
                                    <tr>
                                        <td><span class="mm-sku font-monospace">${esc(row.code || row.id)}</span></td>
                                        <td>
                                            <div class="mm-name font-semibold" title="${esc(row.name)}">${esc(row.name)}</div>
                                            ${row.notes ? `<div class="mm-alias" title="${esc(row.notes)}">${esc(row.notes)}</div>` : ''}
                                        </td>
                                        <td>
                                            <span class="badge ${row.branch === 'Cikokol' ? 'bg-warning-subtle text-warning-emphasis' : 'bg-primary-subtle text-primary'} border px-2 py-0.5 rounded-pill" style="font-size:11px; font-weight:500;">
                                                ${esc(row.branch)}
                                            </span>
                                        </td>
                                        <td><span class="mm-kind">${esc(row.category || '-')}</span></td>
                                        <td class="font-monospace text-muted" style="font-size: 12px;">${esc(row.width || '-')}</td>
                                        <td>
                                            ${row.status === 'active' ? `
                                                <span class="mm-status"><span></span>Aktif</span>
                                            ` : row.status === 'printing' ? `
                                                <span class="badge bg-primary text-white border px-2 py-0.5 rounded-pill" style="font-size: 11px;">Sedang Cetak</span>
                                            ` : `
                                                <span class="mm-status is-inactive"><span></span>Maintenance</span>
                                            `}
                                        </td>
                                        <td>
                                            <div class="mm-row-actions">
                                                <button type="button" class="mm-icon-button" title="Ubah data mesin" aria-label="Edit ${esc(row.name)}" onclick="MachineMaster.edit(${arg(row.id)})">
                                                    <i class="bi bi-pencil"></i>
                                                </button>
                                                <button type="button" class="mm-icon-button ${row.status === 'active' ? 'mm-disable' : 'mm-enable'}" title="${row.status === 'active' ? 'Set Maintenance' : 'Set Aktif'}" onclick="MachineMaster.toggleStatus(${arg(row.id)})">
                                                    <i class="bi bi-power"></i>
                                                </button>
                                                <button type="button" class="mm-icon-button text-danger" title="Hapus mesin" onclick="MachineMaster.deleteMachine(${arg(row.id)})">
                                                    <i class="bi bi-trash"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <!-- Footer -->
                    <footer class="mm-footer">
                        <span>Menampilkan <strong>${filtered.length}</strong> dari <strong>${countTotal}</strong> unit mesin</span>
                        <div class="d-flex align-items-center gap-3">
                            <span class="text-success"><i class="bi bi-check-circle-fill me-1"></i>${countActive} Aktif</span>
                            <span class="text-muted"><i class="bi bi-tools me-1"></i>${countMaint} Maintenance</span>
                        </div>
                    </footer>
                </div>

                <!-- Modal Dialog Editor Add / Edit Mesin -->
                <dialog id="machine-editor" class="mm-editor" aria-labelledby="machine-form-title" onclick="if(event.target===this)this.close()">
                    <div class="mm-editor-heading">
                        <h5 id="machine-form-title">Data Mesin</h5>
                        <button type="button" class="mm-icon-button" aria-label="Tutup form" onclick="document.getElementById('machine-editor').close()">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>
                    <form onsubmit="event.preventDefault(); MachineMaster.save()">
                        <input type="hidden" id="machine-edit-id">
                        
                        <div class="row g-2 mb-2">
                            <div class="col-md-5">
                                <label class="form-label small mb-1">Kode Mesin</label>
                                <input id="machine-code" class="form-control font-monospace form-control-sm" required autocomplete="off">
                            </div>
                            <div class="col-md-7">
                                <label class="form-label small mb-1">Nama Unit Mesin</label>
                                <input id="machine-name" class="form-control form-control-sm" placeholder="Contoh: EPSON S80 - Unit 1" required autocomplete="off">
                            </div>
                        </div>

                        <div class="row g-2 mb-2">
                            <div class="col-md-6">
                                <label class="form-label small mb-1">Branch / Cabang</label>
                                <select id="machine-branch" class="form-select form-select-sm" data-no-custom-dropdown="true">
                                    ${branchCodes.map(b => `<option value="${b}">${b}</option>`).join('')}
                                </select>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label small mb-1">Sub-Kategori</label>
                                <select id="machine-category" class="form-select form-select-sm" data-no-custom-dropdown="true">
                                    <option value="Indoor">Indoor (Eco-Solvent / Latex / High-Res)</option>
                                    <option value="Outdoor">Outdoor (Solvent / Konica / Seiko)</option>
                                    <option value="Flatbed UV">Flatbed UV / Rigid</option>
                                    <option value="Cutting Plotter">Cutting Plotter / JWEI / Summa</option>
                                    <option value="CNC Laser Cutting">CNC Laser Cutting</option>
                                    <option value="Digital Offset A3">Digital Offset A3+ (HP Indigo)</option>
                                    <option value="Finishing">Finishing / Seaming / Laminasi</option>
                                    <option value="Proofing">Proofing & Sample</option>
                                </select>
                            </div>
                        </div>

                        <div class="row g-2 mb-2">
                            <div class="col-md-6">
                                <label class="form-label small mb-1">Kapasitas Lebar</label>
                                <input id="machine-width" class="form-control form-control-sm" placeholder="Contoh: 1.6m, 3.2m, 5.0m, A3+" autocomplete="off">
                            </div>
                            <div class="col-md-6">
                                <label class="form-label small mb-1">Status Operasi</label>
                                <select id="machine-status" class="form-select form-select-sm" data-no-custom-dropdown="true">
                                    <option value="active">Siap Operasi (Aktif)</option>
                                    <option value="maintenance">Maintenance / Perbaikan</option>
                                </select>
                            </div>
                        </div>

                        <div class="mb-3">
                            <label class="form-label small mb-1">Catatan / Keterangan Khusus</label>
                            <input id="machine-notes" class="form-control form-control-sm" placeholder="Catatan media atau peruntukan mesin...">
                        </div>

                        <div class="mm-editor-footer">
                            <button type="button" class="mm-button" onclick="document.getElementById('machine-editor').close()">Batal</button>
                            <button type="submit" class="mm-button mm-button-primary">Simpan Data Mesin</button>
                        </div>
                    </form>
                </dialog>
            </section>
        `;
    }

    const api = {
        read,
        write,
        open,
        render,
        add,
        edit,
        save,
        toggleStatus,
        deleteMachine,
        filterBranch,
        search
    };

    root.MachineMaster = api;
    root.document?.addEventListener('DOMContentLoaded', init);
})(typeof window !== 'undefined' ? window : globalThis);
