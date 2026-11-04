/**
 * WTRACK UNIFIED SJ POOL & ONE-CLICK REGION DISPATCH CONTROLLER
 * Menghubungkan SJ Import Engine, QR Print Dispatch, Workstation Cikokol, dan SPK Manager.
 * Fitur:
 * 1. Filter Folder Harian (By Tanggal)
 * 2. Region Pills Filter (11 Wilayah Jabodetabek) dengan Counter Badge
 * 3. One-Click Region Dispatch Bar (Pilih Region -> Pilih Driver/Kurir + Armada Mobil -> Auto Assign All)
 * 4. Dual-Mode QR Dispatch (Cetak Lembar Resmi / Stiker Thermal dengan QR & Kode Unik)
 * 5. Dukungan sinkronisasi Firestore & Localhost Mock Database
 */

window.UnifiedPoolUI = (function () {
  let activeDateFolder = 'ALL';
  let activeRegionFilter = 'ALL';
  let activePrintLocationFilter = 'ALL';
  let activeDeliveryStatusFilter = 'ALL'; // 'ALL' or 'PENDING_FAILED'
  let currentSearchQuery = '';

  function init() {
    console.log("UnifiedPoolUI initialized.");
    // Bersihkan cache demo/sample lama dari localStorage
    try {
      const rawStored = localStorage.getItem('wtrack_local_trips');
      if (rawStored) {
        const storedTrips = JSON.parse(rawStored);
        if (Array.isArray(storedTrips)) {
          const cleaned = storedTrips.filter(t => {
            const tid = String(t.id || t.tripId || t.noSJ || '');
            return !tid.startsWith('SJ-DEMO-') && !tid.startsWith('TRIP_') && !tid.startsWith('SJ-821457') && !tid.startsWith('SJ-200008') && !tid.startsWith('SJ-209914') && !tid.startsWith('SJ-796379');
          });
          localStorage.setItem('wtrack_local_trips', JSON.stringify(cleaned));
        }
      }
      localStorage.removeItem('wellen_local_trips');
    } catch (e) {}

    if (Array.isArray(window.allPoolTrips)) {
      window.allPoolTrips = window.allPoolTrips.filter(t => {
        const tid = String(t.id || t.tripId || t.noSJ || '');
        return !tid.startsWith('SJ-DEMO-') && !tid.startsWith('TRIP_') && !tid.startsWith('SJ-821457') && !tid.startsWith('SJ-200008') && !tid.startsWith('SJ-209914') && !tid.startsWith('SJ-796379');
      });
    }

    if (window.mockDatabase && Array.isArray(window.mockDatabase.suratJalanList)) {
      window.mockDatabase.suratJalanList = window.mockDatabase.suratJalanList.filter(t => {
        const tid = String(t.id || t.tripId || t.noSJ || '');
        return !tid.startsWith('SJ-DEMO-') && !tid.startsWith('TRIP_') && !tid.startsWith('SJ-821457') && !tid.startsWith('SJ-200008') && !tid.startsWith('SJ-209914') && !tid.startsWith('SJ-796379');
      });
    }
  }

  function getTripsSource() {
    const combined = [];
    const seenIds = new Set();
    
    // Ambil deletedSet dari localStorage agar permanen tersimpan
    let deletedSet = new Set();
    try {
      const rawDel = localStorage.getItem('wtrack_deleted_pool_ids');
      if (rawDel) {
        const arrDel = JSON.parse(rawDel);
        if (Array.isArray(arrDel)) deletedSet = new Set(arrDel);
      }
    } catch (e) {}
    if (window.__deletedSJIds instanceof Set) {
      window.__deletedSJIds.forEach(id => deletedSet.add(id));
    }
    window.__deletedSJIds = deletedSet;

    function detectRegion(addr = '', name = '') {
      const text = (addr + ' ' + name).toLowerCase();
      if (/tangerang|bsd|serpong|karawaci|banten|cikokol|cipondoh|alam sutera/i.test(text)) return 'Tangerang';
      if (/jakarta pusat|jakpus|gambir|menteng|senen|tanah abang|thamrin|sudirman|kemayoran/i.test(text)) return 'Jakarta Pusat';
      if (/jakarta barat|jakbar|grogol|kembangan|kebon jeruk|tomang|palmerah|cengkareng|kalideres|daan mogot/i.test(text)) return 'Jakarta Barat';
      if (/jakarta selatan|jaksel|kebayoran|scbd|cilandak|tebet|pancoran|pasar minggu|fatmawati|blok m/i.test(text)) return 'Jakarta Selatan';
      if (/jakarta timur|jaktim|jatinegara|cakung|duren sawit|kramat jati|ciracas|rawamangun/i.test(text)) return 'Jakarta Timur';
      if (/jakarta utara|jakut|sunter|kelapa gading|pluit|ancol|tanjung priok|penjaringan/i.test(text)) return 'Jakarta Utara';
      if (/bekasi|cikarang|tambun/i.test(text)) return 'Bekasi';
      if (/depok|sawangan|cinere/i.test(text)) return 'Depok';
      if (/bogor|cibinong|sentul/i.test(text)) return 'Bogor';
      return 'Jakarta Pusat';
    }

    function addTrip(t) {
      if (!t) return;
      const tid = String(t.id || t.tripId || t.noSJ || t.sjNumber);
      if (!tid || seenIds.has(tid) || deletedSet.has(tid)) return;

      // Filter out demo/dummy trip IDs if any linger in cache
      if (tid.startsWith('SJ-DEMO-') || tid.startsWith('TRIP_') || tid.startsWith('SJ-821457') || tid.startsWith('SJ-200008') || tid.startsWith('SJ-209914') || tid.startsWith('SJ-796379')) return;

      const todayStr = new Date().toISOString().split('T')[0];
      const dDate = t.date || t.dateFolder || todayStr;
      const isOld = (dDate < todayStr);
      const dStatus = (t.deliveryStatus || t.status || 'pending').toLowerCase();
      const isFailed = (dStatus === 'failed' || dStatus === 'returned' || dStatus === 'undelivered' || !!t.isFailed || !!t.failedReason || !!t.pendingReason);
      const isAssigned = (dStatus === 'in_progress' || dStatus === 'driver_assigned' || dStatus === 'departed' || (t.assignedTo && !isFailed) || (t.courierId && !isFailed));
      const isCompleted = (dStatus === 'completed' || dStatus === 'done' || dStatus === 'delivered');

      // Tabel Plan Shipment HANYA menampung yang pending, gagal kirim, atau belum di-assign
      if (isCompleted) return;
      if (isAssigned && !isFailed) return;

      seenIds.add(tid);

      const isPendingRollover = isFailed || isOld;

      // Normalisasi field agar aman ditampilkan di antarmuka
      const normalized = {
        id: tid,
        tripId: tid,
        noSJ: t.noSJ || t.sjNumber || tid,
        sjNumber: t.sjNumber || t.noSJ || tid,
        uniqueCode: t.uniqueCode || t.shortCode || 'WK-AUTO',
        shortCode: t.shortCode || t.uniqueCode || 'WK-AUTO',
        customer: t.customer || t.clientName || (t.destinations && t.destinations[0]?.locationName) || 'Klien Wellen',
        clientName: t.clientName || t.customer || (t.destinations && t.destinations[0]?.locationName) || 'Klien Wellen',
        address: t.address || (t.destinations && t.destinations[0]?.address) || '-',
        region: t.region || detectRegion(t.address || (t.destinations && t.destinations[0]?.address) || '', t.customer || t.clientName || ''),
        printLocation: t.printLocation || t.originBranch || 'pusat',
        originBranch: t.originBranch || t.printLocation || 'pusat',
        date: dDate,
        status: isFailed ? 'failed' : 'pending',
        deliveryStatus: isFailed ? 'failed' : 'pending',
        isPendingRollover: !!isPendingRollover,
        isFailed: !!isFailed,
        isRolloverFromYesterday: !!(isOld && !isFailed),
        items: t.items || [{
          nama: (t.destinations && t.destinations[0]?.itemsSummary) || 'Item Cetakan',
          qty: (t.destinations && t.destinations[0]?.qty) || '1'
        }]
      };
      combined.push(normalized);
    }

    // 1. Dari allPoolTrips (trip yang baru diimport/dibuat di sesi ini)
    if (Array.isArray(window.allPoolTrips)) {
      window.allPoolTrips.forEach(addTrip);
    }

    // 2. Dari LocalStorage (wtrack_local_trips hasil import user)
    try {
      const rawStored = localStorage.getItem('wtrack_local_trips');
      if (rawStored) {
        const storedTrips = JSON.parse(rawStored);
        if (Array.isArray(storedTrips)) {
          storedTrips.forEach(addTrip);
        }
      }
    } catch (e) {}

    // Note: window.allCurrentTrips (database riwayat Firebase) dan generateSampleSJData (dummy) SENGAJA TIDAK dimasukkan ke Plan Shipment
    // agar pool benar-benar bersih dan hanya menampung data import real yang siap dikirim.

    return combined;
  }

  function generateSampleSJData() {
    return [];
  }

  function renderUnifiedPoolView() {
    const container = document.getElementById('view-pool');
    if (!container) return;

    const allTrips = getTripsSource();

    // 1. Ekstrak Semua Folder Tanggal
    const dateMap = {};
    allTrips.forEach(t => {
      const d = t.date || (t.createdAt ? t.createdAt.split('T')[0] : 'Tanpa Tanggal');
      dateMap[d] = (dateMap[d] || 0) + 1;
    });
    const sortedDates = Object.keys(dateMap).sort().reverse();

    // 2. Ekstrak Region Counter
    const regions = [
      "Jakarta Pusat", "Jakarta Barat", "Jakarta Timur", "Jakarta Utara", "Jakarta Selatan",
      "Tangerang", "Bekasi", "Depok", "Bogor", "Karawang", "Serang"
    ];
    const regionCounts = {};
    regions.forEach(r => regionCounts[r] = 0);
    let totalPool = 0;
    let totalPending = 0;
    let totalFailed = 0;
    let totalCikokol = 0;
    let totalPusat = 0;

    allTrips.forEach(t => {
      // Hanya hitung yang aktif (pending atau gagal kirim)
      totalPool++;
      if (t.isFailed) {
        totalFailed++;
      } else {
        totalPending++;
      }
      if (regionCounts[t.region] !== undefined) {
        regionCounts[t.region]++;
      }
      if (t.printLocation === 'cikokol') totalCikokol++;
      else totalPusat++;
    });

    // Update badge di pill sub-nav index.html jika ada
    const topPendingBadge = document.getElementById('badge-top-pending-count');
    if (topPendingBadge) {
      topPendingBadge.innerText = totalFailed > 0 ? `${totalPending} / ${totalFailed}` : totalPending;
      topPendingBadge.style.display = totalPool > 0 ? 'inline-block' : 'none';
    }

    // 3. Filter trips sesuai kriteria
    let filtered = allTrips.filter(t => {
      // Exclude jika sudah selesai atau sudah ditugaskan (kecuali gagal kirim)
      if (t.status === 'completed' || t.deliveryStatus === 'completed' || t.status === 'done') return false;
      if ((t.status === 'in_progress' || t.deliveryStatus === 'in_progress' || t.assignedTo || t.courierId) && !t.isFailed) return false;

      // Filter sub-tab Status: Semua, Pending, atau Gagal Kirim
      if (activeDeliveryStatusFilter === 'PENDING') {
        if (t.isFailed) return false;
      } else if (activeDeliveryStatusFilter === 'FAILED' || activeDeliveryStatusFilter === 'PENDING_FAILED') {
        if (!t.isFailed) return false;
      }

      if (activeDateFolder !== 'ALL') {
        const d = t.date || (t.createdAt ? t.createdAt.split('T')[0] : '');
        if (d !== activeDateFolder) return false;
      }
      if (activeRegionFilter !== 'ALL') {
        if (t.region !== activeRegionFilter) return false;
      }
      if (activePrintLocationFilter !== 'ALL') {
        if (t.printLocation !== activePrintLocationFilter) return false;
      }
      if (currentSearchQuery) {
        const q = currentSearchQuery.toLowerCase().trim();
        const idMatch = (t.noSJ || t.sjNumber || t.id || '').toLowerCase().includes(q);
        const custMatch = (t.customer || '').toLowerCase().includes(q);
        const addrMatch = (t.address || '').toLowerCase().includes(q);
        const codeMatch = (t.uniqueCode || '').toLowerCase().includes(q);
        if (!idMatch && !custMatch && !addrMatch && !codeMatch) return false;
      }
      return true;
    });

    // 4. SORTING: Surat Jalan Gagal Kirim & Rollover H-1 selalu MUNCUL PALING ATAS!
    filtered.sort((a, b) => {
      if (a.isFailed && !b.isFailed) return -1;
      if (!a.isFailed && b.isFailed) return 1;
      if (a.isRolloverFromYesterday && !b.isRolloverFromYesterday) return -1;
      if (!a.isRolloverFromYesterday && b.isRolloverFromYesterday) return 1;
      return (b.date || '').localeCompare(a.date || '');
    });

    container.innerHTML = `
      <!-- HEADER (Ringkas tanpa tombol terpisah di atas) -->
      <div class="d-flex align-items-center justify-content-between mb-3">
        <div>
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <h4 class="fw-bold mb-0 text-dark">Plan Shipment</h4>
            <span class="badge bg-primary px-2.5 py-1 rounded-pill extra-small">${totalPool} SJ Aktif</span>
            <span class="badge bg-warning text-dark border border-warning-subtle px-2.5 py-1 rounded-pill extra-small fw-semibold d-inline-flex align-items-center gap-1">
              <i class="bi bi-hourglass-split"></i> ${totalPending} Pending
            </span>
            ${totalFailed > 0 ? `
              <span class="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2.5 py-1 rounded-pill extra-small fw-bold d-inline-flex align-items-center gap-1">
                <i class="bi bi-x-circle-fill"></i> ${totalFailed} Gagal Kirim
              </span>
            ` : ''}
          </div>
          <p class="text-muted small mb-0 mt-1">
            Database Surat Jalan terintegrasi Excel, klasifikasi Region otomatis, penugasan kurir & cetak QR Code resmi.
          </p>
        </div>
      </div>

      <!-- SUB-TABS FILTER: SEMUA SJ VS PENDING VS GAGAL TERKIRIM -->
      <div class="d-flex align-items-center justify-content-between mb-2.5">
        <div class="aerotrack-pill-nav mb-0">
          <button class="aerotrack-pill-btn ${activeDeliveryStatusFilter === 'ALL' ? 'active' : ''}" 
                  type="button" onclick="UnifiedPoolUI.setDeliveryStatusFilter('ALL')">
            <i class="bi bi-box-seam ${activeDeliveryStatusFilter === 'ALL' ? 'text-primary' : ''}"></i> Semua (${totalPool})
          </button>
          <button class="aerotrack-pill-btn ${activeDeliveryStatusFilter === 'PENDING' ? 'active' : ''} text-warning fw-semibold" 
                  type="button" onclick="UnifiedPoolUI.setDeliveryStatusFilter('PENDING')">
            <i class="bi bi-hourglass-split text-warning"></i> Pending (${totalPending})
          </button>
          <button class="aerotrack-pill-btn ${activeDeliveryStatusFilter === 'FAILED' || activeDeliveryStatusFilter === 'PENDING_FAILED' ? 'active' : ''} text-danger fw-semibold" 
                  type="button" onclick="UnifiedPoolUI.setDeliveryStatusFilter('FAILED')">
            <i class="bi bi-x-circle-fill text-danger"></i> Gagal Kirim
            <span class="badge ${totalFailed > 0 ? 'bg-danger text-white' : 'bg-secondary text-white'} rounded-pill ms-1">${totalFailed}</span>
          </button>
        </div>
      </div>

      <!-- TABLE SURAT JALAN POOL (AEROTRACK ERP UI STYLE) -->
      <div class="aerotrack-table-container bg-white shadow-sm mb-4">
        <!-- AeroTrack Filter Bar (Baris 1: Filter & Pencarian + Kalender Tanggal + Tombol Import) -->
        <div class="aerotrack-filter-bar d-flex align-items-center justify-content-between gap-2 border-bottom p-2.5 flex-nowrap overflow-x-auto">
          <div class="d-flex align-items-center gap-1.5 flex-nowrap">
            <input type="text" id="pool-unified-search" class="aerotrack-input" placeholder="Stock ID / No. SJ / Customer..." style="width: 180px; font-size: 0.8rem;" value="${currentSearchQuery}" oninput="UnifiedPoolUI.setSearchQuery(this.value)">
            
            <select class="aerotrack-select" style="min-width: 120px; font-size: 0.8rem;" onchange="UnifiedPoolUI.setRegionFilter(this.value)">
              <option value="ALL" ${activeRegionFilter === 'ALL' ? 'selected' : ''}>Wilayah (${totalPool})</option>
              ${regions.map(r => `<option value="${r}" ${activeRegionFilter === r ? 'selected' : ''}>${r} (${regionCounts[r]})</option>`).join('')}
            </select>

            <!-- Kalender Filter Tanggal -->
            <div class="d-flex align-items-center gap-1" style="position: relative;">
              <input type="date" id="pool-unified-date" class="aerotrack-input" 
                     style="min-width: 130px; height: 32px; font-size: 0.8rem; padding: 2px 8px;" 
                     value="${activeDateFolder !== 'ALL' ? activeDateFolder : ''}" 
                     onchange="UnifiedPoolUI.setDateFolder(this.value || 'ALL')"
                     title="Filter Kalender Tanggal">
              ${activeDateFolder !== 'ALL' ? `
                <button class="btn btn-sm btn-light border py-1 px-2 text-danger aerotrack-input" 
                        onclick="UnifiedPoolUI.setDateFolder('ALL')" 
                        title="Reset Kalender (Tampilkan Semua Tanggal)">
                  <i class="bi bi-x-lg" style="font-size: 0.75rem;"></i>
                </button>
              ` : ''}
            </div>

            <select class="aerotrack-select" style="min-width: 105px; font-size: 0.8rem;" onchange="UnifiedPoolUI.setPrintFilter(this.value)">
              <option value="ALL" ${activePrintLocationFilter === 'ALL' ? 'selected' : ''}>Lokasi</option>
              <option value="pusat" ${activePrintLocationFilter === 'pusat' ? 'selected' : ''}>Pusat (${totalPusat})</option>
              <option value="cikokol" ${activePrintLocationFilter === 'cikokol' ? 'selected' : ''}>Cikokol (${totalCikokol})</option>
            </select>
          </div>

          <div class="d-flex align-items-center gap-1.5 flex-nowrap ms-auto">
            <!-- Button Import SJ Excel / Word -->
            <button class="btn btn-success btn-sm fw-bold px-2.5 py-1.5 aerotrack-input d-flex align-items-center gap-1.5 shadow-sm text-nowrap" 
                    onclick="document.getElementById('sj-excel-file-input').click()"
                    title="Import Surat Jalan dari file Excel (.xlsx) atau Word (.docx / .doc)">
              <i class="bi bi-file-earmark-arrow-up-fill"></i>
              <span>Import SJ</span>
            </button>
            <input type="file" id="sj-excel-file-input" class="d-none" accept=".xlsx, .xls, .csv, .docx, .doc, .rtf" 
                   onchange="window.SJImportEngine && window.SJImportEngine.handleFileUpload(event)">

            <button class="btn btn-light border btn-sm px-2 py-1.5 aerotrack-input" onclick="UnifiedPoolUI.refresh()" title="Muat Ulang Data">
              <i class="bi bi-arrow-clockwise"></i>
            </button>
          </div>
        </div>

        <!-- AeroTrack Action Toolbar (Baris 2: Seleksi, Penugasan Kurir, Cetak, Hapus Terpilih) -->
        <div class="d-flex align-items-center justify-content-between gap-2 px-3 py-2 border-bottom bg-light bg-opacity-50 flex-nowrap overflow-x-auto">
          <div class="d-flex align-items-center gap-2">
            <span class="aerotrack-badge badge-primary py-1 px-2.5 fw-semibold" id="pool-selected-count">0 Surat Jalan dipilih</span>
          </div>

          <div class="d-flex align-items-center gap-2 flex-wrap ms-auto">
            <span class="extra-small text-muted fw-bold text-uppercase d-none d-sm-inline">Tugaskan:</span>
            <select id="pool-bulk-courier" class="aerotrack-select" style="min-width: 175px; max-width: 220px; font-size: 0.8rem;">
              ${UnifiedPoolUI.buildCourierOptionsHtml()}
            </select>
            <button class="btn btn-sm btn-primary aerotrack-input fw-semibold px-3 py-1.5 d-flex align-items-center gap-1 shadow-sm" 
                    onclick="UnifiedPoolUI.assignSelectedToCourier()" title="Tugaskan Surat Jalan Terpilih">
              <i class="bi bi-send-check"></i>
              <span>Tugaskan</span>
            </button>

            <button class="btn btn-sm btn-outline-primary aerotrack-input fw-semibold px-2.5 py-1.5 d-flex align-items-center gap-1" 
                    onclick="UnifiedPoolUI.printSelectedSuratJalan()" title="Cetak Surat Jalan yang dipilih">
              <i class="bi bi-printer"></i>
              <span>Cetak</span>
            </button>

            <button class="btn btn-sm btn-outline-danger aerotrack-input px-2.5 py-1.5" 
                    onclick="UnifiedPoolUI.deleteSelectedPool()" title="Hapus Surat Jalan Terpilih">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table aerotrack-table align-middle mb-0 text-nowrap">
            <thead>
              <tr>
                <th style="width: 38px;" class="text-center">
                  <input type="checkbox" class="form-check-input" id="select-all-pool" onchange="UnifiedPoolUI.toggleAllCheckbox(this)">
                </th>
                <th style="width: 135px;">No. Surat Jalan</th>
                <th style="width: 85px;">Kode Unik</th>
                <th style="width: 105px;">Tanggal</th>
                <th style="min-width: 170px; max-width: 250px;">Customer & Item</th>
                <th style="min-width: 200px; max-width: 300px;">Alamat Kirim</th>
                <th style="width: 110px;">Wilayah</th>
                <th style="width: 110px;" class="text-center">Status</th>
                <th style="width: 90px;" class="text-center">Print</th>
                <th style="width: 110px;" class="text-end">Aksi</th>
              </tr>
            </thead>
            <tbody id="pool-table-body">
              ${filtered.length === 0 ? `
                <tr><td colspan="10" class="text-center py-5 text-muted" style="font-size: 0.85rem;">
                  <i class="bi bi-inbox fs-2 d-block mb-2 text-muted"></i>
                  Belum ada Surat Jalan di pool untuk kriteria ini.<br>
                  <button class="btn btn-outline-success btn-sm mt-3 fw-bold aerotrack-input" onclick="document.getElementById('sj-excel-file-input').click()">
                    <i class="bi bi-file-earmark-arrow-up me-1"></i> Import Excel / Word Surat Jalan Sekarang
                  </button>
                </td></tr>
              ` : filtered.map(t => renderTableRow(t)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    updateSelectionCount();
    if (window.lucide) lucide.createIcons();
  }

  function renderTableRow(t) {
    const isCikokol = (t.printLocation || '').toLowerCase() === 'cikokol';
    const locBadge = isCikokol
      ? `<span class="aerotrack-badge badge-warning">Cikokol</span>`
      : `<span class="aerotrack-badge badge-primary">Pusat</span>`;

    const branchState = t.branchStatus 
      ? `<span class="aerotrack-badge extra-small">${t.branchStatus}</span>` 
      : '';

    const firstItem = (t.items && t.items[0]) ? `${t.items[0].nama} (${t.items[0].qty} ${t.items[0].satuan || ''})` : (t.itemDescription || 'Barang Cetakan');
    const displayId = t.noSJ || t.sjNumber || t.id;

    // Row Background Styling
    let rowBgStyle = '';
    if (t.isFailed) {
      rowBgStyle = 'style="background-color: #fff1f2;"';
    } else if (t.isRolloverFromYesterday) {
      rowBgStyle = 'style="background-color: #fffbeb;"';
    }

    return `
      <tr ${rowBgStyle}>
        <td class="text-center" style="width: 38px;">
          <input type="checkbox" class="form-check-input pool-checkbox" value="${t.id}" onchange="UnifiedPoolUI.updateSelectionCount()">
        </td>
        <td style="width: 135px;">
          <a class="aerotrack-id-link font-monospace fw-bold" onclick="UnifiedPoolUI.quickPreviewQR('${t.id}')" title="Klik untuk lihat QR Code">${displayId}</a>
        </td>
        <td style="width: 85px;">
          <span class="aerotrack-badge font-monospace">${t.uniqueCode || 'WK-AUTO'}</span>
        </td>
        <td style="width: 105px;">
          <div class="font-monospace text-dark extra-small fw-semibold d-flex align-items-center gap-1">
            <i class="bi bi-calendar3 text-muted"></i>
            <span>${t.date || '-'}</span>
          </div>
        </td>
        <td style="min-width: 170px; max-width: 250px;">
          <div class="fw-semibold text-dark" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.3; white-space: normal; word-break: break-word;" title="${t.customer || '-'}">${t.customer || '-'}</div>
          <small class="text-muted extra-small d-block text-truncate mt-0.5" style="max-width: 240px;">${firstItem}</small>
        </td>
        <td style="min-width: 200px; max-width: 300px;">
          <div class="text-muted" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.35; font-size: 0.825rem; white-space: normal; word-break: break-word;" title="${t.address || '-'}">
            ${t.address || '-'}
          </div>
        </td>
        <td style="width: 110px;">
          <span class="aerotrack-badge badge-primary">${t.region || 'Jabodetabek'}</span>
        </td>
        <td class="text-center" style="width: 110px;">
          ${t.isFailed ? `
            <span class="badge bg-danger text-white extra-small fw-semibold px-2 py-1 d-inline-flex align-items-center gap-1 shadow-xs">
              <i class="bi bi-x-circle-fill"></i> Gagal Kirim
            </span>
          ` : `
            <span class="badge bg-warning text-dark border border-warning-subtle extra-small fw-semibold px-2 py-1 d-inline-flex align-items-center gap-1">
              <i class="bi bi-hourglass-split"></i> Pending
            </span>
          `}
        </td>
        <td class="text-center" style="width: 90px;">
          ${locBadge}
          ${branchState ? `<div class="mt-1">${branchState}</div>` : ''}
        </td>
        <td class="text-end" style="width: 110px;">
          <div class="d-flex align-items-center justify-content-end gap-1">
            ${(t.printLocation === 'cikokol' || t.originBranch === 'cikokol') ? `
            <button class="btn btn-sm btn-light border py-1 px-2 text-dark aerotrack-input" onclick="UnifiedPoolUI.printSingleSJ('${t.id}')" title="Cetak Surat Jalan (Cikokol)">
              <i class="bi bi-printer text-primary"></i>
            </button>
            ` : `
            <button class="btn btn-sm btn-light border py-1 px-2 text-dark aerotrack-input" onclick="UnifiedPoolUI.printSingleSJ('${t.id}')" title="Pratinjau Surat Jalan (Pusat - Hanya Preview)">
              <i class="bi bi-eye text-primary"></i>
            </button>
            `}
            <button class="btn btn-sm btn-light border py-1 px-2 text-danger aerotrack-input" onclick="UnifiedPoolUI.deleteSingleSJ('${t.id}')" title="Hapus Surat Jalan ini">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  // 22 Master Fleet Couriers & Drivers
  const OFFICIAL_MASTER_COURIERS = [
    // Kurir Motor (12 Personil)
    { canonicalId: 'ahmad', displayName: 'Ahmad', role: 'kurir', vehicleType: 'motor', defaultUid: '9dhFtf5QTQW8zmb8cZW5YFgZfmH3' },
    { canonicalId: 'beto', displayName: 'Beto', role: 'kurir', vehicleType: 'motor', defaultUid: 'l6fLsN7ijQdq5m2tcUs2xpmMFv63' },
    { canonicalId: 'eri', displayName: 'Eri', role: 'kurir', vehicleType: 'motor', defaultUid: 'CkRWbGxehCfVOi4iMWvnm66W9NM2' },
    { canonicalId: 'irfan', displayName: 'Irfan', role: 'kurir', vehicleType: 'motor', defaultUid: 'gQyw0Ot9pWY9DuWugNK7IpwaM352' },
    { canonicalId: 'baihaqi', displayName: 'Baihaqi', role: 'kurir', vehicleType: 'motor', defaultUid: 'xONhqVSNSYcEcGCZyW2cLGJWQt92' },
    { canonicalId: 'haris', displayName: 'Haris', role: 'kurir', vehicleType: 'motor', defaultUid: 'uWA0dLFxj0MsGe3YXHuvHjg1GZs1' },
    { canonicalId: 'umar', displayName: 'Umar', role: 'kurir', vehicleType: 'motor', defaultUid: 'eRg9WzDaEgPPl6jcEzo0ERYNyI82' },
    { canonicalId: 'noval', displayName: 'Noval', role: 'kurir', vehicleType: 'motor', defaultUid: 'D9hmxHZ2SJa2BgZN8DO2cT6lgGh1' },
    { canonicalId: 'jay', displayName: 'Jay', role: 'kurir', vehicleType: 'motor', defaultUid: 'XFAoplNpgjc0QzqE6gcTIa5OA0r2' },
    { canonicalId: 'ferdi', displayName: 'Ferdi', role: 'kurir', vehicleType: 'motor', defaultUid: 'BOMM2Wmk9LXs90qO3RWskGyIOk72' },
    { canonicalId: 'jagat', displayName: 'Jagatbaru', role: 'kurir', vehicleType: 'motor', defaultUid: 'kwpGbShXoog9kFiRmevZpwTgVxv2' },
    { canonicalId: 'pbseventeensc', displayName: 'pbseventeensc', role: 'kurir', vehicleType: 'motor', defaultUid: 'uP70R51x7CbR5ggHEyeXfsjSTfO2' },

    // Driver Mobil / Truk (10 Personil)
    { canonicalId: 'altur', displayName: 'Altur', role: 'driver', vehicleType: 'mobil', defaultUid: 'U7A5dYrb4iZaB7VaWMqorLeqqgg2' },
    { canonicalId: 'rizki', displayName: 'Rizki', role: 'driver', vehicleType: 'mobil', defaultUid: 'gz9F6MqupoXEFTpOTJJ1aFjtSD52' },
    { canonicalId: 'soleh', displayName: 'Soleh', role: 'driver', vehicleType: 'mobil', defaultUid: 'G1g9fwjcLSclVmg77ZfrVfT9dzY2' },
    { canonicalId: 'romi', displayName: 'Romi', role: 'driver', vehicleType: 'mobil', defaultUid: 'oC2EvdhruFMaKC10jmMUyYbmdtp1' },
    { canonicalId: 'firdaus', displayName: 'Firdaus', role: 'driver', vehicleType: 'mobil', defaultUid: 'KgKbQdpUHmcQzu2o8N6czx0N7EP2' },
    { canonicalId: 'alan', displayName: 'Alan', role: 'driver', vehicleType: 'mobil', defaultUid: 'unNGSiqnOifJSXyQDRiiqlWd83q2' },
    { canonicalId: 'yakub', displayName: 'Yakub', role: 'driver', vehicleType: 'mobil', defaultUid: '17zXKPw8SFXDhW6Z6lc547R4TEE2' },
    { canonicalId: 'iwan', displayName: 'Iwan', role: 'driver', vehicleType: 'mobil', defaultUid: 'J3wejohLG5dXbX0im5ozeGzpjzt2' },
    { canonicalId: 'agung', displayName: 'Agung', role: 'driver', vehicleType: 'mobil', defaultUid: 'RLLeIifIbmVj1HHKALY40n1lKRr1' },
    { canonicalId: 'husen', displayName: 'Husen', role: 'driver', vehicleType: 'mobil', defaultUid: 'juHUuOWS4FOVpHxE59t4xf0ld1z1' }
  ];

  function buildCourierOptionsHtml() {
    let sourceList = OFFICIAL_MASTER_COURIERS;
    if (typeof MASTER_COURIERS !== 'undefined' && Array.isArray(MASTER_COURIERS) && MASTER_COURIERS.length > 0) {
      sourceList = MASTER_COURIERS;
    } else if (window.MASTER_COURIERS && Array.isArray(window.MASTER_COURIERS) && window.MASTER_COURIERS.length > 0) {
      sourceList = window.MASTER_COURIERS;
    }

    const parseEntry = (c) => {
      if (!c) return null;
      if (typeof c === 'string') {
        const found = OFFICIAL_MASTER_COURIERS.find(m => 
          m.canonicalId.toLowerCase() === c.toLowerCase() || 
          m.displayName.toLowerCase() === c.toLowerCase() ||
          m.defaultUid === c
        );
        if (found) return found;

        if (typeof window.normalizeCourierIdentity === 'function') {
          const norm = window.normalizeCourierIdentity(c);
          if (norm && norm.displayName && norm.displayName !== 'undefined') {
            return {
              canonicalId: norm.canonicalId || c,
              displayName: norm.displayName,
              defaultUid: norm.uid || norm.defaultUid || c,
              role: norm.role || 'kurir',
              vehicleType: norm.vehicleType || 'motor'
            };
          }
        }
        const isMob = c.toLowerCase().includes('driver') || c.toLowerCase().includes('truk') || c.toLowerCase().includes('granmax');
        return {
          canonicalId: c.toLowerCase(),
          displayName: c.charAt(0).toUpperCase() + c.slice(1),
          defaultUid: c,
          role: isMob ? 'driver' : 'kurir',
          vehicleType: isMob ? 'mobil' : 'motor'
        };
      }

      // If c is an object:
      let name = c.displayName || c.name || c.fullName || c.courierName || c.label || '';
      if (!name || name === 'undefined') {
        const found = OFFICIAL_MASTER_COURIERS.find(m => 
          (c.canonicalId && m.canonicalId.toLowerCase() === c.canonicalId.toLowerCase()) || 
          (c.defaultUid && m.defaultUid === c.defaultUid) ||
          (c.id && (m.defaultUid === c.id || m.canonicalId === c.id))
        );
        if (found) return found;

        if (typeof window.normalizeCourierIdentity === 'function') {
          const norm = window.normalizeCourierIdentity(c.canonicalId || c.defaultUid || c.id || '');
          if (norm && norm.displayName && norm.displayName !== 'undefined') {
            name = norm.displayName;
          }
        }
      }

      if (!name || name === 'undefined') {
        name = c.canonicalId || c.defaultUid || c.id || 'Kurir';
      }

      const role = c.role || (c.vehicleType === 'mobil' ? 'driver' : 'kurir');
      const vehicleType = c.vehicleType || (role === 'driver' ? 'mobil' : 'motor');
      const canonicalId = c.canonicalId || c.id || c.defaultUid || name;
      const defaultUid = c.defaultUid || c.uid || c.id || canonicalId;

      return {
        canonicalId,
        displayName: name,
        defaultUid,
        role,
        vehicleType
      };
    };

    const parsed = sourceList.map(parseEntry).filter(Boolean);
    const motors = parsed.filter(c => c.role === 'kurir' || c.vehicleType === 'motor');
    const cars = parsed.filter(c => c.role === 'driver' || c.vehicleType === 'mobil');

    const renderOpt = c => {
      const val = c.defaultUid || c.canonicalId;
      const label = (c.displayName && c.displayName !== 'undefined') ? c.displayName : (c.canonicalId || 'Kurir');
      const isMob = (c.vehicleType === 'mobil' || c.role === 'driver');
      return `<option value="${val}" data-type="${isMob ? 'mobil' : 'motor'}" class="text-dark">${label}</option>`;
    };

    return `
      <option value="" class="text-dark">-- Pilih Kurir Motor atau Driver Mobil --</option>
      <optgroup label="🛵 Kurir Motor (${motors.length} Personil)" class="text-dark">
        ${motors.map(renderOpt).join('')}
      </optgroup>
      <optgroup label="🚚 Driver Mobil / Truk (${cars.length} Personil)" class="text-dark">
        ${cars.map(renderOpt).join('')}
      </optgroup>
    `;
  }

  function onCourierSelectionChange(val) {
    const sel = document.getElementById('quick-dispatch-courier');
    const opt = sel ? sel.options[sel.selectedIndex] : null;
    const isMobil = opt && (opt.getAttribute('data-type') === 'mobil' || opt.text.includes('Granmax') || opt.text.includes('Truk'));
    const box = document.getElementById('quick-dispatch-vehicle-box');
    if (box) {
      if (isMobil) {
        box.classList.remove('opacity-50');
      } else {
        box.classList.add('opacity-50');
      }
    }
  }

  function executeQuickDispatch() {
    const region = document.getElementById('quick-dispatch-region')?.value;
    const courierSelect = document.getElementById('quick-dispatch-courier');
    const courierVal = courierSelect?.value;
    const courierName = courierSelect?.options[courierSelect.selectedIndex]?.text;
    const vehicle = document.getElementById('quick-dispatch-vehicle')?.value;

    if (!region) {
      alert("Pilih Region terlebih dahulu!");
      return;
    }
    if (!courierVal) {
      alert("Pilih Kurir atau Driver penerima tugas!");
      return;
    }

    const trips = getTripsSource();
    const targetTrips = trips.filter(t => t.status !== 'completed' && t.region === region);

    if (targetTrips.length === 0) {
      alert(`Tidak ada Surat Jalan di penampungan untuk wilayah ${region}.`);
      return;
    }

    const confirmMsg = `Tugaskan SEMUA (${targetTrips.length}) Surat Jalan di Region "${region}" kepada:\n` +
      `👤 ${courierName}` + (vehicle ? `\n🚚 Armada: ${vehicle}` : '') + `\n\nLanjutkan?`;

    if (!confirm(confirmMsg)) return;

    // Eksekusi penugasan
    targetTrips.forEach(t => {
      t.status = 'in_progress';
      t.assignedTo = courierName;
      t.courierId = courierVal;
      if (vehicle) t.vehiclePlate = vehicle;
      t.assignedAt = new Date().toISOString();
    });

    try {
      localStorage.setItem('wtrack_local_trips', JSON.stringify(trips.slice(0, 500)));
    } catch(e) {}

    if (window.showToast) {
      window.showToast(`Berhasil menugaskan ${targetTrips.length} Surat Jalan di wilayah ${region} ke ${courierName}!`, 'success');
    } else {
      alert(`Berhasil menugaskan ${targetTrips.length} Surat Jalan di wilayah ${region}!`);
    }

    renderUnifiedPoolView();
  }

  function setDateFolder(date) {
    activeDateFolder = date;
    renderUnifiedPoolView();
  }

  function setRegionFilter(region) {
    activeRegionFilter = region;
    const sel = document.getElementById('quick-dispatch-region');
    if (sel && region !== 'ALL') sel.value = region;
    renderUnifiedPoolView();
  }

  function setPrintFilter(loc) {
    activePrintLocationFilter = loc;
    renderUnifiedPoolView();
  }

  function toggleAllCheckbox(source) {
    document.querySelectorAll('.pool-checkbox').forEach(cb => cb.checked = source.checked);
    updateSelectionCount();
  }

  function updateSelectionCount() {
    const checked = document.querySelectorAll('.pool-checkbox:checked').length;
    const countEl = document.getElementById('pool-selected-count');
    if (countEl) {
      countEl.innerText = `${checked} Surat Jalan dipilih`;
    }
  }

  function printSingleSJ(id) {
    const trips = getTripsSource();
    const t = trips.find(x => x.id === id);
    if (!t) return;
    if (window.QRPrintDispatch) {
      window.QRPrintDispatch.printDeliverySheet([t]);
    } else {
      window.print();
    }
  }

  function printBatchCurrentView() {
    const trips = getTripsSource();
    let filtered = trips.filter(t => {
      if (t.status === 'completed') return false;
      if (activeDateFolder !== 'ALL' && (t.date || t.createdAt?.split('T')[0]) !== activeDateFolder) return false;
      if (activeRegionFilter !== 'ALL' && t.region !== activeRegionFilter) return false;
      if (activePrintLocationFilter !== 'ALL' && t.printLocation !== activePrintLocationFilter) return false;
      return true;
    });

    if (filtered.length === 0) {
      alert("Tidak ada Surat Jalan untuk dicetak pada tampilan ini.");
      return;
    }

    if (window.QRPrintDispatch) {
      window.QRPrintDispatch.printDeliverySheet(filtered);
    }
  }

  function assignSelectedToCourier() {
    const courierSelect = document.getElementById('pool-bulk-courier');
    const courierVal = courierSelect?.value;
    const courierName = courierSelect?.options[courierSelect.selectedIndex]?.text || "Kurir Lapangan";

    if (!courierVal) {
      alert("Silakan pilih Kurir Motor atau Driver terlebih dahulu!");
      return;
    }

    const checked = Array.from(document.querySelectorAll('.pool-checkbox:checked')).map(cb => cb.value);
    if (checked.length === 0) {
      alert("Pilih minimal 1 Surat Jalan dengan mencentang kotak centang (checkbox) untuk ditugaskan!");
      return;
    }

    const trips = getTripsSource();
    const targetTrips = trips.filter(t => checked.includes(String(t.id)));

    if (targetTrips.length === 0) {
      alert("Surat Jalan terpilih tidak ditemukan.");
      return;
    }

    targetTrips.forEach(t => {
      t.status = 'in_progress';
      t.deliveryStatus = 'in_progress';
      t.assignedTo = courierName;
      t.courierId = courierVal;
      t.assignedAt = new Date().toISOString();
      t.isPendingRollover = false;
      t.isFailed = false;
    });

    // Update juga di window.allPoolTrips jika ada
    if (Array.isArray(window.allPoolTrips)) {
      window.allPoolTrips.forEach(pt => {
        const pid = String(pt.id || pt.tripId);
        if (checked.includes(pid)) {
          pt.status = 'in_progress';
          pt.deliveryStatus = 'in_progress';
          pt.assignedTo = courierName;
          pt.courierId = courierVal;
        }
      });
    }

    // Update juga di window.allCurrentTrips jika ada
    if (Array.isArray(window.allCurrentTrips)) {
      window.allCurrentTrips.forEach(rt => {
        const rootId = String(rt.id);
        const hasMatchedDest = checked.some(cId => cId === rootId || cId.startsWith(rootId + '_D'));
        if (hasMatchedDest) {
          rt.status = 'in_progress';
          rt.courierId = courierVal;
          rt.courierName = courierName;
          if (Array.isArray(rt.destinations)) {
            rt.destinations.forEach(d => {
              d.status = 'in_progress';
              delete d.pendingReason;
            });
          }
        }
      });
    }

    // Sinkronisasi ke Firestore agar terbaca langsung di APK Android Kurir
    const activeDb = (typeof getDb === 'function' ? getDb() : window.db);
    if (activeDb && typeof firebase !== 'undefined' && firebase.firestore) {
      targetTrips.forEach(t => {
        const rootTripId = t.tripId || t.id.split('_D')[0];
        try {
          activeDb.collection('trips').doc(rootTripId).set({
            tripId: rootTripId,
            sjNumber: t.sjNumber || t.noSJ,
            shortCode: t.shortCode || t.uniqueCode,
            uniqueCode: t.uniqueCode || t.shortCode,
            courierId: courierVal,
            courierName: courierName,
            status: 'in_progress',
            date: firebase.firestore.Timestamp.now(),
            acceptedTime: firebase.firestore.Timestamp.now(),
            destinations: [{
              stopIndex: 1,
              locationName: t.customer || t.clientName || 'Klien Wellen',
              address: t.address || '-',
              status: 'in_progress',
              sjNumber: t.sjNumber || t.noSJ,
              shortCode: t.shortCode || t.uniqueCode,
              itemsSummary: t.items && t.items[0] ? t.items[0].nama : 'Item Cetakan',
              qty: t.items && t.items[0] ? String(t.items[0].qty) : '1'
            }]
          }, { merge: true }).catch(err => console.warn("Firestore sync error:", err));
        } catch (e) {
          console.warn("Firestore assignment exception:", e);
        }
      });
    }

    try {
      localStorage.setItem('wtrack_local_trips', JSON.stringify(trips.slice(0, 500)));
    } catch(e) {}

    if (window.showToast) {
      window.showToast(`Berhasil menugaskan ${targetTrips.length} Surat Jalan ke ${courierName}! Surat Jalan berpindah ke Pengantaran Aktif.`, 'success');
    } else {
      alert(`Berhasil menugaskan ${targetTrips.length} Surat Jalan ke ${courierName}!`);
    }

    renderUnifiedPoolView();
    if (typeof window.renderRecentShipments === 'function') window.renderRecentShipments();
    if (typeof window.updateGlobalStats === 'function') window.updateGlobalStats();
  }

  function printSelectedSuratJalan() {
    const checked = Array.from(document.querySelectorAll('.pool-checkbox:checked')).map(cb => cb.value);
    if (checked.length === 0) {
      alert("Pilih minimal 1 Surat Jalan dengan mencentang checkbox terlebih dahulu!");
      return;
    }

    const trips = getTripsSource().filter(t => checked.includes(t.id));
    if (window.QRPrintDispatch) {
      window.QRPrintDispatch.printDeliverySheet(trips);
    }
  }

  function deleteSelectedPool() {
    const checked = Array.from(document.querySelectorAll('.pool-checkbox:checked')).map(cb => cb.value);
    if (checked.length === 0) {
      alert("Pilih minimal 1 Surat Jalan dengan mencentang kotak centang (checkbox) untuk dihapus!");
      return;
    }

    if (!confirm(`Hapus ${checked.length} Surat Jalan terpilih dari Plan Shipment? Tindakan ini tidak dapat dibatalkan.`)) return;

    const checkedSet = new Set(checked);
    window.__deletedSJIds = window.__deletedSJIds || new Set();
    checked.forEach(id => window.__deletedSJIds.add(String(id)));

    // Simpan ke localStorage agar permanen tersimpan
    try {
      localStorage.setItem('wtrack_deleted_pool_ids', JSON.stringify(Array.from(window.__deletedSJIds)));
    } catch (e) {}

    // 1. Hapus dari window.allPoolTrips
    if (Array.isArray(window.allPoolTrips)) {
      window.allPoolTrips = window.allPoolTrips.filter(t => !checkedSet.has(String(t.id || t.tripId || t.noSJ || t.sjNumber)));
    }

    // 2. Hapus dari localStorage wtrack_local_trips
    try {
      const rawStored = localStorage.getItem('wtrack_local_trips');
      if (rawStored) {
        const storedTrips = JSON.parse(rawStored);
        if (Array.isArray(storedTrips)) {
          const updated = storedTrips.filter(t => !checkedSet.has(String(t.id || t.tripId || t.noSJ || t.sjNumber)));
          localStorage.setItem('wtrack_local_trips', JSON.stringify(updated));
        }
      }
    } catch (e) {}

    // 3. Hapus dari localStorage wellen_local_trips
    try {
      const rawStored2 = localStorage.getItem('wellen_local_trips');
      if (rawStored2) {
        const storedTrips2 = JSON.parse(rawStored2);
        if (Array.isArray(storedTrips2)) {
          const updated2 = storedTrips2.filter(t => !checkedSet.has(String(t.id || t.tripId || t.noSJ || t.sjNumber)));
          localStorage.setItem('wellen_local_trips', JSON.stringify(updated2));
        }
      }
    } catch (e) {}

    // 4. Hapus dari window.mockDatabase.suratJalanList
    if (window.mockDatabase && Array.isArray(window.mockDatabase.suratJalanList)) {
      window.mockDatabase.suratJalanList = window.mockDatabase.suratJalanList.filter(t => !checkedSet.has(String(t.id || t.tripId || t.noSJ || t.sjNumber)));
    }

    if (typeof window.showToast === 'function') {
      window.showToast(`Berhasil menghapus ${checked.length} Surat Jalan dari Plan Shipment!`, 'info');
    }

    renderUnifiedPoolView();
    if (typeof window.updateGlobalStats === 'function') window.updateGlobalStats();
  }

  function deleteSingleSJ(id) {
    if (!id) return;
    const trips = getTripsSource();
    const t = trips.find(x => String(x.id || x.tripId || x.noSJ || x.sjNumber) === String(id));
    const label = t ? (t.noSJ || t.sjNumber || t.id) : id;

    if (!confirm(`Hapus Surat Jalan "${label}" dari Plan Shipment? Tindakan ini tidak dapat dibatalkan.`)) return;

    const targetId = String(id);
    window.__deletedSJIds = window.__deletedSJIds || new Set();
    window.__deletedSJIds.add(targetId);

    // Simpan ke localStorage agar permanen tersimpan
    try {
      localStorage.setItem('wtrack_deleted_pool_ids', JSON.stringify(Array.from(window.__deletedSJIds)));
    } catch (e) {}

    if (Array.isArray(window.allPoolTrips)) {
      window.allPoolTrips = window.allPoolTrips.filter(x => String(x.id || x.tripId || x.noSJ || x.sjNumber) !== targetId);
    }

    try {
      const rawStored = localStorage.getItem('wtrack_local_trips');
      if (rawStored) {
        const storedTrips = JSON.parse(rawStored);
        if (Array.isArray(storedTrips)) {
          const updated = storedTrips.filter(x => String(x.id || x.tripId || x.noSJ || x.sjNumber) !== targetId);
          localStorage.setItem('wtrack_local_trips', JSON.stringify(updated));
        }
      }
    } catch (e) {}

    try {
      const rawStored2 = localStorage.getItem('wellen_local_trips');
      if (rawStored2) {
        const storedTrips2 = JSON.parse(rawStored2);
        if (Array.isArray(storedTrips2)) {
          const updated2 = storedTrips2.filter(x => String(x.id || x.tripId || x.noSJ || x.sjNumber) !== targetId);
          localStorage.setItem('wellen_local_trips', JSON.stringify(updated2));
        }
      }
    } catch (e) {}

    if (window.mockDatabase && Array.isArray(window.mockDatabase.suratJalanList)) {
      window.mockDatabase.suratJalanList = window.mockDatabase.suratJalanList.filter(x => String(x.id || x.tripId || x.noSJ || x.sjNumber) !== targetId);
    }

    if (typeof window.showToast === 'function') {
      window.showToast(`Surat Jalan ${label} berhasil dihapus!`, 'info');
    }

    renderUnifiedPoolView();
    if (typeof window.updateGlobalStats === 'function') window.updateGlobalStats();
  }

  function clearAllPlanShipments() {
    if (!confirm("Bersihkan seluruh data Surat Jalan di Plan Shipment?")) return;
    window.allPoolTrips = [];
    try {
      localStorage.removeItem('wtrack_local_trips');
      localStorage.removeItem('wellen_local_trips');
    } catch (e) {}
    if (window.mockDatabase) window.mockDatabase.suratJalanList = [];
    renderUnifiedPoolView();
    if (typeof window.showToast === 'function') {
      window.showToast("Plan Shipment telah dibersihkan sepenuhnya.", "info");
    }
  }

  function quickAssignSingle(id) {
    const courierSelect = document.getElementById('pool-bulk-courier');
    let courierVal = courierSelect?.value;
    let courierName = courierSelect?.options[courierSelect.selectedIndex]?.text;

    if (!courierVal) {
      alert("Silakan pilih Kurir Motor / Driver Mobil pada dropdown di toolbar terlebih dahulu, lalu klik tombol Tugaskan ini.");
      courierSelect?.focus();
      return;
    }

    const trips = getTripsSource();
    const t = trips.find(x => x.id === id);
    if (!t) return;

    t.status = 'in_progress';
    t.assignedTo = courierName;
    t.courierId = courierVal;
    t.assignedAt = new Date().toISOString();

    const activeDb = (typeof getDb === 'function' ? getDb() : window.db);
    if (activeDb && typeof firebase !== 'undefined' && firebase.firestore) {
      const rootTripId = t.tripId || t.id.split('_D')[0];
      try {
        activeDb.collection('trips').doc(rootTripId).set({
          tripId: rootTripId,
          sjNumber: t.sjNumber || t.noSJ,
          shortCode: t.shortCode || t.uniqueCode,
          uniqueCode: t.uniqueCode || t.shortCode,
          courierId: courierVal,
          courierName: courierName,
          status: 'in_progress',
          date: firebase.firestore.Timestamp.now(),
          acceptedTime: firebase.firestore.Timestamp.now(),
          destinations: [{
            stopIndex: 1,
            locationName: t.customer || t.clientName || 'Klien Wellen',
            address: t.address || '-',
            status: 'pending',
            sjNumber: t.sjNumber || t.noSJ,
            shortCode: t.shortCode || t.uniqueCode,
            itemsSummary: t.items && t.items[0] ? t.items[0].nama : 'Item Cetakan',
            qty: t.items && t.items[0] ? String(t.items[0].qty) : '1'
          }]
        }, { merge: true }).catch(err => console.warn("Firestore sync error:", err));
      } catch (e) {}
    }

    if (window.showToast) {
      window.showToast(`SJ ${t.noSJ || t.id} ditugaskan ke ${courierName}!`, 'success');
    } else {
      alert(`SJ ${t.noSJ || t.id} ditugaskan ke ${courierName}!`);
    }
    renderUnifiedPoolView();
    if (typeof window.renderRecentShipments === 'function') window.renderRecentShipments();
  }

  function quickPreviewQR(id) {
    const trips = getTripsSource();
    const t = trips.find(x => x.id === id);
    if (!t) return;
    if (window.QRPrintDispatch) {
      const qrData = JSON.stringify({ sj: t.noSJ || t.id, code: t.uniqueCode, dest: t.address });
      const svg = window.QRPrintDispatch.generateQRCodeSVG(qrData, 180);
      alert(`Pratinjau Kode Unik: ${t.uniqueCode}\nNo SJ: ${t.noSJ || t.id}\nKlien: ${t.customer}`);
    }
  }

  function setSearchQuery(val) {
    currentSearchQuery = (val || '').trim();
    renderUnifiedPoolView();
    setTimeout(() => {
      const input = document.getElementById('pool-unified-search');
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }, 10);
  }

  function setDeliveryStatusFilter(filter) {
    activeDeliveryStatusFilter = filter || 'ALL';
    // Sync state to pill sub-nav buttons
    const pillAll = document.getElementById('pill-all-plan');
    const pillPending = document.getElementById('pill-pending-plan');
    if (pillAll && pillPending) {
      if (activeDeliveryStatusFilter === 'PENDING_FAILED') {
        pillAll.classList.remove('active');
        pillPending.classList.add('active');
      } else {
        pillAll.classList.add('active');
        pillPending.classList.remove('active');
      }
    }
    renderUnifiedPoolView();
  }

  function refresh() {
    renderUnifiedPoolView();
  }

  return {
    init,
    renderUnifiedPoolView,
    setDateFolder,
    setRegionFilter,
    setPrintFilter,
    setDeliveryStatusFilter,
    setSearchQuery,
    toggleAllCheckbox,
    updateSelectionCount,
    buildCourierOptionsHtml,
    onCourierSelectionChange,
    executeQuickDispatch,
    assignSelectedToCourier,
    printSingleSJ,
    printBatchCurrentView,
    printSelectedSuratJalan,
    deleteSelectedPool,
    deleteSingleSJ,
    clearAllPlanShipments,
    quickAssignSingle,
    quickPreviewQR,
    refresh
  };
})();

window.renderUnifiedPoolView = function () {
  UnifiedPoolUI.renderUnifiedPoolView();
};
