const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function extractBlock(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    assert.ok(start >= 0 && end > start, `Missing block: ${startMarker}`);
    return source.slice(start, end);
}

test('resolveCourierProfile preserves Firebase authUid so loadSavedSession succeeds when auth UID differs from defaultUid', () => {
    const source = fs.readFileSync('kurir.html', 'utf8');
    const storage = new Map();
    const auth = {currentUser: {uid: 'migrated-firebase-uid-999', email: 'ahmadmotor03@gmail.com', isAnonymous: false}};
    const firebase = {apps: [{name: 'wtrack-courier'}], app: () => ({name: 'wtrack-courier'}), auth: () => auth};
    const c = vm.createContext({
        firebase,
        currentCourier: null,
        window: {},
        localStorage: {
            getItem: k => storage.get(k) ?? null,
            setItem: (k, v) => storage.set(k, String(v))
        },
        resolveOfficialAvatar: p => p?.avatar || ''
    });
    for (const [s, e] of [
        ['    const MASTER_COURIERS_LIST = [', '    const COMPANY_FLEET_VEHICLES'],
        ['    function resolveCourierProfile(', '    function getNormalizedAvatarUrl('],
        ['    function loadSavedSession(', '    function completeCourierLogin(']
    ]) {
        vm.runInContext(extractBlock(source, s, e), c);
    }

    const profile = c.resolveCourierProfile('ahmadmotor03@gmail.com', 'migrated-firebase-uid-999');
    assert.equal(profile.canonicalId, 'ahmad');
    assert.equal(profile.uid, '9dhFtf5QTQW8zmb8cZW5YFgZfmH3');
    assert.equal(profile.authUid, 'migrated-firebase-uid-999');

    storage.set('wtrack_saved_courier', JSON.stringify(profile));
    assert.equal(c.loadSavedSession(), true);
});

test('kurir.html waits for Firebase auth restoration instead of immediately navigating to login when a saved courier hint exists', () => {
    const source = fs.readFileSync('kurir.html', 'utf8');
    assert.match(source, /function hasSavedCourierHint\(/);
    assert.match(source, /courierAuthResolved/);
    assert.match(source, /__wtrackAuthRestoring/);
});

test('courier_updates.js defers reload while auth session is still restoring', async () => {
    const events = new Map();
    let reloads = 0;
    const window = {
        __wtrackAuthRestoring: true,
        location: {protocol: 'https:', reload() { reloads++; }},
        navigator: {onLine: true},
        document: {
            hidden: false,
            currentScript: {dataset: {build: 'old'}},
            activeElement: null,
            querySelector: selector => selector === '.app-screen.active' ? {id: 'screen-home'} : null,
            addEventListener: (name, fn) => events.set(name, fn)
        },
        sessionStorage: {getItem: () => null, setItem() {}},
        addEventListener: (name, fn) => events.set(name, fn),
        setInterval() {},
        async fetch() { return {ok: true, json: async () => ({courier: 'new'})}; }
    };
    vm.runInNewContext(fs.readFileSync('js/courier_updates.js', 'utf8'), {window});
    await events.get('pageshow')();
    assert.equal(reloads, 0);
});

test('vercel.json allows WebView revalidated caching for kurir.html while keeping app-version.json no-store', () => {
    const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
    const bySource = new Map(config.headers.map(h => [h.source, h.headers.find(x => x.key === 'Cache-Control')?.value]));
    for (const route of ['/kurir.html', '/kurir', '/kurir-eri']) {
        assert.match(bySource.get(route) || '', /must-revalidate/);
        assert.doesNotMatch(bySource.get(route) || '', /no-store/);
    }
    assert.match(bySource.get('/assets/app-version.json') || '', /no-store/);
});

test('kurir.html uses relative js/ paths for courier scripts so offline fallback does not 404', () => {
    const source = fs.readFileSync('kurir.html', 'utf8');
    assert.doesNotMatch(source, /<script src="\/js\/(browser_session|courier_web|courier_route|courier_updates)\.js/);
});
