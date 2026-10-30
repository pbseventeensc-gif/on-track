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
        db.settings({ experimentalAutoDetectLongPolling: true, merge: true });
    } catch (e) {
        console.log("Firestore long polling settings info:", e);
    }
}

var registeredUsers = window.registeredUsers || {};
try {
    const cached = localStorage.getItem('cached_couriers');
    if (cached) registeredUsers = JSON.parse(cached);
} catch(e) {}
window.registeredUsers = registeredUsers;
var registeredUsersObjects = window.registeredUsersObjects || {};
var userRoles = window.userRoles || {};

let tripQueue = [];
let currentChatId = null;
let chatUnsub = null;
let lastLoadedHistory = [];
var allCurrentTrips = window.allCurrentTrips || [];
window.allCurrentTrips = allCurrentTrips;
let currentOnlineCouriers = {};
let activeFilter = "";
let isDarkMode = false;
let allClients = [];
let notificationItems = [];
var currentUserRole = window.currentUserRole || "super_admin";
window.currentUserRole = currentUserRole;
let currentUserBranchId = "pusat";

window.setCurrentUserRole = function(role) {
    currentUserRole = role;
    window.currentUserRole = role;
    if (typeof applyRoleAccessControl === 'function') applyRoleAccessControl();
};

// ==========================================
// MASTER COURIER FLEET & IDENTITY MAPPING (21 Personil Master)
// ==========================================
const MASTER_COURIERS = [
    // Kurir (12 Personil)
    { canonicalId: 'ahmad', displayName: 'Ahmad', role: 'kurir', vehicleType: 'motor', defaultUid: '9dhFtf5QTQW8zmb8cZW5YFgZfmH3', matchTokens: ['ahmad', 'ahmadmotor03'] },
    { canonicalId: 'beto', displayName: 'Beto', role: 'kurir', vehicleType: 'motor', defaultUid: 'l6fLsN7ijQdq5m2tcUs2xpmMFv63', matchTokens: ['beto', 'betomotor99'] },
    { canonicalId: 'eri', displayName: 'Eri', role: 'kurir', vehicleType: 'motor', defaultUid: 'CkRWbGxehCfVOi4iMWvnm66W9NM2', matchTokens: ['eri', 'erimotor04', 'ckrwb'] },
    { canonicalId: 'irfan', displayName: 'Irfan', role: 'kurir', vehicleType: 'motor', defaultUid: 'gQyw0Ot9pWY9DuWugNK7IpwaM352', matchTokens: ['irfan', 'irfanmotor05', 'gqyw0'] },
    { canonicalId: 'baikaqi', displayName: 'Baikaqi', role: 'kurir', vehicleType: 'motor', defaultUid: 'xONhqVSNSYcEcGCZyW2cLGJWQt92', matchTokens: ['baikaqi', 'bayhaqi', 'muhamadbayhaqi0', 'xonh'] },
    { canonicalId: 'haris', displayName: 'Haris', role: 'kurir', vehicleType: 'motor', defaultUid: 'uWA0dLFxj0MsGe3YXHuvHjg1GZs1', matchTokens: ['haris', 'harismotor02', 'uwa0d'] },
    { canonicalId: 'umar', displayName: 'Umar', role: 'kurir', vehicleType: 'motor', defaultUid: 'eRg9WzDaEgPPl6jcEzo0ERYNyI82', matchTokens: ['umar', 'umarmotor01', 'erg9w'] },
    { canonicalId: 'noval', displayName: 'Noval', role: 'kurir', vehicleType: 'motor', defaultUid: 'D9hmxHZ2SJa2BgZN8DO2cT6lgGh1', matchTokens: ['noval', 'novalempah2', 'novalganteng1', 'd9hmx', 'ek74'] },
    { canonicalId: 'jay', displayName: 'Jay', role: 'kurir', vehicleType: 'motor', defaultUid: 'XFAoplNpgjc0QzqE6gcTIa5OA0r2', matchTokens: ['jay', 'andiwijaya', 'andiwijaya27', 'xfaop', '38smk'] },
    { canonicalId: 'ferdi', displayName: 'Ferdi', role: 'kurir', vehicleType: 'motor', defaultUid: 'BOMM2Wmk9LXs90qO3RWskGyIOk72', matchTokens: ['ferdi', 'fredisambo1', 'fredisambo', 'bomm2'] },
    { canonicalId: 'jagat', displayName: 'Jagat', role: 'kurir', vehicleType: 'motor', defaultUid: 'kwpGbShXoog9kFiRmevZpwTgVxv2', matchTokens: ['jagat', 'jagad', 'jagadbaru1', '3lhr', 'kwpgb'] },

    // Driver (10 Personil)
    { canonicalId: 'altur', displayName: 'Altur', role: 'driver', vehicleType: 'mobil', defaultUid: 'U7A5dYrb4iZaB7VaWMqorLeqqgg2', matchTokens: ['altur', 'alturdriver05', 'u7a5d'] },
    { canonicalId: 'rizki', displayName: 'Rizki', role: 'driver', vehicleType: 'mobil', defaultUid: 'gz9F6MqupoXEFTpOTJJ1aFjtSD52', matchTokens: ['rizki', 'rizky', 'rizkidriver07', 'gz9f6'] },
    { canonicalId: 'soleh', displayName: 'Soleh', role: 'driver', vehicleType: 'mobil', defaultUid: 'G1g9fwjcLSclVmg77ZfrVfT9dzY2', matchTokens: ['soleh', 'muhammadsoleh1', 'muhammadsoleh', 'g1g9f'] },
    { canonicalId: 'romi', displayName: 'Romi', role: 'driver', vehicleType: 'mobil', defaultUid: 'oC2EvdhruFMaKC10jmMUyYbmdtp1', matchTokens: ['romi', 'rommy', 'rommydriver19', 'oc2ev'] },
    { canonicalId: 'firdaus', displayName: 'Firdaus', role: 'driver', vehicleType: 'mobil', defaultUid: 'KgKbQdpUHmcQzu2o8N6czx0N7EP2', matchTokens: ['firdaus', 'kgkbq'] },
    { canonicalId: 'alan', displayName: 'Alan', role: 'driver', vehicleType: 'mobil', defaultUid: 'unNGSiqnOifJSXyQDRiiqlWd83q2', matchTokens: ['alan', 'alanpasming', 'alanpasming1', 'unngs', 'limd'] },
    { canonicalId: 'yakub', displayName: 'Yakub', role: 'driver', vehicleType: 'mobil', defaultUid: '17zXKPw8SFXDhW6Z6lc547R4TEE2', matchTokens: ['yakub', 'yakubdriver08', '17zxk'] },
    { canonicalId: 'iwan', displayName: 'Iwan', role: 'driver', vehicleType: 'mobil', defaultUid: 'J3wejohLG5dXbX0im5ozeGzpjzt2', matchTokens: ['iwan', 'iwandriver04', 'j3wej'] },
    { canonicalId: 'agung', displayName: 'Agung', role: 'driver', vehicleType: 'mobil', defaultUid: 'RLLeIifIbmVj1HHKALY40n1lKRr1', matchTokens: ['agung', 'agungdriver10', 'rllei'] },
    { canonicalId: 'husen', displayName: 'Husen', role: 'driver', vehicleType: 'mobil', defaultUid: 'juHUuOWS4FOVpHxE59t4xf0ld1z1', matchTokens: ['husen', 'husensuka3', 'husensuka', 'juhu'] }
];
window.MASTER_COURIERS = MASTER_COURIERS;

const COURIER_FLEET_MAPPING = {
    mobil: MASTER_COURIERS.filter(m => m.vehicleType === 'mobil').map(m => m.canonicalId),
    motor: MASTER_COURIERS.filter(m => m.vehicleType === 'motor').map(m => m.canonicalId)
};
window.COURIER_FLEET_MAPPING = COURIER_FLEET_MAPPING;

const COURIER_PHOTO_MAP = {
    'agung': '/assets/couriers/Agung.jpeg',
    'ahmad': '/assets/couriers/Ahmad.jpeg',
    'baikaqi': '/assets/couriers/Baykaqi.jpeg',
    'bayhaqi': '/assets/couriers/Baykaqi.jpeg',
    'baykaqi': '/assets/couriers/Baykaqi.jpeg',
    'beto': '/assets/couriers/Beto.jpeg',
    'eri': '/assets/couriers/Eri.jpeg',
    'haris': '/assets/couriers/Haris.jpeg',
    'husen': '/assets/couriers/Husen.jpeg',
    'irfan': '/assets/couriers/Irfan.jpeg',
    'jagat': '/assets/couriers/Jagat.jpeg',
    'jagad': '/assets/couriers/Jagat.jpeg',
    'jagatbaru1': '/assets/couriers/Jagat.jpeg',
    'jay': '/assets/couriers/Jaya.jpeg',
    'jaya': '/assets/couriers/Jaya.jpeg',
    'noval': '/assets/couriers/Noval.jpeg',
    'novalempah2': '/assets/couriers/Noval.jpeg',
    'rizki': '/assets/couriers/Rizki.jpeg',
    'umar': '/assets/couriers/Umar.jpeg'
};
window.COURIER_PHOTO_MAP = COURIER_PHOTO_MAP;

function getCourierPhoto(cId, cName) {
    if (!cId && !cName) return null;
    const norm = (typeof normalizeCourierIdentity === 'function') 
        ? normalizeCourierIdentity(cId, cName) 
        : { canonicalId: (cId || '').toLowerCase() };

    const canon = norm.canonicalId || (cId || '').toLowerCase();
    if (COURIER_PHOTO_MAP[canon]) return COURIER_PHOTO_MAP[canon];

    const str = `${cId || ''} ${cName || ''}`.toLowerCase();
    for (const k in COURIER_PHOTO_MAP) {
        if (str.includes(k)) return COURIER_PHOTO_MAP[k];
    }
    return null;
}
window.getCourierPhoto = getCourierPhoto;

function normalizeCourierIdentity(cId, cName) {
    const id = (cId || '').trim();
    let name = (cName || '').trim();

    // 1. Direct match on defaultUid
    const matchByUid = MASTER_COURIERS.find(m => m.defaultUid === id);
    if (matchByUid) {
        return {
            canonicalId: matchByUid.canonicalId,
            displayName: matchByUid.displayName,
            vehicleType: matchByUid.vehicleType,
            role: matchByUid.role,
            uid: matchByUid.defaultUid,
            isMaster: true
        };
    }

    // 2. Direct match on canonicalId or exact displayName
    const matchByCanon = MASTER_COURIERS.find(m =>
        m.canonicalId.toLowerCase() === id.toLowerCase() ||
        m.displayName.toLowerCase() === id.toLowerCase() ||
        (name && m.displayName.toLowerCase() === name.toLowerCase())
    );
    if (matchByCanon) {
        return {
            canonicalId: matchByCanon.canonicalId,
            displayName: matchByCanon.displayName,
            vehicleType: matchByCanon.vehicleType,
            role: matchByCanon.role,
            uid: matchByCanon.defaultUid,
            isMaster: true
        };
    }

    // 3. Resolve user object from registeredUsersObjects (if available)
    let userObj = null;
    if (typeof registeredUsersObjects !== 'undefined' && registeredUsersObjects) {
        userObj = registeredUsersObjects[id] || registeredUsersObjects[id.toLowerCase()];
        if (!userObj) {
            const keys = Object.keys(registeredUsersObjects);
            for (let i = 0; i < keys.length; i++) {
                const u = registeredUsersObjects[keys[i]];
                if (!u) continue;
                if (u.userId === id ||
                    (u.email && (u.email === id || u.email.toLowerCase() === id.toLowerCase())) ||
                    (u.name && u.name.toLowerCase() === id.toLowerCase())) {
                    userObj = u;
                    break;
                }
            }
        }
    }

    if (userObj) {
        if (!name) name = userObj.name || userObj.email || id;
        if (userObj.userId) {
            const matchUserObjUid = MASTER_COURIERS.find(m => m.defaultUid === userObj.userId);
            if (matchUserObjUid) {
                return {
                    canonicalId: matchUserObjUid.canonicalId,
                    displayName: matchUserObjUid.displayName,
                    vehicleType: matchUserObjUid.vehicleType,
                    role: matchUserObjUid.role,
                    uid: matchUserObjUid.defaultUid,
                    isMaster: true
                };
            }
        }
    } else if (!name && typeof registeredUsers !== 'undefined' && registeredUsers[id]) {
        name = registeredUsers[id];
    }

    // 4. Token & string matching
    const emailStr = (userObj?.email || '').toLowerCase();
    const nameStr = (name || '').toLowerCase();
    const idStr = id.toLowerCase();
    const fullSearchStr = `${idStr} ${nameStr} ${emailStr}`;

    for (const m of MASTER_COURIERS) {
        for (const token of m.matchTokens) {
            if (token.length <= 4) {
                const regex = new RegExp('(?:^|[^a-z0-9])' + token + '(?:$|[^a-z0-9]|motor|driver|@)', 'i');
                if (regex.test(fullSearchStr)) {
                    return {
                        canonicalId: m.canonicalId,
                        displayName: m.displayName,
                        vehicleType: m.vehicleType,
                        role: m.role,
                        uid: m.defaultUid,
                        isMaster: true
                    };
                }
            } else {
                if (fullSearchStr.includes(token)) {
                    return {
                        canonicalId: m.canonicalId,
                        displayName: m.displayName,
                        vehicleType: m.vehicleType,
                        role: m.role,
                        uid: m.defaultUid,
                        isMaster: true
                    };
                }
            }
        }
    }

    // Fallback if not one of 22 master
    let vType = 'motor';
    if (COURIER_FLEET_MAPPING.mobil.some(m => fullSearchStr.includes(m))) {
        vType = 'mobil';
    }
    return {
        canonicalId: id || 'unknown',
        displayName: name || id || 'Unknown',
        vehicleType: vType,
        role: vType === 'mobil' ? 'driver' : 'kurir',
        uid: id,
        isMaster: false
    };
}
window.normalizeCourierIdentity = normalizeCourierIdentity;

function isRecognizedCourier(cId, cName) {
    if (!cId && !cName) return false;
    const nameStr = String(cName || '').trim();
    if (nameStr.startsWith('Carrier') || nameStr.startsWith('Carrier (') || nameStr.toLowerCase().includes('carrier')) return false;

    const norm = normalizeCourierIdentity(cId, cName);
    if (!norm) return false;
    return !!norm.isMaster;
}
window.isRecognizedCourier = isRecognizedCourier;

function getCourierVehicleType(cId, cName) {
    const info = normalizeCourierIdentity(cId, cName);
    return info.vehicleType;
}
window.getCourierVehicleType = getCourierVehicleType;

function onDispatchCourierChange() {
    const sel = document.getElementById('sel-courier');
    const infoDiv = document.getElementById('dispatch-courier-auto-info');
    const badge = document.getElementById('dispatch-courier-vehicle-badge');
    const radMotor = document.getElementById('veh-motor');
    const radMobil = document.getElementById('veh-mobil');

    if (!sel || !sel.value) {
        if (infoDiv) infoDiv.style.display = 'none';
        return;
    }

    const cid = sel.value;
    const cName = (typeof registeredUsers !== 'undefined') ? (registeredUsers[cid] || '') : '';
    const courierInfo = normalizeCourierIdentity(cid, cName);

    if (courierInfo.vehicleType === 'mobil') {
        if (radMobil) radMobil.checked = true;
        if (radMotor) radMotor.checked = false;
        if (badge) {
            badge.className = 'badge bg-primary-subtle text-primary border border-primary-subtle px-2.5 py-1 fw-semibold';
            badge.innerText = 'Driver Mobil';
        }
    } else {
        if (radMotor) radMotor.checked = true;
        if (radMobil) radMobil.checked = false;
        if (badge) {
            badge.className = 'badge bg-secondary-subtle text-dark border px-2.5 py-1 fw-semibold';
            badge.innerText = 'Kurir Motor';
        }
    }
    if (infoDiv) infoDiv.style.display = 'block';
}
window.onDispatchCourierChange = onDispatchCourierChange;

function getLocalTodayDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
window.getLocalTodayDateString = getLocalTodayDateString;

function parseDateBoundary(dateVal, isEnd = false) {
    if (!dateVal || typeof dateVal !== 'string') return null;
    const trimmed = dateVal.trim();
    if (!trimmed) return null;

    let y, m, d;
    if (trimmed.includes('-')) {
        const parts = trimmed.split('-');
        if (parts[0].length === 4) {
            y = parseInt(parts[0], 10);
            m = parseInt(parts[1], 10) - 1;
            d = parseInt(parts[2], 10);
        } else {
            d = parseInt(parts[0], 10);
            m = parseInt(parts[1], 10) - 1;
            y = parseInt(parts[2], 10);
        }
    } else if (trimmed.includes('/')) {
        const parts = trimmed.split('/');
        if (parts[0].length === 4) {
            y = parseInt(parts[0], 10);
            m = parseInt(parts[1], 10) - 1;
            d = parseInt(parts[2], 10);
        } else {
            d = parseInt(parts[0], 10);
            m = parseInt(parts[1], 10) - 1;
            y = parseInt(parts[2], 10);
        }
    } else {
        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) {
            y = parsed.getFullYear();
            m = parsed.getMonth();
            d = parsed.getDate();
        }
    }

    if (isNaN(y) || isNaN(m) || isNaN(d)) return null;

    if (isEnd) {
        return new Date(y, m, d, 23, 59, 59, 999).getTime();
    } else {
        return new Date(y, m, d, 0, 0, 0, 0).getTime();
    }
}
window.parseDateBoundary = parseDateBoundary;

function initDefaultDateFilters() {
    const todayStr = getLocalTodayDateString();
    const sStart = document.getElementById('recent-start-date');
    const sEnd = document.getElementById('recent-end-date');
    if (sStart && !sStart.value) sStart.value = todayStr;
    if (sEnd && !sEnd.value) sEnd.value = todayStr;

    const aStart = document.getElementById('archive-start-date');
    const aEnd = document.getElementById('archive-end-date');
    if (aStart && !aStart.value) aStart.value = todayStr;
    if (aEnd && !aEnd.value) aEnd.value = todayStr;
}
window.initDefaultDateFilters = initDefaultDateFilters;

function setRecentDateAllTime() {
    const sStart = document.getElementById('recent-start-date');
    const sEnd = document.getElementById('recent-end-date');
    const sDate = document.getElementById('recent-date-filter');
    if (sStart) sStart.value = "";
    if (sEnd) sEnd.value = "";
    if (sDate) sDate.value = "all";
    renderRecentShipments();
    showToast("Menampilkan data pengiriman Semua Tanggal.");
}
window.setRecentDateAllTime = setRecentDateAllTime;

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
    if (!activeBranch || activeBranch === 'all') return true;
    if (!t || !t.branchId) return true;
    const tripBranch = getTripBranch(t);
    return tripBranch === activeBranch;
}
window.isTripInActiveBranch = isTripInActiveBranch;

function isCourierInActiveBranch(courierUidOrName) {
    const activeBranch = getActiveBranchId();
    if (!activeBranch || activeBranch === 'all') return true;
    return true;
}
window.isCourierInActiveBranch = isCourierInActiveBranch;

function switchBranchFilter(branchVal) {
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

function getCourierColor(id, optName = '') {
    if (typeof window.getCourierColor === 'function' && window.getCourierColor !== getCourierColor) {
        return window.getCourierColor(id, optName);
    }
    const checkStr = (String(optName || '') + ' ' + String(id || '')).toLowerCase();
    if (checkStr.includes('ahmad')) return '#2563EB';
    if (checkStr.includes('beto')) return '#0D9488';
    if (checkStr.includes('eri')) return '#16A34A';
    if (checkStr.includes('irfan')) return '#D97706';
    if (checkStr.includes('baikaqi') || checkStr.includes('bayhaqi')) return '#9333EA';
    if (checkStr.includes('haris')) return '#DB2777';
    if (checkStr.includes('umar')) return '#0284C7';
    if (checkStr.includes('noval')) return '#EA580C';
    if (checkStr.includes('jay')) return '#4F46E5';
    if (checkStr.includes('ferdi')) return '#059669';
    if (checkStr.includes('jagat') || checkStr.includes('jagad')) return '#C026D3';
    if (checkStr.includes('altur')) return '#E11D48';
    if (checkStr.includes('rizki')) return '#7C3AED';
    if (checkStr.includes('soleh')) return '#0891B2';
    if (checkStr.includes('romi')) return '#D946EF';
    if (checkStr.includes('firdaus')) return '#CA8A04';
    if (checkStr.includes('alan')) return '#475569';
    if (checkStr.includes('yakub')) return '#DC2626';
    if (checkStr.includes('iwan')) return '#65A30D';
    if (checkStr.includes('agung')) return '#0369A1';
    if (checkStr.includes('husen')) return '#B45309';

    const colors = ['#2563EB', '#0D9488', '#16A34A', '#D97706', '#9333EA', '#DB2777', '#0284C7', '#EA580C', '#4F46E5', '#059669', '#C026D3', '#E11D48', '#7C3AED', '#0891B2', '#D946EF', '#CA8A04', '#475569', '#DC2626', '#65A30D', '#0369A1', '#B45309'];
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

function getCourierDisplayName(courierId) {
    if (!courierId) return "";

    const norm = normalizeCourierIdentity(courierId, "");
    if (norm && norm.isMaster) {
        return norm.displayName;
    }

    if (typeof registeredUsers !== 'undefined' && registeredUsers) {
        const uName = registeredUsers[courierId] || registeredUsers[courierId.toLowerCase()];
        if (uName && !uName.toLowerCase().startsWith('carrier')) return uName;
    }

    if (typeof registeredUsersObjects !== 'undefined' && registeredUsersObjects) {
        const u = registeredUsersObjects[courierId] || registeredUsersObjects[courierId.toLowerCase()];
        if (u) {
            if (u.name && !u.name.toLowerCase().startsWith('carrier')) return u.name;
            if (u.email && !u.email.toLowerCase().startsWith('carrier')) return u.email.split('@')[0];
        }
        for (let k in registeredUsersObjects) {
            const user = registeredUsersObjects[k];
            if (user && (user.userId === courierId || user.courierId === courierId)) {
                const targetName = user.name || user.email || '';
                if (targetName && !targetName.toLowerCase().startsWith('carrier')) return targetName;
            }
        }
    }

    return "";
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

function extractDestinationPhotos(d, t = null) {
    if (!d) d = {};

    let explicitSj = '';
    let explicitItems = [];

    if (d.proofPhotoSj && typeof d.proofPhotoSj === 'string' && d.proofPhotoSj.trim().length > 0) {
        explicitSj = d.proofPhotoSj.split(',')[0].trim();
    }

    if (d.proofPhotoItems) {
        if (Array.isArray(d.proofPhotoItems)) {
            explicitItems = d.proofPhotoItems.map(u => String(u).trim()).filter(Boolean);
        } else if (typeof d.proofPhotoItems === 'string' && d.proofPhotoItems.trim().length > 0) {
            explicitItems = d.proofPhotoItems.split(',').map(u => u.trim()).filter(Boolean);
        }
    }

    const allUrls = [];
    const addUrl = (val) => {
        if (!val) return;
        if (Array.isArray(val)) {
            val.forEach(u => addUrl(u));
        } else if (typeof val === 'string') {
            val.split(',').forEach(u => {
                const clean = u.trim();
                if (clean && !allUrls.includes(clean)) allUrls.push(clean);
            });
        }
    };

    if (explicitSj) addUrl(explicitSj);
    if (explicitItems.length > 0) addUrl(explicitItems);
    if (d.proofPhotoUrl) addUrl(d.proofPhotoUrl);
    if (d.pendingProofPhotoUrl) addUrl(d.pendingProofPhotoUrl);
    if (d.proofUrl) addUrl(d.proofUrl);
    if (d.photoUrl) addUrl(d.photoUrl);
    if (d.photo) addUrl(d.photo);
    if (d.proofPhoto) addUrl(d.proofPhoto);
    if (d.proof) addUrl(d.proof);
    if (d.imgUrl) addUrl(d.imgUrl);
    if (d.image) addUrl(d.image);

    if (t) {
        if (t.adminBulkSjUrl) addUrl(t.adminBulkSjUrl);
        if (t.adminBulkSjUrls) addUrl(t.adminBulkSjUrls);
        if (t.proofPhotoUrl) addUrl(t.proofPhotoUrl);
    }

    if (allUrls.length === 0) {
        return { sjUrl: '', itemUrl: '', itemUrls: [], pendingUrl: '', allUrls: [] };
    }

    let sjUrl = explicitSj || allUrls[0];
    let itemUrls = explicitItems.length > 0 ? explicitItems : allUrls.filter(u => u !== sjUrl);

    if (itemUrls.length === 0 && explicitItems.length > 0) {
        itemUrls = explicitItems;
    } else if (itemUrls.length === 0 && sjUrl) {
        itemUrls = [sjUrl];
    }

    return {
        sjUrl: sjUrl,
        itemUrl: itemUrls.join(','),
        itemUrls: itemUrls,
        pendingUrl: d.pendingProofPhotoUrl || '',
        allUrls: allUrls
    };
}

function isTripInDateRange(t, startMs, endMs) {
    if (!t) return false;
    if ((!startMs || startMs <= 0) && (!endMs || endMs === Infinity)) return true;

    const parseMs = function(obj) {
        if (!obj) return 0;
        if (typeof obj === 'number') return obj;
        if (obj.seconds !== undefined) return obj.seconds * 1000;
        if (obj._seconds !== undefined) return obj._seconds * 1000;
        if (typeof obj === 'string') {
            const d = new Date(obj);
            return isNaN(d.getTime()) ? 0 : d.getTime();
        }
        if (obj instanceof Date) return obj.getTime();
        return 0;
    };

    let tripMs = parseMs(t.date) || parseMs(t.assignedTime) || parseMs(t.acceptedTime);
    if (!tripMs && t.id && t.id.startsWith('TRIP_')) {
        tripMs = parseInt(t.id.replace('TRIP_', '')) || 0;
    }

    const minMs = startMs || 0;
    const maxMs = endMs || Infinity;

    // 1. Created/assigned date is in range
    if (tripMs > 0 && tripMs >= minMs && tripMs <= maxMs) {
        return true;
    }

    // 2. Destination activity (completed, arrival, or photo uploaded) is in range
    if (t.destinations && Array.isArray(t.destinations)) {
        for (let i = 0; i < t.destinations.length; i++) {
            const d = t.destinations[i];
            if (!d) continue;

            const completedMs = parseMs(d.completedTime);
            const arrivalMs = parseMs(d.arrivalTime);

            if (completedMs > 0 && completedMs >= minMs && completedMs <= maxMs) return true;
            if (arrivalMs > 0 && arrivalMs >= minMs && arrivalMs <= maxMs) return true;

            const hasPhoto = !!(d.proofPhotoUrl || d.proofPhotoSj || (d.proofPhotoItems && d.proofPhotoItems.length > 0) || d.pendingProofPhotoUrl);
            if (hasPhoto && (d.status === 'done' || d.status === 'completed' || d.status === 'pending_approval')) {
                if (completedMs > 0) {
                    if (completedMs >= minMs && completedMs <= maxMs) return true;
                } else if (arrivalMs > 0) {
                    if (arrivalMs >= minMs && arrivalMs <= maxMs) return true;
                } else {
                    if (tripMs >= minMs - (3 * 86400000) && tripMs <= maxMs) return true;
                }
            }
        }
    }

    return false;
}
window.isTripInDateRange = isTripInDateRange;

function openPoDModal(url) {
    if (!url) return;
    const urls = url.split(',').map(s => s.trim()).filter(Boolean);
    if (urls.length === 0) return;

    const img = document.getElementById('modalImg');
    const btn = document.getElementById('downloadBtn');
    const thumbContainer = document.getElementById('modalThumbnails');

    function setActiveImage(idx) {
        const targetUrl = urls[idx];
        if (img) img.src = targetUrl;
        if (btn) btn.href = targetUrl;

        if (thumbContainer && urls.length > 1) {
            const thumbs = thumbContainer.querySelectorAll('img');
            thumbs.forEach((t, i) => {
                if (i === idx) {
                    t.style.border = '2px solid #3B82F6';
                    t.style.opacity = '1';
                } else {
                    t.style.border = '2px solid transparent';
                    t.style.opacity = '0.5';
                }
            });
        }
    }

    if (thumbContainer) {
        if (urls.length > 1) {
            thumbContainer.style.setProperty('display', 'flex', 'important');
            thumbContainer.innerHTML = urls.map((u, i) => `
                <img src="${u}" class="rounded cursor-pointer" style="width: 44px; height: 44px; object-fit: cover; transition: all 0.2s;" onclick="window._setActivePoDImage(${i})" title="Foto #${i + 1}">
            `).join('');
            window._setActivePoDImage = setActiveImage;
        } else {
            thumbContainer.style.setProperty('display', 'none', 'important');
            thumbContainer.innerHTML = '';
        }
    }

    setActiveImage(0);

    const modalEl = document.getElementById('imageModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        let instance = bootstrap.Modal.getInstance(modalEl);
        if (!instance) instance = new bootstrap.Modal(modalEl);
        instance.show();
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

function updateHeaderDate() {
    const el = document.getElementById('current-date-text');
    if (el) {
        const now = new Date();
        const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        el.innerText = now.toLocaleDateString('id-ID', options);
    }
}
document.addEventListener('DOMContentLoaded', updateHeaderDate);
setTimeout(updateHeaderDate, 100);

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
        if (t.destinations) {
            t.destinations.forEach(d => {
                if (d.status === 'pending_approval') {
                    const cName = registeredUsers[t.courierId] || t.courierId.substring(0,8);
                    notificationItems.push({
                        type: 'warning',
                        icon: 'bi-exclamation-triangle',
                        title: `Lapor Klien Tutup: ${d.locationName || 'Destination'}`,
                        desc: `Kurir ${cName} mengajukan pending (${d.pendingReason || 'Klien Tutup'})`,
                        tab: 'dashboard',
                        tripId: t.id,
                        courierId: t.courierId
                    });
                }
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
        const tripMs = t.date?.seconds ? t.date.seconds * 1000 : (t.date ? new Date(t.date).getTime() : (t.id ? parseInt(t.id.replace('TRIP_', '')) || 0 : 0));

        // Auto-expire alerts on H+1: Only generate Priority Alerts for TODAY'S active trips
        if (tripMs < todayDayMs) {
            return;
        }

        // Pending Approval Alerts (Klien Tutup)
        if (t.destinations) {
            t.destinations.forEach((d) => {
                if (d.status === 'pending_approval') {
                    const alertId = `pending_app_${t.id}_${d.stopIndex}`;
                    if (!dismissedAlertIds.has(alertId)) {
                        const podBtn = d.pendingProofPhotoUrl ? `<button class="btn btn-xs btn-light border py-0.5 px-2 ms-1 extra-small rounded-pill text-danger fw-bold" onclick="openPoDModal('${d.pendingProofPhotoUrl}')"><i class="bi bi-camera me-1"></i>Foto Lokasi Tutup</button>` : '';
                        container.innerHTML += `
                            <div class="d-flex align-items-center justify-content-between p-2.5 px-3 rounded-3 mb-1" style="background: #FFF7ED; border-left: 4px solid #EA580C;">
                                <div class="d-flex align-items-center gap-2 flex-grow-1">
                                    <div class="text-warning fs-5 d-flex align-items-center me-1"><i class="bi bi-exclamation-triangle-fill"></i></div>
                                    <div class="flex-grow-1">
                                        <div class="fw-bold text-dark" style="font-size: 0.8125rem; line-height: 1.25;">Lapor Klien Tutup: ${d.locationName || 'Destination'} ${podBtn}</div>
                                        <div class="text-danger fw-semibold" style="font-size: 0.725rem; margin-top: 1px;">Alasan: ${d.pendingReason || 'Klien Tutup'} (${cName})</div>
                                        <div class="d-flex gap-1 mt-1.5">
                                            <button class="btn btn-xs btn-success py-0.5 px-2.5 fw-bold" style="font-size: 0.7rem;" onclick="approveDestinationPending('${t.id}', ${d.stopIndex})"><i class="bi bi-check-circle me-1"></i>Setujui Pending</button>
                                            <button class="btn btn-xs btn-outline-danger py-0.5 px-2.5 fw-bold" style="font-size: 0.7rem;" onclick="rejectDestinationPending('${t.id}', ${d.stopIndex})"><i class="bi bi-x-circle me-1"></i>Tolak</button>
                                        </div>
                                    </div>
                                </div>
                                <button class="btn-close ms-2 align-self-start" style="font-size: 0.65rem;" onclick="dismissSingleAlert('${alertId}', event)" title="Hapus Peringatan Ini"></button>
                            </div>`;
                    }
                }
            });
        }
    });

    if(container.innerHTML === '') {
        container.innerHTML = '<div class="text-center py-4 text-muted extra-small"><i class="bi bi-check-circle text-success me-1"></i> Tidak ada permohonan pending/klien tutup.</div>';
    }
}

async function approveDestinationPending(tripId, stopIndex) {
    try {
        const activeDb = getDb();
        if (!activeDb) return;
        const tripRef = activeDb.collection('trips').doc(tripId);
        const doc = await tripRef.get();
        if (doc.exists) {
            const trip = doc.data();
            const updatedDests = (trip.destinations || []).map(d => {
                if (d.stopIndex === stopIndex || (d.stopIndex === undefined && d.locationName)) {
                    return { ...d, status: 'pending' };
                }
                return d;
            });
            await tripRef.update({ destinations: updatedDests });
            showToast("✅ Permohonan Pending (Klien Tutup) Disetujui!");
            if (typeof updateDynamicAlerts === 'function') updateDynamicAlerts();
            if (typeof renderRecentShipments === 'function') renderRecentShipments();
        }
    } catch(e) {
        alert("Gagal memproses approval: " + e.message);
    }
}
window.approveDestinationPending = approveDestinationPending;

async function rejectDestinationPending(tripId, stopIndex) {
    try {
        const activeDb = getDb();
        if (!activeDb) return;
        const tripRef = activeDb.collection('trips').doc(tripId);
        const doc = await tripRef.get();
        if (doc.exists) {
            const trip = doc.data();
            const updatedDests = (trip.destinations || []).map(d => {
                if (d.stopIndex === stopIndex || (d.stopIndex === undefined && d.locationName)) {
                    return { ...d, status: 'arrived' };
                }
                return d;
            });
            await tripRef.update({ destinations: updatedDests });
            showToast("❌ Permohonan Pending Ditolak. Status dikembalikan ke Arrived.");
            if (typeof updateDynamicAlerts === 'function') updateDynamicAlerts();
            if (typeof renderRecentShipments === 'function') renderRecentShipments();
        }
    } catch(e) {
        alert("Gagal menolak permohonan: " + e.message);
    }
}
window.rejectDestinationPending = rejectDestinationPending;

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

function getRoleDisplayName(role) {
    const r = (role || '').toLowerCase();
    if (r === 'sales_admin' || r === 'sales') return 'Sales Admin';
    if (r === 'admin_logistik' || r === 'adminlogistik') return 'Admin Logistik';
    if (r === 'admin_dm2' || r === 'dm2') return 'Admin DM2';
    if (r === 'branch_admin' || r === 'branch') return 'Admin Cabang';
    if (r === 'trafik' || r === 'traffic') return 'Trafik';
    return 'Super Admin';
}

function isTabAllowedForRole(role, viewId) {
    if (!role) return false;
    const r = String(role).toLowerCase();
    const isCentralAdmin = (
        r === 'super_admin' ||
        r === 'superadmin' ||
        r === 'admin' ||
        r === 'admin_logistik' ||
        r === 'adminlogistik'
    ) && (
        r !== 'sales_admin' &&
        r !== 'sales' &&
        r !== 'admin_dm2' &&
        r !== 'dm2' &&
        r !== 'branch_admin' &&
        r !== 'branch' &&
        r !== 'courier' &&
        r !== 'kurir' &&
        r !== 'traffic' &&
        r !== 'trafik'
    );

    // AUDIT KURIR HARIAN: HANYA ADA DI MENU SUPERADMIN / ADMIN PUSAT (TIDAK BOLEH DI LOGIN CABANG, SALES, KURIR)
    if (viewId === 'courier-audit') {
        return isCentralAdmin;
    }

    // INVENTARIS ARMADA KENDARAAN (fleet_vehicles): SUPER ADMIN ONLY
    if (viewId === 'fleet-inventory') {
        return r === 'super_admin' || r === 'superadmin' || r === 'admin';
    }

    if (isCentralAdmin) {
        return true;
    }
    if (r === 'sales_admin' || r === 'sales') {
        return viewId === 'dashboard' || viewId === 'monitor' || viewId === 'pod-archive';
    }
    if (r === 'admin_dm2' || r === 'dm2' || r === 'branch_admin' || r === 'branch') {
        return viewId === 'dashboard' || viewId === 'monitor' || viewId === 'dispatch' || viewId === 'pod-archive';
    }
    return false;
}

function applyRoleAccessControl() {
    const r = (currentUserRole || '').toLowerCase();
    const isCentralAdmin = (
        r === 'super_admin' ||
        r === 'superadmin' ||
        r === 'admin' ||
        r === 'admin_logistik' ||
        r === 'adminlogistik'
    ) && (
        r !== 'sales_admin' &&
        r !== 'sales' &&
        r !== 'admin_dm2' &&
        r !== 'dm2' &&
        r !== 'branch_admin' &&
        r !== 'branch' &&
        r !== 'courier' &&
        r !== 'kurir' &&
        r !== 'traffic' &&
        r !== 'trafik'
    );

    const navDashboard = document.getElementById('nav-dashboard');
    const navMonitor = document.getElementById('nav-monitor');
    const navDispatch = document.getElementById('nav-dispatch');
    const navFleet = document.getElementById('nav-fleet');
    const navPool = document.getElementById('nav-pool');
    const navChat = document.getElementById('nav-chat');
    const navPodArchive = document.getElementById('nav-pod-archive');
    const navReports = document.getElementById('nav-reports');
    const navSettings = document.getElementById('nav-settings');
    const navCourierAudit = document.getElementById('nav-courier-audit');
    const navFleetInventory = document.getElementById('nav-fleet-inventory');

    const isSuperAdminOnly = (r === 'super_admin' || r === 'superadmin' || r === 'admin');

    // 1. AUDIT KURIR HARIAN: HANYA ADA DI MENU SUPERADMIN / ADMIN PUSAT (TIDAK BOLEH DI LOGIN LAIN)
    if (navCourierAudit) {
        navCourierAudit.style.display = isCentralAdmin ? 'flex' : 'none';
    }

    // 2. INVENTARIS ARMADA (fleet_vehicles): SUPER ADMIN ONLY
    if (navFleetInventory) {
        navFleetInventory.style.display = isSuperAdminOnly ? 'flex' : 'none';
    }

    // Jika user non-superadmin sedang berada di view courier-audit atau fleet-inventory, alihkan ke dashboard
    if (!isCentralAdmin) {
        const auditView = document.getElementById('view-courier-audit');
        if (auditView && (auditView.classList.contains('active') || auditView.style.display !== 'none')) {
            if (typeof switchTab === 'function') switchTab('dashboard');
        }
    }
    if (!isSuperAdminOnly) {
        const fleetInvView = document.getElementById('view-fleet-inventory');
        if (fleetInvView && (fleetInvView.classList.contains('active') || fleetInvView.style.display !== 'none')) {
            if (typeof switchTab === 'function') switchTab('dashboard');
        }
    }

    [navDashboard, navMonitor, navDispatch, navFleet, navPool, navChat, navPodArchive, navReports, navSettings].forEach(el => {
        if (el) el.style.display = '';
    });

    if (r === 'sales_admin' || r === 'sales') {
        if (navDispatch) navDispatch.style.display = 'none';
        if (navFleet) navFleet.style.display = 'none';
        if (navPool) navPool.style.display = 'none';
        if (navChat) navChat.style.display = 'none';
        if (navReports) navReports.style.display = 'none';
        if (navSettings) navSettings.style.display = 'none';
    } else if (r === 'admin_dm2' || r === 'dm2' || r === 'branch_admin' || r === 'branch') {
        if (navFleet) navFleet.style.display = 'none';
        if (navChat) navChat.style.display = 'none';
        if (navReports) navReports.style.display = 'none';
        if (navSettings) navSettings.style.display = 'none';
    }
}

function switchTab(viewId, el) {
    if (!isTabAllowedForRole(currentUserRole, viewId)) {
        showToast("⚠️ Akses dibatasi untuk " + getRoleDisplayName(currentUserRole) + ".");
        if (viewId !== 'dashboard') {
            switchTab('dashboard');
        }
        return;
    }

    // Hide all view sections
    document.querySelectorAll('.view-section').forEach(v => {
        v.classList.remove('active');
        v.style.display = 'none';
    });

    // Show target section
    const target = document.getElementById('view-' + viewId);
    if (target) {
        target.classList.add('active');
        target.style.display = 'block';
    }

    // Deactivate all nav links
    document.querySelectorAll('.nav-link-custom').forEach(l => l.classList.remove('active'));

    // Activate selected nav link
    const navItem = (el && typeof el.closest === 'function') ? el.closest('.nav-link-custom') : document.getElementById('nav-' + viewId);
    if (navItem) {
        navItem.classList.add('active');
    } else {
        const fallbackNav = document.getElementById('nav-' + viewId) || document.querySelector(`[onclick*="${viewId}"]`);
        if (fallbackNav) fallbackNav.classList.add('active');
    }

    // Close mobile sidebar if open
    const sb = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sb) sb.classList.remove('open');
    if (backdrop) backdrop.classList.remove('active');

    if (typeof refreshMapSizes === 'function') refreshMapSizes();

    // Trigger tab specific data renders
    if (viewId === 'dashboard') {
        if (typeof updateGlobalStats === 'function') updateGlobalStats();
        if (typeof renderRecentShipments === 'function') renderRecentShipments();
    } else if (viewId === 'monitor') {
        if (typeof renderMonitorUI === 'function') renderMonitorUI();
    } else if (viewId === 'dispatch') {
        if (typeof renderCourierOptions === 'function') renderCourierOptions();
        if (typeof loadClientsByRegion === 'function') loadClientsByRegion("");
    } else if (viewId === 'fleet') {
        if (typeof updateKPIChartsFromFilter === 'function') updateKPIChartsFromFilter();
        else if (typeof renderKPIView === 'function') renderKPIView();
    } else if (viewId === 'chat') {
        if (typeof loadChatList === 'function') loadChatList();
    } else if (viewId === 'pod-archive') {
        if (typeof renderPoDArchiveView === 'function') renderPoDArchiveView();
    } else if (viewId === 'reports') {
        if (typeof loadFullHistory === 'function') loadFullHistory();
    } else if (viewId === 'pool') {
        if (typeof loadPoolTrips === 'function') loadPoolTrips();
    } else if (viewId === 'courier-audit') {
        if (typeof renderCourierAuditView === 'function') renderCourierAuditView();
    } else if (viewId === 'fleet-inventory') {
        if (window.fleetModule && typeof window.fleetModule.renderFleetInventoryView === 'function') {
            window.fleetModule.renderFleetInventoryView();
        }
    }
}
window.switchTab = switchTab;

let currentPoolRegion = 'ALL';
let allPoolTrips = [];

async function loadPoolTrips() {
    const activeDb = getDb();
    const tbody = document.getElementById('pool-table-body');
    if (!activeDb || !tbody) return;

    try {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">Memuat SJ Pool...</td></tr>';
        const snap = await activeDb.collection('trips').get();
        allPoolTrips = [];

        snap.forEach(doc => {
            const t = doc.data();
            t.id = doc.id;
            const isAssignedActive = t.courierId && t.courierId.trim() !== "" && t.status === 'in_progress';
            if (t.status !== 'completed' && !isAssignedActive) {
                allPoolTrips.push(t);
            }
        });

        const bulkSelect = document.getElementById('bulk-courier-select');
        if (bulkSelect) {
            bulkSelect.innerHTML = buildCourierOptgroupHtml('Pilih Kurir Tujuan...', 'defaultUid');
        }

        renderPoolTable();
    } catch (e) {
        console.error("Error loading pool trips:", e);
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-danger">Gagal memuat: ${e.message}</td></tr>`;
    }
}
window.loadPoolTrips = loadPoolTrips;

function filterPoolByRegion(region) {
    currentPoolRegion = region;
    const selectEl = document.getElementById('pool-region-select');
    if (selectEl) {
        selectEl.value = region;
    }
    renderPoolTable();
}
window.filterPoolByRegion = filterPoolByRegion;

function renderPoolTable() {
    const tbody = document.getElementById('pool-table-body');
    if (!tbody) return;

    let filtered = allPoolTrips;
    if (currentPoolRegion !== 'ALL') {
        const targetRegion = currentPoolRegion.toLowerCase();
        filtered = allPoolTrips.filter(t => {
            const region = (t.region || '').toLowerCase();
            const destsStr = (t.destinations || []).map(d => (d.address || '') + ' ' + (d.locationName || '')).join(' ').toLowerCase();

            if (region === targetRegion) return true;
            if (region.includes(targetRegion) && region !== 'jabodetabek') return true;
            if (region === 'jabodetabek' && destsStr.includes(targetRegion)) return true;
            return false;
        });
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">Tidak ada Surat Jalan di penampungan untuk region ini.</td></tr>`;
        updatePoolSelectionCount();
        return;
    }

    const courierOptions = buildCourierOptgroupHtml('Pilih Kurir...', 'defaultUid');

    tbody.innerHTML = '';
    filtered.forEach(t => {
        const firstDest = t.destinations && t.destinations.length > 0 ? t.destinations[0].locationName : 'Tujuan';
        const firstAddress = t.destinations && t.destinations.length > 0 ? (t.destinations[0].address || '-') : '-';
        const destCount = t.destinations ? t.destinations.length : 0;

        tbody.innerHTML += `
            <tr>
                <td>
                    <input type="checkbox" class="form-check-input pool-checkbox" value="${t.id}" onchange="updatePoolSelectionCount()">
                </td>
                <td><strong>${t.tripId || t.id}</strong></td>
                <td>
                    <div class="text-muted small text-truncate" style="max-width: 250px;" title="${firstAddress}">${firstAddress}</div>
                </td>
                <td>
                    <div class="fw-bold">${firstDest}</div>
                    <small class="text-muted">${destCount} titik tujuan</small>
                </td>
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <select class="form-select form-select-sm" id="select-courier-${t.id}" style="width: 160px; border-radius: 6px; font-size: 0.85rem;">
                            ${courierOptions}
                        </select>
                        <button class="btn btn-sm btn-dark fw-bold px-3" style="border-radius: 6px;" onclick="assignPoolTripToCourier('${t.id}')">
                            Assign
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    updatePoolSelectionCount();
}

function toggleAllPool(source) {
    document.querySelectorAll('.pool-checkbox').forEach(cb => cb.checked = source.checked);
    updatePoolSelectionCount();
}
window.toggleAllPool = toggleAllPool;

function updatePoolSelectionCount() {
    const checkedCount = document.querySelectorAll('.pool-checkbox:checked').length;
    const countEl = document.getElementById('pool-selected-count');
    if (countEl) countEl.innerText = `${checkedCount} Surat Jalan dipilih`;
}
window.updatePoolSelectionCount = updatePoolSelectionCount;

async function bulkAssignPoolTrips() {
    const checked = document.querySelectorAll('.pool-checkbox:checked');
    if (checked.length === 0) {
        alert("Pilih minimal satu Surat Jalan (SJ) dengan mencentang checkbox terlebih dahulu!");
        return;
    }
    const selectEl = document.getElementById('bulk-courier-select');
    if (!selectEl) return;
    const courierUid = selectEl.value;
    if (!courierUid) {
        alert("Pilih kurir tujuan terlebih dahulu dari dropdown Bulk Assign di atas!");
        return;
    }

    if (!confirm(`Tugaskan ${checked.length} Surat Jalan terpilih ke kurir ini?`)) return;

    try {
        const activeDb = getDb();
        if (!activeDb) return;

        const batch = activeDb.batch();
        checked.forEach(cb => {
            const tripId = cb.value;
            const ref = activeDb.collection('trips').doc(tripId);
            batch.update(ref, {
                courierId: courierUid,
                status: 'in_progress',
                acceptedTime: firebase.firestore.Timestamp.now()
            });
        });

        await batch.commit();
        showToast(`Berhasil menugaskan ${checked.length} Surat Jalan ke kurir!`);
        loadPoolTrips();
    } catch (e) {
        alert("Gagal melakukan bulk assign: " + e.message);
    }
}
window.bulkAssignPoolTrips = bulkAssignPoolTrips;

async function assignPoolTripToCourier(tripId) {
    const selectEl = document.getElementById(`select-courier-${tripId}`);
    if (!selectEl) return;
    const courierUid = selectEl.value;
    if (!courierUid) {
        alert("Silakan pilih kurir terlebih dahulu!");
        return;
    }

    try {
        const activeDb = getDb();
        if (!activeDb) return;

        await activeDb.collection('trips').doc(tripId).update({
            courierId: courierUid,
            status: 'in_progress',
            acceptedTime: firebase.firestore.Timestamp.now()
        });

        showToast("Surat Jalan berhasil ditugaskan ke kurir!");
        loadPoolTrips();
    } catch (e) {
        alert("Gagal menugaskan SJ: " + e.message);
    }
}
window.assignPoolTripToCourier = assignPoolTripToCourier;

async function clearAllPoolTrips() {
    if (!allPoolTrips || allPoolTrips.length === 0) {
        alert("Tidak ada Surat Jalan di SJ Pool untuk dihapus.");
        return;
    }
    const poolTrips = allPoolTrips.filter(t => t.status === 'pool' || t.status === 'assigned' || !t.status);
    if (poolTrips.length === 0) {
        alert("Tidak ada Surat Jalan dalam status Pool yang bisa dihapus.");
        return;
    }

    if (!confirm(`PERHATIAN: Anda akan menghapus SELURUH (${poolTrips.length}) Surat Jalan yang ada di SJ Pool! Tindakan ini tidak dapat dibatalkan. Lanjutkan?`)) return;

    try {
        const activeDb = getDb();
        if (!activeDb) return;

        const batch = activeDb.batch();
        poolTrips.forEach(t => {
            const ref = activeDb.collection('trips').doc(t.id);
            batch.delete(ref);
        });

        await batch.commit();
        showToast(`Berhasil menghapus ${poolTrips.length} Surat Jalan dari SJ Pool.`);
        loadPoolTrips();
    } catch (e) {
        alert("Gagal menghapus SJ Pool: " + e.message);
    }
}
window.clearAllPoolTrips = clearAllPoolTrips;

function toggleAllClients(checked) {
    document.querySelectorAll('.client-checkbox').forEach(cb => cb.checked = checked);
}

let isMasterClientsSeeded = false;
async function ensureMasterClientsSeeded() {
    if (isMasterClientsSeeded) return;
    const activeDb = getDb();
    if (!activeDb) return;
    isMasterClientsSeeded = true;
    try {
        const docRef = activeDb.collection('clients').doc('CLIENT_AZKO_SYAFEI_SERANG');
        const snap = await docRef.get();
        if (!snap.exists) {
            await docRef.set({
                name: "AZko Syafei Serang",
                address: "Jl. Mayor Syafei No.90 Desa Lontar Pos, Jl. Pantura, Kagungan, Kec. Serang, Kota Serang, Banten 42114",
                latitude: -6.1158,
                longitude: 106.1558,
                region: "Serang",
                updatedAt: firebase.firestore.Timestamp.now()
            });
        }
    } catch(e) {
        console.warn("Seeding client error:", e);
    }
}

let cachedAllClients = null;

async function loadClientsByRegion(region, forceRefresh = false) {
    const container = document.getElementById('client-list-container');
    const activeDb = getDb();
    if(!container || !activeDb) return;
    const sa = document.getElementById('select-all-clients');
    if(sa) sa.checked = false;

    if (!cachedAllClients || forceRefresh) {
        container.innerHTML = '<p class="text-center py-3 text-muted extra-small">Fetching clients...</p>';
        try {
            const snap = await activeDb.collection('clients').get();
            cachedAllClients = [];
            snap.forEach(doc => {
                const c = doc.data();
                c.id = doc.id;
                cachedAllClients.push(c);
            });
        } catch (e) {
            console.error("Error loading clients:", e);
            container.innerHTML = '<p class="text-center py-3 text-danger extra-small">Gagal memuat daftar toko.</p>';
            return;
        }
    }

    allClients = [];
    if (!cachedAllClients || cachedAllClients.length === 0) {
        const qtyEl = document.getElementById('client-qty');
        if(qtyEl) qtyEl.innerText = "0";
        container.innerHTML = '<p class="text-center py-3 text-muted extra-small">Belum ada database toko/client.</p>';
        return;
    }

    const selectedRegion = (region || '').toLowerCase().trim();
    let matchCount = 0;
    const htmlChunks = [];

    cachedAllClients.forEach(c => {
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

        htmlChunks.push(`
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
        `);
    });

    const qtyEl = document.getElementById('client-qty');
    if(qtyEl) qtyEl.innerText = matchCount;

    if(matchCount === 0) {
        container.innerHTML = '<p class="text-center py-3 text-muted extra-small">Tidak ada toko/client di area ini.</p>';
    } else {
        container.innerHTML = htmlChunks.join('');
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
        cachedAllClients = null;
        showToast("Client berhasil dihapus.");
        const regEl = document.getElementById('region-filter');
        loadClientsByRegion(regEl ? regEl.value : "", true);
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

        cachedAllClients = null;
        showToast("Seluruh database client telah dikosongkan.");
        const regEl = document.getElementById('region-filter');
        loadClientsByRegion(regEl ? regEl.value : "", true);
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


function initUsersSnapshot() {
    // Provide instant default fallback list (8 drivers + 11 couriers) so dropdown loads instantly without 1-2 min network wait
    if (!registeredUsers || Object.keys(registeredUsers).length === 0) {
        registeredUsers = {
            "driver_1": "Driver 1 (Mobil)",
            "driver_2": "Driver 2 (Mobil)",
            "driver_3": "Driver 3 (Mobil)",
            "driver_4": "Driver 4 (Mobil)",
            "driver_5": "Driver 5 (Mobil)",
            "driver_6": "Driver 6 (Mobil)",
            "driver_7": "Driver 7 (Mobil)",
            "driver_8": "Driver 8 (Mobil)",
            "courier_1": "Kurir 1 (Motor)",
            "courier_2": "Kurir 2 (Motor)",
            "courier_3": "Kurir 3 (Motor)",
            "courier_4": "Kurir 4 (Motor)",
            "courier_5": "Kurir 5 (Motor)",
            "courier_6": "Kurir 6 (Motor)",
            "courier_7": "Kurir 7 (Motor)",
            "courier_8": "Kurir 8 (Motor)",
            "courier_9": "Kurir 9 (Motor)",
            "courier_10": "Kurir 10 (Motor)",
            "courier_11": "Kurir 11 (Motor)",
            "courier_alan": "alanpasming1",
            "courier_joyen": "joyen"
        };
        renderCourierOptions();
        renderManageCouriersList();
    }

    const activeDb = getDb();
    if (!activeDb) {
        setTimeout(initUsersSnapshot, 300);
        return;
    }

    // Load instantly from local cache if available
    try {
        const cached = localStorage.getItem('cached_couriers');
        if (cached) {
            registeredUsers = JSON.parse(cached);
            renderCourierOptions();
            renderManageCouriersList();
        }
    } catch(e) {}

    activeDb.collection('users').onSnapshot(snap => {
        registeredUsers = {};
        registeredUsersObjects = {};
        snap.forEach(doc => {
            const u = doc.data() || {};
            const uid = doc.id;
            const displayName = u.name || u.email || uid.substring(0,8);

            registeredUsers[uid] = displayName;
            registeredUsersObjects[uid] = u;

            if (u.userId) {
                registeredUsers[u.userId] = displayName;
                registeredUsersObjects[u.userId] = u;
            }
            if (u.courierId && u.courierId !== 'pbseventeensc') {
                registeredUsers[u.courierId] = displayName;
                registeredUsersObjects[u.courierId] = u;
            }
            if (u.email) {
                registeredUsers[u.email] = displayName;
                registeredUsersObjects[u.email] = u;
                if (u.email.includes('@')) {
                    const prefix = u.email.split('@')[0];
                    registeredUsers[prefix] = displayName;
                    registeredUsersObjects[prefix] = u;
                }
            }
            if (u.name) {
                registeredUsers[u.name.toLowerCase()] = displayName;
                registeredUsersObjects[u.name.toLowerCase()] = u;
            }
        });

        // Save to cache
        try {
            localStorage.setItem('cached_couriers', JSON.stringify(registeredUsers));
        } catch(e) {}

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

    const sortedCouriers = [...MASTER_COURIERS].sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));

    sortedCouriers.forEach(c => {
        const id = c.defaultUid;
        const name = c.displayName;
        const roleBadge = c.role === 'driver'
            ? '<span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-0.5" style="font-size:0.65rem;">Driver Mobil</span>'
            : '<span class="badge bg-warning-subtle text-warning border border-warning-subtle px-2 py-0.5" style="font-size:0.65rem;">Kurir Motor</span>';

        container.innerHTML += `
            <div class="d-flex align-items-center justify-content-between p-3 border rounded-3 mb-2 bg-light">
                <div class="d-flex align-items-center gap-2">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(name)}" style="width:32px; border-radius:50%">
                    <div>
                        <div class="fw-bold extra-small text-dark">${name} ${roleBadge}</div>
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

function buildCourierOptgroupHtml(placeholderText = '-- Pilih Kurir Pengantaran --', valueKey = 'defaultUid') {
    const kurirs = MASTER_COURIERS.filter(c => c.role === 'kurir').sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
    const drivers = MASTER_COURIERS.filter(c => c.role === 'driver').sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));

    const options = [];
    if (placeholderText) {
        options.push(`<option value="">${placeholderText}</option>`);
    }

    options.push(`<optgroup label="Kurir Motor (${kurirs.length} Personil)">`);
    kurirs.forEach(c => {
        const val = valueKey === 'canonicalId' ? c.canonicalId : (valueKey === 'displayName' ? c.displayName : c.defaultUid);
        options.push(`<option value="${val}">${c.displayName}</option>`);
    });
    options.push(`</optgroup>`);

    options.push(`<optgroup label="Driver Mobil (${drivers.length} Personil)">`);
    drivers.forEach(c => {
        const val = valueKey === 'canonicalId' ? c.canonicalId : (valueKey === 'displayName' ? c.displayName : c.defaultUid);
        options.push(`<option value="${val}">${c.displayName}</option>`);
    });
    options.push(`</optgroup>`);

    return options.join('');
}
window.buildCourierOptgroupHtml = buildCourierOptgroupHtml;

function renderCourierOptions() {
    const sel = document.getElementById('sel-courier'); if(!sel) return;
    const currentVal = sel.value;

    sel.innerHTML = buildCourierOptgroupHtml('-- Pilih Kurir Pengantaran --', 'defaultUid');

    if (currentVal) {
        const norm = normalizeCourierIdentity(currentVal, '');
        const matched = MASTER_COURIERS.find(s => s.defaultUid === currentVal || s.canonicalId === norm.canonicalId || s.defaultUid === norm.uid);
        if (matched) {
            sel.value = matched.defaultUid;
        } else {
            sel.value = currentVal;
        }
    }
    if (typeof onDispatchCourierChange === 'function') onDispatchCourierChange();
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

function getTripTimestamp(t) {
    if (!t) return 0;
    if (t.date?.toDate) return t.date.toDate().getTime();
    if (t.date?.seconds) return t.date.seconds * 1000;
    if (typeof t.date === 'string') {
        const d = new Date(t.date);
        if (!isNaN(d.getTime())) return d.getTime();
    }
    if (t.id && t.id.startsWith('TRIP_')) {
        const num = parseInt(t.id.replace('TRIP_', ''));
        if (!isNaN(num)) return num;
    }
    return 0;
}

let isPurgingPastMonths = false;

async function purgePastMonthsTripsFromDb(manual = false) {
    if (isPurgingPastMonths) return;
    isPurgingPastMonths = true;

    try {
        const activeDb = getDb();
        if (!activeDb) return;

        const now = new Date();
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        if (!manual) {
            const lastPurge = localStorage.getItem('wtrack_last_auto_purge');
            if (lastPurge === currentMonthKey) {
                return; // Sudah otomatis dibersihkan untuk bulan ini
            }
        } else {
            if (!confirm("Bersihkan seluruh riwayat tugas dari bulan-bulan sebelumnya di database Firestore? (Data foto aman di Google Drive)")) {
                return;
            }
        }

        const snap = await activeDb.collection('trips').get();
        if (snap.empty) {
            if (manual) showToast("Database trips kosong.");
            return;
        }

        const docsToDelete = [];
        snap.forEach(doc => {
            const t = doc.data();
            t.id = doc.id;
            const tripTime = getTripTimestamp(t);
            // Hapus jika bertanggal sebelum bulan ini dan sudah selesai
            if (tripTime > 0 && tripTime < startOfCurrentMonth && (t.status === 'completed' || t.status === 'canceled')) {
                docsToDelete.push(doc.ref);
            }
        });

        if (docsToDelete.length === 0) {
            if (manual) showToast("✅ Tidak ada data trip bulan lalu. Database sudah bersih!");
            localStorage.setItem('wtrack_last_auto_purge', currentMonthKey);
            return;
        }

        // Firestore batch max 500 per commit
        const BATCH_SIZE = 400;
        for (let i = 0; i < docsToDelete.length; i += BATCH_SIZE) {
            const batch = activeDb.batch();
            const chunk = docsToDelete.slice(i, i + BATCH_SIZE);
            chunk.forEach(ref => batch.delete(ref));
            await batch.commit();
        }

        localStorage.setItem('wtrack_last_auto_purge', currentMonthKey);
        console.log(`[Auto-Purge] Berhasil membersihkan ${docsToDelete.length} trip bulan lalu dari Firestore.`);
        showToast(`🧹 ${docsToDelete.length} trip riwayat bulan lalu berhasil dibersihkan dari database! Dashboard kini lebih ringan.`);
    } catch (e) {
        console.error("Purge past trips error:", e);
        if (manual) alert("Gagal membersihkan data lama: " + e.message);
    } finally {
        isPurgingPastMonths = false;
    }
}
window.purgePastMonthsTripsFromDb = purgePastMonthsTripsFromDb;

function initTripsSnapshot() {
    const activeDb = getDb();
    if (!activeDb) {
        setTimeout(initTripsSnapshot, 300);
        return;
    }

    activeDb.collection('trips').onSnapshot(snap => {
        const trips = [];
        const now = new Date();
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();

        snap.forEach(doc => {
            const t = doc.data();
            t.id = doc.id;
            if (t.status === 'assigned') {
                t.status = 'in_progress';
            }

            // Batasi memori dashboard HANYA untuk bulan berjalan!
            // Trip selesai dari bulan lalu dilewati agar browser PC RAM 4GB super ringan
            const tripTime = getTripTimestamp(t);
            if (tripTime > 0 && tripTime < startOfCurrentMonth && (t.status === 'completed' || t.status === 'canceled')) {
                return;
            }

            trips.push(t);
        });
        allCurrentTrips = trips;
        if (typeof initDefaultDateFilters === 'function') initDefaultDateFilters();
        updateGlobalStats();
        renderRecentShipments();
        if (typeof renderMonitorUI === 'function') renderMonitorUI();
        if (typeof refreshMapSizes === 'function') refreshMapSizes();

        // Jalankan auto-purge bulan lalu di latar belakang jika admin sedang aktif
        setTimeout(() => purgePastMonthsTripsFromDb(false), 3000);
    }, err => {
        console.error("Firestore trips snapshot error:", err);
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

        let filterStartMs = todayDayMs;
        let filterEndMs = todayDayMs + (24 * 60 * 60 * 1000) - 1;

        if (startDateVal) {
            const parsed = parseDateBoundary(startDateVal, false);
            if (parsed !== null) filterStartMs = parsed;
        }
        if (endDateVal) {
            const parsed = parseDateBoundary(endDateVal, true);
            if (parsed !== null) filterEndMs = parsed;
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
                    const isAccPending = (d.status === 'pending' && d.pendingReason && d.pendingReason.length > 0) || d.status === 'returned' || d.status === 'failed';
                    if (d.status === 'done' || d.proofPhotoUrl || d.status === 'completed') {
                        deliveredStops++;
                    } else if (isAccPending) {
                        returnedStops++;
                    } else {
                        inTransitStops++;
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
        let deliveredStopsToday = 0;
        let returnedStopsToday = 0;
        let grandTotalKMToday = 0;

        filteredTrips.forEach(t => {
            const tripMs = t.date?.seconds ? t.date.seconds * 1000 : (t.date ? new Date(t.date).getTime() : 0);
            if (tripMs >= todayDayMs) {
                if (t.destinations && t.destinations.length > 0) {
                    t.destinations.forEach((d, i) => {
                        totalStopsToday++;
                        const isAccPending = (d.status === 'pending' && d.pendingReason && d.pendingReason.length > 0) || d.status === 'returned' || d.status === 'failed';
                        if (d.status === 'done' || d.proofPhotoUrl || d.status === 'completed') {
                            deliveredStopsToday++;
                            const start = (i === 0)
                                ? ((t.acceptLatitude && t.acceptLongitude) ? { lat: parseFloat(t.acceptLatitude), lng: parseFloat(t.acceptLongitude) } : { lat: parseFloat(t.destinations[0].latitude || 0), lng: parseFloat(t.destinations[0].longitude || 0) })
                                : { lat: parseFloat(t.destinations[i-1].latitude || 0), lng: parseFloat(t.destinations[i-1].longitude || 0) };
                            const end = { lat: parseFloat(d.latitude || 0), lng: parseFloat(d.longitude || 0) };
                            grandTotalKMToday += calculateDistance(start.lat, start.lng, end.lat, end.lng);
                        } else if (isAccPending) {
                            returnedStopsToday++;
                        }
                    });
                } else {
                    totalStopsToday += 1;
                    if (t.status === 'completed') {
                        deliveredStopsToday += 1;
                    }
                }
            }
        });

        const displayDelivered = filterStartMs > 0 ? deliveredStops : deliveredStopsToday;
        const displayReturned = filterStartMs > 0 ? returnedStops : returnedStopsToday;
        const displayTotal = filterStartMs > 0 ? totalStops : totalStopsToday;
        const displayKM = filterStartMs > 0 ? grandTotalKM : grandTotalKMToday;
        const displayOnProgress = Math.max(0, displayTotal - displayDelivered - displayReturned);

        if(document.getElementById('stat-completed')) {
            document.getElementById('stat-completed').innerText = displayDelivered;
        }
        if(document.getElementById('stat-active-tasks')) {
            document.getElementById('stat-active-tasks').innerText = activeShipmentsCount;
        }
        if(document.getElementById('stat-active')) {
            document.getElementById('stat-active').innerText = displayTotal;
        }
        if(document.getElementById('stat-done')) document.getElementById('stat-done').innerText = totalStopsToday;
        if(document.getElementById('stat-delayed')) document.getElementById('stat-delayed').innerText = displayReturned;
        if(document.getElementById('stat-transit-count')) document.getElementById('stat-transit-count').innerText = inTransitStops;
        if(document.getElementById('stat-total-km')) document.getElementById('stat-total-km').innerText = displayKM.toFixed(1) + " km";

        const safeTotal = displayTotal > 0 ? displayTotal : 1;
        const pctDelivered = displayTotal > 0 ? Math.round((displayDelivered / safeTotal) * 100) : 0;
        const pctOnProgress = displayTotal > 0 ? Math.round((displayOnProgress / safeTotal) * 100) : 0;
        const pctReturned = displayTotal > 0 ? Math.round((displayReturned / safeTotal) * 100) : 0;

        if(document.getElementById('pct-delivered')) document.getElementById('pct-delivered').innerText = pctDelivered + "%";
        if(document.getElementById('pbar-delivered')) document.getElementById('pbar-delivered').style.width = pctDelivered + "%";

        if(document.getElementById('pct-pending')) document.getElementById('pct-pending').innerText = pctOnProgress + "%";
        if(document.getElementById('pbar-pending')) document.getElementById('pbar-pending').style.width = pctOnProgress + "%";

        if(document.getElementById('pct-returned')) document.getElementById('pct-returned').innerText = pctReturned + "%";
        if(document.getElementById('pbar-returned')) document.getElementById('pbar-returned').style.width = pctReturned + "%";

        const deliveryRate = displayTotal > 0 ? Math.round((displayDelivered / displayTotal) * 100) : 0;
        if(document.getElementById('stat-ontime')) document.getElementById('stat-ontime').innerText = deliveryRate + "%";

        refreshAllMonitorData();
        updateDynamicAlerts();
        updateHeaderDate();
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

async function compressImageFile(file, maxDimension = 900, quality = 0.65) {
    return new Promise((resolve) => {
        if (!file || !file.type || !file.type.startsWith('image/')) {
            return resolve(file);
        }
        if (file.__isCompressed || file.size < 90 * 1024) {
            return resolve(file);
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    } else {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            const compressedFile = new File([blob], (file.name || 'proof.jpg').replace(/\.[^/.]+$/, ".jpg"), {
                                type: 'image/jpeg',
                                lastModified: Date.now()
                            });
                            compressedFile.__isCompressed = true;
                            console.log(`[JS Compress] Compressed ${file.size} -> ${compressedFile.size} bytes`);
                            resolve(compressedFile);
                        } else {
                            resolve(file);
                        }
                    },
                    'image/jpeg',
                    quality
                );
            };
            img.onerror = () => resolve(file);
            img.src = e.target.result;
        };
        reader.onerror = () => resolve(file);
        reader.readAsDataURL(file);
    });
}

const DEFAULT_GDRIVE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwvx6J8im78IZ9hpMHSgDCrNp6UblxDs49uFyu-AokUSdfwT3tVWiJfGHh0nafTupw_/exec";

function getGdriveScriptUrl() {
    return localStorage.getItem('gdrive_script_url') || DEFAULT_GDRIVE_SCRIPT_URL;
}
window.getGdriveScriptUrl = getGdriveScriptUrl;

async function uploadToGoogleDrive(file, timeoutMs = 5000) {
    const scriptUrl = getGdriveScriptUrl();
    if (!scriptUrl) throw new Error("Google Drive Script URL not configured");

    const base64Data = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const res = e.target.result;
            const base64 = res.split(',')[1] || res;
            resolve(base64);
        };
        reader.readAsDataURL(file);
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(scriptUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify({
                filename: file.name || 'proof.jpg',
                contentType: file.type || 'image/jpeg',
                base64Data: base64Data
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const result = await response.json();
        if (result && result.status === 'success' && result.url) {
            return result.url;
        }
        throw new Error(result.message || 'Google Drive upload failed');
    } catch(err) {
        clearTimeout(timeoutId);
        throw err;
    }
}

async function uploadFileToCloudinaryOrFirebase(file) {
    if (!file) return "";
    const targetFile = (!file.__isCompressed && file.type && file.type.startsWith('image/'))
        ? await compressImageFile(file, 900, 0.65)
        : file;

    // 1. Primary: Google Drive 5TB Storage (dengan timeout 5 detik agar cepat fallback jika Apps Script lambat)
    const scriptUrl = getGdriveScriptUrl();
    if (scriptUrl) {
        try {
            const gdriveUrl = await uploadToGoogleDrive(targetFile, 5000);
            if (gdriveUrl) return gdriveUrl;
        } catch (e) {
            console.warn("Google Drive upload timeout/warning, beralih instan ke Firebase Storage:", e);
        }
    }

    // 2. Secondary: Firebase Storage (Sangat cepat ~200ms)
    try {
        const activeStorage = (typeof firebase !== 'undefined' && firebase.storage) ? firebase.storage() : null;
        if (activeStorage) {
            const ext = targetFile.type?.includes('png') ? 'png' : 'jpg';
            const ref = activeStorage.ref().child(`proofs/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`);
            const snapshot = await ref.put(targetFile);
            const downloadUrl = await snapshot.ref.getDownloadURL();
            if (downloadUrl) return downloadUrl;
        }
    } catch(e) {
        console.warn("Firebase Storage fallback warning:", e);
    }

    // 3. Fallback: Data URL
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (evt) => resolve(evt.target.result || "");
        reader.onerror = () => resolve("");
        reader.readAsDataURL(targetFile);
    });
}

function getBulkSjUrls(tripData) {
    if (!tripData) return [];
    if (Array.isArray(tripData.adminBulkSjUrls) && tripData.adminBulkSjUrls.length > 0) {
        return tripData.adminBulkSjUrls.filter(u => u && typeof u === 'string' && u.trim().length > 0);
    }
    if (tripData.adminBulkSjUrl && typeof tripData.adminBulkSjUrl === 'string' && tripData.adminBulkSjUrl.trim().length > 0) {
        return tripData.adminBulkSjUrl.split(',').map(u => u.trim()).filter(u => u.length > 0);
    }
    return [];
}
window.getBulkSjUrls = getBulkSjUrls;

async function submitTrip() {
    const btn = document.querySelector('[onclick*="submitTrip"]');
    const cidEl = document.getElementById('sel-courier');
    const cid = cidEl ? cidEl.value : "";

    if (!tripQueue || tripQueue.length === 0) return alert("TAMBAHKAN ALAMAT TUJUAN TERLEBIH DAHULU!\nSilakan centang lokasi dan klik (+ ADD SELECTED TO ROUTE) di langkah 2 (Add Destinations).");

    if (btn) {
        btn.disabled = true;
        btn.innerText = "SENDING DISPATCH...";
    }

    try {
        const activeDb = getDb();
        if (!activeDb) throw new Error("Firestore Database belum terhubung.");

        let adminBulkSjUrl = "";
        let adminBulkSjUrls = [];
        const sjFileEl = document.getElementById('dispatch-bulk-sj-file');
        if (sjFileEl && sjFileEl.files && sjFileEl.files.length > 0) {
            const bulkFiles = Array.from(sjFileEl.files);
            if (btn) btn.innerText = `UPLOADING ${bulkFiles.length} BULK SJ PHOTO(S)...`;
            const uploadPromises = bulkFiles.map(async (f) => {
                const targetFile = await compressImageFile(f, 900, 0.65);
                return await uploadFileToCloudinaryOrFirebase(targetFile);
            });
            const uploadResults = await Promise.all(uploadPromises);
            adminBulkSjUrls = uploadResults.filter(u => u && typeof u === 'string' && u.trim().length > 0);
            adminBulkSjUrl = adminBulkSjUrls.join(',');
        }

        // Determine region automatically from first destination address
        let tripRegion = "Jakarta Pusat";
        if (tripQueue.length > 0) {
            const firstAddr = (tripQueue[0].address || "").toLowerCase() + " " + (tripQueue[0].name || "").toLowerCase();
            if (firstAddr.includes("pusat") || firstAddr.includes("menteng") || firstAddr.includes("tanah abang") || firstAddr.includes("gondangdia") || firstAddr.includes("senen")) {
                tripRegion = "Jakarta Pusat";
            } else if (firstAddr.includes("timur") || firstAddr.includes("jatinegara") || firstAddr.includes("bassura") || firstAddr.includes("cakung") || firstAddr.includes("duren sawit") || firstAddr.includes("matraman") || firstAddr.includes("pulogadung")) {
                tripRegion = "Jakarta Timur";
            } else if (firstAddr.includes("utara") || firstAddr.includes("priok") || firstAddr.includes("kelapa gading") || firstAddr.includes("pademangan") || firstAddr.includes("ancol")) {
                tripRegion = "Jakarta Utara";
            } else if (firstAddr.includes("selatan") || firstAddr.includes("kebayoran") || firstAddr.includes("cilandak") || firstAddr.includes("pasarminggu") || firstAddr.includes("mampang") || firstAddr.includes("tebet")) {
                tripRegion = "Jakarta Selatan";
            } else if (firstAddr.includes("barat") || firstAddr.includes("jeruk") || firstAddr.includes("cengkareng") || firstAddr.includes("kalideres") || firstAddr.includes("grogol")) {
                tripRegion = "Jakarta Barat";
            } else if (firstAddr.includes("depok") || firstAddr.includes("beji") || firstAddr.includes("cimanggis") || firstAddr.includes("sawangan")) {
                tripRegion = "Depok";
            } else if (firstAddr.includes("bogor") || firstAddr.includes("cibinong") || firstAddr.includes("sentul") || firstAddr.includes("ciawi")) {
                tripRegion = "Bogor";
            } else if (firstAddr.includes("bekasi") || firstAddr.includes("tambun") || firstAddr.includes("cikarang") || firstAddr.includes("galaxy")) {
                tripRegion = "Bekasi";
            } else if (firstAddr.includes("tangerang") || firstAddr.includes("ciputat") || firstAddr.includes("rempoa") || firstAddr.includes("bsd") || firstAddr.includes("serpong")) {
                tripRegion = "Tangerang";
            } else if (firstAddr.includes("karawang") || firstAddr.includes("cikampek")) {
                tripRegion = "Karawang";
            } else if (firstAddr.includes("serang") || firstAddr.includes("banten") || firstAddr.includes("cilegon")) {
                tripRegion = "Serang";
            }
        }

        const id = "TRIP_" + Date.now();
        const statusToUse = cid ? "in_progress" : "pool";
        const vehicleType = cid ? getCourierVehicleType(cid, (registeredUsers[cid] || '')) : ((document.querySelector('input[name="dispatch-vehicle-type"]:checked')?.value) || "motor");

        await activeDb.collection('trips').doc(id).set({
            tripId: id,
            courierId: cid,
            vehicleType: vehicleType,
            status: statusToUse,
            region: tripRegion,
            date: firebase.firestore.Timestamp.now(),
            acceptedTime: firebase.firestore.Timestamp.now(),
            adminBulkSjUrl: adminBulkSjUrl,
            adminBulkSjUrls: adminBulkSjUrls,
            branchId: getActiveBranchId(),
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

        if (cid) {
            showToast("BERHASIL DITUGASKAN! Pengiriman telah dikirim ke kurir.");
        } else {
            showToast("BERHASIL DISIMPAN KE SJ POOL! Pengiriman masuk ke penampungan wilayah.");
        }

        tripQueue = [];
        renderQueue();
        if (cidEl) cidEl.value = "";
        if (sjFileEl) sjFileEl.value = "";
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
            else if (addrLower.includes("serang")) region = "Serang";
            else if (addrLower.includes("cilegon")) region = "Cilegon";
            else if (addrLower.includes("pandeglang")) region = "Banten";
            else if (addrLower.includes("lebak")) region = "Banten";
            else if (addrLower.includes("banten")) region = "Banten";
            else if (addrLower.includes("bogor")) region = "Bogor";
            else if (addrLower.includes("cikarang")) region = "Cikarang";
            else if (addrLower.includes("tangerang")) region = "Tangerang";
            else if (addrLower.includes("bekasi")) region = "Bekasi";
            else if (addrLower.includes("karawang")) region = "Karawang";

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
        const hasTrip = allCurrentTrips.some(t => t.courierId === id);
        if (hasTrip || currentOnlineCouriers[id]) {
            items.add(name);
        }
    }

    allCurrentTrips.forEach(t => {
        items.add(t.id);
        if (t.destinations) {
            t.destinations.forEach(d => items.add(d.locationName));
        }
    });

    dl.innerHTML = Array.from(items).map(i => `<option value="${i}">`).join('');
}

window.monitorCategoryTab = window.monitorCategoryTab || 'all';

window.setMonitorCategoryTab = function(tab) {
    window.monitorCategoryTab = tab;
    renderMonitorUI();
};

function getPersonilCategory(cId, cName) {
    const checkStr = (String(cName || '') + ' ' + String(cId || '')).toLowerCase();
    const kurirTokens = ['ahmad', 'beto', 'eri', 'irfan', 'baikaqi', 'bayhaqi', 'haris', 'umar', 'noval', 'jay', 'ferdi', 'jagat', 'jagad'];
    const driverTokens = ['altur', 'rizki', 'soleh', 'romi', 'firdaus', 'alan', 'yakub', 'iwan', 'agung', 'husen', 'juhu'];

    if (driverTokens.some(d => checkStr.includes(d))) return 'driver';
    if (kurirTokens.some(k => checkStr.includes(k))) return 'kurir';

    const normalized = normalizeCourierIdentity(cId, cName);
    return normalized.vehicleType === 'mobil' ? 'driver' : 'kurir';
}

function renderMonitorUI(filter = "") {
    const mList = document.getElementById('monitor-list');
    if(!mList) return;
    mList.innerHTML = '';

    const search = (typeof filter === 'string' ? filter : (document.getElementById('monitor-search')?.value || "")).toLowerCase().trim();
    const now = new Date();
    const todayDayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const courierGroups = {};

    // 1. Gather couriers with today's trips (Merged & Deduplicated by Canonical ID)
    allCurrentTrips.forEach(t => {
        const tripMs = t.date?.seconds ? t.date.seconds * 1000 : (t.date ? new Date(t.date).getTime() : 0);
        if (tripMs < todayDayMs) return; // Clean H+1: Only show today's trips
        const cId = t.courierId;
        if (!cId) return;
        const cName = registeredUsers[cId] || (typeof getCourierDisplayName === 'function' ? getCourierDisplayName(cId) : '');
        
        // HAPUS / HIDE NON-MASTER / ANONYMOUS "Carrier (...)"
        if (typeof isRecognizedCourier === 'function' && !isRecognizedCourier(cId, cName)) return;

        const norm = (typeof normalizeCourierIdentity === 'function')
            ? normalizeCourierIdentity(cId, cName)
            : { canonicalId: cId.toLowerCase(), displayName: cName };
        const key = norm.canonicalId || cId.toLowerCase();
        const displayName = norm.displayName || cName || key;

        const clients = t.destinations ? t.destinations.map(d => d.locationName.toLowerCase()).join(" ") : "";

        if (displayName.toLowerCase().includes(search) || t.id.toLowerCase().includes(search) || clients.includes(search) || key.includes(search)) {
            if (!courierGroups[key]) {
                courierGroups[key] = { id: key, rawId: cId, name: displayName, trips: [], totalStops: 0, doneStops: 0 };
            }
            courierGroups[key].trips.push(t);
            if (t.destinations) {
                courierGroups[key].totalStops += t.destinations.length;
                courierGroups[key].doneStops += t.destinations.filter(d => d.status === 'done' || d.proofPhotoUrl || t.status === 'completed').length;
            } else {
                courierGroups[key].totalStops += 1;
                if (t.status === 'completed') courierGroups[key].doneStops += 1;
            }
        }
    });

    // 2. Also include online couriers even if no trips assigned yet (ONLY RECOGNIZED COURIERS WHO ARE CURRENTLY ONLINE)
    if (typeof currentOnlineCouriers !== 'undefined') {
        for (const cId in currentOnlineCouriers) {
            // ONLY include if actually online right now!
            if (!isCourierOnline(cId)) continue;

            const cName = (typeof registeredUsers !== 'undefined' && registeredUsers[cId]) ? registeredUsers[cId] : (typeof getCourierDisplayName === 'function' ? getCourierDisplayName(cId) : '');
            
            // HAPUS / HIDE NON-MASTER / ANONYMOUS "Carrier (...)"
            if (typeof isRecognizedCourier === 'function' && !isRecognizedCourier(cId, cName)) continue;

            const norm = (typeof normalizeCourierIdentity === 'function')
                ? normalizeCourierIdentity(cId, cName)
                : { canonicalId: cId.toLowerCase(), displayName: cName };
            const key = norm.canonicalId || cId.toLowerCase();
            const displayName = norm.displayName || cName || key;

            if (!courierGroups[key]) {
                if (!search || displayName.toLowerCase().includes(search) || cId.toLowerCase().includes(search) || key.includes(search)) {
                    courierGroups[key] = { id: key, rawId: cId, name: displayName, trips: [], totalStops: 0, doneStops: 0 };
                }
            }
        }
    }

    // 3. Filter out any inactive courier with 0 trips and offline (Hapus duplicate/kosong 0 shipment)
    for (const key in courierGroups) {
        const c = courierGroups[key];
        const isOnline = isCourierOnline(c.rawId || c.id);
        if (c.trips.length === 0 && !isOnline) {
            delete courierGroups[key];
        }
    }

    const courierIds = Object.keys(courierGroups);
    if(courierIds.length === 0) {
        mList.innerHTML = '<div class="col-12 text-center p-4 text-muted extra-small">Tidak ada personil armada yang cocok dengan filter.</div>';
        return;
    }

    // Split strictly into 2 categories without mixing roles
    const kurirList = [];
    const driverList = [];

    courierIds.forEach(cId => {
        const c = courierGroups[cId];
        const category = getPersonilCategory(c.id, c.name);
        if (category === 'driver') {
            driverList.push(c);
        } else {
            kurirList.push(c);
        }
    });

    // Calculate online / idle counters
    const kurirOnlineCount = kurirList.filter(c => isCourierOnline(c.rawId || c.id)).length;
    const kurirIdleCount = kurirList.length - kurirOnlineCount;

    const driverOnlineCount = driverList.filter(c => isCourierOnline(c.rawId || c.id)).length;
    const driverIdleCount = driverList.length - driverOnlineCount;

    // Helper to build individual card HTML
    const buildCard = (c, catName) => {
        const cColor = getCourierColor(c.id, c.name);
        const progress = c.totalStops > 0 ? Math.round((c.doneStops / c.totalStops) * 100) : 0;
        const isOnline = isCourierOnline(c.rawId || c.id);
        const photoUrl = (typeof window.getCourierPhoto === 'function') ? window.getCourierPhoto(c.id, c.name) : null;

        const pendingStops = c.trips.reduce((acc, t) => acc + (t.destinations ? t.destinations.filter(d => d.status === 'pending_approval' || (d.status === 'pending' && d.pendingReason)).length : 0), 0);
        const pendingBadgeHtml = pendingStops > 0 ? `<span class="badge rounded-pill bg-danger text-white extra-small py-1 px-2 fw-bold ms-1" style="font-size:0.65rem"><i class="bi bi-exclamation-triangle-fill me-1"></i>${pendingStops} Pending</span>` : '';

        const bulkSjTrip = c.trips.find(t => getBulkSjUrls(t).length > 0);
        const activeTrip = c.trips[0];

        let bulkSjSectionHtml = '';
        if (bulkSjTrip) {
            const sjUrls = getBulkSjUrls(bulkSjTrip);
            bulkSjSectionHtml = `
                <div class="mt-2 p-2 bg-light border rounded-3 text-start">
                    <div class="d-flex justify-content-between align-items-center mb-1.5">
                        <small class="text-muted extra-small fw-bold text-uppercase" style="font-size:0.65rem;"><i class="bi bi-file-earmark-text-fill me-1 text-primary"></i> Foto Bulk SJ (${sjUrls.length})</small>
                        <button class="btn btn-xs btn-outline-danger py-0 px-1.5 fw-bold" style="font-size: 0.65rem; border-radius: 4px;" onclick="deleteBulkSjFromCard('${bulkSjTrip.id}')" title="Hapus Semua Foto Bulk SJ Kurir Ini"><i class="bi bi-trash-fill me-1"></i>Hapus</button>
                    </div>
                    <div class="d-flex gap-1 mb-1.5">
                        <button class="btn btn-xs btn-outline-primary w-100 py-1.5 fw-bold" style="border-radius: 6px; font-size:0.725rem;" onclick="openAuditSjModal('${bulkSjTrip.id}')">
                            <i class="bi bi-eye-fill me-1"></i> Lihat ${sjUrls.length} Foto Bulk SJ
                        </button>
                    </div>
                    <div class="d-flex gap-1 align-items-center">
                        <input type="file" id="card-bulk-file-${bulkSjTrip.id}" accept="image/*" class="form-control form-control-sm py-1 px-2 extra-small bg-white" style="border-radius: 6px; font-size: 0.68rem;" multiple>
                        <button class="btn btn-xs btn-primary fw-bold text-nowrap px-2 py-1" style="font-size: 0.68rem; border-radius: 6px;" onclick="uploadBulkSjFromCard('${bulkSjTrip.id}')">+ Upload</button>
                    </div>
                </div>`;
        } else if (activeTrip) {
            bulkSjSectionHtml = `
                <div class="mt-2 p-2 bg-light border rounded-3 text-start">
                    <small class="text-muted extra-small fw-bold text-uppercase d-block mb-1"><i class="bi bi-camera-fill me-1 text-primary"></i> Upload Foto Bulk SJ (Bisa >1)</small>
                    <div class="d-flex gap-1 align-items-center">
                        <input type="file" id="card-bulk-file-${activeTrip.id}" accept="image/*" class="form-control form-control-sm py-1 px-2 extra-small bg-white" style="border-radius: 6px; font-size: 0.68rem;" multiple>
                        <button class="btn btn-xs btn-primary fw-bold text-nowrap px-2 py-1" style="font-size: 0.68rem; border-radius: 6px;" onclick="uploadBulkSjFromCard('${activeTrip.id}')">Upload</button>
                    </div>
                </div>`;
        }

        const avatarHtml = photoUrl
            ? `<img src="${photoUrl}" class="rounded-circle shadow-xs" style="width:34px; height:34px; object-fit:cover; border:2px solid ${cColor}; flex-shrink:0;" alt="${c.name}">`
            : `<div style="width:34px; height:34px; border-radius:50%; background:${cColor}; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:0.85rem; flex-shrink:0;">${(c.name || 'P').charAt(0).toUpperCase()}</div>`;

        return `
            <div class="col-sm-6 col-md-4 col-lg-3 col-xl-3 mb-3">
                <div class="border rounded-3 p-2.5 px-3 bg-white shadow-sm h-100 d-flex flex-column justify-content-between" style="border-top: 4px solid ${cColor} !important">
                    <div>
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <div class="d-flex align-items-center gap-2">
                                ${avatarHtml}
                                <div>
                                    <div class="fw-bold mb-0 text-dark text-truncate" style="font-size:0.875rem; max-width: 110px;" title="${c.name}">${c.name}</div>
                                    <small class="${isOnline ? 'text-success' : 'text-muted'} fw-semibold" style="font-size:0.65rem">
                                        <i class="bi bi-circle-fill me-1" style="font-size: 5px"></i> ${isOnline ? 'ONLINE' : 'IDLE / OFFLINE'}
                                    </small>
                                </div>
                            </div>
                            <div class="d-flex align-items-center gap-1">
                                <span class="badge rounded-pill bg-light text-dark border extra-small py-1 px-2" style="font-size:0.65rem">${c.trips.length} Tugas</span>
                                ${pendingBadgeHtml}
                                ${c.trips.length > 0 ? `<button class="btn btn-sm btn-link text-danger p-0 ms-1 text-decoration-none" onclick="deleteCourierActiveTrips('${c.rawId || c.id}', '${c.name.replace(/'/g, "\\'")}')" title="Batalkan Semua Tugas"><i class="bi bi-trash" style="font-size:0.8rem"></i></button>` : ''}
                            </div>
                        </div>

                        <div class="mb-2">
                            <div class="d-flex justify-content-between extra-small mb-1">
                                <span class="text-muted fw-medium">Progress Selesai</span>
                                <span class="fw-bold text-dark">${c.doneStops}/${c.totalStops} Stops</span>
                            </div>
                            <div class="progress" style="height: 6px; border-radius: 6px; background: #F1F5F9">
                                <div class="progress-bar progress-bar-striped progress-bar-animated" style="width: ${progress}%; background: ${cColor}; border-radius: 6px;"></div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <button class="btn btn-sm btn-dark w-100 py-1.5 fw-bold" style="border-radius: 8px; font-size:0.75rem" data-id="${c.rawId || c.id}" onclick="if(window.setFocusedDriver) window.setFocusedDriver(this.dataset.id); else focusOnCourier(this.dataset.id, true);">
                            <i class="bi bi-crosshair me-1"></i> FOCUS TRACKING
                        </button>
                        ${bulkSjSectionHtml}
                    </div>
                </div>
            </div>`;
    };

    const currentTab = window.monitorCategoryTab || 'all';

    // Top Segmented Control & Counters (Clean: Armada, Kurir, Driver tanpa icon)
    let html = `
        <div class="col-12 mb-3">
            <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 bg-white p-2.5 rounded-3 border shadow-sm">
                <div class="btn-group p-1 bg-light rounded-3 border" role="group">
                    <button type="button" class="btn btn-sm ${currentTab === 'all' ? 'btn-white fw-bold shadow-xs active text-dark' : 'text-secondary fw-semibold'}" onclick="setMonitorCategoryTab('all')">
                        Armada
                    </button>
                    <button type="button" class="btn btn-sm ${currentTab === 'kurir' ? 'btn-white fw-bold shadow-xs active text-primary' : 'text-secondary fw-semibold'}" onclick="setMonitorCategoryTab('kurir')">
                        Kurir <span class="badge bg-success-subtle text-success ms-1">${kurirOnlineCount} Online</span> <span class="badge bg-secondary-subtle text-muted ms-1">${kurirIdleCount} Idle</span>
                    </button>
                    <button type="button" class="btn btn-sm ${currentTab === 'driver' ? 'btn-white fw-bold shadow-xs active text-primary' : 'text-secondary fw-semibold'}" onclick="setMonitorCategoryTab('driver')">
                        Driver <span class="badge bg-success-subtle text-success ms-1">${driverOnlineCount} Online</span> <span class="badge bg-secondary-subtle text-muted ms-1">${driverIdleCount} Idle</span>
                    </button>
                </div>
                <div class="extra-small text-muted fw-semibold">
                    Live Tracking: <b>${kurirOnlineCount + driverOnlineCount} Online</b> dari <b>${courierIds.length} Personil</b>
                </div>
            </div>
        </div>
    `;

    // Render Kurir Section
    if ((currentTab === 'all' || currentTab === 'kurir') && kurirList.length > 0) {
        html += `
            <div class="col-12 mt-2 mb-2">
                <div class="d-flex align-items-center justify-content-between p-2.5 px-3 bg-light border rounded-3">
                    <div class="d-flex align-items-center gap-2">
                        <span class="badge bg-primary text-white fw-bold px-2.5 py-1">KURIR</span>
                        <span class="fw-bold text-dark fs-6">Kurir Motor (${kurirList.length})</span>
                    </div>
                    <div class="d-flex align-items-center gap-2 extra-small">
                        <span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1"><i class="bi bi-circle-fill me-1" style="font-size:5px;"></i>${kurirOnlineCount} Online</span>
                        <span class="badge bg-secondary-subtle text-muted border px-2 py-1">${kurirIdleCount} Idle</span>
                    </div>
                </div>
            </div>
        `;
        kurirList.forEach(c => { html += buildCard(c, 'Kurir'); });
    }

    // Render Driver Section
    if ((currentTab === 'all' || currentTab === 'driver') && driverList.length > 0) {
        html += `
            <div class="col-12 mt-3 mb-2">
                <div class="d-flex align-items-center justify-content-between p-2.5 px-3 bg-light border rounded-3">
                    <div class="d-flex align-items-center gap-2">
                        <span class="badge bg-warning text-dark fw-bold px-2.5 py-1">DRIVER</span>
                        <span class="fw-bold text-dark fs-6">Driver Mobil (${driverList.length})</span>
                    </div>
                    <div class="d-flex align-items-center gap-2 extra-small">
                        <span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1"><i class="bi bi-circle-fill me-1" style="font-size:5px;"></i>${driverOnlineCount} Online</span>
                        <span class="badge bg-secondary-subtle text-muted border px-2 py-1">${driverIdleCount} Idle</span>
                    </div>
                </div>
            </div>
        `;
        driverList.forEach(c => { html += buildCard(c, 'Driver'); });
    }

    mList.innerHTML = html;
}

async function uploadBulkSjFromCard(tripId) {
    const fileEl = document.getElementById(`card-bulk-file-${tripId}`);
    const files = fileEl?.files;
    if (!files || files.length === 0) return alert("Pilih minimal 1 file foto Bulk SJ terlebih dahulu!");

    try {
        const activeDb = getDb();
        if (!activeDb) throw new Error("Firestore Database belum siap.");

        showToast(`⏳ Mengompres & mengunggah ${files.length} foto Bulk SJ...`);

        const bulkFiles = Array.from(files);
        const uploadPromises = bulkFiles.map(async (f) => {
            const targetFile = await compressImageFile(f, 900, 0.65);
            return await uploadFileToCloudinaryOrFirebase(targetFile);
        });
        const uploadResults = await Promise.all(uploadPromises);
        const uploadedUrls = uploadResults.filter(u => u && typeof u === 'string' && u.trim().length > 0);

        if (uploadedUrls.length === 0) throw new Error("Gagal mengunggah foto.");

        let trip = allCurrentTrips.find(t => t.id === tripId);
        let existingUrls = getBulkSjUrls(trip);

        if (!trip) {
            const docSnap = await activeDb.collection('trips').doc(tripId).get();
            if (docSnap.exists) {
                existingUrls = getBulkSjUrls(docSnap.data());
            }
        }

        const combinedUrls = [...existingUrls, ...uploadedUrls];
        const combinedString = combinedUrls.join(',');

        await activeDb.collection('trips').doc(tripId).update({
            adminBulkSjUrl: combinedString,
            adminBulkSjUrls: combinedUrls
        });

        if (trip) {
            trip.adminBulkSjUrl = combinedString;
            trip.adminBulkSjUrls = combinedUrls;
        }

        showToast(`✅ ${uploadedUrls.length} Foto Bulk SJ Awal Kantor berhasil disimpan!`);
        fileEl.value = "";
        if (typeof renderMonitorUI === 'function') renderMonitorUI();
    } catch (e) {
        console.error("Upload Bulk SJ error:", e);
        alert("Gagal menyimpan foto Bulk SJ: " + e.message);
    }
}
window.uploadBulkSjFromCard = uploadBulkSjFromCard;

async function deleteBulkSjFromCard(tripId) {
    if (!confirm("Apakah Anda yakin ingin menghapus SELURUH foto Bulk Surat Jalan untuk pengiriman ini?")) return;

    try {
        const activeDb = getDb();
        if (!activeDb) throw new Error("Firestore Database belum siap.");

        showToast("⏳ Menghapus foto Bulk SJ...");

        await activeDb.collection('trips').doc(tripId).update({
            adminBulkSjUrl: "",
            adminBulkSjUrls: []
        });

        const trip = allCurrentTrips.find(t => t.id === tripId);
        if (trip) {
            trip.adminBulkSjUrl = "";
            trip.adminBulkSjUrls = [];
        }

        showToast("✅ Foto Bulk SJ berhasil dihapus!");
        if (typeof renderMonitorUI === 'function') renderMonitorUI();
    } catch (e) {
        console.error("Delete Bulk SJ error:", e);
        alert("Gagal menghapus foto Bulk SJ: " + e.message);
    }
}
window.deleteBulkSjFromCard = deleteBulkSjFromCard;

async function deleteSingleBulkSjPhoto(tripId, index) {
    if (!confirm(`Hapus Foto Bulk SJ #${index + 1}?`)) return;

    try {
        const activeDb = getDb();
        if (!activeDb) throw new Error("Firestore Database belum siap.");

        const trip = allCurrentTrips.find(t => t.id === tripId);
        if (!trip) return alert("Data pengiriman tidak ditemukan!");

        let currentUrls = getBulkSjUrls(trip);
        if (index < 0 || index >= currentUrls.length) return;

        currentUrls.splice(index, 1);
        const combinedString = currentUrls.join(',');

        await activeDb.collection('trips').doc(tripId).update({
            adminBulkSjUrl: combinedString,
            adminBulkSjUrls: currentUrls
        });

        trip.adminBulkSjUrl = combinedString;
        trip.adminBulkSjUrls = currentUrls;

        showToast("✅ Foto Bulk SJ berhasil dihapus!");
        openAuditSjModal(tripId);
        if (typeof renderMonitorUI === 'function') renderMonitorUI();
    } catch (e) {
        console.error("Delete single photo error:", e);
        alert("Gagal menghapus foto: " + e.message);
    }
}
window.deleteSingleBulkSjPhoto = deleteSingleBulkSjPhoto;

async function uploadBulkSjFromModal(tripId) {
    const fileEl = document.getElementById(`modal-bulk-file-${tripId}`);
    const files = fileEl?.files;
    if (!files || files.length === 0) return alert("Pilih minimal 1 file foto terlebih dahulu!");

    try {
        const activeDb = getDb();
        if (!activeDb) throw new Error("Firestore Database belum siap.");

        showToast(`⏳ Mengompres & mengunggah ${files.length} foto Bulk SJ...`);

        const bulkFiles = Array.from(files);
        const uploadPromises = bulkFiles.map(async (f) => {
            const targetFile = await compressImageFile(f, 900, 0.65);
            return await uploadFileToCloudinaryOrFirebase(targetFile);
        });
        const uploadResults = await Promise.all(uploadPromises);
        const uploadedUrls = uploadResults.filter(u => u && typeof u === 'string' && u.trim().length > 0);

        if (uploadedUrls.length === 0) throw new Error("Gagal mengunggah foto.");

        let trip = allCurrentTrips.find(t => t.id === tripId);
        let existingUrls = getBulkSjUrls(trip);

        if (!trip) {
            const docSnap = await activeDb.collection('trips').doc(tripId).get();
            if (docSnap.exists) {
                existingUrls = getBulkSjUrls(docSnap.data());
            }
        }

        const combinedUrls = [...existingUrls, ...uploadedUrls];
        const combinedString = combinedUrls.join(',');

        await activeDb.collection('trips').doc(tripId).update({
            adminBulkSjUrl: combinedString,
            adminBulkSjUrls: combinedUrls
        });

        if (trip) {
            trip.adminBulkSjUrl = combinedString;
            trip.adminBulkSjUrls = combinedUrls;
        }

        showToast(`✅ ${uploadedUrls.length} Foto Bulk SJ tambahan berhasil disimpan!`);
        openAuditSjModal(tripId);
        if (typeof renderMonitorUI === 'function') renderMonitorUI();
    } catch (e) {
        console.error("Upload Bulk SJ modal error:", e);
        alert("Gagal menyimpan foto Bulk SJ: " + e.message);
    }
}
window.uploadBulkSjFromModal = uploadBulkSjFromModal;

function openAuditSjModal(tripId) {
    const trip = allCurrentTrips.find(t => t.id === tripId);
    if (!trip) return alert("Data pengiriman tidak ditemukan!");

    const cName = getCourierDisplayName(trip.courierId);
    const tripIdShort = '#' + trip.id.substring(Math.max(0, trip.id.length - 6));

    const titleEl = document.getElementById('auditSjModalTitle');
    const subtitleEl = document.getElementById('auditSjModalSubtitle');
    if (titleEl) titleEl.innerHTML = `<i class="bi bi-file-earmark-check-fill text-primary me-2"></i>Audit & Pencocokan SJ H+1 (${cName} - ${tripIdShort})`;
    if (subtitleEl) subtitleEl.innerText = `Sandingkan Foto Bulk SJ Admin awal dengan Foto POD SJ Kurir yang terkirim`;

    const adminContainer = document.getElementById('audit-admin-sj-container');
    const courierContainer = document.getElementById('audit-courier-pod-container');
    const adminCountBadge = document.getElementById('audit-admin-sj-count');

    const sjUrls = getBulkSjUrls(trip);
    if (adminCountBadge) adminCountBadge.innerText = `${sjUrls.length} Foto`;

    if (adminContainer) {
        let uploadBarHtml = `
            <div class="p-2.5 bg-light border rounded-3 mb-3 text-start">
                <small class="text-muted extra-small fw-bold text-uppercase d-block mb-1.5"><i class="bi bi-plus-circle-fill me-1 text-primary"></i> Tambah 1 Foto Bulk SJ Lagi</small>
                <div class="d-flex gap-1.5 align-items-center">
                    <input type="file" id="modal-bulk-file-${trip.id}" accept="image/*" class="form-control form-control-sm py-1 px-2 extra-small bg-white" style="border-radius: 6px; font-size: 0.68rem;" multiple>
                    <button class="btn btn-xs btn-primary fw-bold text-nowrap px-2.5 py-1" style="font-size: 0.68rem; border-radius: 6px;" onclick="uploadBulkSjFromModal('${trip.id}')">+ Upload Lagi</button>
                </div>
            </div>`;

        if (sjUrls.length > 0) {
            adminContainer.innerHTML = uploadBarHtml + sjUrls.map((url, idx) => `
                <div class="card border rounded-3 p-2 bg-white shadow-2fs mb-2 text-start">
                    <div class="d-flex align-items-center gap-3">
                        <img src="${url}" onerror="this.onerror=null; this.src='https://placehold.co/100x100?text=Gambar+Rusak';" class="rounded-2 cursor-pointer border flex-shrink-0" style="width: 85px; height: 85px; object-fit: cover;" onclick="openPoDModal('${url}')" title="Klik untuk memperbesar">
                        <div class="flex-grow-1 min-w-0">
                            <div class="fw-bold extra-small text-dark mb-1 text-truncate">📄 Foto Bulk SJ Admin #${idx + 1}</div>
                            <div class="d-flex gap-2 flex-wrap">
                                <a href="${url}" target="_blank" download class="btn btn-xs btn-dark fw-bold py-1 px-2.5" style="font-size:0.7rem; border-radius: 6px;">
                                    <i class="bi bi-download me-1"></i> Download HD
                                </a>
                                <button class="btn btn-xs btn-outline-danger fw-bold py-1 px-2.5" style="font-size:0.7rem; border-radius: 6px;" onclick="deleteSingleBulkSjPhoto('${trip.id}', ${idx})" title="Hapus foto ini">
                                    <i class="bi bi-trash-fill me-1"></i> Hapus
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            adminContainer.innerHTML = uploadBarHtml + `<div class="text-muted extra-small py-4 text-center"><i class="bi bi-image fs-1 d-block mb-2 opacity-50"></i> Belum ada Foto Bulk SJ Kantor dari Admin untuk tugas ini.</div>`;
        }
    }

    if (courierContainer) {
        const podSjItems = [];
        if (trip.destinations) {
            trip.destinations.forEach((d, idx) => {
                const locName = d.locationName || `Stop ${d.stopIndex || (idx + 1)}`;
                if (d.proofPhotoSj) {
                    const firstUrl = d.proofPhotoSj.split(',')[0].trim();
                    if (firstUrl) {
                        podSjItems.push({
                            url: firstUrl,
                            stopName: locName,
                            stopIndex: d.stopIndex || (idx + 1),
                            status: d.status
                        });
                    }
                } else if (d.proofPhotoUrl) {
                    const firstUrl = d.proofPhotoUrl.split(',')[0].trim();
                    if (firstUrl) {
                        podSjItems.push({
                            url: firstUrl,
                            stopName: locName,
                            stopIndex: d.stopIndex || (idx + 1),
                            status: d.status
                        });
                    }
                }
            });
        }

        if (podSjItems.length === 0) {
            courierContainer.innerHTML = `<div class="text-muted extra-small py-5 text-center"><i class="bi bi-inbox fs-2 d-block mb-2 opacity-50"></i> Belum ada foto POD Surat Jalan terkirim dari kurir.</div>`;
        } else {
            courierContainer.innerHTML = podSjItems.map(p => `
                <div class="card border rounded-3 p-2 bg-white shadow-2fs mb-2 text-start">
                    <div class="d-flex align-items-center gap-3">
                        <img src="${p.url}" onerror="this.onerror=null; this.src='https://placehold.co/100x100?text=Gambar+Rusak';" class="rounded-2 cursor-pointer border flex-shrink-0" style="width: 85px; height: 85px; object-fit: cover;" onclick="openPoDModal('${p.url}')" title="Klik untuk memperbesar">
                        <div class="flex-grow-1 min-w-0">
                            <div class="fw-bold extra-small text-dark text-truncate">Stop #${p.stopIndex}: ${p.stopName}</div>
                            <span class="badge bg-success text-white extra-small fw-bold mt-1" style="font-size:0.65rem;"><i class="bi bi-check-circle me-1"></i> Terkirim / POD Verified</span>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }

    const modalEl = document.getElementById('auditSjModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        new bootstrap.Modal(modalEl).show();
    }
}
window.openAuditSjModal = openAuditSjModal;

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

    const todayStr = getLocalTodayDateString();

    if (cardType === 'completed') {
        if (sStatus) sStatus.value = "completed";
        if (sStart) sStart.value = todayStr;
        if (sEnd) sEnd.value = todayStr;
        if (typeof showToast === 'function') showToast("Menampilkan pengiriman Selesai Hari Ini");
    } else if (cardType === 'active_tasks') {
        if (sStatus) sStatus.value = "active_all";
        if (sStart) sStart.value = "";
        if (sEnd) sEnd.value = "";
        if (typeof showToast === 'function') showToast("Menampilkan seluruh Tugas Aktif di Sistem");
    } else if (cardType === 'active' || cardType === 'today') {
        if (sStatus) sStatus.value = "all";
        if (sStart) sStart.value = todayStr;
        if (sEnd) sEnd.value = todayStr;
        if (typeof showToast === 'function') showToast("Menampilkan pengiriman Hari Ini");
    } else if (cardType === 'returned' || cardType === 'delayed') {
        if (sStatus) sStatus.value = "returned";
        if (sStart) sStart.value = todayStr;
        if (sEnd) sEnd.value = todayStr;
        if (typeof showToast === 'function') showToast("Menampilkan pengiriman Returned / ACC Pending Hari Ini");
    } else if (cardType === 'in_transit') {
        if (sStatus) sStatus.value = "in_progress";
        if (sStart) sStart.value = todayStr;
        if (sEnd) sEnd.value = todayStr;
        if (typeof showToast === 'function') showToast("Menampilkan pengiriman In Progress Hari Ini");
    } else if (cardType === 'total_km') {
        if (sStatus) sStatus.value = "completed";
        if (sStart) sStart.value = todayStr;
        if (sEnd) sEnd.value = todayStr;
        if (typeof showToast === 'function') showToast("Menampilkan pengiriman Selesai Hari Ini");
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

    let filterStartMs = todayDayMs;
    let filterEndMs = todayDayMs + (24 * 60 * 60 * 1000) - 1;

    if (startDateVal) {
        const parsed = parseDateBoundary(startDateVal, false);
        if (parsed !== null) filterStartMs = parsed;
    }
    if (endDateVal) {
        const parsed = parseDateBoundary(endDateVal, true);
        if (parsed !== null) filterEndMs = parsed;
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

    (allCurrentTrips || []).forEach(t => {
        if (!t) return;
        if (typeof isTripInActiveBranch === 'function' && !isTripInActiveBranch(t)) {
            return;
        }

        const courierIdStr = t.courierId || '';
        const cName = typeof getCourierDisplayName === 'function' ? getCourierDisplayName(courierIdStr) : (courierIdStr ? courierIdStr.substring(0, 8) : 'Unknown');
        const tripIdStr = String(t.id || t.tripId || '');
        const tripIdShort = '#' + (tripIdStr.length > 6 ? tripIdStr.substring(tripIdStr.length - 6) : tripIdStr);
        const tripMs = t.date?.seconds ? t.date.seconds * 1000 : (t.date ? new Date(t.date).getTime() : (tripIdStr ? parseInt(tripIdStr.replace('TRIP_', '')) || 0 : 0));
        const tripDateStr = tripMs ? new Date(tripMs).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

        // Check Carrier Filter
        if (selectedCarrier !== "all") {
            const courierInfo = normalizeCourierIdentity(courierIdStr, cName);
            const filterInfo = normalizeCourierIdentity(selectedCarrier, "");
            if (courierIdStr !== selectedCarrier &&
                cName.toLowerCase() !== selectedCarrier.toLowerCase() &&
                courierInfo.canonicalId !== filterInfo.canonicalId) {
                return;
            }
        }

        // Check Date Filter using robust date range check
        if (filterStartMs > 0 && !isTripInDateRange(t, filterStartMs, filterEndMs)) {
            return;
        }

        if (t.destinations && t.destinations.length > 0) {
            t.destinations.forEach((d, idx) => {
                if (!d) return;
                const locName = d.locationName || 'Destination';
                const fullAddress = d.address || '';
                const stopIdx = d.stopIndex || (idx + 1);

                const uniqueShipmentId = `${tripIdShort}-${stopIdx}`;

                const photos = extractDestinationPhotos(d, t);
                const hasAnyPhoto = photos.allUrls.length > 0;

                const rawStatus = d.status || 'pending';
                const isKlienTutupApproved = (rawStatus === 'pending' && d.pendingReason && d.pendingReason.length > 0);
                const isPendingApproval = (rawStatus === 'pending_approval');

                const isDoneOrHasPhoto = (d.status === 'done' || d.status === 'completed' || hasAnyPhoto);
                const status = isDoneOrHasPhoto ? 'completed' : (d.status === 'arrived' ? 'in_progress' : (isPendingApproval ? 'pending_approval' : (isKlienTutupApproved ? 'klien_tutup' : (t.status || 'pending'))));
                const statusClass = status === 'completed' ? 'delivered' : (status === 'assigned' ? 'pending' : (isKlienTutupApproved ? 'danger' : 'transit'));

                let timeStr = 'Finished';
                if (status !== 'completed') {
                    if (d.arrivalTime) {
                        timeStr = new Date(d.arrivalTime.seconds * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                    } else {
                        timeStr = 'On Delivery';
                    }
                } else if (d.completedTime) {
                    timeStr = new Date(d.completedTime.seconds * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                }

                const searchableText = `${uniqueShipmentId} ${tripIdShort} ${t.id} ${cName} ${locName} ${fullAddress} ${status} ${d.pendingReason || ''} ${tripDateStr}`.toLowerCase();
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
                } else if (selectedStatus === 'pending') {
                    matchStatus = (status === 'pending' || isKlienTutupApproved || isPendingApproval);
                } else if (selectedStatus === 'delayed') {
                    const lastUpdate = t.destinations ? t.destinations.filter(d => d.status === 'done' || d.status === 'arrived').reduce((max, d) => {
                        const time = (d.completedTime || d.arrivalTime)?.seconds * 1000 || 0;
                        return time > max ? time : max;
                    }, (t.date?.seconds || 0) * 1000) : 0;
                    matchStatus = (status !== 'completed') && (Date.now() - lastUpdate > 30 * 60 * 1000);
                } else if (selectedStatus === 'returned') {
                    matchStatus = (status === 'returned' || status === 'failed' || status === 'klien_tutup' || isKlienTutupApproved || d.status === 'returned' || d.status === 'failed');
                } else {
                    matchStatus = (status === selectedStatus);
                }

                if (matchSearch && matchStatus) {
                    const photos = extractDestinationPhotos(d, t);

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
                        isKlienTutupApproved: isKlienTutupApproved,
                        isPendingApproval: isPendingApproval,
                        pendingReason: d.pendingReason || '',
                        pendingProofPhotoUrl: d.pendingProofPhotoUrl || '',
                        carrier: cName,
                        eta: timeStr,
                        proofSjUrl: photos.sjUrl,
                        proofItemUrl: photos.itemUrl,
                        proofUrl: d.proofPhotoUrl || photos.sjUrl || photos.itemUrl || ''
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
        carrierSelect.innerHTML = '<option value="all">Semua Personil</option>' + buildCourierOptgroupHtml('', 'canonicalId');
    }

    if (shipmentRows.length === 0) {
        const isSunday = new Date().getDay() === 0;
        const isFilteringToday = (!startDateVal && !endDateVal) || (startDateVal === getLocalTodayDateString() && endDateVal === getLocalTodayDateString());
        const emptyMsg = (isSunday && isFilteringToday)
            ? "Hari ini hari Minggu (Libur Operasional). Tidak ada jadwal pengiriman kurir aktif."
            : "Tidak ada data pengiriman yang cocok dengan filter tanggal/status ini.";
        table.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-muted"><i class="bi bi-calendar2-check fs-2 d-block mb-2 text-secondary"></i>${emptyMsg}</td></tr>`;
        updateGlobalStats();
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

    const maxRows = (startDateVal || endDateVal || selectedStatus !== 'all' || selectedCarrier !== 'all' || rawSearch.length > 0) ? 1000 : 200;

    const rowsHtml = [];
    shipmentRows.slice(0, maxRows).forEach(s => {
        let podIconsHtml = '';
        if (s.proofSjUrl) {
            podIconsHtml += `<i class="bi bi-file-earmark-check-fill text-success ms-1 cursor-pointer fs-6" data-url="${s.proofSjUrl.replace(/"/g, '&quot;')}" onclick="openPoDModal(this.dataset.url)" title="Lihat Foto Surat Jalan (SJ)"></i>`;
        }
        if (s.proofItemUrl) {
            const itemCount = s.proofItemUrl.split(',').length;
            const itemBadgeTitle = itemCount > 1 ? `Lihat Foto Fisik Barang (${itemCount} Foto)` : `Lihat Foto Fisik Barang`;
            podIconsHtml += `<i class="bi bi-box-seam-fill text-primary ms-1 cursor-pointer fs-6" data-url="${s.proofItemUrl.replace(/"/g, '&quot;')}" onclick="openPoDModal(this.dataset.url)" title="${itemBadgeTitle}"></i>`;
        }
        if (!podIconsHtml && s.proofUrl) {
            podIconsHtml = `<i class="bi bi-camera-fill text-success ms-1 cursor-pointer" data-url="${s.proofUrl.replace(/"/g, '&quot;')}" onclick="openPoDModal(this.dataset.url)" title="Lihat Foto PoD"></i>`;
        }
        if (!podIconsHtml && s.pendingProofPhotoUrl) {
            podIconsHtml = `<i class="bi bi-camera-fill text-danger ms-1 cursor-pointer" data-url="${s.pendingProofPhotoUrl.replace(/"/g, '&quot;')}" onclick="openPoDModal(this.dataset.url)" title="Lihat Foto Lokasi Tutup"></i>`;
        }

        const uploadBtn = `<button class="btn btn-sm btn-link text-primary p-0 ms-1 text-decoration-none" onclick="openManualUploadModal('${s.tripId}', ${s.stopIndex}, '${s.destinationName.replace(/'/g, "\\'")}')" title="Upload Foto PoD Manual Admin"><i class="bi bi-upload"></i></button>`;

        let statusBadgeHtml = `<span class="badge-pill badge-${s.statusClass} fw-normal">${s.status}</span>`;
        let trStyle = '';

        if (s.isKlienTutupApproved) {
            trStyle = 'style="background: #FEF2F2 !important; border-left: 4px solid #EF4444 !important;"';
            statusBadgeHtml = `<span class="badge bg-danger text-white fw-bold px-2 py-1"><i class="bi bi-x-circle me-1"></i> PENDING (KLIEN TUTUP)</span>`;
        } else if (s.isPendingApproval) {
            trStyle = 'style="background: #FFF7ED !important; border-left: 4px solid #F97316 !important;"';
            statusBadgeHtml = `
                <span class="badge bg-warning text-dark fw-bold px-2 py-1 mb-1 d-block"><i class="bi bi-hourglass-split me-1"></i> APPROVAL PENDING</span>
                <div class="d-flex gap-1 mt-1">
                    <button class="btn btn-xs btn-success py-0.5 px-2 fw-bold" style="font-size: 0.68rem;" onclick="approveDestinationPending('${s.tripId}', ${s.stopIndex})"><i class="bi bi-check me-1"></i>Setujui</button>
                    <button class="btn btn-xs btn-outline-danger py-0.5 px-2 fw-bold" style="font-size: 0.68rem;" onclick="rejectDestinationPending('${s.tripId}', ${s.stopIndex})"><i class="bi bi-x me-1"></i>Tolak</button>
                </div>`;
        }

        rowsHtml.push(`<tr ${trStyle}>
            <td class="fw-normal text-muted extra-small text-nowrap" style="white-space: nowrap;">${s.dateStr}</td>
            <td class="fw-bold text-dark text-nowrap" style="white-space: nowrap;">${s.displayId} ${podIconsHtml} ${uploadBtn}</td>
            <td>
                <div class="fw-bold text-dark text-truncate" style="max-width:240px">${s.destinationName}</div>
                ${s.pendingReason ? `<small class="text-danger extra-small d-block fw-bold text-truncate" style="max-width:240px"><i class="bi bi-exclamation-circle me-1"></i>${s.pendingReason}</small>` : (s.fullAddress ? `<small class="text-muted extra-small d-block text-truncate fw-normal" style="max-width:240px">${s.fullAddress}</small>` : '')}
            </td>
            <td class="text-nowrap" style="white-space: nowrap;">${statusBadgeHtml}</td>
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

    const todayStr = getLocalTodayDateString();

    if (sSearch) sSearch.value = "";
    if (sStatus) sStatus.value = "all";
    if (sCarrier) sCarrier.value = "all";
    if (sDate) sDate.value = "today";
    if (sStart) sStart.value = todayStr;
    if (sEnd) sEnd.value = todayStr;

    recentSortField = 'date';
    recentSortAsc = false;

    renderRecentShipments();
    showToast("Filter tabel dikembalikan ke Hari Ini.");
}

function openManualUploadModal(tripId, stopIndex, locationName) {
    const tripIdEl = document.getElementById('upload-modal-trip-id');
    const stopIdxEl = document.getElementById('upload-modal-stop-index');
    const locNameEl = document.getElementById('upload-modal-location-name');
    const categoryEl = document.getElementById('upload-modal-category');
    const fileEl = document.getElementById('upload-modal-file');
    const statusEl = document.getElementById('upload-modal-status');

    if (tripIdEl) tripIdEl.value = tripId;
    if (stopIdxEl) stopIdxEl.value = stopIndex;
    if (locNameEl) locNameEl.innerText = locationName || "Destination Stop #" + stopIndex;
    if (categoryEl) categoryEl.value = "sj";
    if (fileEl) fileEl.value = "";
    if (statusEl) statusEl.innerText = "";

    const modalEl = document.getElementById('manualUploadModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        new bootstrap.Modal(modalEl).show();
    }
}

async function submitManualUploadPhoto() {
    const tripId = document.getElementById('upload-modal-trip-id')?.value;
    const stopIndex = parseInt(document.getElementById('upload-modal-stop-index')?.value || '0');
    const category = document.getElementById('upload-modal-category')?.value || 'sj';
    const files = document.getElementById('upload-modal-file')?.files;
    const statusEl = document.getElementById('upload-modal-status');
    const btn = document.getElementById('upload-modal-submit-btn');

    if (!tripId || !files || files.length === 0) return alert("Pilih minimal 1 file foto terlebih dahulu!");

    const fileList = Array.from(files);
    const totalFiles = fileList.length;

    if (btn) { 
        btn.disabled = true; 
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>MENGUNGGAH (${totalFiles} Foto)...`; 
    }
    if (statusEl) {
        statusEl.innerHTML = `<span class="text-primary"><i class="bi bi-arrow-repeat me-1"></i>Mengompresi dan mengunggah ${totalFiles} foto sekaligus...</span>`;
    }

    try {
        const activeDb = getDb();
        if (!activeDb) throw new Error("Firestore Database belum terhubung.");

        let doneCount = 0;
        const uploadPromises = fileList.map(async (file) => {
            const targetFile = await compressImageFile(file, 900, 0.65);
            const photoUrl = await uploadFileToCloudinaryOrFirebase(targetFile);
            doneCount++;
            if (statusEl) {
                statusEl.innerHTML = `<span class="text-info"><i class="bi bi-cloud-arrow-up me-1"></i>Foto ${doneCount} dari ${totalFiles} selesai diunggah...</span>`;
            }
            return photoUrl;
        });

        const results = await Promise.all(uploadPromises);
        const uploadedUrls = results.filter(u => u && typeof u === 'string' && u.trim().length > 0);

        if (uploadedUrls.length === 0) throw new Error("Gagal mengunggah foto. Silakan periksa koneksi internet Anda.");

        if (statusEl) {
            statusEl.innerHTML = `<span class="text-success"><i class="bi bi-check2-all me-1"></i>Menyimpan data stop ke Firestore...</span>`;
        }

        const tripDocRef = activeDb.collection('trips').doc(tripId);
        const tripSnap = await tripDocRef.get();

        if (tripSnap.exists) {
            const tData = tripSnap.data();
            const targetLocName = document.getElementById('upload-modal-location-name')?.innerText || '';

            const updatedDests = (tData.destinations || []).map(d => {
                const isMatch = d.stopIndex === stopIndex || (d.stopIndex === undefined && d.locationName === targetLocName);
                if (isMatch) {
                    let existingSj = d.proofPhotoSj || '';
                    let existingItems = Array.isArray(d.proofPhotoItems) ? [...d.proofPhotoItems] : (typeof d.proofPhotoItems === 'string' && d.proofPhotoItems ? d.proofPhotoItems.split(',').map(s=>s.trim()).filter(Boolean) : []);

                    if (category === 'sj') {
                        if (existingSj && existingSj.trim().length > 0) {
                            const sjArr = existingSj.split(',').map(s=>s.trim()).filter(Boolean);
                            uploadedUrls.forEach(u => { if (!sjArr.includes(u)) sjArr.push(u); });
                            existingSj = sjArr.join(',');
                        } else {
                            existingSj = uploadedUrls.join(',');
                        }
                    } else if (category === 'item') {
                        uploadedUrls.forEach(u => {
                            if (!existingItems.includes(u)) existingItems.push(u);
                        });
                    }

                    const combined = [];
                    if (existingSj) combined.push(existingSj);
                    existingItems.forEach(u => { if (!combined.includes(u)) combined.push(u); });

                    return {
                        ...d,
                        status: "done",
                        completedTime: firebase.firestore.Timestamp.now(),
                        proofPhotoSj: existingSj,
                        proofPhotoItems: existingItems,
                        proofPhotoUrl: combined.join(',')
                    };
                }
                return d;
            });

            const allDone = updatedDests.every(d => d.status === 'done' || (d.proofPhotoUrl && d.proofPhotoUrl.length > 0));
            const updateMap = { destinations: updatedDests };
            if (allDone) updateMap.status = "completed";
            else if (tData.status === "assigned" || tData.status === "accepted") updateMap.status = "in_progress";

            await tripDocRef.update(updateMap);

            showToast("✅ BUKTI FOTO BERHASIL DIUNGGAH! Status stop diperbarui ke Selesai.");
            const modalEl = document.getElementById('manualUploadModal');
            if (modalEl && typeof bootstrap !== 'undefined') {
                const bsModal = bootstrap.Modal.getInstance(modalEl);
                if (bsModal) bsModal.hide();
            }

            if (typeof renderRecentShipments === 'function') renderRecentShipments();
            if (typeof loadFullHistory === 'function' && document.getElementById('view-reports')?.classList.contains('active')) loadFullHistory();
        } else {
            throw new Error("Data pengiriman tidak ditemukan di Firestore.");
        }
    } catch(e) {
        console.error("Manual upload error:", e);
        alert("Gagal mengunggah foto: " + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-upload me-2"></i> UNGGAH & SELESAIKAN STOP'; }
        if (statusEl) statusEl.innerText = "";
    }
}

function exportRecentShipmentsToExcel() {
    if (typeof XLSX === 'undefined') return alert("Library SheetJS (XLSX) belum teruat. Silakan refresh halaman!");
    const exportData = [];

    const rawSearch = (document.getElementById('recent-shipment-search')?.value || "").toLowerCase().trim();
    const selectedStatus = document.getElementById('recent-status-filter')?.value || "all";
    const selectedCarrier = document.getElementById('recent-carrier-filter')?.value || "all";
    const startDateVal = document.getElementById('recent-start-date')?.value;
    const endDateVal = document.getElementById('recent-end-date')?.value;

    const now = new Date();
    const todayDayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    let filterStartMs = 0;
    let filterEndMs = Infinity;

    if (startDateVal) {
        const parsed = parseDateBoundary(startDateVal, false);
        if (parsed !== null) filterStartMs = parsed;
    }
    if (endDateVal) {
        const parsed = parseDateBoundary(endDateVal, true);
        if (parsed !== null) filterEndMs = parsed;
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

    (allCurrentTrips || []).forEach(t => {
        if (!t) return;
        if (typeof isTripInActiveBranch === 'function' && !isTripInActiveBranch(t)) {
            return;
        }

        const courierIdStr = t.courierId || '';
        const cName = typeof getCourierDisplayName === 'function' ? getCourierDisplayName(courierIdStr) : (courierIdStr ? courierIdStr.substring(0, 8) : 'Unknown');
        const tripIdStr = String(t.id || t.tripId || '');
        const tripIdShort = '#' + (tripIdStr.length > 6 ? tripIdStr.substring(tripIdStr.length - 6) : tripIdStr);
        const tripMs = t.date?.seconds ? t.date.seconds * 1000 : (t.date ? new Date(t.date).getTime() : (tripIdStr ? parseInt(tripIdStr.replace('TRIP_', '')) || 0 : 0));
        const tripDateStr = tripMs ? new Date(tripMs).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

        // Check Carrier Filter
        if (selectedCarrier !== "all" && courierIdStr !== selectedCarrier && cName.toLowerCase() !== selectedCarrier.toLowerCase()) {
            return;
        }

        // Check Date Filter
        if (filterStartMs > 0 && (tripMs < filterStartMs || tripMs > filterEndMs)) {
            return;
        }

        if (t.destinations && t.destinations.length > 0) {
            t.destinations.forEach((d, idx) => {
                if (!d) return;
                const locName = d.locationName || 'Destination';
                const fullAddress = d.address || '-';
                const stopIdx = d.stopIndex || (idx + 1);
                const uniqueShipmentId = `${tripIdShort}-${stopIdx}`;

                const rawStatus = d.status || 'pending';
                const isKlienTutupApproved = (rawStatus === 'pending' && d.pendingReason && d.pendingReason.length > 0);
                const isPendingApproval = (rawStatus === 'pending_approval');
                const status = (d.status === 'done' || d.proofPhotoUrl) ? 'completed' : (d.status === 'arrived' ? 'in_progress' : (isPendingApproval ? 'pending_approval' : (isKlienTutupApproved ? 'klien_tutup' : (t.status || 'pending'))));

                const searchableText = `${uniqueShipmentId} ${tripIdShort} ${tripIdStr} ${cName} ${locName} ${fullAddress} ${status} ${d.pendingReason || ''} ${tripDateStr}`.toLowerCase();
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
                } else if (selectedStatus === 'pending') {
                    matchStatus = (status === 'pending' || isKlienTutupApproved || isPendingApproval);
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
                    const arrivalStr = d.arrivalTime?.seconds ? new Date(d.arrivalTime.seconds * 1000).toLocaleString('id-ID') : '-';
                    const completedStr = d.completedTime?.seconds ? new Date(d.completedTime.seconds * 1000).toLocaleString('id-ID') : '-';

                    exportData.push({
                        "Tanggal": tripDateStr,
                        "Shipment ID": uniqueShipmentId,
                        "Trip Full ID": tripIdStr,
                        "Courier": cName,
                        "Stop #": stopIdx,
                        "Destination Name": locName,
                        "Full Address": fullAddress,
                        "Status": status,
                        "Arrival Time": arrivalStr,
                        "Completed Time": completedStr,
                        "Pending Reason": d.pendingReason || '-',
                        "Proof Photo URL": d.proofPhotoUrl || d.proofPhotoSj || '-'
                    });
                }
            });
        }
    });

    if (exportData.length === 0) return alert("Tidak ada data pengantaran yang sesuai filter untuk diekspor!");

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
    if (typeof XLSX === 'undefined') return alert("Library SheetJS (XLSX) belum teruat. Silakan refresh halaman!");
    if (!lastLoadedHistory || lastLoadedHistory.length === 0) return alert("Tidak ada data laporan untuk diekspor!");

    const exportData = [];
    lastLoadedHistory.forEach(t => {
        if (!t) return;
        const courierIdStr = t.courierId || '';
        const cName = registeredUsers[courierIdStr] || (courierIdStr ? courierIdStr.substring(0,8) : 'Unknown');
        const dateStr = t.date?.seconds ? new Date(t.date.seconds * 1000).toLocaleString('id-ID') : '-';

        if (t.destinations && t.destinations.length > 0) {
            t.destinations.forEach((d, idx) => {
                if (!d) return;
                exportData.push({
                    "Trip ID": t.id || t.tripId || '-',
                    "Courier": cName,
                    "Date": dateStr,
                    "Stop Index": d.stopIndex || (idx + 1),
                    "Location Name": d.locationName || 'TBD',
                    "Address": d.address || '-',
                    "Stop Status": d.status || 'pending',
                    "Trip Status": t.status || '-',
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
        cachedAllClients = null;
        status.innerHTML = `<span class="text-success">SUCCESS! ${rows.length} Clients synced to database.</span>`;
        setTimeout(() => progress.classList.add('d-none'), 2000);
        showToast("Clients Database Updated!");
        const regEl = document.getElementById('region-filter');
        loadClientsByRegion(regEl ? regEl.value : "", true);
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
                const val = parseFloat(data.geofenceRadius);
                cfgGeofenceEl.value = val >= 200 ? val : 200;
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

    const minsInput = document.getElementById('cfg-interval');
    const geofenceInput = document.getElementById('cfg-geofence');

    let mins = parseFloat(minsInput?.value || "30");
    let geofence = parseFloat(geofenceInput?.value || "200");

    if (isNaN(mins) || mins < 1) mins = 30;
    if (isNaN(geofence) || geofence < 200) {
        geofence = 200;
    }

    if (minsInput) minsInput.value = mins;
    if (geofenceInput) geofenceInput.value = geofence;

    const intervalMs = mins * 60 * 1000;

    try {
        await activeDb.collection('config').doc('tracking').set({
            intervalMs: intervalMs,
            geofenceRadius: geofence,
            minDistance: geofence,
            updatedAt: firebase.firestore.Timestamp.now()
        }, { merge: true });

        showToast(`Konfigurasi tersimpan: ${mins} Menit / ${geofence} Meter.`);
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
    const activeDb = getDb();
    if (!activeDb) return alert("Firebase belum siap.");
    const v = document.getElementById('upd-version').value, f = document.getElementById('upd-file').files[0];
    if (!v) return alert("Masukkan Version Code terlebih dahulu (contoh: 10)!");

    const prog = document.getElementById('upd-progress');
    const bar = prog ? prog.querySelector('.progress-bar') : null;
    if (prog) prog.classList.remove('d-none');
    if (bar) bar.style.width = '30%';

    try {
        let downloadUrl = "";

        if (f) {
            if (f.name.toLowerCase().endsWith('.apk') || (f.type && f.type.includes('android'))) {
                // APK is pre-hosted on Vercel assets CDN for instant 0ms deployment!
                downloadUrl = window.location.origin + "/assets/" + f.name;
                if (bar) bar.style.width = '80%';
            } else {
                if (bar) bar.style.width = '50%';
                downloadUrl = await uploadFileToCloudinaryOrFirebase(f);
                if (bar) bar.style.width = '80%';
            }
        }

        if (!downloadUrl) {
            downloadUrl = window.location.origin + "/assets/KurirKita_v10.apk";
        }

        if (bar) bar.style.width = '100%';

        await activeDb.collection('config').doc('app_status').set({
            versionCode: parseInt(v),
            downloadUrl: downloadUrl,
            updatedAt: firebase.firestore.Timestamp.now()
        }, { merge: true });

        showToast("✅ Berhasil mempublikasikan pembaruan APK (Versi " + v + ")!");
        setTimeout(() => {
            if (prog) prog.classList.add('d-none');
        }, 800);
    } catch (e) {
        console.error("Publish Update Error:", e);
        if (prog) prog.classList.add('d-none');
        alert("Gagal mempublikasikan pembaruan: " + e.message);
    }
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

    if (!emailEl || !passEl) {
        alert("Form login tidak ditemukan pada halaman.");
        return;
    }

    const email = emailEl.value.trim();
    const pass = passEl.value;

    if (err) err.classList.add('d-none');

    if (!email || !pass) {
        const msg = "Email dan password wajib diisi.";
        if (err) {
            err.innerText = msg;
            err.classList.remove('d-none');
        }
        alert(msg);
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
        console.log("Mencoba login dengan email:", email);
        await firebaseAuth.signInWithEmailAndPassword(email, pass);
        console.log("Login Firebase berhasil!");
    } catch (e) {
        console.error("Login Error Details:", e);
        if (btn) {
            btn.disabled = false;
            btn.innerText = "SIGN IN";
        }

        let friendlyMsg = e.message || String(e);
        if (e.code === 'auth/invalid-credential' || e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password') {
            friendlyMsg = "Email (" + email + ") atau password yang Anda masukkan salah. Silakan periksa kembali password akun tersebut di Firebase Console.";
        } else if (e.code === 'auth/invalid-email') {
            friendlyMsg = "Format email tidak valid. Gunakan format email seperti adminlogistik@wellen.id";
        } else if (e.code === 'auth/too-many-requests') {
            friendlyMsg = "Akses terblokir sementara karena terlalu banyak percobaan login yang gagal. Silakan tunggu 2-3 menit.";
        } else if (e.code === 'auth/network-request-failed') {
            friendlyMsg = "Gagal terhubung ke Firebase. Periksa koneksi internet Anda.";
        } else if (e.code === 'auth/unauthorized-domain') {
            friendlyMsg = "Domain (" + window.location.hostname + ") belum diizinkan. Buka web menggunakan URL http://localhost:3000 atau tambahkan domain di Firebase Console -> Authentication -> Settings -> Authorized Domains.";
        }

        const fullErrText = friendlyMsg + (e.code ? " [" + e.code + "]" : "");
        if (err) {
            err.innerText = fullErrText;
            err.classList.remove('d-none');
        }
        alert(fullErrText);
    }
}

function loginAsLocalDemoAdmin() {
    currentUserRole = 'super_admin';
    currentUserBranchId = 'pusat';

    const loginScreen = document.getElementById('login-screen');
    const mainWrapper = document.getElementById('main-wrapper');
    const profileName = document.getElementById('profile-name');
    const profileRole = document.getElementById('profile-role');

    if (loginScreen) loginScreen.style.setProperty('display', 'none', 'important');
    if (mainWrapper) mainWrapper.style.setProperty('display', 'flex', 'important');
    if (profileName) profileName.innerText = 'Super Admin';
    if (profileRole) profileRole.innerHTML = `<span class="d-inline-block rounded-circle bg-success me-1" style="width: 7px; height: 7px;"></span>Super Admin`;

    applyRoleAccessControl();
    if (typeof updateGlobalStats === 'function') updateGlobalStats();
    if (typeof renderRecentShipments === 'function') renderRecentShipments();
    if (typeof renderMonitorUI === 'function') renderMonitorUI();

    if (typeof initMaps === 'function') initMaps();
    if (typeof refreshMapSizes === 'function') refreshMapSizes();
}
window.loginAsLocalDemoAdmin = loginAsLocalDemoAdmin;

function initAuthListener() {
    ensureFirebaseApp();
    const firebaseAuth = getAuth();
    if (firebaseAuth) {
        firebaseAuth.onAuthStateChanged(user => {
            if (window.isDemoMode) return;
            const loginScreen = document.getElementById('login-screen');
            const mainWrapper = document.getElementById('main-wrapper');

            if (user) {
                if (loginScreen) loginScreen.style.setProperty('display', 'none', 'important');
                if (mainWrapper) mainWrapper.style.setProperty('display', 'flex', 'important');

                const currentDb = getDb();
                if (currentDb) {
                    currentDb.collection('users').doc(user.uid).get().then(doc => {
                        let uData = doc.exists ? doc.data() : {};
                        let uRole = (uData.role || '').toLowerCase();
                        let uEmail = (user.email || '').toLowerCase();

                        if (!uRole) {
                            if (uEmail.includes('sales')) {
                                uRole = 'sales_admin';
                            } else if (uEmail.includes('dm2')) {
                                uRole = 'admin_dm2';
                            } else if (uEmail.includes('branch') || uEmail.includes('cikokol')) {
                                uRole = 'branch_admin';
                            } else if (uEmail.includes('adminlogistik') || uEmail.includes('admin_logistik')) {
                                uRole = 'super_admin';
                            } else {
                                uRole = 'super_admin';
                            }
                        }

                        currentUserRole = uRole;
                        currentUserBranchId = (uData.branchId || (uRole === 'admin_dm2' || uRole === 'dm2' ? 'dm2' : 'pusat')).toLowerCase();

                        applyRoleAccessControl();

                        const branchWrapper = document.getElementById('branch-selector-wrapper');
                        const branchSelect = document.getElementById('header-branch-filter');

                        if (currentUserRole === 'admin_dm2' || currentUserRole === 'dm2' || currentUserRole === 'branch_admin' || currentUserRole === 'branch') {
                            const branchTitle = (uData.branchName || currentUserBranchId || 'DM2').toUpperCase();
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

                        const roleDisplayName = getRoleDisplayName(currentUserRole);
                        let nameText = uData.name;
                        if (!nameText || nameText.toLowerCase() === 'admin' || nameText.toLowerCase() === 'admin logistik' || currentUserRole === 'super_admin') {
                            nameText = roleDisplayName;
                        }

                        if (profileName) profileName.innerText = nameText;
                        if (profileRole) profileRole.innerHTML = `<span class="d-inline-block rounded-circle bg-success me-1" style="width: 7px; height: 7px;"></span>${roleDisplayName}`;

                        if (!doc.exists || !doc.data().role) {
                            currentDb.collection('users').doc(user.uid).set({
                                email: user.email,
                                name: nameText,
                                role: uRole,
                                branchId: currentUserBranchId,
                                updatedAt: firebase.firestore.Timestamp.now()
                            }, { merge: true });
                        }
                    }).catch(e => console.warn("Could not fetch user role:", e));
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
        const parsed = parseDateBoundary(startDateVal, false);
        if (parsed !== null) filterStartMs = parsed;
    }
    if (endDateVal) {
        const parsed = parseDateBoundary(endDateVal, true);
        if (parsed !== null) filterEndMs = parsed;
    }

    const archiveCourierSelect = document.getElementById('archive-courier-filter');
    if (archiveCourierSelect && archiveCourierSelect.options.length <= 1) {
        const curVal = archiveCourierSelect.value;
        let optHtml = '<option value="all">Semua Kurir & Driver</option>';
        optHtml += buildCourierOptgroupHtml('', 'displayName');
        archiveCourierSelect.innerHTML = optHtml;
        if (curVal) archiveCourierSelect.value = curVal;
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
                    const sjUrls = String(d.proofPhotoSj).split(',').map(s => s.trim()).filter(Boolean);
                    if (selectedCategory === 'all' || selectedCategory === 'sj') {
                        sjUrls.forEach((sjUrl, sIdx) => {
                            photos.push({
                                url: sjUrl,
                                category: 'sj',
                                categoryTag: sjUrls.length > 1 ? `📄 Surat Jalan #${sIdx + 1}` : '📄 Surat Jalan',
                                badgeClass: 'bg-primary',
                                shipmentId: uniqueShipmentId,
                                clientName: locName,
                                fullAddress: fullAddress,
                                courierName: cName,
                                dateStr: tripDateStr,
                                tripMs: tripMs,
                                stopIndex: stopIdx
                            });
                        });
                    }
                }

                // 2. Process Item / Barang photos
                let itemArr = [];
                if (Array.isArray(d.proofPhotoItems)) {
                    d.proofPhotoItems.forEach(item => {
                        if (typeof item === 'string') {
                            item.split(',').map(s => s.trim()).filter(Boolean).forEach(u => itemArr.push(u));
                        }
                    });
                } else if (typeof d.proofPhotoItems === 'string' && d.proofPhotoItems.trim().length > 0) {
                    itemArr = d.proofPhotoItems.split(',').map(s => s.trim()).filter(Boolean);
                }

                if (itemArr.length > 0) {
                    if (selectedCategory === 'all' || selectedCategory === 'item') {
                        itemArr.forEach((itemUrl, itemIdx) => {
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
                        <img src="${p.url}" onerror="this.onerror=null; this.src='https://placehold.co/100x100?text=Gambar+Rusak';" class="w-100 h-100 object-fit-cover cursor-pointer" onclick="openPoDModal('${p.url}')" title="Klik untuk memperbesar">
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