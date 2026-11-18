/**
 * WTRACK LOGISTICS - MANAJEMEN & IMPORT SPK PRODUKSI (PUSAT & CIKOKOL)
 * Mengelola antrian Surat Perintah Kerja (SPK) produksi di Pusat & Cikokol,
 * pemantauan mesin cetak, serta konversi 1-klik SPK menjadi Surat Jalan.
 */

(function(window) {
    'use strict';

    let spkOrdersList = [];
    let currentSpkBranchFilter = 'all'; // 'all' | 'pusat' | 'cikokol'

    const MESIN_LIST = [
        { id: "swissq", name: "SwissQPrint Impala 5", img: "/assets/mesin/SwissQPrint-Impala-5.webp" },
        { id: "indigo", name: "HP Indigo 7R", img: "/assets/mesin/HP-Indigo-7R.webp" },
        { id: "latex", name: "HP Latex 3600", img: "/assets/mesin/HP-Latex-3600.webp" },
        { id: "uv_white", name: "UV Printer White Ink", img: "/assets/mesin/UV-Printer-White-Ink.webp" },
        { id: "roland", name: "Roland Ecosolvent", img: "/assets/mesin/Roland-Ecosolvent.webp" },
        { id: "dtg", name: "DTG Kornit Storm Hexa", img: "/assets/mesin/DTG-Kornit-Storm-Hexa.webp" },
        { id: "kongsberg", name: "Esko Kongsberg Cutting", img: "/assets/mesin/Esko-Kosnberg-Cutting.webp" },
        { id: "polar", name: "Polar 115PF Cutting", img: "/assets/mesin/Polar-115PF-Cutting-Machine.webp" },
        { id: "laser", name: "CNC Laser Cutting", img: "/assets/mesin/CNC-Laser-Cutting.webp" },
        { id: "binder", name: "Horizon Perfect Binder", img: "/assets/mesin/Horiznon-Perfect-Binder.webp" }
    ];

    const SPK_STORAGE_KEY = 'wtrack_spk_orders';
    const SPK_SEEDED_KEY = 'wtrack_spk_seeded_v2';
    let isSpkInitialized = false;

    // Inisialisasi data SPK dari LocalStorage atau demo pertama kali
    function initSpkData() {
        if (isSpkInitialized) return;
        isSpkInitialized = true;

        const stored = localStorage.getItem(SPK_STORAGE_KEY);
        if (stored !== null) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    // Otomatis bersihkan 3 SPK demo/mock bawaan agar tidak muncul lagi
                    spkOrdersList = parsed.filter(item => {
                        const idStr = String(item.spkId || item.id || '');
                        const numStr = String(item.spkNumber || '');
                        return !idStr.startsWith('SPK_20261103') && !numStr.includes('SPK/XI/2026/010');
                    });
                    saveSpkData();
                    return;
                }
            } catch (e) {
                console.warn("Gagal membaca cache SPK lokal:", e);
            }
        }

        // Default kosong, tidak ada mock data SPK otomatis
        spkOrdersList = [];
        saveSpkData();
    }

    // Simpan antrian SPK ke browser LocalStorage
    function saveSpkData() {
        try {
            localStorage.setItem(SPK_STORAGE_KEY, JSON.stringify(spkOrdersList.slice(0, 500)));
            localStorage.setItem(SPK_SEEDED_KEY, 'true');
        } catch (e) {
            console.warn("Gagal menyimpan cache SPK:", e);
        }
    }

    // Render Tampilan SPK View
    function renderSPKView() {
        initSpkData();

        const viewContainer = document.getElementById('view-spk');
        if (!viewContainer) return;

        // Inisialisasi struktur layout jika belum ada
        if (!document.getElementById('spk-table-body')) {
            viewContainer.innerHTML = `
                <!-- HEADER SPK -->
                <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                    <div class="d-flex align-items-center gap-2">
                        <span class="fw-semibold text-dark" style="font-size: 13.5px;">Antrian SPK Produksi</span>
                        <span class="badge bg-primary px-2 py-0.5 rounded-pill extra-small fw-medium" id="spk-header-badge">${spkOrdersList.length} SPK Aktif</span>
                    </div>
                    <div class="d-flex align-items-center flex-wrap gap-2">
                        <button class="btn btn-light border btn-sm px-2.5 py-1.5" style="border-radius:8px; font-size: 12px;" onclick="renderSPKView()" title="Refresh Data">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>
                    </div>
                </div>

                <!-- STATISTIK BADGES 4 BRANCH -->
                <div class="row row-cols-2 row-cols-md-5 g-2.5 mb-3">
                    <div class="col">
                        <div class="card border p-3 bg-white h-100" style="border-radius: 10px; border-color: #eaecf0 !important; box-shadow: 0 1px 2px rgba(16,24,40,0.04);">
                            <div class="d-flex align-items-center justify-content-between">
                                <div>
                                    <div class="text-muted extra-small fw-medium text-uppercase">Total SPK</div>
                                    <div class="fw-semibold text-dark mt-1 mb-0" style="font-size: 18px;" id="spk-stat-total">${spkOrdersList.length}</div>
                                </div>
                                <span class="p-2 rounded-2 bg-light text-primary" style="font-size: 15px;"><i class="bi bi-printer"></i></span>
                            </div>
                        </div>
                    </div>
                    <div class="col">
                        <div class="card border p-3 bg-white h-100" style="border-radius: 10px; border-color: #eaecf0 !important; box-shadow: 0 1px 2px rgba(16,24,40,0.04);">
                            <div class="d-flex align-items-center justify-content-between">
                                <div>
                                    <div class="text-muted extra-small fw-medium text-uppercase">DM 1</div>
                                    <div class="fw-semibold text-primary mt-1 mb-0" style="font-size: 18px;" id="spk-stat-dm1">0</div>
                                </div>
                                <span class="p-2 rounded-2 bg-light text-primary" style="font-size: 15px;"><i class="bi bi-building"></i></span>
                            </div>
                        </div>
                    </div>
                    <div class="col">
                        <div class="card border p-3 bg-white h-100" style="border-radius: 10px; border-color: #eaecf0 !important; box-shadow: 0 1px 2px rgba(16,24,40,0.04);">
                            <div class="d-flex align-items-center justify-content-between">
                                <div>
                                    <div class="text-muted extra-small fw-medium text-uppercase">DM 2</div>
                                    <div class="fw-semibold text-primary mt-1 mb-0" style="font-size: 18px;" id="spk-stat-dm2">0</div>
                                </div>
                                <span class="p-2 rounded-2 bg-light text-primary" style="font-size: 15px;"><i class="bi bi-grid-3x3-gap"></i></span>
                            </div>
                        </div>
                    </div>
                    <div class="col">
                        <div class="card border p-3 bg-white h-100" style="border-radius: 10px; border-color: #eaecf0 !important; box-shadow: 0 1px 2px rgba(16,24,40,0.04);">
                            <div class="d-flex align-items-center justify-content-between">
                                <div>
                                    <div class="text-muted extra-small fw-medium text-uppercase">DM 3</div>
                                    <div class="fw-semibold text-purple mt-1 mb-0" style="font-size: 18px; color: #7c3aed;" id="spk-stat-dm3">0</div>
                                </div>
                                <span class="p-2 rounded-2 bg-light" style="font-size: 15px; color: #7c3aed;"><i class="bi bi-layers"></i></span>
                            </div>
                        </div>
                    </div>
                    <div class="col">
                        <div class="card border p-3 bg-white h-100" style="border-radius: 10px; border-color: #eaecf0 !important; box-shadow: 0 1px 2px rgba(16,24,40,0.04);">
                            <div class="d-flex align-items-center justify-content-between">
                                <div>
                                    <div class="text-muted extra-small fw-medium text-uppercase">Cikokol</div>
                                    <div class="fw-semibold text-warning-emphasis mt-1 mb-0" style="font-size: 18px;" id="spk-stat-cikokol">0</div>
                                </div>
                                <span class="p-2 rounded-2 bg-light text-warning" style="font-size: 15px;"><i class="bi bi-cpu"></i></span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- TABEL SPK (AEROTRACK ERP UI STYLE) -->
                <div class="aerotrack-table-container bg-white shadow-sm mb-4">
                    <div class="aerotrack-filter-bar d-flex flex-wrap align-items-center justify-content-between gap-2 border-bottom">
                        <div class="d-flex align-items-center gap-2 flex-wrap">
                            <span class="fw-semibold text-dark extra-small"><i class="bi bi-funnel me-1"></i>Filter Cabang:</span>
                            <div class="aerotrack-pill-nav mb-0">
                                <button class="aerotrack-pill-btn active py-1 px-2.5" id="btn-spk-filter-all" onclick="window.spkManager.filterSpkBranch('all')">Semua Cabang</button>
                                <button class="aerotrack-pill-btn py-1 px-2.5" id="btn-spk-filter-dm1" onclick="window.spkManager.filterSpkBranch('DM 1')">DM 1</button>
                                <button class="aerotrack-pill-btn py-1 px-2.5" id="btn-spk-filter-dm2" onclick="window.spkManager.filterSpkBranch('DM 2')">DM 2</button>
                                <button class="aerotrack-pill-btn py-1 px-2.5" id="btn-spk-filter-dm3" onclick="window.spkManager.filterSpkBranch('DM 3')">DM 3</button>
                                <button class="aerotrack-pill-btn py-1 px-2.5" id="btn-spk-filter-cikokol" onclick="window.spkManager.filterSpkBranch('Cikokol')">Cikokol</button>
                            </div>
                            <button class="btn btn-sm btn-outline-danger aerotrack-input py-1 px-2.5" id="btn-spk-main-bulk-delete" style="display: none;" onclick="window.spkManager.deleteSelectedMainSPK()" title="Hapus SPK terpilih">
                                <i class="bi bi-trash me-1"></i> Hapus Terpilih
                            </button>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <button class="btn btn-sm btn-outline-primary aerotrack-input fw-semibold px-2.5" id="btn-spk-main-bulk-schedule" style="display: none;" onclick="window.SPKScheduler && window.SPKScheduler.openBulkScheduleModal('main')" title="Jadwalkan SPK terpilih ke mesin & operator">
                                <i class="bi bi-calendar2-check me-1"></i> Jadwalkan Terpilih
                            </button>
                            <button class="btn btn-sm btn-outline-primary aerotrack-input fw-semibold px-3" onclick="openSPKImportModal()">
                                <i class="bi bi-upload me-1"></i> Import SPK
                            </button>
                        </div>
                    </div>
                    <div class="table-responsive">
                        <table class="table aerotrack-table align-middle mb-0">
                            <thead>
                                <tr>
                                    <th style="width: 38px;" class="text-center">
                                        <input type="checkbox" class="form-check-input" id="check-all-main-spk" onchange="window.spkManager.toggleAllMainSPK(this.checked)">
                                    </th>
                                    <th style="width: 44px;" class="text-center">No</th>
                                    <th style="width: 140px;">No. SPK & Cabang</th>
                                    <th style="min-width: 180px;">Customer / Klien</th>
                                    <th style="min-width: 220px;">Nama Barang & Size</th>
                                    <th style="width: 130px;">Qty & Mesin</th>
                                    <th style="width: 150px;">Status</th>
                                    <th style="width: 110px;" class="text-center">Aksi</th>
                                    <th style="width: 44px;" class="text-center"><i class="bi bi-printer text-muted" title="Cetak Lembar Kerja"></i></th>
                                    <th style="width: 44px;" class="text-center"><i class="bi bi-trash text-muted"></i></th>
                                </tr>
                            </thead>
                            <tbody id="spk-table-body">
                                <tr><td colspan="10" class="text-center py-5 text-muted">Memuat data SPK...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        const tbody = document.getElementById('spk-table-body');
        if (!tbody) return;

        const filtered = spkOrdersList.filter(item => {
            if (currentSpkBranchFilter === 'all') return true;
            return normalizeBranch(item.productionBranch || item.branch) === normalizeBranch(currentSpkBranchFilter);
        });

        // Update Counter
        const countTotal = spkOrdersList.length;
        const countDm1 = spkOrdersList.filter(s => normalizeBranch(s.productionBranch || s.branch) === 'DM 1').length;
        const countDm2 = spkOrdersList.filter(s => normalizeBranch(s.productionBranch || s.branch) === 'DM 2').length;
        const countDm3 = spkOrdersList.filter(s => normalizeBranch(s.productionBranch || s.branch) === 'DM 3').length;
        const countCikokol = spkOrdersList.filter(s => normalizeBranch(s.productionBranch || s.branch) === 'Cikokol').length;

        const countTotalEl = document.getElementById('spk-stat-total');
        const countDm1El = document.getElementById('spk-stat-dm1');
        const countDm2El = document.getElementById('spk-stat-dm2');
        const countDm3El = document.getElementById('spk-stat-dm3');
        const countCikokolEl = document.getElementById('spk-stat-cikokol');
        const headerBadge = document.getElementById('spk-header-badge');

        if (countTotalEl) countTotalEl.innerText = countTotal;
        if (countDm1El) countDm1El.innerText = countDm1;
        if (countDm2El) countDm2El.innerText = countDm2;
        if (countDm3El) countDm3El.innerText = countDm3;
        if (countCikokolEl) countCikokolEl.innerText = countCikokol;
        if (headerBadge) headerBadge.innerText = `${countTotal} SPK Aktif`;

        // Update active class on filter buttons
        const filterKey = currentSpkBranchFilter.toLowerCase().replace(/\s+/g, '');
        ['all', 'dm1', 'dm2', 'dm3', 'cikokol'].forEach(b => {
            const btn = document.getElementById(`btn-spk-filter-${b}`);
            if (btn) {
                if (b === filterKey || (b === 'all' && currentSpkBranchFilter === 'all')) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center py-5 text-muted">
                <i class="bi bi-printer fs-2 d-block mb-2 text-muted"></i>
                Tidak ada data SPK untuk filter cabang ini.<br>
                <button class="btn btn-primary btn-sm mt-3 fw-bold" onclick="openSPKImportModal()">
                    <i class="bi bi-file-earmark-excel me-1"></i> Import SPK
                </button>
            </td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map((item, idx) => {
            let statusBadge = '<span class="aerotrack-badge">Antri Cetak</span>';
            if (item.productionStatus === 'printing') statusBadge = '<span class="aerotrack-badge badge-primary"><i class="bi bi-printer-fill me-1"></i>Cetak</span>';
            else if (item.productionStatus === 'finishing') statusBadge = '<span class="aerotrack-badge badge-purple"><i class="bi bi-scissors me-1"></i>Finishing</span>';
            else if (item.productionStatus === 'packing') statusBadge = '<span class="aerotrack-badge badge-warning"><i class="bi bi-box-seam me-1"></i>Packing Selesai</span>';
            else if (item.productionStatus === 'completed') statusBadge = '<span class="aerotrack-badge badge-success"><i class="bi bi-check2-circle me-1"></i>Siap Kirim</span>';

            const bNorm = normalizeBranch(item.productionBranch || item.branch);
            let branchBadge = `<span class="aerotrack-badge badge-primary">${bNorm}</span>`;
            if (bNorm === 'DM 3') branchBadge = `<span class="aerotrack-badge badge-purple">DM 3</span>`;
            else if (bNorm === 'Cikokol') branchBadge = `<span class="aerotrack-badge badge-warning">CIKOKOL</span>`;

            const partBadge = item.isSplit
                ? `<span class="badge bg-secondary-subtle border text-secondary me-1" style="font-size:10px;">Part ${item.splitPart}/${item.splitTotalParts}</span>`
                : '';

            const convertBtn = item.linkedSjId
                ? `<span class="aerotrack-badge badge-success"><i class="bi bi-check-all me-1"></i>SJ Dibuat</span>`
                : `<button class="btn btn-sm btn-dark py-1 px-2.5 text-nowrap fw-semibold aerotrack-input" style="font-size: 0.78rem; height: 32px;" onclick="window.spkManager.convertSPKToSuratJalan('${item.spkId}')" title="Buat Surat Jalan & masukkan ke SJ Pool">
                    <i class="bi bi-arrow-right-circle me-1"></i>Buat SJ
                   </button>`;

            const safeId = String(item.spkId || item.id || item.spkNumber || '').replace(/'/g, "\\'");
            return `
                <tr>
                    <td class="text-center" style="width: 38px;">
                        <input type="checkbox" class="form-check-input main-spk-row-checkbox" value="${safeId}" onchange="window.spkManager.updateMainSPKSelection()">
                    </td>
                    <td class="text-center aerotrack-num" style="width: 44px;">${idx + 1}</td>
                    <td style="width: 140px;">
                        <a class="aerotrack-id-link font-monospace">${item.spkNumber}</a>
                        <div class="mt-1 d-flex align-items-center gap-1">${branchBadge} ${partBadge}</div>
                    </td>
                    <td style="min-width: 180px;">
                        <span class="fw-semibold text-dark text-truncate d-inline-block" style="max-width: 200px;" title="${item.clientName || item.customer}">${item.clientName || item.customer}</span>
                        <small class="text-muted extra-small d-block text-truncate" style="max-width: 220px;">${item.jobTitle || item.namaProduk || '-'}</small>
                    </td>
                    <td style="min-width: 220px;">
                        <span class="text-dark font-monospace" style="font-size: 0.78rem;">${item.specs || item.ukuran || '-'}</span>
                        <div class="d-flex align-items-center flex-wrap gap-1 mt-0.5">
                            <span class="aerotrack-badge"><i class="bi bi-cpu me-1 text-primary"></i>${item.machineName || 'Digital Print'}</span>
                            ${item.assignedOperator ? `<span class="badge-operator"><i class="bi bi-person me-1"></i>${item.assignedOperator}</span>` : ''}
                        </div>
                    </td>
                    <td style="width: 130px;">
                        <span class="aerotrack-num">${item.qty}</span>
                        <small class="text-danger fw-semibold extra-small d-block"><i class="bi bi-clock me-1"></i>${item.deadlineAt || '17:00 WIB'}</small>
                    </td>
                    <td style="width: 150px;">
                        <select class="aerotrack-select py-0 px-2" style="width: 135px; font-size: 0.78rem; height: 32px;" onchange="window.spkManager.updateSPKStatus('${safeId}', this.value)">
                            <option value="received" ${item.productionStatus === 'received' ? 'selected' : ''}>Antri Cetak</option>
                            <option value="printing" ${item.productionStatus === 'printing' ? 'selected' : ''}>Cetak</option>
                            <option value="finishing" ${item.productionStatus === 'finishing' ? 'selected' : ''}>Finishing/Cut</option>
                            <option value="packing" ${item.productionStatus === 'packing' ? 'selected' : ''}>Packing</option>
                            <option value="completed" ${item.productionStatus === 'completed' ? 'selected' : ''}>Selesai (Siap SJ)</option>
                        </select>
                    </td>
                    <td class="text-center" style="width: 110px;">
                        ${convertBtn}
                    </td>
                    <td class="text-center" style="width: 44px;">
                        <button class="btn btn-sm btn-light border py-1 px-2 text-primary" onclick="window.spkManager.printWorkOrderSlip('${safeId}')" title="Cetak Lembar Kerja & QR Code">
                            <i class="bi bi-printer"></i>
                        </button>
                    </td>
                    <td class="text-center" style="width: 44px;">
                        <button class="btn btn-sm btn-light border py-1 px-2 text-danger" onclick="window.spkManager.deleteSPKOrder('${safeId}')" title="Hapus SPK">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        updateMainSPKSelection();
    }

    // Hapus Single SPK dari Antrian Utama
    function deleteSPKOrder(spkIdentifier) {
        if (!confirm("Hapus pekerjaan SPK ini dari antrian produksi?")) return;

        const targetId = String(spkIdentifier || '').trim();
        const initialLen = spkOrdersList.length;
        spkOrdersList = spkOrdersList.filter(s => {
            const sid = String(s.spkId || s.id || s.spkNumber || '').trim();
            return sid !== targetId && s.spkId !== targetId && s.id !== targetId && s.spkNumber !== targetId;
        });

        if (spkOrdersList.length < initialLen) {
            saveSpkData();
            if (typeof window.showToast === 'function') {
                window.showToast("🗑️ SPK berhasil dihapus.");
            }
            renderSPKView();
        }
    }

    // Toggle All Checkbox di View Utama SPK
    function toggleAllMainSPK(checked) {
        document.querySelectorAll('.main-spk-row-checkbox').forEach(cb => cb.checked = checked);
        updateMainSPKSelection();
    }

    // Update Status Tombol Bulk Delete & Schedule di View Utama SPK
    function updateMainSPKSelection() {
        const checkedBoxes = document.querySelectorAll('.main-spk-row-checkbox:checked');
        const bulkDelBtn = document.getElementById('btn-spk-main-bulk-delete');
        const bulkSchedBtn = document.getElementById('btn-spk-main-bulk-schedule');
        const count = checkedBoxes ? checkedBoxes.length : 0;
        if (bulkDelBtn) {
            bulkDelBtn.style.display = count > 0 ? 'inline-block' : 'none';
            bulkDelBtn.title = `Hapus ${count} SPK terpilih`;
        }
        if (bulkSchedBtn) {
            bulkSchedBtn.style.display = count > 0 ? 'inline-block' : 'none';
            bulkSchedBtn.title = `Jadwalkan ${count} SPK terpilih`;
        }
    }

    // Hapus Massal SPK yang Dicentang di View Utama SPK
    function deleteSelectedMainSPK() {
        const checkedBoxes = Array.from(document.querySelectorAll('.main-spk-row-checkbox:checked'));
        if (checkedBoxes.length === 0) return;

        if (!confirm(`Hapus ${checkedBoxes.length} pekerjaan SPK terpilih dari antrian produksi?`)) return;

        const idsToDelete = new Set(checkedBoxes.map(cb => String(cb.value).trim()));
        spkOrdersList = spkOrdersList.filter(s => {
            const sid = String(s.spkId || s.id || s.spkNumber || '').trim();
            return !idsToDelete.has(sid) && !idsToDelete.has(String(s.spkId)) && !idsToDelete.has(String(s.id)) && !idsToDelete.has(String(s.spkNumber));
        });

        saveSpkData();
        if (typeof window.showToast === 'function') {
            window.showToast(`🗑️ ${idsToDelete.size} SPK berhasil dihapus.`);
        }
        renderSPKView();
    }

    // Filter Cabang SPK
    function filterSpkBranch(branch) {
        currentSpkBranchFilter = branch;
        renderSPKView();
    }

    // Update Status SPK
    function updateSPKStatus(spkId, newStatus) {
        const item = spkOrdersList.find(s => s.spkId === spkId);
        if (!item) return;
        item.productionStatus = newStatus;
        if (typeof window.showToast === 'function') {
            window.showToast(`Status ${item.spkNumber} diperbarui.`);
        }
        renderSPKView();
    }

    // 1-Click Konversi SPK Selesai menjadi Surat Jalan
    function convertSPKToSuratJalan(spkInput) {
        let spk = null;
        if (typeof spkInput === 'string') {
            spk = spkOrdersList.find(s => s.spkId === spkInput || s.id === spkInput);
        } else if (typeof spkInput === 'object' && spkInput !== null) {
            spk = spkInput;
        }
        if (!spk) return null;

        if (spk.isSplit && spk.parentSpkId) {
            const agg = getSPKAggregateStatus(spk.parentSpkId, spkOrdersList);
            if (agg && agg.status !== 'completed') {
                const confirmed = (typeof window !== 'undefined' && typeof window.confirm === 'function')
                    ? window.confirm(`Perhatian: SPK ${spk.parentSpkNumber || spk.spkNumber} di-split ke ${agg.totalParts} mesin dan baru ${agg.completedParts} bagian selesai. Ingin membuat Surat Jalan parsial?`)
                    : true;
                if (!confirmed) return null;
            }
        }

        const todayDate = new Date();
        const dateFolder = todayDate.toISOString().slice(0, 10);
        const tripId = `TRIP_FROM_SPK_${Date.now()}`;
        const shortCode = (typeof window.sjImportEngine !== 'undefined') ? window.sjImportEngine.generateUniqueCode('WK') : 'WK-SPK1';
        const sjNumber = spk.noSJ || `SJ/SPK/${todayDate.getFullYear()}/${String(todayDate.getMonth()+1).padStart(2,'0')}/${Math.floor(1000 + Math.random() * 9000)}`;
        const qrPayload = `WTRACK|SJ|${tripId}|${sjNumber}|${shortCode}`;

        // Deteksi Region alamat jika ada
        const clientAddr = spk.alamatKlien || spk.address || '';
        const region = (typeof window.sjImportEngine !== 'undefined') 
            ? window.sjImportEngine.detectRegion(clientAddr, spk.clientName || spk.customer) 
            : (spk.region || 'Jakarta Pusat');

        const branch = spk.productionBranch || spk.branch || 'pusat';

        const newTrip = {
            id: tripId,
            tripId: tripId,
            noSJ: sjNumber,
            sjNumber: sjNumber,
            uniqueCode: shortCode,
            shortCode: shortCode,
            qrPayload: qrPayload,
            dateFolder: dateFolder,
            date: dateFolder,
            customer: spk.clientName || spk.customer || 'Klien Percetakan',
            address: clientAddr || `Alamat Klien ${spk.clientName || spk.customer || ''}`,
            region: region,
            printLocation: branch,
            originBranch: branch,
            branchId: branch,
            branchWorkflowStatus: (branch === 'cikokol') ? 'packing' : 'ready',
            status: 'pool',
            items: [{
                nama: spk.namaProduk || spk.jobTitle || 'Produk Cetak',
                qty: spk.qty || 1,
                satuan: spk.satuan || 'Pcs'
            }],
            destinations: [{
                stopIndex: 1,
                sjNumber: sjNumber,
                shortCode: shortCode,
                locationName: spk.clientName || spk.customer || 'Klien',
                address: clientAddr || 'Alamat Pengiriman',
                itemsSummary: `${spk.namaProduk || spk.jobTitle || 'Produk'} (${spk.specs || ''})`,
                qty: spk.qty || '1 Koli',
                latitude: -6.2088,
                longitude: 106.8456,
                status: 'pending'
            }]
        };

        if (window.allCurrentTrips) {
            window.allCurrentTrips.unshift(newTrip);
        }
        if (window.mockDatabase && window.mockDatabase.suratJalanList) {
            window.mockDatabase.suratJalanList.unshift(newTrip);
        }

        spk.linkedSjId = tripId;

        if (typeof window.showToast === 'function') {
            window.showToast(`✅ Berhasil membuat Surat Jalan (${sjNumber}) dari ${spk.spkNumber || spk.noSPK || 'SPK'}! Data masuk ke SJ Pool.`);
        }

        if (typeof renderSPKView === 'function') {
            try { renderSPKView(); } catch(e) {}
        }
        if (typeof window.renderUnifiedPoolView === 'function') {
            try { window.renderUnifiedPoolView(); } catch(e) {}
        }

        if (typeof window.loadPoolTrips === 'function') window.loadPoolTrips();
        if (typeof window.renderRecentShipments === 'function') window.renderRecentShipments();

        return newTrip;
    }

    // Helper normalisasi nama branch ke 4 Branch resmi Wellen
    function normalizeBranch(b) {
        if (!b) return 'DM 2';
        const s = String(b).trim().toLowerCase();
        if (s === 'dm 1' || s === 'dm1') return 'DM 1';
        if (s === 'dm 2' || s === 'dm2' || s === 'pusat') return 'DM 2';
        if (s === 'dm 3' || s === 'dm3') return 'DM 3';
        if (s === 'cikokol') return 'Cikokol';
        return 'DM 2';
    }

    // Helper mengambil daftar mesin per branch
    function getMachinesForBranch(branch) {
        const normBranch = normalizeBranch(branch);
        if (typeof window !== 'undefined' && window.MachineMaster && typeof window.MachineMaster.read === 'function') {
            const all = window.MachineMaster.read();
            if (Array.isArray(all) && all.length > 0) {
                const filtered = all.filter(m => normalizeBranch(m.branch) === normBranch && m.status !== 'maintenance');
                if (filtered.length > 0) return filtered;
            }
        }

        if (normBranch === 'DM 1') {
            return [
                { id: 'MSN-DM1-01', name: 'SQ IMPALA 5' },
                { id: 'MSN-DM1-02', name: 'SUMMA' },
                { id: 'MSN-DM1-03', name: 'YH 13' },
                { id: 'MSN-DM1-04', name: 'LASER' },
                { id: 'MSN-DM1-05', name: 'DOCAN' }
            ];
        } else if (normBranch === 'DM 3') {
            return [
                { id: 'MSN-DM3-01', name: 'EFI MATAN 5M - Unit 1' },
                { id: 'MSN-DM3-02', name: 'EFI MATAN 5M - Unit 2' },
                { id: 'MSN-DM3-03', name: 'Seaming' },
                { id: 'MSN-DM3-04', name: 'Roland ECO (Proof)' }
            ];
        } else if (normBranch === 'Cikokol') {
            return [
                { id: 'MSN-CIK-01', name: 'HP Indigo A3' }
            ];
        } else {
            return [
                { id: 'MSN-DM2-IN-01', name: 'EPSON S60X2 - Unit 1' },
                { id: 'MSN-DM2-IN-04', name: 'EPSON S80 - Unit 1' },
                { id: 'MSN-DM2-IN-08', name: 'LATEX' },
                { id: 'MSN-DM2-IN-09', name: 'UV PULMEN' },
                { id: 'MSN-DM2-IN-10', name: 'JWEI 3.2' },
                { id: 'MSN-DM2-IN-11', name: 'JWEI 1.6 - Unit 1' },
                { id: 'MSN-DM2-OUT-01', name: 'Mesin 1024 i lebar 3.2 - Unit 1' },
                { id: 'MSN-DM2-OUT-04', name: 'Mesin 512i lebar 3.2 - Unit 1' }
            ];
        }
    }

    // State Preview SPK Import
    let currentSPKPreviewList = [];
    let currentSplittingItemIndex = -1;
    let currentSplitParts = [];

    // Render Tabel Preview SPK di Modal
    function renderSPKPreviewTable() {
        const tbody = document.getElementById('spk-import-preview-tbody');
        const countBadge = document.getElementById('spk-import-count-badge');
        const bulkDelBtn = document.getElementById('btn-spk-bulk-delete');
        const checkAll = document.getElementById('check-all-preview-spk');

        if (countBadge) countBadge.innerText = `${currentSPKPreviewList.length} SPK`;

        if (!tbody) return;

        if (currentSPKPreviewList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center py-5 text-muted" style="font-size: 0.8rem;">Belum ada file dipilih. Silakan pilih file Excel SPK di atas.</td></tr>`;
            if (bulkDelBtn) bulkDelBtn.style.display = 'none';
            if (checkAll) checkAll.checked = false;
            return;
        }

        tbody.innerHTML = currentSPKPreviewList.map((s, idx) => {
            const branch = normalizeBranch(s.originBranch || s.branch || s.productionBranch);
            const machines = getMachinesForBranch(branch);
            const currentMachineName = s.machineName || s.machine || (machines[0]?.name || 'Digital Print');

            let splitCol = '';
            if (s.isSplit) {
                splitCol = `
                    <div class="d-flex align-items-center justify-content-center gap-1">
                        <span class="aerotrack-badge badge-warning" style="font-size: 0.72rem; padding: 2px 6px;">Part ${s.splitPart}/${s.splitTotalParts}</span>
                        <button type="button" class="btn btn-sm btn-light border py-0 px-1 text-danger aerotrack-input" style="height:26px; font-size:11px;" onclick="window.spkManager.revertSplit('${s.parentSpkId}')" title="Batalkan split dan satukan kembali">
                            <i class="bi bi-arrow-counterclockwise"></i>
                        </button>
                    </div>
                `;
            } else {
                splitCol = `
                    <button type="button" class="btn btn-sm btn-light border py-0 px-2 text-primary fw-semibold aerotrack-input d-flex align-items-center justify-content-center gap-1 w-100" style="height: 28px; font-size: 0.75rem;" onclick="window.spkManager.openSplitModal(${idx})" title="Bagi item ini ke beberapa mesin">
                        <i class="bi bi-scissors"></i> Split
                    </button>
                `;
            }

            return `
                <tr>
                    <td class="text-center" style="width: 38px;">
                        <input type="checkbox" class="form-check-input spk-preview-row-checkbox" data-index="${idx}" checked onchange="window.spkManager && window.spkManager.updateSPKSelection()">
                    </td>
                    <td class="text-center aerotrack-num" style="width: 38px;">${idx + 1}</td>
                    <td style="width: 105px;">
                        <select class="aerotrack-select py-0 px-2 spk-preview-branch-select" data-index="${idx}" onchange="window.spkManager.onPreviewBranchChange(${idx}, this.value)" style="width: 95px; font-size: 0.78rem; height: 32px;">
                            <option value="DM 1" ${branch === 'DM 1' ? 'selected' : ''}>DM 1</option>
                            <option value="DM 2" ${branch === 'DM 2' ? 'selected' : ''}>DM 2</option>
                            <option value="DM 3" ${branch === 'DM 3' ? 'selected' : ''}>DM 3</option>
                            <option value="Cikokol" ${branch === 'Cikokol' ? 'selected' : ''}>Cikokol</option>
                        </select>
                    </td>
                    <td style="width: 165px;">
                        <select class="aerotrack-select py-0 px-2 spk-preview-machine-select" data-index="${idx}" onchange="window.spkManager.onPreviewMachineChange(${idx}, this.value)" style="width: 155px; font-size: 0.78rem; height: 32px;">
                            ${machines.map(m => `<option value="${m.name}" ${currentMachineName === m.name ? 'selected' : ''}>${m.name}</option>`).join('')}
                        </select>
                    </td>
                    <td style="min-width: 200px;">
                        <span class="fw-semibold text-dark text-truncate d-inline-block" style="max-width: 240px;" title="${s.namaBarang || s.jobTitle}">${s.namaBarang || s.jobTitle || '-'}</span>
                    </td>
                    <td style="width: 100px;">
                        <span class="text-muted font-monospace" style="font-size: 0.78rem;">${s.ukuran || '-'}</span>
                    </td>
                    <td class="text-end" style="width: 80px;">
                        <span class="aerotrack-num">${s.qty || '1 Pcs'}</span>
                    </td>
                    <td style="width: 120px;">
                        <span class="text-muted extra-small text-truncate d-inline-block" style="max-width: 110px;" title="${s.finishing || ''}">${s.finishing || '-'}</span>
                    </td>
                    <td class="text-center" style="width: 95px;">
                        ${splitCol}
                    </td>
                    <td class="text-center" style="width: 38px;">
                        <button type="button" class="btn btn-sm btn-light border py-1 px-2 text-danger" onclick="window.spkManager && window.spkManager.deleteSPKRow(${idx})" title="Hapus baris ini">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        updateSPKSelection();
    }

    function onPreviewBranchChange(idx, branch) {
        if (!currentSPKPreviewList[idx]) return;
        const norm = normalizeBranch(branch);
        currentSPKPreviewList[idx].originBranch = norm;
        currentSPKPreviewList[idx].branch = norm;
        currentSPKPreviewList[idx].productionBranch = norm;

        const machines = getMachinesForBranch(norm);
        currentSPKPreviewList[idx].machineName = machines[0]?.name || 'Digital Print';
        currentSPKPreviewList[idx].machine = currentSPKPreviewList[idx].machineName;
        currentSPKPreviewList[idx].machineId = machines[0]?.id || '';
        renderSPKPreviewTable();
    }

    function onPreviewMachineChange(idx, machineName) {
        if (!currentSPKPreviewList[idx]) return;
        currentSPKPreviewList[idx].machineName = machineName;
        currentSPKPreviewList[idx].machine = machineName;
    }

    function openSplitModal(index) {
        if (index < 0 || index >= currentSPKPreviewList.length) return;
        currentSplittingItemIndex = index;
        const item = currentSPKPreviewList[index];

        const rawQty = parseFloat(String(item.qty || '1').replace(/[^\d.]/g, '')) || 1;
        const half1 = Math.ceil(rawQty / 2);
        const half2 = rawQty - half1;
        const currBranch = normalizeBranch(item.productionBranch || item.branch);
        const machines = getMachinesForBranch(currBranch);
        const defaultMachine = machines[0]?.name || item.machineName || 'Digital Print';

        currentSplitParts = [
            { qty: half1, branch: currBranch, machineName: defaultMachine },
            { qty: half2, branch: currBranch, machineName: machines[1]?.name || defaultMachine }
        ];

        const nameEl = document.getElementById('split-item-name');
        const specsEl = document.getElementById('split-item-specs');
        const qtyEl = document.getElementById('split-item-total-qty');

        if (nameEl) nameEl.textContent = item.namaBarang || item.jobTitle || 'Item SPK';
        if (specsEl) specsEl.textContent = `Ukuran: ${item.ukuran || '-'} | Finishing: ${item.finishing || '-'}`;
        if (qtyEl) qtyEl.textContent = `${rawQty} Pcs`;

        renderSplitModalParts();
        updateSplitValidation();

        const modalEl = document.getElementById('modal-spk-split');
        if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            bootstrap.Modal.getOrCreateInstance(modalEl).show();
        }
    }

    function renderSplitModalParts() {
        const container = document.getElementById('split-parts-container');
        if (!container) return;

        container.innerHTML = currentSplitParts.map((part, pIdx) => {
            const letter = String.fromCharCode(65 + pIdx);
            const branch = normalizeBranch(part.branch);
            const machines = getMachinesForBranch(branch);

            return `
                <div class="p-2.5 bg-white rounded-3 border d-flex align-items-center gap-2 flex-wrap" style="border-color:#EAECF0 !important;">
                    <span class="badge bg-secondary px-2 py-1" style="font-size:11px;">Part ${letter}</span>
                    <div style="width: 100px;">
                        <input type="number" class="form-control form-control-sm aerotrack-input text-end font-monospace split-part-qty" data-index="${pIdx}" value="${part.qty}" min="1" oninput="window.spkManager.onSplitPartQtyChange(${pIdx}, this.value)" placeholder="Qty">
                    </div>
                    <div style="width: 110px;">
                        <select class="form-select form-select-sm aerotrack-select" onchange="window.spkManager.onSplitPartBranchChange(${pIdx}, this.value)">
                            <option value="DM 1" ${branch === 'DM 1' ? 'selected' : ''}>DM 1</option>
                            <option value="DM 2" ${branch === 'DM 2' ? 'selected' : ''}>DM 2</option>
                            <option value="DM 3" ${branch === 'DM 3' ? 'selected' : ''}>DM 3</option>
                            <option value="Cikokol" ${branch === 'Cikokol' ? 'selected' : ''}>Cikokol</option>
                        </select>
                    </div>
                    <div style="flex: 1; min-width: 160px;">
                        <select class="form-select form-select-sm aerotrack-select" onchange="window.spkManager.onSplitPartMachineChange(${pIdx}, this.value)">
                            ${machines.map(m => `<option value="${m.name}" ${part.machineName === m.name ? 'selected' : ''}>${m.name}</option>`).join('')}
                        </select>
                    </div>
                    ${currentSplitParts.length > 2 ? `
                        <button type="button" class="btn btn-sm btn-light border py-1 px-2 text-danger" onclick="window.spkManager.removeSplitPartRow(${pIdx})" title="Hapus bagian ini">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    function addSplitPartRow() {
        const pIdx = currentSplitParts.length;
        const lastPart = currentSplitParts[pIdx - 1] || { branch: 'DM 2' };
        const branch = normalizeBranch(lastPart.branch);
        const machines = getMachinesForBranch(branch);
        currentSplitParts.push({
            qty: 1,
            branch: branch,
            machineName: machines[0]?.name || 'Digital Print'
        });
        renderSplitModalParts();
        updateSplitValidation();
    }

    function removeSplitPartRow(pIdx) {
        if (currentSplitParts.length <= 2) return;
        currentSplitParts.splice(pIdx, 1);
        renderSplitModalParts();
        updateSplitValidation();
    }

    function onSplitPartQtyChange(pIdx, val) {
        if (currentSplitParts[pIdx]) {
            currentSplitParts[pIdx].qty = parseFloat(val) || 0;
            updateSplitValidation();
        }
    }

    function onSplitPartBranchChange(pIdx, branch) {
        if (currentSplitParts[pIdx]) {
            currentSplitParts[pIdx].branch = branch;
            const machines = getMachinesForBranch(branch);
            currentSplitParts[pIdx].machineName = machines[0]?.name || 'Digital Print';
            renderSplitModalParts();
            updateSplitValidation();
        }
    }

    function onSplitPartMachineChange(pIdx, machineName) {
        if (currentSplitParts[pIdx]) {
            currentSplitParts[pIdx].machineName = machineName;
        }
    }

    function updateSplitValidation() {
        const item = currentSPKPreviewList[currentSplittingItemIndex];
        if (!item) return;

        const originalQty = parseFloat(String(item.qty || '1').replace(/[^\d.]/g, '')) || 1;
        const totalSplit = currentSplitParts.reduce((sum, p) => sum + (parseFloat(p.qty) || 0), 0);
        const diff = originalQty - totalSplit;

        const alertEl = document.getElementById('split-validation-alert');
        const applyBtn = document.getElementById('btn-apply-split');

        if (alertEl) {
            if (Math.abs(diff) < 0.001) {
                alertEl.className = 'p-2.5 rounded-3 border bg-success-subtle border-success text-success d-flex align-items-center justify-content-between';
                alertEl.innerHTML = `<span><i class="bi bi-check-circle me-1.5"></i>Kuantitas pas: <b>${totalSplit}</b> dari <b>${originalQty}</b> pcs</span>`;
                if (applyBtn) applyBtn.disabled = false;
            } else if (diff > 0) {
                alertEl.className = 'p-2.5 rounded-3 border bg-warning-subtle border-warning text-warning-emphasis d-flex align-items-center justify-content-between';
                alertEl.innerHTML = `<span><i class="bi bi-exclamation-triangle me-1.5"></i>Kurang <b>${diff}</b> pcs (Terbagi ${totalSplit} dari ${originalQty})</span>`;
                if (applyBtn) applyBtn.disabled = true;
            } else {
                alertEl.className = 'p-2.5 rounded-3 border bg-danger-subtle border-danger text-danger d-flex align-items-center justify-content-between';
                alertEl.innerHTML = `<span><i class="bi bi-x-circle me-1.5"></i>Berlebih <b>${Math.abs(diff)}</b> pcs (Terbagi ${totalSplit} dari ${originalQty})</span>`;
                if (applyBtn) applyBtn.disabled = true;
            }
        }
    }

    function applySplit() {
        if (currentSplittingItemIndex < 0 || !currentSPKPreviewList[currentSplittingItemIndex]) return;

        try {
            splitSPKItem(currentSPKPreviewList, currentSplittingItemIndex, currentSplitParts);
            renderSPKPreviewTable();

            const modalEl = document.getElementById('modal-spk-split');
            if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                const inst = bootstrap.Modal.getInstance(modalEl);
                if (inst) inst.hide();
            }

            if (typeof window.showToast === 'function') {
                window.showToast(`✂️ SPK berhasil di-split ke ${currentSplitParts.length} bagian mesin.`);
            }
        } catch (err) {
            alert(err.message || 'Gagal menerapkan split SPK');
        }
    }

    function revertSplit(parentSpkId) {
        if (!confirm("Satukan kembali pecahan SPK ini menjadi 1 item utuh?")) return;
        revertSplitSPKItem(currentSPKPreviewList, parentSpkId);
        renderSPKPreviewTable();
        if (typeof window.showToast === 'function') {
            window.showToast("↩️ SPK berhasil disatukan kembali.");
        }
    }

    // Hapus satu baris SPK di preview
    function deleteSPKRow(index) {
        if (index >= 0 && index < currentSPKPreviewList.length) {
            currentSPKPreviewList.splice(index, 1);
            renderSPKPreviewTable();
        }
    }

    // Centang / Lepas semua baris preview SPK
    function toggleAllSPKPreview(checked) {
        document.querySelectorAll('.spk-preview-row-checkbox').forEach(cb => cb.checked = checked);
        updateSPKSelection();
    }

    // Update status tombol bulk delete SPK
    function updateSPKSelection() {
        const checkedBoxes = document.querySelectorAll('.spk-preview-row-checkbox:checked');
        const bulkDelBtn = document.getElementById('btn-spk-bulk-delete');
        if (bulkDelBtn) {
            bulkDelBtn.style.display = checkedBoxes.length > 0 ? 'inline-block' : 'none';
            bulkDelBtn.title = `Hapus ${checkedBoxes.length} SPK terpilih`;
        }
    }

    // Bulk hapus baris yang dicentang di preview SPK
    function deleteSelectedSPKRows() {
        const checkedBoxes = Array.from(document.querySelectorAll('.spk-preview-row-checkbox:checked'));
        if (checkedBoxes.length === 0) return;

        const indicesToDelete = checkedBoxes.map(cb => parseInt(cb.getAttribute('data-index'), 10)).sort((a, b) => b - a);
        indicesToDelete.forEach(idx => {
            if (idx >= 0 && idx < currentSPKPreviewList.length) {
                currentSPKPreviewList.splice(idx, 1);
            }
        });

        renderSPKPreviewTable();
        if (typeof window.showToast === 'function') {
            window.showToast(`🗑️ ${indicesToDelete.length} SPK dihapus dari daftar preview.`);
        }
    }

    // Parse Satu File Excel SPK
    async function parseSPKFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const rows2D = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                    if (!rows2D || rows2D.length === 0) return resolve([]);

                    let detectedClientName = 'WELLEN DM';
                    let headerRowIndex = -1;

                    for (let r = 0; r < Math.min(rows2D.length, 12); r++) {
                        const rowStr = rows2D[r].map(c => String(c || '').trim()).join(' ');
                        const matchClient = rowStr.match(/nama pemberi kerja\s*[:\-]?\s*([a-zA-Z0-9\s_\-\.]+)/i);
                        if (matchClient && matchClient[1]) {
                            detectedClientName = matchClient[1].trim();
                        }

                        const lowerCells = rows2D[r].map(c => String(c || '').toLowerCase().trim());
                        const hasMesin = lowerCells.some(c => c.includes('mesin') || c === 'n');
                        const hasBarang = lowerCells.some(c => c.includes('nama barang') || c.includes('barang'));
                        if (hasMesin || hasBarang) {
                            headerRowIndex = r;
                            break;
                        }
                    }

                    if (headerRowIndex === -1) headerRowIndex = 0;

                    const headerCells = rows2D[headerRowIndex].map(c => String(c || '').toLowerCase().trim());
                    const getCol = (key) => headerCells.findIndex(h => h.includes(key));

                    const colMesin = getCol('mesin') >= 0 ? getCol('mesin') : 1;
                    const colBarang = getCol('barang') >= 0 ? getCol('barang') : 2;
                    const colUkuran = getCol('ukuran') >= 0 ? getCol('ukuran') : 3;
                    const colQty = getCol('qty') >= 0 ? getCol('qty') : 4;
                    const colFinishing = (getCol('finis') >= 0 ? getCol('finis') : 5);

                    const extracted = [];
                    for (let r = headerRowIndex + 1; r < rows2D.length; r++) {
                        const row = rows2D[r];
                        if (!row || row.every(c => String(c || '').trim() === '')) continue;

                        const mesin = String(row[colMesin] || 'Mesin Digital').trim();
                        const namaBarang = String(row[colBarang] || '').trim();
                        const ukuran = String(row[colUkuran] || '-').trim();
                        const qty = String(row[colQty] || '1').trim();
                        const finishing = String(row[colFinishing] || '-').trim();

                        if (!namaBarang && !mesin) continue;

                        const isCikokol = mesin.toUpperCase().includes('SWISSQ') || mesin.toUpperCase().includes('OUTDOOR');
                        const branch = isCikokol ? 'cikokol' : 'pusat';

                        extracted.push({
                            id: `SPK_IMP_${Date.now()}_${extracted.length}`,
                            spkId: `SPK_IMP_${Date.now()}_${extracted.length}`,
                            spkNumber: `SPK-${mesin}-${String(extracted.length + 1).padStart(3, '0')}`,
                            clientName: detectedClientName,
                            customer: detectedClientName,
                            jobTitle: namaBarang || 'Pekerjaan Cetak',
                            namaBarang: namaBarang || 'Pekerjaan Cetak',
                            ukuran: ukuran,
                            qty: qty.toLowerCase().includes('pcs') ? qty : `${qty} Pcs`,
                            finishing: finishing,
                            machine: mesin,
                            machineName: mesin,
                            originBranch: branch,
                            branch: branch,
                            productionBranch: branch,
                            deadline: '17:00 WIB',
                            sourceFile: file.name
                        });
                    }

                    resolve(extracted);
                } catch(err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    // Proses Banyak File SPK (Multi-file & Folder Upload)
    async function processMultipleSPKFiles(fileList) {
        const rawFiles = Array.from(fileList || []);
        const files = rawFiles.filter(f => {
            const name = (f.name || '').toLowerCase();
            return !name.startsWith('~$') && !name.startsWith('.') && (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv'));
        });

        if (files.length === 0) {
            alert("Tidak ada file Excel (.xlsx / .xls) atau .csv SPK yang valid.");
            return;
        }

        if (typeof window.showToast === 'function') {
            window.showToast(`Membaca ${files.length} file SPK...`, "info");
        }

        const allSPK = [];
        for (let i = 0; i < files.length; i++) {
            try {
                const spks = await parseSPKFile(files[i]);
                if (Array.isArray(spks)) {
                    spks.forEach(s => allSPK.push(s));
                }
            } catch (err) {
                console.warn(`Gagal parse file SPK "${files[i].name}":`, err);
            }
        }

        if (allSPK.length === 0) {
            alert("Tidak ada data SPK yang valid terbaca dari file!");
            return;
        }

        currentSPKPreviewList = allSPK;
        renderSPKPreviewTable();

        const modalEl = document.getElementById('modal-spk-import-preview');
        if (modalEl && typeof bootstrap !== 'undefined') {
            const bs = bootstrap.Modal.getOrCreateInstance(modalEl);
            bs.show();
        }

        if (typeof window.showToast === 'function') {
            window.showToast(`✅ Berhasil memuat ${allSPK.length} SPK ke preview!`, "success");
        }
    }

    // Trigger Import File Excel SPK (Bisa 1 atau banyak file)
    function handleSPKExcelImport(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        processMultipleSPKFiles(files).finally(() => {
            event.target.value = '';
        });
    }

    // Trigger Import Folder SPK
    function handleSPKFolderSelected(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        processMultipleSPKFiles(files).finally(() => {
            event.target.value = '';
        });
    }

    // Set Data Contoh ke Preview SPK
    function setSPKPreviewData(sampleList) {
        currentSPKPreviewList = sampleList || [];
        renderSPKPreviewTable();
    }

    // Simpan SPK dari Preview ke Database & Antrian Utama
    function commitSPKImportPreview() {
        if (!currentSPKPreviewList || currentSPKPreviewList.length === 0) {
            alert("Tidak ada data SPK di preview untuk disimpan!");
            return;
        }

        const branchSelects = document.querySelectorAll('.spk-preview-branch-select');
        branchSelects.forEach((sel, idx) => {
            if (currentSPKPreviewList[idx]) {
                currentSPKPreviewList[idx].originBranch = sel.value;
                currentSPKPreviewList[idx].branch = sel.value;
                currentSPKPreviewList[idx].productionBranch = sel.value;
            }
        });

        let savedCount = 0;
        currentSPKPreviewList.forEach(s => {
            const isCikokol = (s.originBranch || s.branch) === 'cikokol';
            const spkItem = {
                spkId: s.spkId || s.spkNumber || `SPK_${Date.now()}_${savedCount}`,
                id: s.id || s.spkNumber || `SPK_${Date.now()}_${savedCount}`,
                spkNumber: s.spkNumber || `SPK-${s.machine || 'WL'}-${savedCount + 1}`,
                clientName: s.clientName || 'WELLEN DM',
                customer: s.customer || s.clientName || 'WELLEN DM',
                jobTitle: s.namaBarang || s.jobTitle || 'Pekerjaan Cetak',
                namaProduk: s.namaBarang || s.jobTitle || 'Pekerjaan Cetak',
                specs: `Size: ${s.ukuran || '-'} | Fin: ${s.finishing || '-'}`,
                qty: s.qty || '1 Pcs',
                machineName: s.machine || s.machineName || 'Mesin Cetak',
                productionBranch: s.originBranch || s.branch,
                branch: s.originBranch || s.branch,
                productionStatus: isCikokol ? "printing" : "received",
                jobReceivedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + " WIB",
                deadlineAt: s.deadline || "17:00 WIB",
                linkedSjId: ""
            };
            spkOrdersList.unshift(spkItem);
            savedCount++;
        });

        try {
            localStorage.setItem('wtrack_spk_orders', JSON.stringify(spkOrdersList.slice(0, 500)));
        } catch(e) {}

        const modalEl = document.getElementById('modal-spk-import-preview');
        if (modalEl && typeof bootstrap !== 'undefined') {
            const bs = bootstrap.Modal.getInstance(modalEl);
            if (bs) bs.hide();
        }

        if (typeof window.showToast === 'function') {
            window.showToast(`✅ Berhasil menyimpan ${savedCount} SPK ke Manajemen SPK!`);
        }

        if (typeof window.switchTab === 'function') {
            window.switchTab('spk');
        } else {
            renderSPKView();
        }
    }

    // Set Lokasi Cabang Produksi Massal di Preview SPK
    function setBulkBranch(targetBranch) {
        const checkboxes = document.querySelectorAll('.spk-preview-row-checkbox:checked');
        if (checkboxes.length === 0) {
            alert("Pilih minimal satu SPK terlebih dahulu!");
            return;
        }
        const normTarget = normalizeBranch(targetBranch);
        checkboxes.forEach(cb => {
            const idx = parseInt(cb.getAttribute('data-index'), 10);
            if (currentSPKPreviewList[idx]) {
                currentSPKPreviewList[idx].originBranch = normTarget;
                currentSPKPreviewList[idx].branch = normTarget;
                currentSPKPreviewList[idx].productionBranch = normTarget;
                const machines = getMachinesForBranch(normTarget);
                currentSPKPreviewList[idx].machineName = machines[0]?.name || 'Digital Print';
                currentSPKPreviewList[idx].machine = currentSPKPreviewList[idx].machineName;
                currentSPKPreviewList[idx].machineId = machines[0]?.id || '';
            }
        });
        renderSPKPreviewTable();
        if (typeof window.showToast === 'function') {
            window.showToast(`${checkboxes.length} SPK diatur untuk Cabang ${normTarget}.`);
        }
    }

    /**
     * Membagi (split) sebuah SPK menjadi beberapa sub-tugas mesin
     */
    function splitSPKItem(list, targetIndex, splits) {
        if (!Array.isArray(list) || targetIndex < 0 || targetIndex >= list.length) {
            throw new Error("Item SPK yang dituju tidak valid");
        }
        if (!Array.isArray(splits) || splits.length < 2) {
            throw new Error("Pembagian SPK membutuhkan minimal 2 bagian");
        }

        const parent = list[targetIndex];
        const rawQtyStr = String(parent.qty || '1').replace(/[^\d.]/g, '');
        const parentQty = parseFloat(rawQtyStr) || 1;

        let totalSplitQty = 0;
        for (const s of splits) {
            const partQty = parseFloat(s.qty);
            if (isNaN(partQty) || partQty <= 0) {
                throw new Error("Kuantitas setiap pecahan SPK harus bernilai positif");
            }
            totalSplitQty += partQty;
        }

        if (Math.abs(totalSplitQty - parentQty) > 0.001) {
            throw new Error(`Jumlah kuantitas pecahan (${totalSplitQty}) tidak sesuai dengan kuantitas awal (${parentQty})`);
        }

        const parentId = parent.spkId || parent.id || `SPK_${Date.now()}_${targetIndex}`;
        const baseSpkNumber = parent.parentSpkNumber || parent.spkNumber || `SPK-${Date.now()}`;
        const totalParts = splits.length;

        const subItems = splits.map((s, idx) => {
            const partLetter = String.fromCharCode(65 + idx);
            return {
                ...parent,
                spkId: `${parentId}_PART_${partLetter}`,
                id: `${parentId}_PART_${partLetter}`,
                spkNumber: `${baseSpkNumber}/${partLetter}`,
                parentSpkId: parentId,
                parentSpkNumber: baseSpkNumber,
                isSplit: true,
                splitPart: partLetter,
                splitTotalParts: totalParts,
                originalQty: parentQty,
                qty: s.qty,
                productionBranch: s.branch || parent.productionBranch || 'DM 2',
                branch: s.branch || parent.branch || 'DM 2',
                originBranch: s.branch || parent.originBranch || 'DM 2',
                machineName: s.machineName || parent.machineName || 'Digital Print',
                machine: s.machineName || parent.machine || 'Digital Print',
                machineId: s.machineId || ''
            };
        });

        list.splice(targetIndex, 1, ...subItems);
        return list;
    }

    /**
     * Mengembalikan sub-tugas hasil split kembali menjadi 1 item utuh
     */
    function revertSplitSPKItem(list, parentSpkId) {
        if (!Array.isArray(list) || !parentSpkId) return list;

        const firstIndex = list.findIndex(item => item.parentSpkId === parentSpkId);
        if (firstIndex === -1) return list;

        const matchingParts = list.filter(item => item.parentSpkId === parentSpkId);
        if (matchingParts.length === 0) return list;

        const firstPart = matchingParts[0];
        const restoredQty = firstPart.originalQty || matchingParts.reduce((acc, p) => acc + (parseFloat(p.qty) || 0), 0);
        const restoredSpkNumber = firstPart.parentSpkNumber || String(firstPart.spkNumber).replace(/\/[A-Z]$/, '');

        const restoredItem = {
            ...firstPart,
            spkId: parentSpkId,
            id: parentSpkId,
            spkNumber: restoredSpkNumber,
            qty: restoredQty,
            isSplit: false
        };
        delete restoredItem.parentSpkId;
        delete restoredItem.parentSpkNumber;
        delete restoredItem.splitPart;
        delete restoredItem.splitTotalParts;
        delete restoredItem.originalQty;

        const indices = [];
        for (let i = 0; i < list.length; i++) {
            if (list[i].parentSpkId === parentSpkId) {
                indices.push(i);
            }
        }

        for (let i = indices.length - 1; i >= 0; i--) {
            list.splice(indices[i], 1);
        }

        list.splice(firstIndex, 0, restoredItem);
        return list;
    }

    /**
     * Menghitung status agregat dari sebuah SPK yang di-split
     */
    function getSPKAggregateStatus(parentSpkId, list) {
        if (!Array.isArray(list) || !parentSpkId) {
            return { status: 'unknown', completedParts: 0, totalParts: 0 };
        }
        const parts = list.filter(item => item.parentSpkId === parentSpkId);
        if (parts.length === 0) {
            const single = list.find(item => (item.spkId === parentSpkId || item.id === parentSpkId));
            const isCompleted = single && (single.productionStatus === 'completed' || single.productionStatus === 'packing');
            return {
                status: isCompleted ? 'completed' : (single?.productionStatus || 'received'),
                completedParts: isCompleted ? 1 : 0,
                totalParts: 1
            };
        }

        const totalParts = parts.length;
        const completedParts = parts.filter(p => p.productionStatus === 'completed' || p.productionStatus === 'packing').length;

        let status = 'received';
        if (completedParts === totalParts) {
            status = 'completed';
        } else if (completedParts > 0 || parts.some(p => p.productionStatus === 'printing' || p.productionStatus === 'finishing')) {
            status = 'partial';
        }

        return {
            status,
            completedParts,
            totalParts,
            parts: parts.map(p => ({
                spkNumber: p.spkNumber,
                splitPart: p.splitPart,
                status: p.productionStatus,
                machineName: p.machineName,
                qty: p.qty
            }))
        };
    }

    /**
     * Format payload unik QR Code untuk lembar kerja SPK
     */
    function generateSPKQRCodePayload(spkItem) {
        if (!spkItem) return '';
        const spkNum = spkItem.spkNumber || spkItem.noSPK || 'SPK';
        const partCode = spkItem.splitPart || (spkItem.isSplit ? 'PART' : 'ALL');
        const machineId = spkItem.machineId || spkItem.machineName || '-';
        return `WTRACK:SPK:${spkNum}:${partCode}:${machineId}`;
    }

    function printWorkOrderSlip(spkId) {
        const spk = spkOrdersList.find(s => (s.spkId === spkId || s.id === spkId || s.spkNumber === spkId));
        if (!spk) return null;
        const payload = generateSPKQRCodePayload(spk);

        if (typeof window === 'undefined' || typeof window.open !== 'function') {
            return payload;
        }

        const printWin = window.open('', '_blank', 'width=650,height=750');
        if (!printWin || !printWin.document) {
            if (typeof window.alert === 'function') {
                window.alert(`Lembar Kerja SPK: ${spk.spkNumber}\nQR Code: ${payload}`);
            }
            return payload;
        }

        printWin.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Lembar Kerja SPK - ${spk.spkNumber}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #1e293b; line-height: 1.4; }
                    .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
                    .title { font-size: 18px; font-weight: 800; color: #0f172a; }
                    .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; background: #e2e8f0; color: #0f172a; }
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
                    .info-box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; }
                    .info-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 2px; }
                    .info-value { font-size: 13.5px; font-weight: 700; color: #0f172a; }
                    .qr-box { border: 2px dashed #94a3b8; border-radius: 12px; padding: 20px; text-align: center; margin-top: 20px; background: #f8fafc; }
                    .qr-text { font-family: monospace; font-size: 13px; font-weight: 600; color: #334155; word-break: break-all; margin-top: 8px; }
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <div class="title">LEMBAR KERJA PRODUKSI WELLEN</div>
                        <div style="font-size: 12px; color: #64748b;">Tiket Kerja Mesin, QC & Packing</div>
                    </div>
                    <div class="badge">${spk.productionBranch || 'DM 2'}</div>
                </div>
                <div class="info-grid">
                    <div class="info-box">
                        <div class="info-label">Nomor SPK</div>
                        <div class="info-value">${spk.spkNumber} ${spk.isSplit ? `<span style="color:#f59e0b;">(Part ${spk.splitPart}/${spk.splitTotalParts})</span>` : ''}</div>
                    </div>
                    <div class="info-box">
                        <div class="info-label">Mesin Produksi</div>
                        <div class="info-value">${spk.machineName || 'Mesin Digital'}</div>
                    </div>
                    <div class="info-box">
                        <div class="info-label">Pelanggan / Klien</div>
                        <div class="info-value">${spk.clientName || spk.customer || '-'}</div>
                    </div>
                    <div class="info-box">
                        <div class="info-label">Target Kuantitas</div>
                        <div class="info-value">${spk.qty} Pcs</div>
                    </div>
                    <div class="info-box" style="grid-column: span 2;">
                        <div class="info-label">Nama Barang / Produk & Ukuran</div>
                        <div class="info-value">${spk.jobTitle || spk.namaProduk || spk.namaBarang || '-'} (${spk.specs || spk.ukuran || '-'})</div>
                    </div>
                    <div class="info-box" style="grid-column: span 2;">
                        <div class="info-label">Instruksi Finishing</div>
                        <div class="info-value">${spk.finishing || 'Sesuai Standar Cetak'}</div>
                    </div>
                </div>
                <div class="qr-box">
                    <div style="font-size: 11px; font-weight: 700; color: #475467; text-transform: uppercase;">QR Code Pelacakan Tablet (QC, Packing & Gudang)</div>
                    <div class="qr-text">${payload}</div>
                </div>
                <div class="no-print" style="margin-top: 24px; text-align: center;">
                    <button onclick="window.print()" style="padding: 8px 24px; font-size: 13px; font-weight: 600; cursor: pointer; border-radius: 6px; background: #0f172a; color: white; border: none;">Cetak Lembar Kerja</button>
                </div>
            </body>
            </html>
        `);
        printWin.document.close();
        return payload;
    }

    // Export API
    const spkAPI = {
        renderSPKView,
        filterSpkBranch,
        updateSPKStatus,
        convertSPKToSuratJalan,
        handleSPKExcelImport,
        handleSPKUpload: handleSPKExcelImport,
        handleSPKFolderSelected,
        renderSPKPreviewTable,
        deleteSPKRow,
        toggleAllSPKPreview,
        updateSPKSelection,
        deleteSelectedSPKRows,
        setBulkBranch,
        setSPKPreviewData,
        commitSPKImportPreview,
        deleteSPKOrder,
        toggleAllMainSPK,
        updateMainSPKSelection,
        deleteSelectedMainSPK,
        splitSPKItem,
        revertSplitSPKItem,
        getSPKAggregateStatus,
        generateSPKQRCodePayload,
        printWorkOrderSlip,
        openSplitModal,
        renderSplitModalParts,
        addSplitPartRow,
        removeSplitPartRow,
        onSplitPartQtyChange,
        onSplitPartBranchChange,
        onSplitPartMachineChange,
        updateSplitValidation,
        applySplit,
        revertSplit,
        onPreviewBranchChange,
        onPreviewMachineChange,
        normalizeBranch,
        getMachinesForBranch
    };

    window.spkManager = spkAPI;
    window.SPKManager = spkAPI;
    window.commitSPKImportPreview = commitSPKImportPreview;

})(typeof window !== 'undefined' ? window : global);
