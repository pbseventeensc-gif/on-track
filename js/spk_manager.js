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
                <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
                    <div>
                        <div class="d-flex align-items-center gap-2">
                            <h4 class="fw-bold mb-0 text-dark">Manajemen SPK Produksi</h4>
                            <span class="badge bg-primary px-2.5 py-1 rounded-pill extra-small" id="spk-header-badge">${spkOrdersList.length} SPK Aktif</span>
                        </div>
                        <p class="text-muted small mb-0 mt-1">
                            Alokasi mesin percetakan Pusat & Cikokol, pantau deadline pengerjaan & 1-klik konversi ke Surat Jalan.
                        </p>
                    </div>
                    <div class="d-flex align-items-center flex-wrap gap-2">
                        <button class="btn btn-light border btn-sm px-2.5 py-2" style="border-radius:10px;" onclick="renderSPKView()" title="Refresh Data">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>
                    </div>
                </div>

                <!-- STATISTIK BADGES & CABANG FILTER -->
                <div class="row g-3 mb-4">
                    <div class="col-md-4">
                        <div class="card border-0 shadow-sm p-3 bg-white h-100" style="border-radius: 14px;">
                            <div class="d-flex align-items-center justify-content-between">
                                <div>
                                    <div class="text-muted extra-small fw-bold text-uppercase">Total SPK Antrian</div>
                                    <h3 class="fw-bold text-dark mt-1 mb-0" id="spk-stat-total">${spkOrdersList.length}</h3>
                                </div>
                                <span class="p-3 rounded-3 bg-primary/10 text-primary fs-4"><i class="bi bi-printer"></i></span>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card border-0 shadow-sm p-3 bg-white h-100" style="border-radius: 14px;">
                            <div class="d-flex align-items-center justify-content-between">
                                <div>
                                    <div class="text-muted extra-small fw-bold text-uppercase">Produksi Kantor Pusat</div>
                                    <h3 class="fw-bold text-primary mt-1 mb-0" id="spk-stat-pusat">0</h3>
                                </div>
                                <span class="p-3 rounded-3 bg-primary/10 text-primary fs-4"><i class="bi bi-building"></i></span>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card border-0 shadow-sm p-3 bg-white h-100" style="border-radius: 14px;">
                            <div class="d-flex align-items-center justify-content-between">
                                <div>
                                    <div class="text-muted extra-small fw-bold text-uppercase">Produksi Cabang Cikokol</div>
                                    <h3 class="fw-bold text-warning mt-1 mb-0" id="spk-stat-cikokol">0</h3>
                                </div>
                                <span class="p-3 rounded-3 bg-warning/10 text-warning fs-4"><i class="bi bi-cpu"></i></span>
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
                                <button class="aerotrack-pill-btn py-1 px-2.5" id="btn-spk-filter-pusat" onclick="window.spkManager.filterSpkBranch('pusat')">Pusat</button>
                                <button class="aerotrack-pill-btn py-1 px-2.5" id="btn-spk-filter-cikokol" onclick="window.spkManager.filterSpkBranch('cikokol')">Cikokol</button>
                            </div>
                            <button class="btn btn-sm btn-outline-danger aerotrack-input py-1 px-2.5" id="btn-spk-main-bulk-delete" style="display: none;" onclick="window.spkManager.deleteSelectedMainSPK()" title="Hapus SPK terpilih">
                                <i class="bi bi-trash me-1"></i> Hapus Terpilih
                            </button>
                        </div>
                        <div class="d-flex align-items-center gap-2">
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
                                    <th style="min-width: 220px;">Nama Barang & Ukuran</th>
                                    <th style="width: 130px;">Qty & Mesin</th>
                                    <th style="width: 150px;">Status Produksi</th>
                                    <th style="width: 120px;" class="text-end">Aksi Konversi</th>
                                    <th style="width: 44px;" class="text-center"><i class="bi bi-trash text-muted"></i></th>
                                </tr>
                            </thead>
                            <tbody id="spk-table-body">
                                <tr><td colspan="9" class="text-center py-5 text-muted">Memuat data SPK...</td></tr>
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
            return item.productionBranch === currentSpkBranchFilter;
        });

        // Update Counter
        const countTotal = spkOrdersList.length;
        const countPusat = spkOrdersList.filter(s => s.productionBranch === 'pusat').length;
        const countCikokol = spkOrdersList.filter(s => s.productionBranch === 'cikokol').length;

        const countTotalEl = document.getElementById('spk-stat-total');
        const countPusatEl = document.getElementById('spk-stat-pusat');
        const countCikokolEl = document.getElementById('spk-stat-cikokol');
        const headerBadge = document.getElementById('spk-header-badge');

        if (countTotalEl) countTotalEl.innerText = countTotal;
        if (countPusatEl) countPusatEl.innerText = countPusat;
        if (countCikokolEl) countCikokolEl.innerText = countCikokol;
        if (headerBadge) headerBadge.innerText = `${countTotal} SPK Aktif`;

        // Update active class on filter buttons
        ['all', 'pusat', 'cikokol'].forEach(b => {
            const btn = document.getElementById(`btn-spk-filter-${b}`);
            if (btn) {
                if (b === currentSpkBranchFilter) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center py-5 text-muted">
                <i class="bi bi-printer fs-2 d-block mb-2 text-muted"></i>
                Tidak ada data SPK untuk filter cabang ini.<br>
                <button class="btn btn-primary btn-sm mt-3 fw-bold" onclick="openSPKImportModal()">
                    <i class="bi bi-file-earmark-excel me-1"></i> Import File SPK Sekarang
                </button>
            </td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map((item, idx) => {
            let statusBadge = '<span class="aerotrack-badge">Antri Cetak</span>';
            if (item.productionStatus === 'printing') statusBadge = '<span class="aerotrack-badge badge-primary"><i class="bi bi-printer-fill me-1"></i>Proses Cetak</span>';
            else if (item.productionStatus === 'finishing') statusBadge = '<span class="aerotrack-badge badge-purple"><i class="bi bi-scissors me-1"></i>Finishing</span>';
            else if (item.productionStatus === 'packing') statusBadge = '<span class="aerotrack-badge badge-warning"><i class="bi bi-box-seam me-1"></i>Packing Selesai</span>';
            else if (item.productionStatus === 'completed') statusBadge = '<span class="aerotrack-badge badge-success"><i class="bi bi-check2-circle me-1"></i>Siap Kirim</span>';

            const isCikokol = (item.productionBranch === 'cikokol');
            const branchBadge = isCikokol
                ? '<span class="aerotrack-badge badge-warning">CIKOKOL</span>'
                : '<span class="aerotrack-badge badge-primary">PUSAT</span>';

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
                        <div class="mt-1">${branchBadge}</div>
                    </td>
                    <td style="min-width: 180px;">
                        <span class="fw-semibold text-dark text-truncate d-inline-block" style="max-width: 200px;" title="${item.clientName || item.customer}">${item.clientName || item.customer}</span>
                        <small class="text-muted extra-small d-block text-truncate" style="max-width: 220px;">${item.jobTitle || item.namaProduk || '-'}</small>
                    </td>
                    <td style="min-width: 220px;">
                        <span class="text-dark font-monospace" style="font-size: 0.78rem;">${item.specs || item.ukuran || '-'}</span>
                        <span class="aerotrack-badge d-inline-block mt-0.5"><i class="bi bi-cpu me-1 text-primary"></i>${item.machineName || 'Digital Print'}</span>
                    </td>
                    <td style="width: 130px;">
                        <span class="aerotrack-num">${item.qty}</span>
                        <small class="text-danger fw-semibold extra-small d-block"><i class="bi bi-clock me-1"></i>${item.deadlineAt || '17:00 WIB'}</small>
                    </td>
                    <td style="width: 150px;">
                        <select class="aerotrack-select py-0 px-2" style="width: 135px; font-size: 0.78rem; height: 32px;" onchange="window.spkManager.updateSPKStatus('${safeId}', this.value)">
                            <option value="received" ${item.productionStatus === 'received' ? 'selected' : ''}>Antri Cetak</option>
                            <option value="printing" ${item.productionStatus === 'printing' ? 'selected' : ''}>Proses Cetak</option>
                            <option value="finishing" ${item.productionStatus === 'finishing' ? 'selected' : ''}>Finishing/Cut</option>
                            <option value="packing" ${item.productionStatus === 'packing' ? 'selected' : ''}>Packing</option>
                            <option value="completed" ${item.productionStatus === 'completed' ? 'selected' : ''}>Selesai (Siap SJ)</option>
                        </select>
                    </td>
                    <td class="text-end" style="width: 120px;">
                        ${convertBtn}
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

    // Update Status Tombol Bulk Delete di View Utama SPK
    function updateMainSPKSelection() {
        const checkedBoxes = document.querySelectorAll('.main-spk-row-checkbox:checked');
        const bulkDelBtn = document.getElementById('btn-spk-main-bulk-delete');
        if (bulkDelBtn) {
            bulkDelBtn.style.display = checkedBoxes.length > 0 ? 'inline-block' : 'none';
            bulkDelBtn.title = `Hapus ${checkedBoxes.length} SPK terpilih`;
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

    // State Preview SPK Import
    let currentSPKPreviewList = [];

    // Render Tabel Preview SPK di Modal
    function renderSPKPreviewTable() {
        const tbody = document.getElementById('spk-import-preview-tbody');
        const countBadge = document.getElementById('spk-import-count-badge');
        const bulkDelBtn = document.getElementById('btn-spk-bulk-delete');
        const checkAll = document.getElementById('check-all-preview-spk');

        if (countBadge) countBadge.innerText = `${currentSPKPreviewList.length} SPK`;

        if (!tbody) return;

        if (currentSPKPreviewList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center py-5 text-muted" style="font-size: 0.8rem;">Belum ada file dipilih. Silakan pilih file Excel SPK di atas.</td></tr>`;
            if (bulkDelBtn) bulkDelBtn.style.display = 'none';
            if (checkAll) checkAll.checked = false;
            return;
        }

        tbody.innerHTML = currentSPKPreviewList.map((s, idx) => `
            <tr>
                <td class="text-center" style="width: 38px;">
                    <input type="checkbox" class="form-check-input spk-preview-row-checkbox" data-index="${idx}" checked onchange="window.spkManager && window.spkManager.updateSPKSelection()">
                </td>
                <td class="text-center aerotrack-num" style="width: 44px;">${idx + 1}</td>
                <td style="width: 140px;">
                    <span class="aerotrack-badge badge-primary">${s.machine || s.machineName || 'Digital Print'}</span>
                </td>
                <td style="min-width: 220px;">
                    <span class="fw-semibold text-dark text-truncate d-inline-block" style="max-width: 240px;" title="${s.namaBarang || s.jobTitle}">${s.namaBarang || s.jobTitle || '-'}</span>
                </td>
                <td style="width: 120px;">
                    <span class="text-muted font-monospace" style="font-size: 0.78rem;">${s.ukuran || '-'}</span>
                </td>
                <td class="text-end" style="width: 80px;">
                    <span class="aerotrack-num">${s.qty || '1 Pcs'}</span>
                </td>
                <td style="width: 140px;">
                    <span class="text-muted extra-small text-truncate d-inline-block" style="max-width: 130px;" title="${s.finishing || ''}">${s.finishing || '-'}</span>
                </td>
                <td style="width: 130px;">
                    <select class="aerotrack-select py-0 px-2 spk-preview-branch-select" data-index="${idx}" style="width: 110px; font-size: 0.78rem; height: 32px;">
                        <option value="pusat" ${(s.originBranch || s.branch || s.productionBranch) === 'pusat' ? 'selected' : ''}>Pusat</option>
                        <option value="cikokol" ${(s.originBranch || s.branch || s.productionBranch) === 'cikokol' ? 'selected' : ''}>Cikokol</option>
                    </select>
                </td>
                <td class="text-center" style="width: 44px;">
                    <button type="button" class="btn btn-sm btn-light border py-1 px-2 text-danger" onclick="window.spkManager && window.spkManager.deleteSPKRow(${idx})" title="Hapus baris ini">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        updateSPKSelection();
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
                specs: `Uk: ${s.ukuran || '-'} | Fin: ${s.finishing || '-'}`,
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
        checkboxes.forEach(cb => {
            const idx = parseInt(cb.getAttribute('data-index'), 10);
            const branchSel = document.querySelector(`.spk-preview-branch-select[data-index="${idx}"]`);
            if (branchSel) branchSel.value = targetBranch;
            if (currentSPKPreviewList[idx]) {
                currentSPKPreviewList[idx].originBranch = targetBranch;
                currentSPKPreviewList[idx].branch = targetBranch;
                currentSPKPreviewList[idx].productionBranch = targetBranch;
            }
        });
        if (typeof window.showToast === 'function') {
            window.showToast(`${checkboxes.length} SPK diatur untuk Cabang ${targetBranch === 'cikokol' ? 'Cikokol' : 'Pusat'}.`);
        }
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
        deleteSelectedMainSPK
    };

    window.spkManager = spkAPI;
    window.SPKManager = spkAPI;
    window.commitSPKImportPreview = commitSPKImportPreview;

})(typeof window !== 'undefined' ? window : global);
