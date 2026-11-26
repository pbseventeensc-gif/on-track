/* A lightweight browser entry using the same courier screens and credentials. */
(function (root) {
    'use strict';
    const SCOPED_ACCOUNTS = {
        eri: {
            id: 'eri',
            name: 'Eri',
            email: 'erimotor04@gmail.com',
            uid: 'CkRWbGxehCfVOi4iMWvnm66W9NM2',
            manifest: '/manifest-eri.json',
            pref: 'wtrack_web_gps_eri',
            aliases: ['eri', 'erimotor04']
        },
        baihaqi: {
            id: 'baihaqi',
            name: 'Baihaqi',
            email: 'muhamadbayhaqi0@gmail.com',
            uid: 'xONhqVSNSYcEcGCZyW2cLGJWQt92',
            manifest: '/manifest-baihaqi.json',
            pref: 'wtrack_web_gps_baihaqi',
            aliases: ['baihaqi', 'baikaqi', 'bayhaqi', 'baykaqi', 'muhamadbayhaqi0']
        }
    };
    const pathMatch = String(root.location?.pathname || '').match(/^\/kurir-([a-z0-9_-]+?)(?:\.html)?\/?$/i);
    const queryCourier = new URLSearchParams(root.location?.search || '').get('courier')?.toLowerCase() || '';
    const scopedKey = (pathMatch && SCOPED_ACCOUNTS[pathMatch[1].toLowerCase()])
        ? pathMatch[1].toLowerCase()
        : (SCOPED_ACCOUNTS[queryCourier] ? queryCourier : '');
    const target = scopedKey ? SCOPED_ACCOUNTS[scopedKey] : null;
    const EMAIL = target?.email || '', UID = target?.uid || '';
    const scoped = Boolean(target);
    let account = null, auth = null, watch = null, wake = null, generation = 0;
    let enabled = false, last = null, lastSent = 0, km = 0, writing = false, battery = null, kmLoaded = false;
    const pref = target?.pref || 'wtrack_web_gps';
    function allows(user) {
        return !scoped || !!(user && !user.isAnonymous && user.uid === UID && String(user.email || '').toLowerCase() === EMAIL);
    }
    function status(text) { const el = root.document?.getElementById('web-gps-status'); if (el) el.textContent = text; }
    function configure() {
        if (!scoped || !target) return;
        root.document.documentElement.classList.add('courier-lite');
        root.document.querySelector('link[rel="manifest"]')?.setAttribute('href', target.manifest);
        const input = root.document.getElementById('login-input-email');
        if (input) { input.value = EMAIL; input.readOnly = true; }
        root.document.querySelectorAll('[onclick="handleGoogleLogin()"]').forEach(el => el.style.setProperty('display', 'none', 'important'));
        const title = root.document.querySelector('.login-form-title'); if (title) title.textContent = `Masuk sebagai ${target.name}`;
        root.updateLoginCourierPreview?.();
        const home = root.document.getElementById('screen-home');
        if (home && !root.document.getElementById('web-gps-panel')) {
            const panel = root.document.createElement('div'); panel.id = 'web-gps-panel';
            panel.style.cssText = 'margin:12px;padding:12px;border:1px solid #e2e8f0;border-radius:12px;background:white;font-size:12px';
            panel.innerHTML = '<div id="web-gps-status" role="status">GPS web berjalan selama halaman ini terbuka.</div><button type="button" id="web-gps-enable" class="btn btn-sm btn-outline-primary mt-2">Aktifkan GPS</button>';
            panel.querySelector('button').addEventListener('click', () => { enabled = true; try {root.localStorage.setItem(pref, 'true');} catch (_) {} startTracking(); });
            home.prepend(panel);
        }
    }
    function tripQuery(db, profile) {
        const collection = db.collection('trips');
        if (!scoped || !target) return collection;
        if (!allows(profile)) throw Error(`Halaman ini khusus akun ${target.name}.`);
        return collection.where('courierId', 'in', [...new Set([UID, UID.toLowerCase(), EMAIL, ...target.aliases])]);
    }
    function distance(a, b) {
        const rad = value => value * Math.PI / 180;
        const lat = rad(b.latitude - a.latitude), lng = rad(b.longitude - a.longitude);
        const value = Math.sin(lat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(lng / 2) ** 2;
        return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(Math.max(0, 1 - value)));
    }
    function release() { try { wake?.release(); } catch (_) {} wake = null; }
    async function keepAwake() {
        if (wake || !root.navigator?.wakeLock || root.document?.hidden) return;
        const version = generation;
        try { const acquired = await root.navigator.wakeLock.request('screen'); if (version !== generation || root.document?.hidden) acquired.release(); else wake = acquired; } catch (_) {}
    }
    function pause() { generation++; writing = false; if (watch !== null) root.navigator?.geolocation?.clearWatch(watch); watch = null; release(); }
    function stop() { pause(); account = null; auth = null; last = null; lastSent = 0; writing = false; kmLoaded = false; }
    function connect(user, courierAuth) {
        if (!scoped) return;
        if (!allows(user)) { stop(); return; }
        if (account?.uid === user.uid && auth === courierAuth) return;
        stop(); account = user; auth = courierAuth; configure();
        try { enabled = root.localStorage.getItem(pref) === 'true'; } catch (_) {}
        root.navigator?.getBattery?.().then(value => { battery = value; }).catch(() => {});
        if (enabled) startTracking();
    }
    function startTracking() {
        if (!scoped || !enabled || !allows(account) || !allows(auth?.currentUser) || watch !== null || root.document?.hidden) return;
        if (!root.navigator?.geolocation) { status('GPS belum tersedia di browser ini.'); return; }
        const version = generation;
        keepAwake(); status('Meminta lokasi GPS…');
        watch = root.navigator.geolocation.watchPosition(async position => {
            if (version !== generation || !allows(auth?.currentUser) || writing) return;
            const c = position.coords, now = Date.now();
            if (!Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) return;
            if (c.accuracy > 75) { status('Sinyal GPS belum akurat. Pindah ke area terbuka.'); return; }
            if (lastSent && now - lastSent < 20000) return;
            const meters = last ? distance(last, c) : 0;
            writing = true;
            try {
                const reference = root.firebase.database(root.courierFirebaseApp).ref('courier_live_location/' + UID);
                if (!kmLoaded) {
                    const snapshot = await reference.once('value');
                    if (version !== generation || !allows(auth?.currentUser)) return;
                    km = Number(snapshot.val()?.totalDistanceKm) || 0; kmLoaded = true;
                }
                const nextKm = km + (meters >= 15 && meters <= 2000 ? meters * 1.18 / 1000 : 0);
                await reference.update({
                    courierId: UID, lat: c.latitude, lng: c.longitude, accuracy: c.accuracy || 0,
                    batteryLevel: battery ? Math.round(battery.level * 100) : null,
                    lastUpdated: root.firebase.database.ServerValue?.TIMESTAMP || now,
                    totalDistanceKm: nextKm, source: 'courier-web'
                });
                if (version !== generation) return;
                last = {latitude:c.latitude, longitude:c.longitude}; lastSent = now; km = nextKm;
                status('GPS aktif · tetap buka halaman saat bertugas.');
            } catch (_) { if (version === generation) status('Lokasi belum terkirim. Periksa koneksi internet.'); }
            finally { if (version === generation) writing = false; }
        }, error => {
            if (version !== generation) return;
            status(error.code === 1 ? 'Izin lokasi belum diberikan. Ketuk Aktifkan GPS untuk mencoba lagi.' : 'Lokasi belum terbaca. Periksa GPS dan koneksi.');
            if (error.code === 1) pause();
        }, {enableHighAccuracy:true, maximumAge:15000, timeout:20000});
    }
    root.CourierWeb = {scoped, account: target, allows, configure, tripQuery, connect, stop, startTracking};
    root.document?.addEventListener('DOMContentLoaded', configure);
    root.document?.addEventListener('visibilitychange', () => { if (root.document.hidden) pause(); else if (enabled) startTracking(); });
    root.addEventListener?.('pagehide', pause);
    root.addEventListener?.('pageshow', () => { if (enabled) startTracking(); });
})(typeof window !== 'undefined' ? window : globalThis);
