/* Keep Firebase's authenticated session across reloads without trusting profile caches. */
(function (root) {
    'use strict';
    const prepared = new WeakMap();
    function prepare(auth) {
        if (!auth) return Promise.resolve(false);
        if (!prepared.has(auth)) {
            prepared.set(auth, Promise.resolve().then(() => auth.setPersistence ? auth.setPersistence('local') : undefined)
                .then(() => true).catch(error => {
                    root.console?.warn('Login tetap aktif, tetapi penyimpanan sesi browser belum tersedia:', error.code || error.message);
                    return false;
                }));
        }
        return prepared.get(auth);
    }
    root.BrowserSession = {prepare};
    if (typeof module !== 'undefined' && module.exports) module.exports = root.BrowserSession;
})(typeof window !== 'undefined' ? window : globalThis);
