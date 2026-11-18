/**
 * WTRACK - MASTER DATA CABANG (BRANCH)
 * Folder: /js/production/branch_master.js
 * Mengelola database cabang produksi, lokasi, fokus operasional, dan PIC cabang.
 */

(function(root) {
    'use strict';

    const STORAGE_KEY = 'wtrack_branches_v1';
    let searchQuery = '';

    const DEFAULT_BRANCHES = [
        {
            id: 'BR-DM1',
            code: 'DM 1',
            name: 'Daan Mogot 1',
            address: 'Jl. Daan Mogot KM 10 No. 12, Jakarta Barat',
            phone: '021-5432-001',
            focus: 'Flatbed UV & Laser Cutting',
            manager: 'Hendra Gunawan',
            status: 'active'
        },
        {
            id: 'BR-DM2',
            code: 'DM 2',
            name: 'Daan Mogot 2 (Pusat)',
            address: 'Jl. Daan Mogot KM 11 No. 88, Jakarta Barat',
            phone: '021-5432-002',
            focus: 'Indoor High-Res, Outdoor Solvent, Finishing & Die-Cut',
            manager: 'Rian Hidayat',
            status: 'active'
        },
        {
            id: 'BR-DM3',
            code: 'DM 3',
            name: 'Daan Mogot 3',
            address: 'Jl. Daan Mogot KM 12 No. 45, Jakarta Barat',
            phone: '021-5432-003',
            focus: 'Superwide 5M & Large Seaming',
            manager: 'Joko Susilo',
            status: 'active'
        },
        {
            id: 'BR-CIK',
            code: 'Cikokol',
            name: 'Cabang Cikokol',
            address: 'Jl. M.H. Thamrin No. 9, Cikokol, Tangerang',
            phone: '021-5577-004',
            focus: 'Digital Press A3+ & Quick Print',
            manager: 'Fajar Ramadhan',
            status: 'active'
        }
    ];

    function read() {
        try {
            const raw = root.localStorage?.getItem(STORAGE_KEY);
            if (raw !== null && raw !== undefined) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) {
            console.warn('[BranchMaster] Gagal membaca storage lokal:', e);
        }
        write(DEFAULT_BRANCHES);
        return DEFAULT_BRANCHES;
    }

    function write(list) {
        try {
            if (root.localStorage) {
                root.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
            }
        } catch (e) {
            console.warn('[BranchMaster] Gagal menyimpan storage lokal:', e);
        }
    }

    function getAllCodes(onlyActive = true) {
        const branches = read();
        const filtered = onlyActive ? branches.filter(b => b.status === 'active') : branches;
        return filtered.map(b => b.code);
    }

    function getBranch(codeOrId) {
        if (!codeOrId) return null;
        const norm = String(codeOrId).toLowerCase().trim();
        return read().find(b =>
            b.id.toLowerCase() === norm ||
            b.code.toLowerCase() === norm ||
            (b.name && b.name.toLowerCase().includes(norm))
        ) || null;
    }

    function search(query) {
        searchQuery = (query || '').toLowerCase().trim();
        render();
        const input = root.document?.getElementById('branch-search');
        if (input) {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        }
    }

    function add() {
        const set = (key, val) => { const el = root.document?.getElementById(key); if (el) el.value = val; };
        set('br-edit-id', '');
        set('br-code', '');
        set('br-name', '');
        set('br-address', '');
        set('br-phone', '');
        set('br-focus', '');
        set('br-manager', '');
        set('br-status', 'active');

        const title = root.document?.getElementById('br-form-title');
        if (title) title.textContent = 'Tambah Cabang Baru';

        const dialog = root.document?.getElementById('branch-editor');
        if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
        const codeInput = root.document?.getElementById('br-code');
        if (codeInput) codeInput.focus();
    }

    function edit(id) {
        const row = read().find(b => b.id === id);
        if (!row) return;

        const set = (key, val) => { const el = root.document?.getElementById(key); if (el) el.value = val; };
        set('br-edit-id', row.id);
        set('br-code', row.code);
        set('br-name', row.name);
        set('br-address', row.address || '');
        set('br-phone', row.phone || '');
        set('br-focus', row.focus || '');
        set('br-manager', row.manager || '');
        set('br-status', row.status || 'active');

        const title = root.document?.getElementById('br-form-title');
        if (title) title.textContent = `Edit Cabang: ${row.code} - ${row.name}`;

        const dialog = root.document?.getElementById('branch-editor');
        if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
    }

    function save(e) {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();

        const get = (key) => root.document?.getElementById(key)?.value || '';
        const id = get('br-edit-id').trim();
        const code = get('br-code').trim();
        const name = get('br-name').trim();
        const address = get('br-address').trim();
        const phone = get('br-phone').trim();
        const focus = get('br-focus').trim();
        const manager = get('br-manager').trim();
        const status = get('br-status').trim() || 'active';

        if (!code || !name) {
            if (typeof root.alert === 'function') root.alert('Kode Cabang dan Nama Cabang wajib diisi.');
            return;
        }

        const list = read();
        if (id) {
            const idx = list.findIndex(b => b.id === id);
            if (idx >= 0) {
                list[idx] = { ...list[idx], code, name, address, phone, focus, manager, status };
            }
        } else {
            const newId = `BR-${code.replace(/\s+/g, '').toUpperCase()}`;
            list.push({
                id: newId,
                code,
                name,
                address,
                phone,
                focus,
                manager,
                status
            });
        }

        write(list);
        const dialog = root.document?.getElementById('branch-editor');
        if (dialog && typeof dialog.close === 'function') dialog.close();

        render();
        if (typeof root.showToast === 'function') {
            root.showToast(`✅ Data Cabang ${code} berhasil disimpan.`, 'success');
        }
    }

    function toggleStatus(id) {
        const list = read();
        const row = list.find(b => b.id === id);
        if (!row) return;

        row.status = (row.status === 'active') ? 'inactive' : 'active';
        write(list);
        render();

        if (typeof root.showToast === 'function') {
            root.showToast(`Status Cabang ${row.code}: ${row.status === 'active' ? 'Aktif' : 'Nonaktif'}`);
        }
    }

    function deleteBranch(id) {
        const list = read();
        const row = list.find(b => b.id === id);
        if (!row) return;

        if (list.length <= 1) {
            if (typeof root.alert === 'function') root.alert('Minimal harus ada 1 cabang terdaftar.');
            return;
        }

        if (typeof root.confirm === 'function' && !root.confirm(`Hapus cabang "${row.code} - ${row.name}"? Pastikan tidak ada mesin atau operator terikat.`)) {
            return;
        }

        const filtered = list.filter(b => b.id !== id);
        write(filtered);
        render();

        if (typeof root.showToast === 'function') {
            root.showToast(`🗑️ Cabang ${row.code} dihapus.`);
        }
    }

    function init() {
        if (!root.document) return;
        let view = root.document.getElementById('view-branch-master');
        if (!view) {
            view = root.document.createElement('div');
            view.id = 'view-branch-master';
            view.className = 'view-section';
            view.style.display = 'none';
            const poolEl = root.document.getElementById('view-pool') || root.document.getElementById('view-machine-master') || root.document.getElementById('view-operator-master');
            if (poolEl && poolEl.parentElement) poolEl.parentElement.appendChild(view);
        }
    }

    function open() {
        init();
        const navEl = root.document?.getElementById('nav-branch-master');
        if (typeof root.switchTab === 'function') {
            root.switchTab('branch-master', navEl);
        } else {
            root.document?.querySelectorAll('.view-section').forEach(v => {
                v.classList.remove('active');
                v.style.display = 'none';
            });
            const target = root.document?.getElementById('view-branch-master');
            if (target) {
                target.classList.add('active');
                target.style.display = 'block';
            }
        }
        render();
    }

    function render() {
        init();
        const container = root.document?.getElementById('view-branch-master');
        if (!container) return;

        const database = read();
        const filtered = database.filter(b => {
            if (!searchQuery) return true;
            return (
                (b.code && b.code.toLowerCase().includes(searchQuery)) ||
                (b.name && b.name.toLowerCase().includes(searchQuery)) ||
                (b.address && b.address.toLowerCase().includes(searchQuery)) ||
                (b.focus && b.focus.toLowerCase().includes(searchQuery)) ||
                (b.manager && b.manager.toLowerCase().includes(searchQuery))
            );
        });

        // Get live machine & operator counts per branch
        let machines = [];
        if (root.MachineMaster && typeof root.MachineMaster.read === 'function') {
            machines = root.MachineMaster.read();
        }

        let operators = [];
        if (root.OperatorMaster && typeof root.OperatorMaster.read === 'function') {
            operators = root.OperatorMaster.read();
        }

        const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

        const rowsHtml = filtered.length === 0 ? `
            <tr>
                <td colspan="9" class="mm-empty" style="text-align: center; padding: 40px 0; color: #667085;">
                    <i class="bi bi-buildings" style="font-size: 28px; display: block; margin-bottom: 8px; color: #98a2b3;"></i>
                    Tidak ada cabang yang cocok dengan pencarian.
                </td>
            </tr>
        ` : filtered.map((row, idx) => {
            const isActive = row.status === 'active';
            const statusClass = isActive ? 'badge-success' : 'badge-warning';
            const statusText = isActive ? 'Aktif' : 'Nonaktif';

            const branchNorm = String(row.code).trim().toLowerCase();
            const machineCount = machines.filter(m => {
                const b = String(m.branch || '').trim().toLowerCase();
                return b === branchNorm || (branchNorm.includes('cikokol') && b.includes('cikokol'));
            }).length;

            const operatorCount = operators.filter(o => {
                const b = String(o.branch || '').trim().toLowerCase();
                return b === branchNorm || (branchNorm.includes('cikokol') && b.includes('cikokol'));
            }).length;

            const branchBadgeClass = (row.code === 'DM 1') ? 'badge-info' :
                                   (row.code === 'DM 2') ? 'badge-primary' :
                                   (row.code === 'DM 3') ? 'badge-warning' : 'badge-success';

            return `
                <tr>
                    <td class="text-center aerotrack-num" style="width: 44px; color: #667085; font-size: 11px;">${idx + 1}</td>
                    <td style="width: 120px;">
                        <span class="aerotrack-badge ${branchBadgeClass} fw-bold" style="font-size: 12px;">${esc(row.code)}</span>
                    </td>
                    <td style="width: 200px;">
                        <span class="mm-name d-block" style="font-size: 13px; font-weight: 600; color: #101828;">${esc(row.name)}</span>
                        ${row.manager ? `<span class="text-muted" style="font-size: 11px;"><i class="bi bi-person me-1"></i>PIC: ${esc(row.manager)}</span>` : ''}
                    </td>
                    <td style="min-width: 220px;">
                        <span class="text-dark d-block" style="font-size: 12px;">${esc(row.address || '-')}</span>
                        ${row.phone ? `<span class="text-muted" style="font-size: 11px;"><i class="bi bi-telephone me-1"></i>${esc(row.phone)}</span>` : ''}
                    </td>
                    <td style="width: 200px;">
                        <span class="text-dark fw-medium" style="font-size: 12px;">${esc(row.focus || '-')}</span>
                    </td>
                    <td style="width: 110px;" class="text-center">
                        <span class="aerotrack-badge badge-primary fw-semibold" style="font-size: 11px;">
                            <i class="bi bi-cpu me-1"></i>${machineCount} Unit
                        </span>
                    </td>
                    <td style="width: 110px;" class="text-center">
                        <span class="aerotrack-badge badge-info fw-semibold" style="font-size: 11px;">
                            <i class="bi bi-people me-1"></i>${operatorCount} Org
                        </span>
                    </td>
                    <td style="width: 100px;">
                        <span class="aerotrack-badge ${statusClass}" style="cursor: pointer;" onclick="window.BranchMaster.toggleStatus('${row.id}')" title="Klik untuk ubah status aktif/nonaktif">
                            <span class="status-indicator"></span> ${statusText}
                        </span>
                    </td>
                    <td class="text-end" style="width: 80px;">
                        <button type="button" class="btn btn-sm btn-light border py-0.5 px-2 text-primary aerotrack-input me-1" style="height:28px; font-size:11.5px;" onclick="window.BranchMaster.edit('${row.id}')" title="Edit Data Cabang">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-light border py-0.5 px-1.5 text-danger aerotrack-input" style="height:28px; font-size:11.5px;" onclick="window.BranchMaster.deleteBranch('${row.id}')" title="Hapus Cabang">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        container.innerHTML = `
            <section class="branch-master material-master">
                <!-- Heading -->
                <header class="mm-heading">
                    <div>
                        <div class="mm-eyebrow">Produksi & Fasilitas</div>
                        <h4>Master Data Cabang (Branch)</h4>
                        <p>Kelola pusat operasional dan cabang produksi Wellen Print.</p>
                    </div>
                    <div class="mm-heading-actions">
                        <button type="button" class="mm-button mm-button-primary" onclick="window.BranchMaster.add()">
                            <i class="bi bi-plus-lg me-1"></i> Tambah Cabang
                        </button>
                    </div>
                </header>

                <!-- Card Container -->
                <div class="mm-card">
                    <!-- Toolbar -->
                    <div class="mm-toolbar">
                        <div class="d-flex align-items-center gap-2">
                            <span id="branch-count-badge" class="aerotrack-badge badge-primary" style="font-size: 12px; font-weight: 700;">
                                Total: ${database.length} Cabang
                            </span>
                        </div>
                        <label class="mm-search">
                            <i class="bi bi-search"></i>
                            <input id="branch-search" placeholder="Cari kode, nama, atau alamat..." value="${esc(searchQuery)}" oninput="window.BranchMaster.search(this.value)">
                        </label>
                    </div>

                    <!-- Table -->
                    <div class="mm-table-scroll">
                        <table class="mm-table">
                            <colgroup>
                                <col style="width: 44px;">
                                <col style="width: 120px;">
                                <col style="width: 200px;">
                                <col style="min-width: 220px;">
                                <col style="width: 200px;">
                                <col style="width: 110px;">
                                <col style="width: 110px;">
                                <col style="width: 100px;">
                                <col style="width: 80px;">
                            </colgroup>
                            <thead>
                                <tr>
                                    <th class="text-center">NO</th>
                                    <th>KODE</th>
                                    <th>NAMA CABANG</th>
                                    <th>LOKASI / ALAMAT</th>
                                    <th>FOKUS PRODUKSI</th>
                                    <th class="text-center">MESIN</th>
                                    <th class="text-center">OPERATOR</th>
                                    <th>STATUS</th>
                                    <th class="text-end">AKSI</th>
                                </tr>
                            </thead>
                            <tbody id="branch-tbody">
                                ${rowsHtml}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Modal Dialog Editor -->
                <dialog id="branch-editor" class="mm-editor" style="max-width: 580px; width: 95%;">
                    <form onsubmit="window.BranchMaster.save(event)">
                        <div class="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                            <h5 id="br-form-title" class="mb-0 fw-bold" style="font-size:15px; color:#101828;">Tambah Cabang Baru</h5>
                            <button type="button" class="btn-close" style="font-size: 11px;" onclick="document.getElementById('branch-editor').close()"></button>
                        </div>

                        <input type="hidden" id="br-edit-id">

                        <div class="row g-2 mb-2">
                            <div class="col-md-5">
                                <label class="form-label extra-small fw-semibold mb-1">Kode Cabang *</label>
                                <input id="br-code" class="form-control form-control-sm aerotrack-input fw-bold" placeholder="Contoh: DM 1, Serpong" required>
                            </div>
                            <div class="col-md-7">
                                <label class="form-label extra-small fw-semibold mb-1">Nama Lengkap Cabang *</label>
                                <input id="br-name" class="form-control form-control-sm aerotrack-input" placeholder="Contoh: Daan Mogot 1" required>
                            </div>
                        </div>

                        <div class="mb-2">
                            <label class="form-label extra-small fw-semibold mb-1">Alamat Lengkap</label>
                            <input id="br-address" class="form-control form-control-sm aerotrack-input" placeholder="Jl. Raya No. ..., Kota">
                        </div>

                        <div class="row g-2 mb-2">
                            <div class="col-md-6">
                                <label class="form-label extra-small fw-semibold mb-1">No. Kontak / Telepon</label>
                                <input id="br-phone" class="form-control form-control-sm aerotrack-input" placeholder="021-xxxx-xxxx">
                            </div>
                            <div class="col-md-6">
                                <label class="form-label extra-small fw-semibold mb-1">Penanggung Jawab (PIC)</label>
                                <input id="br-manager" class="form-control form-control-sm aerotrack-input" placeholder="Nama Kepala Cabang">
                            </div>
                        </div>

                        <div class="row g-2 mb-3">
                            <div class="col-md-8">
                                <label class="form-label extra-small fw-semibold mb-1">Fokus Produksi</label>
                                <input id="br-focus" class="form-control form-control-sm aerotrack-input" placeholder="Contoh: Flatbed UV & Cutting">
                            </div>
                            <div class="col-md-4">
                                <label class="form-label extra-small fw-semibold mb-1">Status</label>
                                <select id="br-status" class="form-select form-select-sm" data-no-custom-dropdown="true">
                                    <option value="active">Aktif</option>
                                    <option value="inactive">Nonaktif</option>
                                </select>
                            </div>
                        </div>

                        <div class="mm-editor-footer d-flex justify-content-end gap-2 pt-2 border-top">
                            <button type="button" class="btn btn-sm btn-light border px-3 aerotrack-input" onclick="document.getElementById('branch-editor').close()">Batal</button>
                            <button type="submit" class="btn btn-sm btn-wellen-action px-3.5 aerotrack-input fw-semibold">Simpan Data Cabang</button>
                        </div>
                    </form>
                </dialog>
            </section>
        `;
    }

    const api = {
        read,
        write,
        getAllCodes,
        getBranch,
        init,
        open,
        render,
        add,
        edit,
        save,
        toggleStatus,
        deleteBranch,
        search
    };

    root.BranchMaster = api;
    root.document?.addEventListener('DOMContentLoaded', () => {
        init();
    });

})(typeof window !== 'undefined' ? window : globalThis);
