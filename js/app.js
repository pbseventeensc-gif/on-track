// ==========================================
// WTRACK LOGISTICS - CORE DASHBOARD & FIREBASE
// ==========================================

const firebaseConfig = {
    apiKey: "AIzaSyCAR9bhj6u72OpTqYLEuBvBGvCaaFSPUGQ",
    authDomain: "ontrack-fccb8.firebaseapp.com",
    databaseURL: "https://ontrack-fccb8-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "ontrack-fccb8",
    storageBucket: "ontrack-fccb8.firebasestorage.app",
    messagingSenderId: "180144218738",
    appId: "1:180144218738:web:f6751f383bf7f65b3ed8eb"
};

firebase.initializeApp(firebaseConfig);
const rtdb = firebase.database();
const db = firebase.firestore();
const storage = firebase.storage();
const auth = firebase.auth();

try {
    db.settings({ experimentalAutoDetectLongPolling: true });
} catch (e) {
    console.log("Firestore long polling settings info:", e);
}

const registeredUsers = {};
const userRoles = {};

let tripQueue = [];
let currentChatId = null;
let chatUnsub = null;
let lastLoadedHistory = [];
let allCurrentTrips = [];
let currentOnlineCouriers = {};
let activeFilter = "";
let isDarkMode = false;
let allClients = [];
let notificationItems = [];
let currentUserRole = "admin";

function getCourierColor(id) {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#6366f1'];
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

function isCourierUser(uid) {
    if (!uid) return false;
    const name = (registeredUsers[uid] || '').toLowerCase();
    const role = (userRoles[uid] || '').toLowerCase();

    if (role === 'trafik' || role === 'traffic' || role === 'admin' || role === 'staff') return false;
    if (name.includes('trafik') || name.includes('traffic') || name.includes('admin') || name.includes('staff')) return false;
    return true;
}

function toggleDarkMode() {
    isDarkMode = document.getElementById('dark-mode-toggle').checked;
    document.body.classList.toggle('dark-theme', isDarkMode);
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'position-fixed bottom-0 end-0 p-3';
    toast.style.zIndex = '9999';
    toast.innerHTML = `
        <div class="toast show bg-dark text-white rounded-3 shadow-lg p-3 extra-small">
            <i class="bi bi-info-circle me-2 text-warning"></i>${msg}
        </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function openPoDModal(url) {
    document.getElementById('modalImg').src = url;
    document.getElementById('downloadBtn').href = url;
    new bootstrap.Modal(document.getElementById('imageModal')).show();
}

function toggleNotifDropdown(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const dropdown = document.getElementById('notif-dropdown');
    if (!dropdown) return;

    const isHidden = dropdown.style.display === 'none' || dropdown.classList.contains('d-none');
    if (isHidden) {
        dropdown.classList.remove('d-none');
        dropdown.style.display = 'block';
        updateNotificationBell();
    } else {
        dropdown.classList.add('d-none');
        dropdown.style.display = 'none';
    }
}

document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('notif-dropdown');
    const btn = document.getElementById('notif-bell-btn');
    if (dropdown && (dropdown.style.display === 'block' || !dropdown.classList.contains('d-none'))) {
        if (!dropdown.contains(e.target) && (!btn || !btn.contains(e.target))) {
            dropdown.classList.add('d-none');
            dropdown.style.display = 'none';
        }
    }
});

function updateNotificationBell() {
    const listEl = document.getElementById('notif-list-container');
    const badgeEl = document.getElementById('notif-badge');
    const countTextEl = document.getElementById('notif-count-text');

    notificationItems = [];
    const now = Date.now();

    allCurrentTrips.forEach(t => {
        if (t.status === 'in_progress') {
            const lastUpdate = t.destinations ? t.destinations.filter(d => d.status === 'done' || d.status === 'arrived').reduce((max, d) => {
                const time = (d.completedTime || d.arrivalTime)?.seconds * 1000 || 0;
                return time > max ? time : max;
            }, (t.date?.seconds || 0) * 1000) : 0;

            if (lastUpdate > 0 && (now - lastUpdate > 30 * 60 * 1000)) {
                notificationItems.push({
                    type: 'danger',
                    icon: 'bi-clock-history',
                    title: `DELAY WARNING: ${t.id.substring(0,8)}`,
                    desc: `Tidak ada update > 30 menit`,
                    tab: 'monitor'
                });
            }
        }

        if (t.courierId && !currentOnlineCouriers[t.courierId] && t.status !== 'completed') {
            const courierName = registeredUsers[t.courierId] || 'Kurir';
            notificationItems.push({
                type: 'warning',
                icon: 'bi-person-x-fill',
                title: `KURIR OFFLINE`,
                desc: `${courierName} offline padahal ada tugas aktif`,
                tab: 'monitor'
            });
        }
    });

    const activeCount = allCurrentTrips.filter(t => t.status === 'in_progress' || t.status === 'assigned').length;
    if (activeCount > 0) {
        notificationItems.push({
            type: 'info',
            icon: 'bi-truck',
            title: `${activeCount} Pengiriman Aktif`,
            desc: `Ada ${activeCount} tugas pengiriman berjalan`,
            tab: 'dispatch'
        });
    }

    const totalCount = notificationItems.length;
    if (badgeEl) {
        if (totalCount > 0) {
            badgeEl.innerText = totalCount;
            badgeEl.classList.remove('d-none');
        } else {
            badgeEl.classList.add('d-none');
        }
    }

    if (countTextEl) {
        countTextEl.innerText = `${totalCount} Peringatan`;
    }

    if (!listEl) return;
    if (totalCount === 0) {
        listEl.innerHTML = '<div class="text-center py-4 text-muted extra-small"><i class="bi bi-check-circle fs-4 d-block mb-1 text-success"></i>Tidak ada peringatan baru. Semua lancar!</div>';
    } else {
        listEl.innerHTML = notificationItems.map(item => {
            const bgClass = item.type === 'danger' ? '#FEF2F2' : item.type === 'warning' ? '#FFFBEB' : '#F0F9FF';
            const iconColor = item.type === 'danger' ? 'text-danger' : item.type === 'warning' ? 'text-warning' : 'text-primary';
            return `
                <div class="p-3 border-bottom d-flex align-items-start gap-3 cursor-pointer" style="background: ${bgClass}; transition: 0.2s;" onclick="switchTab('${item.tab}', document.querySelector('[onclick*=\\'${item.tab}\\'\\]')); toggleNotifDropdown(event);">
                    <div class="${iconColor} fs-5 mt-1"><i class="bi ${item.icon}"></i></div>
                    <div class="flex-grow-1">
                        <div class="fw-bold extra-small text-dark">${item.title}</div>
                        <div class="extra-small text-muted" style="font-size: 0.7rem;">${item.desc}</div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

function updateDynamicAlerts() {
    const container = document.getElementById('priority-alerts');
    updateNotificationBell();
    if(!container) return;
    container.innerHTML = '';
    const now = Date.now();

    allCurrentTrips.forEach(t => {
        const cName = registeredUsers[t.courierId] || t.courierId.substring(0,8);
        const tripIdShort = '#' + t.id.substring(Math.max(0, t.id.length - 6));

        if(t.status === 'in_progress') {
            const lastUpdate = t.destinations ? t.destinations.filter(d => d.status === 'done' || d.status === 'arrived').reduce((max, d) => {
                const time = (d.completedTime || d.arrivalTime)?.seconds * 1000 || 0;
                return time > max ? time : max;
            }, (t.date?.seconds || 0) * 1000) : 0;

            if(now - lastUpdate > 30 * 60 * 1000) {
                container.innerHTML += `
                    <div class="d-flex gap-3 p-3 rounded-3" style="background: #FEF2F2;">
                        <div class="text-danger fs-4"><i class="bi bi-clock-history"></i></div>
                        <div>
                            <div class="fw-bold small text-dark">Delay: ${tripIdShort} (${cName})</div>
                            <div class="extra-small text-danger">Tidak ada pembaruan status > 30 menit</div>
                        </div>
                    </div>`;
            }
        }

        if(!currentOnlineCouriers[t.courierId] && t.status !== 'completed') {
            container.innerHTML += `
                <div class="d-flex gap-3 p-3 rounded-3" style="background: #FFFBEB;">
                    <div class="text-warning fs-4"><i class="bi bi-person-x"></i></div>
                    <div>
                        <div class="fw-bold small text-dark">Kurir Offline: ${cName}</div>
                        <div class="extra-small text-warning">Kurir offline tapi memiliki tugas aktif ${tripIdShort}</div>
                    </div>
                </div>`;
        }
    });

    if(container.innerHTML === '') {
        container.innerHTML = '<div class="text-center py-4 text-muted extra-small"><i class="bi bi-check-circle text-success me-1"></i> Tidak ada peringatan prioritas. Semua berjalan lancar.</div>';
    }
}

function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');

    if (window.innerWidth <= 991) {
        sb.classList.toggle('open');
        backdrop.classList.toggle('active');
    } else {
        toggleCollapse();
    }
}

function toggleCollapse() {
    const sb = document.getElementById('sidebar');
    sb.classList.toggle('collapsed');

    setTimeout(() => {
        if(typeof map !== 'undefined' && map && typeof map.invalidateSize === 'function') map.invalidateSize();
        if(typeof mapMonitor !== 'undefined' && mapMonitor && typeof mapMonitor.invalidateSize === 'function') mapMonitor.invalidateSize();
        if(typeof mapDispatch !== 'undefined' && mapDispatch && typeof mapDispatch.invalidateSize === 'function') mapDispatch.invalidateSize();
    }, 350);
}

function switchTab(viewId, el) {
    const isTraffic = (currentUserRole === 'trafik' || currentUserRole === 'traffic');
    if (isTraffic && (viewId === 'fleet' || viewId === 'reports' || viewId === 'settings')) {
        showToast("Akses dibatasi untuk akun Trafik.");
        return;
    }

    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    const target = document.getElementById('view-'+viewId);
    if(target) target.classList.add('active');

    document.querySelectorAll('.nav-link-custom').forEach(l => l.classList.remove('active'));

    if(el) el.classList.add('active');
    else {
        const navLink = document.querySelector(`[onclick*="'${viewId}'"]`);
        if(navLink) navLink.classList.add('active');
    }

    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-backdrop').classList.remove('active');

    setTimeout(() => {
        if(typeof map !== 'undefined' && map && typeof map.invalidateSize === 'function') map.invalidateSize();
        if(typeof mapMonitor !== 'undefined' && mapMonitor && typeof mapMonitor.invalidateSize === 'function') mapMonitor.invalidateSize();
        if(typeof mapDispatch !== 'undefined' && mapDispatch && typeof mapDispatch.invalidateSize === 'function') mapDispatch.invalidateSize();
    }, 400);

    if(viewId === 'chat') loadChatList();
    if(viewId === 'dispatch') loadClientsByRegion("");
}

function toggleAllClients(checked) {
    document.querySelectorAll('.client-checkbox').forEach(cb => cb.checked = checked);
}

async function loadClientsByRegion(region) {
    const container = document.getElementById('client-list-container');
    if(!container) return;
    const sa = document.getElementById('select-all-clients');
    if(sa) sa.checked = false;

    container.innerHTML = '<p class="text-center py-3 text-muted extra-small">Fetching clients...</p>';

    try {
        let query = db.collection('clients');
        if(region) query = query.where('region', '==', region);

        const snap = await query.get();
        allClients = [];
        container.innerHTML = '';

        document.getElementById('client-qty').innerText = snap.size;

        if(snap.empty) {
            container.innerHTML = '<p class="text-center py-3 text-muted extra-small">No clients found in this region.</p>';
            return;
        }

        snap.forEach(doc => {
            const c = doc.data();
            c.id = doc.id;
            allClients.push(c);

            const addressParts = c.address.split(',');
            const storeName = addressParts[0].trim();
            const remainingAddress = addressParts.slice(1).join(',').trim();

            const escName = c.name.replace(/"/g, '&quot;');
            const escStore = storeName.replace(/"/g, '&quot;');
            const escAddr = c.address.replace(/"/g, '&quot;');

            container.innerHTML += `
                <div class="d-flex align-items-center gap-2 mb-2 p-2 bg-white rounded border shadow-sm position-relative group-hover">
                    <input type="checkbox" class="client-checkbox"
                        data-name="${escStore}"
                        data-pt="${escName}"
                        data-address="${escAddr}"
                        data-lat="${c.latitude}"
                        data-lng="${c.longitude}">
                    <div class="overflow-hidden flex-grow-1">
                        <div class="fw-bold text-dark" style="font-size: 0.75rem; line-height: 1.2;">${storeName}</div>
                        <div class="text-muted mt-1" style="font-size: 0.65rem; font-weight: 600;">${c.name}</div>
                        <div class="text-muted text-truncate" style="font-size: 0.6rem; max-width: 180px;">${remainingAddress || c.address}</div>
                    </div>
                    <button class="btn btn-link text-danger p-1" data-id="${c.id}" data-store="${escStore}" onclick="deleteClient(this.dataset.id, this.dataset.store)">
                        <i class="bi bi-trash" style="font-size: 0.8rem;"></i>
                    </button>
                </div>
            `;
        });
    } catch (e) {
        console.error("Error loading clients:", e);
        container.innerHTML = '<p class="text-center py-3 text-danger extra-small">Error loading clients.</p>';
    }
}

function filterClients(query) {
    const q = query.toLowerCase().trim();
    const items = document.querySelectorAll('#client-list-container > div');
    let visibleCount = 0;

    if (!q) {
        items.forEach(item => {
            item.classList.remove('d-none');
            visibleCount++;
        });
        document.getElementById('client-qty').innerText = visibleCount;
        return;
    }

    const terms = q.split(/[\s,]+/).filter(t => t.length > 0);

    items.forEach(item => {
        const text = item.innerText.toLowerCase();
        const checkbox = item.querySelector('.client-checkbox');
        const nameAttr = checkbox ? (checkbox.getAttribute('data-name') || '').toLowerCase() : '';
        const ptAttr = checkbox ? (checkbox.getAttribute('data-pt') || '').toLowerCase() : '';
        const addressAttr = checkbox ? (checkbox.getAttribute('data-address') || '').toLowerCase() : '';

        const fullText = `${text} ${nameAttr} ${ptAttr} ${addressAttr}`;
        const isMatch = terms.every(term => fullText.includes(term));

        if (isMatch) {
            item.classList.remove('d-none');
            visibleCount++;
        } else {
            item.classList.add('d-none');
        }
    });
    document.getElementById('client-qty').innerText = visibleCount;
}

async function deleteClient(id, name) {
    if(!confirm(`Hapus client "${name}" dari database?`)) return;
    try {
        await db.collection('clients').doc(id).delete();
        showToast("Client berhasil dihapus.");
        loadClientsByRegion(document.getElementById('region-filter').value);
    } catch (e) {
        alert("Gagal menghapus client: " + e.message);
    }
}

async function clearAllClients() {
    if (!confirm("Hapus SELURUH database client? Semua data toko akan hilang.")) return;
    if (!confirm("APAKAH ANDA YAKIN? Tindakan ini tidak bisa dibatalkan.")) return;

    try {
        const snap = await db.collection('clients').get();
        if (snap.empty) return showToast("Database client sudah kosong.");

        const batch = db.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        showToast("Seluruh database client telah dikosongkan.");
        loadClientsByRegion(document.getElementById('region-filter').value);
    } catch (e) {
        alert("Gagal mengosongkan database client: " + e.message);
    }
}

function addSelectedClients() {
    const checked = document.querySelectorAll('.client-checkbox:checked');
    if(checked.length === 0) return alert("Please select at least one client!");

    let addedCount = 0;
    checked.forEach(cb => {
        const name = cb.getAttribute('data-name');
        const pt = cb.getAttribute('data-pt');
        const address = cb.getAttribute('data-address');
        const lat = parseFloat(cb.getAttribute('data-lat'));
        const lng = parseFloat(cb.getAttribute('data-lng'));

        if(name && address) {
            tripQueue.push({
                name: name + (pt ? " (" + pt + ")" : ""),
                address,
                lat,
                lng
            });
            addedCount++;
        }
        cb.checked = false;
    });

    const sa = document.getElementById('select-all-clients');
    if(sa) sa.checked = false;

    if(addedCount > 0) {
        renderQueue();
        showToast(addedCount + " destinations added to route!");
    }
}

db.collection('users').onSnapshot(snap => {
    snap.forEach(doc => {
        const u = doc.data();
        registeredUsers[doc.id] = u.name || doc.id.substring(0,8);
        userRoles[doc.id] = (u.role || 'courier').toLowerCase();
    });
    renderCourierOptions();
    renderManageCouriersList();
    if(document.getElementById('view-chat') && document.getElementById('view-chat').classList.contains('active')) loadChatList();
    refreshAllMonitorData();
});

function renderManageCouriersList() {
    const container = document.getElementById('manage-couriers-container');
    if (!container) return;
    container.innerHTML = '';

    let hasCouriers = false;
    for (const id in registeredUsers) {
        if (!isCourierUser(id)) continue;
        hasCouriers = true;
        const name = registeredUsers[id];
        container.innerHTML += `
            <div class="d-flex align-items-center justify-content-between p-3 border rounded-3 mb-2 bg-light">
                <div class="d-flex align-items-center gap-2">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(name)}" style="width:32px; border-radius:50%">
                    <div>
                        <div class="fw-bold extra-small text-dark">${name}</div>
                        <div class="extra-small text-muted" style="font-size:0.65rem;">ID: ${id.substring(0,8)}...</div>
                    </div>
                </div>
                <button class="btn btn-sm btn-outline-primary fw-semibold" data-id="${id}" data-name="${name.replace(/"/g, '&quot;')}" onclick="promptEditCourierName(this.dataset.id, this.dataset.name)">
                    <i class="bi bi-pencil me-1"></i> Edit Nama
                </button>
            </div>
        `;
    }
    if (!hasCouriers) {
        container.innerHTML = '<p class="text-center py-3 text-muted extra-small">Belum ada kurir terdaftar.</p>';
    }
}

async function promptEditCourierName(id, currentName) {
    const newName = prompt(`Masukkan nama baru untuk kurir "${currentName}":`, currentName);
    if (!newName || newName.trim() === "" || newName.trim() === currentName) return;

    try {
        await db.collection('users').doc(id).update({ name: newName.trim() });
        showToast("Nama kurir berhasil diperbarui!");
    } catch(e) {
        alert("Gagal memperbarui nama kurir: " + e.message);
    }
}

function renderCourierOptions() {
    const sel = document.getElementById('sel-courier'); if(!sel) return;
    sel.innerHTML = '<option value="">Select Carrier...</option>';
    for (const id in registeredUsers) {
        if (!isCourierUser(id)) continue;
        sel.innerHTML += `<option value="${id}">${registeredUsers[id]}</option>`;
    }
}

rtdb.ref('courier_live_location').on('value', snap => {
    currentOnlineCouriers = snap.val() || {};
    updateGlobalStats();
});

db.collection('trips').onSnapshot(snap => {
    allCurrentTrips = [];
    snap.forEach(doc => {
        const t = doc.data();
        t.id = doc.id;
        allCurrentTrips.push(t);

        if (t.destinations && t.destinations.length > 0) {
            syncDestinationsToMasterClients(t.destinations);
        }
    });
    updateGlobalStats();
    renderRecentShipments();
});

function updateGlobalStats() {
    let activeTrips = 0;
    let doneToday = 0;
    let delayedCount = 0;
    let inTransitCouriers = 0;
    let totalCompletedTrips = 0;
    let onTimeTrips = 0;
    let grandTotalKM = 0;

    let totalStops = 0;
    let deliveredStops = 0;
    let inTransitStops = 0;
    let pendingStops = 0;
    let returnedStops = 0;

    const couriersWithActiveTrip = new Set();

    allCurrentTrips.forEach(t => {
        if(t.status !== 'completed') {
            activeTrips++;
            couriersWithActiveTrip.add(t.courierId);

            const lastUpdate = t.destinations ? t.destinations.filter(d => d.status === 'done' || d.status === 'arrived').reduce((max, d) => {
                const time = (d.completedTime || d.arrivalTime)?.seconds * 1000 || 0;
                return time > max ? time : max;
            }, (t.date?.seconds || 0) * 1000) : 0;

            if(Date.now() - lastUpdate > 30 * 60 * 1000 && t.status === 'in_progress') {
                delayedCount++;
            }
        } else {
            totalCompletedTrips++;
            doneToday++;
            onTimeTrips++;
        }

        if(t.destinations) {
            t.destinations.forEach((d, i) => {
                totalStops++;
                if (d.status === 'done' || d.proofPhotoUrl) {
                    deliveredStops++;
                } else if (d.status === 'arrived') {
                    inTransitStops++;
                } else if (d.status === 'returned' || d.status === 'failed') {
                    returnedStops++;
                } else {
                    pendingStops++;
                }

                if(d.status === 'done' || d.proofPhotoUrl) {
                    const start = (i === 0)
                        ? ((t.acceptLatitude && t.acceptLongitude) ? { lat: t.acceptLatitude, lng: t.acceptLongitude } : { lat: t.destinations[0].latitude, lng: t.destinations[0].longitude })
                        : { lat: t.destinations[i-1].latitude, lng: t.destinations[i-1].longitude };
                    grandTotalKM += calculateDistance(start.lat, start.lng, d.latitude, d.longitude);
                }
            });
        }
    });

    for (const id in currentOnlineCouriers) {
        if (couriersWithActiveTrip.has(id)) {
            inTransitCouriers++;
        }
    }

    let totalStopsToday = 0;
    allCurrentTrips.forEach(t => {
        if (t.destinations && t.destinations.length > 0) {
            totalStopsToday += t.destinations.length;
        } else {
            totalStopsToday += 1;
        }
    });

    if(document.getElementById('stat-active')) document.getElementById('stat-active').innerText = activeTrips;
    if(document.getElementById('stat-done')) document.getElementById('stat-done').innerText = totalStopsToday;
    if(document.getElementById('stat-delayed')) document.getElementById('stat-delayed').innerText = delayedCount;
    if(document.getElementById('stat-transit-count')) document.getElementById('stat-transit-count').innerText = inTransitCouriers;
    if(document.getElementById('stat-total-km')) document.getElementById('stat-total-km').innerText = grandTotalKM.toFixed(1) + " km";

    const safeTotal = totalStops > 0 ? totalStops : 1;
    const pctDelivered = Math.round((deliveredStops / safeTotal) * 100);
    const pctTransit = Math.round((inTransitStops / safeTotal) * 100);
    const pctPending = Math.round((pendingStops / safeTotal) * 100);
    const pctReturned = Math.round((returnedStops / safeTotal) * 100);

    if(document.getElementById('pct-delivered')) document.getElementById('pct-delivered').innerText = pctDelivered + "%";
    if(document.getElementById('pbar-delivered')) document.getElementById('pbar-delivered').style.width = pctDelivered + "%";

    if(document.getElementById('pct-transit')) document.getElementById('pct-transit').innerText = pctTransit + "%";
    if(document.getElementById('pbar-transit')) document.getElementById('pbar-transit').style.width = pctTransit + "%";

    if(document.getElementById('pct-pending')) document.getElementById('pct-pending').innerText = pctPending + "%";
    if(document.getElementById('pbar-pending')) document.getElementById('pbar-pending').style.width = pctPending + "%";

    if(document.getElementById('pct-returned')) document.getElementById('pct-returned').innerText = pctReturned + "%";
    if(document.getElementById('pbar-returned')) document.getElementById('pbar-returned').style.width = pctReturned + "%";

    const onTimeRate = totalCompletedTrips > 0 ? Math.round((onTimeTrips / totalCompletedTrips) * 100) : 100;
    if(document.getElementById('stat-ontime')) document.getElementById('stat-ontime').innerText = onTimeRate + "%";

    refreshAllMonitorData();
    updateDynamicAlerts();
}

function refreshAllMonitorData() {
    renderMonitorUI(activeFilter);
    if (typeof updateMapMarkers === 'function') updateMapMarkers(activeFilter);
    updateMonitorSuggestions();
    if (typeof renderKPIView === 'function') renderKPIView();
}

function renderQueue() {
    const queueEl = document.getElementById('dispatch-queue');
    const badgeEl = document.getElementById('queue-count-badge');

    if (badgeEl) {
        badgeEl.innerText = `${tripQueue.length} Total Destinasi`;
    }

    if (queueEl) {
        if (tripQueue.length === 0) {
            queueEl.innerHTML = '<div class="text-center py-4 text-muted extra-small"><i class="bi bi-box-arrow-in-down me-1"></i> Belum ada titik pengantaran yang ditambahkan ke rute.</div>';
        } else {
            queueEl.innerHTML = tripQueue.map((d, i) => `
                <div class="d-flex align-items-center justify-content-between p-2 bg-light border rounded-3 shadow-2fs mb-1">
                    <div class="d-flex align-items-center gap-2 overflow-hidden flex-grow-1">
                        <span class="badge bg-primary text-white fw-bold rounded-circle flex-shrink-0" style="width:24px; height:24px; display:flex; align-items:center; justify-content:center; font-size:0.75rem;">${i+1}</span>
                        <div class="overflow-hidden">
                            <div class="fw-bold text-dark text-truncate" style="font-size: 0.8rem;">${d.name}</div>
                            ${d.address ? `<div class="text-muted extra-small text-truncate">${d.address}</div>` : ''}
                        </div>
                    </div>
                    <button class="btn btn-sm btn-link text-danger p-1 ms-2 flex-shrink-0" onclick="tripQueue.splice(${i},1);renderQueue()" title="Hapus dari Rute">
                        <i class="bi bi-x-circle fs-6"></i>
                    </button>
                </div>
            `).join('');
        }
    }

    if (typeof draftMarkersLayer !== 'undefined' && draftMarkersLayer) {
        draftMarkersLayer.clearLayers();
        tripQueue.forEach((d, i) => {
            const icon = L.divIcon({ className:'custom-div-icon', html:`<div class='marker-pin' style='background:#F59E0B'></div><div class='marker-num'>${i+1}</div>`, iconSize:[30,42], iconAnchor:[15,42] });
            L.marker([d.lat, d.lng], {icon}).addTo(draftMarkersLayer);
        });
    }
}

async function submitTrip() {
    const cid = document.getElementById('sel-courier').value;
    if(!cid || tripQueue.length===0) return alert("Select carrier and destination!");
    const id = "TRIP_" + Date.now();
    await db.collection('trips').doc(id).set({
        tripId: id,
        courierId: cid,
        status: "assigned",
        date: firebase.firestore.Timestamp.now(),
        destinations: tripQueue.map((d,i) => ({
            stopIndex: i+1,
            locationName: d.name,
            address: d.address,
            latitude: d.lat,
            longitude: d.lng,
            status: "pending",
            proofPhotoUrl: ""
        }))
    });

    syncDestinationsToMasterClients(tripQueue);

    tripQueue = [];
    renderQueue();
    document.getElementById('sel-courier').value = "";
    showToast("Shipment dispatched!");
}

async function syncDestinationsToMasterClients(destinations) {
    if (!destinations || destinations.length === 0) return;

    try {
        for (const d of destinations) {
            const name = d.locationName || d.name || "";
            const address = d.address || "";
            const lat = parseFloat(d.latitude !== undefined ? d.latitude : (d.lat !== undefined ? d.lat : 0));
            const lng = parseFloat(d.longitude !== undefined ? d.longitude : (d.lng !== undefined ? d.lng : 0));

            if (!name || !lat || !lng) continue;

            let region = "Auto-detected";
            const addrLower = address.toLowerCase();
            if (addrLower.includes("jakarta barat")) region = "Jakarta Barat";
            else if (addrLower.includes("jakarta pusat")) region = "Jakarta Pusat";
            else if (addrLower.includes("jakarta selatan")) region = "Jakarta Selatan";
            else if (addrLower.includes("jakarta timur")) region = "Jakarta Timur";
            else if (addrLower.includes("jakarta utara")) region = "Jakarta Utara";
            else if (addrLower.includes("bogor")) region = "Bogor";
            else if (addrLower.includes("cikarang")) region = "Cikarang";
            else if (addrLower.includes("tangerang")) region = "Tangerang";
            else if (addrLower.includes("bekasi")) region = "Bekasi";

            const clientDocId = "CLIENT_" + name.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();

            await db.collection('clients').doc(clientDocId).set({
                name: name,
                address: address,
                latitude: lat,
                longitude: lng,
                region: region,
                updatedAt: firebase.firestore.Timestamp.now()
            }, { merge: true });
        }
    } catch (e) {
        console.error("Error auto-syncing clients to Master DB:", e);
    }
}

async function deleteTrip(tripId) {
    if (!confirm("Hapus tugas pengiriman ini dari sistem?")) return;
    try {
        await db.collection('trips').doc(tripId).delete();
        showToast("Tugas berhasil dihapus.");
        if (document.getElementById('view-reports')?.classList.contains('active')) loadFullHistory();
    } catch(e) {
        alert("Gagal menghapus tugas: " + e.message);
    }
}

function filterRecentTable() {
    renderRecentShipments();
}

function updateMonitorSuggestions() {
    const dl = document.getElementById('monitor-datalist');
    if(!dl) return;
    const items = new Set();

    for (const id in registeredUsers) {
        if (!isCourierUser(id)) continue;
        const name = registeredUsers[id];
        const hasActive = allCurrentTrips.some(t => t.courierId === id && t.status !== 'completed');
        if (hasActive || currentOnlineCouriers[id]) {
            items.add(name);
        }
    }

    allCurrentTrips.forEach(t => {
        if(t.status !== 'completed') {
            items.add(t.id);
            if (t.destinations) {
                t.destinations.forEach(d => items.add(d.locationName));
            }
        }
    });

    dl.innerHTML = Array.from(items).map(i => `<option value="${i}">`).join('');
}

function renderMonitorUI(filter = "") {
    const mList = document.getElementById('monitor-list');
    if(!mList) return;
    mList.innerHTML = '';

    const search = filter.toLowerCase();

    const courierGroups = {};
    allCurrentTrips.forEach(t => {
        if(t.status === 'completed') return;
        const cId = t.courierId;
        const cName = registeredUsers[cId] || cId.substring(0,8);
        const clients = t.destinations ? t.destinations.map(d => d.locationName.toLowerCase()).join(" ") : "";

        if (cName.toLowerCase().includes(search) || t.id.toLowerCase().includes(search) || clients.includes(search)) {
            if (!courierGroups[cId]) {
                courierGroups[cId] = { id: cId, name: cName, trips: [], totalStops: 0, doneStops: 0 };
            }
            courierGroups[cId].trips.push(t);
            if (t.destinations) {
                courierGroups[cId].totalStops += t.destinations.length;
                courierGroups[cId].doneStops += t.destinations.filter(d => d.status === 'done').length;
            }
        }
    });

    const courierIds = Object.keys(courierGroups);
    if(courierIds.length === 0) {
        mList.innerHTML = '<div class="col-12 text-center p-5 text-muted">No active couriers matching filter.</div>';
        return;
    }

    courierIds.forEach(cId => {
        const c = courierGroups[cId];
        const cColor = getCourierColor(c.id);
        const progress = Math.round((c.doneStops / c.totalStops) * 100) || 0;
        const isOnline = currentOnlineCouriers[c.id];

        mList.innerHTML += `
            <div class="col-md-6 col-xl-4">
                <div class="border rounded-4 p-4 bg-white shadow-sm h-100" style="border-top: 4px solid ${cColor} !important">
                    <div class="d-flex justify-content-between align-start mb-3">
                        <div class="d-flex align-items-center gap-3">
                            <img src="https://ui-avatars.com/api/?name=${c.name}&background=${cColor.replace('#','')}&color=fff" style="width:40px;height:40px;border-radius:12px;">
                            <div>
                                <div class="fw-bold mb-0" style="font-size:1rem">${c.name}</div>
                                <small class="${isOnline ? 'text-success' : 'text-muted'} fw-bold" style="font-size:0.7rem">
                                    <i class="bi bi-circle-fill me-1" style="font-size: 6px"></i> ${isOnline ? 'ONLINE' : 'OFFLINE'}
                                </small>
                            </div>
                        </div>
                        <span class="badge rounded-pill bg-light text-dark border small" style="font-size:0.65rem">${c.trips.length} Active Trips</span>
                    </div>

                    <div class="mb-4">
                        <div class="d-flex justify-content-between small mb-2">
                            <span class="text-muted fw-bold">Overall Progress</span>
                            <span class="fw-bold text-dark">${c.doneStops}/${c.totalStops} Stops</span>
                        </div>
                        <div class="progress" style="height: 8px; border-radius: 10px; background: #F1F5F9">
                            <div class="progress-bar progress-bar-striped progress-bar-animated" style="width: ${progress}%; background: ${cColor}; border-radius: 10px;"></div>
                        </div>
                    </div>

                    <button class="btn btn-sm btn-dark w-100 py-2 fw-bold" style="border-radius: 10px; font-size:0.85rem" data-id="${c.id}" onclick="focusOnCourier(this.dataset.id, true)">
                        <i class="bi bi-geo-alt-fill me-1"></i> FOCUS TRACKING
                    </button>
                </div>
            </div>`;
    });
}

function filterMonitorAll(val) {
    activeFilter = val;
    refreshAllMonitorData();

    for (const id in registeredUsers) {
        if (registeredUsers[id].toLowerCase() === val.toLowerCase()) {
            focusOnCourier(id, true);
            break;
        }
    }
}

function focusOnCourier(id, isMonitor = false) {
    const targetMap = isMonitor ? mapMonitor : map;
    if (!targetMap) return;

    let targetPos = null;

    if (currentOnlineCouriers[id]) {
        targetPos = [currentOnlineCouriers[id].lat, currentOnlineCouriers[id].lng];
    } else {
        const trip = allCurrentTrips.find(t => t.courierId === id && t.status !== 'completed');
        if (trip && trip.destinations && trip.destinations.length > 0) {
            targetPos = [trip.destinations[0].latitude, trip.destinations[0].longitude];
        }
    }

    if (targetPos) {
        targetMap.flyTo(targetPos, 16, { duration: 1.5 });
        if (isMonitor) {
            switchTab('fleet', document.querySelector('[onclick*="fleet"]'));
        }
    } else {
        showToast("Lokasi kurir belum tersedia di peta.");
    }
}

function renderRecentShipments(filter = "") {
    const table = document.getElementById('recent-shipments-table');
    if(!table) return;
    table.innerHTML = '';

    const search = (typeof filter === 'string' ? filter : (document.getElementById('recent-shipment-search')?.value || "")).toLowerCase();
    const selectedStatus = document.getElementById('recent-status-filter')?.value || "all";
    const shipmentRows = [];

    allCurrentTrips.forEach(t => {
        const cName = registeredUsers[t.courierId] || t.courierId.substring(0,8);
        const tripIdShort = '#' + t.id.substring(Math.max(0, t.id.length - 6));
        const tripDateStr = t.date ? new Date(t.date.seconds * 1000).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : '-';

        if (t.destinations && t.destinations.length > 0) {
            t.destinations.forEach((d, idx) => {
                const locName = d.locationName || 'Destination';
                const fullAddress = d.address || '';
                const status = (d.status === 'done' || d.proofPhotoUrl) ? 'completed' : (d.status === 'arrived' ? 'in_progress' : t.status);
                const statusClass = status === 'completed' ? 'delivered' : (status === 'assigned' ? 'pending' : 'transit');

                let timeStr = 'Finished';
                if (status !== 'completed') {
                    if (d.arrivalTime) {
                        timeStr = new Date(d.arrivalTime.seconds * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                    } else {
                        timeStr = 'In Transit';
                    }
                } else if (d.completedTime) {
                    timeStr = new Date(d.completedTime.seconds * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                }

                const matchSearch = tripIdShort.toLowerCase().includes(search) ||
                                   locName.toLowerCase().includes(search) ||
                                   fullAddress.toLowerCase().includes(search) ||
                                   cName.toLowerCase().includes(search) ||
                                   status.toLowerCase().includes(search) ||
                                   tripDateStr.toLowerCase().includes(search);

                const matchStatus = (selectedStatus === 'all') || (status === selectedStatus);

                if (matchSearch && matchStatus) {
                    shipmentRows.push({
                        tripId: t.id,
                        displayId: tripIdShort,
                        dateStr: tripDateStr,
                        stopIndex: d.stopIndex || (idx + 1),
                        destinationName: locName,
                        fullAddress: fullAddress,
                        status: status,
                        statusClass: statusClass,
                        carrier: cName,
                        eta: timeStr,
                        proofUrl: d.proofPhotoUrl || ''
                    });
                }
            });
        } else {
            const matchSearch = tripIdShort.toLowerCase().includes(search) || cName.toLowerCase().includes(search) || tripDateStr.toLowerCase().includes(search);
            const matchStatus = (selectedStatus === 'all') || (t.status === selectedStatus);
            if (matchSearch && matchStatus) {
                shipmentRows.push({
                    tripId: t.id,
                    displayId: tripIdShort,
                    dateStr: tripDateStr,
                    stopIndex: 1,
                    destinationName: 'TBD',
                    fullAddress: '',
                    status: t.status,
                    statusClass: t.status === 'completed' ? 'delivered' : 'pending',
                    carrier: cName,
                    eta: t.status === 'completed' ? 'Finished' : 'Pending',
                    proofUrl: ''
                });
            }
        }
    });

    const totalBadge = document.getElementById('recent-shipments-total-badge');
    if (totalBadge) {
        totalBadge.innerText = `${shipmentRows.length} Total`;
    }

    if (shipmentRows.length === 0) {
        table.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted extra-small">Tidak ada data pengantaran matching filter.</td></tr>`;
        return;
    }

    shipmentRows.reverse().slice(0, 50).forEach(s => {
        const podIcon = s.proofUrl ? `<i class="bi bi-camera text-primary ms-2 cursor-pointer" data-url="${s.proofUrl}" onclick="openPoDModal(this.dataset.url)" title="Lihat Foto PoD"></i>` : '';
        table.innerHTML += `<tr>
            <td class="fw-normal text-muted extra-small">${s.dateStr}</td>
            <td class="fw-normal text-dark">${s.displayId} ${podIcon}</td>
            <td>
                <div class="fw-normal text-dark">${s.destinationName}</div>
                ${s.fullAddress ? `<small class="text-muted extra-small d-block text-truncate fw-normal" style="max-width:240px">${s.fullAddress}</small>` : ''}
            </td>
            <td><span class="badge-pill badge-${s.statusClass} fw-normal">${s.status}</span></td>
            <td class="fw-normal text-dark">${s.carrier}</td>
            <td><small class="fw-normal text-secondary">${s.eta}</small></td>
            <td>
                <button class="btn btn-sm btn-light border text-danger" data-id="${s.tripId}" onclick="deleteTrip(this.dataset.id)" title="Hapus Trip">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>`;
    });
}

function exportRecentShipmentsToExcel() {
    const exportData = [];

    allCurrentTrips.forEach(t => {
        const cName = registeredUsers[t.courierId] || t.courierId.substring(0,8);
        const tripIdShort = '#' + t.id.substring(Math.max(0, t.id.length - 6));

        if (t.destinations && t.destinations.length > 0) {
            t.destinations.forEach((d, idx) => {
                const status = (d.status === 'done' || d.proofPhotoUrl) ? 'completed' : d.status;
                const arrivalStr = d.arrivalTime ? new Date(d.arrivalTime.seconds * 1000).toLocaleString() : '-';
                const completedStr = d.completedTime ? new Date(d.completedTime.seconds * 1000).toLocaleString() : '-';

                exportData.push({
                    "Shipment ID": tripIdShort,
                    "Trip Full ID": t.id,
                    "Courier": cName,
                    "Stop #": d.stopIndex || (idx + 1),
                    "Origin": "Warehouse",
                    "Destination Name": d.locationName || 'TBD',
                    "Full Address": d.address || '-',
                    "Status": status,
                    "Arrival Time": arrivalStr,
                    "Completed Time": completedStr,
                    "Proof Photo URL": d.proofPhotoUrl || '-'
                });
            });
        }
    });

    if (exportData.length === 0) return alert("Tidak ada data pengantaran untuk diekspor!");

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Recent Shipments");
    XLSX.writeFile(wb, `Wtrack_Recent_Shipments_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function loadFullHistory() {
    const tbody = document.getElementById('report-history-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const startVal = document.getElementById('rep-start-date')?.value;
    const endVal = document.getElementById('rep-end-date')?.value;
    const courierVal = document.getElementById('rep-courier-filter')?.value || 'all';
    const statusVal = document.getElementById('rep-status-filter')?.value || 'all';

    let filtered = allCurrentTrips;

    if (startVal || endVal) {
        const startMs = startVal ? new Date(startVal).setHours(0,0,0,0) : 0;
        const endMs = endVal ? new Date(endVal).setHours(23,59,59,999) : Infinity;

        filtered = filtered.filter(t => {
            const tripMs = t.date?.seconds ? t.date.seconds * 1000 : 0;
            return tripMs >= startMs && tripMs <= endMs;
        });
    }

    if (courierVal !== 'all') {
        filtered = filtered.filter(t => t.courierId === courierVal);
    }

    if (statusVal !== 'all') {
        filtered = filtered.filter(t => t.status === statusVal);
    }

    lastLoadedHistory = filtered;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted extra-small">Tidak ada riwayat pengantaran sesuai filter.</td></tr>`;
        return;
    }

    filtered.forEach(t => {
        const cName = registeredUsers[t.courierId] || t.courierId.substring(0,8);
        const dateStr = t.date ? new Date(t.date.seconds * 1000).toLocaleString('id-ID') : '-';
        const totalStops = t.destinations ? t.destinations.length : 1;
        const doneStops = t.destinations ? t.destinations.filter(d => d.status === 'done' || d.proofPhotoUrl).length : (t.status === 'completed' ? 1 : 0);

        tbody.innerHTML += `<tr>
            <td class="fw-bold">${t.id.substring(0,10)}</td>
            <td>${cName}</td>
            <td><span class="fw-bold">${doneStops}</span> / ${totalStops} Titik</td>
            <td>${dateStr}</td>
            <td><span class="badge bg-dark">${t.status.toUpperCase()}</span></td>
            <td>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteTrip('${t.id}')">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>`;
    });
}

function exportFullReportsToExcel() {
    if (!lastLoadedHistory || lastLoadedHistory.length === 0) return alert("Tidak ada data laporan untuk diekspor!");

    const exportData = [];
    lastLoadedHistory.forEach(t => {
        const cName = registeredUsers[t.courierId] || t.courierId.substring(0,8);
        const dateStr = t.date ? new Date(t.date.seconds * 1000).toLocaleString('id-ID') : '-';

        if (t.destinations && t.destinations.length > 0) {
            t.destinations.forEach((d, idx) => {
                exportData.push({
                    "Trip ID": t.id,
                    "Courier": cName,
                    "Date": dateStr,
                    "Stop Index": d.stopIndex || (idx + 1),
                    "Location Name": d.locationName || 'TBD',
                    "Address": d.address || '-',
                    "Stop Status": d.status || 'pending',
                    "Trip Status": t.status,
                    "Proof URL": d.proofPhotoUrl || '-'
                });
            });
        }
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Full Reports");
    XLSX.writeFile(wb, `Wtrack_Full_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
}

async function clearAllHistory() {
    if (!confirm("Hapus SELURUH riwayat pengantaran? Tindakan ini tidak bisa dibatalkan.")) return;
    if (!confirm("APAKAH ANDA YAKIN? Semua data pengantaran akan hilang selamanya.")) return;

    try {
        const snap = await db.collection('trips').get();
        if (snap.empty) return showToast("Tidak ada riwayat untuk dihapus.");

        const batch = db.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        showToast("Semua riwayat berhasil dikosongkan.");
        loadFullHistory();
    } catch (e) {
        alert("Gagal menghapus riwayat: " + e.message);
    }
}

async function importClientsFromExcel() {
    const file = document.getElementById('client-excel-file').files[0];
    if(!file) return alert("Please select an Excel file first!");

    const progress = document.getElementById('import-progress');
    const status = document.getElementById('import-status');
    progress.classList.remove('d-none');
    status.innerText = "Reading file...";

    const reader = new FileReader();
    reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);

        if(rows.length === 0) {
            alert("Excel file is empty!");
            progress.classList.add('d-none');
            return;
        }

        status.innerText = `Processing ${rows.length} clients...`;
        const batch = db.batch();
        const geocoder = new google.maps.Geocoder();

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const name = (row.Customer || row.Name || row.name || row.CUSTOMER || "").toString().trim();
            let address = (row['Alamat SJ'] || row.Address || row.address || row.ALAMAT || "").toString().trim();
            const region = (row.Region || row.region || row.REGION || "").toString().trim();

            if(!name) continue;

            const regionSuffix = region ? `, ${region}` : ", Jabodetabek";
            const searchQuery = address ? `${address}${regionSuffix}, Indonesia` : `${name}${regionSuffix}, Indonesia`;

            try {
                const geoResult = await new Promise((resolve) => {
                    geocoder.geocode({ address: searchQuery }, (results, status) => {
                        if (status === 'OK') {
                            resolve({
                                location: results[0].geometry.location,
                                fullAddress: results[0].formatted_address
                            });
                        } else {
                            resolve(null);
                        }
                    });
                });

                const finalAddress = (address.length < 5 && geoResult) ? geoResult.fullAddress : (address || (geoResult ? geoResult.fullAddress : "Alamat tidak ditemukan"));

                const ref = db.collection('clients').doc();
                batch.set(ref, {
                    name: name,
                    region: region || (geoResult ? "Auto-detected" : "General"),
                    address: finalAddress,
                    latitude: geoResult ? geoResult.location.lat() : 0,
                    longitude: geoResult ? geoResult.location.lng() : 0,
                    createdAt: firebase.firestore.Timestamp.now()
                });

            } catch (err) {
                console.error("Critical error at row:", i, err);
            }

            const pct = Math.round(((i + 1) / rows.length) * 100);
            progress.querySelector('.progress-bar').style.width = pct + '%';
            status.innerText = `Importing: ${pct}% (${i+1}/${rows.length})`;
        }

        await batch.commit();
        status.innerHTML = `<span class="text-success">SUCCESS! ${rows.length} Clients synced to database.</span>`;
        setTimeout(() => progress.classList.add('d-none'), 2000);
        showToast("Clients Database Updated!");
    };
    reader.readAsArrayBuffer(file);
}

async function updateConfig() {
    const v = document.getElementById('cfg-interval').value, u = document.getElementById('cfg-time-unit').value, g = document.getElementById('cfg-geofence').value;
    await db.collection('config').doc('tracking').set({ intervalMs: v * u, geofenceRadius: parseFloat(g), updatedAt: firebase.firestore.Timestamp.now() }, { merge: true });
    showToast("System updated.");
}

async function publishUpdateAuto() {
    const v = document.getElementById('upd-version').value, f = document.getElementById('upd-file').files[0];
    if (!v || !f) return alert("Select version and file!");
    const prog = document.getElementById('upd-progress'); prog.classList.remove('d-none');
    const task = storage.ref('updates/' + f.name).put(f);
    task.on('state_changed', s => { prog.querySelector('.progress-bar').style.width = (s.bytesTransferred/s.totalBytes)*100 + '%'; }, e => alert(e.message), async () => {
        const url = await task.snapshot.ref.getDownloadURL();
        await db.collection('config').doc('app_status').set({ versionCode: parseInt(v), downloadUrl: url, updatedAt: firebase.firestore.Timestamp.now() }, { merge: true });
        showToast("Update published!"); prog.classList.add('d-none');
    });
}

function loadChatList(filter = "") {
    const container = document.getElementById('chat-list-container') || document.getElementById('chat-courier-list');
    if (!container) return;
    container.innerHTML = '';

    for (const id in registeredUsers) {
        if (!isCourierUser(id)) continue;
        const name = registeredUsers[id];
        if (filter && !name.toLowerCase().includes(filter.toLowerCase())) continue;

        const isOnline = currentOnlineCouriers[id];

        container.innerHTML += `
            <div class="p-3 border rounded-3 cursor-pointer d-flex justify-content-between align-items-center bg-white mb-2 shadow-2fs" onclick="openChat('${id}', '${name.replace(/'/g, "\\'")}')">
                <div class="d-flex align-items-center gap-2">
                    <div class="position-relative">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=111827&color=fff" style="width:32px; border-radius:50%">
                        <span class="position-absolute bottom-0 end-0 p-1 ${isOnline ? 'bg-success' : 'bg-secondary'} border border-light rounded-circle" style="width:8px; height:8px;"></span>
                    </div>
                    <div>
                        <span class="fw-semibold text-dark extra-small">${name}</span>
                        <small class="d-block text-muted" style="font-size:0.65rem;">${isOnline ? 'Online' : 'Offline'}</small>
                    </div>
                </div>
                <i class="bi bi-chevron-right text-muted"></i>
            </div>
        `;
    }
}

function filterCourierChat(val) {
    loadChatList(val);
}

function openChat(id, name) {
    currentChatId = id;
    const headerEl = document.getElementById('chat-header-main') || document.getElementById('chat-header-name');
    if (headerEl) headerEl.innerText = name;

    if (chatUnsub) chatUnsub();

    const box = document.getElementById('chat-messages-main') || document.getElementById('chat-messages-box');
    if (!box) return;
    box.innerHTML = '<p class="text-center py-4 text-muted extra-small">Loading messages...</p>';

    const col = db.collection('chats').doc(id).collection('messages');
    chatUnsub = col.orderBy('timestamp', 'asc').onSnapshot(snap => {
        box.innerHTML = '';
        snap.forEach(doc => {
            const m = doc.data();
            const isAdmin = m.senderRole === 'admin' || m.senderId === 'admin';
            box.innerHTML += `
                <div class="bubble ${isAdmin ? 'admin' : 'courier'}">
                    ${m.text}
                </div>
            `;
        });
        box.scrollTop = box.scrollHeight;
    });
}

function sendChatMain() {
    const input = document.getElementById('chat-input-main') || document.getElementById('chat-input-text');
    if (!input || !currentChatId) return;
    const text = input.value.trim();
    if (!text) return;

    db.collection('chats').doc(currentChatId).collection('messages').add({
        senderId: 'admin',
        senderRole: 'admin',
        text: text,
        timestamp: firebase.firestore.Timestamp.now()
    });

    input.value = '';
}

async function handleLogin(e) {
    if(e) e.preventDefault();
    const emailEl = document.getElementById('login-email');
    const passEl = document.getElementById('login-password') || document.getElementById('login-pass');
    const err = document.getElementById('login-error');
    const btn = document.getElementById('btn-login-submit');

    if (!emailEl || !passEl) return;

    const email = emailEl.value.trim();
    const pass = passEl.value;

    if (err) err.classList.add('d-none');

    if (!email || !pass) {
        if (err) {
            err.innerText = "Email dan password wajib diisi.";
            err.classList.remove('d-none');
        }
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerText = "SIGNING IN...";
    }

    try {
        await auth.signInWithEmailAndPassword(email, pass);
    } catch (e) {
        if (btn) {
            btn.disabled = false;
            btn.innerText = "SIGN IN";
        }
        if (err) {
            err.innerText = "Login Gagal: " + e.message;
            err.classList.remove('d-none');
        } else {
            alert("Login Gagal: " + e.message);
        }
    }
}

auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-wrapper').style.display = 'flex';

        db.collection('users').doc(user.uid).get().then(doc => {
            if (doc.exists) {
                const uData = doc.data();
                const uRole = (uData.role || 'admin').toLowerCase();
                currentUserRole = uRole;

                const profileName = document.getElementById('profile-name');
                const profileRole = document.getElementById('profile-role');
                if (profileName) profileName.innerText = "admin";
                if (profileRole) profileRole.innerHTML = '<span class="d-inline-block rounded-circle bg-success me-1" style="width: 7px; height: 7px;"></span>Online';
            }
        });

        setTimeout(() => {
            if (typeof initMaps === 'function') initMaps();
            if (typeof map !== 'undefined' && map && typeof map.invalidateSize === 'function') map.invalidateSize();
            if (typeof mapMonitor !== 'undefined' && mapMonitor && typeof mapMonitor.invalidateSize === 'function') mapMonitor.invalidateSize();
            if (typeof mapDispatch !== 'undefined' && mapDispatch && typeof mapDispatch.invalidateSize === 'function') mapDispatch.invalidateSize();
        }, 300);
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('main-wrapper').style.display = 'none';
    }
});

function handleLogout() {
    if (confirm("Sign out dari dashboard?")) {
        auth.signOut().then(() => {
            window.location.reload();
        }).catch(err => {
            alert("Logout error: " + err.message);
        });
    }
}

function logout() {
    handleLogout();
}
