// The courier update banner must only reload when courier-facing assets change.
// Hashing every file under js/ made each admin deployment reload every courier
// page (and briefly clear its task list).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const COURIER_ASSETS = [
    'kurir.html',
    'js/sj_links.js',
    'js/browser_session.js',
    'js/courier_web.js',
    'js/delivery_identity.js',
    'js/maps_destination.js',
    'js/courier_admin.js',
    'js/qr_claim.js',
    'js/fleet_service.js',
    'js/courier_route.js',
    'js/courier_updates.js'
];

function buildCourier(rootDirectory) {
    const htmlPath = path.join(rootDirectory, 'kurir.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    const digest = crypto.createHash('sha256');
    for (const relativePath of COURIER_ASSETS) {
        if (relativePath === 'kurir.html') {
            // Ignore the build stamp itself so repeated syncs stay stable.
            digest.update(relativePath).update(html.replace(/data-build="[^"]*"/g, 'data-build="BUILD"'));
        } else {
            digest.update(relativePath).update(fs.readFileSync(path.join(rootDirectory, relativePath)));
        }
    }
    return digest.digest('hex').slice(0, 16);
}

module.exports = {COURIER_ASSETS, buildCourier};
