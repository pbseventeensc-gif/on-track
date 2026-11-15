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

  function displayPoolText(value) {
    const text = String(value || '-').trim().toLocaleLowerCase('id-ID');
    const normal = text.replace(/\p{L}[\p{L}\p{N}]*/gu, word => {
      if (/^(pt|cv|ud|pd|tb|rt|rw|dki|bsd|pik|pvc|mdf|hpl|acp|uv|[ab]\d+)$/i.test(word)) return word.toUpperCase();
      if (/^(cm|mm|m|kg|gsm|pcs|m2)$/.test(word)) return word;
      return word.charAt(0).toLocaleUpperCase('id-ID') + word.slice(1);
    });
    return normal.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

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
      if (t.courierId && t.destinations?.length > 1) return;
      const tid = String(t.noSJ || t.sjNumber || t.id || t.tripId);
      if (!tid || seenIds.has(tid) || deletedSet.has(tid)) return;

      // Filter out demo/dummy trip IDs if any linger in cache
      if (tid.startsWith('SJ-DEMO-') || tid.startsWith('SJ-821457') || tid.startsWith('SJ-200008') || tid.startsWith('SJ-209914') || tid.startsWith('SJ-796379')) return;

      const todayStr = new Date(Date.now() + 7 * 3600000).toISOString().slice(0,10);
      const rawDate = t.dateFolder || t.date;
      const dateMs = rawDate?.toMillis?.() || (rawDate?.seconds ? rawDate.seconds * 1000 : Date.parse(rawDate));
      const dDate = typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate :
        Number.isFinite(dateMs) ? new Date(dateMs + 7 * 3600000).toISOString().slice(0,10) : todayStr;
      const isOld = (dDate < todayStr);
      const dStatus = (t.deliveryStatus || t.status || 'pending').toLowerCase();
      const pendingDestination=(t.destinations||[]).some(d=>['pending_approval','klien_tutup','failed','returned'].includes(d.status)||(d.status==='pending'&&!!d.pendingReason));
      const isFailed = (['failed','returned','undelivered','klien_tutup','pending_approval'].includes(dStatus) || !!t.isFailed || !!t.failedReason || pendingDestination || (dStatus==='pending'&&!!t.pendingReason));
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
        tripId: t.tripId || t.id || tid,
        courierId: t.courierId || '',
        assignedTo: t.assignedTo || '',
        noSJ: cleanSJ,
        sjNumber: cleanSJ,
        adminSJ: (t.destinations && t.destinations[0]?.adminSJ) || t.adminSJ || window.CustomerMaster?.resolveName(t.customer || t.clientName) || '',
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
        workflowRef: window.DispatchWorkflow?.reference(t,0),
        priority: t.destinations?.[0]?.priority || t.priority || 'normal',
        pickupStatus: t.pickupStatus || '',
        deliveryMethod: t.deliveryMethod || 'courier',
        pendingNote: window.DispatchWorkflow?.pendingInfo(t,t.destinations?.[0]||{}).note || t.pendingNote || t.pendingReason || '',
        pendingAt: t.pendingAt || t.destinations?.[0]?.pendingAt || '',
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
      const rawStored = window.WTRACK_LOCAL_SANDBOX ? localStorage.getItem('wtrack_local_trips') : null;
      if (rawStored) {
        const storedTrips = JSON.parse(rawStored);
        if (Array.isArray(storedTrips)) {
          storedTrips.forEach(addTrip);
        }
      }
    } catch (e) {}

    // 3. Dari window.allCurrentTrips (Firebase database): Hanya ambil pengantaran pending yang memiliki Surat Jalan resmi (SJ-...)
    if (Array.isArray(window.allCurrentTrips)) {
      let pendingSources=window.allCurrentTrips;
      if(window.WTRACK_LOCAL_SANDBOX) {
        try {pendingSources=[...JSON.parse(localStorage.getItem('wtrack_local_trips')||'[]'),...pendingSources];}catch(_){}
      }
      pendingSources.forEach(t => {
        if (!t) return;
        const dStatus = (t.deliveryStatus || t.status || '').toLowerCase();
        const isTripFailed = (dStatus === 'failed' || dStatus === 'returned' || dStatus === 'undelivered' || dStatus === 'klien_tutup' || !!t.isFailed || !!t.failedReason || ((t.destinations?.length||0)<=1 && dStatus==='pending' && !!t.pendingReason));

        if (Array.isArray(t.destinations) && t.destinations.length > 0) {
          t.destinations.forEach((d, idx) => {
            if (!d) return;
            if(['done','completed','delivered'].includes(d.status)||d.completedTime||d.completedAt) return;
            const validSJ = (d.sjNumber || d.noSJ || t.noSJ || t.sjNumber || '').trim();
            // Lewati jika bukan nomor Surat Jalan yang valid (jangan masukkan dummy TRIP_xxx)
            if (!validSJ || validSJ.startsWith('TRIP_')) return;

            const rawStatus = (d.status || '').toLowerCase();
            const hasPendingReason = !!(d.pendingReason && String(d.pendingReason).trim().length > 0);
            const isDestPending = (rawStatus === 'pending' && hasPendingReason) || rawStatus === 'pending_approval' || rawStatus === 'klien_tutup' || rawStatus === 'failed' || rawStatus === 'returned';

            if (isDestPending || (isTripFailed && t.destinations.length === 1)) {
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
                  courierId: t.courierId || '',
                  assignedTo: t.assignedTo || '',
                  stopIndex: d.stopIndex || (idx + 1),
                  noSJ: validSJ,
                  sjNumber: validSJ,
                  adminSJ: d.adminSJ || t.adminSJ || window.CustomerMaster?.resolveName(d.customer || d.clientName || t.customer || t.clientName) || '',
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
                  pendingAt: d.pendingAt || t.pendingAt || '',
                  pendingReason: reason,
                  pendingNote: window.DispatchWorkflow?.pendingInfo(t,d).note || d.pendingNote || t.pendingNote || reason,
                  workflowRef: window.DispatchWorkflow?.reference(t,idx),
                  priority: d.priority || t.priority || 'normal',
                  pickupStatus: t.pickupStatus || '',
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
        if (t.readyStatus === 'not_ready' && !t.isFailed) return false;
      } else if (activeDeliveryStatusFilter === 'NOT_READY') {
        if (t.readyStatus !== 'not_ready') return false;
      } else if (activeDeliveryStatusFilter === 'FAILED' || activeDeliveryStatusFilter === 'PENDING_FAILED') {
        if (!t.isFailed) return false;
      } else if (activeDeliveryStatusFilter === 'PENDING') {
        if (t.isFailed || t.readyStatus === 'not_ready') return false;
      } else if (activeDeliveryStatusFilter === 'URGENT') {
        if(t.priority!=='urgent') return false;
      } else if (activeDeliveryStatusFilter === 'PICKUP') {
        if(t.pickupStatus!=='waiting') return false;
      }

      if (activeDateFolder !== 'ALL' && !t.isFailed) {
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
      if (a.isFailed && b.isFailed) {
        const pendingOrder = String(a.pendingAt || a.date || '').localeCompare(String(b.pendingAt || b.date || ''));
        if (pendingOrder) return pendingOrder;
      }
      if(a.priority==='urgent'&&b.priority!=='urgent') return -1;
      if(b.priority==='urgent'&&a.priority!=='urgent') return 1;
      if (a.isRolloverFromYesterday && !b.isRolloverFromYesterday) return -1;
      if (!a.isRolloverFromYesterday && b.isRolloverFromYesterday) return 1;
      return (b.date || '').localeCompare(a.date || '');
    });

    container.innerHTML = `
      <div class="aerotrack-table-container bg-white mb-4" style="border: 1px solid #EAECF0; border-radius: 12px; box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05);">
        <!-- Underline Tabs (Esse style) -->
        <div class="d-flex align-items-center gap-4 px-3 border-bottom overflow-x-auto" style="border-color: #EAECF0 !important;">
          <button type="button" class="btn btn-link text-decoration-none px-1 py-2.5 d-inline-flex align-items-center gap-1.5 text-nowrap" style="font-size: 13px; border-radius: 0; border-bottom: 2px solid ${activeDeliveryStatusFilter === 'ALL' ? '#CC6100' : 'transparent'}; color: ${activeDeliveryStatusFilter === 'ALL' ? '#101828' : '#667085'}; font-weight: ${activeDeliveryStatusFilter === 'ALL' ? '600' : '500'};" onclick="UnifiedPoolUI.setDeliveryStatusFilter('ALL')">
            <span>Ready</span>
            <span class="wellen-count-badge" style="background: ${activeDeliveryStatusFilter === 'ALL' ? '#CC6100' : '#FFF4E5'}; color: ${activeDeliveryStatusFilter === 'ALL' ? '#ffffff' : '#CC6100'}; border: 1px solid rgba(204, 97, 0, 0.25); font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 9999px;">${totalReady}</span>
          </button>
          <button type="button" class="btn btn-link text-decoration-none px-1 py-2.5 d-inline-flex align-items-center gap-1.5 text-nowrap" style="font-size: 13px; border-radius: 0; border-bottom: 2px solid ${activeDeliveryStatusFilter === 'NOT_READY' ? '#CC6100' : 'transparent'}; color: ${activeDeliveryStatusFilter === 'NOT_READY' ? '#101828' : '#667085'}; font-weight: ${activeDeliveryStatusFilter === 'NOT_READY' ? '600' : '500'};" onclick="UnifiedPoolUI.setDeliveryStatusFilter('NOT_READY')">
            <span>Belum Ready</span>
            <span class="wellen-count-badge" style="background: ${activeDeliveryStatusFilter === 'NOT_READY' ? '#CC6100' : '#FFF4E5'}; color: ${activeDeliveryStatusFilter === 'NOT_READY' ? '#ffffff' : '#CC6100'}; border: 1px solid rgba(204, 97, 0, 0.25); font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 9999px;">${totalNotReady}</span>
          </button>
          <button type="button" class="btn btn-link text-decoration-none px-1 py-2.5 d-inline-flex align-items-center gap-1.5 text-nowrap" style="font-size: 13px; border-radius: 0; border-bottom: 2px solid ${activeDeliveryStatusFilter === 'FAILED' || activeDeliveryStatusFilter === 'PENDING_FAILED' ? '#CC6100' : 'transparent'}; color: ${activeDeliveryStatusFilter === 'FAILED' || activeDeliveryStatusFilter === 'PENDING_FAILED' ? '#101828' : '#667085'}; font-weight: ${activeDeliveryStatusFilter === 'FAILED' || activeDeliveryStatusFilter === 'PENDING_FAILED' ? '600' : '500'};" onclick="UnifiedPoolUI.setDeliveryStatusFilter('FAILED')">
            <span>Pending / Gagal</span>
            <span class="wellen-count-badge" style="background: ${activeDeliveryStatusFilter === 'FAILED' || activeDeliveryStatusFilter === 'PENDING_FAILED' ? '#CC6100' : '#FFF4E5'}; color: ${activeDeliveryStatusFilter === 'FAILED' || activeDeliveryStatusFilter === 'PENDING_FAILED' ? '#ffffff' : '#CC6100'}; border: 1px solid rgba(204, 97, 0, 0.25); font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 9999px;">${totalFailed}</span>
          </button>
          ${window.WTRACK_LOCAL_SANDBOX && window.DispatchWorkflow ? `
          <button type="button" class="btn btn-link text-decoration-none px-1 py-2.5 d-inline-flex align-items-center gap-1.5 text-nowrap" style="font-size: 13px; border-radius: 0; border-bottom: 2px solid ${activeDeliveryStatusFilter === 'URGENT' ? '#CC6100' : 'transparent'}; color: ${activeDeliveryStatusFilter === 'URGENT' ? '#101828' : '#667085'}; font-weight: ${activeDeliveryStatusFilter === 'URGENT' ? '600' : '500'};" onclick="UnifiedPoolUI.setDeliveryStatusFilter('URGENT')">
            <span>Urgent</span>
            <span class="wellen-count-badge" style="background: ${activeDeliveryStatusFilter === 'URGENT' ? '#CC6100' : '#FFF4E5'}; color: ${activeDeliveryStatusFilter === 'URGENT' ? '#ffffff' : '#CC6100'}; border: 1px solid rgba(204, 97, 0, 0.25); font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 9999px;">${allTrips.filter(t=>t.priority==='urgent').length}</span>
          </button>
          <button type="button" class="btn btn-link text-decoration-none px-1 py-2.5 d-inline-flex align-items-center gap-1.5 text-nowrap" style="font-size: 13px; border-radius: 0; border-bottom: 2px solid ${activeDeliveryStatusFilter === 'PICKUP' ? '#CC6100' : 'transparent'}; color: ${activeDeliveryStatusFilter === 'PICKUP' ? '#101828' : '#667085'}; font-weight: ${activeDeliveryStatusFilter === 'PICKUP' ? '600' : '500'};" onclick="UnifiedPoolUI.setDeliveryStatusFilter('PICKUP')">
            <span>Pickup</span>
            <span class="wellen-count-badge" style="background: ${activeDeliveryStatusFilter === 'PICKUP' ? '#CC6100' : '#FFF4E5'}; color: ${activeDeliveryStatusFilter === 'PICKUP' ? '#ffffff' : '#CC6100'}; border: 1px solid rgba(204, 97, 0, 0.25); font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 9999px;">${allTrips.filter(t=>t.pickupStatus==='waiting').length}</span>
          </button>` : ''}
        </div>

        <!-- Baris Filter & Import -->
        <div class="d-flex align-items-center justify-content-between border-bottom px-3 flex-wrap" style="border-color: #EAECF0 !important; padding-top: 10px; padding-bottom: 10px; gap: 8px;">
          <div class="d-flex align-items-center flex-wrap" style="gap: 8px;">
            <div class="position-relative" style="width: 210px;">
              <i class="bi bi-search position-absolute top-50 translate-middle-y text-muted" style="left: 11px; font-size: 13px; pointer-events: none;"></i>
              <input type="text" id="pool-unified-search" class="form-control form-control-sm" placeholder="Cari No. DO, Customer..." style="padding-left: 34px; width: 100%;" value="${currentSearchQuery}" oninput="UnifiedPoolUI.setSearchQuery(this.value)">
            </div>
            <div style="width: 165px;">
              <select id="pool-region-filter" class="form-select form-select-sm" onchange="UnifiedPoolUI.setRegionFilter(this.value)">
                <option value="ALL" ${activeRegionFilter === 'ALL' ? 'selected' : ''}>Region (${totalPool})</option>
                ${regions.map(r => `<option value="${r}" ${activeRegionFilter === r ? 'selected' : ''}>${r} (${regionCounts[r]})</option>`).join('')}
              </select>
            </div>
            <div class="d-flex align-items-center" style="gap: 4px;">
              <input type="date" id="pool-unified-date" class="form-control form-control-sm" style="width: 138px;" value="${activeDateFolder !== 'ALL' ? activeDateFolder : ''}" onchange="UnifiedPoolUI.setDateFolder(this.value || 'ALL')">
              ${activeDateFolder !== 'ALL' ? `<button class="btn btn-sm bg-white border text-muted" style="height: 32px; border-radius: 8px; border-color: #D0D5DD !important;" onclick="UnifiedPoolUI.setDateFolder('ALL')" title="Reset Tanggal"><i class="bi bi-x-lg" style="font-size: 11px;"></i></button>` : ''}
            </div>
            <div style="width: 140px;">
              <select id="pool-print-filter" class="form-select form-select-sm" onchange="UnifiedPoolUI.setPrintFilter(this.value)">
                <option value="ALL" ${activePrintLocationFilter === 'ALL' ? 'selected' : ''}>Branch</option>
                <option value="pusat" ${activePrintLocationFilter === 'pusat' ? 'selected' : ''}>Pusat (${totalPusat})</option>
                <option value="cikokol" ${activePrintLocationFilter === 'cikokol' ? 'selected' : ''}>Cikokol (${totalCikokol})</option>
              </select>
            </div>
          </div>
          <div class="d-flex align-items-center ms-auto" style="gap: 8px;">
            <button class="btn btn-sm btn-wellen-action text-white fw-semibold d-inline-flex align-items-center text-nowrap" style="height: 32px; border-radius: 8px; font-size: 12.5px; padding: 0 12px; gap: 6px;" onclick="document.getElementById('sj-excel-file-input').click()">
              <i class="bi bi-upload" style="font-size: 12px;"></i>
              <span>Import DO</span>
            </button>
            <input type="file" id="sj-excel-file-input" class="d-none" accept=".xlsx, .xls, .csv, .docx, .doc, .rtf" multiple onchange="window.SJImportEngine && window.SJImportEngine.handleFileUpload(event)">
            <button class="btn btn-sm bg-white border text-muted d-inline-flex align-items-center justify-content-center" style="height: 32px; width: 32px; border-radius: 8px; border-color: #D0D5DD !important;" onclick="UnifiedPoolUI.refresh()" title="Muat Ulang">
              <i class="bi bi-arrow-clockwise"></i>
            </button>
          </div>
        </div>

        <div class="d-flex align-items-center justify-content-between gap-2 flex-wrap px-3 py-2 border-bottom" style="background:#F9FAFB">
          <div style="font-size:12px"><strong>Tugaskan per region</strong><div class="text-muted">Pilih region di filter. SJ Ready mengikuti tanggal dan branch yang dipilih.</div></div>
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <select id="quick-dispatch-courier" class="form-select form-select-sm" aria-label="Kurir untuk region" style="width:220px">${UnifiedPoolUI.buildCourierOptionsHtml()}</select>
            <button id="pool-region-assign" type="button" class="btn btn-sm btn-wellen-action" onclick="UnifiedPoolUI.executeQuickDispatch()" ${activeRegionFilter === 'ALL' ? 'disabled' : ''}>Tugaskan ${activeRegionFilter === 'ALL' ? 'Region' : displayPoolText(activeRegionFilter)}</button>
          </div>
        </div>

        <!-- Baris Aksi Terpilih (Contextual: tampil saat ada SJ dicentang) -->
        <div id="pool-bulk-bar" class="d-none align-items-center justify-content-between px-3 border-bottom flex-wrap" style="border-color: #FFE3C2 !important; background: #FFF9F2; padding-top: 8px; padding-bottom: 8px; gap: 8px;">
          <span id="pool-selected-count" style="font-size: 12.5px; font-weight: 600; color: #B05500;">0 dipilih</span>
          <div class="d-flex align-items-center flex-wrap ms-auto" style="gap: 6px;">
            <div style="width: 220px; flex-shrink: 0;">
              <select id="pool-bulk-courier" class="form-select form-select-sm">
                ${UnifiedPoolUI.buildCourierOptionsHtml()}
              </select>
            </div>
            <button class="btn btn-sm text-white fw-semibold d-inline-flex align-items-center" style="height: 32px; border-radius: 8px; background: #CC6100; font-size: 12.5px; padding: 0 12px; gap: 6px;" onclick="UnifiedPoolUI.assignSelectedToCourier()">
              <i class="bi bi-send-check"></i>
              <span>Tugaskan</span>
            </button>
            <button class="btn btn-sm bg-white border d-inline-flex align-items-center" style="height: 32px; border-radius: 8px; border-color: #D0D5DD !important; color: #344054; font-size: 12.5px; padding: 0 10px; gap: 6px;" onclick="UnifiedPoolUI.bulkSetReadyStatus(false)">
              <i class="bi bi-clock-history"></i>
              <span>Belum Ready</span>
            </button>
            <button class="btn btn-sm bg-white border d-inline-flex align-items-center" style="height: 32px; border-radius: 8px; border-color: #D0D5DD !important; color: #344054; font-size: 12.5px; padding: 0 10px; gap: 6px;" onclick="UnifiedPoolUI.bulkSetReadyStatus(true)">
              <i class="bi bi-check2-circle"></i>
              <span>Ready</span>
            </button>
            <button class="btn btn-sm bg-white border d-inline-flex align-items-center" style="height: 32px; border-radius: 8px; border-color: #D0D5DD !important; color: #344054; font-size: 12.5px; padding: 0 10px; gap: 6px;" onclick="UnifiedPoolUI.printSelectedSuratJalan()">
              <i class="bi bi-printer"></i>
              <span>Cetak</span>
            </button>
            <button class="btn btn-sm bg-white border text-danger d-inline-flex align-items-center justify-content-center" style="height: 32px; width: 32px; border-radius: 8px; border-color: #D0D5DD !important;" onclick="UnifiedPoolUI.deleteSelectedPool()" title="Hapus Terpilih">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table aerotrack-table align-middle mb-0 text-nowrap ${window.PoolLineItems ? 'pool-local-table' : ''}">
            <colgroup>
              <col style="width: 36px;">
              <col style="width: 130px;">
              <col style="width: 70px;">
              <col style="width: 100px;">
              <col style="width: 170px;">
              <col>
              <col style="width: 110px;">
              ${window.PoolLineItems ? '<col style="width: 95px;">' : ''}
              <col style="width: 90px;">
              <col style="width: 75px;">
              <col style="width: 210px;">
            </colgroup>
            <thead>
              <tr>
                <th class="text-center">
                  <input type="checkbox" class="form-check-input" id="select-all-pool" onchange="UnifiedPoolUI.toggleAllCheckbox(this)">
                </th>
                <th>No. DO</th>
                <th>Admin</th>
                <th>Tanggal</th>
                <th>Customer</th>
                <th>Alamat</th>
                <th>Region</th>
                ${window.PoolLineItems ? '<th>Berat</th>' : ''}
                <th class="text-center">Status</th>
                <th class="text-center">Branch</th>
                <th class="text-end">Aksi</th>
              </tr>
            </thead>
            <tbody id="pool-table-body">
              ${filtered.length === 0 ? `
                <tr><td colspan="${window.PoolLineItems ? 11 : 10}" class="text-center py-5 text-muted" style="font-size: 13px;">
                  <i class="bi bi-inbox fs-3 d-block mb-2 text-muted"></i>
                  Belum ada Delivery Order di pool.
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
    const lineItems = window.PoolLineItems;
    const workflow = window.WTRACK_LOCAL_SANDBOX && window.DispatchWorkflow;
    const workflowRef = workflow ? workflow.argument(t.workflowRef || {tripId:t.tripId||t.id,destinationIndex:0,noSJ:rawSJ}) : '';
    const customerText = displayPoolText(t.customer);
    const addressText = displayPoolText(t.address);

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
          <input type="checkbox" class="form-check-input pool-checkbox" value="${t.id}" ${t.pickupStatus==='waiting'?'disabled':''} onchange="UnifiedPoolUI.updateSelectionCount()">
        </td>
        <td class="text-nowrap" style="width: 130px;">
          ${displayId !== '-' ? `
            ${lineItems ? `<button type="button" class="btn btn-link p-0 aerotrack-id-link font-monospace text-start text-nowrap" style="font-size: 12px; font-weight: 400 !important;" onclick="PoolLineItems.toggle(${lineItems.argument(rawSJ)})" aria-expanded="${lineItems.isExpanded(rawSJ)}" title="Buka / tutup detail item DO"><i class="bi bi-chevron-${lineItems.isExpanded(rawSJ) ? 'down' : 'right'} me-1"></i>${displayId}</button><small class="d-block text-muted" style="font-size: 11px; font-weight: 400 !important;">${lineItems.itemsOf(t).length} item</small>` : `<a class="aerotrack-id-link font-monospace text-nowrap" style="font-size: 12px; font-weight: 400 !important;" onclick="UnifiedPoolUI.quickPreviewQR('${t.id}')" title="Klik untuk lihat QR Code">${displayId}</a>`}
          ` : `
            <span class="text-muted font-monospace" style="font-weight: 400 !important;">-</span>
          `}
        </td>
        <td style="width: 105px;">
          <span class="text-muted extra-small font-monospace" style="font-weight: 400 !important;">${String(t.adminSJ || '-').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</span>
        </td>
        <td style="width: 105px;">
          <div class="font-monospace text-dark extra-small d-flex align-items-center gap-1" style="font-weight: 400 !important;">
            <i class="bi bi-calendar3 text-muted"></i>
            <span>${t.date || '-'}</span>
          </div>
        </td>
        <td style="min-width: 170px; max-width: 250px;">
          <div class="text-dark" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.3; white-space: normal; word-break: break-word; text-transform: none; font-weight: 400 !important;" title="${customerText}">${customerText}</div>
        </td>
        <td style="min-width: 200px; max-width: 300px;">
          <div class="text-muted" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.35; font-size: 0.825rem; white-space: normal; word-break: break-word; text-transform: none; font-weight: 400 !important;" title="${addressText}">
            ${addressText}
          </div>
          ${workflow&&t.pendingNote ? `<small class="workflow-pending-note" style="font-weight: 400 !important;"><span class="text-muted">Note Kurir:</span> ${workflow.escape(t.pendingNote)}</small>` : ''}
        </td>
        <td style="width: 110px;">
          <span class="aerotrack-badge badge-primary" style="font-weight: 400 !important;">${t.region || 'Jabodetabek'}</span>
        </td>
        ${lineItems ? `<td style="font-weight: 400 !important;">${lineItems.renderWeight(t)}</td>` : ''}
        <td class="text-center" style="width: 120px;">
          ${t.priority==='urgent'?'<span class="badge bg-danger text-white mb-1" style="font-weight: 400 !important;">Urgent</span>':''}
          ${t.pickupStatus==='waiting'?'<span class="badge bg-primary-subtle text-primary border" style="font-weight: 400 !important;">Menunggu Pickup</span>':t.readyStatus === 'not_ready' ? `
            <span class="badge bg-secondary text-white extra-small px-2 py-1 d-inline-flex align-items-center gap-1 shadow-xs" style="font-weight: 400 !important;">
              <i class="bi bi-clock-history"></i> Belum Ready
            </span>
          ` : (t.isFailed ? `
            <span class="badge bg-danger text-white extra-small px-2 py-1 d-inline-flex align-items-center gap-1 shadow-xs" style="font-weight: 400 !important;" title="${t.pendingReason || 'Gagal / Pending'}">
              <i class="bi bi-x-circle-fill"></i> ${t.isPendingFromCourier ? 'Pending Kurir' : 'Gagal Kirim'}
            </span>
          ` : `
            <span class="badge bg-success-subtle text-success border border-success-subtle extra-small px-2 py-1 text-nowrap" style="font-weight: 400 !important;">Ready</span>
          `)}
        </td>
        <td class="text-center" style="width: 75px;">
          ${locBadge}
          ${branchState ? `<div class="mt-1" style="font-weight: 400 !important;">${branchState}</div>` : ''}
        </td>
        <td class="text-end text-nowrap" style="width: 210px;">
          <div class="d-inline-flex align-items-center justify-content-end gap-1 flex-nowrap">
            ${workflow ? `<button type="button" class="workflow-icon ${t.priority==='urgent'?'text-danger':''}" title="${t.priority==='urgent'?'Kembalikan prioritas normal':'Tandai Urgent'}" aria-label="${t.priority==='urgent'?'Kembalikan prioritas normal':'Tandai Urgent'}" onclick="DispatchWorkflow.toggleUrgent(this,${workflowRef},${t.priority!=='urgent'})">${workflow.icon('urgent')}</button>${t.pickupStatus==='waiting'?`<button type="button" class="btn btn-sm btn-outline-success extra-small text-nowrap" style="font-weight: 400 !important;" onclick="DispatchWorkflow.confirmPickup(${workflowRef})">Diambil</button><button type="button" class="workflow-icon" title="Batalkan pickup" aria-label="Batalkan pickup" onclick="DispatchWorkflow.cancelPickup(this,${workflowRef})">${workflow.icon('close')}</button>`:`<button type="button" class="workflow-icon" title="Pickup by Customer" aria-label="Pickup by Customer" onclick="DispatchWorkflow.requestPickup(this,${workflowRef})">${workflow.icon('pickup')}</button>`}` : ''}
            ${t.readyStatus === 'not_ready' ? `
              <button class="btn btn-sm btn-success py-1 px-2 aerotrack-input extra-small text-nowrap" style="font-weight: 400 !important;" onclick="UnifiedPoolUI.toggleReadyStatus('${t.id}', true)" title="Tandai Ready">Ready</button>
            ` : `
              <button class="btn btn-sm btn-outline-warning text-dark py-1 px-2 aerotrack-input extra-small text-nowrap" style="font-weight: 400 !important;" onclick="UnifiedPoolUI.toggleReadyStatus('${t.id}', false)" title="Tandai Belum Ready">Belum Ready</button>
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
      ${lineItems ? lineItems.renderDetail(t) : ''}
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

    // Driver Mobil / Truk (9 Personil)
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

  let assignmentBusy = false;
  async function saveAssignments(targets, courierSelect, options = {}) {
    if (assignmentBusy) return;
    assignmentBusy = true;
    try {
      const option = courierSelect.options[courierSelect.selectedIndex];
      const courier = {id:courierSelect.value, name:option.text.replace(/^[^\wA-Za-z]+/, '').trim(),
        vehicleType:option.getAttribute?.('data-type') || ''};
      const ids = [...new Set(targets.map(t => t.workflowRef?.tripId || t.originalTripId || t.tripId || t.id))];
      let assigned;
      if (window.WTRACK_LOCAL_SANDBOX) {
        const stored = JSON.parse(localStorage.getItem('wtrack_local_trips') || '[]');
        const now = new Date().toISOString();
        assigned = ids.map(id => {
          const source = stored.find(t => (t.id || t.tripId) === id);
          if (!source) throw Error('SJ tidak ditemukan. Muat ulang.');
          return window.SJAssignment.assignTrip(source,courier,options,now);
        });
        const replacements = new Map(assigned.map(t => [t.id || t.tripId,t]));
        const next = stored.map(t => replacements.get(t.id || t.tripId) || t);
        if (window.persistLocalSandboxTrips) await window.persistLocalSandboxTrips(next);
        else localStorage.setItem('wtrack_local_trips',JSON.stringify(next));
      } else {
        const db = typeof getDb === 'function' ? getDb() : window.getDb?.();
        assigned = await window.SJAssignment.assign(db,ids,courier,options);
      }
      // Update displays only after the entire server transaction succeeds.
      const updates = new Map(assigned.map(t => [t.id,t]));
      window.allPoolTrips = (window.allPoolTrips || []).filter(t => !updates.has(t.id || t.tripId));
      const current = (window.allCurrentTrips || []).filter(t => !updates.has(t.id || t.tripId));
      window.syncAllCurrentTrips?.([...current,...assigned]);
      window.showToast?.(`Berhasil menugaskan ${assigned.length} Surat Jalan ke ${courier.name}.`);
      renderUnifiedPoolView();
      window.renderRecentShipments?.();
      window.updateGlobalStats?.();
      return assigned;
    } catch (error) {
      alert('Penugasan belum disimpan: ' + error.message);
    } finally { assignmentBusy = false; }
  }

  async function executeQuickDispatch() {
    const region = document.getElementById('quick-dispatch-region')?.value || (activeRegionFilter !== 'ALL' ? activeRegionFilter : '');
    const select = document.getElementById('quick-dispatch-courier');
    if (!region || !select?.value) { alert('Pilih region dan kurir terlebih dahulu.'); return; }
    const targets = getTripsSource().filter(t => t.region === region && !t.courierId && !t.assignedTo &&
      t.readyStatus !== 'not_ready' && !t.pickupStatus && t.deliveryMethod !== 'customer_pickup' &&
      (activeDateFolder === 'ALL' || t.date === activeDateFolder) &&
      (activePrintLocationFilter === 'ALL' || t.printLocation === activePrintLocationFilter));
    if (!targets.length) { alert('Tidak ada SJ di region dan filter yang dipilih.'); return; }
    if (!confirm(`Tugaskan ${targets.length} SJ region ${region} ke ${select.options[select.selectedIndex].text}?`)) return;
    return saveAssignments(targets,select,{region,vehiclePlate:document.getElementById('quick-dispatch-vehicle')?.value || ''});
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
    document.querySelectorAll('.pool-checkbox').forEach(cb => cb.checked = source.checked && !cb.disabled);
    updateSelectionCount();
  }

  function updateSelectionCount() {
    const checked = document.querySelectorAll('.pool-checkbox:checked').length;
    const countEl = document.getElementById('pool-selected-count');
    if (countEl) {
      countEl.innerText = `${checked} dipilih`;
    }
    const bulkBar = document.getElementById('pool-bulk-bar');
    if (bulkBar) {
      bulkBar.classList.toggle('d-none', checked === 0);
      bulkBar.classList.toggle('d-flex', checked > 0);
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

  async function assignSelectedToCourier() {
    const select = document.getElementById('pool-bulk-courier');
    if (!select?.value) { alert('Pilih kurir terlebih dahulu.'); return; }
    const checked = Array.from(document.querySelectorAll('.pool-checkbox:checked')).map(cb => String(cb.value).trim());
    const targets = getTripsSource().filter(t => matchesTripIdentifier(t,checked));
    if (!targets.length) { alert('Pilih minimal satu SJ.'); return; }
    return saveAssignments(targets,select);
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
      const qrData = window.QRPrintDispatch.mapsPayload(t);
      if (!qrData) return alert('Isi alamat tujuan sebelum membuat QR Google Maps.');
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

  async function saveReadyStatuses(targets, isReady) {
    if (assignmentBusy) return;
    assignmentBusy = true;
    try {
      const ids = [...new Set(targets.map(t => t.workflowRef?.tripId || t.originalTripId || t.tripId || t.id))];
      if (!ids.length) throw Error('Pilih minimal satu SJ.');
      let updates;
      if (window.WTRACK_LOCAL_SANDBOX) {
        const stored = JSON.parse(localStorage.getItem('wtrack_local_trips') || '[]');
        updates = ids.map(id => {
          const trip = stored.find(t => (t.id || t.tripId) === id);
          if (!trip || trip.courierId || ['completed','done','delivered'].includes(trip.status)) throw Error('SJ tidak tersedia atau sudah ditugaskan.');
          return {...trip,readyStatus:isReady ? 'ready' : 'not_ready'};
        });
        const map = new Map(updates.map(t => [t.id || t.tripId,t]));
        const next = stored.map(t => map.get(t.id || t.tripId) || t);
        if (window.persistLocalSandboxTrips) await window.persistLocalSandboxTrips(next);
        else localStorage.setItem('wtrack_local_trips',JSON.stringify(next));
      } else {
        updates = await window.SJAssignment.setReady(window.getDb?.(),ids,isReady);
      }
      const map = new Map(updates.map(t => [t.id,t]));
      window.allPoolTrips = (window.allPoolTrips || []).map(t => map.get(t.id || t.tripId) || t);
      window.showToast?.(`${updates.length} SJ ditandai ${isReady ? 'Ready' : 'Belum Ready'}.`);
      renderUnifiedPoolView();
    } catch(error) { alert('Status Ready belum disimpan: ' + error.message); }
    finally { assignmentBusy = false; }
  }

  async function toggleReadyStatus(tripId, isReady) {
    return saveReadyStatuses(getTripsSource().filter(t => matchesTripId(t,tripId)),isReady);
  }

  async function bulkSetReadyStatus(isReady) {
    const checked = Array.from(document.querySelectorAll('.pool-checkbox:checked')).map(cb => cb.value);
    return saveReadyStatuses(getTripsSource().filter(t => checked.some(id => matchesTripId(t,id))),isReady);
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
    getTripsSource,
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
