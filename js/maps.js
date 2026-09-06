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

            map = L.map('map', { zoomControl: false }).setView([-6.2088, 106.8456], 12);
            L.control.zoom({ position: 'bottomright' }).addTo(map);
            L.tileLayer(googleTiles.url, googleTiles.options).addTo(map);
            tripMarkersLayer.addTo(map);
            tripRoutesLayer.addTo(map);
        }
        if (document.getElementById('map-monitor')) {
            if (mapMonitor) { mapMonitor.remove(); mapMonitor = null; }
            const containerMon = document.getElementById('map-monitor');
            if (containerMon && containerMon._leaflet_id) containerMon._leaflet_id = null;

            mapMonitor = L.map('map-monitor', { zoomControl: false }).setView([-6.2088, 106.8456], 12);
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

            mapDispatch = L.map('map-dispatch', { zoomControl: false }).setView([-6.2088, 106.8456], 12);
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

function toggleHeatmap() {
    if (heatmapLayer) {
        map.removeLayer(heatmapLayer);
        heatmapLayer = null;
        return;
    }
    const points = [];
    allCurrentTrips.forEach(t => {
        if (t.destinations) {
            t.destinations.forEach(d => {
                if (d.status === 'done') points.push([d.latitude, d.longitude, 0.5]);
            });
        }
    });
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
                fields: ["geometry", "name", "formatted_address"]
            });
        } else if (window.google && google.maps && google.maps.importLibrary) {
            const { Autocomplete } = await google.maps.importLibrary("places");
            if (Autocomplete) {
                autocomplete = new Autocomplete(input, {
                    componentRestrictions: { country: "id" },
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
