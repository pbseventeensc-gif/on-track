const {initializeApp, getApps, cert} = require('firebase-admin/app');
const {getAuth} = require('firebase-admin/auth');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {createDeleteHandler} = require('../lib/delete-courier.cjs');
const couriers = require('../config/courier-accounts.json');
const databaseURL = 'https://ontrack-fccb8-default-rtdb.asia-southeast1.firebasedatabase.app';

module.exports = async function handler(req, res) {
  const admins = (process.env.FIREBASE_ACCOUNT_ADMIN_UIDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON || !admins.length) {
    return res.status(503).json({error: 'Fitur hapus akun belum dikonfigurasi oleh pengelola server.'});
  }
  try {
    const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (credentials.project_id !== 'ontrack-fccb8') throw new Error('Wrong Firebase project');
    const app = getApps()[0] || initializeApp({credential: cert(credentials), databaseURL});
    async function databaseRequest(location, options = {}) {
      const {access_token} = await app.options.credential.getAccessToken();
      const response = await fetch(`${databaseURL}/${location}.json`, {
        ...options, headers: {...options.headers, Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json'}
      });
      if (!response.ok) throw new Error(`Database request failed: ${response.status}`);
      return response;
    }
    const database = {
      async revokeAccess(uids) {
        const updates = Object.fromEntries(uids.map(uid => [uid, true]));
        await databaseRequest('_deleted_accounts', {method: 'PATCH', body: JSON.stringify(updates)});
      },
      async removeLocation(uid) { await databaseRequest(`courier_live_location/${encodeURIComponent(uid)}`, {method: 'DELETE'}); }
    };
    return createDeleteHandler({auth: getAuth(app), db: getFirestore(app), database, admins, couriers, timestamp: () => FieldValue.serverTimestamp()})(req, res);
  } catch (error) {
    console.error('Account deletion configuration failed', {code: error.code || 'unknown'});
    return res.status(503).json({error: 'Layanan penghapusan akun belum tersedia. Hubungi pengelola.'});
  }
};
