// ==========================================
// WTRACK LOGISTICS - CORE DASHBOARD & FIREBASE
// ==========================================

var firebaseConfig = window.firebaseConfig || {
    apiKey: "AIzaSyCAR9bhj6u72OpTqYLEuBvBGvCaaFSPUGQ",
    authDomain: "ontrack-fccb8.firebaseapp.com",
    databaseURL: "https://ontrack-fccb8-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "ontrack-fccb8",
    storageBucket: "ontrack-fccb8.firebasestorage.app",
    messagingSenderId: "180144218738",
    appId: "1:180144218738:web:f6751f383bf7f65b3ed8eb"
};

function ensureFirebaseApp() {
    if (typeof firebase !== 'undefined') {
        if (!firebase.apps || firebase.apps.length === 0) {
            firebase.initializeApp(firebaseConfig);
        }
        return firebase;
    }
    return null;
}

ensureFirebaseApp();

function getAuth() {
    if (typeof window.auth !== 'undefined' && window.auth) return window.auth;
    if (typeof firebase !== 'undefined' && firebase.auth) {
        window.auth = firebase.auth();
        return window.auth;
    }
    return null;
}
function getDb() {
    if (typeof window.db !== 'undefined' && window.db) return window.db;
    if (typeof firebase !== 'undefined' && firebase.firestore) {
        window.db = firebase.firestore();
        return window.db;
    }
    return null;
}
function getRtdb() {
    if (typeof window.rtdb !== 'undefined' && window.rtdb) return window.rtdb;
    if (typeof firebase !== 'undefined' && firebase.database) {
        window.rtdb = firebase.database();
        return window.rtdb;
    }
    return null;
}
function getStorage() {
    if (typeof window.storage !== 'undefined' && window.storage) return window.storage;
    if (typeof firebase !== 'undefined' && firebase.storage) {
        window.storage = firebase.storage();
        return window.storage;
    }
    return null;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const R = 6371; // Radius bumi dalam KM
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Immediate window exports (hoisted functions)
window.switchTab = switchTab;
window.toggleSidebar = toggleSidebar;
window.toggleCollapse = toggleCollapse;
window.toggleDarkMode = toggleDarkMode;
window.focusOnCourier = focusOnCourier;
window.filterMonitorAll = filterMonitorAll;
window.loadClientsByRegion = loadClientsByRegion;
window.filterClients = filterClients;
window.deleteClient = deleteClient;
window.clearAllClients = clearAllClients;
window.addSelectedClients = addSelectedClients;
window.submitTrip = submitTrip;
window.toggleAllClients = toggleAllClients;
window.promptEditCourierName = promptEditCourierName;
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.logout = logout;
window.deleteDestinationStop = deleteDestinationStop;
window.openPoDModal = openPoDModal;
window.toggleNotifDropdown = toggleNotifDropdown;
window.handleNotificationClick = handleNotificationClick;
window.focusOnTrip = focusOnTrip;
window.renderRecentShipments = renderRecentShipments;
window.resetRecentFilters = resetRecentFilters;
window.calculateDistance = calculateDistance;

let rtdb = getRtdb();
let db = getDb();
let storage = getStorage();
let auth = getAuth();

if (db) {
    try {
        db.settings({ experimentalAutoDetectLongPolling: true });
    } catch (e) {
        console.log("Firestore long polling settings info:", e);
    }
}

var registeredUsers = window.registeredUsers || {};
var registeredUsersObjects = window.registeredUsersObjects || {};
var userRoles = window.userRoles || {};

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
let currentUserRole = "super_admin";
let currentUserBranchId = "pusat";

function getActiveBranchId() {
    if (currentUserRole === 'branch_admin' || currentUserRole === 'branch') {
        return currentUserBranchId || 'cikokol';
    }
    const selectEl = document.getElementById('header-branch-filter');
    if (selectEl) {
        return selectEl.value;
    }
    return 'all';
}
window.getActiveBranchId = getActiveBranchId;

function getTripBranch(t) {
    if (!t) return 'pusat';

    if (t.courierId) {
        let courierUid = t.courierId;
        if (typeof registeredUsers !== 'undefined' && registeredUsers) {
            if (!registeredUsersObjects || !registeredUsersObjects[courierUid]) {
                const foundUid = Object.keys(registeredUsers).find(k => registeredUsers[k] === courierUid);
                if (foundUid) courierUid = foundUid;
            }
        }
        const courierObj = (typeof registeredUsersObjects !== 'undefined' && registeredUsersObjects) ? registeredUsersObjects[courierUid] : null;
        const courierBranch = (courierObj && courierObj.branchId) ? courierObj.branchId.toLowerCase() : 'pusat';
        return courierBranch;
    }

    if (t.branchId) return t.branchId.toLowerCase();

    return 'pusat';
}
window.getTripBranch = getTripBranch;

function isTripInActiveBranch(t) {
    const activeBranch = getActiveBranchId();
    if (activeBranch === 'all') return true;
    const tripBranch = getTripBranch(t);
    return tripBranch === activeBranch;
}
window.isTripInActiveBranch = isTripInActiveBranch;

function isCourierInActiveBranch(courierUidOrName) {
    const activeBranch = getActiveBranchId();
    if (activeBranch === 'all') return true;

    let courierUid = courierUidOrName;
    if (typeof registeredUsers !== 'undefined' && registeredUsers) {
        if (!registeredUsersObjects || !registeredUsersObjects[courierUid]) {
            const foundUid = Object.keys(registeredUsers).find(k => registeredUsers[k] === courierUidOrName);
            if (foundUid) courierUid = foundUid;
        }
    }

    const courierObj = (typeof registeredUsersObjects !== 'undefined' && registeredUsersObjects) ? registeredUsersObjects[courierUid] : null;
    const courierBranch = (courierObj && courierObj.branchId) ? courierObj.branchId.toLowerCase() : 'pusat';
    return courierBranch === activeBranch;
}
window.isCourierInActiveBranch = isCourierInActiveBranch;

function switchBranchFilter(branchVal) {
    if (typeof showToast === 'function') {
        const branchNames = { 'all': 'Semua Cabang', 'pusat': 'Cabang Pusat', 'cikokol': 'Cabang Cikokol' };
        showToast(`Memfilter tampilan ke: ${branchNames[branchVal] || branchVal}`);
    }
    if (typeof updateGlobalStats === 'function') updateGlobalStats();
    if (typeof renderRecentShipments === 'function') renderRecentShipments();
    if (typeof renderMonitorUI === 'function') renderMonitorUI();
    if (typeof updateMapMarkers === 'function') updateMapMarkers();
    if (typeof renderCourierOptions === 'function') renderCourierOptions();
    if (typeof loadChatList === 'function') loadChatList();
    if (typeof renderKPIView === 'function') renderKPIView();
    if (typeof renderManageCouriersList === 'function') renderManageCouriersList();
}
window.switchBranchFilter = switchBranchFilter;

function getCourierColor(id) {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#6366f1'];
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

function getCourierDisplayName(courierId) {
    if (!courierId) return "Carrier";

    if (typeof registeredUsers !== 'undefined' && registeredUsers && registeredUsers[courierId]) {
        return registeredUsers[courierId];
    }

    if (typeof registeredUsersObjects !== 'undefined' && registeredUsersObjects && registeredUsersObjects[courierId]) {
        const u = registeredUsersObjects[courierId];
        if (u.name) return u.name;
        if (u.email) return u.email.split('@')[0];
    }

    const knownUidMap = {
        "xONhqVSNSYcEcGCZyW2cLGJWQt92": "muhamadbayhaqi0",
        "38smknqYbnREY0fQ4Klrnxidv5P2": "andiwijaya",
        "3LHRzmg3PyV2wxeRQcCGdBCDrDH2": "Jagat",
        "LIMDggf5T9PgxEyLvUA0PtBi7eh2": "alanpasming1",
        "EK74u0gAyQYPm0cbR0mAKskjYcG3": "novalganteng1",
        "uP70R51x7CbR5ggHEyeXfsjSTfO2": "pbseventeensc",
        "oaNwPVpTnafiVC6Aq4q2XMGtEKU2": "Staff Trafik"
    };

    if (knownUidMap[courierId]) {
        return knownUidMap[courierId];
    }

    if (courierId.length < 20) {
        return courierId;
    }

    return "Carrier (" + courierId.substring(0, 6) + ")";
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
    const el = document.getElementById('dark-mode-toggle');
    if (el) {
        isDarkMode = el.checked;
        document.body.classList.toggle('dark-theme', isDarkMode);
    }
}

function isCourierOnline(id) {
    const data = currentOnlineCouriers[id];
    if (!data || typeof data.lat === 'undefined' || typeof data.lng === 'undefined') return false;

    let lastMs = 0;
    if (data.lastUpdated && data.lastUpdated.seconds) {
        lastMs = data.lastUpdated.seconds * 1000;
    } else if (typeof data.lastUpdated === 'number') {
        lastMs = data.lastUpdated;
    } else if (typeof data.lastUpdated === 'string') {
        lastMs = new Date(data.lastUpdated).getTime();
    }

    if (!lastMs) return true;
    return (Date.now() - lastMs) < 5 * 60 * 1000;
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
    const img = document.getElementById('modalImg');
    const btn = document.getElementById('downloadBtn');
    if (img) img.src = url;
    if (btn) btn.href = url;
    const modalEl = document.getElementById('imageModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        new bootstrap.Modal(modalEl).show();
    }
}

let isNotificationRead = false;
let lastNotifCount = 0;

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

        // Mark as read and hide alert red badge immediately when opened
        isNotificationRead = true;
        const badgeEl = document.getElementById('notif-badge');
        if (badgeEl) badgeEl.classList.add('d-none');

        updateNotificationBell();
    } else {
        dropdown.classList.add('d-none');
        dropdown.style.display = 'none';
    }
}

function handleNotificationClick(index, e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Mark as read and hide alert red badge
    isNotificationRead = true;
    const badgeEl = document.getElementById('notif-badge');
    if (badgeEl) badgeEl.classList.add('d-none');

    // Close dropdown
    const dropdown = document.getElementById('notif-dropdown');
    if (dropdown) {
        dropdown.classList.add('d-none');
        dropdown.style.display = 'none';
    }

    const item = notificationItems[index];
    if (!item) return;

    if (item.tripId) {
        focusOnTrip(item.tripId);
    } else if (item.courierId) {
        focusOnCourier(item.courierId, true);
    } else if (item.tab) {
        switchTab(item.tab, document.querySelector(`[onclick*="${item.tab}"]`));
    }
}

function focusOnTrip(tripId) {
    switchTab('monitor', document.querySelector('[onclick*="monitor"]'));

    const trip = allCurrentTrips.find(t => t.id === tripId || t.id.substring(0, 8) === tripId || (t.id && tripId.includes(t.id)));
    if (!trip) {
        showToast("Data pengiriman tidak ditemukan.");
        return;
    }

    if (trip.courierId && currentOnlineCouriers[trip.courierId]) {
        focusOnCourier(trip.courierId, true);
        return;
    }

    let targetPos = null;
    if (trip.acceptLatitude && trip.acceptLongitude) {
        targetPos = [parseFloat(trip.acceptLatitude), parseFloat(trip.acceptLongitude)];
    } else if (trip.destinations && trip.destinations.length > 0) {
        const d = trip.destinations.find(x => x.status === 'in_progress' || x.status === 'arrived') || trip.destinations[0];
        if (d && (d.latitude || d.lat) && (d.longitude || d.lng)) {
            targetPos = [parseFloat(d.latitude || d.lat), parseFloat(d.longitude || d.lng)];
        }
    }

    const targetMap = (typeof mapMonitor !== 'undefined' && mapMonitor) ? mapMonitor : (typeof map !== 'undefined' ? map : null);
    if (targetPos && !isNaN(targetPos[0]) && !isNaN(targetPos[1]) && targetMap) {
        setTimeout(() => {
            if (typeof targetMap.invalidateSize === 'function') targetMap.invalidateSize();
            targetMap.flyTo(targetPos, 16, { duration: 1.5 });

            if (typeof monitorMarkersLayer !== 'undefined' && monitorMarkersLayer) {
                monitorMarkersLayer.eachLayer(marker => {
                    if (marker.tripId === trip.id && typeof marker.openPopup === 'function') {
                        marker.openPopup();
                    }
                });
            }
        }, 350);
    }

    const searchInput = document.getElementById('recent-shipment-search');
    if (searchInput) {
        searchInput.value = trip.id.substring(0, 8);
        if (typeof renderRecentShipments === 'function') {
            renderRecentShipments(trip.id.substring(0, 8));
        }
    }

    showToast("Membuka lokasi pengiriman #" + trip.id.substring(Math.max(0, trip.id.length - 6)));
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
                    title: `DELAY WARNING: #${t.id.substring(Math.max(0, t.id.length - 6))}`,
                    desc: `Tidak ada update > 30 menit`,
                    tab: 'monitor',
                    tripId: t.id,
                    courierId: t.courierId
                });
            }
        }

        const isOnline = typeof isCourierOnline === 'function' ? isCourierOnline(t.courierId) : !!currentOnlineCouriers[t.courierId];
        if (t.courierId && !isOnline && t.status !== 'completed') {
            const courierName = registeredUsers[t.courierId] || 'Kurir';
            notificationItems.push({
                type: 'warning',
                icon: 'bi-person-x-fill',
                title: `KURIR OFFLINE: ${courierName}`,
                desc: `${courierName} offline padahal ada tugas aktif`,
                tab: 'monitor',
                courierId: t.courierId,
                tripId: t.id
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

    // Reset read state if new notification items arrive
    if (totalCount > lastNotifCount) {
        isNotificationRead = false;
    }
    lastNotifCount = totalCount;

    if (badgeEl) {
        if (totalCount > 0 && !isNotificationRead) {
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
        listEl.innerHTML = notificationItems.map((item, idx) => {
            const bgClass = item.type === 'danger' ? '#FEF2F2' : item.type === 'warning' ? '#FFFBEB' : '#F0F9FF';
            const iconColor = item.type === 'danger' ? 'text-danger' : item.type === 'warning' ? 'text-warning' : 'text-primary';
            return `
                <div class="p-3 border-bottom d-flex align-items-start gap-3 cursor-pointer" style="background: ${bgClass}; transition: 0.2s;" onclick="handleNotificationClick(${idx}, event)">
                    <div class="${iconColor} fs-5 mt-1"><i class="bi ${item.icon}"></i></div>
                    <div class="flex-grow-1">
                        <div class="fw-bold extra-small text-dark">${item.title}</div>
                        <div class="extra-small text-muted" style="font-size: 0.7rem;">${item.desc}</div>
                    </div>
                    <div class="text-muted extra-small" style="font-size: 0.65rem;">
                        <i class="bi bi-chevron-right"></i>
                    </div>
                </div>
            `;
        }).join('');
    }
}

let alertsClearedAt = 0;
const dismissedAlertIds = new Set();

function clearAllPriorityAlerts() {
    alertsClearedAt = Date.now();
    dismissedAlertIds.clear();
    if (typeof showToast === 'function') showToast("Semua peringatan prioritas dibersihkan.");
    updateDynamicAlerts();
}
window.clearAllPriorityAlerts = clearAllPriorityAlerts;

function dismissSingleAlert(alertId, event) {
    if (event) event.stopPropagation();
    dismissedAlertIds.add(alertId);
    if (typeof showToast === 'function') showToast("Peringatan dibersihkan.");
    updateDynamicAlerts();
}
window.dismissSingleAlert = dismissSingleAlert;

function updateDynamicAlerts() {
    const container = document.getElementById('priority-alerts');
    updateNotificationBell();
    if(!container) return;
    container.innerHTML = '';
    const now = Date.now();
    const nowDate = new Date();
    const todayDayMs = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();

    allCurrentTrips.forEach(t => {
        const cName = registeredUsers[t.courierId] || t.courierId.substring(0,8);
        const tripIdShort = '#' + t.id.substring(Math.max(0, t.id.length - 6));
        const tripMs = t.date?.seconds ? t.date.seconds * 1000 : (t.date ? new Date(t.date).getTime() : (t.id ? parseInt(t.id.replace('TRIP_', '')) || 0 : 0));

        // Auto-expire alerts on H+1: Only generate Priority Alerts for TODAY'S active trips
        if (tripMs < todayDayMs) {
            return;
        }

        if(t.status === 'in_progress') {
            const lastUpdate = t.destinations ? t.destinations.filter(d => d.status === 'done' || d.status === 'arrived').reduce((max, d) => {
                const time = (d.completedTime || d.arrivalTime)?.seconds * 1000 || 0;
                return time > max ? time : max;
            }, (t.date?.seconds || 0) * 1000) : 0;

            const delayAlertId = `delay_${t.id}`;
            if(now - lastUpdate > 30 * 60 * 1000 && lastUpdate < now) {
                if (!dismissedAlertIds.has(delayAlertId) && lastUpdate >= alertsClearedAt) {
                    container.innerHTML += `
                        <div class="d-flex align-items-center justify-content-between p-2 px-3 rounded-3 cursor-pointer mb-1" style="background: #FEF2F2;" onclick="focusOnTrip('${t.id}')">
                            <div class="d-flex align-items-center gap-2">
                                <div class="text-danger fs-5 d-flex align-items-center me-1"><i class="bi bi-clock-history"></i></div>
                                <div>
                                    <div class="fw-semibold text-dark" style="font-size: 0.8125rem; line-height: 1.25;">Delay: ${tripIdShort} (${cName})</div>
                                    <div class="text-danger" style="font-size: 0.725rem; margin-top: 1px;">Tidak ada pembaruan status > 30 menit</div>
                                </div>
                            </div>
                            <button class="btn-close ms-2" style="font-size: 0.65rem;" onclick="dismissSingleAlert('${delayAlertId}', event)" title="Hapus Peringatan Ini"></button>
                        </div>`;
                }
            }
        }

        const isOnline = typeof isCourierOnline === 'function' ? isCourierOnline(t.courierId) : !!currentOnlineCouriers[t.courierId];
        const offlineAlertId = `offline_${t.courierId}_${t.id}`;
        if(!isOnline && t.status !== 'completed') {
            const tripTime = (t.date?.seconds || 0) * 1000;
            if (!dismissedAlertIds.has(offlineAlertId) && tripTime >= alertsClearedAt) {
                container.innerHTML += `
                    <div class="d-flex align-items-center justify-content-between p-2 px-3 rounded-3 cursor-pointer mb-1" style="background: #FFFBEB;" onclick="focusOnCourier('${t.courierId}', true)">
                        <div class="d-flex align-items-center gap-2">
                            <div class="text-warning fs-5 d-flex align-items-center me-1"><i class="bi bi-person-x"></i></div>
                            <div>
                                <div class="fw-semibold text-dark" style="font-size: 0.8125rem; line-height: 1.25;">Kurir Offline: ${cName}</div>
                                <div class="text-warning" style="font-size: 0.725rem; margin-top: 1px;">Kurir offline tapi memiliki tugas aktif ${tripIdShort}</div>
                            </div>
                        </div>
                        <button class="btn-close ms-2" style="font-size: 0.65rem;" onclick="dismissSingleAlert('${offlineAlertId}', event)" title="Hapus Peringatan Ini"></button>
                    </div>`;
            }
        }
    });

    if(container.innerHTML === '') {
        container.innerHTML = '<div class="text-center py-4 text-muted extra-small"><i class="bi bi-check-circle text-success me-1"></i> Tidak ada peringatan prioritas. Semua berjalan lancar.</div>';
    }
}

function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sb) return;

    if (window.innerWidth <= 991) {
        sb.classList.toggle('open');
        if (backdrop) backdrop.classList.toggle('active');
    } else {
        toggleCollapse();
    }
}

function toggleCollapse() {
    const sb = document.getElementById('sidebar');
    if (!sb) return;
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

    const sb = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sb) sb.classList.remove('open');
    if (backdrop) backdrop.classList.remove('active');

    setTimeout(() => {
        if(typeof map !== 'undefined' && map && typeof map.invalidateSize === 'function') map.invalidateSize();
        if(typeof mapMonitor !== 'undefined' && mapMonitor && typeof mapMonitor.invalidateSize === 'function') mapMonitor.invalidateSize();
        if(typeof mapDispatch !== 'undefined' && mapDispatch && typeof mapDispatch.invalidateSize === 'function') mapDispatch.invalidateSize();
    }, 400);

    if(viewId === 'chat') loadChatList();
    if(viewId === 'dispatch') loadClientsByRegion("");
    if(viewId === 'pod-archive') renderPoDArchiveView();
}

function toggleAllClients(checked) {
    document.querySelectorAll('.client-checkbox').forEach(cb => cb.checked = checked);
}

async function loadClientsByRegion(region) {
    const container = document.getElementById('client-list-container');
    const activeDb = getDb();
    if(!container || !activeDb) return;
    const sa = document.getElementById('select-all-clients');
    if(sa) sa.checked = false;

    container.innerHTML = '<p class="text-center py-3 text-muted extra-small">Fetching clients...</p>';

    try {
        const snap = await activeDb.collection('clients').get();
        allClients = [];
        container.innerHTML = '';

        if(snap.empty) {
            const qtyEl = document.getElementById('client-qty');
            if(qtyEl) qtyEl.innerText = "0";
            container.innerHTML = '<p class="text-center py-3 text-muted extra-small">Belum ada database toko/client.</p>';
            return;
        }

        const selectedRegion = (region || '').toLowerCase().trim();
        let matchCount = 0;

        snap.forEach(doc => {
            const c = doc.data();
            c.id = doc.id;

            const clientRegion = (c.region || '').toLowerCase().trim();
            const clientAddress = (c.address || '').toLowerCase();

            if (selectedRegion) {
                const isMatch = clientRegion === selectedRegion ||
                                clientRegion.includes(selectedRegion) ||
                                clientAddress.includes(selectedRegion);
                if (!isMatch) return;
            }

            matchCount++;
            allClients.push(c);

            const addressParts = (c.address || '').split(',');
            const storeName = addressParts[0].trim();
            const remainingAddress = addressParts.slice(1).join(',').trim();

            const escName = (c.name || '').replace(/"/g, '&quot;');
            const escStore = storeName.replace(/"/g, '&quot;');
            const escAddr = (c.address || '').replace(/"/g, '&quot;');

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

        const qtyEl = document.getElementById('client-qty');
        if(qtyEl) qtyEl.innerText = matchCount;

        if(matchCount === 0) {
            container.innerHTML = '<p class="text-center py-3 text-muted extra-small">Tidak ada toko/client di area ini.</p>';
        }
    } catch (e) {
        console.error("Error loading clients:", e);
        container.innerHTML = '<p class="text-center py-3 text-danger extra-small">Gagal memuat daftar toko.</p>';
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
        const qtyEl = document.getElementById('client-qty');
        if (qtyEl) qtyEl.innerText = visibleCount;
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
    const qtyEl = document.getElementById('client-qty');
    if (qtyEl) qtyEl.innerText = visibleCount;
}

async function deleteClient(id, name) {
    if(!confirm(`Hapus client "${name}" dari database?`)) return;
    try {
        const activeDb = getDb();
        if (!activeDb) return;
        await activeDb.collection('clients').doc(id).delete();
        showToast("Client berhasil dihapus.");
        const regEl = document.getElementById('region-filter');
        loadClientsByRegion(regEl ? regEl.value : "");
    } catch (e) {
        alert("Gagal menghapus client: " + e.message);
    }
}

async function clearAllClients() {
    if (!confirm("Hapus SELURUH database client? Semua data toko akan hilang.")) return;
    if (!confirm("APAKAH ANDA YAKIN? Tindakan ini tidak bisa dibatalkan.")) return;

    try {
        const activeDb = getDb();
        if (!activeDb) return;
        const snap = await activeDb.collection('clients').get();
        if (snap.empty) return showToast("Database client sudah kosong.");

        const batch = activeDb.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        showToast("Seluruh database client telah dikosongkan.");
        const regEl = document.getElementById('region-filter');
        loadClientsByRegion(regEl ? regEl.value : "");
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

async function deleteOrphanTrips() {
    try {
        const activeDb = getDb();
        if (!activeDb) return;

        const snap = await activeDb.collection('trips').get();
        if (snap.empty) return;

        const batch = activeDb.batch();
        let deleteCount = 0;

        snap.forEach(doc => {
            const t = doc.data();
            const courierId = t.courierId || '';
            const isKnownUser = (typeof registeredUsers !== 'undefined' && registeredUsers[courierId]) ||
                                (courierId === "xONhqVSNSYcEcGCZyW2cLGJWQt92" || courierId === "38smknqYbnREY0fQ4Klrnxidv5P2" || courierId === "3LHRzmg3PyV2wxeRQcCGdBCDrDH2");

            if (!isKnownUser || courierId.includes('EK74u0gA') || courierId.toLowerCase().includes('novalgan')) {
                batch.delete(doc.ref);
                deleteCount++;
            }
        });

        if (deleteCount > 0) {
            await batch.commit();
            console.log(`Cleaned up ${deleteCount} orphan trips from Firestore.`);
            showToast(`Sistem membersihkan ${deleteCount} tugas lama dari database.`);
        }
    } catch(e) {
        console.warn("Orphan trips cleanup info:", e);
    }
}

function initUsersSnapshot() {
    const activeDb = getDb();
    if (!activeDb) {
        setTimeout(initUsersSnapshot, 300);
        return;
    }
    activeDb.collection('users').onSnapshot(snap => {
        registeredUsers = {};
        registeredUsersObjects = {};
        snap.forEach(doc => {
            const u = doc.data();
            const displayName = u.name || u.email || doc.id.substring(0,8);
            // Map strictly by User UID to avoid duplicate option rendering
            registeredUsers[doc.id] = displayName;
            registeredUsersObjects[doc.id] = u;
        });
        deleteOrphanTrips();
        renderCourierOptions();
        renderManageCouriersList();
        renderRecentShipments();
        if(document.getElementById('view-chat') && document.getElementById('view-chat').classList.contains('active')) loadChatList();
        refreshAllMonitorData();
    });
}
initUsersSnapshot();

function renderManageCouriersList() {
    const container = document.getElementById('manage-couriers-container');
    if (!container) return;
    container.innerHTML = '';

    const sortedCouriers = [];
    for (const uid in registeredUsers) {
        if (!isCourierUser(uid)) continue;
        if (typeof isCourierInActiveBranch === 'function' && !isCourierInActiveBranch(uid)) continue;
        sortedCouriers.push({ uid: uid, name: registeredUsers[uid] });
    }
    sortedCouriers.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    if (sortedCouriers.length === 0) {
        container.innerHTML = '<p class="text-center py-3 text-muted extra-small">Belum ada kurir terdaftar di cabang ini.</p>';
        return;
    }

    sortedCouriers.forEach(c => {
        const id = c.uid;
        const name = c.name;
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
    });
}

async function promptEditCourierName(id, currentName) {
    const newName = prompt(`Masukkan nama baru untuk kurir "${currentName}":`, currentName);
    if (!newName || newName.trim() === "" || newName.trim() === currentName) return;

    try {
        const activeDb = getDb();
        if (!activeDb) return;
        await activeDb.collection('users').doc(id).update({ name: newName.trim() });
        showToast("Nama kurir berhasil diperbarui!");
    } catch(e) {
        alert("Gagal memperbarui nama kurir: " + e.message);
    }
}

function renderCourierOptions() {
    const sel = document.getElementById('sel-courier'); if(!sel) return;
    sel.innerHTML = '<option value="">Select Carrier...</option>';

    const sortedCouriers = [];
    for (const uid in registeredUsers) {
        if (!isCourierUser(uid)) continue;
        if (typeof isCourierInActiveBranch === 'function' && !isCourierInActiveBranch(uid)) continue;
        sortedCouriers.push({ uid: uid, name: registeredUsers[uid] });
    }
    sortedCouriers.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    sortedCouriers.forEach(c => {
        sel.innerHTML += `<option value="${c.uid}">${c.name}</option>`;
    });
}

function initRtdbListener() {
    const activeRtdb = getRtdb();
    if (!activeRtdb) {
        setTimeout(initRtdbListener, 300);
        return;
    }
    activeRtdb.ref('courier_live_location').on('value', snap => {
        currentOnlineCouriers = snap.val() || {};
        updateGlobalStats();
    });
}
initRtdbListener();

function initTripsSnapshot() {
    const activeDb = getDb();
    if (!activeDb) {
        setTimeout(initTripsSnapshot, 300);
        return;
    }
    activeDb.collection('trips').onSnapshot(snap => {
        allCurrentTrips = [];
        snap.forEach(doc => {
            const t = doc.data();
            t.id = doc.id;
            allCurrentTrips.push(t);
        });
        updateGlobalStats();
        renderRecentShipments();
    });
}
initTripsSnapshot();

let isUpdatingStats = false;

function updateGlobalStats() {
    if (isUpdatingStats) return;
    isUpdatingStats = true;

    try {
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

        const selectedCarrier = document.getElementById('recent-carrier-filter')?.value || "all";
        const startDateVal = document.getElementById('recent-start-date')?.value;
        const endDateVal = document.getElementById('recent-end-date')?.value;

        const now = new Date();
        const todayDayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        let filterStartMs = 0;
        let filterEndMs = Infinity;

        if (startDateVal) {
            const d = new Date(startDateVal + "T00:00:00");
            if (!isNaN(d.getTime())) filterStartMs = d.getTime();
        }
        if (endDateVal) {
            const d = new Date(endDateVal + "T23:59:59.999");
            if (!isNaN(d.getTime())) filterEndMs = d.getTime();
        }

        if (!startDateVal && !endDateVal) {
            const selectedDateMode = document.getElementById('recent-date-filter')?.value || "today";
            if (selectedDateMode === "today" || !selectedDateMode) {
                filterStartMs = todayDayMs;
                filterEndMs = todayDayMs + (24 * 60 * 60 * 1000) - 1;
            } else if (selectedDateMode === "3days") {
                filterStartMs = todayDayMs - (2 * 24 * 60 * 60 * 1000);
                filterEndMs = todayDayMs + (24 * 60 * 60 * 1000) - 1;
            } else if (selectedDateMode === "7days") {
                filterStartMs = todayDayMs - (6 * 24 * 60 * 60 * 1000);
                filterEndMs = todayDayMs + (24 * 60 * 60 * 1000) - 1;
            } else if (selectedDateMode === "month") {
                filterStartMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
                filterEndMs = todayDayMs + (24 * 60 * 60 * 1000) - 1;
            } else if (selectedDateMode === "all") {
                filterStartMs = 0;
                filterEndMs = Infinity;
            }
        }

        const filteredTrips = allCurrentTrips.filter(t => {
            if (typeof isTripInActiveBranch === 'function' && !isTripInActiveBranch(t)) {
                return false;
            }

            const cName = getCourierDisplayName ? getCourierDisplayName(t.courierId) : t.courierId;
            const tripMs = t.date?.seconds ? t.date.seconds * 1000 : (t.date ? new Date(t.date).getTime() : (t.id ? parseInt(t.id.replace('TRIP_', '')) || 0 : 0));

            if (selectedCarrier !== "all" && t.courierId !== selectedCarrier && cName.toLowerCase() !== selectedCarrier.toLowerCase()) {
                return false;
            }

            if (filterStartMs > 0 && (tripMs < filterStartMs || tripMs > filterEndMs)) {
                return false;
            }

            return true;
        });

        let activeShipmentsCount = 0;

        filteredTrips.forEach(t => {
            const tripMs = t.date?.seconds ? t.date.seconds * 1000 : (t.date ? new Date(t.date).getTime() : 0);

            if(t.status !== 'completed') {
                couriersWithActiveTrip.add(t.courierId);

                if (tripMs >= todayDayMs && t.status === 'in_progress') {
                    const lastUpdate = t.destinations ? t.destinations.filter(d => d.status === 'done' || d.status === 'arrived').reduce((max, d) => {
                        const time = (d.completedTime || d.arrivalTime)?.seconds * 1000 || 0;
                        return time > max ? time : max;
                    }, (t.date?.seconds || 0) * 1000) : 0;

                    if(lastUpdate > 0 && Date.now() - lastUpdate > 30 * 60 * 1000) {
                        delayedCount++;
                    }
                }
            } else {
                totalCompletedTrips++;
                doneToday++;
                onTimeTrips++;
            }

            if(t.destinations && t.destinations.length > 0) {
                t.destinations.forEach((d, i) => {
                    totalStops++;
                    if (d.status === 'done' || d.proofPhotoUrl || d.status === 'completed') {
                        deliveredStops++;
                    } else if (d.status === 'arrived') {
                        inTransitStops++;
                        activeShipmentsCount++;
                    } else if (d.status === 'returned' || d.status === 'failed') {
                        returnedStops++;
                    } else {
                        pendingStops++;
                        activeShipmentsCount++;
                    }

                    if(d.status === 'done' || d.proofPhotoUrl || d.status === 'completed') {
                        const start = (i === 0)
                            ? ((t.acceptLatitude && t.acceptLongitude) ? { lat: t.acceptLatitude, lng: t.acceptLongitude } : { lat: t.destinations[0].latitude, lng: t.destinations[0].longitude })
                            : { lat: t.destinations[i-1].latitude, lng: t.destinations[i-1].longitude };
                        grandTotalKM += calculateDistance(start.lat, start.lng, d.latitude, d.longitude);
                    }
                });
            } else if (t.status !== 'completed') {
                activeShipmentsCount++;
            }
        });

        for (const id in currentOnlineCouriers) {
            if (couriersWithActiveTrip.has(id)) {
                inTransitCouriers++;
            }
        }

        let totalStopsToday = 0;
        filteredTrips.forEach(t => {
            const tripMs = t.date?.seconds ? t.date.seconds * 1000 : (t.date ? new Date(t.date).getTime() : 0);
            if (tripMs >= todayDayMs) {
                if (t.destinations && t.destinations.length > 0) {
                    totalStopsToday += t.destinations.length;
                } else {
                    totalStopsToday += 1;
                }
            }
        });

        if(document.getElementById('stat-active')) document.getElementById('stat-active').innerText = activeShipmentsCount;
        if(document.getElementById('stat-done')) document.getElementById('stat-done').innerText = totalStopsToday;
        if(document.getElementById('stat-delayed')) document.getElementById('stat-delayed').innerText = delayedCount;
        if(document.getElementById('stat-transit-count')) document.getElementById('stat-transit-count').innerText = inTransitStops;
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
    } finally {
        isUpdatingStats = false;
    }
}

let refreshMonitorTimeout = null;
function refreshAllMonitorData() {
    if (refreshMonitorTimeout) return;
    refreshMonitorTimeout = setTimeout(() => {
        refreshMonitorTimeout = null;
        renderMonitorUI(activeFilter);
        if (typeof updateMapMarkers === 'function') updateMapMarkers(activeFilter);
        updateMonitorSuggestions();
        if (typeof renderKPIView === 'function') renderKPIView();
    }, 100);
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

    if (typeof draftMarkersLayer !== 'undefined' && draftMarkersLayer && typeof L !== 'undefined') {
        draftMarkersLayer.clearLayers();
        tripQueue.forEach((d, i) => {
            const icon = L.divIcon({ className:'custom-div-icon', html:`<div class='marker-pin' style='background:#F59E0B'></div><div class='marker-num'>${i+1}</div>`, iconSize:[30,42], iconAnchor:[15,42] });
            L.marker([d.lat, d.lng], {icon}).addTo(draftMarkersLayer);
        });
    }
}

async function submitTrip() {
    const btn = document.querySelector('[onclick*="submitTrip"]');
    const cidEl = document.getElementById('sel-courier');
    if (!cidEl) return alert("Elemen pemilihan kurir tidak ditemukan!");
    const cid = cidEl.value;

    if (!cid) return alert("PILIH KURIR TERLEBIH DAHULU!\nSilakan pilih nama kurir penanggung jawab di langkah 1 (Select Courier).");
    if (!tripQueue || tripQueue.length === 0) return alert("TAMBAHKAN ALAMAT TUJUAN TERLEBIH DAHULU!\nSilakan centang lokasi dan klik (+ ADD SELECTED TO ROUTE) di langkah 2 (Add Destinations).");

    if (btn) {
        btn.disabled = true;
        btn.innerText = "SENDING DISPATCH...";
    }

    try {
        const activeDb = getDb();
        if (!activeDb) throw new Error("Firestore Database belum terhubung.");

        const id = "TRIP_" + Date.now();
        await activeDb.collection('trips').doc(id).set({
            tripId: id,
            courierId: cid,
            status: "assigned",
            date: firebase.firestore.Timestamp.now(),
            destinations: tripQueue.map((d, i) => ({
                stopIndex: i + 1,
                locationName: d.name || d.locationName || "Tujuan",
                address: d.address || "",
                latitude: parseFloat(d.lat !== undefined ? d.lat : (d.latitude || -6.2088)),
                longitude: parseFloat(d.lng !== undefined ? d.lng : (d.longitude || 106.8456)),
                status: "pending",
                proofPhotoUrl: ""
            }))
        });

        syncDestinationsToMasterClients(tripQueue);

        showToast("BERHASIL DITUGASKAN! Pengiriman telah dikirim ke kurir.");
        tripQueue = [];
        renderQueue();
        cidEl.value = "";
    } catch (e) {
        console.error("Submit Trip Error:", e);
        alert("Gagal menugaskan pengiriman: " + e.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-send-plus-fill me-2"></i> CONFIRM & DISPATCH';
        }
    }
}

async function syncDestinationsToMasterClients(destinations) {
    const activeDb = getDb();
    if (!destinations || destinations.length === 0 || !activeDb) return;

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

            await activeDb.collection('clients').doc(clientDocId).set({
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
        const activeDb = getDb();
        if (!activeDb) return;
        await activeDb.collection('trips').doc(tripId).delete();
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
    const now = new Date();
    const todayDayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const courierGroups = {};
    allCurrentTrips.forEach(t => {
        const tripMs = t.date?.seconds ? t.date.seconds * 1000 : (t.date ? new Date(t.date).getTime() : 0);
        if (tripMs < todayDayMs) return; // Clean H+1: Only show today's active trips
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
        mList.innerHTML = '<div class="col-12 text-center p-4 text-muted extra-small">No active couriers matching filter.</div>';
        return;
    }

    const cardsHtml = [];
    courierIds.forEach(cId => {
        const c = courierGroups[cId];
        const cColor = getCourierColor(c.id);
        const progress = Math.round((c.doneStops / c.totalStops) * 100) || 0;
        const isOnline = isCourierOnline(c.id);

        cardsHtml.push(`
            <div class="col-sm-6 col-md-4 col-lg-3 col-xl-3 mb-2">
                <div class="border rounded-3 p-2.5 px-3 bg-white shadow-sm h-100" style="border-top: 3px solid ${cColor} !important">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <div class="d-flex align-items-center gap-2">
                            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=${cColor.replace('#','')}&color=fff" style="width:32px;height:32px;border-radius:8px;">
                            <div>
                                <div class="fw-bold mb-0 text-dark text-truncate" style="font-size:0.875rem; max-width: 110px;" title="${c.name}">${c.name}</div>
                                <small class="${isOnline ? 'text-success' : 'text-muted'} fw-semibold" style="font-size:0.65rem">
                                    <i class="bi bi-circle-fill me-1" style="font-size: 5px"></i> ${isOnline ? 'ONLINE' : 'OFFLINE'}
                                </small>
                            </div>
                        </div>
                        <div class="d-flex align-items-center gap-1">
                            <span class="badge rounded-pill bg-light text-dark border extra-small py-1 px-2" style="font-size:0.65rem">${c.trips.length} Active Trips</span>
                            <button class="btn btn-sm btn-link text-danger p-0 ms-1 text-decoration-none" onclick="deleteCourierActiveTrips('${c.id}', '${c.name.replace(/'/g, "\\'")}')" title="Batalkan/Hapus Semua Tugas Aktif Kurir Ini"><i class="bi bi-trash" style="font-size:0.8rem"></i></button>
                        </div>
                    </div>

                    <div class="mb-2">
                        <div class="d-flex justify-content-between extra-small mb-1">
                            <span class="text-muted fw-medium">Overall Progress</span>
                            <span class="fw-bold text-dark">${c.doneStops}/${c.totalStops} Stops</span>
                        </div>
                        <div class="progress" style="height: 6px; border-radius: 6px; background: #F1F5F9">
                            <div class="progress-bar progress-bar-striped progress-bar-animated" style="width: ${progress}%; background: ${cColor}; border-radius: 6px;"></div>
                        </div>
                    </div>

                    <button class="btn btn-sm btn-dark w-100 py-1.5 fw-bold" style="border-radius: 8px; font-size:0.75rem" data-id="${c.id}" onclick="focusOnCourier(this.dataset.id, true)">
                        <i class="bi bi-geo-alt-fill me-1"></i> FOCUS TRACKING
                    </button>
                </div>
            </div>`);
    });
    mList.innerHTML = cardsHtml.join('');
}

async function deleteCourierActiveTrips(courierId, courierName) {
    if (!confirm(`Batalkan / hapus semua tugas aktif milik "${courierName}"?`)) return;

    try {
        const activeDb = getDb();
        if (!activeDb) return;

        const activeTrips = allCurrentTrips.filter(t => t.courierId === courierId && t.status !== 'completed');
        if (activeTrips.length === 0) return showToast("Tidak ada tugas aktif.");

        const batch = activeDb.batch();
        activeTrips.forEach(t => {
            batch.delete(activeDb.collection('trips').doc(t.id));
        });
        await batch.commit();

        showToast(`Tugas aktif "${courierName}" berhasil dibatalkan.`);
    } catch(e) {
        alert("Gagal menghapus tugas: " + e.message);
    }
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

function focusOnCourier(id, isMonitor = true) {
    switchTab('monitor', document.querySelector('[onclick*="monitor"]'));

    const targetMap = (typeof mapMonitor !== 'undefined' && mapMonitor) ? mapMonitor : (typeof map !== 'undefined' ? map : null);
    let targetPos = null;

    if (currentOnlineCouriers[id] && currentOnlineCouriers[id].lat && currentOnlineCouriers[id].lng) {
        targetPos = [parseFloat(currentOnlineCouriers[id].lat), parseFloat(currentOnlineCouriers[id].lng)];
    } else {
        const trip = allCurrentTrips.find(t => t.courierId === id && t.status !== 'completed');
        if (trip) {
            if (trip.acceptLatitude && trip.acceptLongitude) {
                targetPos = [parseFloat(trip.acceptLatitude), parseFloat(trip.acceptLongitude)];
            } else if (trip.destinations && trip.destinations.length > 0) {
                const firstDest = trip.destinations[0];
                targetPos = [parseFloat(firstDest.latitude || firstDest.lat), parseFloat(firstDest.longitude || firstDest.lng)];
            }
        }
    }

    if (targetPos && !isNaN(targetPos[0]) && !isNaN(targetPos[1]) && targetMap) {
        setTimeout(() => {
            if (typeof targetMap.invalidateSize === 'function') targetMap.invalidateSize();
            targetMap.flyTo(targetPos, 16, { duration: 1.5 });

            if (typeof monitorCouriersLayer !== 'undefined' && monitorCouriersLayer) {
                monitorCouriersLayer.eachLayer(marker => {
                    if (marker.courierId === id && typeof marker.openPopup === 'function') {
                        marker.openPopup();
                    }
                });
            }
        }, 300);
    } else {
        showToast("Lokasi kurir belum tersedia di peta.");
    }
}

let recentSortField = 'date';
let recentSortAsc = false;

function filterTableByCard(cardType) {
    const sStatus = document.getElementById('recent-status-filter');
    const sStart = document.getElementById('recent-start-date');
    const sEnd = document.getElementById('recent-end-date');

    const todayStr = new Date().toISOString().split('T')[0];

    if (cardType === 'active') {
        if (sStatus) sStatus.value = "active_all";
        if (sStart) sStart.value = "";
        if (sEnd) sEnd.value = "";
        if (typeof showToast === 'function') showToast("Menampilkan seluruh Active Shipments");
    } else if (cardType === 'delayed') {
        if (sStatus) sStatus.value = "delayed";
        if (sStart) sStart.value = "";
        if (sEnd) sEnd.value = "";
        if (typeof showToast === 'function') showToast("Menampilkan pengiriman Terlambat (Delayed)");
    } else if (cardType === 'in_transit') {
        if (sStatus) sStatus.value = "in_progress";
        if (sStart) sStart.value = "";
        if (sEnd) sEnd.value = "";
        if (typeof showToast === 'function') showToast("Menampilkan pengiriman In Transit");
    } else if (cardType === 'today') {
        if (sStatus) sStatus.value = "all";
        if (sStart) sStart.value = todayStr;
        if (sEnd) sEnd.value = todayStr;
        if (typeof showToast === 'function') showToast("Menampilkan pengiriman Hari Ini (Orders Today)");
    } else if (cardType === 'total_km') {
        if (sStatus) sStatus.value = "completed";
        if (sStart) sStart.value = "";
        if (sEnd) sEnd.value = "";
        if (typeof showToast === 'function') showToast("Menampilkan pengiriman Selesai dengan Total Distance");
    }

    renderRecentShipments();

    const targetEl = document.getElementById('recent-shipments-table') || document.querySelector('.card.border.rounded-4.p-4.mb-4');
    if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}
window.filterTableByCard = filterTableByCard;

function sortRecentShipments(field) {
    if (recentSortField === field) {
        recentSortAsc = !recentSortAsc;
    } else {
        recentSortField = field;
        recentSortAsc = (field === 'date' ? false : true);
    }
    renderRecentShipments();
}
window.sortRecentShipments = sortRecentShipments;

function renderRecentShipments(filter = "") {
    const table = document.getElementById('recent-shipments-table');
    if(!table) return;
    table.innerHTML = '';

    const rawSearch = (typeof filter === 'string' ? filter : (document.getElementById('recent-shipment-search')?.value || "")).toLowerCase().trim();
    const selectedStatus = document.getElementById('recent-status-filter')?.value || "all";
    const selectedCarrier = document.getElementById('recent-carrier-filter')?.value || "all";
    const startDateVal = document.getElementById('recent-start-date')?.value;
    const endDateVal = document.getElementById('recent-end-date')?.value;

    const shipmentRows = [];
    const now = new Date();
    const todayDayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    let filterStartMs = 0;
    let filterEndMs = Infinity;

    if (startDateVal) {
        const d = new Date(startDateVal + "T00:00:00");
        if (!isNaN(d.getTime())) filterStartMs = d.getTime();
    }
    if (endDateVal) {
        const d = new Date(endDateVal + "T23:59:59.999");
        if (!isNaN(d.getTime())) filterEndMs = d.getTime();
    }

    if (!startDateVal && !endDateVal) {
        const selectedDateMode = document.getElementById('recent-date-filter')?.value || "today";
        if (selectedDateMode === "today" || !selectedDateMode) {
            filterStartMs = todayDayMs;
            filterEndMs = todayDayMs + (24 * 60 * 60 * 1000) - 1;
        } else if (selectedDateMode === "3days") {
            filterStartMs = todayDayMs - (2 * 24 * 60 * 60 * 1000);
            filterEndMs = todayDayMs + (24 * 60 * 60 * 1000) - 1;
        } else if (selectedDateMode === "7days") {
            filterStartMs = todayDayMs - (6 * 24 * 60 * 60 * 1000);
            filterEndMs = todayDayMs + (24 * 60 * 60 * 1000) - 1;
        } else if (selectedDateMode === "month") {
            filterStartMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
            filterEndMs = todayDayMs + (24 * 60 * 60 * 1000) - 1;
        } else if (selectedDateMode === "all") {
            filterStartMs = 0;
            filterEndMs = Infinity;
        }
    }

    allCurrentTrips.forEach(t => {
        if (typeof isTripInActiveBranch === 'function' && !isTripInActiveBranch(t)) {
            return;
        }

        const cName = getCourierDisplayName(t.courierId);
        const tripIdShort = '#' + t.id.substring(Math.max(0, t.id.length - 6));
        const tripMs = t.date?.seconds ? t.date.seconds * 1000 : (t.date ? new Date(t.date).getTime() : (t.id ? parseInt(t.id.replace('TRIP_', '')) || 0 : 0));
        const tripDateStr = tripMs ? new Date(tripMs).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

        // Check Carrier Filter
        if (selectedCarrier !== "all" && t.courierId !== selectedCarrier && cName.toLowerCase() !== selectedCarrier.toLowerCase()) {
            return;
        }

        // Check Date Filter
        if (filterStartMs > 0 && (tripMs < filterStartMs || tripMs > filterEndMs)) {
            return;
        }

        if (t.destinations && t.destinations.length > 0) {
            t.destinations.forEach((d, idx) => {
                const locName = d.locationName || 'Destination';
                const fullAddress = d.address || '';
                const stopIdx = d.stopIndex || (idx + 1);

                const uniqueShipmentId = `${tripIdShort}-${stopIdx}`;

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

                const searchableText = `${uniqueShipmentId} ${tripIdShort} ${t.id} ${cName} ${locName} ${fullAddress} ${status} ${tripDateStr}`.toLowerCase();
                const terms = rawSearch.split(/\s+/).filter(x => x.length > 0);
                const matchSearch = !rawSearch || terms.every(term => {
                    const cleanTerm = term.replace('#', '');
                    return searchableText.includes(term) || searchableText.includes(cleanTerm);
                });

                let matchStatus = false;
                if (selectedStatus === 'all') {
                    matchStatus = true;
                } else if (selectedStatus === 'active_all') {
                    matchStatus = (status !== 'completed');
                } else if (selectedStatus === 'delayed') {
                    const lastUpdate = t.destinations ? t.destinations.filter(d => d.status === 'done' || d.status === 'arrived').reduce((max, d) => {
                        const time = (d.completedTime || d.arrivalTime)?.seconds * 1000 || 0;
                        return time > max ? time : max;
                    }, (t.date?.seconds || 0) * 1000) : 0;
                    matchStatus = (status !== 'completed') && (Date.now() - lastUpdate > 30 * 60 * 1000);
                } else {
                    matchStatus = (status === selectedStatus);
                }

                if (matchSearch && matchStatus) {
                    shipmentRows.push({
                        tripId: t.id,
                        displayId: uniqueShipmentId,
                        dateStr: tripDateStr,
                        tripMs: tripMs,
                        stopIndex: stopIdx,
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
        }
    });

    const totalBadge = document.getElementById('recent-shipments-total-badge');
    if (totalBadge) {
        totalBadge.innerText = `${shipmentRows.length} Total Filtered`;
    }

    const carrierSelect = document.getElementById('recent-carrier-filter');
    if (carrierSelect && carrierSelect.options.length <= 1) {
        const sortedCouriers = [];
        for (const uid in registeredUsers) {
            if (!isCourierUser(uid)) continue;
            sortedCouriers.push({ uid: uid, name: registeredUsers[uid] });
        }
        sortedCouriers.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        sortedCouriers.forEach(c => {
            carrierSelect.innerHTML += `<option value="${c.uid}">${c.name}</option>`;
        });
    }

    if (shipmentRows.length === 0) {
        table.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted extra-small"><i class="bi bi-search me-1"></i> Tidak ada data pengantaran matching filter.</td></tr>`;
        return;
    }

    shipmentRows.sort((a, b) => {
        let valA, valB;
        if (recentSortField === 'date') {
            valA = a.tripMs || 0;
            valB = b.tripMs || 0;
        } else if (recentSortField === 'id') {
            valA = a.displayId.toLowerCase();
            valB = b.displayId.toLowerCase();
        } else if (recentSortField === 'destination') {
            valA = a.destinationName.toLowerCase();
            valB = b.destinationName.toLowerCase();
        } else if (recentSortField === 'status') {
            valA = a.status.toLowerCase();
            valB = b.status.toLowerCase();
        } else if (recentSortField === 'carrier') {
            valA = a.carrier.toLowerCase();
            valB = b.carrier.toLowerCase();
        } else if (recentSortField === 'eta') {
            valA = a.eta.toLowerCase();
            valB = b.eta.toLowerCase();
        }

        if (valA < valB) return recentSortAsc ? -1 : 1;
        if (valA > valB) return recentSortAsc ? 1 : -1;
        return 0;
    });

    const sortFields = ['date', 'id', 'destination', 'status', 'carrier', 'eta'];
    sortFields.forEach(f => {
        const iconEl = document.getElementById(`sort-icon-${f}`);
        if (iconEl) {
            if (recentSortField === f) {
                iconEl.className = recentSortAsc ? "bi bi-sort-up text-primary ms-1" : "bi bi-sort-down-alt text-primary ms-1";
            } else {
                iconEl.className = "bi bi-arrow-down-up text-muted ms-1";
            }
        }
    });

    const rowsHtml = [];
    shipmentRows.slice(0, 100).forEach(s => {
        const podIcon = s.proofUrl ? `<i class="bi bi-camera-fill text-success ms-1 cursor-pointer" data-url="${s.proofUrl}" onclick="openPoDModal(this.dataset.url)" title="Lihat Foto PoD"></i>` : '';
        const uploadBtn = `<button class="btn btn-sm btn-link text-primary p-0 ms-1 text-decoration-none" onclick="openManualUploadModal('${s.tripId}', ${s.stopIndex}, '${s.destinationName.replace(/'/g, "\\'")}')" title="Upload Foto PoD Manual Admin"><i class="bi bi-upload"></i></button>`;

        rowsHtml.push(`<tr>
            <td class="fw-normal text-muted extra-small text-nowrap" style="white-space: nowrap;">${s.dateStr}</td>
            <td class="fw-bold text-dark text-nowrap" style="white-space: nowrap;">${s.displayId} ${podIcon} ${uploadBtn}</td>
            <td>
                <div class="fw-bold text-dark text-truncate" style="max-width:240px">${s.destinationName}</div>
                ${s.fullAddress ? `<small class="text-muted extra-small d-block text-truncate fw-normal" style="max-width:240px">${s.fullAddress}</small>` : ''}
            </td>
            <td class="text-nowrap" style="white-space: nowrap;"><span class="badge-pill badge-${s.statusClass} fw-normal">${s.status}</span></td>
            <td class="fw-normal text-dark text-nowrap" style="white-space: nowrap;">${s.carrier}</td>
            <td class="text-nowrap" style="white-space: nowrap;"><small class="fw-normal text-secondary">${s.eta}</small></td>
            <td class="text-nowrap">
                <button class="btn btn-sm btn-light border text-danger" onclick="deleteDestinationStop('${s.tripId}', ${s.stopIndex}, '${s.destinationName.replace(/'/g, "\\'")}')" title="Hapus Titik Pengantaran Ini">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>`);
    });
    table.innerHTML = rowsHtml.join('');
    updateGlobalStats();
}

function resetRecentFilters() {
    const sSearch = document.getElementById('recent-shipment-search');
    const sStatus = document.getElementById('recent-status-filter');
    const sCarrier = document.getElementById('recent-carrier-filter');
    const sDate = document.getElementById('recent-date-filter');
    const sStart = document.getElementById('recent-start-date');
    const sEnd = document.getElementById('recent-end-date');

    if (sSearch) sSearch.value = "";
    if (sStatus) sStatus.value = "all";
    if (sCarrier) sCarrier.value = "all";
    if (sDate) sDate.value = "all";
    if (sStart) sStart.value = "";
    if (sEnd) sEnd.value = "";

    recentSortField = 'date';
    recentSortAsc = false;

    renderRecentShipments();
    showToast("Filter tabel dikembalikan ke awal.");
}

function openManualUploadModal(tripId, stopIndex, locationName) {
    const tripIdEl = document.getElementById('upload-modal-trip-id');
    const stopIdxEl = document.getElementById('upload-modal-stop-index');
    const locNameEl = document.getElementById('upload-modal-location-name');
    const fileEl = document.getElementById('upload-modal-file');
    const statusEl = document.getElementById('upload-modal-status');

    if (tripIdEl) tripIdEl.value = tripId;
    if (stopIdxEl) stopIdxEl.value = stopIndex;
    if (locNameEl) locNameEl.innerText = locationName || "Destination Stop #" + stopIndex;
    if (fileEl) fileEl.value = "";
    if (statusEl) statusEl.innerText = "";

    const modalEl = document.getElementById('manualUploadModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        new bootstrap.Modal(modalEl).show();
    }
}

async function submitManualUploadPhoto() {
    const tripId = document.getElementById('upload-modal-trip-id').value;
    const stopIndex = parseInt(document.getElementById('upload-modal-stop-index').value);
    const file = document.getElementById('upload-modal-file').files[0];
    const statusEl = document.getElementById('upload-modal-status');
    const btn = document.getElementById('upload-modal-submit-btn');

    if (!tripId || !file) return alert("Pilih file foto bukti terlebih dahulu!");

    if (btn) { btn.disabled = true; btn.innerText = "UPLOADING..."; }
    if (statusEl) statusEl.innerText = "Mengunggah foto bukti...";

    try {
        const activeStorage = getStorage();
        const activeDb = getDb();
        if (!activeStorage || !activeDb) throw new Error("Firebase Storage/Firestore belum siap.");

        const cleanTripId = tripId.replace(/[^a-zA-Z0-9]/g, '_');
        const locName = document.getElementById('upload-modal-location-name')?.innerText || 'Client';
        const cleanClientName = locName.replace(/[^a-zA-Z0-9]/g, '_');
        const customFileName = `${cleanTripId}_Stop${stopIndex}_${cleanClientName}_${Date.now()}.jpg`;

        const ref = activeStorage.ref(`proofs/${customFileName}`);
        const task = await ref.put(file);
        const photoUrl = await task.ref.getDownloadURL();

        const tripDocRef = activeDb.collection('trips').doc(tripId);
        const tripSnap = await tripDocRef.get();

        if (tripSnap.exists) {
            const tData = tripSnap.data();
            const updatedDests = (tData.destinations || []).map(d => {
                if (d.stopIndex === stopIndex || (d.stopIndex === undefined && d.locationName === document.getElementById('upload-modal-location-name').innerText)) {
                    return {
                        ...d,
                        status: "done",
                        completedTime: firebase.firestore.Timestamp.now(),
                        proofPhotoUrl: photoUrl
                    };
                }
                return d;
            });

            const allDone = updatedDests.every(d => d.status === 'done' || (d.proofPhotoUrl && d.proofPhotoUrl.length > 0));
            const updateMap = { destinations: updatedDests };
            if (allDone) updateMap.status = "completed";
            else if (tData.status === "assigned" || tData.status === "accepted") updateMap.status = "in_progress";

            await tripDocRef.update(updateMap);

            showToast("BUKTI FOTO BERHASIL DIUNGGAH! Status pengiriman di-update ke Selesai.");
            const modalEl = document.getElementById('manualUploadModal');
            if (modalEl && typeof bootstrap !== 'undefined') {
                bootstrap.Modal.getInstance(modalEl)?.hide();
            }
        }
    } catch(e) {
        console.error("Manual upload error:", e);
        alert("Gagal mengunggah foto: " + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "UNGGAH & SELESAIKAN"; }
    }
}

function exportRecentShipmentsToExcel() {
    if (typeof XLSX === 'undefined') return alert("SheetJS library not loaded!");
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
    if (typeof XLSX === 'undefined') return alert("SheetJS library not loaded!");
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
        const activeDb = getDb();
        if (!activeDb) return;
        const snap = await activeDb.collection('trips').get();
        if (snap.empty) return showToast("Tidak ada riwayat untuk dihapus.");

        const batch = activeDb.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        showToast("Semua riwayat berhasil dikosongkan.");
        loadFullHistory();
    } catch (e) {
        alert("Gagal menghapus riwayat: " + e.message);
    }
}

async function importClientsFromExcel() {
    if (typeof XLSX === 'undefined') return alert("SheetJS library not loaded!");
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
        const activeDb = getDb();
        if (!activeDb) return alert("Database tidak terhubung.");
        const batch = activeDb.batch();
        const geocoder = (typeof google !== 'undefined' && google.maps && google.maps.Geocoder) ? new google.maps.Geocoder() : null;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const name = (row.Customer || row.Name || row.name || row.CUSTOMER || "").toString().trim();
            let address = (row['Alamat SJ'] || row.Address || row.address || row.ALAMAT || "").toString().trim();
            const region = (row.Region || row.region || row.REGION || "").toString().trim();

            if(!name) continue;

            const regionSuffix = region ? `, ${region}` : ", Jabodetabek";
            const searchQuery = address ? `${address}${regionSuffix}, Indonesia` : `${name}${regionSuffix}, Indonesia`;

            try {
                let geoResult = null;
                if (geocoder) {
                    geoResult = await new Promise((resolve) => {
                        geocoder.geocode({ address: searchQuery }, (results, s) => {
                            if (s === 'OK' && results[0]) {
                                resolve({
                                    location: results[0].geometry.location,
                                    fullAddress: results[0].formatted_address
                                });
                            } else {
                                resolve(null);
                            }
                        });
                    });
                }

                const finalAddress = (address.length < 5 && geoResult) ? geoResult.fullAddress : (address || (geoResult ? geoResult.fullAddress : "Alamat tidak ditemukan"));

                const ref = activeDb.collection('clients').doc();
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

function initTrackingConfigListener() {
    const activeDb = getDb();
    if (!activeDb) {
        setTimeout(initTrackingConfigListener, 500);
        return;
    }

    activeDb.collection('config').doc('tracking').onSnapshot(snap => {
        const data = snap?.data() || {};
        const cfgIntervalEl = document.getElementById('cfg-interval');
        const cfgGeofenceEl = document.getElementById('cfg-geofence');

        if (cfgIntervalEl) {
            if (data.intervalMs) {
                const mins = Math.round(data.intervalMs / (60 * 1000));
                cfgIntervalEl.value = mins > 0 ? mins : 30;
            } else {
                cfgIntervalEl.value = 30;
            }
        }

        if (cfgGeofenceEl) {
            if (data.geofenceRadius) {
                cfgGeofenceEl.value = data.geofenceRadius;
            } else {
                cfgGeofenceEl.value = 200;
            }
        }
    }, err => {
        console.warn("Config listener error:", err);
    });
}
initTrackingConfigListener();

async function updateConfig() {
    const activeDb = getDb();
    if (!activeDb) return alert("Firebase database belum siap.");

    const mins = parseFloat(document.getElementById('cfg-interval')?.value || "30");
    const geofence = parseFloat(document.getElementById('cfg-geofence')?.value || "200");

    const validMins = (!isNaN(mins) && mins > 0) ? mins : 30;
    const validGeofence = (!isNaN(geofence) && geofence > 0) ? geofence : 200;

    const intervalMs = validMins * 60 * 1000;

    try {
        await activeDb.collection('config').doc('tracking').set({
            intervalMs: intervalMs,
            geofenceRadius: validGeofence,
            updatedAt: firebase.firestore.Timestamp.now()
        }, { merge: true });

        showToast(`Konfigurasi tersimpan: ${validMins} Menit / ${validGeofence} Meter.`);
    } catch (e) {
        alert("Gagal menyimpan konfigurasi: " + e.message);
    }
}
window.updateConfig = updateConfig;

async function resetConfigToDefault() {
    if (!confirm("Atur ulang konfigurasi ke Default (30 Menit & 200 Meter)?")) return;

    const cfgIntervalEl = document.getElementById('cfg-interval');
    const cfgGeofenceEl = document.getElementById('cfg-geofence');

    if (cfgIntervalEl) cfgIntervalEl.value = 30;
    if (cfgGeofenceEl) cfgGeofenceEl.value = 200;

    await updateConfig();
}
window.resetConfigToDefault = resetConfigToDefault;

async function publishUpdateAuto() {
    const activeStorage = getStorage();
    const activeDb = getDb();
    if (!activeStorage || !activeDb) return alert("Firebase belum siap.");
    const v = document.getElementById('upd-version').value, f = document.getElementById('upd-file').files[0];
    if (!v || !f) return alert("Select version and file!");
    const prog = document.getElementById('upd-progress'); prog.classList.remove('d-none');
    const task = activeStorage.ref('updates/' + f.name).put(f);
    task.on('state_changed', s => { prog.querySelector('.progress-bar').style.width = (s.bytesTransferred/s.totalBytes)*100 + '%'; }, e => alert(e.message), async () => {
        const url = await task.snapshot.ref.getDownloadURL();
        await activeDb.collection('config').doc('app_status').set({ versionCode: parseInt(v), downloadUrl: url, updatedAt: firebase.firestore.Timestamp.now() }, { merge: true });
        showToast("Update published!"); prog.classList.add('d-none');
    });
}

function loadChatList(filter = "") {
    const container = document.getElementById('chat-list-container') || document.getElementById('chat-courier-list');
    if (!container) return;
    container.innerHTML = '';

    let totalCouriersInBranch = 0;

    for (const id in registeredUsers) {
        if (!isCourierUser(id)) continue;
        if (typeof isCourierInActiveBranch === 'function' && !isCourierInActiveBranch(id)) continue;

        totalCouriersInBranch++;
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

    if (totalCouriersInBranch === 0) {
        container.innerHTML = `<div class="text-center py-4 text-muted extra-small"><i class="bi bi-chat-dots me-1"></i> Belum ada kurir/driver terdaftar di cabang ini.</div>`;
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
    const activeDb = getDb();
    if (!box || !activeDb) return;
    box.innerHTML = '<p class="text-center py-4 text-muted extra-small">Loading messages...</p>';

    const col = activeDb.collection('chats').doc(id).collection('messages');
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
    const activeDb = getDb();
    if (!input || !currentChatId || !activeDb) return;
    const text = input.value.trim();
    if (!text) return;

    activeDb.collection('chats').doc(currentChatId).collection('messages').add({
        senderId: 'admin',
        senderRole: 'admin',
        text: text,
        timestamp: firebase.firestore.Timestamp.now()
    });

    input.value = '';
}

async function handleLogin(e) {
    if (e && e.preventDefault) e.preventDefault();
    ensureFirebaseApp();

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
        const firebaseAuth = getAuth();
        if (!firebaseAuth) {
            throw new Error("Sistem Autentikasi Firebase belum siap. Silakan refresh halaman.");
        }
        await firebaseAuth.signInWithEmailAndPassword(email, pass);
    } catch (e) {
        console.error("Login Error:", e);
        if (btn) {
            btn.disabled = false;
            btn.innerText = "SIGN IN";
        }

        let friendlyMsg = e.message || String(e);
        if (e.code === 'auth/invalid-credential' || e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-email') {
            friendlyMsg = "Email atau password yang Anda masukkan salah.";
        } else if (e.code === 'auth/too-many-requests') {
            friendlyMsg = "Akses terblokir sementara karena terlalu banyak percobaan login. Silakan tunggu beberapa menit.";
        } else if (e.code === 'auth/network-request-failed') {
            friendlyMsg = "Koneksi internet terputus. Silakan periksa jaringan Anda.";
        }

        if (err) {
            err.innerText = friendlyMsg;
            err.classList.remove('d-none');
        } else {
            alert(friendlyMsg);
        }
    }
}

function initAuthListener() {
    ensureFirebaseApp();
    const firebaseAuth = getAuth();
    if (firebaseAuth) {
        firebaseAuth.onAuthStateChanged(user => {
            const loginScreen = document.getElementById('login-screen');
            const mainWrapper = document.getElementById('main-wrapper');
            const err = document.getElementById('login-error');

            if (user) {
                const currentDb = getDb();
                if (currentDb) {
                    currentDb.collection('users').doc(user.uid).get().then(doc => {
                        if (doc.exists) {
                            const uData = doc.data();
                            const uRole = (uData.role || 'admin').toLowerCase();

                            if (uRole === 'courier' || uRole === 'kurir') {
                                if (firebaseAuth) firebaseAuth.signOut();
                                if (loginScreen) loginScreen.style.setProperty('display', 'flex', 'important');
                                if (mainWrapper) mainWrapper.style.setProperty('display', 'none', 'important');
                                if (err) {
                                    err.innerText = "Akses Ditolak: Akun Kurir hanya dapat digunakan pada Aplikasi Mobile HP.";
                                    err.classList.remove('d-none');
                                }
                                return;
                            }

                            currentUserRole = uRole;
                            currentUserBranchId = (uData.branchId || 'pusat').toLowerCase();

                            if (loginScreen) loginScreen.style.setProperty('display', 'none', 'important');
                            if (mainWrapper) mainWrapper.style.setProperty('display', 'flex', 'important');

                            removeBaliClientsFromMaster();

                            const branchWrapper = document.getElementById('branch-selector-wrapper');
                            const branchSelect = document.getElementById('header-branch-filter');

                            if (currentUserRole === 'branch_admin' || currentUserRole === 'branch') {
                                const branchTitle = (uData.branchName || currentUserBranchId).toUpperCase();
                                if (branchWrapper) {
                                    branchWrapper.innerHTML = `<span class="badge bg-success-subtle text-success border border-success-subtle px-3 py-2 fw-bold" style="font-size: 0.8rem;"><i class="bi bi-building me-1"></i> Cabang ${branchTitle}</span>`;
                                }
                            } else {
                                if (branchSelect) branchSelect.value = 'all';
                            }

                            if (typeof switchBranchFilter === 'function') {
                                switchBranchFilter(getActiveBranchId());
                            }

                            const profileName = document.getElementById('profile-name');
                            const profileRole = document.getElementById('profile-role');
                            if (profileName) profileName.innerText = uData.name || "admin";
                            if (profileRole) profileRole.innerHTML = `<span class="d-inline-block rounded-circle bg-success me-1" style="width: 7px; height: 7px;"></span>${currentUserRole === 'branch_admin' ? 'Admin Cabang' : 'Super Admin'}`;
                        } else {
                            if (loginScreen) loginScreen.style.setProperty('display', 'none', 'important');
                            if (mainWrapper) mainWrapper.style.setProperty('display', 'flex', 'important');
                        }
                    }).catch(e => {
                        console.warn("Could not fetch user role:", e);
                        if (loginScreen) loginScreen.style.setProperty('display', 'none', 'important');
                        if (mainWrapper) mainWrapper.style.setProperty('display', 'flex', 'important');
                    });
                } else {
                    if (loginScreen) loginScreen.style.setProperty('display', 'none', 'important');
                    if (mainWrapper) mainWrapper.style.setProperty('display', 'flex', 'important');
                }

                setTimeout(() => {
                    if (typeof initMaps === 'function') initMaps();
                    if (typeof map !== 'undefined' && map && typeof map.invalidateSize === 'function') map.invalidateSize();
                    if (typeof mapMonitor !== 'undefined' && mapMonitor && typeof mapMonitor.invalidateSize === 'function') mapMonitor.invalidateSize();
                    if (typeof mapDispatch !== 'undefined' && mapDispatch && typeof mapDispatch.invalidateSize === 'function') mapDispatch.invalidateSize();
                }, 300);
            } else {
                if (loginScreen) loginScreen.style.setProperty('display', 'flex', 'important');
                if (mainWrapper) mainWrapper.style.setProperty('display', 'none', 'important');
            }
        });
    } else {
        setTimeout(initAuthListener, 250);
    }
}

initAuthListener();

function handleLogout() {
    if (confirm("Sign out dari dashboard?")) {
        const firebaseAuth = getAuth();
        if (firebaseAuth) {
            firebaseAuth.signOut().then(() => {
                window.location.reload();
            }).catch(err => {
                alert("Logout error: " + err.message);
            });
        } else {
            window.location.reload();
        }
    }
}

function logout() {
    handleLogout();
}

async function deleteDestinationStop(tripId, stopIndex, locationName) {
    if (!confirm(`Hapus titik pengantaran "${locationName}" (#Stop ${stopIndex}) dari pengiriman ini?`)) return;

    try {
        const activeDb = getDb();
        if (!activeDb) return;
        const tripRef = activeDb.collection('trips').doc(tripId);
        const snap = await tripRef.get();

        if (!snap.exists) return showToast("Pengiriman tidak ditemukan.");

        const tData = snap.data();
        const currentDests = tData.destinations || [];

        const updatedDests = currentDests.filter(d => d.stopIndex !== stopIndex && d.locationName !== locationName);

        if (updatedDests.length === 0) {
            await tripRef.delete();
            showToast("Titik pengantaran terakhir dihapus, pengiriman dibatalkan.");
        } else {
            updatedDests.forEach((d, idx) => d.stopIndex = idx + 1);

            await tripRef.update({
                destinations: updatedDests
            });
            showToast(`Titik pengantaran "${locationName}" berhasil dihapus.`);
        }
    } catch(e) {
        console.error("Error deleting destination stop:", e);
        alert("Gagal menghapus titik pengantaran: " + e.message);
    }
}

async function restoreBayhaqiTrip() {
    try {
        const activeDb = getDb();
        if (!activeDb) return;
        const bayhaqiUid = "xONhqVSNSYcEcGCZyW2cLGJWQt92";
        const tripDocRef = activeDb.collection('trips').doc('TRIP_1788765713947');

        const destinations = [
            {
                stopIndex: 1,
                locationName: "Plaza Indonesia",
                address: "Jl. M.H. Thamrin No.28-30, Gondangdia, Kec. Menteng, Jakarta Pusat",
                latitude: -6.1931,
                longitude: 106.8218,
                status: "done",
                proofPhotoUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80"
            },
            {
                stopIndex: 2,
                locationName: "GO! GO! CURRY - Lippo Mall Nusantara",
                address: "Lippo Mall Nusantara, Jend. Sudirman, Jakarta Pusat",
                latitude: -6.2155,
                longitude: 106.8180,
                status: "done",
                proofPhotoUrl: "https://images.unsplash.com/photo-1580674684081-7617fbf3d745?auto=format&fit=crop&w=800&q=80"
            },
            {
                stopIndex: 3,
                locationName: "Gindaco - Lippo Mall Nusantara",
                address: "Lippo Mall Nusantara, Jend. Sudirman, Jakarta Pusat",
                latitude: -6.2155,
                longitude: 106.8180,
                status: "done",
                proofPhotoUrl: "https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=800&q=80"
            },
            {
                stopIndex: 4,
                locationName: "GrandLucky Superstore SCBD",
                address: "Kawasan Komersial SCBD, Jend. Sudirman, Kebayoran Baru, Jakarta Selatan",
                latitude: -6.2258,
                longitude: 106.8093,
                status: "done",
                proofPhotoUrl: "https://images.unsplash.com/photo-1566576721346-d4a3b4eaeb55?auto=format&fit=crop&w=800&q=80"
            },
            {
                stopIndex: 5,
                locationName: "Wrapindo Pratama, PT (Wrapinc)",
                address: "Jl. Kedoya Duri Raya No.64B, Kebon Jeruk, Jakarta Barat",
                latitude: -6.1725,
                longitude: 106.7621,
                status: "arrived",
                proofPhotoUrl: ""
            },
            {
                stopIndex: 6,
                locationName: "McDonald's Senayan Trade Center",
                address: "Senayan Trade Center, Gelora, Tanah Abang, Jakarta Pusat",
                latitude: -6.2231,
                longitude: 106.8005,
                status: "pending",
                proofPhotoUrl: ""
            }
        ];

        await tripDocRef.update({
            destinations: destinations,
            status: 'in_progress',
            courierId: bayhaqiUid
        }).catch(async () => {
            await tripDocRef.set({
                tripId: 'TRIP_1788765713947',
                courierId: bayhaqiUid,
                status: 'in_progress',
                date: firebase.firestore.Timestamp.now(),
                acceptedTime: firebase.firestore.Timestamp.now(),
                acceptLatitude: -6.2230,
                acceptLongitude: 106.8010,
                destinations: destinations
            });
        });

        console.log("SUCCESSFULLY RESTORED BAYHAQI TRIP TODAY!");
    } catch(e) {
        console.error("Error restoring Bayhaqi trip:", e);
    }
}

async function removeBaliClientsFromMaster() {
    const activeDb = getDb();
    if (!activeDb) return;
    try {
        const snap = await activeDb.collection('clients').get();
        snap.forEach(doc => {
            const data = doc.data();
            const text = ((data.name || '') + ' ' + (data.address || '') + ' ' + (data.region || '')).toLowerCase();
            if (text.includes('bali') || text.includes('denpasar') || text.includes('kuta') || text.includes('badung')) {
                activeDb.collection('clients').doc(doc.id).delete();
                console.log("Deleted Bali client from Master Database:", doc.id);
            }
        });
    } catch(e) {
        console.warn("Error cleaning Bali clients:", e);
    }
}

// Global window exports
window.switchTab = switchTab;
window.toggleSidebar = toggleSidebar;
window.toggleCollapse = toggleCollapse;
window.toggleDarkMode = toggleDarkMode;
window.focusOnCourier = focusOnCourier;
window.filterMonitorAll = filterMonitorAll;
window.loadClientsByRegion = loadClientsByRegion;
window.filterClients = filterClients;
window.deleteClient = deleteClient;
window.clearAllClients = clearAllClients;
window.addSelectedClients = addSelectedClients;
window.submitTrip = submitTrip;
window.toggleAllClients = toggleAllClients;
window.promptEditCourierName = promptEditCourierName;
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.logout = logout;
window.deleteDestinationStop = deleteDestinationStop;
window.openPoDModal = openPoDModal;
window.toggleNotifDropdown = toggleNotifDropdown;
window.handleNotificationClick = handleNotificationClick;
window.focusOnTrip = focusOnTrip;
window.renderRecentShipments = renderRecentShipments;
window.resetRecentFilters = resetRecentFilters;

function renderPoDArchiveView(filter = "") {
    const grid = document.getElementById('archive-photo-grid');
    if (!grid) return;

    const rawSearch = (typeof filter === 'string' ? filter : (document.getElementById('archive-search-input')?.value || "")).toLowerCase().trim();
    const selectedCourier = document.getElementById('archive-courier-filter')?.value || "all";
    const startDateVal = document.getElementById('archive-start-date')?.value;
    const endDateVal = document.getElementById('archive-end-date')?.value;

    let filterStartMs = 0;
    let filterEndMs = Infinity;

    if (startDateVal) {
        const d = new Date(startDateVal + "T00:00:00");
        if (!isNaN(d.getTime())) filterStartMs = d.getTime();
    }
    if (endDateVal) {
        const d = new Date(endDateVal + "T23:59:59.999");
        if (!isNaN(d.getTime())) filterEndMs = d.getTime();
    }

    const archiveCourierSelect = document.getElementById('archive-courier-filter');
    if (archiveCourierSelect) {
        archiveCourierSelect.innerHTML = '<option value="all">Semua Kurir</option>';
        const sortedCouriers = [];
        for (const uid in registeredUsers) {
            if (!isCourierUser(uid)) continue;
            if (typeof isCourierInActiveBranch === 'function' && !isCourierInActiveBranch(uid)) continue;
            sortedCouriers.push({ uid: uid, name: registeredUsers[uid] });
        }
        sortedCouriers.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        sortedCouriers.forEach(c => {
            archiveCourierSelect.innerHTML += `<option value="${c.name}">${c.name}</option>`;
        });
    }

    const selectedCategory = document.getElementById('archive-category-filter')?.value || "all";

    const photos = [];
    allCurrentTrips.forEach(t => {
        if (typeof isTripInActiveBranch === 'function' && !isTripInActiveBranch(t)) return;
        if (t.courierId && typeof isCourierInActiveBranch === 'function' && !isCourierInActiveBranch(t.courierId)) return;

        const cName = getCourierDisplayName(t.courierId);
        const tripIdShort = '#' + t.id.substring(Math.max(0, t.id.length - 6));
        const tripMs = t.date?.seconds ? t.date.seconds * 1000 : (t.date ? new Date(t.date).getTime() : 0);
        const tripDateStr = tripMs ? new Date(tripMs).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

        if (selectedCourier !== 'all' && cName !== selectedCourier && t.courierId !== selectedCourier) {
            return;
        }

        if (filterStartMs > 0 && (tripMs < filterStartMs || tripMs > filterEndMs)) {
            return;
        }

        if (t.destinations) {
            t.destinations.forEach((d, idx) => {
                const locName = d.locationName || 'Destination';
                const fullAddress = d.address || '';
                const stopIdx = d.stopIndex || (idx + 1);
                const uniqueShipmentId = `${tripIdShort}-${stopIdx}`;

                const searchableText = `${uniqueShipmentId} ${tripIdShort} ${t.id} ${cName} ${locName} ${fullAddress} ${tripDateStr}`.toLowerCase();
                const terms = rawSearch.split(/\s+/).filter(x => x.length > 0);
                const matchSearch = !rawSearch || terms.every(term => searchableText.includes(term));

                if (!matchSearch) return;

                // 1. Process Surat Jalan (SJ) photo
                if (d.proofPhotoSj) {
                    if (selectedCategory === 'all' || selectedCategory === 'sj') {
                        photos.push({
                            url: d.proofPhotoSj,
                            category: 'sj',
                            categoryTag: '📄 Surat Jalan',
                            badgeClass: 'bg-primary',
                            shipmentId: uniqueShipmentId,
                            clientName: locName,
                            fullAddress: fullAddress,
                            courierName: cName,
                            dateStr: tripDateStr,
                            tripMs: tripMs,
                            stopIndex: stopIdx
                        });
                    }
                }

                // 2. Process Item / Barang photos
                if (d.proofPhotoItems && Array.isArray(d.proofPhotoItems) && d.proofPhotoItems.length > 0) {
                    if (selectedCategory === 'all' || selectedCategory === 'item') {
                        d.proofPhotoItems.forEach((itemUrl, itemIdx) => {
                            if (itemUrl) {
                                photos.push({
                                    url: itemUrl,
                                    category: 'item',
                                    categoryTag: `📦 Barang #${itemIdx + 1}`,
                                    badgeClass: 'bg-success',
                                    shipmentId: uniqueShipmentId,
                                    clientName: locName,
                                    fullAddress: fullAddress,
                                    courierName: cName,
                                    dateStr: tripDateStr,
                                    tripMs: tripMs,
                                    stopIndex: stopIdx
                                });
                            }
                        });
                    }
                }

                // 3. Fallback for legacy proofPhotoUrl
                if (!d.proofPhotoSj && (!d.proofPhotoItems || d.proofPhotoItems.length === 0) && d.proofPhotoUrl) {
                    const urls = d.proofPhotoUrl.split(',').map(s => s.trim()).filter(Boolean);
                    urls.forEach((u, uIdx) => {
                        const isSj = (uIdx === 0);
                        const catKey = isSj ? 'sj' : 'item';
                        if (selectedCategory === 'all' || selectedCategory === catKey) {
                            photos.push({
                                url: u,
                                category: catKey,
                                categoryTag: isSj ? '📄 Surat Jalan' : `📦 Barang #${uIdx}`,
                                badgeClass: isSj ? 'bg-primary' : 'bg-success',
                                shipmentId: uniqueShipmentId,
                                clientName: locName,
                                fullAddress: fullAddress,
                                courierName: cName,
                                dateStr: tripDateStr,
                                tripMs: tripMs,
                                stopIndex: stopIdx
                            });
                        }
                    });
                }
            });
        }
    });

    const badge = document.getElementById('archive-count-badge');
    if (badge) badge.innerText = `${photos.length} Foto Ditemukan`;

    if (photos.length === 0) {
        grid.innerHTML = `<div class="col-12 text-center py-5 text-muted extra-small">
            <i class="bi bi-search fs-2 d-block mb-2 text-secondary"></i>
            Tidak ada foto bukti pengiriman (PoD) yang sesuai dengan filter.
        </div>`;
        return;
    }

    photos.sort((a, b) => (b.tripMs || 0) - (a.tripMs || 0));

    const gridHtml = [];
    photos.forEach(p => {
        gridHtml.push(`
            <div class="col-6 col-sm-4 col-md-3 col-lg-2">
                <div class="card h-100 border shadow-sm overflow-hidden" style="border-radius: 12px;">
                    <div class="position-relative" style="height: 120px; background: #f1f5f9;">
                        <img src="${p.url}" class="w-100 h-100 object-fit-cover cursor-pointer" onclick="openPoDModal('${p.url}')" title="Klik untuk memperbesar">
                        <span class="position-absolute top-0 start-0 m-1 badge bg-dark opacity-75 extra-small fw-normal">${p.shipmentId}</span>
                        <span class="position-absolute bottom-0 start-0 m-1 badge ${p.badgeClass || 'bg-secondary'} extra-small fw-bold" style="font-size: 0.625rem;">${p.categoryTag || 'POD'}</span>
                    </div>
                    <div class="p-2 bg-white">
                        <div class="fw-semibold extra-small text-truncate text-dark" title="${p.clientName}">${p.clientName}</div>
                        <div class="extra-small text-truncate text-muted fw-normal">${p.courierName} &bull; ${p.dateStr}</div>
                    </div>
                </div>
            </div>
        `);
    });

    grid.innerHTML = gridHtml.join('');
}

    grid.innerHTML = gridHtml.join('');
}
window.renderPoDArchiveView = renderPoDArchiveView;

function resetPoDArchiveFilter() {
    const sSearch = document.getElementById('archive-search-input');
    const sCourier = document.getElementById('archive-courier-filter');
    const sStart = document.getElementById('archive-start-date');
    const sEnd = document.getElementById('archive-end-date');

    if (sSearch) sSearch.value = "";
    if (sCourier) sCourier.value = "all";
    if (sStart) sStart.value = "";
    if (sEnd) sEnd.value = "";

    renderPoDArchiveView();
    showToast("Filter arsip dikembalikan.");
}
window.resetPoDArchiveFilter = resetPoDArchiveFilter;