/**
 * Wellen Print - Shipment Volume Comparison & Data Breakdown Component
 * Professional ERP Dashboard Component matching Esse reference
 * 
 * Features:
 * - Metric Switcher: Titik Pengantaran vs Surat Jalan
 * - X-Axis: Senin sampai Minggu (termasuk Minggu jika ada lembur)
 * - Region Filter: Semua Region, Jakarta Barat, Tangerang, dll.
 * - Floating Black Tooltip on hover (Esse style)
 * - Data Breakdown Table (Klien / Region) with sorting, search, and row hover
 * - Download Report button (strictly named "Report")
 * - 100% Mobile & Tablet Responsive
 */
(function(root) {
    'use strict';

    const STORAGE_COLLAPSE_KEY = 'wtrack_volume_comparison_collapsed';
    const DAYS_ORDER = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
    const DAYS_META = {
        'Senin': { label: 'Senin', short: 'Sen', isWeekend: false, defaultOvertime: false },
        'Selasa': { label: 'Selasa', short: 'Sel', isWeekend: false, defaultOvertime: false },
        'Rabu': { label: 'Rabu', short: 'Rab', isWeekend: false, defaultOvertime: false },
        'Kamis': { label: 'Kamis', short: 'Kam', isWeekend: false, defaultOvertime: false },
        'Jumat': { label: 'Jumat', short: 'Jum', isWeekend: false, defaultOvertime: false },
        'Sabtu': { label: 'Sabtu', short: 'Sab', isWeekend: true, defaultOvertime: false },
        'Minggu': { label: 'Minggu', short: 'Min', isWeekend: true, defaultOvertime: true }
    };

    // State
    let isCollapsed = root.localStorage.getItem(STORAGE_COLLAPSE_KEY) === 'true';
    let currentMetric = 'destinations'; // 'destinations' (Titik Pengantaran) or 'sj' (Surat Jalan)
    let currentRegion = 'all'; // 'all' or specific region string
    let currentAdmin = 'all'; // 'all' or specific Admin SJ
    let currentCourier = 'all'; // 'all' or specific courier
    let currentVehicle = 'all'; // 'all', 'mobil', 'motor'
    let startDate = '';
    let endDate = '';
    let breakdownDim = 'customer'; // 'customer' (Klien) or 'region' (Region)
    let breakdownSearch = '';
    let sortField = 'total'; // 'total', 'delivered', 'share', 'name'
    let sortDir = 'desc'; // 'desc' or 'asc'
    let hoveredDayIdx = null;
    let shipmentSelection = null;

    function fmtNum(n) {
        return Number(n || 0).toLocaleString('id-ID');
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    const text = value => typeof value === 'string' ? value.trim() : '';
    const normalize = value => text(value).normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g, '');
    const done = value => ['delivered', 'completed', 'done'].includes(text(value?.status).toLowerCase());

    function dateKey(value) {
        if (!value) return '';
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
            const dmy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
            if (dmy) {
                const day = dmy[1].padStart(2, '0');
                const mon = dmy[2].padStart(2, '0');
                const year = dmy[3];
                return `${year}-${mon}-${day}`;
            }
        }
        const ms = typeof value?.toMillis === 'function' ? value.toMillis() :
            typeof value?.toDate === 'function' ? value.toDate().getTime() :
            value?.seconds !== undefined ? Number(value.seconds) * 1000 :
            value?._seconds !== undefined ? Number(value._seconds) * 1000 :
            typeof value === 'number' ? value :
            (typeof value === 'string' && value.startsWith('TRIP_') ? parseInt(value.replace('TRIP_', ''), 10) : Date.parse(value));
        if (!Number.isFinite(ms) || ms <= 0) return '';
        return new Date(ms + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
    }

    function currentWeek() {
        const today = dateKey(Date.now());
        const monday = new Date(today + 'T00:00:00Z');
        monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
        const sunday = new Date(monday);
        sunday.setUTCDate(sunday.getUTCDate() + 6);
        return [monday.toISOString().slice(0, 10), sunday.toISOString().slice(0, 10)];
    }
    [startDate, endDate] = currentWeek();

    const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    function formatShortDate(dateStr) {
        if (!dateStr || typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return '';
        const parts = dateStr.split('-');
        const day = parts[2];
        const monthIdx = parseInt(parts[1], 10) - 1;
        const month = MONTH_NAMES_SHORT[monthIdx] || '';
        return `${day} ${month}`;
    }

    function formatIndoDate(dateStr, withDay = false) {
        if (!dateStr || typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr || '';
        const parts = dateStr.split('-');
        const dayNum = parseInt(parts[2], 10);
        const monthIdx = parseInt(parts[1], 10) - 1;
        const month = MONTH_NAMES_SHORT[monthIdx] || '';
        const year = parts[0];
        if (withDay) {
            const dayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date(dateStr + 'T00:00:00Z').getUTCDay()];
            return `${dayName}, ${dayNum} ${month} ${year}`;
        }
        return `${dayNum} ${month} ${year}`;
    }

    function formatIndoDateRange(startStr, endStr) {
        if (!startStr && !endStr) return 'Semua';
        if (!startStr) return `s/d ${formatIndoDate(endStr)}`;
        if (!endStr) return `Mulai ${formatIndoDate(startStr)}`;
        if (startStr === endStr) return formatIndoDate(startStr, true);
        const p1 = startStr.split('-'), p2 = endStr.split('-');
        if (p1.length === 3 && p2.length === 3) {
            const d1 = parseInt(p1[2], 10), d2 = parseInt(p2[2], 10);
            const m1 = MONTH_NAMES_SHORT[parseInt(p1[1], 10) - 1] || '';
            const m2 = MONTH_NAMES_SHORT[parseInt(p2[1], 10) - 1] || '';
            const y1 = p1[0], y2 = p2[0];
            if (y1 === y2 && m1 === m2) {
                return `${d1}–${d2} ${m1} ${y1}`;
            }
            if (y1 === y2) {
                return `${d1} ${m1} – ${d2} ${m2} ${y1}`;
            }
            return `${d1} ${m1} ${y1} – ${d2} ${m2} ${y2}`;
        }
        return `${startStr} – ${endStr}`;
    }

    function resolveVehicleType(trip, stop, courier) {
        const raw = text(stop?.vehicleType) || text(trip?.vehicleType);
        if (raw) return raw.toLowerCase();
        if (typeof root.getCourierVehicleType === 'function') {
            const vt = root.getCourierVehicleType(trip?.courierId, courier);
            if (vt) return String(vt).toLowerCase();
        }
        if (typeof root.normalizeCourierIdentity === 'function') {
            const vt = root.normalizeCourierIdentity(trip?.courierId, courier)?.vehicleType;
            if (vt) return String(vt).toLowerCase();
        }
        if (Array.isArray(root.MASTER_COURIERS)) {
            const cStr = String(courier || trip?.courierName || trip?.courierId || '').toLowerCase().trim();
            const found = root.MASTER_COURIERS.find(m => 
                (m.canonicalId && cStr.includes(m.canonicalId.toLowerCase())) ||
                (m.displayName && cStr.includes(m.displayName.toLowerCase())) ||
                (Array.isArray(m.matchTokens) && m.matchTokens.some(tok => cStr.includes(tok.toLowerCase())))
            );
            if (found && found.vehicleType) return String(found.vehicleType).toLowerCase();
        }
        const cStr = String(courier || trip?.courierName || trip?.courierId || '').toLowerCase();
        const mobilNames = ['soleh', 'romi', 'firdaus', 'alan', 'yakub', 'iwan', 'agung', 'husen', 'rizki'];
        if (mobilNames.some(m => cStr.includes(m))) return 'mobil';
        return 'motor';
    }

    function collectTripData() {
        // The trips snapshot is authoritative. Pool and browser caches are not assignments.
        const trips = Array.isArray(root.allCurrentTrips) ? root.allCurrentTrips : [];
        const clients = root.getCustomerMasterRows?.() || [];
        const byAddress = new Map();
        clients.forEach(client => {
            const key = normalize(client.address);
            if (!key || !text(client.name)) return;
            if (!byAddress.has(key)) byAddress.set(key, []);
            byAddress.get(key).push(client);
        });
        const seenTrips = new Set(), seenDeliveries = new Set(), items = [];
        trips.forEach(trip => {
            const tripId = text(trip.id) || text(trip.tripId);
            if (!tripId || seenTrips.has(tripId) || trip.status === 'pool' || !text(trip.courierId) ||
                trip.completionMethod === 'customer_pickup' || trip.deliveryMethod === 'customer_pickup') return;
            if (typeof root.isTripInActiveBranch === 'function' && !root.isTripInActiveBranch(trip)) return;
            seenTrips.add(tripId);
            const stops = trip.destinations?.length ? trip.destinations : [trip];
            stops.forEach((stop, index) => {
                const deliveryKey = text(stop.deliveryId) || `${tripId}:${index}`;
                if (seenDeliveries.has(deliveryKey)) return;
                seenDeliveries.add(deliveryKey);
                const address = text(stop.address) || text(trip.address);
                const storedName = text(stop.customer) || text(stop.clientName) || text(stop.locationName) ||
                    text(trip.customer) || text(trip.clientName);
                const matches = byAddress.get(normalize(address)) || [];
                const named = matches.find(client => normalize(client.name) === normalize(storedName));
                const uniqueNames = new Set(matches.map(client => normalize(client.name)));
                const client = named || (uniqueNames.size === 1 ? matches[0] : null);
                const customer = text(client?.name) || address || storedName || 'Alamat belum tersedia';
                const completed = done(stop) || (!text(stop.status) && done(trip));
                let date = '';
                if (typeof root.isTripInDateRange === 'function') {
                    const now = new Date();
                    const todayDayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                    const todayEndMs = todayDayMs + 86400000 - 1;
                    if (root.isTripInDateRange(trip, todayDayMs, todayEndMs)) {
                        const stopDoneTime = completed ? (stop.completedTime || stop.completedAt) : null;
                        const stopDate = dateKey(stopDoneTime);
                        if (stopDate && stopDate !== dateKey(todayDayMs)) {
                            date = stopDate;
                        } else {
                            date = dateKey(todayDayMs);
                        }
                    }
                }
                if (!date && completed) {
                    date = dateKey(stop.completedTime || stop.completedAt || trip.completedTime || trip.completedAt);
                }
                if (!date) {
                    date = dateKey(stop.arrivalTime || trip.arrivalTime || stop.assignedAt || stop.date);
                }
                if (!date) {
                    date = dateKey(
                        trip.dateFolder ||
                        trip.date ||
                        trip.assignedAt ||
                        trip.assignedTime ||
                        trip.acceptedTime ||
                        trip.updatedAt ||
                        trip.createdAt ||
                        (typeof trip.id === 'string' && trip.id.startsWith('TRIP_') ? trip.id : null)
                    );
                }
                // A missing date cannot be assigned to an arbitrary weekday.
                if (!date) return;
                const day = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date(date + 'T00:00:00Z').getUTCDay()];
                const sj = text(stop.noSJ) || text(stop.sjNumber) || text(trip.noSJ) || text(trip.sjNumber);
                const courier = text(trip.courierName) || text(trip.courier) || text(root.getCourierDisplayName?.(trip.courierId)) || trip.courierId;
                const adminSJ = text(stop.adminSJ) || text(trip.adminSJ) || text(client?.adminSJ) ||
                    text(root.CourierAdminSJ?.resolve?.(trip, stop)) || 'Belum diatur';
                const vehicleType = resolveVehicleType(trip, stop, courier);
                items.push({id: deliveryKey, tripId, destinationIndex: index, sj, day, date, address, customer,
                    region: text(stop.region) || text(client?.region) || text(trip.region) || 'Belum diatur',
                    courier, courierId: trip.courierId, adminSJ, vehicleType, destinations: 1,
                    deliveredDestinations: completed ? 1 : 0,
                    returned: !completed && (['returned','failed','pending_approval','klien_tutup'].includes(text(stop.status).toLowerCase()) || !!stop.pendingReason),
                    sjCount: sj ? 1 : 0, deliveredSJ: sj && completed ? 1 : 0,
                    status: completed ? 'Delivered' : 'On Delivery', isOvertime: day === 'Minggu'});
            });
        });
        return items;
    }

    function countSJ(items) {
        const groups = new Map();
        items.forEach(item => {
            if (!item.sj) return;
            const key = normalize(item.sj);
            groups.set(key, (groups.get(key) ?? true) && item.deliveredDestinations === item.destinations);
        });
        return {total: groups.size, delivered: [...groups.values()].filter(Boolean).length};
    }

    function getAvailableRegions(data) {
        const regionsSet = new Set();
        data.forEach(d => {
            if (d.region) regionsSet.add(d.region.trim());
        });
        // Ensure standard Jabodetabek regions are included
        ['Jakarta Barat', 'Jakarta Pusat', 'Jakarta Selatan', 'Jakarta Timur', 'Jakarta Utara', 'Tangerang', 'Bekasi'].forEach(r => regionsSet.add(r));
        return Array.from(regionsSet).sort();
    }

    function getAvailableAdmins(data) {
        const adminsSet = new Set();
        data.forEach(d => {
            if (d.adminSJ && d.adminSJ !== 'Belum diatur') adminsSet.add(d.adminSJ.trim());
        });
        return Array.from(adminsSet).sort();
    }

    function getAvailableCouriers(data) {
        const couriersSet = new Set();
        data.forEach(d => {
            if (d.courier && d.courier !== 'Unassigned') couriersSet.add(d.courier.trim());
        });
        if (Array.isArray(root.MASTER_COURIERS)) {
            root.MASTER_COURIERS.forEach(c => {
                if (c.displayName) couriersSet.add(c.displayName.trim());
            });
        }
        if (root.registeredUsers) {
            Object.values(root.registeredUsers).forEach(u => {
                if (typeof u === 'string' && u.trim()) couriersSet.add(u.trim());
            });
        }
        return Array.from(couriersSet).sort();
    }

    function buildCourierFilterOptions(selectedCourier, availableCouriers) {
        if (typeof root.buildCourierOptgroupHtml === 'function') {
            const raw = root.buildCourierOptgroupHtml('Kurir', 'displayName');
            let html = raw.replace('<option value="">Kurir</option>', '<option value="all">Kurir</option>');
            if (selectedCourier && selectedCourier !== 'all') {
                html = html.replace(
                    new RegExp(`(<option\\s+value="${escapeHtml(selectedCourier)}"|value="${selectedCourier}")`, 'i'),
                    (m) => m + ' selected'
                );
            } else {
                html = html.replace('<option value="all">Kurir</option>', '<option value="all" selected>Kurir</option>');
            }
            return html;
        }
        const list = Array.isArray(availableCouriers) ? availableCouriers : [];
        return `
            <option value="all" ${selectedCourier === 'all' ? 'selected' : ''}>Kurir</option>
            ${list.map(c => `<option value="${escapeHtml(c)}" ${selectedCourier.toLowerCase() === c.toLowerCase() ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
        `;
    }

    function filterTripItems(data, regionFilter, adminFilter, courierFilter, startFilter, endFilter, vehicleFilter = 'all') {
        let filtered = data;
        if (regionFilter && regionFilter !== 'all') {
            filtered = filtered.filter(d => String(d.region || '').toLowerCase() === regionFilter.toLowerCase());
        }
        if (adminFilter && adminFilter !== 'all') {
            filtered = filtered.filter(d => String(d.adminSJ || '').toLowerCase() === adminFilter.toLowerCase());
        }
        if (courierFilter && courierFilter !== 'all' && courierFilter !== '') {
            const cf = courierFilter.toLowerCase().trim();
            filtered = filtered.filter(d => {
                const c = String(d.courier || '').toLowerCase().trim();
                return c === cf || String(d.courierId || '').toLowerCase() === cf;
            });
        }
        if (vehicleFilter && vehicleFilter !== 'all' && vehicleFilter !== '') {
            const vf = vehicleFilter.toLowerCase().trim();
            filtered = filtered.filter(d => (d.vehicleType || 'motor').toLowerCase() === vf);
        }
        if (startFilter) {
            filtered = filtered.filter(d => d.date && d.date >= startFilter);
        }
        if (endFilter) {
            filtered = filtered.filter(d => d.date && d.date <= endFilter);
        }
        return filtered;
    }

    function computeDailyBuckets(data, metric, regionFilter, adminFilter, courierFilter, startFilter, endFilter, vehicleFilter = 'all') {
        const filtered = filterTripItems(data, regionFilter, adminFilter, courierFilter, startFilter, endFilter, vehicleFilter);

        const effectiveStart = startFilter || startDate;
        let baseMonday = '';
        if (effectiveStart && /^\d{4}-\d{2}-\d{2}$/.test(effectiveStart)) {
            const d = new Date(effectiveStart + 'T00:00:00Z');
            const dayOfWeek = (d.getUTCDay() + 6) % 7;
            const m = new Date(d);
            m.setUTCDate(d.getUTCDate() - dayOfWeek);
            baseMonday = m.toISOString().slice(0, 10);
        } else {
            const withDate = (filtered.find(d => d.date) || (Array.isArray(data) ? data.find(d => d.date) : null));
            if (withDate && withDate.date && /^\d{4}-\d{2}-\d{2}$/.test(withDate.date)) {
                const d = new Date(withDate.date + 'T00:00:00Z');
                const dayOfWeek = (d.getUTCDay() + 6) % 7;
                const m = new Date(d);
                m.setUTCDate(d.getUTCDate() - dayOfWeek);
                baseMonday = m.toISOString().slice(0, 10);
            } else {
                baseMonday = currentWeek()[0];
            }
        }

        const todayStr = dateKey(Date.now());

        return DAYS_ORDER.map((dayName, dayIndex) => {
            const dayItems = filtered.filter(d => d.day === dayName);

            let bucketDate = '';
            if (baseMonday) {
                const target = new Date(baseMonday + 'T00:00:00Z');
                target.setUTCDate(target.getUTCDate() + dayIndex);
                bucketDate = target.toISOString().slice(0, 10);
            } else if (dayItems.length > 0 && dayItems[0].date) {
                bucketDate = dayItems[0].date;
            }

            const isToday = bucketDate === todayStr;

            let totalDest = 0;
            let delivDest = 0;
            let totalSJ = 0;
            let delivSJ = 0;

            dayItems.forEach(item => {
                totalDest += item.destinations || 0;
                delivDest += item.deliveredDestinations || 0;
                totalSJ += item.sjCount || 0;
                delivSJ += item.deliveredSJ || 0;
            });

            const sjCounts = countSJ(dayItems);
            totalSJ = sjCounts.total;
            delivSJ = sjCounts.delivered;
            const failedDest = Math.max(0, totalDest - delivDest);
            const failedSJ = Math.max(0, totalSJ - delivSJ);
            const total = metric === 'destinations' ? totalDest : totalSJ;
            const delivered = metric === 'destinations' ? delivDest : delivSJ;
            const failed = metric === 'destinations' ? failedDest : failedSJ;

            const isOvertime = dayName === 'Minggu' && total > 0;

            return {
                day: dayName,
                short: DAYS_META[dayName].short,
                date: bucketDate,
                dateFormatted: formatShortDate(bucketDate),
                isToday,
                total,
                delivered,
                failed,
                totalDest,
                delivDest,
                failedDest,
                totalSJ,
                delivSJ,
                failedSJ,
                isOvertime,
                itemsCount: dayItems.length
            };
        });
    }

    function computeBreakdownData(data, dim, regionFilter, adminFilter, courierFilter, startFilter, endFilter, searchQuery, vehicleFilter = 'all') {
        let filtered = filterTripItems(data, regionFilter, adminFilter, courierFilter, startFilter, endFilter, vehicleFilter);

        if (searchQuery) {
            const q = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(d => 
                (d.customer && d.customer.toLowerCase().includes(q)) ||
                (d.region && d.region.toLowerCase().includes(q)) ||
                (d.adminSJ && d.adminSJ.toLowerCase().includes(q)) ||
                (d.courier && d.courier.toLowerCase().includes(q)) ||
                (d.id && d.id.toLowerCase().includes(q))
            );
        }

        const map = new Map();

        filtered.forEach(d => {
            const key = dim === 'customer' ? (d.customer || 'Customer Lainnya') : (d.region || 'Lainnya');
            const existing = map.get(key) || {
                key,
                name: key,
                region: d.region || 'Jabodetabek',
                customers: new Set(),
                totalSJ: 0,
                deliveredSJ: 0,
                totalDest: 0,
                deliveredDest: 0,
                count: 0,
                items: []
            };

            existing.customers.add(d.customer);
            existing.items.push(d);
            existing.totalSJ += d.sjCount || 0;
            existing.deliveredSJ += d.deliveredSJ || 0;
            existing.totalDest += d.destinations || 1;
            existing.deliveredDest += d.deliveredDestinations || 0;
            existing.count += 1;

            map.set(key, existing);
        });

        map.forEach(entry => {
            const counts = countSJ(entry.items);
            entry.totalSJ = counts.total; entry.deliveredSJ = counts.delivered;
        });

        // Compute overall totals for share calculation
        let grandTotal = 0;
        map.forEach(entry => {
            const primaryTotal = currentMetric === 'destinations' ? entry.totalDest : entry.totalSJ;
            grandTotal += primaryTotal;
        });

        const list = Array.from(map.values()).map(entry => {
            const primaryTotal = currentMetric === 'destinations' ? entry.totalDest : entry.totalSJ;
            const primaryDelivered = currentMetric === 'destinations' ? entry.deliveredDest : entry.deliveredSJ;
            const sharePct = grandTotal > 0 ? (primaryTotal / grandTotal) * 100 : 0;
            const successPct = primaryTotal > 0 ? (primaryDelivered / primaryTotal) * 100 : 0;

            return {
                ...entry,
                total: primaryTotal,
                delivered: primaryDelivered,
                sharePct,
                successPct,
                uniqueClientsCount: entry.customers.size,
                topClientsStr: Array.from(entry.customers).slice(0, 2).join(', ') + (entry.customers.size > 2 ? ` (+${entry.customers.size - 2})` : '')
            };
        });

        // Sort list
        list.sort((a, b) => {
            let res = 0;
            if (sortField === 'name') {
                res = a.name.localeCompare(b.name);
            } else if (sortField === 'delivered') {
                res = a.delivered - b.delivered;
            } else if (sortField === 'share') {
                res = a.sharePct - b.sharePct;
            } else {
                // 'total'
                res = a.total - b.total;
            }
            return sortDir === 'asc' ? res : -res;
        });

        return { list, grandTotal,
            totalSJAll: list.reduce((sum, row) => sum + row.totalSJ, 0),
            totalDestAll: list.reduce((sum, row) => sum + row.totalDest, 0),
            deliveredDestAll: list.reduce((sum, row) => sum + row.deliveredDest, 0) };
    }

    function renderSvgChart(buckets, metric, regionFilter) {
        let maxVal = 0;
        buckets.forEach(b => {
            if (b.total > maxVal) maxVal = b.total;
            if (b.delivered > maxVal) maxVal = b.delivered;
            if (b.failed > maxVal) maxVal = b.failed;
        });

        // Nice scale step
        const step = Math.ceil(maxVal / 4 / 5) * 5 || (metric === 'destinations' ? 10 : 5);
        const roundedMax = Math.max(step * 4, metric === 'destinations' ? 20 : 10);

        const chartWidth = 840;
        const chartHeight = 255;
        const zeroY = 205;
        const topY = 28;
        const plotHeight = zeroY - topY;

        // Grid lines (5 ticks)
        const leftAxisX = 52;
        const rightGridX = chartWidth - 28;
        const plotStartX = 60;
        const plotEndX = chartWidth - 36;
        const plotWidth = plotEndX - plotStartX;
        const slotWidth = plotWidth / 7;

        let gridHtml = '';
        for (let i = 0; i <= 4; i++) {
            const val = Math.round(step * i);
            const y = zeroY - (val / roundedMax) * plotHeight;
            gridHtml += `
                <g>
                    <line x1="${leftAxisX + 6}" x2="${rightGridX}" y1="${y}" y2="${y}" stroke="${i === 0 ? '#D0D5DD' : '#EAECF0'}" stroke-width="1"></line>
                    <text x="${leftAxisX}" y="${y + 4}" text-anchor="end" style="font-size: 11px; font-family: monospace; fill: #667085; font-weight: 500;">${val}</text>
                </g>
            `;
        }

        const barWidth = 13;
        const barGap = 3.5;
        let barsHtml = '';

        buckets.forEach((b, idx) => {
            const slotCenter = plotStartX + idx * slotWidth + slotWidth / 2;
            const barGroupWidth = barWidth * 3 + barGap * 2;
            const groupX = slotCenter - barGroupWidth / 2;
            const barPairCenter = slotCenter;

            const totalHeight = b.total > 0 ? Math.max(6, (b.total / roundedMax) * plotHeight) : 0;
            const deliveredHeight = b.delivered > 0 ? Math.max(6, (b.delivered / roundedMax) * plotHeight) : 0;
            const failedHeight = b.failed > 0 ? Math.max(6, (b.failed / roundedMax) * plotHeight) : 0;

            const totalY = zeroY - totalHeight;
            const deliveredY = zeroY - deliveredHeight;
            const failedY = zeroY - failedHeight;

            const unitLabel = metric === 'destinations' ? 'Titik' : 'SJ';
            const isSunday = b.day === 'Minggu';

            barsHtml += `
                <g class="cursor-pointer chart-day-group" data-idx="${idx}" role="button" tabindex="0" aria-label="Tampilkan pengiriman ${b.day}${b.dateFormatted ? ` (${b.dateFormatted})` : ''}" onclick="VolumeComparison.filterByDay(${idx}, event)" onkeydown="if(event.key === 'Enter' || event.key === ' '){event.preventDefault(); VolumeComparison.filterByDay(${idx}, event)}"
                   onmouseenter="VolumeComparison.showTooltip(${idx}, ${barPairCenter}, ${Math.min(totalY, deliveredY, failedY)})"
                   onmousemove="VolumeComparison.updateTooltipPos(event)"
                   onmouseleave="VolumeComparison.hideTooltip()">
                    
                    <!-- Hover hit area -->
                    <rect x="${slotCenter - slotWidth / 2 + 2}" y="${topY - 8}" width="${slotWidth - 4}" height="${plotHeight + 54}" rx="6" fill="#F8F9FA" opacity="0" class="day-hover-bg"></rect>
                    
                    <!-- Orange Bar: Total (Titik Pengantaran / Surat Jalan) -->
                    ${b.total > 0 ? `
                        <rect x="${groupX}" y="${totalY}" width="${barWidth}" height="${totalHeight}" rx="3.5" fill="#CC6100" class="chart-bar-total"></rect>
                        <text x="${groupX + barWidth / 2}" y="${totalY - 5}" text-anchor="middle" style="fill: #101828; font-size: 10.5px; font-weight: 700; font-family: monospace;">${b.total}</text>
                    ` : `
                        <text x="${groupX + barWidth / 2}" y="${zeroY - 5}" text-anchor="middle" style="fill: #98A2B3; font-size: 10px; font-weight: 500; font-family: monospace;">0</text>
                    `}
                    
                    <!-- Green Bar: Berhasil Diantar (Sukses) -->
                    ${b.delivered > 0 ? `
                        <rect x="${groupX + barWidth + barGap}" y="${deliveredY}" width="${barWidth}" height="${deliveredHeight}" rx="3.5" fill="#12B76A" class="chart-bar-delivered"></rect>
                        <text class="chart-bar-delivered" x="${groupX + barWidth + barGap + barWidth / 2}" y="${deliveredY - 5}" text-anchor="middle" style="fill: #027A48; font-size: 10.5px; font-weight: 700; font-family: monospace;">${b.delivered}</text>
                    ` : (b.total > 0 ? `
                        <rect x="${groupX + barWidth + barGap}" y="${zeroY - 3}" width="${barWidth}" height="3" rx="1.5" fill="#D0D5DD"></rect>
                        <text x="${groupX + barWidth + barGap + barWidth / 2}" y="${zeroY - 5}" text-anchor="middle" style="fill: #98A2B3; font-size: 10px; font-weight: 500; font-family: monospace;">0</text>
                    ` : '')}

                    <!-- Red Bar: Gagal Kirim -->
                    ${b.failed > 0 ? `
                        <rect x="${groupX + (barWidth + barGap) * 2}" y="${failedY}" width="${barWidth}" height="${failedHeight}" rx="3.5" fill="#D92D20" class="chart-bar-failed"></rect>
                        <text class="chart-bar-failed" x="${groupX + (barWidth + barGap) * 2 + barWidth / 2}" y="${failedY - 5}" text-anchor="middle" style="fill: #B42318; font-size: 10.5px; font-weight: 700; font-family: monospace;">${b.failed}</text>
                    ` : (b.total > 0 ? `
                        <rect x="${groupX + (barWidth + barGap) * 2}" y="${zeroY - 3}" width="${barWidth}" height="3" rx="1.5" fill="#FEE4E2" class="chart-bar-failed"></rect>
                        <text class="chart-bar-failed" x="${groupX + (barWidth + barGap) * 2 + barWidth / 2}" y="${zeroY - 5}" text-anchor="middle" style="fill: #FDA29B; font-size: 10px; font-weight: 500; font-family: monospace;">0</text>
                    ` : '')}
                    
                    <!-- X-Axis Day & Date Label -->
                    <text x="${barPairCenter}" y="${zeroY + 16}" text-anchor="middle" style="fill: ${isSunday && b.isOvertime ? '#CC6100' : (b.isToday ? '#CC6100' : '#101828')}; font-size: 12px; font-weight: ${isSunday && b.isOvertime ? '700' : (b.isToday ? '700' : '600')}; font-family: inherit;">
                        ${b.day}
                    </text>
                    ${b.dateFormatted ? `
                        <text x="${barPairCenter}" y="${zeroY + 30}" text-anchor="middle" style="fill: ${b.isToday ? '#CC6100' : '#667085'}; font-size: 10.5px; font-weight: ${b.isToday ? '700' : '500'}; font-family: inherit;">
                            ${b.dateFormatted}
                        </text>
                    ` : ''}
                    ${isSunday && b.isOvertime ? `
                        <text x="${barPairCenter}" y="${b.dateFormatted ? zeroY + 43 : zeroY + 30}" text-anchor="middle" style="fill: #CC6100; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">(Lembur)</text>
                    ` : (isSunday && b.total === 0 ? `
                        <text x="${barPairCenter}" y="${b.dateFormatted ? zeroY + 43 : zeroY + 30}" text-anchor="middle" style="fill: #98A2B3; font-size: 9px; font-weight: 500;">(Libur)</text>
                    ` : '')}
                </g>
            `;
        });

        const metricTitle = metric === 'destinations' ? 'Titik Pengantaran' : 'Surat Jalan';

        return `
            <div class="position-relative w-full overflow-hidden pt-1" id="volume-svg-container" style="min-height: 220px;">
                <!-- Floating Black Tooltip (Esse style) -->
                <div id="esse-chart-tooltip" class="esse-dark-tooltip d-none" style="position: absolute;"></div>

                <svg viewBox="0 0 ${chartWidth} ${chartHeight + 20}" preserveAspectRatio="xMidYMid meet" style="width: 100%; height: auto; max-height: 275px; display: block;" role="group" aria-label="Grafik perbandingan pengiriman ${metricTitle}">
                    ${gridHtml}
                    ${barsHtml}
                </svg>
            </div>
        `;
    }

    function renderBreakdownTable(breakdownData, metric) {
        const { list, grandTotal } = breakdownData;
        const metricUnit = metric === 'destinations' ? 'Titik' : 'SJ';
        const isDimCustomer = breakdownDim === 'customer';

        if (list.length === 0) {
            return `
                <div class="text-center py-5 text-muted" style="font-size: 13px;">
                    <i class="bi bi-inbox fs-3 d-block mb-2 text-muted"></i>
                    Tidak ada data breakdown untuk filter "${escapeHtml(breakdownSearch || currentRegion)}".
                </div>
            `;
        }

        let totalSJAll = 0;
        let totalDestAll = 0;
        let delivDestAll = 0;

        list.forEach(item => {
            totalSJAll += item.totalSJ;
            totalDestAll += item.totalDest;
            delivDestAll += item.deliveredDest;
        });

        totalSJAll = countSJ(list.flatMap(item => item.items)).total;
        const regionCount = new Set(list.flatMap(item => item.items.map(row => row.region))).size;
        const clientCount = new Set(list.flatMap(item => item.items.map(row => row.customer))).size;
        const headerCount = (key, value) => `<span class="vol-header-count" data-count="${key}" style="font-size:10px;font-weight:600;letter-spacing:0;text-transform:none;background:#EAECF0;color:#475467;border-radius:5px;padding:1px 5px;margin-left:4px">${fmtNum(value)}</span>`;

        const overallSuccessRate = totalDestAll > 0 ? Math.round((delivDestAll / totalDestAll) * 100) : 0;

        const rowsHtml = list.map((item, idx) => {
            const rowTotal = metric === 'destinations' ? item.totalDest : item.totalSJ;
            const rowDelivered = metric === 'destinations' ? item.deliveredDest : item.deliveredSJ;
            const rowPending = Math.max(0, rowTotal - rowDelivered);
            const rowRate = rowTotal > 0 ? Math.round((rowDelivered / rowTotal) * 100) : 0;

            return `
                <tr class="cursor-pointer esse-table-row transition"
                    tabindex="0" role="button" onclick="VolumeComparison.filterByRow(decodeURIComponent('${encodeURIComponent(item.name).replace(/'/g, '%27')}'))" onkeydown="if(event.key === 'Enter' || event.key === ' '){event.preventDefault(); this.click()}"
                    style="border-bottom: 1px solid #F2F4F7;">
                    <td class="py-2.5 px-3" style="min-width: 220px; max-width: 320px;">
                        <div class="fw-semibold text-dark text-truncate" style="font-size: 13px; line-height: 1.3;" title="${escapeHtml(item.name)}">
                            ${escapeHtml(item.name)}
                        </div>
                        <div class="text-muted text-truncate" style="font-size: 11px; line-height: 1.3; margin-top: 2px;">
                            ${isDimCustomer ? escapeHtml(item.region) : `<span class="text-primary font-monospace">${item.uniqueClientsCount} Klien</span> • ${escapeHtml(item.topClientsStr)}`}
                        </div>
                    </td>
                    <td class="py-2.5 px-3" style="width: 140px;">
                        ${isDimCustomer ? `
                            <span class="badge bg-light text-dark border px-2 py-1" style="font-size: 11px; font-weight: 500; border-color: #EAECF0 !important;">
                                <i class="bi bi-geo-alt me-1 text-primary"></i>${escapeHtml(item.region)}
                            </span>
                        ` : `
                            <span class="font-monospace fw-semibold text-dark" style="font-size: 12.5px;">${item.uniqueClientsCount} Klien</span>
                        `}
                    </td>
                    <td class="py-2.5 px-3 text-end font-monospace fw-semibold text-dark" style="width: 110px; font-size: 12.5px;">
                        ${fmtNum(item.totalSJ)} <span class="text-muted fw-normal" style="font-size: 11px;">SJ</span>
                    </td>
                    <td class="py-2.5 px-3 text-end font-monospace fw-semibold text-dark" style="width: 130px; font-size: 12.5px;">
                        ${fmtNum(item.totalDest)} <span class="text-muted fw-normal" style="font-size: 11px;">Titik</span>
                    </td>
                    <td class="py-2.5 px-3 text-end font-monospace" style="width: 140px;">
                        <div class="fw-semibold ${rowDelivered > 0 ? 'text-success' : 'text-dark'}" style="font-size: 12.5px; line-height: 1.3;">
                            ${fmtNum(rowDelivered)} <span class="fw-normal" style="font-size: 11px;">${metricUnit}</span>
                        </div>
                        <div class="text-muted" style="font-size: 11px; line-height: 1.3;">
                            ${rowRate}% Berhasil
                        </div>
                    </td>
                    <td class="py-2.5 px-3 text-end font-monospace text-muted" style="width: 110px; font-size: 12px;">
                        <div class="fw-medium text-dark">${item.sharePct.toFixed(1)}%</div>
                        <div class="progress mt-1" style="height: 4px; border-radius: 2px; background: #F2F4F7;">
                            <div class="progress-bar bg-primary" style="width: ${Math.min(100, item.sharePct)}%;"></div>
                        </div>
                    </td>
                    <td class="py-2.5 px-3 text-end text-muted" style="width: 40px;">
                        <i class="bi bi-chevron-right" style="font-size: 12px;"></i>
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div id="breakdown-table-wrapper" class="position-relative">
                <div class="table-responsive" style="max-height: 380px; overflow-y: auto;">
                    <table class="table align-middle m-0" style="border-collapse: separate; border-spacing: 0;">
                        <thead class="sticky-top" style="position: sticky; top: 0; z-index: 10; background: #F9FAFB;">
                            <tr class="text-nowrap" style="height: 38px;">
                                <th class="cursor-pointer select-none py-2 px-3 border-bottom" style="font-size: 11px; font-weight: 600; color: #475467; text-transform: uppercase; letter-spacing: 0.04em; background: #F9FAFB; border-color: #EAECF0;" onclick="VolumeComparison.setSort('name')">
                                    <div class="d-inline-flex align-items-center gap-1">
                                        <span>${isDimCustomer ? 'KLIEN / CUSTOMER' : 'REGION'}</span>${headerCount('groups',list.length)}
                                        <i class="bi bi-arrow-down-up text-muted opacity-50" style="font-size: 10px;"></i>
                                    </div>
                                </th>
                                <th class="py-2 px-3 border-bottom" style="font-size: 11px; font-weight: 600; color: #475467; text-transform: uppercase; letter-spacing: 0.04em; background: #F9FAFB; border-color: #EAECF0;">
                                    ${isDimCustomer ? 'REGION' : 'TOTAL KLIEN'}${headerCount(isDimCustomer ? 'regions' : 'clients',isDimCustomer ? regionCount : clientCount)}
                                </th>
                                <th class="cursor-pointer select-none py-2 px-3 border-bottom text-end" style="font-size: 11px; font-weight: 600; color: #475467; text-transform: uppercase; letter-spacing: 0.04em; background: #F9FAFB; border-color: #EAECF0;" onclick="VolumeComparison.setSort('total')">
                                    <div class="d-inline-flex align-items-center justify-content-end gap-1 w-100">
                                        <span>SURAT JALAN</span>${headerCount('sj',totalSJAll)}
                                        <i class="bi bi-arrow-down-up text-muted opacity-50" style="font-size: 10px;"></i>
                                    </div>
                                </th>
                                <th class="cursor-pointer select-none py-2 px-3 border-bottom text-end" style="font-size: 11px; font-weight: 600; color: #475467; text-transform: uppercase; letter-spacing: 0.04em; background: #F9FAFB; border-color: #EAECF0;" onclick="VolumeComparison.setSort('total')">
                                    <div class="d-inline-flex align-items-center justify-content-end gap-1 w-100">
                                        <span>TOTAL TITIK</span>${headerCount('destinations',totalDestAll)}
                                        <i class="bi bi-arrow-down-up text-muted opacity-50" style="font-size: 10px;"></i>
                                    </div>
                                </th>
                                <th class="cursor-pointer select-none py-2 px-3 border-bottom text-end" style="font-size: 11px; font-weight: 600; color: #475467; text-transform: uppercase; letter-spacing: 0.04em; background: #F9FAFB; border-color: #EAECF0;" onclick="VolumeComparison.setSort('delivered')">
                                    <div class="d-inline-flex align-items-center justify-content-end gap-1 w-100">
                                        <span>SUKSES</span>${headerCount('completed',delivDestAll)}
                                        <i class="bi bi-arrow-down-up text-muted opacity-50" style="font-size: 10px;"></i>
                                    </div>
                                </th>
                                <th class="cursor-pointer select-none py-2 px-3 border-bottom text-end" style="font-size: 11px; font-weight: 600; color: #475467; text-transform: uppercase; letter-spacing: 0.04em; background: #F9FAFB; border-color: #EAECF0;" onclick="VolumeComparison.setSort('share')">
                                    <div class="d-inline-flex align-items-center justify-content-end gap-1 w-100">
                                        <span>SHARE</span>
                                        <i class="bi bi-arrow-down-up text-muted opacity-50" style="font-size: 10px;"></i>
                                    </div>
                                </th>
                                <th class="py-2 px-3 border-bottom text-end" style="width: 40px; background: #F9FAFB; border-color: #EAECF0;"></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                        <tfoot>
                            <tr class="fw-bold text-dark border-top" style="background: #F9FAFB; border-color: #D0D5DD !important;">
                                <td class="py-2.5 px-3" style="font-size: 12.5px;">Total Keseluruhan</td>
                                <td class="py-2.5 px-3" style="font-size: 12px; color: #475467;">${list.length} Baris</td>
                                <td class="py-2.5 px-3 text-end font-monospace" style="font-size: 12.5px;">${fmtNum(totalSJAll)} SJ</td>
                                <td class="py-2.5 px-3 text-end font-monospace" style="font-size: 12.5px;">${fmtNum(totalDestAll)} Titik</td>
                                <td class="py-2.5 px-3 text-end font-monospace text-success" style="font-size: 12.5px;">
                                    <div>${fmtNum(delivDestAll)} ${metricUnit}</div>
                                    <div class="fw-normal text-muted" style="font-size: 11px;">${overallSuccessRate}% Selesai</div>
                                </td>
                                <td class="py-2.5 px-3 text-end font-monospace" style="font-size: 12.5px;">100.0%</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;
    }

    function render() {
        const container = root.document.getElementById('dashboard-volume-comparison-container');
        if (!container) return;

        const rawData = collectTripData();
        const availableRegions = getAvailableRegions(rawData);
        const availableAdmins = getAvailableAdmins(rawData);
        const availableCouriers = getAvailableCouriers(rawData);
        const dailyBuckets = computeDailyBuckets(rawData, currentMetric, currentRegion, currentAdmin, currentCourier, startDate, endDate, currentVehicle);
        const breakdownData = computeBreakdownData(rawData, breakdownDim, currentRegion, currentAdmin, currentCourier, startDate, endDate, breakdownSearch, currentVehicle);

        let totalWeeklyVolume = 0;
        let deliveredWeeklyVolume = 0;
        let failedWeeklyVolume = 0;
        dailyBuckets.forEach(b => {
            totalWeeklyVolume += b.total;
            deliveredWeeklyVolume += b.delivered;
            failedWeeklyVolume += (b.failed || 0);
        });

        const metricTitle = currentMetric === 'destinations' ? 'Titik' : 'Surat Jalan';
        const unitName = currentMetric === 'destinations' ? 'Titik' : 'SJ';
        const regionLabel = currentRegion === 'all' ? 'Semua Region' : currentRegion;

        container.innerHTML = `
            <div class="border rounded-4 bg-white shadow-2fs mb-4 overflow-hidden" style="border-color: #EAECF0 !important;">
                <!-- Main Header: Metric Switcher, Region Filter, and Toggle -->
                <div class="d-flex flex-column flex-xxl-row align-items-xxl-center justify-content-between gap-3 px-4 py-3 border-bottom bg-white" style="border-color: #EAECF0 !important;">
                    <div>
                        <div class="d-flex align-items-center gap-2 flex-wrap">
                            <h3 class="m-0" style="font-size: 14px; font-weight: 700; color: #101828;">
                                Grafik Pengiriman
                            </h3>
                            <button type="button" class="btn btn-sm btn-light border p-1 d-inline-flex align-items-center justify-content-center" style="width: 28px; height: 28px; border-radius: 6px; border-color: #D0D5DD !important; color: #475467;" onclick="VolumeComparison.toggleCollapse()" title="${isCollapsed ? 'Tampilkan Visual Grafik' : 'Sembunyikan Visual Grafik'}" aria-label="${isCollapsed ? 'Tampilkan Visual Grafik' : 'Sembunyikan Visual Grafik'}">
                                <i class="bi bi-${isCollapsed ? 'eye-slash' : 'eye'}" style="font-size: 14px;"></i>
                            </button>
                        </div>
                        <p class="m-0 mt-0.5" style="font-size: 12px; color: #667085;">
                            ${fmtNum(totalWeeklyVolume)} ${unitName} total • ${fmtNum(deliveredWeeklyVolume)} ${unitName} sukses • ${fmtNum(failedWeeklyVolume)} ${unitName} gagal ${currentVehicle !== 'all' ? `• Armada ${currentVehicle === 'mobil' ? 'Mobil' : 'Motor'} ` : ''}(${escapeHtml(startDate)} – ${escapeHtml(endDate)} WIB)
                        </p>
                    </div>

                    <div class="d-flex flex-wrap align-items-center gap-2">
                        <!-- Metric Dropdown (Titik & Surat Jalan) -->
                        <div style="min-width: 90px;">
                            <select id="vol-metric-select" class="form-select form-select-sm" style="height: 32px; border-radius: 8px; border-color: #D0D5DD; font-size: 12px; font-weight: 600; color: #101828;" onchange="VolumeComparison.setMetric(this.value)">
                                <option value="destinations" ${currentMetric === 'destinations' ? 'selected' : ''}>Titik</option>
                                <option value="sj" ${currentMetric === 'sj' ? 'selected' : ''}>Surat Jalan</option>
                            </select>
                        </div>

                        <!-- Region Filter -->
                        <div style="min-width: 100px;">
                            <select id="vol-region-select" class="form-select form-select-sm" style="height: 32px; border-radius: 8px; border-color: #D0D5DD; font-size: 12px; font-weight: 500; color: #101828;" onchange="VolumeComparison.setRegion(this.value)">
                                <option value="all" ${currentRegion === 'all' ? 'selected' : ''}>Region</option>
                                ${availableRegions.map(reg => `<option value="${escapeHtml(reg)}" ${currentRegion.toLowerCase() === reg.toLowerCase() ? 'selected' : ''}>${escapeHtml(reg)}</option>`).join('')}
                            </select>
                        </div>

                        <!-- Vehicle Filter (Mobil vs Motor) -->
                        <div style="min-width: 100px;">
                            <select id="vol-vehicle-select" class="form-select form-select-sm" style="height: 32px; border-radius: 8px; border-color: #D0D5DD; font-size: 12px; font-weight: 500; color: #101828;" onchange="VolumeComparison.setVehicle(this.value)">
                                <option value="all" ${currentVehicle === 'all' ? 'selected' : ''}>Armada</option>
                                <option value="mobil" ${currentVehicle === 'mobil' ? 'selected' : ''}>🚗 Mobil</option>
                                <option value="motor" ${currentVehicle === 'motor' ? 'selected' : ''}>🛵 Motor</option>
                            </select>
                        </div>

                        <!-- Kurir / Driver Filter (Format Optgroup & Search seperti Manual Dispatch) -->
                        <div style="min-width: 110px;">
                            <select id="vol-courier-select" class="form-select form-select-sm" style="height: 32px; border-radius: 8px; border-color: #D0D5DD; font-size: 12px; font-weight: 500; color: #101828;" onchange="VolumeComparison.setCourier(this.value)">
                                ${buildCourierFilterOptions(currentCourier, availableCouriers)}
                            </select>
                        </div>

                        <!-- Kalender Rentang Tanggal Rapih -->
                        <div class="d-inline-flex align-items-center bg-white border rounded-2 px-2" style="height: 32px; border-color: #D0D5DD !important;">
                            <i class="bi bi-calendar3 text-muted me-1.5" style="font-size: 11.5px;"></i>
                            <input type="date" id="volume-start-date" class="border-0 bg-transparent p-0 text-dark font-monospace" style="font-size: 11.5px; width: 115px; height: 30px; outline: none;" value="${startDate || ''}" onchange="VolumeComparison.setDateRange(this.value, document.getElementById('volume-end-date').value)" title="Dari Tanggal">
                            <span class="text-muted mx-1" style="font-size: 11px;">s/d</span>
                            <input type="date" id="volume-end-date" class="border-0 bg-transparent p-0 text-dark font-monospace" style="font-size: 11.5px; width: 115px; height: 30px; outline: none;" value="${endDate || ''}" onchange="VolumeComparison.setDateRange(document.getElementById('volume-start-date').value, this.value)" title="Sampai Tanggal">
                            ${(startDate || endDate) ? `
                                <button type="button" class="btn btn-link text-muted p-0 ms-1 text-decoration-none" onclick="VolumeComparison.clearDateRange()" title="Reset Tanggal">
                                    <i class="bi bi-x-circle-fill" style="font-size: 12px;"></i>
                                </button>
                            ` : ''}
                        </div>

                        <!-- Download Report Button -->
                        <button type="button" class="btn btn-sm btn-wellen-action d-inline-flex align-items-center gap-1.5" style="height: 32px; border-radius: 8px; font-size: 12px;" onclick="VolumeComparison.downloadReport()" title="Download Laporan Pengiriman">
                            <i class="bi bi-file-earmark-excel"></i> <span>Report</span>
                        </button>
                    </div>
                </div>

                <!-- Collapsible Chart & Breakdown Container -->
                <div id="vol-chart-body" class="${isCollapsed ? 'd-none' : 'block'}">
                    <!-- Chart Section -->
                    <div class="p-4" style="background: #ffffff;">
                        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 text-muted mb-2" style="font-size: 12px; color: #344054;">
                            <div class="d-flex flex-wrap align-items-center gap-3">
                                <span class="d-inline-flex align-items-center gap-1.5">
                                    <span class="rounded-1 d-inline-block" style="width: 12px; height: 12px; background: #CC6100;"></span>
                                    <span class="fw-medium text-dark">Total ${metricTitle}</span>
                                </span>
                                <span class="d-inline-flex align-items-center gap-1.5">
                                    <span class="rounded-1 d-inline-block" style="width: 12px; height: 12px; background: #12B76A;"></span>
                                    <span class="fw-medium text-dark">Sukses</span>
                                </span>
                                <span class="d-inline-flex align-items-center gap-1.5">
                                    <span class="rounded-1 d-inline-block" style="width: 12px; height: 12px; background: #D92D20;"></span>
                                    <span class="fw-medium text-dark">Gagal</span>
                                </span>
                            </div>
                        </div>

                        ${renderSvgChart(dailyBuckets, currentMetric, currentRegion)}
                    </div>

                    <!-- Data Breakdown Sub-Section (Turunan Tabel Klien / Region seperti Esse) -->
                    <div class="border-top" style="border-color: #EAECF0 !important;">
                        <div class="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2 px-4 py-3 border-bottom bg-white" style="border-color: #EAECF0 !important;">
                            <div class="d-flex align-items-center gap-2 flex-wrap">
                                <h2 class="m-0" style="font-size: 14px; font-weight: 700; color: #101828;">Data Breakdown</h2>
                                <span class="text-muted" style="font-size: 12px;">${breakdownData.list.length} grup • Klik baris untuk filter pengiriman</span>
                            </div>
                            <div class="d-flex align-items-center gap-2 flex-wrap">
                                <!-- Search input -->
                                <div class="position-relative" style="width: 190px;">
                                    <i class="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-2.5 text-muted" style="font-size: 12px;"></i>
                                    <input type="text" id="breakdown-search-input" class="form-control form-control-sm ps-4 py-1" style="height: 32px; border-radius: 8px; font-size: 12px; border-color: #D0D5DD;" placeholder="Cari Klien / Region..." value="${escapeHtml(breakdownSearch)}" oninput="VolumeComparison.setSearch(this.value)">
                                </div>

                                <!-- Breakdown Dimension Selector -->
                                <div class="position-relative" style="min-width: 130px;">
                                    <select id="breakdown-dim-select" class="form-select form-select-sm" style="height: 32px; border-radius: 8px; border-color: #D0D5DD; font-size: 12px; font-weight: 500; color: #101828;" onchange="VolumeComparison.setBreakdownDim(this.value)">
                                        <option value="customer" ${breakdownDim === 'customer' ? 'selected' : ''}>Klien</option>
                                        <option value="region" ${breakdownDim === 'region' ? 'selected' : ''}>Region</option>
                                    </select>
                                </div>

                                <!-- Action Report Button -->
                                <button type="button" class="btn btn-sm btn-wellen-action d-inline-flex align-items-center gap-1.5" style="height: 32px; border-radius: 8px; font-size: 12px;" onclick="VolumeComparison.downloadReport()" title="Download Laporan Breakdown">
                                    <i class="bi bi-file-earmark-excel"></i> <span>Report</span>
                                </button>
                            </div>
                        </div>

                        ${renderBreakdownTable(breakdownData, currentMetric)}
                    </div>
                </div>
            </div>
        `;

        // Enhance custom dropdowns for professional floating searchable UI matching Manual Dispatch
        if (root.wtrackDropdown && typeof root.wtrackDropdown.enhance === 'function') {
            const courierSel = root.document.getElementById('vol-courier-select');
            if (courierSel) root.wtrackDropdown.enhance(courierSel);
            const metricSel = root.document.getElementById('vol-metric-select');
            if (metricSel) root.wtrackDropdown.enhance(metricSel);
            const regionSel = root.document.getElementById('vol-region-select');
            if (regionSel) root.wtrackDropdown.enhance(regionSel);
            const vehicleSel = root.document.getElementById('vol-vehicle-select');
            if (vehicleSel) root.wtrackDropdown.enhance(vehicleSel);
        }
    }

    function showTooltip(idx, centerX, barTopY) {
        hoveredDayIdx = idx;
        const tooltipEl = root.document.getElementById('esse-chart-tooltip');
        const container = root.document.getElementById('volume-svg-container');
        if (!tooltipEl || !container) return;

        const rawData = collectTripData();
        const dailyBuckets = computeDailyBuckets(rawData, currentMetric, currentRegion, currentAdmin, currentCourier, startDate, endDate, currentVehicle);
        const b = dailyBuckets[idx];
        if (!b) return;

        const isSunday = b.day === 'Minggu';
        const statusLabel = isSunday ? (b.total > 0 ? 'Lembur Operasional' : 'Libur Operasional') : 'Operasional Aktif';
        const regionLabel = currentRegion === 'all' ? 'Semua Region' : currentRegion;
        const vehicleLabel = currentVehicle === 'all' ? '' : (currentVehicle === 'mobil' ? ' • 🚗 Mobil' : ' • 🛵 Motor');
        const successRate = b.total > 0 ? Math.round((b.delivered / b.total) * 100) : 0;
        const failed = b.failed !== undefined ? b.failed : Math.max(0, b.total - b.delivered);
        const unitName = currentMetric === 'destinations' ? 'Titik' : 'SJ';

        tooltipEl.innerHTML = `
            <div class="fw-bold border-bottom pb-1.5 mb-2" style="font-size: 12px; color: #101828; border-color: #F2F4F7 !important;">
                <span>${b.day}${b.dateFormatted ? `, ${b.dateFormatted}` : ''}${vehicleLabel} • ${statusLabel}</span>
                <span class="d-block text-muted text-truncate mt-0.5" style="font-size: 10.5px; font-weight: 400;">
                    <i class="bi bi-geo-alt me-1 text-primary"></i>${escapeHtml(regionLabel)}
                </span>
            </div>
            <div style="font-family: var(--font-mono, monospace); font-size: 11.5px; line-height: 1.6;">
                <div class="d-flex align-items-center justify-content-between gap-3">
                    <span class="d-inline-flex align-items-center gap-1.5" style="color: #475467;">
                        <span class="rounded-1 d-inline-block" style="width: 8px; height: 8px; background: #E88520;"></span>
                        Total ${currentMetric === 'destinations' ? 'Titik' : 'SJ'}:
                    </span>
                    <span class="fw-bold" style="color: #101828;">${fmtNum(b.total)} ${unitName}</span>
                </div>
                <div class="d-flex align-items-center justify-content-between gap-3">
                    <span class="d-inline-flex align-items-center gap-1.5" style="color: #475467;">
                        <span class="rounded-1 d-inline-block" style="width: 8px; height: 8px; background: #12B76A;"></span>
                        Sukses:
                    </span>
                    <span class="fw-bold" style="color: #027A48;">${fmtNum(b.delivered)} ${unitName} (${successRate}%)</span>
                </div>
                ${failed > 0 ? `
                <div class="d-flex align-items-center justify-content-between gap-3">
                    <span class="d-inline-flex align-items-center gap-1.5" style="color: #475467;">
                        <span class="rounded-1 d-inline-block" style="width: 8px; height: 8px; background: #D92D20;"></span>
                        Gagal:
                    </span>
                    <span class="fw-bold" style="color: #B42318;">${fmtNum(failed)} ${unitName}</span>
                </div>` : ''}
                <div class="d-flex align-items-center justify-content-between gap-3 mt-1.5 pt-1.5 border-top" style="border-color: #F2F4F7 !important;">
                    <span style="color: #475467;">Persentase Selesai:</span>
                    <span class="fw-bold" style="color: #175CD3;">${successRate}%</span>
                </div>
            </div>
        `;

        // Position tooltip centered on bar pair
        const svgWidth = 980;
        const xPct = (centerX / svgWidth) * 100;

        // Tooltip safety flip: prevent clipping when bar is near the top (Gb 4 fix)
        const isNearTop = barTopY < 140;
        let clampedTop;
        if (isNearTop) {
            clampedTop = Math.max(10, barTopY + 28);
            tooltipEl.style.transform = 'translate(-50%, 0)';
            tooltipEl.classList.add('tooltip-flip-bottom');
        } else {
            clampedTop = Math.max(10, barTopY - 12);
            tooltipEl.style.transform = 'translate(-50%, -100%)';
            tooltipEl.classList.remove('tooltip-flip-bottom');
        }

        tooltipEl.style.left = `clamp(110px, ${xPct}%, calc(100% - 110px))`;
        tooltipEl.style.top = `${clampedTop}px`;
        tooltipEl.classList.remove('d-none');
    }

    function updateTooltipPos(evt) {
        // Position remains tied to active day column
    }

    function hideTooltip() {
        hoveredDayIdx = null;
        const tooltipEl = root.document.getElementById('esse-chart-tooltip');
        if (tooltipEl) tooltipEl.classList.add('d-none');
    }

    function setMetric(val) {
        currentMetric = val;
        render();
    }

    function setRegion(val) {
        currentRegion = (val === 'all' || !val) ? 'all' : val;
        render();
    }

    function setAdmin(val) {
        currentAdmin = (val === 'all' || !val) ? 'all' : val;
        render();
    }

    function setCourier(val) {
        currentCourier = (val === 'all' || !val) ? 'all' : val;
        render();
    }

    function setVehicle(val) {
        currentVehicle = (val === 'all' || !val) ? 'all' : val;
        render();
    }

    function setDateRange(start, end) {
        startDate = start || '';
        endDate = end || '';
        render();
    }

    function clearDateRange() {
        [startDate, endDate] = currentWeek();
        render();
    }

    function setBreakdownDim(val) {
        breakdownDim = val;
        render();
    }

    function setSearch(val) {
        breakdownSearch = val;
        render();
        // Restore focus to search input
        const input = root.document.getElementById('breakdown-search-input');
        if (input) {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        }
    }

    function setSort(field) {
        if (sortField === field) {
            sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        } else {
            sortField = field;
            sortDir = 'desc';
        }
        render();
    }

    function getShipmentSelection() {
        if (!shipmentSelection) return null;
        const choice = shipmentSelection;
        let rows = filterTripItems(collectTripData(), choice.region, choice.admin, choice.courier, choice.start, choice.end, choice.vehicle);
        rows = rows.filter(row => choice.kind === 'day' ? row.day === choice.value : row[choice.dim] === choice.value);
        if (choice.deliveredOnly) rows = rows.filter(row => row.deliveredDestinations > 0);
        else if (choice.failedOnly) rows = rows.filter(row => row.deliveredDestinations === 0);
        return new Map(rows.map(row => [`${row.tripId}:${row.destinationIndex}`, row]));
    }

    function getSelectionSummary() {
        const selection = getShipmentSelection();
        if (!selection) return null;
        const rows = [...selection.values()];
        const total = rows.length;
        const completed = rows.filter(row => row.deliveredDestinations > 0).length;
        const returned = rows.filter(row => row.returned || row.deliveredDestinations === 0).length;
        let distance = 0;
        if (typeof root.calculateAccurateTripKM === 'function') {
            const seen = new Set();
            (root.allCurrentTrips || []).forEach(trip => {
                const id = trip.id || trip.tripId;
                if (seen.has(id)) return;
                seen.add(id);
                const stops = trip.destinations?.length ? trip.destinations : [trip];
                const selected = stops.filter((stop,index) => selection.has(`${id}:${index}`));
                if (selected.length) distance += root.calculateAccurateTripKM({...trip,destinations:selected}) || 0;
            });
        }
        const choice = shipmentSelection;
        let label = '';
        const filterTag = choice.failedOnly ? ' • Gagal Kirim' : (choice.deliveredOnly ? ' • Selesai' : '');
        if (choice.kind === 'day') {
            let dayDate = choice.date;
            if (!dayDate) {
                if (rows.length > 0 && rows[0].date) {
                    dayDate = rows[0].date;
                } else if (choice.start && /^\d{4}-\d{2}-\d{2}$/.test(choice.start)) {
                    const dayIdx = typeof choice.dayIndex === 'number' ? choice.dayIndex : DAYS_ORDER.indexOf(choice.value);
                    if (dayIdx >= 0) {
                        const d = new Date(choice.start + 'T00:00:00Z');
                        const dayOfWeek = (d.getUTCDay() + 6) % 7;
                        const m = new Date(d);
                        m.setUTCDate(d.getUTCDate() - dayOfWeek + dayIdx);
                        dayDate = m.toISOString().slice(0, 10);
                    }
                }
            }
            const dateStr = dayDate ? formatIndoDate(dayDate, true) : choice.value;
            label = `${dateStr}${filterTag}`;
        } else {
            const rangeStr = formatIndoDateRange(choice.start, choice.end);
            label = `${choice.value}${filterTag} • ${rangeStr}`;
        }

        return {
            total,
            completed,
            returned,
            inProgress: Math.max(0, total - completed - returned),
            distance,
            rate: total ? Math.round(completed / total * 100) : 0,
            label,
            failedOnly: !!choice.failedOnly
        };
    }

    function applyStatCards() {
        const summary = getSelectionSummary();
        const card = root.document.getElementById('stat-active')?.closest?.('.stat-card');
        const title = card?.querySelector?.('.stat-label');
        if (title) title.textContent = summary?.failedOnly ? 'Gagal Kirim' : (summary ? 'Total Shipments' : 'Total Shipments Today');
        const defaults = {'stat-active':'Hari Ini','stat-completed':'Hari Ini','stat-ontime':'Real-time',
            'stat-delayed':'Ke Kantor','stat-total-km':'Real-time'};
        Object.entries(defaults).forEach(([id,fallback]) => {
            const trend = root.document.getElementById(id)?.closest?.('.stat-card')?.querySelector?.('.stat-trend');
            if (trend) {
                const textVal = summary ? summary.label + (id === 'stat-total-km' ? ' • Estimasi' : '') : fallback;
                trend.textContent = textVal;
                trend.setAttribute('title', textVal);
            }
        });
        if (!summary) return;
        const values = {'stat-active':summary.total,'stat-completed':summary.completed,'stat-delayed':summary.returned,
            'stat-ontime':summary.rate + '%','stat-total-km':summary.distance.toFixed(1) + ' km',
            'stat-active-tasks':summary.inProgress,'stat-transit-count':summary.inProgress};
        Object.entries(values).forEach(([id,value]) => {
            const element = root.document.getElementById(id);
            if (element) element.innerText = value;
        });
        const percentages = {delivered:summary.rate,pending:summary.total ? Math.round(summary.inProgress/summary.total*100) : 0,
            returned:summary.total ? Math.round(summary.returned/summary.total*100) : 0};
        Object.entries(percentages).forEach(([key,value]) => {
            const text = root.document.getElementById('pct-' + key), bar = root.document.getElementById('pbar-' + key);
            if (text) text.innerText = value + '%';
            if (bar) bar.style.width = value + '%';
        });
    }

    function clearShipmentSelection(refresh = true) {
        shipmentSelection = null;
        const banner = root.document.getElementById('recent-volume-filter');
        if (banner) { banner.hidden = true; banner.innerHTML = ''; }
        if (refresh) root.renderRecentShipments?.();
    }

    function applyShipmentSelection(choice) {
        shipmentSelection = {...choice, region: currentRegion, admin: currentAdmin,
            courier: currentCourier, vehicle: currentVehicle, start: startDate, end: endDate};
        const values = {'recent-shipment-search': '', 'recent-status-filter': 'all',
            'recent-carrier-filter': 'all', 'recent-date-filter': 'all',
            'recent-start-date': startDate, 'recent-end-date': endDate};
        Object.entries(values).forEach(([id, value]) => {
            const element = root.document.getElementById(id);
            if (element) element.value = value;
        });
        const banner = root.document.getElementById('recent-volume-filter');
        if (banner) {
            banner.hidden = false;
            const displayChoice = choice.kind === 'day' && choice.date ? formatIndoDate(choice.date, true) : choice.value;
            const filterTag = choice.failedOnly ? ' • Gagal Kirim' : (choice.deliveredOnly ? ' • Selesai' : '');
            banner.innerHTML = `<span>Pilihan grafik: ${escapeHtml(displayChoice)}${filterTag}</span><button type="button" class="btn btn-sm btn-light border ms-2" onclick="VolumeComparison.clearShipmentSelection()">Hapus pilihan</button>`;
        }
        root.renderRecentShipments?.('', true);
        root.document.getElementById('recent-shipments-total-badge')?.scrollIntoView?.({behavior:'smooth', block:'center'});
    }

    function filterByDay(index, event) {
        const day = DAYS_ORDER[index];
        if (!day) return;
        const target = event?.target;
        const deliveredOnly = !!target?.classList?.contains('chart-bar-delivered');
        const failedOnly = !deliveredOnly && !!target?.classList?.contains('chart-bar-failed');
        const rawData = collectTripData();
        const buckets = computeDailyBuckets(rawData, currentMetric, currentRegion, currentAdmin, currentCourier, startDate, endDate, currentVehicle);
        const bucket = buckets[index];
        const date = bucket?.date || '';
        applyShipmentSelection({kind:'day', value:day, deliveredOnly, failedOnly, date, dayIndex: index});
    }

    function filterByRow(name) {
        if (name) applyShipmentSelection({kind:'row', value:name, dim:breakdownDim});
    }

    function toggleCollapse() {
        isCollapsed = !isCollapsed;
        root.localStorage.setItem(STORAGE_COLLAPSE_KEY, String(isCollapsed));
        render();
    }

    async function downloadReport() {
        const rawData = collectTripData();
        const breakdownData = computeBreakdownData(rawData, breakdownDim, currentRegion, currentAdmin, currentCourier, startDate, endDate, breakdownSearch, currentVehicle);
        const dateStr = new Date().toISOString().slice(0, 10);
        const periodStr = (startDate && endDate) ? `${startDate} s/d ${endDate}` : (startDate ? `Mulai ${startDate}` : (endDate ? `Sampai ${endDate}` : 'Semua Tanggal'));
        const regionLabel = currentRegion === 'all' ? 'Semua Region' : currentRegion;
        const adminLabel = currentAdmin === 'all' ? 'Semua Admin' : currentAdmin;
        const courierLabel = currentCourier === 'all' ? 'Semua Kurir' : currentCourier;
        const vehicleLabel = currentVehicle === 'all' ? 'Semua Armada' : (currentVehicle === 'mobil' ? 'Mobil' : 'Motor');
        const metricLabel = currentMetric === 'destinations' ? 'Titik Pengantaran' : 'Surat Jalan';
        const dimLabel = breakdownDim === 'customer' ? 'Klien' : 'Region';

        if (typeof ExcelJS !== 'undefined') {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = "Wellen Print Logistics";
            workbook.created = new Date();

            const sheet = workbook.addWorksheet("Volume_Pengiriman", {
                views: [{ showGridLines: true }]
            });

            // 1. Title Banner (Row 1)
            sheet.mergeCells('A1:I1');
            const titleCell = sheet.getCell('A1');
            titleCell.value = "LAPORAN VOLUME PENGANTARAN LOGISTIK - WELLEN PRINT ERP";
            titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
            titleCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1F4E79' }
            };
            titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            sheet.getRow(1).height = 26;

            // 2. Subtitle Banner (Row 2)
            sheet.mergeCells('A2:I2');
            const subCell = sheet.getCell('A2');
            subCell.value = `Periode: ${periodStr}  |  Region: ${regionLabel}  |  Armada: ${vehicleLabel}  |  Admin SJ: ${adminLabel}  |  Kurir: ${courierLabel}  |  Metrik: ${metricLabel}  |  Total: ${breakdownData.list.length} ${dimLabel}`;
            subCell.font = { name: 'Calibri', size: 9.5, italic: true, bold: true, color: { argb: 'FF1F4E79' } };
            subCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFEBF3FA' }
            };
            subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            subCell.border = {
                top: { style: 'thin', color: { argb: 'FF94A3B8' } },
                bottom: { style: 'thin', color: { argb: 'FF94A3B8' } }
            };
            sheet.getRow(2).height = 20;

            // Row 3: Blank separator
            sheet.getRow(3).height = 8;

            // 3. Header Row (Row 4)
            const headerRow = sheet.getRow(4);
            headerRow.height = 26;
            const headers = [
                "No", "Kategori", "Nama " + dimLabel, "Region", "Total Surat Jalan", 
                "Total Titik", "Sukses", "Persentase Sukses", "Share Volume (%)"
            ];
            headers.forEach((h, idx) => {
                const cell = headerRow.getCell(idx + 1);
                cell.value = h;
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF1F4E79' }
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FF1F4E79' } },
                    left: { style: 'thin', color: { argb: 'FF94A3B8' } },
                    bottom: { style: 'medium', color: { argb: 'FF0F2C59' } },
                    right: { style: 'thin', color: { argb: 'FF94A3B8' } }
                };
            });

            const thinBorder = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };

            breakdownData.list.forEach((item, idx) => {
                const row = sheet.getRow(idx + 5);
                row.height = 22;
                const isEven = (idx % 2 === 0);
                const bgArgb = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

                const rowVals = [
                    idx + 1,
                    dimLabel,
                    item.name || '-',
                    item.region || '-',
                    item.totalSJ,
                    item.totalDest,
                    item.deliveredDest,
                    item.successPct / 100,
                    item.sharePct / 100
                ];

                rowVals.forEach((val, cIdx) => {
                    const cell = row.getCell(cIdx + 1);
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
                    } else if (cIdx === 1 || cIdx === 3) {
                        cell.value = val;
                        cell.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF334155' } };
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    } else if (cIdx === 2) {
                        cell.value = val;
                        cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF1E293B' } };
                        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                    } else if (cIdx === 4 || cIdx === 5 || cIdx === 6) {
                        cell.value = val;
                        cell.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF0F172A' } };
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        cell.numFmt = '#,##0';
                    } else if (cIdx === 7 || cIdx === 8) {
                        cell.value = val;
                        cell.font = { name: 'Calibri', size: 9.5, bold: (cIdx === 7), color: { argb: cIdx === 7 ? 'FF027A48' : 'FF1E293B' } };
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        cell.numFmt = '0.0%';
                    }
                });
            });

            // Summary Footer Row
            const footerRowIdx = breakdownData.list.length + 5;
            const footerRow = sheet.getRow(footerRowIdx);
            footerRow.height = 24;
            const totalDeliv = breakdownData.deliveredDestAll || 0;
            const totalDest = breakdownData.totalDestAll || 0;
            const overallRate = totalDest > 0 ? (totalDeliv / totalDest) : 0;

            const footerVals = [
                "", "TOTAL", `Total ${breakdownData.list.length} Data`, "",
                breakdownData.totalSJAll || 0,
                totalDest,
                totalDeliv,
                overallRate,
                1.0
            ];

            footerVals.forEach((val, cIdx) => {
                const cell = footerRow.getCell(cIdx + 1);
                cell.value = val;
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE2E8F0' }
                };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FF94A3B8' } },
                    bottom: { style: 'double', color: { argb: 'FF0F2C59' } }
                };
                if (cIdx === 1 || cIdx === 2) {
                    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                } else if (cIdx >= 4 && cIdx <= 6) {
                    cell.alignment = { vertical: 'middle', horizontal: 'right' };
                    cell.numFmt = '#,##0';
                } else if (cIdx >= 7) {
                    cell.alignment = { vertical: 'middle', horizontal: 'right' };
                    cell.numFmt = '0.0%';
                }
            });

            sheet.columns = [
                { width: 6 },
                { width: 14 },
                { width: 34 },
                { width: 18 },
                { width: 18 },
                { width: 16 },
                { width: 14 },
                { width: 18 },
                { width: 16 }
            ];

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            const url = URL.createObjectURL(blob);
            const a = root.document.createElement('a');
            a.href = url;
            a.download = `Laporan_Volume_Pengiriman_${dateStr}.xlsx`;
            root.document.body.appendChild(a);
            a.click();
            root.document.body.removeChild(a);
            URL.revokeObjectURL(url);

            if (root.showToast) {
                root.showToast(`Report Volume Pengiriman berhasil diunduh (${breakdownData.list.length} data)`);
            }
            return;
        }

        let csv = '\uFEFF'; // UTF-8 BOM for Microsoft Excel
        csv += 'LAPORAN VOLUME PENGIRIMAN - WELLEN PRINT ERP\r\n';
        csv += `Tanggal Report: ${dateStr}\r\n`;
        csv += `Filter Region: ${regionLabel}\r\n`;
        csv += `Filter Admin SJ: ${adminLabel}\r\n`;
        csv += `Filter Kurir: ${courierLabel}\r\n`;
        csv += `Rentang Tanggal: ${periodStr}\r\n`;
        csv += `Metrik Utama: ${metricLabel}\r\n`;
        csv += `Dimensi Breakdown: ${dimLabel}\r\n\r\n`;

        csv += 'No,Kategori,Nama,Region,Total Surat Jalan,Total Titik,Sukses,Persentase Selesai,Share Volume (%)\r\n';

        breakdownData.list.forEach((item, idx) => {
            const nameEscaped = `"${String(item.name || '').replace(/"/g, '""')}"`;
            const regionEscaped = `"${String(item.region || '').replace(/"/g, '""')}"`;
            csv += `${idx + 1},${breakdownDim},${nameEscaped},${regionEscaped},${item.totalSJ},${item.totalDest},${item.deliveredDest},${item.successPct.toFixed(1)}%,${item.sharePct.toFixed(1)}%\r\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = root.document.createElement('a');
        a.href = url;
        a.download = `Report_Volume_Pengiriman_${dateStr}.csv`;
        root.document.body.appendChild(a);
        a.click();
        root.document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (root.showToast) {
            root.showToast('Report pengiriman berhasil diunduh');
        }
    }

    const api = {
        render,
        collectTripData,
        computeDailyBuckets,
        computeBreakdownData,
        setMetric,
        setRegion,
        setAdmin,
        setCourier,
        setVehicle,
        setDateRange,
        clearDateRange,
        setBreakdownDim,
        setSearch,
        setSort,
        filterByRow,
        filterByDay,
        getShipmentSelection,
        clearShipmentSelection,
        getSelectionSummary,
        applyStatCards,
        toggleCollapse,
        downloadReport,
        showTooltip,
        updateTooltipPos,
        hideTooltip
    };

    root.VolumeComparison = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;

    root.document.addEventListener('DOMContentLoaded', () => {
        setTimeout(render, 300);
    });

})(typeof window !== 'undefined' ? window : globalThis);
