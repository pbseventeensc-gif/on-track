// ==========================================================================
// WTRACK LOGISTICS - COURIER DAILY AUDIT & PENDING DISPATCH MAP MODULE
// ==========================================================================

let mapCourierAudit = null;
let courierAuditMarkersLayer = null;
let lastCourierAuditData = [];
let allPendingAuditStops = [];
let allFailedAuditStops = [];
let activeAuditCourierFilter = null;
let isCurrentAuditSingleDay = true;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initAuditDatePickers();
});

function initAuditDatePickers() {
    const todayStr = new Date().toISOString().slice(0, 10);
    const startInput = document.getElementById('audit-start-date');
    const endInput = document.getElementById('audit-end-date');
    if (startInput && !startInput.value) startInput.value = todayStr;
    if (endInput && !endInput.value) endInput.value = todayStr;
}

function formatTimeHHMM(ms) {
    if (!ms || isNaN(ms) || ms <= 0) return '-';
    const d = new Date(ms);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}

function formatDateKey(ms) {
    if (!ms) return '';
    const d = new Date(ms);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function formatDurationHoursMins(totalMins) {
    if (!totalMins || isNaN(totalMins) || totalMins <= 0) return '0j 0m';
    const hrs = Math.floor(totalMins / 60);
    const mins = Math.round(totalMins % 60);
    if (hrs > 0 && mins > 0) return `${hrs}j ${mins}m`;
    if (hrs > 0) return `${hrs}j`;
    return `${mins}m`;
}

function parseAuditTimestamp(timeObj) {
    if (!timeObj) return 0;
    if (typeof timeObj === 'number') return timeObj;
    if (timeObj.seconds !== undefined) return timeObj.seconds * 1000;
    if (timeObj._seconds !== undefined) return timeObj._seconds * 1000;
    if (typeof timeObj === 'string') {
        const d = new Date(timeObj);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    }
    if (timeObj instanceof Date) return timeObj.getTime();
    return 0;
}

// --------------------------------------------------------------------------
// 1. DATA COMPUTATION & AGGREGATION
// --------------------------------------------------------------------------
function calculateCourierDailyAudit(customStartDate = null, customEndDate = null) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const startDateVal = customStartDate || document.getElementById('audit-start-date')?.value || todayStr;
    const endDateVal = customEndDate || document.getElementById('audit-end-date')?.value || startDateVal;

    const isSingleDay = (startDateVal === endDateVal);
    isCurrentAuditSingleDay = isSingleDay;

    const vehicleFilter = document.getElementById('audit-vehicle-filter')?.value || 'all';

    let trips = (typeof allCurrentTrips !== 'undefined' && allCurrentTrips) ? allCurrentTrips : (window.allCurrentTrips || []);

    if (typeof isTripInActiveBranch === 'function') {
        trips = trips.filter(t => isTripInActiveBranch(t));
    }

    const startOfDayMs = new Date(startDateVal + "T00:00:00").getTime();
    const endOfDayMs = new Date(endDateVal + "T23:59:59.999").getTime();

    // Filter trips belonging to the selected date range
    const rangeTrips = trips.filter(t => {
        const tripMs = parseAuditTimestamp(t.date) || parseAuditTimestamp(t.assignedTime) || (t.id ? parseInt(t.id.replace('TRIP_', '')) || 0 : 0);
        return tripMs >= startOfDayMs && tripMs <= endOfDayMs;
    });

    const courierMap = {};
    const pendingList = [];
    const failedList = [];
    const allStopsRawLog = [];

    rangeTrips.forEach(t => {
        const cId = t.courierId || '';
        if (!cId) return;
        if (typeof isCourierInActiveBranch === 'function' && !isCourierInActiveBranch(cId)) return;
        if (cId.includes('EK74u0gA') || cId.toLowerCase().includes('novalgan')) return;

        const rawName = (typeof registeredUsers !== 'undefined' && registeredUsers[cId]) 
            ? registeredUsers[cId] 
            : (typeof getCourierDisplayName === 'function' ? getCourierDisplayName(cId) : cId);
        if (rawName.includes('EK74u0gA') || rawName.toLowerCase().includes('novalgan')) return;

        // Unified courier identity & vehicle mapping
        const courierInfo = (typeof normalizeCourierIdentity === 'function')
            ? normalizeCourierIdentity(cId, rawName)
            : { canonicalId: cId, displayName: rawName, vehicleType: t.vehicleType || 'motor' };

        const cCanonicalId = courierInfo.canonicalId;
        const cDisplayName = courierInfo.displayName;
        const vType = courierInfo.vehicleType || t.vehicleType || 'motor';

        if (vehicleFilter !== 'all' && vType !== vehicleFilter) return;

        if (!courierMap[cCanonicalId]) {
            courierMap[cCanonicalId] = {
                courierId: cCanonicalId,
                name: cDisplayName,
                vehicleType: vType,
                branch: (typeof activeBranch !== 'undefined' && activeBranch) ? activeBranch : 'Pusat',
                earliestAssignMs: Infinity,
                latestFinishMs: 0,
                dailyWorkMap: {}, // Maps YYYY-MM-DD -> { earliestAssign: ms, latestFinish: ms }
                deliveredCount: 0,
                failedCount: 0,
                pendingCount: 0,
                totalStops: 0,
                tripsCount: 0,
                pendingItems: [],
                failedItems: []
            };
        }

        const stats = courierMap[cCanonicalId];
        stats.tripsCount++;

        const tripAssignMs = parseAuditTimestamp(t.assignedTime) || parseAuditTimestamp(t.date) || parseAuditTimestamp(t.acceptedTime);
        const tripDateKey = formatDateKey(tripAssignMs);

        if (tripDateKey) {
            if (!stats.dailyWorkMap[tripDateKey]) {
                stats.dailyWorkMap[tripDateKey] = { earliestAssign: Infinity, latestFinish: 0 };
            }
            if (tripAssignMs > 0 && tripAssignMs < stats.dailyWorkMap[tripDateKey].earliestAssign) {
                stats.dailyWorkMap[tripDateKey].earliestAssign = tripAssignMs;
            }
        }

        if (tripAssignMs > 0 && tripAssignMs < stats.earliestAssignMs) {
            stats.earliestAssignMs = tripAssignMs;
        }

        // Process destinations with strict definitions of Terkirim vs Pending vs Gagal
        if (t.destinations && Array.isArray(t.destinations) && t.destinations.length > 0) {
            t.destinations.forEach((d, idx) => {
                stats.totalStops++;

                // 1. TERKIRIM (Done / Ada Bukti Foto Pengantaran)
                const isDelivered = (d.status === 'done' || (d.proofPhotoUrl && d.proofPhotoUrl.length > 0));

                // 2. PENDING = KURIR YANG MENGAJUKAN PENDINGAN DI SISTEM (Klien Tutup / Pending Approval / Ada Bukti Foto Pending)
                const hasPendingSubmission = !!(
                    d.status === 'pending_approval' ||
                    d.status === 'klien_tutup' ||
                    (d.pendingReason && typeof d.pendingReason === 'string' && d.pendingReason.trim().length > 0) ||
                    (d.pendingProofPhotoUrl && d.pendingProofPhotoUrl.length > 0)
                );
                const isPending = !isDelivered && hasPendingSubmission;

                // 3. GAGAL = MURNI KARENA TIDAK DIANTAR
                // (Paket belum terkirim dan TIDAK ADA pengajuan pending oleh kurir di sistem)
                const isFailed = !isDelivered && !isPending;

                const finishMs = parseAuditTimestamp(d.completedTime) || parseAuditTimestamp(d.arrivalTime);
                
                if (isDelivered && finishMs > 0) {
                    if (finishMs > stats.latestFinishMs) stats.latestFinishMs = finishMs;
                    
                    const finishDateKey = formatDateKey(finishMs) || tripDateKey;
                    if (finishDateKey) {
                        if (!stats.dailyWorkMap[finishDateKey]) {
                            stats.dailyWorkMap[finishDateKey] = { earliestAssign: Infinity, latestFinish: 0 };
                        }
                        if (finishMs > stats.dailyWorkMap[finishDateKey].latestFinish) {
                            stats.dailyWorkMap[finishDateKey].latestFinish = finishMs;
                        }
                    }
                }

                if (isDelivered) {
                    stats.deliveredCount++;
                } else if (isPending) {
                    // Masuk kategori PENDING karena kurir mengajukan di sistem
                    stats.pendingCount++;
                    const pItem = {
                        tripId: t.id || `TRIP_${idx}`,
                        stopIndex: d.stopIndex || (idx + 1),
                        dateStr: tripDateKey || startDateVal,
                        courierId: cCanonicalId,
                        courierName: cDisplayName,
                        vehicleType: vType,
                        locationName: d.locationName || d.name || d.recipientName || `Destinasi ${idx + 1}`,
                        address: d.address || d.fullAddress || '-',
                        region: d.region || t.region || 'Jabodetabek',
                        latitude: parseFloat(d.latitude || 0),
                        longitude: parseFloat(d.longitude || 0),
                        type: 'pending',
                        status: d.status === 'pending_approval' ? 'Pending Approval' : 'Pending (Diajukan Kurir)',
                        reason: d.pendingReason || (d.status === 'klien_tutup' ? 'Klien Tutup' : 'Toko Tutup / Klien Tutup (Diajukan Kurir)'),
                        proofPhotoUrl: d.pendingProofPhotoUrl || d.proofPhotoUrl || d.proofPhotoSj || d.photoUrl || '',
                        reportedTime: parseAuditTimestamp(d.arrivalTime) || parseAuditTimestamp(d.completedTime) || tripAssignMs
                    };
                    stats.pendingItems.push(pItem);
                    pendingList.push(pItem);
                } else if (isFailed) {
                    // Masuk kategori GAGAL karena murni tidak diantar
                    stats.failedCount++;
                    const fItem = {
                        tripId: t.id || `TRIP_${idx}`,
                        stopIndex: d.stopIndex || (idx + 1),
                        dateStr: tripDateKey || startDateVal,
                        courierId: cCanonicalId,
                        courierName: cDisplayName,
                        vehicleType: vType,
                        locationName: d.locationName || d.name || d.recipientName || `Destinasi ${idx + 1}`,
                        address: d.address || d.fullAddress || '-',
                        region: d.region || t.region || 'Jabodetabek',
                        latitude: parseFloat(d.latitude || 0),
                        longitude: parseFloat(d.longitude || 0),
                        type: 'failed',
                        status: d.status === 'canceled' ? 'Dibatalkan' : (d.status === 'rejected' ? 'Ditolak' : 'Gagal (Tidak Diantar)'),
                        reason: d.status === 'canceled' ? 'Dibatalkan' : (d.status === 'rejected' ? 'Ditolak' : 'Murni Tidak Diantar (Belum Sempat Didatangi)'),
                        proofPhotoUrl: '',
                        reportedTime: tripAssignMs
                    };
                    stats.failedItems.push(fItem);
                    failedList.push(fItem);
                }

                // Raw chronological audit log
                allStopsRawLog.push({
                    tripId: t.id || `TRIP_${idx}`,
                    date: tripDateKey || startDateVal,
                    courierName: cDisplayName,
                    vehicleType: vType,
                    stopIndex: idx + 1,
                    customer: d.locationName || '-',
                    address: d.address || '-',
                    region: d.region || t.region || '-',
                    status: isDelivered ? 'Terkirim (Done)' : (isPending ? 'Pending (Diajukan Kurir)' : 'Gagal (Tidak Diantar)'),
                    arrivalTime: formatTimeHHMM(parseAuditTimestamp(d.arrivalTime)),
                    completedTime: formatTimeHHMM(finishMs),
                    proofUrl: d.proofPhotoUrl || d.pendingProofPhotoUrl || ''
                });
            });
        }
    });

    // Compute effective working duration per active day
    const courierList = Object.values(courierMap).map(c => {
        let totalEffectiveMins = 0;
        let activeDaysCount = 0;
        let overtimeDaysCount = 0;

        Object.values(c.dailyWorkMap).forEach(day => {
            if (day.earliestAssign !== Infinity && day.latestFinish > day.earliestAssign) {
                const dayMins = Math.round((day.latestFinish - day.earliestAssign) / (60 * 1000));
                totalEffectiveMins += dayMins;
                activeDaysCount++;
                if (dayMins > 480) overtimeDaysCount++;
            }
        });

        // Fallback for single day if single trip
        if (activeDaysCount === 0 && c.earliestAssignMs !== Infinity && c.latestFinishMs > c.earliestAssignMs) {
            totalEffectiveMins = Math.round((c.latestFinishMs - c.earliestAssignMs) / (60 * 1000));
            activeDaysCount = 1;
            if (totalEffectiveMins > 480) overtimeDaysCount++;
        }

        const avgMinsPerDay = activeDaysCount > 0 ? Math.round(totalEffectiveMins / activeDaysCount) : 0;
        const successRate = c.totalStops > 0 ? Math.round((c.deliveredCount / c.totalStops) * 100) : 0;

        let col1Value = '-';
        let col2Value = '-';
        let col3Value = formatDurationHoursMins(totalEffectiveMins);

        if (isSingleDay) {
            col1Value = formatTimeHHMM(c.earliestAssignMs);
            col2Value = formatTimeHHMM(c.latestFinishMs);
            col3Value = formatDurationHoursMins(totalEffectiveMins);
        } else {
            col1Value = `${activeDaysCount} Hari Aktif`;
            col2Value = `Rata: ${formatDurationHoursMins(avgMinsPerDay)}/hari`;
            col3Value = `${formatDurationHoursMins(totalEffectiveMins)} Total`;
        }

        return {
            ...c,
            isSingleDay: isSingleDay,
            activeDaysCount: activeDaysCount,
            totalEffectiveMins: totalEffectiveMins,
            avgMinsPerDay: avgMinsPerDay,
            overtimeDaysCount: overtimeDaysCount,
            col1Value: col1Value,
            col2Value: col2Value,
            col3Value: col3Value,
            isOvertime: isSingleDay ? (totalEffectiveMins > 480) : (overtimeDaysCount > 0),
            successRate: successRate
        };
    });

    courierList.sort((a, b) => b.deliveredCount - a.deliveredCount);

    return {
        isSingleDay: isSingleDay,
        startDateStr: startDateVal,
        endDateStr: endDateVal,
        couriers: courierList,
        pendingList: pendingList,
        failedList: failedList,
        rawLogs: allStopsRawLog
    };
}

// --------------------------------------------------------------------------
// 2. RENDER TABLE & STATS
// --------------------------------------------------------------------------
function renderCourierAuditView() {
    const auditResult = calculateCourierDailyAudit();
    lastCourierAuditData = auditResult.couriers;
    allPendingAuditStops = auditResult.pendingList || [];
    allFailedAuditStops = auditResult.failedList || [];

    // 1. Update 4 KPI Summary Cards
    let totalDelivered = 0;
    let totalFailed = 0;
    let totalPending = 0;
    let totalEffectiveMins = 0;
    let couriersWithTimeCount = 0;

    lastCourierAuditData.forEach(c => {
        totalDelivered += c.deliveredCount;
        totalFailed += c.failedCount;
        totalPending += c.pendingCount;
        if (c.totalEffectiveMins > 0) {
            totalEffectiveMins += c.totalEffectiveMins;
            couriersWithTimeCount++;
        }
    });

    const totalStopsOverall = totalDelivered + totalFailed + totalPending;
    const overallRate = totalStopsOverall > 0 ? Math.round((totalDelivered / totalStopsOverall) * 100) : 0;
    const avgMins = couriersWithTimeCount > 0 ? Math.round(totalEffectiveMins / couriersWithTimeCount) : 0;

    const elDelivered = document.getElementById('audit-stat-delivered');
    const elDeliveredSub = document.getElementById('audit-stat-delivered-sub');
    const elFailed = document.getElementById('audit-stat-failed');
    const elFailedSub = document.getElementById('audit-stat-failed-sub');
    const elPending = document.getElementById('audit-stat-pending');
    const elPendingSub = document.getElementById('audit-stat-pending-sub');
    const elAvgHours = document.getElementById('audit-stat-avg-hours');
    const elAvgSub = document.getElementById('audit-stat-avg-sub');
    const elCourierCount = document.getElementById('audit-courier-count');

    if (elDelivered) elDelivered.innerText = totalDelivered.toLocaleString();
    if (elDeliveredSub) elDeliveredSub.innerText = `${overallRate}% dari total ${totalStopsOverall} pengantaran`;
    if (elFailed) elFailed.innerText = totalFailed.toLocaleString();
    if (elFailedSub) elFailedSub.innerText = totalFailed > 0 ? `${totalFailed} Paket murni tidak diantar` : 'Semua paket diantar kurir';
    if (elPending) elPending.innerText = totalPending.toLocaleString();
    if (elPendingSub) elPendingSub.innerText = totalPending > 0 ? `${totalPending} Paket diajukan kurir di sistem` : 'Tidak ada pengajuan pending';
    
    if (elAvgHours) {
        elAvgHours.innerText = auditResult.isSingleDay 
            ? formatDurationHoursMins(avgMins)
            : formatDurationHoursMins(totalEffectiveMins);
    }
    if (elAvgSub) {
        elAvgSub.innerText = auditResult.isSingleDay
            ? 'Rata-rata jam kerja per kurir'
            : `Total jam kerja akumulasi (${auditResult.startDateStr} s/d ${auditResult.endDateStr})`;
    }

    if (elCourierCount) elCourierCount.innerText = `${lastCourierAuditData.length} Kurir Aktif`;

    // 2. Adjust Table Headers based on Single Day vs Date Range
    updateAuditTableHeaders(auditResult.isSingleDay);

    // 3. Populate Courier Dropdown
    populateCourierSelectOptions();

    // 4. Render Table Body
    filterCourierAuditTable();

    // 5. Initialize & Render Map
    initCourierAuditMap();
    renderAuditMapMarkers(activeAuditCourierFilter);
}
window.renderCourierAuditView = renderCourierAuditView;

function populateCourierSelectOptions() {
    const sel = document.getElementById('audit-courier-select');
    if (!sel) return;
    const currentVal = activeAuditCourierFilter || sel.value;

    const sorted = [...lastCourierAuditData].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    const options = [`<option value="">👤 Semua Kurir (${lastCourierAuditData.length})</option>`];
    sorted.forEach(c => {
        const icon = c.vehicleType === 'mobil' ? '🚚' : '🛵';
        options.push(`<option value="${c.courierId}">${icon} ${c.name}</option>`);
    });

    sel.innerHTML = options.join('');
    if (currentVal && sorted.some(c => c.courierId === currentVal)) {
        sel.value = currentVal;
    } else {
        sel.value = "";
        activeAuditCourierFilter = null;
    }
}
window.populateCourierSelectOptions = populateCourierSelectOptions;

function onAuditCourierSelectChange() {
    const sel = document.getElementById('audit-courier-select');
    const selectedId = sel ? sel.value : "";
    activeAuditCourierFilter = selectedId || null;
    filterCourierAuditTable();
    renderAuditMapMarkers(activeAuditCourierFilter);
}
window.onAuditCourierSelectChange = onAuditCourierSelectChange;

function updateAuditTableHeaders(isSingleDay) {
    const thead = document.querySelector('#view-courier-audit table thead');
    if (!thead) return;

    if (isSingleDay) {
        thead.innerHTML = `
            <tr>
                <th>Kurir</th>
                <th>Assign Awal</th>
                <th>Upload Akhir</th>
                <th>Jam Efektif</th>
                <th class="text-center">Terkirim</th>
                <th class="text-center">Gagal</th>
                <th class="text-center">Pending</th>
                <th class="text-center">Peta</th>
            </tr>`;
    } else {
        thead.innerHTML = `
            <tr>
                <th>Kurir</th>
                <th>Kehadiran</th>
                <th>Rata-rata / Hari</th>
                <th>Total Jam Kerja</th>
                <th class="text-center">Terkirim</th>
                <th class="text-center">Gagal</th>
                <th class="text-center">Pending</th>
                <th class="text-center">Peta</th>
            </tr>`;
    }
}

function filterCourierAuditTable() {
    const tbody = document.getElementById('courier-audit-table-body');
    if (!tbody) return;

    const selectedCourierId = document.getElementById('audit-courier-select')?.value || activeAuditCourierFilter || "";
    const filtered = selectedCourierId 
        ? lastCourierAuditData.filter(c => c.courierId === selectedCourierId)
        : lastCourierAuditData;

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-5 text-muted extra-small">
                    <i class="bi bi-inbox fs-4 d-block mb-2 text-secondary opacity-50"></i>
                    Tidak ada data kurir untuk filter yang dipilih.
                </td>
            </tr>`;
        return;
    }

    let rowsHtml = '';
    filtered.forEach(c => {
        const vBadge = c.vehicleType === 'mobil' 
            ? `<span class="badge bg-primary-subtle text-primary border border-primary-subtle extra-small ms-1"><i class="bi bi-truck me-0.5"></i> Mobil</span>`
            : `<span class="badge bg-secondary-subtle text-secondary border extra-small ms-1"><i class="bi bi-bicycle me-0.5"></i> Motor</span>`;

        let statusBadge = '';
        if (c.isSingleDay) {
            statusBadge = c.isOvertime 
                ? `<span class="badge bg-danger-subtle text-danger border border-danger-subtle extra-small" title="Melebihi 8 Jam">Lembur</span>`
                : `<span class="badge bg-light text-muted border extra-small">Normal</span>`;
        } else {
            statusBadge = c.overtimeDaysCount > 0 
                ? `<span class="badge bg-danger-subtle text-danger border border-danger-subtle extra-small" title="${c.overtimeDaysCount} hari lembur">${c.overtimeDaysCount}x Lembur</span>`
                : `<span class="badge bg-light text-muted border extra-small">Normal</span>`;
        }

        const isActiveFilter = (activeAuditCourierFilter === c.courierId);
        const hasFailed = c.failedCount > 0;
        let activeRowStyle = '';
        if (isActiveFilter) {
            activeRowStyle = 'style="background-color: #F0FDF4; font-weight: 600;"';
        } else if (hasFailed) {
            activeRowStyle = 'style="background-color: #FFF5F5;"';
        }

        rowsHtml += `
            <tr ${activeRowStyle}>
                <td>
                    <div class="fw-bold ${hasFailed ? 'text-danger' : 'text-dark'} d-flex align-items-center">
                        ${c.name}
                        ${vBadge}
                        ${hasFailed ? '<span class="badge bg-danger text-white extra-small ms-1.5 py-0.5 px-1.5"><i class="bi bi-exclamation-triangle-fill me-0.5"></i>Ada Gagal</span>' : ''}
                    </div>
                    <small class="text-muted extra-small">ID: ${c.courierId.substring(0, 10)}</small>
                </td>
                <td>
                    <span class="badge bg-light text-dark border font-monospace px-2 py-1">${c.col1Value}</span>
                </td>
                <td>
                    <span class="badge bg-light text-dark border font-monospace px-2 py-1">${c.col2Value}</span>
                </td>
                <td>
                    <div class="d-flex align-items-center gap-1.5">
                        <span class="fw-bold text-primary">${c.col3Value}</span>
                        ${statusBadge}
                    </div>
                </td>
                <td class="text-center">
                    <span class="badge bg-success-subtle text-success px-2.5 py-1 fw-bold fs-7">${c.deliveredCount}</span>
                </td>
                <td class="text-center">
                    <span class="badge ${hasFailed ? 'bg-danger text-white fw-bold shadow-sm' : 'bg-light text-muted border'} px-2.5 py-1">${c.failedCount}</span>
                </td>
                <td class="text-center">
                    <span class="badge ${c.pendingCount > 0 ? 'bg-warning-subtle text-warning-emphasis fw-bold' : 'bg-light text-muted border'} px-2 py-1">${c.pendingCount}</span>
                </td>
                <td class="text-center">
                    <button class="btn btn-xs ${isActiveFilter ? 'btn-success' : 'btn-outline-primary'} py-1 px-2.5 rounded-pill extra-small fw-bold" onclick="focusCourierOnAuditMap('${c.courierId}')" title="Lihat Titik Kendala di Peta">
                        <i class="bi bi-geo-alt-fill me-1"></i>${isActiveFilter ? 'Aktif' : 'Peta'}
                    </button>
                </td>
            </tr>`;
    });

    tbody.innerHTML = rowsHtml;
}
window.filterCourierAuditTable = filterCourierAuditTable;

// --------------------------------------------------------------------------
// 3. INTERACTIVE PENDING MAP (LEAFLET)
// --------------------------------------------------------------------------
function initCourierAuditMap() {
    const mapEl = document.getElementById('courier-audit-map');
    if (!mapEl || typeof L === 'undefined') return;

    if (!mapCourierAudit) {
        mapCourierAudit = L.map('courier-audit-map', {
            center: [-6.2088, 106.8456],
            zoom: 11,
            zoomControl: true
        });

        if (typeof addMapTileLayer === 'function') {
            addMapTileLayer(mapCourierAudit);
        } else {
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; OpenStreetMap'
            }).addTo(mapCourierAudit);
        }

        courierAuditMarkersLayer = L.layerGroup().addTo(mapCourierAudit);
    }

    setTimeout(() => {
        if (mapCourierAudit) mapCourierAudit.invalidateSize();
    }, 200);
}

function renderAuditMapMarkers(courierIdFilter = null) {
    if (!mapCourierAudit || !courierAuditMarkersLayer) return;

    courierAuditMarkersLayer.clearLayers();

    const pendingStops = courierIdFilter 
        ? allPendingAuditStops.filter(p => p.courierId === courierIdFilter)
        : allPendingAuditStops;
    const failedStops = courierIdFilter 
        ? allFailedAuditStops.filter(f => f.courierId === courierIdFilter)
        : allFailedAuditStops;
    
    // Combine failed first, then pending
    const combinedIssues = [...failedStops, ...pendingStops];

    const listContainer = document.getElementById('audit-pending-list-container');
    const badgeCount = document.getElementById('audit-pending-badge-count');
    const subtitle = document.getElementById('audit-map-subtitle');

    if (badgeCount) badgeCount.innerText = `${combinedIssues.length} Titik Kendala (${failedStops.length} Gagal, ${pendingStops.length} Pending)`;
    if (subtitle) {
        subtitle.innerText = courierIdFilter 
            ? `Filter: Menampilkan ${combinedIssues.length} kendala kurir ini (${failedStops.length} gagal, ${pendingStops.length} pending)`
            : `Menampilkan seluruh ${combinedIssues.length} titik kendala (${failedStops.length} gagal, ${pendingStops.length} pending)`;
    }

    if (combinedIssues.length === 0) {
        if (listContainer) {
            listContainer.innerHTML = `<div class="text-success extra-small text-center py-3 bg-white rounded border"><i class="bi bi-check-circle-fill me-1"></i> Tidak ada paket gagal ataupun pending. Semua terselesaikan!</div>`;
        }
        return;
    }

    const bounds = L.latLngBounds([]);
    let listHtml = '';

    combinedIssues.forEach((item, idx) => {
        const hasCoords = (item.latitude && item.longitude && !isNaN(item.latitude) && !isNaN(item.longitude) && item.latitude !== 0);
        const isFail = item.type === 'failed';
        const pinColor = isFail ? '#DC2626' : '#EA580C';
        const pinBadge = isFail 
            ? `<span class="badge bg-danger-subtle text-danger extra-small fw-bold">Gagal (Tidak Diantar)</span>`
            : `<span class="badge bg-warning-subtle text-warning-emphasis extra-small fw-bold">Pending (Diajukan Kurir)</span>`;

        if (hasCoords) {
            bounds.extend([item.latitude, item.longitude]);

            const iconHtml = `
                <div style="background-color: ${pinColor}; width: 28px; height: 28px; border-radius: 50%; border: 3px solid #FFF; box-shadow: 0 3px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 11px;">
                    ${isFail ? '❌' : (idx + 1)}
                </div>`;

            const customMarkerIcon = L.divIcon({
                className: 'custom-issue-pin',
                html: iconHtml,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
                popupAnchor: [0, -14]
            });

            const marker = L.marker([item.latitude, item.longitude], { icon: customMarkerIcon });

            const podBtn = item.proofPhotoUrl 
                ? `<button class="btn btn-xs btn-outline-danger w-100 py-1 extra-small rounded-2 fw-bold mt-2" onclick="openPoDModal('${item.proofPhotoUrl}')"><i class="bi bi-camera me-1"></i>Lihat Foto Kendala</button>`
                : '';

            const popupContent = `
                <div style="min-width: 220px; font-size: 0.8rem; font-family: inherit;">
                    <div class="d-flex align-items-center justify-content-between mb-1">
                        <span class="fw-bold text-dark" style="font-size: 0.875rem;">${item.locationName}</span>
                        ${pinBadge}
                    </div>
                    <div class="text-muted extra-small mb-1"><i class="bi bi-geo-alt me-1 text-danger"></i>${item.address}</div>
                    <div class="d-flex align-items-center justify-content-between mt-2 pt-2 border-top extra-small">
                        <span class="text-muted">Kurir:</span>
                        <span class="fw-bold text-dark">${item.courierName}</span>
                    </div>
                    <div class="d-flex align-items-center justify-content-between mt-1 extra-small">
                        <span class="${isFail ? 'text-danger' : 'text-warning-emphasis'} fw-semibold">Status:</span>
                        <span class="text-dark fw-bold">${item.reason}</span>
                    </div>
                    <div class="text-muted extra-small mt-1"><i class="bi bi-calendar3 me-1"></i>${item.dateStr || ''}</div>
                    ${podBtn}
                </div>`;

            marker.bindPopup(popupContent);
            courierAuditMarkersLayer.addLayer(marker);
        }

        listHtml += `
            <div class="card border rounded-3 p-2 bg-white shadow-2fs cursor-pointer" onclick="zoomToPendingStop(${item.latitude}, ${item.longitude})" style="border-left: 3px solid ${pinColor} !important;">
                <div class="d-flex align-items-center justify-content-between">
                    <span class="fw-bold text-dark extra-small text-truncate" style="max-width: 170px;">${idx + 1}. ${item.locationName}</span>
                    ${pinBadge}
                </div>
                <div class="text-muted extra-small text-truncate mt-0.5">${item.address}</div>
                <div class="d-flex align-items-center justify-content-between mt-1 text-muted extra-small" style="font-size: 0.7rem;">
                    <span><i class="bi bi-person me-1"></i>${item.courierName}</span>
                    <span class="${isFail ? 'text-danger' : 'text-warning-emphasis'} fw-semibold">${item.reason}</span>
                </div>
            </div>`;
    });

    if (listContainer) listContainer.innerHTML = listHtml;

    if (bounds.isValid()) {
        mapCourierAudit.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
}

function zoomToPendingStop(lat, lng) {
    if (!mapCourierAudit || !lat || !lng) return;
    mapCourierAudit.setView([lat, lng], 15, { animate: true });
}
window.zoomToPendingStop = zoomToPendingStop;

function focusCourierOnAuditMap(courierId) {
    if (activeAuditCourierFilter === courierId) {
        activeAuditCourierFilter = null;
    } else {
        activeAuditCourierFilter = courierId;
    }
    const sel = document.getElementById('audit-courier-select');
    if (sel) sel.value = activeAuditCourierFilter || "";
    filterCourierAuditTable();
    renderAuditMapMarkers(activeAuditCourierFilter);
}
window.focusCourierOnAuditMap = focusCourierOnAuditMap;

function resetCourierAuditMapFilter() {
    activeAuditCourierFilter = null;
    const sel = document.getElementById('audit-courier-select');
    if (sel) sel.value = "";
    filterCourierAuditTable();
    renderAuditMapMarkers(null);
}
window.resetCourierAuditMapFilter = resetCourierAuditMapFilter;

// --------------------------------------------------------------------------
// 4. ENTERPRISE SINGLE-SHEET EXCEL EXPORT (EXECUTIVE STYLED, GROUPED MOBIL & MOTOR + RINCIAN KLIEN PENDING)
// --------------------------------------------------------------------------
async function exportCourierAuditToExcel() {
    const auditResult = calculateCourierDailyAudit();
    const couriers = auditResult.couriers;
    const isSingle = auditResult.isSingleDay;
    const pendingList = auditResult.pendingList || [];
    const failedList = auditResult.failedList || [];
    const periodLabel = isSingle 
        ? auditResult.startDateStr 
        : `${auditResult.startDateStr} s/d ${auditResult.endDateStr}`;

    if (!couriers || couriers.length === 0) {
        return alert(`Tidak ada data audit kurir pada periode ${periodLabel} untuk diekspor.`);
    }

    // Split into Mobil & Motor
    const mobilCouriers = couriers.filter(c => c.vehicleType === 'mobil');
    const motorCouriers = couriers.filter(c => c.vehicleType !== 'mobil');

    // Totals calculation
    const totMobilStops = mobilCouriers.reduce((s, c) => s + c.totalStops, 0);
    const totMobilDelivered = mobilCouriers.reduce((s, c) => s + c.deliveredCount, 0);
    const totMobilPending = mobilCouriers.reduce((s, c) => s + c.pendingCount, 0);
    const totMobilFailed = mobilCouriers.reduce((s, c) => s + c.failedCount, 0);
    const rateMobil = totMobilStops > 0 ? ((totMobilDelivered / totMobilStops) * 100).toFixed(1) + '%' : '0%';

    const totMotorStops = motorCouriers.reduce((s, c) => s + c.totalStops, 0);
    const totMotorDelivered = motorCouriers.reduce((s, c) => s + c.deliveredCount, 0);
    const totMotorPending = motorCouriers.reduce((s, c) => s + c.pendingCount, 0);
    const totMotorFailed = motorCouriers.reduce((s, c) => s + c.failedCount, 0);
    const rateMotor = totMotorStops > 0 ? ((totMotorDelivered / totMotorStops) * 100).toFixed(1) + '%' : '0%';

    const grandStops = couriers.reduce((s, c) => s + c.totalStops, 0);
    const grandDelivered = couriers.reduce((s, c) => s + c.deliveredCount, 0);
    const grandPending = couriers.reduce((s, c) => s + c.pendingCount, 0);
    const grandFailed = couriers.reduce((s, c) => s + c.failedCount, 0);
    const grandRate = grandStops > 0 ? ((grandDelivered / grandStops) * 100).toFixed(1) + '%' : '0%';

    // Use ExcelJS if available for 100% styled output with title, colors, and borders
    if (typeof ExcelJS !== 'undefined') {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "Wtrack Logistics";
        workbook.created = new Date();

        const sheet = workbook.addWorksheet("Audit_Operasional", {
            views: [{ showGridLines: true }]
        });

        // 1. Title Row (Row 1)
        sheet.mergeCells('A1:L1');
        const titleCell = sheet.getCell('A1');
        titleCell.value = "LAPORAN AUDIT & PERFORMA OPERASIONAL DISTRIBUSI LOGISTIK";
        titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1F4E79' } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
        sheet.getRow(1).height = 24;

        // 2. Subtitle Row (Row 2)
        sheet.mergeCells('A2:L2');
        const subCell = sheet.getCell('A2');
        subCell.value = `Periode: ${periodLabel}  |  Cabang: Wellen Pusat  |  Rekapitulasi Terpadu Armada Mobil & Motor`;
        subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF595959' } };
        subCell.alignment = { vertical: 'middle', horizontal: 'left' };
        sheet.getRow(2).height = 18;

        // Row 3: Blank separator
        sheet.getRow(3).height = 8;

        // 3. Header Row (Row 4)
        const headerRow = sheet.getRow(4);
        headerRow.height = 28;
        const headers = isSingle ? [
            "No", "Alokasi Driver / Kurir", "Tipe Armada", "Jam Penugasan Awal", 
            "Jam Upload Akhir", "Total Jam Kerja", "Status Lembur", "Total Titik (Stops)", 
            "Terkirim (Sukses)", "Gagal (Tidak Diantar)", "Pending (Diajukan Kurir)", "Persentase Sukses"
        ] : [
            "No", "Alokasi Driver / Kurir", "Tipe Armada", "Hari Aktif", 
            "Rata Jam / Hari", "Total Jam Kerja", "Hari Lembur", "Total Titik (Stops)", 
            "Terkirim (Sukses)", "Gagal (Tidak Diantar)", "Pending (Diajukan Kurir)", "Persentase Sukses"
        ];

        headers.forEach((h, idx) => {
            const cell = headerRow.getCell(idx + 1);
            cell.value = h;
            cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1F4E79' } // Dark Navy
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF1F4E79' } },
                left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                bottom: { style: 'medium', color: { argb: 'FF0F2C59' } },
                right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
            };
        });

        const thinBorder = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        let currentRowIndex = 5;

        // Group 1: ARMADA MOBIL
        if (mobilCouriers.length > 0) {
            mobilCouriers.forEach((c, idx) => {
                const row = sheet.getRow(currentRowIndex++);
                row.height = 20;
                const hasFailed = c.failedCount > 0;
                const rowData = [
                    idx + 1,
                    c.name,
                    "Mobil",
                    c.col1Value,
                    c.col2Value,
                    c.col3Value,
                    c.isOvertime ? "Lembur (>8 Jam)" : "Normal (≤8 Jam)",
                    c.totalStops,
                    c.deliveredCount,
                    c.failedCount,
                    c.pendingCount,
                    `${c.successRate}%`
                ];

                rowData.forEach((val, cIdx) => {
                    const cell = row.getCell(cIdx + 1);
                    cell.value = val;
                    cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };
                    cell.border = thinBorder;

                    // Tint row subtly if courier has failed deliveries
                    if (hasFailed) {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFFFF5F5' } // Very soft alert tint
                        };
                    }

                    if (cIdx === 1) {
                        cell.alignment = { vertical: 'middle', horizontal: 'left' };
                        cell.font = { name: 'Calibri', size: 10, bold: true, color: hasFailed ? { argb: 'FF991B1B' } : { argb: 'FF1E293B' } };
                    } else if (cIdx === 9 && val > 0) {
                        // OTOMATIS WARNA BLOK MERAH JIKA ADA GAGAL ANTAR
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFFFC7CE' } // Soft bright red block (Excel alert standard)
                        };
                        cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF9C0006' } };
                        cell.border = {
                            top: { style: 'thin', color: { argb: 'FFF87171' } },
                            bottom: { style: 'thin', color: { argb: 'FFF87171' } },
                            left: { style: 'thin', color: { argb: 'FFF87171' } },
                            right: { style: 'thin', color: { argb: 'FFF87171' } }
                        };
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    } else {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    }
                });
            });

            // Subtotal Mobil Row
            const subMobilRow = sheet.getRow(currentRowIndex++);
            subMobilRow.height = 22;
            const subMobilData = [
                "SUBTOTAL",
                `Khusus Armada Mobil (${mobilCouriers.length} Driver)`,
                "Mobil",
                "-",
                "-",
                "-",
                "-",
                totMobilStops,
                totMobilDelivered,
                totMobilFailed,
                totMobilPending,
                rateMobil
            ];
            subMobilData.forEach((val, cIdx) => {
                const cell = subMobilRow.getCell(cIdx + 1);
                cell.value = val;
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1F4E79' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFEBF3FA' } // Soft pastel ice blue
                };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FF94A3B8' } },
                    bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                };
                if (cIdx === 9 && val > 0) {
                    // Blok merah pada subtotal jika ada gagal
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFFC7CE' }
                    };
                    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF9C0006' } };
                }
                cell.alignment = { vertical: 'middle', horizontal: cIdx === 1 ? 'left' : 'center' };
            });
        }

        // Group 2: ARMADA MOTOR
        if (motorCouriers.length > 0) {
            motorCouriers.forEach((c, idx) => {
                const row = sheet.getRow(currentRowIndex++);
                row.height = 20;
                const hasFailed = c.failedCount > 0;
                const rowData = [
                    idx + 1,
                    c.name,
                    "Motor",
                    c.col1Value,
                    c.col2Value,
                    c.col3Value,
                    c.isOvertime ? "Lembur (>8 Jam)" : "Normal (≤8 Jam)",
                    c.totalStops,
                    c.deliveredCount,
                    c.failedCount,
                    c.pendingCount,
                    `${c.successRate}%`
                ];

                rowData.forEach((val, cIdx) => {
                    const cell = row.getCell(cIdx + 1);
                    cell.value = val;
                    cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };
                    cell.border = thinBorder;

                    // Tint row subtly if courier has failed deliveries
                    if (hasFailed) {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFFFF5F5' } // Very soft alert tint
                        };
                    }

                    if (cIdx === 1) {
                        cell.alignment = { vertical: 'middle', horizontal: 'left' };
                        cell.font = { name: 'Calibri', size: 10, bold: true, color: hasFailed ? { argb: 'FF991B1B' } : { argb: 'FF1E293B' } };
                    } else if (cIdx === 9 && val > 0) {
                        // OTOMATIS WARNA BLOK MERAH JIKA ADA GAGAL ANTAR
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFFFC7CE' } // Soft bright red block (Excel alert standard)
                        };
                        cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF9C0006' } };
                        cell.border = {
                            top: { style: 'thin', color: { argb: 'FFF87171' } },
                            bottom: { style: 'thin', color: { argb: 'FFF87171' } },
                            left: { style: 'thin', color: { argb: 'FFF87171' } },
                            right: { style: 'thin', color: { argb: 'FFF87171' } }
                        };
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    } else {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    }
                });
            });

            // Subtotal Motor Row
            const subMotorRow = sheet.getRow(currentRowIndex++);
            subMotorRow.height = 22;
            const subMotorData = [
                "SUBTOTAL",
                `Khusus Armada Motor (${motorCouriers.length} Kurir)`,
                "Motor",
                "-",
                "-",
                "-",
                "-",
                totMotorStops,
                totMotorDelivered,
                totMotorFailed,
                totMotorPending,
                rateMotor
            ];
            subMotorData.forEach((val, cIdx) => {
                const cell = subMotorRow.getCell(cIdx + 1);
                cell.value = val;
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1F4E79' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFEBF3FA' } // Soft pastel ice blue
                };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FF94A3B8' } },
                    bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                };
                if (cIdx === 9 && val > 0) {
                    // Blok merah pada subtotal jika ada gagal
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFFC7CE' }
                    };
                    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF9C0006' } };
                }
                cell.alignment = { vertical: 'middle', horizontal: cIdx === 1 ? 'left' : 'center' };
            });
        }

        // Grand Total Row
        const grandRow = sheet.getRow(currentRowIndex++);
        grandRow.height = 24;
        const grandData = [
            "GRAND TOTAL",
            `Seluruh Armada (${couriers.length} Driver & Kurir In-House)`,
            "Gabungan",
            "-",
            "-",
            "-",
            "-",
            grandStops,
            grandDelivered,
            grandFailed,
            grandPending,
            grandRate
        ];
        grandData.forEach((val, cIdx) => {
            const cell = grandRow.getCell(cIdx + 1);
            cell.value = val;
            cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F2C59' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD9E1F2' } // Distinctive light corporate blue
            };
            cell.border = {
                top: { style: 'medium', color: { argb: 'FF1F4E79' } },
                bottom: { style: 'double', color: { argb: 'FF0F2C59' } }, // Financial double underline
                left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
            };
            if (cIdx === 9 && val > 0) {
                // Blok merah pada grand total jika ada gagal
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFFC7CE' }
                };
                cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF9C0006' } };
            }
            cell.alignment = { vertical: 'middle', horizontal: cIdx === 1 ? 'left' : 'center' };
        });

        const topTableEndRow = currentRowIndex - 1;

        // Add native Excel conditional formatting rule for automatic red block on column J (Gagal) for driver summary only
        try {
            sheet.addConditionalFormatting({
                ref: `J5:J${topTableEndRow}`,
                rules: [
                    {
                        type: 'cellIs',
                        operator: 'greaterThan',
                        formulae: ['0'],
                        style: {
                            fill: {
                                type: 'pattern',
                                pattern: 'solid',
                                bgColor: { argb: 'FFFFC7CE' },
                                fgColor: { argb: 'FFFFC7CE' }
                            },
                            font: {
                                color: { argb: 'FF9C0006' },
                                bold: true
                            }
                        }
                    }
                ]
            });
        } catch(cfErr) {
            console.warn("Excel conditional formatting error:", cfErr);
        }

        // Blank Row
        sheet.getRow(currentRowIndex++).height = 12;

        // Catatan & Ringkasan Operasional (Bottom section like in reference image!)
        const noteHeaderRow = sheet.getRow(currentRowIndex++);
        noteHeaderRow.getCell(1).value = "Catatan & Ringkasan Operasional:";
        noteHeaderRow.getCell(1).font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF1F4E79' }, underline: true };

        const note1Row = sheet.getRow(currentRowIndex++);
        note1Row.getCell(1).value = `1. Evaluasi Pengantaran: Total ${grandStops} paket ditugaskan, ${grandDelivered} paket sukses terkirim (${grandRate} keberhasilan).`;
        note1Row.getCell(1).font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: 'FF475569' } };

        const failedCouriersList = couriers.filter(c => c.failedCount > 0);
        let failedNoteText = `2. Paket Gagal (Murni Tidak Diantar): Terdata ${grandFailed} paket gagal karena tidak sempat didatangi/diantar kurir.`;
        if (failedCouriersList.length > 0) {
            const namesWithFailed = failedCouriersList.map(c => `${c.name} (${c.failedCount} pkt)`).join(', ');
            failedNoteText += ` Kurir bersangkutan: ${namesWithFailed}.`;
        } else {
            failedNoteText += ` Tidak ada paket gagal (seluruh paket dikunjungi/diantar).`;
        }
        const note2Row = sheet.getRow(currentRowIndex++);
        note2Row.getCell(1).value = failedNoteText;
        note2Row.getCell(1).font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: 'FF475569' } };

        const pendingCouriersList = couriers.filter(c => c.pendingCount > 0);
        let pendingNoteText = `3. Pengajuan Pending (Diajukan Kurir): Terdata ${grandPending} paket diajukan pending oleh kurir di sistem (klien tutup/reschedule).`;
        if (pendingCouriersList.length > 0) {
            const namesWithPending = pendingCouriersList.map(c => `${c.name} (${c.pendingCount} pkt)`).join(', ');
            pendingNoteText += ` Kurir bersangkutan: ${namesWithPending}.`;
        } else {
            pendingNoteText += ` Tidak ada pengajuan pending oleh kurir di sistem.`;
        }
        const note3Row = sheet.getRow(currentRowIndex++);
        note3Row.getCell(1).value = pendingNoteText;
        note3Row.getCell(1).font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: 'FF475569' } };

        const overtimeCouriers = couriers.filter(c => c.isOvertime);
        let overtimeNoteText = `4. Jam Kerja & Lembur: `;
        if (overtimeCouriers.length > 0) {
            overtimeNoteText += `Terdapat ${overtimeCouriers.length} personel yang bekerja lembur (>8 jam): ${overtimeCouriers.map(c => `${c.name} (${c.col3Value})`).join(', ')}.`;
        } else {
            overtimeNoteText += `Seluruh armada bekerja dalam durasi normal (≤8 jam).`;
        }
        const note4Row = sheet.getRow(currentRowIndex++);
        note4Row.getCell(1).value = overtimeNoteText;
        note4Row.getCell(1).font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: 'FF475569' } };

        // ------------------------------------------------------------------
        // SECTION 2: RINCIAN KLIEN PENDING (DIAJUKAN KURIR / KLIEN TUTUP)
        // ------------------------------------------------------------------
        // Blank Separator Row
        sheet.getRow(currentRowIndex++).height = 14;

        // Section Title Banner Row (A:L merged)
        const pendingBannerRowIdx = currentRowIndex++;
        const pendingBannerRow = sheet.getRow(pendingBannerRowIdx);
        pendingBannerRow.height = 24;
        sheet.mergeCells(`A${pendingBannerRowIdx}:L${pendingBannerRowIdx}`);
        for (let c = 1; c <= 12; c++) {
            pendingBannerRow.getCell(c).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFB45309' } // Elegant Amber-700
            };
        }
        const pendingBannerCell = pendingBannerRow.getCell(1);
        pendingBannerCell.value = `DAFTAR RINCIAN KLIEN PENDING (DIAJUKAN KURIR / KLIEN TUTUP)`;
        pendingBannerCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        pendingBannerCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

        // Subtitle / Info Row (A:L merged)
        const pendingSubRowIdx = currentRowIndex++;
        const pendingSubRow = sheet.getRow(pendingSubRowIdx);
        pendingSubRow.height = 20;
        sheet.mergeCells(`A${pendingSubRowIdx}:L${pendingSubRowIdx}`);
        for (let c = 1; c <= 12; c++) {
            const cell = pendingSubRow.getCell(c);
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFEF3C7' } // Light warm amber
            };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFF59E0B' } },
                bottom: { style: 'thin', color: { argb: 'FFF59E0B' } }
            };
        }
        const pendingSubCell = pendingSubRow.getCell(1);
        pendingSubCell.value = `Total Klien Pending: ${pendingList.length} Titik  |  Klien di bawah ini dilaporkan kendala/toko tutup oleh armada dan memerlukan tindak lanjut CS`;
        pendingSubCell.font = { name: 'Calibri', size: 9.5, italic: true, bold: true, color: { argb: 'FF92400E' } };
        pendingSubCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

        // Pending Table Column Headers Row
        const pendingHeaderRow = sheet.getRow(currentRowIndex++);
        pendingHeaderRow.height = 26;
        const pendingHeaders = [
            "No",
            "Nama Klien / Toko",
            "Armada",
            "Kurir Pelapor",
            "Wilayah",
            "Waktu Lapor",
            "Alamat Lengkap Klien",
            "ID Trip / Stop",
            "Status Laporan",
            "Alasan / Kendala Kurir",
            "Rekomendasi Tindak Lanjut",
            "Bukti Foto PoD"
        ];

        pendingHeaders.forEach((h, idx) => {
            const cell = pendingHeaderRow.getCell(idx + 1);
            cell.value = h;
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF78350F' } // Deep Warm Brown-Amber Header
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF78350F' } },
                left: { style: 'thin', color: { argb: 'FFD97706' } },
                bottom: { style: 'medium', color: { argb: 'FF451A03' } },
                right: { style: 'thin', color: { argb: 'FFD97706' } }
            };
        });

        if (pendingList.length === 0) {
            // Row if 0 pending
            const emptyPendingRowIdx = currentRowIndex++;
            const emptyRow = sheet.getRow(emptyPendingRowIdx);
            emptyRow.height = 26;
            sheet.mergeCells(`A${emptyPendingRowIdx}:L${emptyPendingRowIdx}`);
            for (let c = 1; c <= 12; c++) {
                const cell = emptyRow.getCell(c);
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF0FDF4' } // Soft Green
                };
                cell.border = thinBorder;
            }
            const emptyCell = emptyRow.getCell(1);
            emptyCell.value = "✅ Tidak ada klien pending pada periode ini. Seluruh pengiriman berhasil diselesaikan ke klien tanpa kendala.";
            emptyCell.font = { name: 'Calibri', size: 10, italic: true, bold: true, color: { argb: 'FF166534' } };
            emptyCell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
            // Sort pending list: Mobil first, then Motor, then courier name
            const sortedPending = [...pendingList].sort((a, b) => {
                if (a.vehicleType !== b.vehicleType) {
                    return a.vehicleType === 'mobil' ? -1 : 1;
                }
                return (a.courierName || '').localeCompare(b.courierName || '');
            });

            sortedPending.forEach((p, idx) => {
                const pRow = sheet.getRow(currentRowIndex++);
                pRow.height = 26;
                const isEven = (idx % 2 === 0);
                const bgArgb = isEven ? 'FFFFFFFF' : 'FFFFFBEB'; // Alternate subtle amber-white

                let timeStr = '-';
                if (p.reportedTime && p.reportedTime > 0) {
                    timeStr = isSingle 
                        ? `${formatTimeHHMM(p.reportedTime)} WIB` 
                        : `${p.dateStr || ''} ${formatTimeHHMM(p.reportedTime)}`;
                }

                const pRowData = [
                    idx + 1,
                    p.locationName || `Destinasi #${p.stopIndex}`,
                    p.vehicleType === 'mobil' ? 'Mobil' : 'Motor',
                    p.courierName || '-',
                    p.region || 'Jabodetabek',
                    timeStr,
                    p.address || '-',
                    `${p.tripId || ''} (#${p.stopIndex || 1})`,
                    p.status || 'Pending (Diajukan Kurir)',
                    p.reason || 'Klien Tutup / Belum Buka',
                    'Konfirmasi Ulang Klien & Jadwalkan Pengantaran Ulang',
                    p.proofPhotoUrl
                ];

                pRowData.forEach((val, cIdx) => {
                    const cell = pRow.getCell(cIdx + 1);
                    cell.border = thinBorder;
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: bgArgb }
                    };

                    if (cIdx === 0) { // No
                        cell.value = val;
                        cell.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF475569' } };
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    } else if (cIdx === 1) { // Nama Klien
                        cell.value = val;
                        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
                        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                    } else if (cIdx === 2) { // Armada
                        cell.value = val;
                        cell.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF334155' } };
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    } else if (cIdx === 3) { // Kurir
                        cell.value = val;
                        cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF1E293B' } };
                        cell.alignment = { vertical: 'middle', horizontal: 'left' };
                    } else if (cIdx === 4) { // Wilayah
                        cell.value = val;
                        cell.font = { name: 'Calibri', size: 9, color: { argb: 'FF475569' } };
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    } else if (cIdx === 5) { // Waktu Lapor
                        cell.value = val;
                        cell.font = { name: 'Calibri', size: 9, color: { argb: 'FF475569' } };
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    } else if (cIdx === 6) { // Alamat Lengkap
                        cell.value = val;
                        cell.font = { name: 'Calibri', size: 8.5, color: { argb: 'FF334155' } };
                        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                    } else if (cIdx === 7) { // ID Trip / Stop
                        cell.value = val;
                        cell.font = { name: 'Calibri', size: 8.5, color: { argb: 'FF64748B' } };
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    } else if (cIdx === 8) { // Status Laporan
                        cell.value = val;
                        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFB45309' } };
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFFEF3C7' } // Light amber badge
                        };
                    } else if (cIdx === 9) { // Alasan / Kendala
                        cell.value = val;
                        cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF991B1B' } }; // Alert Red
                        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                    } else if (cIdx === 10) { // Tindak Lanjut
                        cell.value = val;
                        cell.font = { name: 'Calibri', size: 8.5, italic: true, color: { argb: 'FF475569' } };
                        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                    } else if (cIdx === 11) { // Bukti Foto PoD
                        if (val && typeof val === 'string' && val.startsWith('http')) {
                            cell.value = {
                                text: '📸 Lihat Foto PoD',
                                hyperlink: val
                            };
                            cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF1D4ED8' }, underline: true };
                        } else {
                            cell.value = '- (Tanpa Foto)';
                            cell.font = { name: 'Calibri', size: 8.5, italic: true, color: { argb: 'FF94A3B8' } };
                        }
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    }
                });
            });
        }

        // Section 3: If any failed packages (murni tidak diantar)
        if (failedList.length > 0) {
            // Blank Row
            sheet.getRow(currentRowIndex++).height = 14;

            // Section Banner for Failed Deliveries
            const failedBannerRowIdx = currentRowIndex++;
            const failedBannerRow = sheet.getRow(failedBannerRowIdx);
            failedBannerRow.height = 24;
            sheet.mergeCells(`A${failedBannerRowIdx}:L${failedBannerRowIdx}`);
            for (let c = 1; c <= 12; c++) {
                failedBannerRow.getCell(c).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF991B1B' } // Crimson Red
                };
            }
            const failedBannerCell = failedBannerRow.getCell(1);
            failedBannerCell.value = `DAFTAR PAKET GAGAL (MURNI TIDAK DIANTAR / BELUM DIKUNJUNGI) - TOTAL: ${failedList.length} TITIK`;
            failedBannerCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
            failedBannerCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

            // Failed Header Row
            const failedHeaderRow = sheet.getRow(currentRowIndex++);
            failedHeaderRow.height = 26;
            const failedHeaders = [
                "No", "Nama Klien / Toko", "Armada", "Kurir Penanggung Jawab", "Wilayah", 
                "Tanggal", "Alamat Lengkap Klien", "ID Trip / Stop", "Status Kendala", 
                "Alasan / Penyebab", "Tindak Lanjut CS", "Bukti / Status"
            ];
            failedHeaders.forEach((h, idx) => {
                const cell = failedHeaderRow.getCell(idx + 1);
                cell.value = h;
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF7F1D1D' } // Darker Red
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FF7F1D1D' } },
                    left: { style: 'thin', color: { argb: 'FFF87171' } },
                    bottom: { style: 'medium', color: { argb: 'FF450A0A' } },
                    right: { style: 'thin', color: { argb: 'FFF87171' } }
                };
            });

            failedList.forEach((f, idx) => {
                const fRow = sheet.getRow(currentRowIndex++);
                fRow.height = 26;
                const isEven = (idx % 2 === 0);
                const bgArgb = isEven ? 'FFFFFFFF' : 'FFFFF5F5'; // Alternate soft red

                const fRowData = [
                    idx + 1,
                    f.locationName || `Destinasi #${f.stopIndex}`,
                    f.vehicleType === 'mobil' ? 'Mobil' : 'Motor',
                    f.courierName || '-',
                    f.region || 'Jabodetabek',
                    f.dateStr || '-',
                    f.address || '-',
                    `${f.tripId || ''} (#${f.stopIndex || 1})`,
                    f.status || 'Gagal (Tidak Diantar)',
                    f.reason || 'Murni Tidak Diantar (Belum Sempat Didatangi Kurir)',
                    'Wajib Ditugaskan Ulang Hari Kerja Berikutnya',
                    '- (Tidak Dikunjungi)'
                ];

                fRowData.forEach((val, cIdx) => {
                    const cell = fRow.getCell(cIdx + 1);
                    cell.border = thinBorder;
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: bgArgb }
                    };
                    if (cIdx === 0) {
                        cell.value = val;
                        cell.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF475569' } };
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    } else if (cIdx === 1) {
                        cell.value = val;
                        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF991B1B' } };
                        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                    } else if (cIdx === 6) { // Alamat
                        cell.value = val;
                        cell.font = { name: 'Calibri', size: 8.5, color: { argb: 'FF334155' } };
                        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                    } else if (cIdx === 8) { // Status
                        cell.value = val;
                        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF9C0006' } };
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFFFC7CE' }
                        };
                    } else if (cIdx === 9) { // Alasan
                        cell.value = val;
                        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF7F1D1D' } };
                        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                    } else if (cIdx === 10) {
                        cell.value = val;
                        cell.font = { name: 'Calibri', size: 8.5, italic: true, color: { argb: 'FF475569' } };
                        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                    } else {
                        cell.value = val;
                        cell.font = { name: 'Calibri', size: 9, color: { argb: 'FF334155' } };
                        cell.alignment = { vertical: 'middle', horizontal: cIdx === 3 ? 'left' : 'center' };
                    }
                });
            });
        }

        // Column widths - Balanced to ensure both tables and notes fit seamlessly on one sheet
        sheet.columns = [
            { width: 6 },   // No
            { width: 28 },  // Alokasi Driver / Nama Klien
            { width: 14 },  // Tipe Armada
            { width: 22 },  // Jam Awal / Kurir Pelapor
            { width: 18 },  // Upload Akhir / Wilayah
            { width: 18 },  // Total Jam / Waktu Lapor
            { width: 28 },  // Status Lembur / Alamat Lengkap
            { width: 18 },  // Total Titik / ID Trip
            { width: 18 },  // Terkirim / Status Pengajuan
            { width: 24 },  // Gagal / Alasan Kendala
            { width: 24 },  // Pending / Tindak Lanjut CS
            { width: 18 }   // Persentase / Bukti Foto PoD
        ];

        // Trigger browser download of the single styled sheet
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const cleanPeriod = periodLabel.replace(/[\/\s:]/g, '_');
        a.download = `Wtrack_Laporan_Operasional_${cleanPeriod}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        return;
    }

    // Fallback: SheetJS
    if (typeof XLSX !== 'undefined') {
        const sheet1GroupedData = [];
        mobilCouriers.forEach((c, idx) => {
            sheet1GroupedData.push({
                "No": idx + 1,
                "Kelompok Armada": "Armada Mobil",
                "Nama Driver / Kurir": c.name,
                "Tipe Armada": "Mobil",
                "Jam Penugasan Awal": c.col1Value,
                "Jam Upload Akhir": c.col2Value,
                "Total Jam Kerja": c.col3Value,
                "Status Lembur": c.isOvertime ? 'Lembur (>8 Jam)' : 'Normal',
                "Total Stops": c.totalStops,
                "Terkirim": c.deliveredCount,
                "Gagal (Tidak Diantar)": c.failedCount,
                "Pending (Diajukan Kurir)": c.pendingCount,
                "Persentase": `${c.successRate}%`
            });
        });

        motorCouriers.forEach((c, idx) => {
            sheet1GroupedData.push({
                "No": idx + 1,
                "Kelompok Armada": "Armada Motor",
                "Nama Driver / Kurir": c.name,
                "Tipe Armada": "Motor",
                "Jam Penugasan Awal": c.col1Value,
                "Jam Upload Akhir": c.col2Value,
                "Total Jam Kerja": c.col3Value,
                "Status Lembur": c.isOvertime ? 'Lembur (>8 Jam)' : 'Normal',
                "Total Stops": c.totalStops,
                "Terkirim": c.deliveredCount,
                "Gagal (Tidak Diantar)": c.failedCount,
                "Pending (Diajukan Kurir)": c.pendingCount,
                "Persentase": `${c.successRate}%`
            });
        });

        if (pendingList.length > 0) {
            sheet1GroupedData.push({});
            sheet1GroupedData.push({
                "No": "DAFTAR KLIEN PENDING (DIAJUKAN KURIR / KLIEN TUTUP)",
                "Kelompok Armada": `Total: ${pendingList.length} Titik`,
                "Nama Driver / Kurir": "",
                "Tipe Armada": "",
                "Jam Penugasan Awal": "",
                "Jam Upload Akhir": "",
                "Total Jam Kerja": "",
                "Status Lembur": "",
                "Total Stops": "",
                "Terkirim": "",
                "Gagal (Tidak Diantar)": "",
                "Pending (Diajukan Kurir)": "",
                "Persentase": ""
            });
            pendingList.forEach((p, idx) => {
                sheet1GroupedData.push({
                    "No": idx + 1,
                    "Kelompok Armada": "KLIEN PENDING",
                    "Nama Driver / Kurir": p.courierName || '-',
                    "Tipe Armada": p.vehicleType === 'mobil' ? 'Mobil' : 'Motor',
                    "Jam Penugasan Awal": p.locationName || `Destinasi #${p.stopIndex}`,
                    "Jam Upload Akhir": p.region || '-',
                    "Total Jam Kerja": p.address || '-',
                    "Status Lembur": p.status || 'Pending',
                    "Total Stops": p.reason || 'Klien Tutup',
                    "Terkirim": p.dateStr || '-',
                    "Gagal (Tidak Diantar)": formatTimeHHMM(p.reportedTime),
                    "Pending (Diajukan Kurir)": p.proofPhotoUrl ? "Ada Bukti Foto" : "Tanpa Foto",
                    "Persentase": p.proofPhotoUrl || '-'
                });
            });
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(sheet1GroupedData);
        XLSX.utils.book_append_sheet(wb, ws, "Audit_Operasional");
        XLSX.writeFile(wb, `Wtrack_Laporan_Operasional_${periodLabel}.xlsx`);
    }
}
window.exportCourierAuditToExcel = exportCourierAuditToExcel;

// --------------------------------------------------------------------------
// 5. AUTOMATED WHATSAPP & EMAIL REPORT DISTRIBUTION (FULL PAGE VIEW)
// --------------------------------------------------------------------------

function switchAuditSubView(viewName) {
    const tableSub = document.getElementById('subview-audit-table');
    const distSub = document.getElementById('subview-audit-distribution');
    const btnTable = document.getElementById('btn-subview-audit-table');
    const btnDist = document.getElementById('btn-subview-audit-dist');

    if (viewName === 'distribution') {
        if (tableSub) tableSub.style.display = 'none';
        if (distSub) distSub.style.display = 'block';

        if (btnTable) {
            btnTable.className = 'btn btn-sm btn-light border fw-bold px-3 py-1.5 rounded-2 text-secondary';
        }
        if (btnDist) {
            btnDist.className = 'btn btn-sm btn-primary fw-bold px-3.5 py-1.5 rounded-2 shadow-sm text-white';
        }

        loadSavedReportRecipients();
        loadAutoReportSettingsFromFirestore();
        generateReportPreviews();
    } else {
        if (distSub) distSub.style.display = 'none';
        if (tableSub) tableSub.style.display = 'block';

        if (btnTable) {
            btnTable.className = 'btn btn-sm btn-primary fw-bold px-3.5 py-1.5 rounded-2 shadow-sm text-white';
        }
        if (btnDist) {
            btnDist.className = 'btn btn-sm btn-light border fw-bold px-3 py-1.5 rounded-2 text-secondary';
        }

        if (mapCourierAudit) {
            setTimeout(() => { mapCourierAudit.invalidateSize(); }, 150);
        }
    }
}
window.switchAuditSubView = switchAuditSubView;

function openSendReportModal() {
    switchAuditSubView('distribution');
}
window.openSendReportModal = openSendReportModal;

let activePreviewWaFreq = 'daily';

function getSelectedWaFrequencies() {
    const checked = Array.from(document.querySelectorAll('input[name="reportWaFreq"]:checked')).map(el => el.value);
    return checked.length > 0 ? checked : ['daily'];
}
window.getSelectedWaFrequencies = getSelectedWaFrequencies;

function onReportPeriodChange(toggledKey = null) {
    const checkedBoxes = Array.from(document.querySelectorAll('input[name="reportWaFreq"]:checked'));
    if (checkedBoxes.length === 0) {
        // Prevent all unchecked, keep the toggled one checked
        const fallbackId = toggledKey ? `wa-freq-${toggledKey}` : 'wa-freq-daily';
        const fallback = document.getElementById(fallbackId);
        if (fallback) fallback.checked = true;
    }

    if (toggledKey && document.getElementById(`wa-freq-${toggledKey}`)?.checked) {
        activePreviewWaFreq = toggledKey;
    } else {
        const remaining = Array.from(document.querySelectorAll('input[name="reportWaFreq"]:checked')).map(el => el.value);
        activePreviewWaFreq = remaining[0] || 'daily';
    }

    const startInput = document.getElementById('audit-start-date');
    const endInput = document.getElementById('audit-end-date');
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (activePreviewWaFreq === 'daily') {
        if (startInput) startInput.value = todayStr;
        if (endInput) endInput.value = todayStr;
    } else if (activePreviewWaFreq === 'weekly') {
        const lastWeek = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        if (startInput) startInput.value = lastWeek.toISOString().slice(0, 10);
        if (endInput) endInput.value = todayStr;
    } else if (activePreviewWaFreq === 'monthly') {
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        if (startInput) startInput.value = firstOfMonth.toISOString().slice(0, 10);
        if (endInput) endInput.value = todayStr;
    }

    renderCourierAuditView();
    generateReportPreviews();
}
window.onReportPeriodChange = onReportPeriodChange;

function onEmailFrequencyChange() {
    const selectedFreq = document.querySelector('input[name="reportEmailFreq"]:checked')?.value || 'weekly';
    const elSubject = document.getElementById('report-email-subject');
    const elAttachment = document.getElementById('report-email-attachment-name');

    const auditResult = calculateCourierDailyAudit();
    const periodLabel = auditResult.isSingleDay 
        ? auditResult.startDateStr 
        : `${auditResult.startDateStr} s/d ${auditResult.endDateStr}`;

    const now = new Date();
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const currentMonthLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

    if (selectedFreq === 'weekly') {
        if (elSubject) elSubject.value = `[Wtrack] Rekapitulasi Mingguan Operasional Kurir - Periode ${periodLabel}`;
        if (elAttachment) elAttachment.innerText = `Wtrack_Rekap_Mingguan_${auditResult.startDateStr}_sd_${auditResult.endDateStr}.xlsx`;
    } else if (selectedFreq === 'monthly') {
        if (elSubject) elSubject.value = `[Wtrack] Rekapitulasi Bulanan Operasional Kurir - Periode ${currentMonthLabel}`;
        if (elAttachment) elAttachment.innerText = `Wtrack_Rekap_Bulanan_${currentMonthLabel.replace(' ', '_')}.xlsx`;
    } else {
        if (elSubject) elSubject.value = `[Wtrack] Laporan Operasional Kurir - ${periodLabel}`;
        if (elAttachment) elAttachment.innerText = `Wtrack_Audit_Kurir_${periodLabel}.xlsx`;
    }
}
window.onEmailFrequencyChange = onEmailFrequencyChange;

function loadSavedReportRecipients() {
    const wa1 = localStorage.getItem('wtrack_report_wa_1') || '';
    const wa2 = localStorage.getItem('wtrack_report_wa_2') || '';
    const wa3 = localStorage.getItem('wtrack_report_wa_3') || '';
    const emails = localStorage.getItem('wtrack_report_emails') || '';

    const elWa1 = document.getElementById('report-wa-num-1');
    const elWa2 = document.getElementById('report-wa-num-2');
    const elWa3 = document.getElementById('report-wa-num-3');
    const elEmails = document.getElementById('report-email-recipients');

    if (elWa1 && !elWa1.value) elWa1.value = wa1;
    if (elWa2 && !elWa2.value) elWa2.value = wa2;
    if (elWa3 && !elWa3.value) elWa3.value = wa3;
    if (elEmails && !elEmails.value) elEmails.value = emails;
}

function saveReportRecipients() {
    const wa1 = document.getElementById('report-wa-num-1')?.value.trim() || '';
    const wa2 = document.getElementById('report-wa-num-2')?.value.trim() || '';
    const wa3 = document.getElementById('report-wa-num-3')?.value.trim() || '';
    const emails = document.getElementById('report-email-recipients')?.value.trim() || '';

    localStorage.setItem('wtrack_report_wa_1', wa1);
    localStorage.setItem('wtrack_report_wa_2', wa2);
    localStorage.setItem('wtrack_report_wa_3', wa3);
    localStorage.setItem('wtrack_report_emails', emails);
}
window.saveReportRecipients = saveReportRecipients;

function buildSinglePeriodSectionText(startDateVal, endDateVal, periodTitle, sectionNum = null) {
    const auditResult = calculateCourierDailyAudit(startDateVal, endDateVal);
    const couriers = auditResult.couriers;
    const isSingle = auditResult.isSingleDay;
    const periodLabel = isSingle 
        ? auditResult.startDateStr 
        : `${auditResult.startDateStr} s/d ${auditResult.endDateStr}`;

    let totalDelivered = 0;
    let totalFailed = 0;
    let totalPending = 0;
    let totalEffectiveMins = 0;
    let couriersWithTimeCount = 0;

    let mobilDelivered = 0, mobilPending = 0, mobilFailed = 0, mobilCount = 0;
    let motorDelivered = 0, motorPending = 0, motorFailed = 0, motorCount = 0;

    const overtimeList = [];
    const failedByCourier = [];
    const pendingByCourier = [];

    couriers.forEach(c => {
        totalDelivered += c.deliveredCount;
        totalFailed += c.failedCount;
        totalPending += c.pendingCount;

        if (c.totalEffectiveMins > 0) {
            totalEffectiveMins += c.totalEffectiveMins;
            couriersWithTimeCount++;
        }

        if (c.vehicleType === 'mobil') {
            mobilCount++;
            mobilDelivered += c.deliveredCount;
            mobilFailed += c.failedCount;
            mobilPending += c.pendingCount;
        } else {
            motorCount++;
            motorDelivered += c.deliveredCount;
            motorFailed += c.failedCount;
            motorPending += c.pendingCount;
        }

        if (c.isOvertime) overtimeList.push(c);
        if (c.failedItems && c.failedItems.length > 0) failedByCourier.push(c);
        if (c.pendingItems && c.pendingItems.length > 0) pendingByCourier.push(c);
    });

    const totalStopsOverall = totalDelivered + totalFailed + totalPending;
    const overallRate = totalStopsOverall > 0 ? Math.round((totalDelivered / totalStopsOverall) * 100) : 0;
    const avgMins = couriersWithTimeCount > 0 ? Math.round(totalEffectiveMins / couriersWithTimeCount) : 0;

    let header = sectionNum 
        ? `📍 *BAGIAN ${sectionNum}: REKAP ${periodTitle.toUpperCase()}*\n🗓️ *Periode* : ${periodLabel}\n`
        : `🗓️ *Periode* : ${periodLabel} (${periodTitle})\n`;

    let msg = `${header}`;
    msg += `• Total Penugasan     : *${totalStopsOverall} Paket*\n`;
    msg += `• ✅ Terkirim Sukses  : *${totalDelivered} Paket (${overallRate}%)*\n`;
    msg += `• ❌ Gagal (Tdk Diantar): *${totalFailed} Paket*\n`;
    msg += `• ⚠️ Pending (Diajukan) : *${totalPending} Paket*\n`;
    msg += `• ⏱️ Rata-rata Kerja  : *${formatDurationHoursMins(avgMins)} / kurir*\n\n`;

    msg += `🚚 *Rekap Armada:*\n`;
    msg += `• Mobil (${mobilCount} Driver): ${mobilDelivered + mobilFailed + mobilPending} Pkt (${mobilDelivered} Sukses, ${mobilFailed} Gagal, ${mobilPending} Pending)\n`;
    msg += `• Motor (${motorCount} Kurir): ${motorDelivered + motorFailed + motorPending} Pkt (${motorDelivered} Sukses, ${motorFailed} Gagal, ${motorPending} Pending)\n\n`;

    if (failedByCourier.length > 0) {
        msg += `❌ *Kurir dengan Paket Gagal (Murni Tidak Diantar):*\n`;
        failedByCourier.forEach((c, idx) => {
            const vIcon = c.vehicleType === 'mobil' ? '🚚' : '🛵';
            msg += `${idx + 1}. ${vIcon} *${c.name}* : ${c.failedCount} Gagal\n`;
        });
        msg += `\n`;
    }

    if (pendingByCourier.length > 0) {
        msg += `⚠️ *Kurir dengan Pengajuan Pending:*\n`;
        pendingByCourier.forEach((c, idx) => {
            const vIcon = c.vehicleType === 'mobil' ? '🚚' : '🛵';
            msg += `${idx + 1}. ${vIcon} *${c.name}* : ${c.pendingCount} Pending (${c.pendingItems[0]?.reason || 'Toko Tutup'})\n`;
        });
        msg += `\n`;
    }

    if (overtimeList.length > 0) {
        msg += `⭐ *Catatan Lembur (>8 Jam):*\n`;
        overtimeList.forEach(c => {
            const vIcon = c.vehicleType === 'mobil' ? '🚚' : '🛵';
            msg += `• ${vIcon} ${c.name} (${c.col3Value})\n`;
        });
        msg += `\n`;
    }

    return msg;
}

function buildWhatsAppReportText() {
    const selectedFreqs = getSelectedWaFrequencies();
    const branchName = (typeof activeBranch !== 'undefined' && activeBranch) ? activeBranch : 'Wellen Pusat';
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const getDatesForFreq = (freq) => {
        if (freq === 'daily') {
            const curStart = document.getElementById('audit-start-date')?.value;
            const curEnd = document.getElementById('audit-end-date')?.value;
            if (curStart && curStart === curEnd) {
                return { start: curStart, end: curEnd, title: 'Harian' };
            }
            return { start: todayStr, end: todayStr, title: 'Harian' };
        } else if (freq === 'weekly') {
            const lastWeek = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
            return { start: lastWeek.toISOString().slice(0, 10), end: todayStr, title: 'Mingguan (7 Hari)' };
        } else if (freq === 'monthly') {
            const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            return { start: firstOfMonth.toISOString().slice(0, 10), end: todayStr, title: 'Bulanan (1 Bulan Penuh)' };
        } else {
            const s = document.getElementById('audit-start-date')?.value || todayStr;
            const e = document.getElementById('audit-end-date')?.value || s;
            return { start: s, end: e, title: 'Sesuai Filter Tanggal' };
        }
    };

    if (selectedFreqs.length === 1) {
        const info = getDatesForFreq(selectedFreqs[0]);
        let msg = `📊 *LAPORAN OPERASIONAL LOGISTIK*\n`;
        msg += `🏢 *Cabang*  : ${branchName}\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
        msg += buildSinglePeriodSectionText(info.start, info.end, info.title);
        msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `🔗 *Audit & Foto Bukti Lengkap:*\n`;
        msg += `https://wtrack.wellenprint.com`;
        return msg;
    }

    // MULTIPLE CHOICES (Pilihan Ganda)
    let msg = `📊 *LAPORAN OPERASIONAL LOGISTIK (MULTI-PERIODE)*\n`;
    msg += `🏢 *Cabang*  : ${branchName}\n`;
    msg += `📋 *Mode*    : Ringkasan Terpadu (${selectedFreqs.length} Periode Dipilih)\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    selectedFreqs.forEach((freq, idx) => {
        const info = getDatesForFreq(freq);
        msg += buildSinglePeriodSectionText(info.start, info.end, info.title, idx + 1);
        msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
    });

    msg += `🔗 *Audit & Foto Bukti Lengkap:*\n`;
    msg += `https://wtrack.wellenprint.com`;
    return msg;
}
window.buildWhatsAppReportText = buildWhatsAppReportText;

function toggleReportViewMode(btn) {
    const visualView = document.getElementById('report-card-visual-view');
    const rawView = document.getElementById('report-card-raw-view');
    if (!visualView || !rawView) return;

    if (rawView.style.display === 'none') {
        rawView.style.display = 'block';
        visualView.style.display = 'none';
        if (btn) btn.innerHTML = '<i class="bi bi-layout-text-window-reverse me-1"></i>Tampilan Card';
    } else {
        rawView.style.display = 'none';
        visualView.style.display = 'block';
        if (btn) btn.innerHTML = '<i class="bi bi-code-slash me-1"></i>Teks WhatsApp';
    }
}
window.toggleReportViewMode = toggleReportViewMode;

function generateReportPreviews() {
    saveReportRecipients();
    const waText = buildWhatsAppReportText();

    const elWaPreview = document.getElementById('report-wa-preview-text');
    if (elWaPreview) elWaPreview.value = waText;

    const auditResult = calculateCourierDailyAudit();
    const couriers = auditResult.couriers;
    const isSingle = auditResult.isSingleDay;
    const periodLabel = isSingle 
        ? auditResult.startDateStr 
        : `${auditResult.startDateStr} s/d ${auditResult.endDateStr}`;

    const branchName = (typeof activeBranch !== 'undefined' && activeBranch) ? activeBranch : 'Wellen Pusat';

    // 1. Populate Modern Visual Card
    let totalDelivered = 0, totalFailed = 0, totalPending = 0, totalEffectiveMins = 0, couriersWithTimeCount = 0;
    let mobilDelivered = 0, mobilPending = 0, mobilFailed = 0, mobilCount = 0;
    let motorDelivered = 0, motorPending = 0, motorFailed = 0, motorCount = 0;
    const failedCouriers = [];
    const pendingCouriers = [];

    couriers.forEach(c => {
        totalDelivered += c.deliveredCount;
        totalFailed += c.failedCount;
        totalPending += c.pendingCount;

        if (c.totalEffectiveMins > 0) {
            totalEffectiveMins += c.totalEffectiveMins;
            couriersWithTimeCount++;
        }

        if (c.vehicleType === 'mobil') {
            mobilCount++;
            mobilDelivered += c.deliveredCount;
            mobilFailed += c.failedCount;
            mobilPending += c.pendingCount;
        } else {
            motorCount++;
            motorDelivered += c.deliveredCount;
            motorFailed += c.failedCount;
            motorPending += c.pendingCount;
        }

        if (c.failedItems && c.failedItems.length > 0) {
            failedCouriers.push(c);
        }

        if (c.pendingItems && c.pendingItems.length > 0) {
            pendingCouriers.push(c);
        }
    });

    const totalStopsOverall = totalDelivered + totalFailed + totalPending;
    const overallRate = totalStopsOverall > 0 ? Math.round((totalDelivered / totalStopsOverall) * 100) : 0;
    const avgMins = couriersWithTimeCount > 0 ? Math.round(totalEffectiveMins / couriersWithTimeCount) : 0;

    const elCardPeriod = document.getElementById('report-card-period-badge');
    const elCardStops = document.getElementById('report-card-total-stops');
    const elCardDelivered = document.getElementById('report-card-delivered');
    const elCardSuccessRate = document.getElementById('report-card-success-rate');
    const elCardFailed = document.getElementById('report-card-failed');
    const elCardPending = document.getElementById('report-card-pending');
    const elCardAvgTime = document.getElementById('report-card-avg-time');
    const elCardMobil = document.getElementById('report-card-mobil-summary');
    const elCardMotor = document.getElementById('report-card-motor-summary');
    const elCardFailedCount = document.getElementById('report-card-failed-couriers-count');
    const elCardFailedList = document.getElementById('report-card-failed-list');
    const elCardPendingCount = document.getElementById('report-card-pending-couriers-count');
    const elCardPendingList = document.getElementById('report-card-pending-list');

    if (elCardPeriod) elCardPeriod.innerText = `${periodLabel} • ${branchName}`;
    if (elCardStops) elCardStops.innerText = totalStopsOverall.toLocaleString();
    if (elCardDelivered) elCardDelivered.innerText = totalDelivered.toLocaleString();
    if (elCardSuccessRate) elCardSuccessRate.innerText = `${overallRate}% Sukses`;
    if (elCardFailed) elCardFailed.innerText = totalFailed.toLocaleString();
    if (elCardPending) elCardPending.innerText = totalPending.toLocaleString();
    if (elCardAvgTime) elCardAvgTime.innerText = formatDurationHoursMins(avgMins);
    
    if (elCardMobil) {
        elCardMobil.innerText = `Mobil (${mobilCount}): ${mobilDelivered} Sukses, ${mobilFailed} Gagal, ${mobilPending} Pending`;
    }
    if (elCardMotor) {
        elCardMotor.innerText = `Motor (${motorCount}): ${motorDelivered} Sukses, ${motorFailed} Gagal, ${motorPending} Pending`;
    }

    // Kurir Gagal List
    if (elCardFailedCount) {
        elCardFailedCount.innerText = `${failedCouriers.length} Kurir`;
    }
    if (elCardFailedList) {
        if (failedCouriers.length === 0) {
            elCardFailedList.innerHTML = `
                <div class="text-success extra-small text-center py-3 bg-white rounded border">
                    <i class="bi bi-check2 text-success me-1"></i> Tidak ada paket gagal. Seluruh paket telah dikunjungi/diantar!
                </div>`;
        } else {
            let failedCardsHtml = '';
            failedCouriers.forEach(c => {
                const vIcon = c.vehicleType === 'mobil' ? '🚚' : '🛵';
                let destListHtml = '';
                c.failedItems.forEach(item => {
                    destListHtml += `
                        <div class="extra-small py-0.5">
                            <span class="fw-semibold text-dark">• ${item.locationName}</span>
                            <span class="text-danger ms-1">(Murni tidak diantar)</span>
                        </div>`;
                });

                failedCardsHtml += `
                    <div class="p-2.5 rounded-3 border bg-white shadow-2fs">
                        <div class="d-flex align-items-center justify-content-between mb-1">
                            <div class="fw-bold text-dark extra-small d-flex align-items-center gap-1.5">
                                <span>${vIcon}</span>
                                <span>${c.name}</span>
                            </div>
                            <span class="badge bg-danger-subtle text-danger extra-small fw-bold">${c.failedCount} Gagal</span>
                        </div>
                        <div class="d-flex flex-column gap-0.5 ps-3 border-start ms-1" style="border-left-color: #fca5a5 !important;">
                            ${destListHtml}
                        </div>
                    </div>`;
            });
            elCardFailedList.innerHTML = failedCardsHtml;
        }
    }

    // Kurir Pending List
    if (elCardPendingCount) {
        elCardPendingCount.innerText = `${pendingCouriers.length} Kurir`;
    }
    if (elCardPendingList) {
        if (pendingCouriers.length === 0) {
            elCardPendingList.innerHTML = `
                <div class="text-muted extra-small text-center py-3 bg-white rounded border">
                    <i class="bi bi-info-circle me-1"></i> Tidak ada kurir yang mengajukan kendala pending di sistem.
                </div>`;
        } else {
            let pendingCardsHtml = '';
            pendingCouriers.forEach(c => {
                const vIcon = c.vehicleType === 'mobil' ? '🚚' : '🛵';
                let destListHtml = '';
                c.pendingItems.forEach(item => {
                    destListHtml += `
                        <div class="extra-small py-0.5">
                            <span class="fw-semibold text-dark">• ${item.locationName}</span>
                            <span class="text-warning-emphasis ms-1">(${item.reason})</span>
                        </div>`;
                });

                pendingCardsHtml += `
                    <div class="p-2.5 rounded-3 border bg-white shadow-2fs">
                        <div class="d-flex align-items-center justify-content-between mb-1">
                            <div class="fw-bold text-dark extra-small d-flex align-items-center gap-1.5">
                                <span>${vIcon}</span>
                                <span>${c.name}</span>
                            </div>
                            <span class="badge bg-warning-subtle text-warning-emphasis extra-small fw-bold">${c.pendingCount} Paket</span>
                        </div>
                        <div class="d-flex flex-column gap-0.5 ps-3 border-start ms-1" style="border-left-color: #fed7aa !important;">
                            ${destListHtml}
                        </div>
                    </div>`;
            });
            elCardPendingList.innerHTML = pendingCardsHtml;
        }
    }

    // 2. Email Subject & Attachment (Dynamically synchronized with Email Frequency)
    onEmailFrequencyChange();
}
window.generateReportPreviews = generateReportPreviews;

function copyWhatsAppReportText() {
    const text = document.getElementById('report-wa-preview-text')?.value || buildWhatsAppReportText();
    navigator.clipboard.writeText(text).then(() => {
        alert("✅ Teks laporan WhatsApp berhasil disalin ke clipboard!\nSilakan paste ke nomor atau grup WhatsApp tujuan.");
    }).catch(() => {
        const ta = document.getElementById('report-wa-preview-text');
        if (ta) {
            ta.select();
            document.execCommand('copy');
            alert("✅ Teks laporan berhasil disalin!");
        }
    });
}
window.copyWhatsAppReportText = copyWhatsAppReportText;

function formatPhoneForWhatsApp(phone) {
    if (!phone) return '';
    let p = phone.replace(/[^0-9]/g, '');
    if (p.startsWith('0')) p = '62' + p.substring(1);
    return p;
}

function sendWhatsAppViaDirectLink() {
    const wa1 = document.getElementById('report-wa-num-1')?.value.trim();
    const wa2 = document.getElementById('report-wa-num-2')?.value.trim();
    const wa3 = document.getElementById('report-wa-num-3')?.value.trim();
    const targetPhone = formatPhoneForWhatsApp(wa1 || wa2 || wa3);

    const text = document.getElementById('report-wa-preview-text')?.value || buildWhatsAppReportText();
    
    // Auto copy text to clipboard as well
    navigator.clipboard.writeText(text).catch(()=>{});

    if (targetPhone) {
        const url = `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    } else {
        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    }
}
window.sendWhatsAppViaDirectLink = sendWhatsAppViaDirectLink;

function openMailtoClient() {
    const emails = document.getElementById('report-email-recipients')?.value.trim() || '';
    const subject = document.getElementById('report-email-subject')?.value || '[Wtrack Report] Laporan Operasional';
    const text = document.getElementById('report-wa-preview-text')?.value || buildWhatsAppReportText();

    const mailtoUrl = `mailto:${encodeURIComponent(emails)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    window.location.href = mailtoUrl;
}
window.openMailtoClient = openMailtoClient;

async function triggerServerEmailDispatch() {
    const statusEl = document.getElementById('email-dispatch-status');
    const emails = document.getElementById('report-email-recipients')?.value.trim() || '';
    const subject = document.getElementById('report-email-subject')?.value || '[Wtrack Report] Laporan Operasional';
    const reportText = document.getElementById('report-wa-preview-text')?.value || buildWhatsAppReportText();

    if (!emails) {
        return alert("Mohon masukkan minimal satu alamat email penerima laporan.");
    }

    if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.className = 'mt-2 alert alert-info py-2 px-3 extra-small mb-0';
        statusEl.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Mengirimkan laporan email...`;
    }

    try {
        const response = await fetch('/api/send-daily-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipients: emails.split(',').map(e => e.trim()).filter(Boolean),
                subject: subject,
                reportText: reportText,
                auditResult: calculateCourierDailyAudit()
            })
        });

        const resData = await response.json().catch(() => ({}));

        if (response.ok && resData.success) {
            if (statusEl) {
                statusEl.className = 'mt-2 alert alert-success py-2 px-3 extra-small mb-0';
                statusEl.innerHTML = `✅ Laporan email berhasil dikirim ke <b>${emails}</b>.`;
            }
        } else {
            // Graceful fallback: If Vercel API key is not configured yet on localhost
            if (statusEl) {
                statusEl.className = 'mt-2 alert alert-warning py-2 px-3 extra-small mb-0';
                statusEl.innerHTML = `
                    <div class="fw-bold mb-1">ℹ️ Pengiriman Langsung Siap:</div>
                    API Gateway server belum terhubung dengan API Key Resend/SMTP di localhost. Anda dapat menggunakan tombol <b>"Buka di Gmail/Outlook"</b> di atas untuk mengirim langsung dengan 1 klik!`;
            }
        }
    } catch(err) {
        if (statusEl) {
            statusEl.className = 'mt-2 alert alert-warning py-2 px-3 extra-small mb-0';
            statusEl.innerHTML = `
                <div class="fw-bold mb-1">ℹ️ Gunakan Email Client:</div>
                Koneksi server API lokal tidak aktif. Silakan gunakan tombol <b>"Buka di Gmail/Outlook"</b> untuk mengirim langsung.`;
        }
    }
}
window.triggerServerEmailDispatch = triggerServerEmailDispatch;

// --------------------------------------------------------------------------
// 6. AUTO-CRON & FIRESTORE SETTINGS SYNC
// --------------------------------------------------------------------------

async function loadAutoReportSettingsFromFirestore() {
    try {
        const activeDb = (typeof getDb === 'function') ? getDb() : null;
        if (!activeDb) return;

        const doc = await activeDb.collection('settings').doc('daily_report').get();
        if (doc.exists) {
            const data = doc.data() || {};
            const enabledEl = document.getElementById('auto-report-enabled');
            const timeEl = document.getElementById('auto-report-time');
            const scopeEl = document.getElementById('auto-report-scope');
            const emailWeeklyEl = document.getElementById('auto-email-weekly-enabled');
            const emailMonthlyEl = document.getElementById('auto-email-monthly-enabled');

            if (enabledEl && data.enabled !== undefined) enabledEl.checked = data.enabled;
            if (timeEl && data.scheduledTime) timeEl.value = data.scheduledTime;
            if (scopeEl && data.dataScope) scopeEl.value = data.dataScope;
            if (emailWeeklyEl && data.emailWeeklyEnabled !== undefined) emailWeeklyEl.checked = data.emailWeeklyEnabled;
            if (emailMonthlyEl && data.emailMonthlyEnabled !== undefined) emailMonthlyEl.checked = data.emailMonthlyEnabled;

            if (Array.isArray(data.waFrequencies) && data.waFrequencies.length > 0) {
                document.querySelectorAll('input[name="reportWaFreq"]').forEach(input => {
                    input.checked = data.waFrequencies.includes(input.value);
                });
            }

            // Also sync saved recipients from cloud if local is empty
            if (Array.isArray(data.waRecipients)) {
                if (data.waRecipients[0] && !document.getElementById('report-wa-num-1')?.value) {
                    document.getElementById('report-wa-num-1').value = data.waRecipients[0];
                }
                if (data.waRecipients[1] && !document.getElementById('report-wa-num-2')?.value) {
                    document.getElementById('report-wa-num-2').value = data.waRecipients[1];
                }
                if (data.waRecipients[2] && !document.getElementById('report-wa-num-3')?.value) {
                    document.getElementById('report-wa-num-3').value = data.waRecipients[2];
                }
            }
            if (data.emailRecipients && !document.getElementById('report-email-recipients')?.value) {
                document.getElementById('report-email-recipients').value = Array.isArray(data.emailRecipients) 
                    ? data.emailRecipients.join(', ') 
                    : data.emailRecipients;
            }
        }
    } catch(err) {
        console.warn("Gagal memuat pengaturan auto report dari Firestore:", err);
    }
}
window.loadAutoReportSettingsFromFirestore = loadAutoReportSettingsFromFirestore;

async function saveAutoReportSettingsToFirestore() {
    const alertEl = document.getElementById('auto-report-alert');
    const enabled = document.getElementById('auto-report-enabled')?.checked ?? true;
    const scheduledTime = document.getElementById('auto-report-time')?.value || '06:00';
    const dataScope = document.getElementById('auto-report-scope')?.value || 'yesterday';
    const emailWeeklyEnabled = document.getElementById('auto-email-weekly-enabled')?.checked ?? true;
    const emailMonthlyEnabled = document.getElementById('auto-email-monthly-enabled')?.checked ?? true;

    const wa1 = document.getElementById('report-wa-num-1')?.value.trim() || '';
    const wa2 = document.getElementById('report-wa-num-2')?.value.trim() || '';
    const wa3 = document.getElementById('report-wa-num-3')?.value.trim() || '';
    const emails = document.getElementById('report-email-recipients')?.value.trim() || '';

    saveReportRecipients();

    const checkedWaFreqs = getSelectedWaFrequencies();

    const payload = {
        enabled: enabled,
        scheduledTime: scheduledTime,
        dataScope: dataScope,
        waFrequencies: checkedWaFreqs,
        emailWeeklyEnabled: emailWeeklyEnabled,
        emailMonthlyEnabled: emailMonthlyEnabled,
        waRecipients: [wa1, wa2, wa3].filter(Boolean),
        emailRecipients: emails.split(',').map(e => e.trim()).filter(Boolean),
        updatedAt: (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore.Timestamp.now() : new Date().toISOString()
    };

    if (alertEl) {
        alertEl.style.display = 'block';
        alertEl.className = 'mt-2.5 alert alert-info py-2 px-3 extra-small mb-0';
        alertEl.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Menyimpan pengaturan jadwal ke Cloud Firestore...`;
    }

    try {
        const activeDb = (typeof getDb === 'function') ? getDb() : null;
        if (!activeDb) throw new Error("Firestore Database belum terhubung.");

        await activeDb.collection('settings').doc('daily_report').set(payload, { merge: true });

        if (alertEl) {
            alertEl.className = 'mt-2.5 alert alert-success py-2 px-3 extra-small mb-0';
            let emailInfo = [];
            if (emailWeeklyEnabled) emailInfo.push('Email Mingguan (Senin)');
            if (emailMonthlyEnabled) emailInfo.push('Email Bulanan (Tgl 1)');
            const emailText = emailInfo.length > 0 ? ` + ${emailInfo.join(' & ')}` : ' (Email Rutin Dinonaktifkan)';
            alertEl.innerHTML = `✅ <b>Berhasil Disimpan!</b> Laporan WA akan dikirim pukul <b>${scheduledTime} WIB</b> (${dataScope === 'yesterday' ? 'Harian Kemarin' : dataScope})${emailText}.`;
        }
    } catch(err) {
        if (alertEl) {
            alertEl.className = 'mt-2.5 alert alert-warning py-2 px-3 extra-small mb-0';
            alertEl.innerHTML = `⚠️ Gagal menyimpan ke Firestore: ${err.message}. Pengaturan telah disimpan sementara di memori browser.`;
        }
    }
}
window.saveAutoReportSettingsToFirestore = saveAutoReportSettingsToFirestore;

async function testAutoReportDispatch() {
    const alertEl = document.getElementById('auto-report-alert');
    const scheduledTime = document.getElementById('auto-report-time')?.value || '06:00';
    const dataScope = document.getElementById('auto-report-scope')?.value || 'yesterday';

    if (alertEl) {
        alertEl.style.display = 'block';
        alertEl.className = 'mt-2.5 alert alert-primary py-2 px-3 extra-small mb-0';
        alertEl.innerHTML = `
            <div class="fw-bold"><i class="bi bi-info-circle me-1"></i>Simulasi Jadwal Pukul ${scheduledTime} WIB:</div>
            Sistem telah siap mengeksekusi pengiriman otomatis untuk <b>${dataScope === 'yesterday' ? 'Rekap H-1 (Kemarin)' : 'Rekap Hari Berjalan'}</b>. Teks laporan terisi lengkap dan siap disebar ke WA & Email penerima.
        `;
    }
}
window.testAutoReportDispatch = testAutoReportDispatch;


