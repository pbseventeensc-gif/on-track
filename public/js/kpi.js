// ==========================================
// WTRACK LOGISTICS - KPI & STATISTICS MODULE
// ==========================================

let rankingChart = null;
let distributionChart = null;
let lastKPIData = [];
let kpiSortField = 'stops';
let kpiSortAsc = false;
let currentStatMetric = 'stops';

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
        const completionRate = c.totalStops > 0 ? Math.round((c.completedStops / c.totalStops) * 100) : 100;
        const stars = c.totalStops > 0 ? parseFloat(((completionRate / 100) * 5.0).toFixed(1)) : 5.0;
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
    const period = document.getElementById('stat-period-filter')?.value || 'this_week';
    const metric = document.getElementById('stat-metric-filter')?.value || 'stops';

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    let startMs = 0;
    let endMs = Infinity;

    if (period === 'today') {
        startMs = new Date(todayStr).setHours(0,0,0,0);
        endMs = new Date(todayStr).setHours(23,59,59,999);
    } else if (period === 'this_week') {
        const monday = new Date(today);
        const day = today.getDay() || 7;
        monday.setDate(today.getDate() - day + 1);
        startMs = monday.setHours(0,0,0,0);
        endMs = new Date(todayStr).setHours(23,59,59,999);
    } else if (period === 'this_month') {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        startMs = firstDay.setHours(0,0,0,0);
        endMs = new Date(todayStr).setHours(23,59,59,999);
    }

    const kpiStart = document.getElementById('kpi-start-date');
    const kpiEnd = document.getElementById('kpi-end-date');
    if (kpiStart && kpiEnd && period !== 'all') {
        kpiStart.value = new Date(startMs).toISOString().split('T')[0];
        kpiEnd.value = new Date(endMs).toISOString().split('T')[0];
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

    let filteredTrips = allCurrentTrips;

    if (startDateVal || endDateVal) {
        const startMs = startDateVal ? new Date(startDateVal).setHours(0,0,0,0) : 0;
        const endMs = endDateVal ? new Date(endDateVal).setHours(23,59,59,999) : Infinity;

        filteredTrips = allCurrentTrips.filter(t => {
            const tripMs = t.date?.seconds ? t.date.seconds * 1000 : 0;
            return tripMs >= startMs && tripMs <= endMs;
        });
    }

    const courierStats = {};
    let totalCompleted = 0;
    let grandTotalKM = 0;

    filteredTrips.forEach(t => {
        const cId = t.courierId;
        if(!courierStats[cId]) {
            courierStats[cId] = {
                name: registeredUsers[cId] || cId.substring(0,8),
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
                        ? ((t.acceptLatitude && t.acceptLongitude) ? { lat: t.acceptLatitude, lng: t.acceptLongitude } : { lat: t.destinations[0].latitude, lng: t.destinations[0].longitude })
                        : { lat: t.destinations[i-1].latitude, lng: t.destinations[i-1].longitude };
                    const end = { lat: d.latitude, lng: d.longitude };
                    const dist = calculateDistance(start.lat, start.lng, end.lat, end.lng);
                    actualTripKM += dist;
                }
            }

            // Calculate Start-to-Finish Duration for this trip (ACCEPT -> LAST FINISH)
            let startTimeMs = 0;
            if (t.acceptedTime && t.acceptedTime.seconds) {
                startTimeMs = t.acceptedTime.seconds * 1000;
            } else if (t.date && t.date.seconds) {
                startTimeMs = t.date.seconds * 1000;
            } else if (t.destinations && t.destinations[0] && t.destinations[0].arrivalTime && t.destinations[0].arrivalTime.seconds) {
                startTimeMs = t.destinations[0].arrivalTime.seconds * 1000;
            }

            let latestFinishMs = 0;
            t.destinations.forEach(d => {
                if (d.completedTime && d.completedTime.seconds) {
                    const ms = d.completedTime.seconds * 1000;
                    if (ms > latestFinishMs) latestFinishMs = ms;
                }
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
    } else if (currentStatMetric === 'time') {
        kpiSortField = 'time';
        kpiSortAsc = false;
    } else if (currentStatMetric === 'stops') {
        kpiSortField = 'stops';
        kpiSortAsc = false;
    }

    displayCouriers.sort((a, b) => {
        let valA = a.completedStops;
        let valB = b.completedStops;

        if (kpiSortField === 'distance') {
            valA = a.totalKM || 0;
            valB = b.totalKM || 0;
        } else if (kpiSortField === 'time') {
            valA = a.totalTime || 0;
            valB = b.totalTime || 0;
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

    const topCourier = displayCouriers[0];
    if (topCourier) {
        if(document.getElementById('kpi-top-courier')) {
            document.getElementById('kpi-top-courier').innerText = topCourier.name;
        }
        if(document.getElementById('kpi-total-km')) {
            document.getElementById('kpi-total-km').innerText = (topCourier.totalKM || 0).toFixed(1) + " km";
        }
        if(document.getElementById('kpi-total-done')) {
            document.getElementById('kpi-total-done').innerText = topCourier.completedStops || 0;
        }
    } else {
        if(document.getElementById('kpi-top-courier')) document.getElementById('kpi-top-courier').innerText = '-';
        if(document.getElementById('kpi-total-km')) document.getElementById('kpi-total-km').innerText = '0.0 km';
        if(document.getElementById('kpi-total-done')) document.getElementById('kpi-total-done').innerText = '0';
    }

    displayCouriers.forEach(c => {
        const courierId = Object.keys(registeredUsers).find(key => registeredUsers[key] === c.name);
        const isOnline = currentOnlineCouriers[courierId];

        let podIconsHtml = '';
        filteredTrips.filter(t => t.courierId === courierId).forEach(trip => {
            if (trip.destinations) {
                trip.destinations.forEach(d => {
                    if (d.proofPhotoUrl) {
                        podIconsHtml += `<i class="bi bi-camera text-primary ms-1 cursor-pointer" data-url="${d.proofPhotoUrl}" onclick="openPoDModal(this.dataset.url)" title="Stop ${d.stopIndex}"></i> `;
                    }
                });
            }
        });

        const completionRate = c.totalStops > 0 ? (c.completedStops / c.totalStops) * 100 : 100;
        let stars = 5.0;
        let finalScore = 100;

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

        tbody.innerHTML += `<tr>
            <td class="fw-bold">${c.name} <div class="mt-1">${podIconsHtml}</div></td>
            <td><span class="badge-pill ${isOnline ? 'badge-delivered' : 'badge-delayed'}">${isOnline ? 'Active' : 'Offline'}</span></td>
            <td><span class="fw-bold">${c.completedStops}</span> / <span class="text-muted">${c.totalStops}</span></td>
            <td><i class="bi bi-star-fill text-warning me-1"></i> <strong>${stars.toFixed(1)}</strong></td>
            <td>${c.totalKM.toFixed(1)} km</td>
            <td class="d-none">${durationStr}</td>
            <td><span class="badge bg-dark px-2 py-1">${finalScore}</span></td>
        </tr>`;
    });

    updateKPICharts(displayCouriers);
}

function updateKPICharts(data) {
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
    } else if (currentStatMetric === 'time') {
        chartValues = displayData.map(c => parseFloat(((c.totalTime || 0) / 60).toFixed(1)));
        yAxisTitle = 'Durasi (Jam)';
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
                            const hours = Math.floor((item.totalTime || 0) / 60);
                            const mins = Math.round((item.totalTime || 0) % 60);
                            const durationStr = hours > 0 ? `${hours}j ${mins}m` : `${mins}m`;
                            return [
                                `Selesai: ${item.completedStops} Titik`,
                                `Jarak: ${item.totalKM.toFixed(1)} km`,
                                `Durasi: ${durationStr}`
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

    let completedSum = 0, inTransitSum = 0, pendingSum = 0;
    allCurrentTrips.forEach(t => {
        if (t.destinations && t.destinations.length > 0) {
            t.destinations.forEach(d => {
                if (d.status === 'done' || d.proofPhotoUrl) completedSum++;
                else if (d.status === 'arrived') inTransitSum++;
                else pendingSum++;
            });
        } else {
            if (t.status === 'completed') completedSum++;
            else if (t.status === 'in_progress') inTransitSum++;
            else pendingSum++;
        }
    });

    if (distributionChart) distributionChart.destroy();
    distributionChart = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: ['Completed', 'Pending', 'In Transit'],
            datasets: [{
                data: [completedSum, pendingSum, inTransitSum],
                backgroundColor: ['#10B981', '#F59E0B', '#3B82F6'],
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
                }
            },
            cutout: '75%'
        }
    });
}
