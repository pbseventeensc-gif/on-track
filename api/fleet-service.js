const {initializeApp, getApps, cert} = require('firebase-admin/app');
const {getAuth} = require('firebase-admin/auth');
const {getFirestore} = require('firebase-admin/firestore');
const {createFleetServiceHandler} = require('../lib/fleet-service.cjs');
const config = require('../config/fleet-service.json');

module.exports = async function handler(req, res) {
    // The packaged Android fallback has a file:// origin; all data still requires a verified ID token.
    const origin = req.headers.origin;
    if (origin === 'null' || origin === 'https://on-track-indol.vercel.app') {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return res.status(503).json({error: 'Server pengajuan servis belum dikonfigurasi.'});
    try {
        const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        if (credentials.project_id !== 'ontrack-fccb8') throw new Error('Wrong project');
        const app = getApps().find(a => a.name === 'fleet-service') || initializeApp({credential: cert(credentials)}, 'fleet-service');
        const adminUids = (process.env.FIREBASE_SERVICE_ADMIN_UIDS || '').split(',').map(v => v.trim()).filter(Boolean);
        return await createFleetServiceHandler({auth: getAuth(app), db: getFirestore(app), adminUids, config})(req, res);
    } catch (error) {
        console.error('Fleet service initialization failed', {code: error.code || 'unknown'});
        return res.status(503).json({error: 'Server pengajuan servis belum tersedia.'});
    }
};
