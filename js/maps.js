// ==========================================
// WTRACK LOGISTICS - LEAFLET & MAPS MODULE
// ==========================================

let map, mapMonitor, mapDispatch;
const tripMarkersLayer = L.layerGroup();
const monitorMarkersLayer = L.layerGroup();
const monitorCouriersLayer = L.layerGroup();
const draftMarkersLayer = L.layerGroup();
const tripRoutesLayer = L.layerGroup();

let heatmapLayer = null;

// Jabodetabek + Cikarang + Karawang + Tangerang + Bogor Bounding Box (-6.8000 to -5.8000, 106.3000 to 107.5000)
function isInsideJabodetabekArea(lat, lng) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    if (isNaN(latitude) || isNaN(longitude)) return false;
    return latitude >= -6.8000 && latitude <= -5.8000 && longitude >= 106.3000 && longitude <= 107.5000;
}

const jabodetabekMaxBounds = L.latLngBounds(
    L.latLng(-6.8000, 106.3000), // South-West (Bogor / Tangerang)
    L.latLng(-5.8000, 107.5000)  // North-East (Jakarta Coast / Karawang)
);

const googleTiles = {
    url: 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    options: {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps'
    }
};

function initMaps() {
    try {
        if (document.getElementById('map')) {
            if (map) { map.remove(); map = null; }
            const containerMap = document.getElementById('map');
            if (containerMap && containerMap._leaflet_id) containerMap._leaflet_id = null;

            map = L.map('map', {
                zoomControl: false,
                maxBounds: jabodetabekMaxBounds,
                maxBoundsViscosity: 0.8
            }).setView([-6.2088, 106.8456], 12);
            L.control.zoom({ position: 'bottomright' }).addTo(map);
            L.tileLayer(googleTiles.url, googleTiles.options).addTo(map);
            tripMarkersLayer.addTo(map);
            tripRoutesLayer.addTo(map);
        }
        if (document.getElementById('map-monitor')) {
            if (mapMonitor) { mapMonitor.remove(); mapMonitor = null; }
            const containerMon = document.getElementById('map-monitor');
            if (containerMon && containerMon._leaflet_id) containerMon._leaflet_id = null;

            mapMonitor = L.map('map-monitor', {
                zoomControl: false,
                maxBounds: jabodetabekMaxBounds,
                maxBoundsViscosity: 0.8
            }).setView([-6.2088, 106.8456], 12);
            L.control.zoom({ position: 'bottomright' }).addTo(mapMonitor);
            L.tileLayer(googleTiles.url, googleTiles.options).addTo(mapMonitor);
            monitorMarkersLayer.addTo(mapMonitor);
            monitorCouriersLayer.addTo(mapMonitor);
            tripRoutesLayer.addTo(mapMonitor);
        }
        if (document.getElementById('map-dispatch')) {
            if (mapDispatch) { mapDispatch.remove(); mapDispatch = null; }
            const containerDisp = document.getElementById('map-dispatch');
            if (containerDisp && containerDisp._leaflet_id) containerDisp._leaflet_id = null;

            mapDispatch = L.map('map-dispatch', {
                zoomControl: false,
                maxBounds: jabodetabekMaxBounds,
                maxBoundsViscosity: 0.8
            }).setView([-6.2088, 106.8456], 12);
            L.control.zoom({ position: 'bottomright' }).addTo(mapDispatch);
            L.tileLayer(googleTiles.url, googleTiles.options).addTo(mapDispatch);
            draftMarkersLayer.addTo(mapDispatch);
        }

        setTimeout(() => {
            if (map && typeof map.invalidateSize === 'function') map.invalidateSize();
            if (mapMonitor && typeof mapMonitor.invalidateSize === 'function') mapMonitor.invalidateSize();
            if (mapDispatch && typeof mapDispatch.invalidateSize === 'function') mapDispatch.invalidateSize();
        }, 200);
    } catch (e) {
        console.error("Leaflet Init Error:", e);
    }
}

function updateMapMarkers(filter = "") {
    const search = filter.toLowerCase();
    if (typeof tripMarkersLayer !== 'undefined') tripMarkersLayer.clearLayers();
    if (typeof monitorMarkersLayer !== 'undefined') monitorMarkersLayer.clearLayers();
    if (typeof monitorCouriersLayer !== 'undefined') monitorCouriersLayer.clearLayers();
    if (typeof tripRoutesLayer !== 'undefined') tripRoutesLayer.clearLayers();

    // 1. Render Online Couriers inside Jabodetabek & Karawang
    if (typeof currentOnlineCouriers !== 'undefined') {
        for (const id in currentOnlineCouriers) {
            const c = currentOnlineCouriers[id];
            if (!c || typeof c.lat === 'undefined' || typeof c.lng === 'undefined') continue;

            // Restrict courier markers to Jabodetabek + Cikarang + Karawang + Tangerang
            if (!isInsideJabodetabekArea(c.lat, c.lng)) continue;

            const color = typeof getCourierColor === 'function' ? getCourierColor(id) : '#10B981';
            const name = (typeof registeredUsers !== 'undefined' && registeredUsers[id]) ? registeredUsers[id] : 'Carrier';
            const pos = [c.lat, c.lng];

            const courierIcon = L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="background:${color}; width:24px; height:24px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 10px ${color}; display:flex; align-items:center; justify-content:center; color:#fff; font-size:10px; font-weight:bold;">🚚</div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });

            if (typeof tripMarkersLayer !== 'undefined') {
                const mDash = L.marker(pos, { icon: courierIcon }).addTo(tripMarkersLayer);
                mDash.courierId = id;
                mDash.courierName = name;
                mDash.bindPopup(`<div style="min-width:140px;"><b>${name}</b><br><small style="color:${color}; font-weight:800;">LIVE GPS ON-TRACK</small></div>`);
            }

            if (typeof monitorCouriersLayer !== 'undefined' && (!filter || name.toLowerCase().includes(search) || id.toLowerCase().includes(search))) {
                const mMon = L.marker(pos, { icon: courierIcon }).addTo(monitorCouriersLayer);
                mMon.courierId = id;
                mMon.courierName = name;
                mMon.bindPopup(`<div style="min-width:140px;"><b>${name}</b><br><small style="color:${color}; font-weight:800;">LIVE GPS ON-TRACK</small></div>`);
            }
        }
    }

    // 2. Render All Trip Destinations & Route Lines
    if (typeof allCurrentTrips === 'undefined') return;

    allCurrentTrips.forEach(t => {
        const cName = (typeof registeredUsers !== 'undefined' && registeredUsers[t.courierId]) ? registeredUsers[t.courierId] : t.courierId.substring(0,8);
        const cColor = typeof getCourierColor === 'function' ? getCourierColor(t.courierId) : '#3B82F6';

        if (t.status !== 'completed' && t.destinations && t.destinations.length > 0) {
            const routePoints = [];

            const livePos = (typeof currentOnlineCouriers !== 'undefined') ? currentOnlineCouriers[t.courierId] : null;
            const startPt = (livePos && livePos.lat && livePos.lng && isInsideJabodetabekArea(livePos.lat, livePos.lng)) ? [livePos.lat, livePos.lng] : [-6.2088, 106.8456];
            routePoints.push(startPt);

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
                routePoints.push(pt);

                let pinColor = cColor;
                let statusText = 'Pending';
                let numBadge = d.stopIndex || (idx + 1);

                if (d.status === 'done' || (d.proofPhotoUrl && d.proofPhotoUrl.length > 0)) {
                    pinColor = '#10B981';
                    statusText = 'Selesai ✓';
                } else if (d.status === 'arrived') {
                    pinColor = '#F59E0B';
                    statusText = 'Tiba 🚚';
                } else if (t.status === 'accepted') {
                    statusText = 'Diterima (Proses)';
                } else if (t.status === 'assigned') {
                    statusText = 'Ditugaskan';
                }

                const icon = L.divIcon({
                    className: 'custom-div-icon',
                    html: `<div class='marker-pin' style='background:${pinColor}'></div><div class='marker-num'>${numBadge}</div>`,
                    iconSize: [30, 42],
                    iconAnchor: [15, 42]
                });

                const popupHtml = `
                    <div style="min-width:180px;">
                        <div style="background:${pinColor}; color:#fff; padding:2px 8px; border-radius:10px; font-size:10px; font-weight:700; display:inline-block; margin-bottom:4px;">
                            Stop ${numBadge}: ${statusText}
                        </div>
                        <div style="font-weight:800; font-size:13px; color:#111827; margin-bottom:2px;">${d.locationName}</div>
                        <div style="font-size:11px; color:#6B7280; margin-bottom:6px;">${d.address || 'Alamat tidak tersedia'}</div>
                        <div style="font-size:11px; font-weight:700; border-top:1px solid #E5E7EB; padding-top:4px;">
                            Kurir: <span style="color:${cColor};">${cName}</span> | Status: <b>${t.status.toUpperCase()}</b>
                        </div>
                    </div>
                `;

                if (typeof tripMarkersLayer !== 'undefined') L.marker(pt, { icon }).bindPopup(popupHtml).addTo(tripMarkersLayer);
                if (typeof monitorMarkersLayer !== 'undefined') {
                    const matches = d.locationName.toLowerCase().includes(search) || cName.toLowerCase().includes(search) || t.id.toLowerCase().includes(search);
                    if (!filter || matches) {
                        L.marker(pt, { icon }).bindPopup(popupHtml).addTo(monitorMarkersLayer);
                    }
                }
            });

            if (typeof tripRoutesLayer !== 'undefined' && routePoints.length > 1) {
                L.polyline(routePoints, {
                    color: cColor,
                    weight: 4,
                    dashArray: '6, 8',
                    opacity: 0.85
                }).addTo(tripRoutesLayer);
            }
        }
    });
}

function toggleHeatmap() {
    if (heatmapLayer) {
        map.removeLayer(heatmapLayer);
        heatmapLayer = null;
        return;
    }
    const points = [];
    if (typeof allCurrentTrips !== 'undefined') {
        allCurrentTrips.forEach(t => {
            if (t.destinations) {
                t.destinations.forEach(d => {
                    if (d.status === 'done' && isInsideJabodetabekArea(d.latitude, d.longitude)) {
                        points.push([d.latitude, d.longitude, 0.5]);
                    }
                });
            }
        });
    }
    if (points.length === 0) return showToast("No delivery data for heatmap.");
    heatmapLayer = L.heatLayer(points, { radius: 25, blur: 15 }).addTo(map);
    showToast("Heatmap Analytics Active");
}

window.gm_authFailure = function() {
    console.warn("Google Maps API Key Error / Disabled. Fallback to OpenStreetMap Active.");
    const input = document.getElementById('places-search');
    if (input) {
        input.classList.remove('pac-target-input');
    }
    const pacContainers = document.querySelectorAll('.pac-container');
    pacContainers.forEach(c => c.remove());
};

async function initAutocomplete() {
    try {
        const input = document.getElementById('places-search');
        if (!input) return;

        let autocomplete;
        if (window.google && google.maps && google.maps.places && google.maps.places.Autocomplete) {
            autocomplete = new google.maps.places.Autocomplete(input, {
                componentRestrictions: { country: "id" },
                bounds: new google.maps.LatLngBounds(
                    { lat: -6.8000, lng: 106.3000 },
                    { lat: -5.8000, lng: 107.5000 }
                ),
                strictBounds: true,
                fields: ["geometry", "name", "formatted_address"]
            });
        } else if (window.google && google.maps && google.maps.importLibrary) {
            const { Autocomplete } = await google.maps.importLibrary("places");
            if (Autocomplete) {
                autocomplete = new Autocomplete(input, {
                    componentRestrictions: { country: "id" },
                    bounds: new google.maps.LatLngBounds(
                        { lat: -6.8000, lng: 106.3000 },
                        { lat: -5.8000, lng: 107.5000 }
                    ),
                    strictBounds: true,
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
                        alert("LOKASI DILUAR WILAYAH JABODETABEK & KARAWANG!\nPengiriman hanya dibatasi untuk area Jabodetabek, Cikarang, Karawang, dan Tangerang.");
                        input.value = "";
                        return;
                    }

                    tripQueue.push({ name, address, lat, lng });
                    renderQueue();
                    input.value = "";
                    showToast("Lokasi ditambahkan ke rute!");
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

    showToast("Mencari koordinat lokasi...");

    try {
        if (window.google && google.maps && google.maps.Geocoder) {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ address: addressText, componentRestrictions: { country: "ID" } }, (results, status) => {
                if (status === "OK" && results && results[0]) {
                    const loc = results[0].geometry.location;
                    const lat = loc.lat();
                    const lng = loc.lng();
                    const formatted = results[0].formatted_address || addressText;
                    const parts = addressText.split(',');
                    const storeName = parts[0].trim();

                    if (!isInsideJabodetabekArea(lat, lng)) {
                        alert("LOKASI DILUAR WILAYAH JABODETABEK & KARAWANG!\nPengiriman hanya dibatasi untuk area Jabodetabek, Cikarang, Karawang, dan Tangerang.");
                        input.value = "";
                        return;
                    }

                    tripQueue.push({ name: storeName, address: formatted, lat, lng });
                    renderQueue();
                    input.value = "";
                    showToast("Lokasi berhasil ditambahkan!");
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
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressText)}&countrycodes=id&limit=1`;
        const res = await fetch(url);
        const data = await res.json();
        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lng = parseFloat(data[0].lon);
            const formatted = data[0].display_name;
            const parts = addressText.split(',');
            const storeName = parts[0].trim();

            if (!isInsideJabodetabekArea(lat, lng)) {
                alert("LOKASI DILUAR WILAYAH JABODETABEK & KARAWANG!\nPengiriman hanya dibatasi untuk area Jabodetabek, Cikarang, Karawang, dan Tangerang.");
                return;
            }

            tripQueue.push({ name: storeName, address: formatted, lat, lng });
            renderQueue();
            const input = document.getElementById('places-search');
            if (input) input.value = "";
            showToast("Lokasi berhasil ditambahkan!");
            if (mapDispatch) mapDispatch.flyTo([lat, lng], 16);
        } else {
            alert(`Lokasi "${addressText}" tidak ditemukan. Silakan perjelas nama toko / jalan / kota.`);
        }
    } catch(e) {
        alert("Gagal mencari lokasi. Periksa koneksi internet Anda.");
    }
}

window.addEventListener('load', () => {
    initMaps();
    initAutocomplete();
});
