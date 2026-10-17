// ==========================================
// WTRACK LOGISTICS - KPI & STATISTICS MODULE
// ==========================================

let rankingChart = null;
let distributionChart = null;
let lastKPIData = [];
let kpiSortField = 'stops';
let kpiSortAsc = false;
let currentStatMetric = 'stops';

window.courierPodStore = {};

function openCourierPoDGallery(courierKey, courierName) {
    const list = window.courierPodStore[courierKey] || [];
    if (list.length === 0) return alert(`Belum ada foto Bukti Pengiriman untuk ${courierName}`);

    let modalEl = document.getElementById('courierPodGalleryModal');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'courierPodGalleryModal';
        modalEl.className = 'modal fade';
        modalEl.tabIndex = -1;
        modalEl.innerHTML = `
            <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                <div class="modal-content border-0 shadow-lg" style="border-radius: 16px;">
                    <div class="modal-header border-bottom py-3">
                        <div>
                            <h6 class="modal-title fw-semibold text-dark m-0" id="courierPodModalTitle">Foto Bukti Pengiriman</h6>
                            <small class="text-muted extra-small" id="courierPodModalSubtitle">0 Foto</small>
                        </div>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body p-3 bg-light">
                        <div class="row g-2" id="courierPodGalleryGrid"></div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    }

    document.getElementById('courierPodModalTitle').innerText = `Bukti Pengiriman — ${courierName}`;
    document.getElementById('courierPodModalSubtitle').innerText = `${list.length} foto bukti pengiriman (PoD)`;

    const grid = document.getElementById('courierPodGalleryGrid');
    grid.innerHTML = '';

    list.forEach((pod) => {
        const tagBadge = pod.tag ? `<span class="position-absolute bottom-0 start-0 m-1 badge ${pod.badgeClass || 'bg-dark'} extra-small fw-bold" style="font-size: 0.6rem;">${pod.tag}</span>` : '';
        grid.innerHTML += `
            <div class="col-6 col-sm-4 col-md-3">
                <div class="card h-100 border shadow-sm overflow-hidden" style="border-radius: 10px;">
                    <div class="position-relative" style="height: 110px; background: #e2e8f0;">
                        <img src="${pod.url}" class="w-100 h-100 object-fit-cover cursor-pointer" onclick="openPoDModal('${pod.url}')" title="Klik untuk memperbesar">
                        <span class="position-absolute top-0 start-0 m-1 badge bg-dark opacity-75 extra-small fw-normal">Stop ${pod.stopIndex}</span>
                        ${tagBadge}
                    </div>
                    <div class="p-1.5 px-2 bg-white">
                        <div class="extra-small text-truncate text-muted fw-normal" title="${pod.locationName}">${pod.locationName}</div>
                    </div>
                </div>
            </div>
        `;
    });

    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();
}
window.openCourierPoDGallery = openCourierPoDGallery;

// Helper: Calculate realistic road distance in KM
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const straightDist = R * c;

    // Solusi A: Apply 1.25x Road Factor for realistic road driving distance
    return straightDist * 1.25;
}

function sortKPITable(field) {
    if (kpiSortField === field) {
        kpiSortAsc = !kpiSortAsc;
    } else {
        kpiSortField = field;
        kpiSortAsc = false;
    }
    renderKPIView();
}

function exportKPIToExcel() {
    if (!lastKPIData || lastKPIData.length === 0) return alert("Tidak ada data KPI untuk diekspor!");

    const exportData = [];
    lastKPIData.forEach(c => {
        const completionRate = c.totalStops > 0 ? Math.round((c.completedStops / c.totalStops) * 100) : 0;
        const stars = c.totalStops > 0 ? parseFloat(((completionRate / 100) * 5.0).toFixed(1)) : 0.0;
        const hours = Math.floor((c.totalTime || 0) / 60);
        const mins = Math.round((c.totalTime || 0) % 60);
        const durationStr = hours > 0 ? `${hours}j ${mins}m` : `${mins}m`;

        exportData.push({
            "Courier Name": c.name,
            "Completed Stops": c.completedStops,
            "Total Stops": c.totalStops,
            "Completion Rate (%)": completionRate + "%",
            "Rating Stars": stars,
            "Total Distance (km)": c.totalKM.toFixed(1),
            "Total Duration": durationStr,
            "KPI Score": completionRate
        });
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "KPI Performance");
    XLSX.writeFile(wb, `Wtrack_KPI_Performance_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function updateKPIChartsFromFilter() {
    const period = document.getElementById('stat-period-filter')?.value || 'today';
    const metric = document.getElementById('stat-metric-filter')?.value || 'stops';

    const now = new Date();
    const todayStartMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEndMs = todayStartMs + (24 * 60 * 60 * 1000) - 1;

    let startMs = 0;
    let endMs = Infinity;

    if (period === 'today') {
        startMs = todayStartMs;
        endMs = todayEndMs;
    } else if (period === 'this_week') {
        const monday = new Date(now);
        const day = now.getDay() || 7;
        monday.setDate(now.getDate() - day + 1);
        startMs = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate()).getTime();
        endMs = todayEndMs;
    } else if (period === 'this_month') {
        startMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        endMs = todayEndMs;
    }

    const kpiStart = document.getElementById('kpi-start-date');
    const kpiEnd = document.getElementById('kpi-end-date');
    if (kpiStart && kpiEnd && period !== 'all') {
        kpiStart.value = new Date(startMs).toLocaleDateString('sv-SE');
        kpiEnd.value = new Date(endMs).toLocaleDateString('sv-SE');
    } else if (kpiStart && kpiEnd && period === 'all') {
        kpiStart.value = '';
        kpiEnd.value = '';
    }

    currentStatMetric = metric;
    renderKPIView();
}

function renderKPIView(filter = "") {
    const tbody = document.getElementById('kpi-table-body');
    if(!tbody) return;
    tbody.innerHTML = '';

    const startDateVal = document.getElementById('kpi-start-date')?.value;
    const endDateVal = document.getElementById('kpi-end-date')?.value;

    let filteredTrips = (typeof allCurrentTrips !== 'undefined' && allCurrentTrips) ? allCurrentTrips : (window.allCurrentTrips || []);

    if (typeof isTripInActiveBranch === 'function') {
        filteredTrips = filteredTrips.filter(t => isTripInActiveBranch(t));
    }

    const now = new Date();
    const todayStartMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEndMs = todayStartMs + (24 * 60 * 60 * 1000) - 1;

    let startMs = 0;
    let endMs = Infinity;

    if (startDateVal) {
        startMs = new Date(startDateVal + "T00:00:00").getTime();
    } else {
        startMs = todayStartMs;
    }

    if (endDateVal) {
        endMs = new Date(endDateVal + "T23:59:59.999").getTime();
    } else {
        endMs = todayEndMs;
    }

    const periodMode = document.getElementById('stat-period-filter')?.value || 'today';
    if (periodMode === 'all' && !startDateVal && !endDateVal) {
        startMs = 0;
        endMs = Infinity;
    }

    filteredTrips = filteredTrips.filter(t => {
        const tripMs = parseTimestampToMs(t.date) || parseTimestampToMs(t.acceptedTime) || (t.id ? parseInt(t.id.replace('TRIP_', '')) || 0 : 0);
        if (startMs > 0) {
            return tripMs >= startMs && tripMs <= endMs;
        }
        return true;
    });

    const courierStats = {};
    let totalCompleted = 0;
    let grandTotalKM = 0;

function parseTimestampToMs(timeObj) {
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

    filteredTrips.forEach(t => {
        const cId = t.courierId || '';
        if (typeof isCourierInActiveBranch === 'function' && !isCourierInActiveBranch(cId)) return;
        if (cId.includes('EK74u0gA') || cId.toLowerCase().includes('novalgan') || cId.toLowerCase().includes('novalempah2')) return;
        const cName = registeredUsers[cId] || (cId.length > 20 ? getCourierDisplayName(cId) : cId);
        if (cName.includes('EK74u0gA') || cName.toLowerCase().includes('novalgan') || cName.toLowerCase().includes('novalempah2')) return;

        if(!courierStats[cId]) {
            courierStats[cId] = {
                name: cName,
                completedStops: 0,
                totalStops: 0,
                totalKM: 0,
                totalTime: 0
            };
        }

        let actualTripKM = 0;
        if (t.destinations && t.destinations.length > 0) {
            courierStats[cId].totalStops += t.destinations.length;

            for (let i = 0; i < t.destinations.length; i++) {
                const d = t.destinations[i];
                const isDone = (d.status === 'done' || (d.proofPhotoUrl && d.proofPhotoUrl.length > 0));

                if (isDone) {
                    courierStats[cId].completedStops++;

                    const start = (i === 0)
                        ? ((t.acceptLatitude && t.acceptLongitude) ? { lat: parseFloat(t.acceptLatitude), lng: parseFloat(t.acceptLongitude) } : { lat: parseFloat(t.destinations[0].latitude || 0), lng: parseFloat(t.destinations[0].longitude || 0) })
                        : { lat: parseFloat(t.destinations[i-1].latitude || 0), lng: parseFloat(t.destinations[i-1].longitude || 0) };
                    const end = { lat: parseFloat(d.latitude || 0), lng: parseFloat(d.longitude || 0) };
                    const dist = calculateDistance(start.lat, start.lng, end.lat, end.lng);
                    actualTripKM += dist;
                }
            }

            // Calculate Start-to-Finish Duration for this trip (ACCEPT -> LAST FINISH)
            let startTimeMs = parseTimestampToMs(t.acceptedTime) || parseTimestampToMs(t.date);
            if (!startTimeMs && t.destinations && t.destinations[0]) {
                startTimeMs = parseTimestampToMs(t.destinations[0].arrivalTime);
            }

            let latestFinishMs = 0;
            t.destinations.forEach(d => {
                const finishMs = parseTimestampToMs(d.completedTime);
                if (finishMs > latestFinishMs) latestFinishMs = finishMs;
            });

            if (startTimeMs > 0 && latestFinishMs > startTimeMs) {
                const tripDurationMins = (latestFinishMs - startTimeMs) / (60 * 1000);
                courierStats[cId].totalTime += tripDurationMins;
            }
        } else {
            courierStats[cId].totalStops += 1;
            if (t.status === 'completed') courierStats[cId].completedStops += 1;
        }
        courierStats[cId].totalKM += actualTripKM;
        grandTotalKM += actualTripKM;

        if(t.status === 'completed' || (t.destinations && t.destinations.every(d => d.status === 'done' || d.proofPhotoUrl))) {
            totalCompleted++;
        }
    });

    lastKPIData = Object.values(courierStats);

    const searchVal = (filter || document.getElementById('kpi-search-input')?.value || "").toLowerCase();
    let displayCouriers = lastKPIData.filter(c => {
        const isOnline = currentOnlineCouriers[Object.keys(registeredUsers).find(k => registeredUsers[k] === c.name)] ? 'active' : 'offline';
        return c.name.toLowerCase().includes(searchVal) || isOnline.includes(searchVal);
    });

    if (currentStatMetric === 'km') {
        kpiSortField = 'distance';
        kpiSortAsc = false;
    } else {
        kpiSortField = 'stops';
        kpiSortAsc = false;
    }

    displayCouriers.sort((a, b) => {
        let valA = a.completedStops;
        let valB = b.completedStops;

        if (kpiSortField === 'distance') {
            valA = a.totalKM || 0;
            valB = b.totalKM || 0;
        } else if (kpiSortField === 'stops') {
            valA = a.completedStops || 0;
            valB = b.completedStops || 0;
        } else if (kpiSortField === 'score' || kpiSortField === 'rating') {
            valA = a.totalStops > 0 ? (a.completedStops / a.totalStops) : 0;
            valB = b.totalStops > 0 ? (b.completedStops / b.totalStops) : 0;
        } else if (kpiSortField === 'name') {
            valA = a.name.toLowerCase();
            valB = b.name.toLowerCase();
        } else if (kpiSortField === 'status') {
            valA = currentOnlineCouriers[Object.keys(registeredUsers).find(k => registeredUsers[k] === a.name)] ? 1 : 0;
            valB = currentOnlineCouriers[Object.keys(registeredUsers).find(k => registeredUsers[k] === b.name)] ? 1 : 0;
        }

        if (valA < valB) return kpiSortAsc ? -1 : 1;
        if (valA > valB) return kpiSortAsc ? 1 : -1;
        return 0;
    });

    // Calculate overall completion efficiency percentage and totals for displayCouriers (matching bar chart)
    let totalStopsFiltered = 0;
    let totalCompletedStopsFiltered = 0;
    let totalKmFiltered = 0;

    displayCouriers.forEach(c => {
        totalStopsFiltered += (c.totalStops || 0);
        totalCompletedStopsFiltered += (c.completedStops || 0);
        totalKmFiltered += (c.totalKM || 0);
    });

    const overallCompletionRate = totalStopsFiltered > 0
        ? Math.round((totalCompletedStopsFiltered / totalStopsFiltered) * 100)
        : 0;

    const satRateEl = document.getElementById('kpi-sat-rate');
    if (satRateEl) {
        satRateEl.innerText = `${overallCompletionRate}%`;
    }

    const satLabelEl = document.getElementById('kpi-sat-label');
    if (satLabelEl) {
        const period = document.getElementById('stat-period-filter')?.value || 'today';
        let periodText = 'hari ini';
        if (period === 'this_week') periodText = 'minggu ini';
        else if (period === 'this_month') periodText = 'bulan ini';
        else if (period === 'all') periodText = 'keseluruhan';

        satLabelEl.innerText = `Tingkat efisiensi penyelesaian pengiriman (${periodText})`;
    }

    const topCourier = displayCouriers[0];
    if (document.getElementById('kpi-top-courier')) {
        document.getElementById('kpi-top-courier').innerText = topCourier ? topCourier.name : '-';
    }
    const topSubEl = document.getElementById('kpi-top-subtitle');
    if (topSubEl) {
        if (currentStatMetric === 'km') {
            topSubEl.innerHTML = `<i class="bi bi-geo-alt-fill me-1"></i> Terjauh (${topCourier ? topCourier.totalKM.toFixed(1) : 0} km)`;
        } else {
            topSubEl.innerHTML = `<i class="bi bi-star-fill me-1"></i> MVP (${topCourier ? topCourier.completedStops : 0} Selesai)`;
        }
    }
    if (document.getElementById('kpi-total-km')) {
        document.getElementById('kpi-total-km').innerText = `${totalKmFiltered.toFixed(1)} km`;
    }
    if (document.getElementById('kpi-total-done')) {
        document.getElementById('kpi-total-done').innerText = `${totalCompletedStopsFiltered}`;
    }

    window.courierPodStore = {};
    const tableRowsHtml = [];

    displayCouriers.forEach(c => {
        const courierId = Object.keys(registeredUsers).find(key => registeredUsers[key] === c.name) || c.name;
        const isOnline = currentOnlineCouriers[courierId];

        const podList = [];
        filteredTrips.filter(t => t.courierId === courierId || registeredUsers[t.courierId] === c.name).forEach(trip => {
            if (trip.destinations) {
                trip.destinations.forEach(d => {
                    const locName = d.locationName || `Stop ${d.stopIndex}`;

                    if (d.proofPhotoSj) {
                        podList.push({
                            url: d.proofPhotoSj,
                            tag: '📄 Surat Jalan',
                            badgeClass: 'bg-primary',
                            stopIndex: d.stopIndex,
                            locationName: locName,
                            tripId: trip.tripId
                        });
                    }
                    let itemArr = [];
                    if (Array.isArray(d.proofPhotoItems)) {
                        itemArr = d.proofPhotoItems.filter(Boolean);
                    } else if (typeof d.proofPhotoItems === 'string' && d.proofPhotoItems.trim().length > 0) {
                        itemArr = d.proofPhotoItems.split(',').map(s => s.trim()).filter(Boolean);
                    }

                    if (itemArr.length > 0) {
                        itemArr.forEach((itemUrl, itemIdx) => {
                            if (itemUrl) {
                                podList.push({
                                    url: itemUrl,
                                    tag: `📦 Barang #${itemIdx + 1}`,
                                    badgeClass: 'bg-success',
                                    stopIndex: d.stopIndex,
                                    locationName: locName,
                                    tripId: trip.tripId
                                });
                            }
                        });
                    }
                    if (!d.proofPhotoSj && (!d.proofPhotoItems || d.proofPhotoItems.length === 0) && d.proofPhotoUrl) {
                        const urls = d.proofPhotoUrl.split(',').map(s => s.trim()).filter(Boolean);
                        urls.forEach((u, uIdx) => {
                            const isSj = (uIdx === 0);
                            podList.push({
                                url: u,
                                tag: isSj ? '📄 Surat Jalan' : `📦 Barang #${uIdx}`,
                                badgeClass: isSj ? 'bg-primary' : 'bg-success',
                                stopIndex: d.stopIndex,
                                locationName: locName,
                                tripId: trip.tripId
                            });
                        });
                    }
                });
            }
        });

        window.courierPodStore[c.name] = podList;

        let podBtnHtml = '';
        if (podList.length > 0) {
            podBtnHtml = `<button class="btn btn-sm btn-light border py-0.5 px-2 ms-2 extra-small rounded-pill text-primary fw-medium" onclick="openCourierPoDGallery('${c.name.replace(/'/g, "\\'")}', '${c.name.replace(/'/g, "\\'")}')" title="Lihat ${podList.length} Foto Bukti Pengiriman">
                <i class="bi bi-images me-1"></i>${podList.length} Foto
            </button>`;
        }

        const completionRate = c.totalStops > 0 ? (c.completedStops / c.totalStops) * 100 : 0;
        let stars = 0.0;
        let finalScore = 0;

        if (c.totalStops > 0) {
            if (c.completedStops >= c.totalStops) {
                stars = 5.0;
                finalScore = 100;
            } else {
                stars = parseFloat(((completionRate / 100) * 5.0).toFixed(1));
                finalScore = Math.round(completionRate);
            }
        }

        const hours = Math.floor(c.totalTime / 60);
        const mins = Math.round(c.totalTime % 60);
        const durationStr = hours > 0 ? `${hours}j ${mins}m` : `${mins}m`;

        tableRowsHtml.push(`<tr>
            <td class="fw-semibold text-dark">${c.name} ${podBtnHtml}</td>
            <td><span class="badge-pill ${isOnline ? 'badge-delivered' : 'badge-delayed'} fw-normal">${isOnline ? 'Active' : 'Offline'}</span></td>
            <td><span class="fw-semibold">${c.completedStops}</span> / <span class="text-muted">${c.totalStops}</span></td>
            <td><i class="bi bi-star-fill text-warning me-1"></i> <span class="fw-semibold">${stars.toFixed(1)}</span></td>
            <td class="fw-normal">${c.totalKM.toFixed(1)} km</td>
            <td><span class="badge bg-secondary-subtle text-dark fw-medium px-2 py-1">${finalScore}</span></td>
        </tr>`);
    });

    tbody.innerHTML = tableRowsHtml.join('');

    updateKPICharts(displayCouriers, filteredTrips);
}

function updateKPICharts(data, filteredTrips) {
    const ctx1 = document.getElementById('kpiRankingChart')?.getContext('2d');
    const ctx2 = document.getElementById('kpiDistributionChart')?.getContext('2d');

    if (!ctx1 || !ctx2) return;

    const displayData = (data && data.length > 0) ? data.slice(0, 15) : [];

    const labels = displayData.map(c => c.name.length > 10 ? c.name.substring(0, 8) + '..' : c.name);

    let chartValues = [];
    let yAxisTitle = 'Titik Selesai';

    if (currentStatMetric === 'km') {
        chartValues = displayData.map(c => parseFloat((c.totalKM || 0).toFixed(1)));
        yAxisTitle = 'Jarak (KM)';
    } else {
        chartValues = displayData.map(c => c.completedStops || 0);
        yAxisTitle = 'Titik Selesai';
    }

    const backgroundColors = displayData.map((c, i) => i === 0 ? '#10B981' : '#E0F2FE');

    if (rankingChart) rankingChart.destroy();
    rankingChart = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: yAxisTitle,
                data: chartValues,
                backgroundColor: backgroundColors,
                borderRadius: 12,
                borderSkipped: false,
                barThickness: 'flex',
                maxBarThickness: 32
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const index = context.dataIndex;
                            const item = displayData[index];
                            if (!item) return '';
                            return [
                                `Selesai: ${item.completedStops} Titik`,
                                `Jarak: ${item.totalKM.toFixed(1)} km`
                            ];
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#F3F4F6' },
                    ticks: { font: { family: 'Plus Jakarta Sans', size: 10 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' } }
                }
            }
        }
    });

    let completedSum = 0, pendingSum = 0;
    const tripsToCount = (filteredTrips && filteredTrips.length > 0) ? filteredTrips : allCurrentTrips.filter(t => {
        if (typeof isTripInActiveBranch === 'function' && !isTripInActiveBranch(t)) return false;
        if (t.courierId && typeof isCourierInActiveBranch === 'function' && !isCourierInActiveBranch(t.courierId)) return false;
        return true;
    });

    tripsToCount.forEach(t => {
        if (t.destinations && t.destinations.length > 0) {
            t.destinations.forEach(d => {
                if (d.status === 'done' || d.proofPhotoUrl || d.status === 'completed') completedSum++;
                else pendingSum++;
            });
        } else {
            if (t.status === 'completed') completedSum++;
            else pendingSum++;
        }
    });

    const totalTasksSum = completedSum + pendingSum;
    const pctCompletedSum = totalTasksSum > 0 ? Math.round((completedSum / totalTasksSum) * 100) : 0;
    const pctPendingSum = totalTasksSum > 0 ? Math.round((pendingSum / totalTasksSum) * 100) : 0;

    if (distributionChart) distributionChart.destroy();
    distributionChart = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: [`Completed (${pctCompletedSum}%)`, `Pending (${pctPendingSum}%)`],
            datasets: [{
                data: [completedSum, pendingSum],
                backgroundColor: ['#10B981', '#F59E0B'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        boxWidth: 8,
                        font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const val = context.parsed || 0;
                            const total = totalTasksSum > 0 ? totalTasksSum : 1;
                            const pct = Math.round((val / total) * 100);
                            return ` ${context.label}: ${val} Titik (${pct}%)`;
                        }
                    }
                }
            },
            cutout: '72%'
        },
        plugins: [{
            id: 'centerText',
            afterDraw(chart) {
                const { ctx, chartArea: { left, top, width, height } } = chart;
                if (!width || !height) return;
                ctx.save();
                ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
                ctx.fillStyle = '#111827';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${pctCompletedSum}%`, left + width / 2, top + height / 2 - 8);

                ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
                ctx.fillStyle = '#6B7280';
                ctx.fillText('Selesai', left + width / 2, top + height / 2 + 12);
                ctx.restore();
            }
        }]
    });
}
