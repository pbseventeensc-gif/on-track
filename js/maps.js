// ==============================================================================
// WTRACK LOGISTICS - LEAFLET & MAPS MODULE
// ==============================================================================

window.refreshMapSizes = function() {
    [50, 200, 500, 1000].forEach(delay => {
        setTimeout(() => {
            if (window.map && typeof window.map.invalidateSize === 'function') window.map.invalidateSize();
            if (window.mapMonitor && typeof window.mapMonitor.invalidateSize === 'function') window.mapMonitor.invalidateSize();
            if (window.mapDispatch && typeof window.mapDispatch.invalidateSize === 'function') window.mapDispatch.invalidateSize();
        }, delay);
    });
};

if (typeof window !== 'undefined') {
    window.addEventListener('resize', window.refreshMapSizes);
}

let map, mapMonitor, mapDispatch;
let tripMarkersLayer = (typeof L !== 'undefined' && L.layerGroup) ? L.layerGroup() : null;
let monitorMarkersLayer = (typeof L !== 'undefined' && L.layerGroup) ? L.layerGroup() : null;
let monitorCouriersLayer = (typeof L !== 'undefined' && L.layerGroup) ? L.layerGroup() : null;
let draftMarkersLayer = (typeof L !== 'undefined' && L.layerGroup) ? L.layerGroup() : null;

// Driver Focus Mode State
window.focusedDriverId = null;

// Unique & Consistent Color Palette per Personil
window.getCourierColor = function(id, optName = '') {
    const checkStr = (String(optName || '') + ' ' + String(id || '')).toLowerCase();

    // Kurir (12 Personil)
    if (checkStr.includes('ahmad')) return '#2563EB'; // Royal Blue
    if (checkStr.includes('beto')) return '#0D9488'; // Teal
    if (checkStr.includes('eri')) return '#16A34A'; // Green
    if (checkStr.includes('irfan')) return '#D97706'; // Amber
    if (checkStr.includes('baikaqi') || checkStr.includes('bayhaqi') || checkStr.includes('xonh')) return '#9333EA'; // Purple
    if (checkStr.includes('haris')) return '#DB2777'; // Pink
    if (checkStr.includes('umar')) return '#0284C7'; // Sky Blue
    if (checkStr.includes('noval') || checkStr.includes('ek74')) return '#EA580C'; // Orange
    if (checkStr.includes('jay')) return '#4F46E5'; // Indigo
    if (checkStr.includes('ferdi')) return '#059669'; // Emerald
    if (checkStr.includes('jagat') || checkStr.includes('jagad') || checkStr.includes('3lhr')) return '#C026D3'; // Fuchsia
    if (checkStr.includes('pbseven') || checkStr.includes('up70')) return '#14B8A6'; // Light Teal

    // Driver (10 Personil)
    if (checkStr.includes('altur')) return '#E11D48'; // Crimson
    if (checkStr.includes('rizki')) return '#7C3AED'; // Violet
    if (checkStr.includes('soleh')) return '#0891B2'; // Cyan
    if (checkStr.includes('romi')) return '#D946EF'; // Magenta
    if (checkStr.includes('firdaus')) return '#CA8A04'; // Gold
    if (checkStr.includes('alan') || checkStr.includes('limd')) return '#475569'; // Slate
    if (checkStr.includes('yakub')) return '#DC2626'; // Red
    if (checkStr.includes('iwan')) return '#65A30D'; // Lime
    if (checkStr.includes('agung')) return '#0369A1'; // Ocean Blue
    if (checkStr.includes('husen') || checkStr.includes('juhu')) return '#B45309'; // Warm Bronze

    // High contrast deterministic palette fallback
    const fallbackPalette = [
        '#2563EB', '#0D9488', '#16A34A', '#D97706', '#9333EA',
        '#DB2777', '#0284C7', '#EA580C', '#4F46E5', '#059669',
        '#C026D3', '#E11D48', '#7C3AED', '#0891B2', '#D946EF',
        '#CA8A04', '#475569', '#DC2626', '#65A30D', '#0369A1', '#B45309'
    ];
    let hash = 0;
    const str = String(id || '');
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return fallbackPalette[Math.abs(hash) % fallbackPalette.length];
};

// Immediate window exports
window.initMaps = initMaps;
window.initAutocomplete = initAutocomplete;
window.addManualAddress = addManualAddress;
window.updateMapMarkers = updateMapMarkers;
window.toggleHeatmap = toggleHeatmap;
window.setFocusedDriver = setFocusedDriver;
window.resetDriverFocus = resetDriverFocus;

function ensureMapLayers() {
    if (typeof L !== 'undefined' && L.layerGroup) {
        if (!tripMarkersLayer) tripMarkersLayer = L.layerGroup();
        if (!monitorMarkersLayer) monitorMarkersLayer = L.layerGroup();
        if (!monitorCouriersLayer) monitorCouriersLayer = L.layerGroup();
        if (!draftMarkersLayer) draftMarkersLayer = L.layerGroup();
    }
}

function getJabodetabekMaxBounds() {
    if (typeof L !== 'undefined' && L.latLngBounds) {
        // Area Operasional Terkunci: JABODETABEK, BANTEN, SERANG, RANGKAS, BITUNG TANGERANG, KARAWANG, CIKARANG, BOGOR
        // Diluar batas ini (seperti Semarang, Surabaya, atau luar Jawa) dikunci total
        return L.latLngBounds(
            L.latLng(-6.9500, 105.7000), // South-West (Banten / Rangkasbitung / Serang / Pandeglang)
            L.latLng(-5.8000, 107.5000)  // North-East (Pesisir Jakarta / Cikarang / Karawang / Cikampek)
        );
    }
    return null;
}

let heatmapLayer = null;

// Validasi Batas Wilayah Operasional:
// Mencakup: JABODETABEK, BANTEN (Serang, Cilegon, Rangkasbitung), BITUNG TANGERANG, BOGOR, CIKARANG, KARAWANG
function isInsideJabodetabekArea(lat, lng) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    if (isNaN(latitude) || isNaN(longitude)) return false;
    return latitude >= -6.9500 && latitude <= -5.8000 && longitude >= 105.7000 && longitude <= 107.5000;
}
window.isInsideJabodetabekArea = isInsideJabodetabekArea;
window.isInsideOperationalArea = isInsideJabodetabekArea;

const googleTiles = {
    url: 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    options: {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps'
    }
};

function addMapTileLayer(targetMap) {
    if (!targetMap || typeof L === 'undefined') return;
    try {
        const primaryLayer = L.tileLayer(googleTiles.url, googleTiles.options);
        let fallbackAdded = false;
        primaryLayer.on('tileerror', function() {
            if (!fallbackAdded) {
                fallbackAdded = true;
                try { targetMap.removeLayer(primaryLayer); } catch(e){}
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '&copy; OpenStreetMap contributors'
                }).addTo(targetMap);
            }
        });
        primaryLayer.addTo(targetMap);
    } catch(e) {
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(targetMap);
    }
}

function initMaps() {
    if (typeof L === 'undefined') return;
    ensureMapLayers();
    const jabodetabekMaxBounds = getJabodetabekMaxBounds();

    try {
        const elMap = document.getElementById('map');
        if (elMap && !map) {
            map = L.map('map', {
                zoomControl: false,
                scrollWheelZoom: false,
                maxBounds: jabodetabekMaxBounds,
                maxBoundsViscosity: 1.0,
                minZoom: 9
            }).setView([-6.2088, 106.8456], 12);
            L.control.zoom({ position: 'bottomright' }).addTo(map);
            addMapTileLayer(map);
            if (tripMarkersLayer) tripMarkersLayer.addTo(map);
            window.map = map;
        }

        const elMonitor = document.getElementById('map-monitor');
        if (elMonitor && !mapMonitor) {
            mapMonitor = L.map('map-monitor', {
                zoomControl: false,
                scrollWheelZoom: false,
                maxBounds: jabodetabekMaxBounds,
                maxBoundsViscosity: 1.0,
                minZoom: 9
            }).setView([-6.2088, 106.8456], 12);
            L.control.zoom({ position: 'bottomright' }).addTo(mapMonitor);
            addMapTileLayer(mapMonitor);
            if (monitorMarkersLayer) monitorMarkersLayer.addTo(mapMonitor);
            if (monitorCouriersLayer) monitorCouriersLayer.addTo(mapMonitor);
            window.mapMonitor = mapMonitor;
        }

        const elDispatch = document.getElementById('map-dispatch');
        if (elDispatch && !mapDispatch) {
            mapDispatch = L.map('map-dispatch', {
                zoomControl: false,
                scrollWheelZoom: false,
                maxBounds: jabodetabekMaxBounds,
                maxBoundsViscosity: 1.0,
                minZoom: 9
            }).setView([-6.2088, 106.8456], 12);
            L.control.zoom({ position: 'bottomright' }).addTo(mapDispatch);
            addMapTileLayer(mapDispatch);
            if (draftMarkersLayer) draftMarkersLayer.addTo(mapDispatch);
            window.mapDispatch = mapDispatch;
        }

        if (typeof refreshMapSizes === 'function') {
            refreshMapSizes();
        }
    } catch (e) {
        console.error("Leaflet Init Error:", e);
    }
}

// Driver Focus Mode: Focus single driver and hide other markers
function setFocusedDriver(driverId) {
    if (!driverId) return;
    window.focusedDriverId = driverId;

    const norm = (typeof normalizeCourierIdentity === 'function') ? normalizeCourierIdentity(driverId, '') : null;
    const canonId = norm?.canonicalId || driverId.toLowerCase();

    const dName = (typeof registeredUsers !== 'undefined' && registeredUsers[driverId])
        ? registeredUsers[driverId]
        : (norm?.displayName || (typeof getCourierDisplayName === 'function' ? getCourierDisplayName(driverId) : driverId));

    const targetMap = window.mapMonitor || window.map;

    // Determine coordinate of the focused personil
    let targetPos = null;
    if (typeof currentOnlineCouriers !== 'undefined') {
        for (const k in currentOnlineCouriers) {
            const kNorm = (typeof normalizeCourierIdentity === 'function') ? normalizeCourierIdentity(k, '') : null;
            if (k === driverId || k === canonId || (kNorm && kNorm.canonicalId === canonId)) {
                const c = currentOnlineCouriers[k];
                if (c && c.lat && c.lng) {
                    targetPos = [parseFloat(c.lat), parseFloat(c.lng)];
                    break;
                }
            }
        }
    }

    if (!targetPos && typeof allCurrentTrips !== 'undefined') {
        const t = allCurrentTrips.find(x => {
            const tNorm = (typeof normalizeCourierIdentity === 'function') ? normalizeCourierIdentity(x.courierId, '') : null;
            return (x.courierId === driverId || x.courierId === canonId || (tNorm && tNorm.canonicalId === canonId)) && x.destinations && x.destinations.length > 0;
        });
        if (t && t.destinations[0]) {
            const d = t.destinations[0];
            const lat = parseFloat(d.latitude || d.lat);
            const lng = parseFloat(d.longitude || d.lng);
            if (!isNaN(lat) && !isNaN(lng)) targetPos = [lat, lng];
        }
    }

    if (targetMap && targetPos) {
        targetMap.flyTo(targetPos, 16, { duration: 1.2 });
    }

    renderMapFocusControl(dName);
    updateMapMarkers();

    if (typeof showToast === 'function') {
        showToast(`Fokus aktif: ${dName}. Seluruh marker lain disembunyikan.`);
    }
}

function resetDriverFocus() {
    window.focusedDriverId = null;
    const banner = document.getElementById('map-focus-indicator');
    if (banner) banner.remove();

    const targetMap = window.mapMonitor || window.map;
    if (targetMap) {
        targetMap.setView([-6.2088, 106.8456], 12);
    }

    updateMapMarkers();
    if (typeof showToast === 'function') {
        showToast("Fokus di-reset. Menampilkan semua armada.");
    }
}

function renderMapFocusControl(driverName) {
    let indicator = document.getElementById('map-focus-indicator');
    if (!indicator) {
        const mapContainer = document.getElementById('map-monitor') || document.getElementById('map');
        if (!mapContainer) return;

        // Ensure relative positioning
        if (getComputedStyle(mapContainer).position === 'static') {
            mapContainer.style.position = 'relative';
        }

        indicator = document.createElement('div');
        indicator.id = 'map-focus-indicator';
        indicator.style.cssText = 'position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 1000;';
        mapContainer.appendChild(indicator);
    }

    indicator.innerHTML = `
        <div class="d-flex align-items-center gap-2 bg-dark text-white px-3 py-1.5 rounded-pill shadow-lg" style="font-size: 0.8rem; border: 1px solid rgba(255,255,255,0.2);">
            <span class="d-inline-block rounded-circle bg-success me-1" style="width: 8px; height: 8px;"></span>
            <span>Fokus Driver: <b>${driverName}</b></span>
            <button class="btn btn-xs btn-light rounded-pill px-2.5 py-0.5 fw-bold text-dark ms-2" style="font-size: 0.72rem;" onclick="resetDriverFocus()">
                <i class="bi bi-x-circle me-1"></i>Reset Focus / Tampilkan Semua
            </button>
        </div>
    `;
}

function updateMapMarkers(filter = "") {
    const search = filter.toLowerCase();
    if (typeof tripMarkersLayer !== 'undefined' && tripMarkersLayer) tripMarkersLayer.clearLayers();
    if (typeof monitorMarkersLayer !== 'undefined' && monitorMarkersLayer) monitorMarkersLayer.clearLayers();
    if (typeof monitorCouriersLayer !== 'undefined' && monitorCouriersLayer) monitorCouriersLayer.clearLayers();

    // 1. Render Online Couriers / Drivers
    if (typeof currentOnlineCouriers !== 'undefined') {
        for (const id in currentOnlineCouriers) {
            if (typeof isCourierInActiveBranch === 'function' && !isCourierInActiveBranch(id)) continue;

            // DRIVER FOCUS MODE: If a driver is focused, hide all other drivers/couriers
            if (window.focusedDriverId && window.focusedDriverId !== id) {
                continue;
            }

            const c = currentOnlineCouriers[id];
            if (!c || typeof c.lat === 'undefined' || typeof c.lng === 'undefined') continue;
            if (!isInsideJabodetabekArea(c.lat, c.lng)) continue;

            const name = (typeof registeredUsers !== 'undefined' && registeredUsers[id])
                ? registeredUsers[id]
                : (typeof getCourierDisplayName === 'function' ? getCourierDisplayName(id) : '');

            // HAPUS / HIDE NON-MASTER / ANONYMOUS "Carrier (...)" DARI LIVE MAP
            if (typeof isRecognizedCourier === 'function' && !isRecognizedCourier(id, name)) {
                continue;
            }

            const color = window.getCourierColor(id, name);
            const pos = [c.lat, c.lng];
            const livePhotoUrl = (typeof window.getCourierPhoto === 'function') ? window.getCourierPhoto(id, name) : null;

            let liveIconHtml = '';
            if (livePhotoUrl) {
                liveIconHtml = `
                    <div style="position:relative; width:34px; height:34px; cursor:pointer;" title="Kurir: ${name}">
                        <div style="width:34px; height:34px; border-radius:50%; border:2.5px solid #ffffff; box-shadow:0 0 10px ${color}, 0 2px 6px rgba(0,0,0,0.3); overflow:hidden; background:#ffffff;">
                            <img src="${livePhotoUrl}" style="width:100%; height:100%; object-fit:cover;" alt="${name}">
                        </div>
                        <span style="position:absolute; bottom:-1px; right:-1px; width:10px; height:10px; border-radius:50%; background:#10B981; border:2px solid #fff;"></span>
                    </div>
                `;
            } else {
                liveIconHtml = `<div style="background:${color}; width:28px; height:28px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 10px ${color}; display:flex; align-items:center; justify-content:center; color:#fff; font-size:12px; font-weight:bold; cursor:pointer;"><i class="bi bi-geo-alt-fill"></i></div>`;
            }

            const courierIcon = L.divIcon({
                className: 'custom-div-icon',
                html: liveIconHtml,
                iconSize: livePhotoUrl ? [34, 34] : [28, 28],
                iconAnchor: livePhotoUrl ? [17, 17] : [14, 14]
            });

            const popupHtml = `
                <div style="min-width:160px; font-family: inherit;">
                    <div class="d-flex align-items-center gap-2 mb-1">
                        ${livePhotoUrl ? `<img src="${livePhotoUrl}" style="width:28px; height:28px; border-radius:50%; object-fit:cover; border:1px solid ${color};">` : ''}
                        <div style="font-weight:800; font-size:13px; color:#111827;">${name}</div>
                    </div>
                    <div style="color:${color}; font-size:10px; font-weight:800; letter-spacing:0.5px;">LIVE GPS ON-TRACK</div>
                    <button class="btn btn-xs btn-dark w-100 mt-2 py-1 fw-bold" style="font-size:0.7rem; border-radius:6px;" onclick="setFocusedDriver('${id}')">
                        <i class="bi bi-crosshair me-1"></i> Fokus Driver Ini
                    </button>
                </div>
            `;

            if (typeof tripMarkersLayer !== 'undefined' && tripMarkersLayer) {
                const mDash = L.marker(pos, { icon: courierIcon }).addTo(tripMarkersLayer);
                mDash.courierId = id;
                mDash.courierName = name;
                mDash.bindPopup(popupHtml);
                mDash.on('click', () => { setFocusedDriver(id); });
            }

            if (typeof monitorCouriersLayer !== 'undefined' && monitorCouriersLayer && (!filter || name.toLowerCase().includes(search) || id.toLowerCase().includes(search))) {
                const mMon = L.marker(pos, { icon: courierIcon }).addTo(monitorCouriersLayer);
                mMon.courierId = id;
                mMon.courierName = name;
                mMon.bindPopup(popupHtml);
                mMon.on('click', () => { setFocusedDriver(id); });
            }
        }
    }

    // 2. Render Trip Destination Stops (WITHOUT Polyline Route Lines)
    if (typeof allCurrentTrips === 'undefined') return;

    const now = new Date();
    const todayDayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // Track 1 single photo pin per courier (stops 2..N remain regular numbered pins)
    const couriersWithPhotoPinPlaced = {};

    allCurrentTrips.forEach(t => {
        if (typeof isTripInActiveBranch === 'function' && !isTripInActiveBranch(t)) return;

        // DRIVER FOCUS MODE: If a driver is focused, hide all destination stops for other drivers/couriers
        if (window.focusedDriverId) {
            const normFocused = (typeof normalizeCourierIdentity === 'function') ? normalizeCourierIdentity(window.focusedDriverId, '') : null;
            const focusedCanon = normFocused?.canonicalId || window.focusedDriverId.toLowerCase();
            const thisNorm = (typeof normalizeCourierIdentity === 'function') ? normalizeCourierIdentity(t.courierId, '') : null;
            const thisCanon = thisNorm?.canonicalId || t.courierId.toLowerCase();

            if (thisCanon !== focusedCanon && t.courierId !== window.focusedDriverId) {
                return;
            }
        }

        const cName = (typeof registeredUsers !== 'undefined' && registeredUsers[t.courierId])
            ? registeredUsers[t.courierId]
            : (typeof getCourierDisplayName === 'function' ? getCourierDisplayName(t.courierId) : t.courierId.substring(0,8));
        const cColor = window.getCourierColor(t.courierId, cName);
        const tripMs = t.date?.seconds ? t.date.seconds * 1000 : (t.date ? new Date(t.date).getTime() : (t.id ? parseInt(t.id.replace('TRIP_', '')) || 0 : 0));

        // Clean map on new day (H+1): Only render map markers for TODAY'S active trips
        if (tripMs < todayDayMs) {
            return;
        }

        const cNorm = (typeof normalizeCourierIdentity === 'function') ? normalizeCourierIdentity(t.courierId, cName) : null;
        const cKey = cNorm?.canonicalId || (t.courierId || cName || '').toLowerCase();
        const photoUrl = (typeof window.getCourierPhoto === 'function') ? window.getCourierPhoto(t.courierId, cName) : null;

        if (t.status !== 'completed' && t.destinations && t.destinations.length > 0) {
            t.destinations.forEach((d, idx) => {
                let dLat = parseFloat(d.latitude !== undefined ? d.latitude : (d.lat !== undefined ? d.lat : 0));
                let dLng = parseFloat(d.longitude !== undefined ? d.longitude : (d.lng !== undefined ? d.lng : 0));

                if (!dLat || !dLng || isNaN(dLat) || isNaN(dLng) || !isInsideJabodetabekArea(dLat, dLng)) {
                    let hash = 0;
                    const str = (d.locationName || '') + (d.address || '') + idx;
                    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
                    const latOffset = ((Math.abs(hash) % 80) - 40) / 1000;
                    const lngOffset = ((Math.abs(hash * 3) % 80) - 40) / 1000;
                    dLat = -6.2088 + latOffset;
                    dLng = 106.8456 + lngOffset;
                }

                const pt = [dLat, dLng];

                let pinColor = cColor;
                let statusText = 'Pending';
                let numBadge = d.stopIndex || (idx + 1);
                let badgeContent = numBadge;

                if (d.proofPhotoUrl && d.proofPhotoUrl.length > 0) {
                    pinColor = '#10B981';
                    statusText = 'Selesai (SJ Uploaded) ✓';
                    badgeContent = '<i class="bi bi-check-lg" style="color: #10B981; font-size: 15px; -webkit-text-stroke: 1px #10B981;"></i>';
                } else if (d.status === 'done') {
                    pinColor = '#10B981';
                    statusText = 'Selesai ✓';
                    badgeContent = '<i class="bi bi-check-lg" style="color: #10B981; font-size: 15px; -webkit-text-stroke: 1px #10B981;"></i>';
                } else if (d.status === 'arrived') {
                    pinColor = '#F59E0B';
                    statusText = 'Tiba';
                    badgeContent = numBadge;
                } else if (t.status === 'accepted') {
                    statusText = 'Diterima (Proses)';
                    badgeContent = numBadge;
                } else if (t.status === 'assigned') {
                    statusText = 'Ditugaskan';
                    badgeContent = numBadge;
                }

                // Exactly 1 pin per courier features their photo avatar (Stop #1)
                const shouldShowPhotoPin = photoUrl && (!couriersWithPhotoPinPlaced[cKey]) && (idx === 0);
                if (shouldShowPhotoPin) {
                    couriersWithPhotoPinPlaced[cKey] = true;
                }

                let iconHtml = '';
                let iconSize = [30, 42];
                let iconAnchor = [15, 42];

                if (shouldShowPhotoPin) {
                    iconHtml = `
                        <div style="position:relative; width:40px; height:52px; cursor:pointer;" title="Area Pengantaran: ${cName}">
                            <div style="width:36px; height:36px; border-radius:50%; border:3px solid ${pinColor}; box-shadow:0 3px 10px rgba(0,0,0,0.35); overflow:hidden; background:#fff; position:absolute; top:0; left:2px;">
                                <img src="${photoUrl}" style="width:100%; height:100%; object-fit:cover;" alt="${cName}">
                            </div>
                            <div style="position:absolute; bottom:1px; left:50%; transform:translateX(-50%); width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:12px solid ${pinColor};"></div>
                            <div style="position:absolute; top:-3px; right:0px; background:${pinColor}; color:#fff; font-size:9.5px; font-weight:800; border-radius:50%; width:16px; height:16px; display:flex; align-items:center; justify-content:center; border:2px solid #fff; box-shadow:0 1px 3px rgba(0,0,0,0.2);">${numBadge}</div>
                        </div>
                    `;
                    iconSize = [40, 52];
                    iconAnchor = [20, 52];
                } else {
                    iconHtml = `<div class='marker-pin' style='background:${pinColor}'></div><div class='marker-num'>${badgeContent}</div>`;
                    iconSize = [30, 42];
                    iconAnchor = [15, 42];
                }

                const icon = L.divIcon({
                    className: 'custom-div-icon',
                    html: iconHtml,
                    iconSize: iconSize,
                    iconAnchor: iconAnchor
                });

                const popupHtml = `
                    <div style="min-width:180px;">
                        <div style="background:${pinColor}; color:#fff; padding:2px 8px; border-radius:10px; font-size:10px; font-weight:700; display:inline-block; margin-bottom:4px;">
                            Stop ${numBadge}: ${statusText}
                        </div>
                        <div style="font-weight:800; font-size:13px; color:#111827; margin-bottom:2px;">${d.locationName}</div>
                        <div style="font-size:11px; color:#6B7280; margin-bottom:6px;">${d.address || 'Alamat tidak tersedia'}</div>
                        <div style="font-size:11px; font-weight:700; border-top:1px solid #E5E7EB; padding-top:4px;" class="d-flex align-items-center gap-1.5">
                            ${photoUrl ? `<img src="${photoUrl}" style="width:20px; height:20px; border-radius:50%; object-fit:cover;">` : ''}
                            <span>Personil: <b style="color:${cColor};">${cName}</b></span>
                        </div>
                    </div>
                `;

                if (typeof tripMarkersLayer !== 'undefined' && tripMarkersLayer) L.marker(pt, { icon }).bindPopup(popupHtml).addTo(tripMarkersLayer);
                if (typeof monitorMarkersLayer !== 'undefined' && monitorMarkersLayer) {
                    const matches = d.locationName.toLowerCase().includes(search) || cName.toLowerCase().includes(search) || t.id.toLowerCase().includes(search);
                    if (!filter || matches) {
                        L.marker(pt, { icon }).bindPopup(popupHtml).addTo(monitorMarkersLayer);
                    }
                }
            });
            // NOTE: Requirement 2: Hapus Polyline Garis Tujuan (No L.polyline added)
        }
    });
}

let activeHeatmapLayers = [];

function toggleHeatmap() {
    if (activeHeatmapLayers.length > 0) {
        activeHeatmapLayers.forEach(layer => {
            if (window.map && window.map.hasLayer(layer)) window.map.removeLayer(layer);
            if (window.mapMonitor && window.mapMonitor.hasLayer(layer)) window.mapMonitor.removeLayer(layer);
            if (window.mapDispatch && window.mapDispatch.hasLayer(layer)) window.mapDispatch.removeLayer(layer);
        });
        activeHeatmapLayers = [];

        document.querySelectorAll('.btn-heatmap-toggle').forEach(btn => {
            btn.classList.remove('btn-danger', 'text-white', 'active');
            btn.classList.add('btn-outline-primary');
        });

        if (typeof showToast === 'function') showToast("Traffic Heatmap Nonaktif.");
        return;
    }

    const points = [];

    // 1. Destination & delivery density points
    if (typeof allCurrentTrips !== 'undefined') {
        allCurrentTrips.forEach(t => {
            if (t.destinations) {
                t.destinations.forEach(d => {
                    const lat = parseFloat(d.latitude || d.lat);
                    const lng = parseFloat(d.longitude || d.lng);
                    if (!isNaN(lat) && !isNaN(lng) && isInsideJabodetabekArea(lat, lng)) {
                        const weight = (d.status === 'arrived' || t.status === 'in_progress') ? 1.0 : 0.7;
                        points.push([lat, lng, weight]);
                    }
                });
            }
        });
    }

    // 2. Real-time online courier locations
    if (typeof currentOnlineCouriers !== 'undefined') {
        for (const cId in currentOnlineCouriers) {
            const c = currentOnlineCouriers[cId];
            if (c && c.lat && c.lng) {
                const lat = parseFloat(c.lat);
                const lng = parseFloat(c.lng);
                if (!isNaN(lat) && !isNaN(lng) && isInsideJabodetabekArea(lat, lng)) {
                    points.push([lat, lng, 0.9]);
                }
            }
        }
    }

    if (points.length === 0) {
        points.push(
            [-6.2088, 106.8456, 1.0], // Sudirman / Kuningan
            [-6.2297, 106.8075, 0.9], // Senayan
            [-6.2441, 106.8283, 1.0], // Mampang
            [-6.1754, 106.8272, 0.8], // Monas / Harmoni
            [-6.2615, 106.8106, 0.9], // Blok M
            [-6.1683, 106.9004, 0.8]  // Kelapa Gading
        );
    }

    // Real-time Traffic Congestion RED Heatmap Gradient
    const redTrafficGradient = {
        0.1: '#fef2f2',
        0.3: '#fca5a5',
        0.6: '#ef4444',
        0.8: '#dc2626',
        1.0: '#991b1b'
    };

    activeHeatmapLayers = [];
    const activeMaps = [window.map, window.mapMonitor, window.mapDispatch].filter(Boolean);

    activeMaps.forEach(m => {
        try {
            const layer = L.heatLayer(points, {
                radius: 30,
                blur: 20,
                maxZoom: 17,
                max: 1.0,
                gradient: redTrafficGradient
            }).addTo(m);
            activeHeatmapLayers.push(layer);
        } catch (e) {
            console.warn("Heatmap error:", e);
        }
    });

    document.querySelectorAll('.btn-heatmap-toggle').forEach(btn => {
        btn.classList.remove('btn-outline-primary');
        btn.classList.add('btn-danger', 'text-white', 'active');
    });

    if (typeof showToast === 'function') showToast("Realtime Red Traffic Heatmap Aktif!");
}

window.gm_authFailure = function() {
    console.warn("Google Maps API Key Error / Disabled. Fallback to OpenStreetMap Active.");
    const input = document.getElementById('places-search');
    if (input) {
        input.classList.remove('pac-target-input');
        input.style.backgroundImage = 'none';
        input.style.backgroundColor = '#ffffff';
    }
    const pacContainers = document.querySelectorAll('.pac-container');
    pacContainers.forEach(c => c.remove());
};

async function initAutocomplete() {
    try {
        const input = document.getElementById('places-search');
        if (!input) return;

        input.setAttribute('autocomplete', 'off');
        input.setAttribute('spellcheck', 'false');
        input.setAttribute('data-lpignore', 'true');
        input.setAttribute('data-1p-ignore', 'true');
        input.style.backgroundImage = 'none';
        input.style.backgroundColor = '#ffffff';

        let autocomplete;
        const operationalLatLngBounds = (window.google && google.maps && google.maps.LatLngBounds)
            ? new google.maps.LatLngBounds(
                { lat: -6.9500, lng: 105.7000 }, // Batas Barat Daya: Banten / Rangkas / Serang / Pandeglang
                { lat: -5.8000, lng: 107.5000 }  // Batas Timur Laut: Jakarta Utara / Cikarang / Karawang / Cikampek
              )
            : null;

        if (window.google && google.maps && google.maps.places && google.maps.places.Autocomplete) {
            autocomplete = new google.maps.places.Autocomplete(input, {
                componentRestrictions: { country: "id" },
                bounds: operationalLatLngBounds,
                strictBounds: true, // KUNCI TOTAL: Hanya sarankan lokasi dalam koridor Jabodetabek, Banten, & Karawang
                fields: ["geometry", "name", "formatted_address"]
            });
        } else if (window.google && google.maps && google.maps.importLibrary) {
            const { Autocomplete } = await google.maps.importLibrary("places");
            if (Autocomplete) {
                autocomplete = new Autocomplete(input, {
                    componentRestrictions: { country: "id" },
                    bounds: operationalLatLngBounds,
                    strictBounds: true, // KUNCI TOTAL
                    fields: ["geometry", "name", "formatted_address"]
                });
            }
        }

        if (autocomplete) {
            autocomplete.addListener("place_changed", () => {
                const place = autocomplete.getPlace();
                if (place && place.geometry && place.geometry.location) {
                    const lat = place.geometry.location.lat();
                    const lng = place.geometry.location.lng();
                    const name = place.name || input.value.split(',')[0] || "Tujuan";
                    const address = place.formatted_address || input.value;

                    if (!isInsideJabodetabekArea(lat, lng)) {
                        alert("LOKASI DILUAR JANGKAUAN OPERASIONAL!\nPeta dan sistem pengiriman dikunci khusus untuk wilayah: JABODETABEK, BANTEN, SERANG, RANGKAS, BITUNG TANGERANG, BOGOR, CIKARANG, dan KARAWANG.\n(Tidak melayani tujuan luar kota seperti Semarang, Surabaya, atau pulau di luar Jawa).");
                        input.value = "";
                        return;
                    }

                    if (typeof tripQueue !== 'undefined') {
                        tripQueue.push({ name, address, lat, lng });
                        if (typeof renderQueue === 'function') renderQueue();
                    }
                    input.value = "";
                    if (typeof showToast === 'function') showToast("Lokasi ditambahkan ke rute!");
                    if (mapDispatch) mapDispatch.flyTo([lat, lng], 16);
                } else if (input.value.trim().length > 0) {
                    addManualAddress();
                }
            });
        }
    } catch (e) {
        console.error("Maps Autocomplete Error", e);
    }
}

async function addManualAddress() {
    const input = document.getElementById('places-search');
    if (!input) return;
    const addressText = input.value.trim();
    if (!addressText) return alert("Masukkan nama toko atau alamat lokasi terlebih dahulu!");

    if (typeof showToast === 'function') showToast("Mencari koordinat lokasi...");

    try {
        if (window.google && google.maps && google.maps.Geocoder) {
            const geocoder = new google.maps.Geocoder();
            const operationalGeocodeBounds = (google.maps.LatLngBounds)
                ? new google.maps.LatLngBounds({ lat: -6.9500, lng: 105.7000 }, { lat: -5.8000, lng: 107.5000 })
                : null;

            geocoder.geocode({ 
                address: addressText, 
                componentRestrictions: { country: "ID" },
                bounds: operationalGeocodeBounds
            }, (results, status) => {
                if (status === "OK" && results && results[0]) {
                    const loc = results[0].geometry.location;
                    const lat = loc.lat();
                    const lng = loc.lng();
                    const formatted = results[0].formatted_address || addressText;
                    const parts = addressText.split(',');
                    const storeName = parts[0].trim();

                    if (!isInsideJabodetabekArea(lat, lng)) {
                        alert("LOKASI DILUAR JANGKAUAN OPERASIONAL!\nPeta dan sistem pengiriman dikunci khusus untuk wilayah: JABODETABEK, BANTEN, SERANG, RANGKAS, BITUNG TANGERANG, BOGOR, CIKARANG, dan KARAWANG.\n(Tidak melayani tujuan luar kota seperti Semarang, Surabaya, atau pulau di luar Jawa).");
                        input.value = "";
                        return;
                    }

                    if (typeof tripQueue !== 'undefined') {
                        tripQueue.push({ name: storeName, address: formatted, lat, lng });
                        if (typeof renderQueue === 'function') renderQueue();
                    }
                    input.value = "";
                    if (typeof showToast === 'function') showToast("Lokasi berhasil ditambahkan!");
                    if (mapDispatch) mapDispatch.flyTo([lat, lng], 16);
                } else {
                    geocodeWithNominatim(addressText);
                }
            });
        } else {
            geocodeWithNominatim(addressText);
        }
    } catch(e) {
        console.error("Geocoding error:", e);
        geocodeWithNominatim(addressText);
    }
}

async function geocodeWithNominatim(addressText) {
    try {
        let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressText)}&countrycodes=id&limit=1`;
        let res = await fetch(url);
        let data = await res.json();

        if ((!data || data.length === 0) && addressText.includes(',')) {
            const cleanQuery = addressText.split(',').slice(1).join(',').trim();
            if (cleanQuery) {
                url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanQuery)}&countrycodes=id&limit=1`;
                res = await fetch(url);
                data = await res.json();
            }
        }

        if (!data || data.length === 0) {
            const lower = addressText.toLowerCase();
            let fallbackSearch = "";
            if (lower.includes("serang") || lower.includes("syafei") || lower.includes("banten") || lower.includes("lontar")) {
                fallbackSearch = "Jl. Mayor Syafei, Serang, Banten";
            } else if (lower.includes("cilegon")) {
                fallbackSearch = "Cilegon, Banten";
            } else if (lower.includes("karawang")) {
                fallbackSearch = "Karawang, Jawa Barat";
            }

            if (fallbackSearch) {
                url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fallbackSearch)}&countrycodes=id&limit=1`;
                res = await fetch(url);
                data = await res.json();
            }
        }

        let lat = 0, lng = 0, formatted = addressText;
        if (data && data.length > 0) {
            lat = parseFloat(data[0].lat);
            lng = parseFloat(data[0].lon);
            formatted = data[0].display_name || addressText;
        } else {
            const lower = addressText.toLowerCase();
            if (lower.includes("serang") || lower.includes("syafei") || lower.includes("banten") || lower.includes("lontar")) {
                lat = -6.1158;
                lng = 106.1558;
            } else if (lower.includes("cilegon")) {
                lat = -6.0175;
                lng = 106.0538;
            }
        }

        if (lat !== 0 && lng !== 0) {
            const parts = addressText.split(',');
            const storeName = parts[0].trim();

            if (!isInsideJabodetabekArea(lat, lng)) {
                alert("LOKASI DILUAR WILAYAH JABODETABEK, BANTEN, & KARAWANG!\nPengiriman hanya dibatasi untuk area Jabodetabek, Banten (Serang, Cilegon), Cikarang, Karawang, dan Tangerang.");
                return;
            }

            if (typeof tripQueue !== 'undefined') {
                tripQueue.push({ name: storeName, address: formatted, lat, lng });
                if (typeof renderQueue === 'function') renderQueue();
            }
            const input = document.getElementById('places-search');
            if (input) input.value = "";
            if (typeof showToast === 'function') showToast("Lokasi berhasil ditambahkan!");
            if (mapDispatch) mapDispatch.flyTo([lat, lng], 16);
            return;
        }

        alert(`Lokasi "${addressText}" tidak ditemukan. Silakan perjelas nama toko / jalan / kota.`);
    } catch(e) {
        console.error("Nominatim geocoding error:", e);
        alert("Gagal mencari lokasi. Periksa koneksi internet Anda.");
    }
}

window.addEventListener('load', () => {
    initMaps();
    initAutocomplete();
});
