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
            const sj = String(t.noSJ || t.sjNumber || t.id || '');
            return !sj.startsWith('SJ-DEMO-') && !sj.startsWith('SJ-821457') && !sj.startsWith('SJ-200008') && !sj.startsWith('SJ-209914') && !sj.startsWith('SJ-796379');
          });
          localStorage.setItem('wtrack_local_trips', JSON.stringify(cleaned));
        }
      }
      localStorage.removeItem('wellen_local_trips');
    } catch (e) {}

    if (Array.isArray(window.allPoolTrips)) {
      window.allPoolTrips = window.allPoolTrips.filter(t => {
        const sj = String(t.noSJ || t.sjNumber || t.id || '');
        return !sj.startsWith('SJ-DEMO-') && !sj.startsWith('SJ-821457') && !sj.startsWith('SJ-200008') && !sj.startsWith('SJ-209914') && !sj.startsWith('SJ-796379');
      });
    }

    if (window.mockDatabase && Array.isArray(window.mockDatabase.suratJalanList)) {
      window.mockDatabase.suratJalanList = window.mockDatabase.suratJalanList.filter(t => {
        const sj = String(t.noSJ || t.sjNumber || t.id || '');
        return !sj.startsWith('SJ-DEMO-') && !sj.startsWith('SJ-821457') && !sj.startsWith('SJ-200008') && !sj.startsWith('SJ-209914') && !sj.startsWith('SJ-796379');
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
      const tid = String(t.noSJ || t.sjNumber || t.id || t.tripId);
      if (!tid || seenIds.has(tid) || deletedSet.has(tid)) return;

      // Filter out demo/dummy trip IDs if any linger in cache
      if (tid.startsWith('SJ-DEMO-') || tid.startsWith('SJ-821457') || tid.startsWith('SJ-200008') || tid.startsWith('SJ-209914') || tid.startsWith('SJ-796379')) return;

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

      const rawSJ = (t.noSJ || t.sjNumber || '').trim();
      const cleanSJ = rawSJ.startsWith('TRIP_') ? '' : rawSJ;

      // Plan shipment hanya untuk Surat Jalan yang valid / data import (kosongkan data dummy TRIP_xxx)
      if (!cleanSJ) return;

      // Normalisasi field agar aman ditampilkan di antarmuka
      const normalized = {
        id: tid,
        tripId: t.tripId || tid,
        noSJ: cleanSJ,
        sjNumber: cleanSJ,
        adminSJ: t.adminSJ || (t.destinations && t.destinations[0]?.adminSJ) || '',
        readyStatus: t.readyStatus || 'ready',
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
        pendingReason: t.pendingReason || (t.destinations && t.destinations[0]?.pendingReason) || '',
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

    // 3. Dari window.allCurrentTrips (Firebase database): Hanya ambil pengantaran pending yang memiliki Surat Jalan resmi (SJ-...)
    if (Array.isArray(window.allCurrentTrips)) {
      window.allCurrentTrips.forEach(t => {
        if (!t) return;
        const dStatus = (t.deliveryStatus || t.status || '').toLowerCase();
        const isTripFailed = (dStatus === 'failed' || dStatus === 'returned' || dStatus === 'undelivered' || dStatus === 'klien_tutup' || !!t.isFailed || !!t.failedReason || !!t.pendingReason);

        if (Array.isArray(t.destinations) && t.destinations.length > 0) {
          t.destinations.forEach((d, idx) => {
            if (!d) return;
            const validSJ = (d.sjNumber || d.noSJ || t.noSJ || t.sjNumber || '').trim();
            // Lewati jika bukan nomor Surat Jalan yang valid (jangan masukkan dummy TRIP_xxx)
            if (!validSJ || validSJ.startsWith('TRIP_')) return;

            const rawStatus = (d.status || '').toLowerCase();
            const hasPendingReason = !!(d.pendingReason && String(d.pendingReason).trim().length > 0);
            const isDestPending = (rawStatus === 'pending' && hasPendingReason) || rawStatus === 'pending_approval' || rawStatus === 'klien_tutup' || rawStatus === 'failed' || rawStatus === 'returned';

            if (isDestPending || isTripFailed) {
              const tid = validSJ;
              if (!seenIds.has(tid) && !deletedSet.has(tid)) {
                seenIds.add(tid);
                const dDate = t.date?.seconds ? new Date(t.date.seconds * 1000).toISOString().split('T')[0] : (t.date || new Date().toISOString().split('T')[0]);
                const reason = d.pendingReason || t.pendingReason || 'Pending Kurir / Klien Tutup';
                const destCust = d.locationName || d.customer || t.customer || t.clientName || 'Klien Wellen';
                const destAddr = d.address || t.address || '-';

                combined.push({
                  id: tid,
                  tripId: t.id,
                  originalTripId: t.id,
                  stopIndex: d.stopIndex || (idx + 1),
                  noSJ: validSJ,
                  sjNumber: validSJ,
                  adminSJ: t.adminSJ || d.adminSJ || '',
                  readyStatus: 'ready',
                  uniqueCode: d.uniqueCode || d.shortCode || t.uniqueCode || t.shortCode || 'WK-AUTO',
                  shortCode: d.shortCode || d.uniqueCode || t.shortCode || t.uniqueCode || 'WK-AUTO',
                  customer: destCust,
                  clientName: destCust,
                  address: destAddr,
                  region: t.region || detectRegion(destAddr, destCust),
                  printLocation: t.printLocation || t.originBranch || 'pusat',
                  originBranch: t.originBranch || t.printLocation || 'pusat',
                  date: dDate,
                  status: 'failed',
                  deliveryStatus: 'failed',
                  isPendingRollover: true,
                  isFailed: true,
                  isPendingFromCourier: true,
                  pendingReason: reason,
                  assignedCourierName: (typeof getCourierDisplayName === 'function' ? getCourierDisplayName(t.courierId) : t.courierId) || '',
                  items: (d.items && d.items.length > 0) ? d.items : [{
                    nama: d.itemsSummary || 'Item Pending Pengiriman',
                    qty: d.qty || '1'
                  }]
                });
              }
            }
          });
        }
      });
    }

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
    let totalReady = 0;
    let totalNotReady = 0;
    let totalFailed = 0;
    let totalCikokol = 0;
    let totalPusat = 0;

    allTrips.forEach(t => {
      totalPool++;
      if (t.isFailed) {
        totalFailed++;
      } else if (t.readyStatus === 'not_ready') {
        totalNotReady++;
      } else {
        totalReady++;
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
      topPendingBadge.innerText = totalFailed;
      topPendingBadge.style.display = totalFailed > 0 ? 'inline-block' : 'none';
    }
    const topNotReadyBadge = document.getElementById('badge-top-not-ready-count');
    if (topNotReadyBadge) {
      topNotReadyBadge.innerText = totalNotReady;
      topNotReadyBadge.style.display = totalNotReady > 0 ? 'inline-block' : 'none';
    }

    // 3. Filter trips sesuai kriteria
    let filtered = allTrips.filter(t => {
      // Exclude jika sudah selesai atau sudah ditugaskan (kecuali gagal kirim)
      if (t.status === 'completed' || t.deliveryStatus === 'completed' || t.status === 'done') return false;
      if ((t.status === 'in_progress' || t.deliveryStatus === 'in_progress' || t.assignedTo || t.courierId) && !t.isFailed) return false;

      // Filter sub-tab Status: Siap Kirim (ALL), Belum Siap Kirim (NOT_READY), atau Gagal/Pending Kirim (FAILED)
      if (activeDeliveryStatusFilter === 'ALL') {
        if (t.readyStatus === 'not_ready') return false;
      } else if (activeDeliveryStatusFilter === 'NOT_READY') {
        if (t.readyStatus !== 'not_ready') return false;
      } else if (activeDeliveryStatusFilter === 'FAILED' || activeDeliveryStatusFilter === 'PENDING_FAILED') {
        if (!t.isFailed) return false;
      } else if (activeDeliveryStatusFilter === 'PENDING') {
        if (t.isFailed || t.readyStatus === 'not_ready') return false;
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
            <span class="badge bg-success-subtle text-success border border-success-subtle px-2.5 py-1 rounded-pill extra-small fw-semibold d-inline-flex align-items-center gap-1">
              <i class="bi bi-check2-circle"></i> ${totalReady} Siap Kirim
            </span>
            ${totalNotReady > 0 ? `
              <span class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 px-2.5 py-1 rounded-pill extra-small fw-bold d-inline-flex align-items-center gap-1">
                <i class="bi bi-clock-history"></i> ${totalNotReady} Belum Ready
              </span>
            ` : ''}
            ${totalFailed > 0 ? `
              <span class="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2.5 py-1 rounded-pill extra-small fw-bold d-inline-flex align-items-center gap-1">
                <i class="bi bi-x-circle-fill"></i> ${totalFailed} Pending / Gagal
              </span>
            ` : ''}
          </div>
          <p class="text-muted small mb-0 mt-1">
            Database Surat Jalan terintegrasi Excel, verifikasi kesiapan barang (Checker), klasifikasi Region otomatis & penugasan armada.
          </p>
        </div>
      </div>

      <!-- SUB-TABS FILTER: ON HAND SIAP KIRIM VS BELUM SIAP KIRIM VS PENDING/GAGAL KIRIM -->
      <div class="d-flex align-items-center justify-content-between mb-2.5">
        <div class="aerotrack-pill-nav mb-0">
          <button class="aerotrack-pill-btn ${activeDeliveryStatusFilter === 'ALL' ? 'active' : ''}" 
                  type="button" onclick="UnifiedPoolUI.setDeliveryStatusFilter('ALL')">
            <i class="bi bi-box-seam ${activeDeliveryStatusFilter === 'ALL' ? 'text-primary' : ''}"></i> On Hand Siap Kirim (${totalReady})
          </button>
          <button class="aerotrack-pill-btn ${activeDeliveryStatusFilter === 'NOT_READY' ? 'active' : ''} text-warning fw-semibold" 
                  type="button" onclick="UnifiedPoolUI.setDeliveryStatusFilter('NOT_READY')">
            <i class="bi bi-clock-history text-warning"></i> Belum Siap Kirim
            <span class="badge ${totalNotReady > 0 ? 'bg-warning text-dark' : 'bg-secondary text-white'} rounded-pill ms-1">${totalNotReady}</span>
          </button>
          <button class="aerotrack-pill-btn ${activeDeliveryStatusFilter === 'FAILED' || activeDeliveryStatusFilter === 'PENDING_FAILED' ? 'active' : ''} text-danger fw-semibold" 
                  type="button" onclick="UnifiedPoolUI.setDeliveryStatusFilter('FAILED')">
            <i class="bi bi-exclamation-triangle-fill text-danger"></i> Pending / Gagal Kirim
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
            
            <select id="pool-region-filter" class="form-select form-select-sm aerotrack-select" style="min-width: 155px; font-size: 0.8rem;" onchange="UnifiedPoolUI.setRegionFilter(this.value)">
              <option value="ALL" ${activeRegionFilter === 'ALL' ? 'selected' : ''}>Semua Wilayah (${totalPool})</option>
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

            <select id="pool-print-filter" class="form-select form-select-sm aerotrack-select" style="min-width: 135px; font-size: 0.8rem;" onchange="UnifiedPoolUI.setPrintFilter(this.value)">
              <option value="ALL" ${activePrintLocationFilter === 'ALL' ? 'selected' : ''}>Semua Lokasi</option>
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
            <select id="pool-bulk-courier" class="form-select form-select-sm aerotrack-select" style="min-width: 210px; max-width: 250px; font-size: 0.8rem;">
              ${UnifiedPoolUI.buildCourierOptionsHtml()}
            </select>
            <button class="btn btn-sm btn-primary aerotrack-input fw-semibold px-3 py-1.5 d-flex align-items-center gap-1 shadow-sm" 
                    onclick="UnifiedPoolUI.assignSelectedToCourier()" title="Tugaskan Surat Jalan Terpilih">
              <i class="bi bi-send-check"></i>
              <span>Tugaskan</span>
            </button>

            <!-- Checker Bulk Action Buttons -->
            <button class="btn btn-sm btn-outline-warning aerotrack-input fw-semibold px-2.5 py-1.5 d-flex align-items-center gap-1" 
                    onclick="UnifiedPoolUI.bulkSetReadyStatus(false)" title="Tandai Surat Jalan Terpilih BELUM READY (Pindah ke Belum Siap Kirim)">
              <i class="bi bi-clock-history"></i>
              <span>Belum Ready</span>
            </button>
            <button class="btn btn-sm btn-outline-success aerotrack-input fw-semibold px-2.5 py-1.5 d-flex align-items-center gap-1" 
                    onclick="UnifiedPoolUI.bulkSetReadyStatus(true)" title="Tandai Surat Jalan Terpilih SUDAH READY (Siap Kirim)">
              <i class="bi bi-check2-circle"></i>
              <span>Siap Kirim</span>
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
                <th style="width: 105px;">Admin SJ</th>
                <th style="width: 85px;">Kode Unik</th>
                <th style="width: 105px;">Tanggal</th>
                <th style="min-width: 170px; max-width: 250px;">Customer</th>
                <th style="min-width: 200px; max-width: 300px;">Alamat Kirim</th>
                <th style="width: 110px;">Wilayah</th>
                <th style="width: 120px;" class="text-center">Status</th>
                <th style="width: 90px;" class="text-center">Print</th>
                <th style="width: 150px;" class="text-end">Aksi / Checker</th>
              </tr>
            </thead>
            <tbody id="pool-table-body">
              ${filtered.length === 0 ? `
                <tr><td colspan="11" class="text-center py-5 text-muted" style="font-size: 0.85rem;">
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
    if (window.wtrackDropdown) {
      if (typeof window.wtrackDropdown.close === 'function') window.wtrackDropdown.close();
      if (typeof window.wtrackDropdown.initAll === 'function') window.wtrackDropdown.initAll();
    }
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

    const rawSJ = (t.noSJ || t.sjNumber || '').trim();
    const displayId = (rawSJ && !rawSJ.startsWith('TRIP_')) ? rawSJ : '-';

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
          ${displayId !== '-' ? `
            <a class="aerotrack-id-link font-monospace fw-bold" onclick="UnifiedPoolUI.quickPreviewQR('${t.id}')" title="Klik untuk lihat QR Code">${displayId}</a>
          ` : `
            <span class="text-muted font-monospace">-</span>
          `}
        </td>
        <td style="width: 105px;">
          <span class="text-muted extra-small font-monospace fw-semibold">${t.adminSJ || '-'}</span>
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
        </td>
        <td style="min-width: 200px; max-width: 300px;">
          <div class="text-muted" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.35; font-size: 0.825rem; white-space: normal; word-break: break-word;" title="${t.address || '-'}">
            ${t.address || '-'}
          </div>
        </td>
        <td style="width: 110px;">
          <span class="aerotrack-badge badge-primary">${t.region || 'Jabodetabek'}</span>
        </td>
        <td class="text-center" style="width: 120px;">
          ${t.readyStatus === 'not_ready' ? `
            <span class="badge bg-secondary text-white extra-small fw-semibold px-2 py-1 d-inline-flex align-items-center gap-1 shadow-xs">
              <i class="bi bi-clock-history"></i> Belum Ready
            </span>
          ` : (t.isFailed ? `
            <span class="badge bg-danger text-white extra-small fw-semibold px-2 py-1 d-inline-flex align-items-center gap-1 shadow-xs" title="${t.pendingReason || 'Gagal / Pending'}">
              <i class="bi bi-x-circle-fill"></i> ${t.isPendingFromCourier ? 'Pending Kurir' : 'Gagal Kirim'}
            </span>
          ` : `
            <span class="badge bg-success-subtle text-success border border-success-subtle extra-small fw-semibold px-2 py-1 d-inline-flex align-items-center gap-1">
              <i class="bi bi-check2"></i> Siap Kirim
            </span>
          `)}
        </td>
        <td class="text-center" style="width: 90px;">
          ${locBadge}
          ${branchState ? `<div class="mt-1">${branchState}</div>` : ''}
        </td>
        <td class="text-end" style="width: 150px;">
          <div class="d-flex align-items-center justify-content-end gap-1">
            ${t.readyStatus === 'not_ready' ? `
              <button class="btn btn-sm btn-success py-1 px-2 aerotrack-input fw-semibold extra-small" onclick="UnifiedPoolUI.toggleReadyStatus('${t.id}', true)" title="Barang fisik sudah ready, pindahkan ke On Hand Siap Kirim">
                <i class="bi bi-check2-circle me-1"></i>Siap
              </button>
            ` : `
              <button class="btn btn-sm btn-outline-warning text-dark py-1 px-2 aerotrack-input fw-semibold extra-small" onclick="UnifiedPoolUI.toggleReadyStatus('${t.id}', false)" title="Barang fisik belum ready, pindahkan ke Belum Siap Kirim">
                <i class="bi bi-clock-history text-warning me-1"></i>Belum Ready
              </button>
            `}
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
    { canonicalId: 'erwin', displayName: 'Erwin', role: 'kurir', vehicleType: 'motor', defaultUid: 'ncGwEckUAkQFkVKbTBtvAo3PdRG3' },

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
    { canonicalId: 'husen', displayName: 'Husen', role: 'driver', vehicleType: 'mobil', defaultUid: 'juHUuOWS4FOVpHxE59t4xf0ld1z1' },
    { canonicalId: 'sobri', displayName: 'Sobri', role: 'driver', vehicleType: 'mobil', defaultUid: 'Kh6qNGG8kEVjilS9tIHaGbCcAWh1' }
  ];

  function buildCourierOptionsHtml() {
    if (typeof window.buildCourierOptgroupHtml === 'function') {
      return window.buildCourierOptgroupHtml('-- Pilih Kurir Motor atau Driver Mobil --', 'defaultUid');
    }
    const kurirs = OFFICIAL_MASTER_COURIERS.filter(c => c.role === 'kurir');
    const drivers = OFFICIAL_MASTER_COURIERS.filter(c => c.role === 'driver');
    return `
      <option value="">-- Pilih Kurir Motor atau Driver Mobil --</option>
      <optgroup label="🛵 Kurir Motor (${kurirs.length} Personil)">
        ${kurirs.map(c => `<option value="${c.defaultUid || c.canonicalId}" data-type="motor">${c.displayName || c.canonicalId}</option>`).join('')}
      </optgroup>
      <optgroup label="🚚 Driver Mobil / Truk (${drivers.length} Personil)">
        ${drivers.map(c => `<option value="${c.defaultUid || c.canonicalId}" data-type="mobil">${c.displayName || c.canonicalId}</option>`).join('')}
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

  function matchesTripIdentifier(item, checkedList) {
    if (!item || !Array.isArray(checkedList)) return false;
    const candidates = [
      item.id,
      item.tripId,
      item.noSJ,
      item.sjNumber
    ].filter(Boolean).map(v => String(v).trim());
    return candidates.some(c => checkedList.includes(c));
  }

  function assignSelectedToCourier() {
    const courierSelect = document.getElementById('pool-bulk-courier');
    const courierVal = courierSelect?.value;
    const rawCourierText = courierSelect?.options[courierSelect.selectedIndex]?.text || "Kurir Lapangan";
    const courierName = rawCourierText.replace(/^[^\wA-Za-z]+/, '').trim();

    if (!courierVal) {
      alert("Silakan pilih Kurir Motor atau Driver terlebih dahulu!");
      return;
    }

    const checked = Array.from(document.querySelectorAll('.pool-checkbox:checked')).map(cb => String(cb.value).trim());
    if (checked.length === 0) {
      alert("Pilih minimal 1 Surat Jalan dengan mencentang kotak centang (checkbox) untuk ditugaskan!");
      return;
    }

    const trips = getTripsSource();
    const targetTrips = trips.filter(t => matchesTripIdentifier(t, checked));

    if (targetTrips.length === 0) {
      alert("Surat Jalan terpilih tidak ditemukan.");
      return;
    }

    const nowIso = new Date().toISOString();

    targetTrips.forEach(t => {
      t.status = 'in_progress';
      t.deliveryStatus = 'in_progress';
      t.assignedTo = courierName;
      t.courierName = courierName;
      t.courierId = courierVal;
      t.assignedAt = nowIso;
      t.isPendingRollover = false;
      t.isFailed = false;
    });

    // Req 10: Hapus SJ yang sudah berhasil ditugaskan dari window.allPoolTrips agar langsung hilang dari tabel Plan Shipment
    if (Array.isArray(window.allPoolTrips)) {
      window.allPoolTrips = window.allPoolTrips.filter(pt => !matchesTripIdentifier(pt, checked));
    }

    // Update juga di localStorage wtrack_local_trips agar statusnya menjadi in_progress (bukan pending di pool lagi)
    try {
      let storedList = [];
      const rawStored = localStorage.getItem('wtrack_local_trips');
      if (rawStored) {
        const parsed = JSON.parse(rawStored);
        if (Array.isArray(parsed)) storedList = parsed;
      }
      storedList.forEach(st => {
        if (matchesTripIdentifier(st, checked)) {
          st.status = 'in_progress';
          st.deliveryStatus = 'in_progress';
          st.assignedTo = courierName;
          st.courierName = courierName;
          st.courierId = courierVal;
          st.assignedAt = nowIso;
          st.isPendingRollover = false;
          st.isFailed = false;
        }
      });
      targetTrips.forEach(tt => {
        const exists = storedList.some(st => matchesTripIdentifier(st, [tt.id, tt.noSJ, tt.sjNumber]));
        if (!exists) {
          storedList.unshift(tt);
        }
      });
      localStorage.setItem('wtrack_local_trips', JSON.stringify(storedList.slice(0, 500)));
    } catch(e) {}

    // Req 12 & 13: Sinkronisasi langsung ke window.allCurrentTrips & Firestore agar Dashboard Admin dan Aplikasi Kurir sinkron real-time!
    const activeDb = (typeof getDb === 'function' ? getDb() : window.db);
    if (!Array.isArray(window.allCurrentTrips)) {
      window.allCurrentTrips = [];
    }

    targetTrips.forEach(t => {
      const cleanSJ = String(t.noSJ || t.sjNumber || t.id).trim();
      const safeDocId = cleanSJ.replace(/[\/\\]/g, '-');
      const firestoreTs = (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.Timestamp)
        ? firebase.firestore.Timestamp.now()
        : new Date();

      const tripPayload = {
        id: safeDocId,
        tripId: safeDocId,
        noSJ: cleanSJ,
        sjNumber: cleanSJ,
        adminSJ: t.adminSJ || '',
        shortCode: t.shortCode || t.uniqueCode || 'WK-AUTO',
        uniqueCode: t.uniqueCode || t.shortCode || 'WK-AUTO',
        courierId: courierVal,
        courierName: courierName,
        customer: t.customer || t.clientName || 'Klien Wellen',
        clientName: t.clientName || t.customer || 'Klien Wellen',
        address: t.address || '-',
        region: t.region || 'Jakarta Pusat',
        originBranch: t.originBranch || t.printLocation || 'pusat',
        branchId: t.originBranch || t.printLocation || 'pusat',
        status: 'in_progress',
        deliveryStatus: 'in_progress',
        date: firestoreTs,
        acceptedTime: firestoreTs,
        assignedAt: nowIso,
        destinations: [{
          stopIndex: 1,
          locationName: t.customer || t.clientName || 'Klien Wellen',
          address: t.address || '-',
          status: 'in_progress',
          sjNumber: cleanSJ,
          noSJ: cleanSJ,
          adminSJ: t.adminSJ || '',
          shortCode: t.shortCode || t.uniqueCode || 'WK-AUTO',
          itemsSummary: t.items && t.items[0] ? t.items[0].nama : 'Item Cetakan',
          qty: t.items && t.items[0] ? String(t.items[0].qty) : '1'
        }]
      };

      const existingIdx = window.allCurrentTrips.findIndex(rt => rt.id === safeDocId || rt.noSJ === cleanSJ || rt.sjNumber === cleanSJ);
      if (existingIdx >= 0) {
        window.allCurrentTrips[existingIdx] = { ...window.allCurrentTrips[existingIdx], ...tripPayload };
      } else {
        window.allCurrentTrips.unshift(tripPayload);
      }

      if (typeof window.syncAllCurrentTrips === 'function') {
        window.syncAllCurrentTrips(window.allCurrentTrips);
      }

      if (activeDb) {
        try {
          activeDb.collection('trips').doc(safeDocId).set(tripPayload, { merge: true })
            .catch(err => console.warn("Firestore sync error:", err));
        } catch (e) {
          console.warn("Firestore assignment exception:", e);
        }
      }
    });

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
    const courierVal = courierSelect?.value;
    if (!courierVal) {
      alert("Silakan pilih Kurir Motor / Driver Mobil pada dropdown di toolbar terlebih dahulu, lalu klik tombol Tugaskan ini.");
      courierSelect?.focus();
      return;
    }

    document.querySelectorAll('.pool-checkbox').forEach(cb => {
      cb.checked = (String(cb.value) === String(id));
    });
    assignSelectedToCourier();
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

  function matchesTripId(item, id) {
    if (!item || !id) return false;
    const sId = String(id).toLowerCase();
    return String(item.id || '').toLowerCase() === sId ||
           String(item.tripId || '').toLowerCase() === sId ||
           String(item.noSJ || '').toLowerCase() === sId ||
           String(item.sjNumber || '').toLowerCase() === sId;
  }

  function toggleReadyStatus(tripId, isReady) {
    const newStatus = isReady ? 'ready' : 'not_ready';

    // 1. Update di window.allPoolTrips
    if (Array.isArray(window.allPoolTrips)) {
      const found = window.allPoolTrips.find(x => matchesTripId(x, tripId));
      if (found) found.readyStatus = newStatus;
    }

    // 2. Update di LocalStorage
    try {
      const rawStored = localStorage.getItem('wtrack_local_trips');
      if (rawStored) {
        const stored = JSON.parse(rawStored);
        const item = stored.find(x => matchesTripId(x, tripId));
        if (item) {
          item.readyStatus = newStatus;
          localStorage.setItem('wtrack_local_trips', JSON.stringify(stored));
        }
      }
    } catch (e) {}

    // 3. Update di window.allCurrentTrips
    if (Array.isArray(window.allCurrentTrips)) {
      const found = window.allCurrentTrips.find(x => matchesTripId(x, tripId));
      if (found) found.readyStatus = newStatus;
    }

    // 4. Update di Firestore jika ada
    const activeDb = (typeof window.getDb === 'function') ? window.getDb() : (window.firebase && window.firebase.firestore ? window.firebase.firestore() : null);
    if (activeDb) {
      activeDb.collection('trips').doc(tripId).update({ readyStatus: newStatus }).catch(() => {});
    }

    if (typeof window.showToast === 'function') {
      window.showToast(isReady ? "✅ Barang SUDAH READY & dipindahkan ke Siap Kirim." : "⏳ Barang BELUM READY & dipindahkan ke tab Belum Siap Kirim.");
    }
    renderUnifiedPoolView();
  }

  function bulkSetReadyStatus(isReady) {
    const checked = Array.from(document.querySelectorAll('.pool-checkbox:checked')).map(cb => cb.value);
    if (checked.length === 0) {
      alert(`Pilih minimal 1 Surat Jalan untuk ditandai ${isReady ? 'Siap Kirim' : 'Belum Ready'}!`);
      return;
    }

    const newStatus = isReady ? 'ready' : 'not_ready';

    if (Array.isArray(window.allPoolTrips)) {
      window.allPoolTrips.forEach(pt => {
        if (checked.some(cId => matchesTripId(pt, cId))) pt.readyStatus = newStatus;
      });
    }

    try {
      const rawStored = localStorage.getItem('wtrack_local_trips');
      if (rawStored) {
        const stored = JSON.parse(rawStored);
        stored.forEach(item => {
          if (checked.some(cId => matchesTripId(item, cId))) item.readyStatus = newStatus;
        });
        localStorage.setItem('wtrack_local_trips', JSON.stringify(stored));
      }
    } catch (e) {}

    if (Array.isArray(window.allCurrentTrips)) {
      window.allCurrentTrips.forEach(rt => {
        if (checked.some(cId => matchesTripId(rt, cId))) rt.readyStatus = newStatus;
      });
    }

    const activeDb = (typeof window.getDb === 'function') ? window.getDb() : (window.firebase && window.firebase.firestore ? window.firebase.firestore() : null);
    if (activeDb) {
      checked.forEach(id => {
        activeDb.collection('trips').doc(id).update({ readyStatus: newStatus }).catch(() => {});
      });
    }

    if (typeof window.showToast === 'function') {
      window.showToast(`Berhasil menandai ${checked.length} Surat Jalan sebagai ${isReady ? 'SIAP KIRIM' : 'BELUM READY'}.`);
    }
    renderUnifiedPoolView();
  }

  function setDeliveryStatusFilter(filter) {
    activeDeliveryStatusFilter = filter || 'ALL';
    // Sync state to pill sub-nav buttons
    const pillAll = document.getElementById('pill-all-plan');
    const pillNotReady = document.getElementById('pill-not-ready-plan');
    const pillPending = document.getElementById('pill-pending-plan');
    if (pillAll) pillAll.classList.toggle('active', activeDeliveryStatusFilter === 'ALL');
    if (pillNotReady) pillNotReady.classList.toggle('active', activeDeliveryStatusFilter === 'NOT_READY');
    if (pillPending) pillPending.classList.toggle('active', activeDeliveryStatusFilter === 'FAILED' || activeDeliveryStatusFilter === 'PENDING_FAILED');

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
    toggleReadyStatus,
    bulkSetReadyStatus,
    quickAssignSingle,
    quickPreviewQR,
    refresh
  };
})();

window.renderUnifiedPoolView = function () {
  UnifiedPoolUI.renderUnifiedPoolView();
};
