const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

for (const file of ['kurir.html', 'public/kurir.html', 'app/src/main/assets/kurir.html']) {
    function setup() {
        const source = fs.readFileSync(file, 'utf8');
        const fields = new Map(), storage = new Map();
        const logins = [], signIns = [], toasts = [];
        const node = id => {
            if (!fields.has(id)) {
                const classes = new Set(['d-none']);
                fields.set(id, {value: '', checked: true, disabled: false,
                    classList: {add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value)},
                    focused: false, focus() {this.focused = true;}});
            }
            return fields.get(id);
        };
        const auth = {currentUser: null, async signInWithEmailAndPassword(email, pass) {
            signIns.push({email, pass});
            if (auth.failure) throw {code: auth.failure};
            return {user: {uid: 'uP70R51x7CbR5ggHEyeXfsjSTfO2', email}};
        }, async signInWithPopup() {throw {code: 'auth/popup-closed-by-user'};}};
        const firebase = {auth: () => auth};
        firebase.auth.GoogleAuthProvider = class {};
        const c = vm.createContext({firebase, currentCourier: {},
            document: {getElementById: node}, localStorage: {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value)},
            showToast: message => toasts.push(message), completeCourierLogin: (profile, keep) => logins.push({profile, keep}),
            resolveOfficialAvatar: () => '/avatar.jpg', getNormalizedAvatarUrl: value => value
        });
        for (const [startMarker, endMarker] of [
            ['    const MASTER_COURIERS_LIST = [', '    const COMPANY_FLEET_VEHICLES'],
            ['    function resolveCourierProfile(', '    function getNormalizedAvatarUrl('],
            ['    function findLoginCourierMatch(', '    // State Kurir Aktif'],
            ['    async function handleLoginSubmit(', '    function handleLogout('],
            ['    function loadSavedSession(', '    function completeCourierLogin(']
        ]) {
            const start = source.indexOf(startMarker);
            const end = source.indexOf(endMarker, start);
            assert.ok(start >= 0 && end > start, startMarker);
            vm.runInContext(source.slice(start, end), c);
        }
        return {c, node, auth, logins, signIns, toasts, storage, source};
    }

    test(`${file}: clicking the matching account completes email and focuses an empty password without signing in`, () => {
        const s = setup();
        s.node('login-input-email').value = 'pb';
        s.node('login-input-pass').value = 'previous-password';
        s.c.updateLoginCourierPreview();
        assert.equal(s.node('login-courier-preview').classList.contains('d-none'), false);
        assert.equal(s.node('login-preview-name').innerText, 'pbseventeensc');
        s.c.selectLoginCourierPreview();
        assert.equal(s.node('login-input-email').value, 'pbseventeensc@gmail.com');
        assert.equal(s.node('login-input-pass').value, '');
        assert.equal(s.node('login-input-pass').focused, true);
        assert.equal(s.logins.length, 0);
        assert.equal(s.signIns.length, 0);
        assert.match(s.source, /<button type="button" id="login-courier-preview"/);
    });

    test(`${file}: short, unknown, ambiguous and retired names never select a wrong account`, () => {
        const s = setup();
        for (const value of ['p', 'unknown-account', 'ja', 'rizki']) {
            s.node('login-input-email').value = value;
            s.c.updateLoginCourierPreview();
            s.c.selectLoginCourierPreview();
            assert.equal(s.node('login-courier-preview').classList.contains('d-none'), true, value);
            assert.equal(s.node('login-input-email').value, value);
        }
        assert.equal(s.c.findLoginCourierMatch(' PBSEVENTEENSC ').canonicalId, 'pbseventeensc');
    });

    test(`${file}: an empty password cannot submit or enter the app`, async () => {
        const s = setup();
        s.node('login-input-email').value = 'pbseventeensc@gmail.com';
        await s.c.handleLoginSubmit();
        assert.equal(s.signIns.length, 0);
        assert.equal(s.logins.length, 0);
        assert.match(s.toasts.at(-1), /Password wajib/);
    });

    test(`${file}: invalid passwords and network failure never become successful logins`, async () => {
        const s = setup();
        s.node('login-input-email').value = 'pbseventeensc@gmail.com';
        s.node('login-input-pass').value = 'wrong-password';
        for (const failure of ['auth/invalid-credential', 'auth/user-disabled', 'auth/network-request-failed']) {
            s.auth.failure = failure;
            await s.c.handleLoginSubmit();
            assert.equal(s.logins.length, 0);
            assert.equal(s.node('login-submit-button').disabled, false);
        }
        s.c.firebase = undefined;
        await s.c.handleLoginSubmit();
        assert.equal(s.logins.length, 0);
        assert.equal(s.signIns.length, 3);
    });

    test(`${file}: only verified credentials complete login and password characters are preserved`, async () => {
        const s = setup();
        s.node('login-input-email').value = 'pbseventeensc@gmail.com';
        s.node('login-input-pass').value = ' correct-password ';
        s.node('keep-signed-in').checked = false;
        await s.c.handleLoginSubmit();
        assert.equal(s.signIns[0].pass, ' correct-password ');
        assert.equal(s.logins.length, 1);
        assert.equal(s.logins[0].profile.uid, 'uP70R51x7CbR5ggHEyeXfsjSTfO2');
        assert.equal(s.logins[0].keep, false);
    });

    test(`${file}: a cached profile or cancelled Google login cannot bypass authentication`, async () => {
        const s = setup();
        s.storage.set('wtrack_saved_courier', JSON.stringify({uid: 'saved-uid', name: 'Saved User'}));
        assert.equal(s.c.loadSavedSession(), false);
        s.auth.currentUser = {uid: 'saved-uid', isAnonymous: true};
        assert.equal(s.c.loadSavedSession(), false);
        s.auth.currentUser = {uid: 'different-uid'};
        assert.equal(s.c.loadSavedSession(), false);
        s.c.handleGoogleLogin();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(s.logins.length, 0);
    });
}
