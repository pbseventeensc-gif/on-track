// Administrative cleanup for the explicitly retired Rizki account only.
// Credentials are supplied by `vercel env run -e production`; never written here.
const {initializeApp, cert} = require('firebase-admin/app');
const {getAuth} = require('firebase-admin/auth');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const fs = require('node:fs');
const path = require('node:path');
const courier = require('../config/courier-accounts.json').find(c => c.id === 'rizki');
const databaseURL = 'https://ontrack-fccb8-default-rtdb.asia-southeast1.firebasedatabase.app';

async function main() {
    const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');
    if (credentials.project_id !== 'ontrack-fccb8') throw new Error('Expected production Firebase credentials');
    const admins = (process.env.FIREBASE_ACCOUNT_ADMIN_UIDS || '').split(',').map(s => s.trim());
    const ids = [...courier.uids, courier.id];
    if (ids.some(id => admins.includes(id))) throw new Error('Refusing to delete an admin');
    const app = initializeApp({credential: cert(credentials), databaseURL});
    const auth = getAuth(app), db = getFirestore(app);
    const accounts = [];
    for (const uid of courier.uids) {
        try {
            const user = await auth.getUser(uid);
            if (user.email !== 'rizkidriver07@gmail.com') throw new Error('Unexpected target account email');
            accounts.push({uid, email: user.email, displayName: user.displayName || '', disabled: user.disabled});
        } catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
    }
    try {
        const byEmail = await auth.getUserByEmail('rizkidriver07@gmail.com');
        if (!courier.uids.includes(byEmail.uid)) throw new Error('Email belongs to an unexpected UID');
    } catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
    const userDocs = await db.collection('users').get();
    const profiles = userDocs.docs.filter(doc => ids.includes(doc.id) ||
        ids.includes(doc.data().userId) || doc.data().courierId === courier.id ||
        doc.data().email?.toLowerCase() === 'rizkidriver07@gmail.com');
    if (profiles.some(doc => admins.includes(doc.id))) throw new Error('A target profile is an admin');
    const trips = await db.collection('trips').where('courierId', 'in', ids).get();
    const unfinishedTrips = trips.docs.filter(doc => !['completed','done','delivered'].includes(doc.data().status));
    console.log(JSON.stringify({mode: process.argv[2] || 'inspect', canonicalId: courier.id,
        accounts, profileCount: profiles.length, preservedTrips: trips.size, unfinishedTrips: unfinishedTrips.length}));
    if (process.argv[2] === '--verify-rizki') {
        const markers = await db.getAll(...ids.map(id => db.collection('account_deletions').doc(id)));
        if (markers.some(doc => !doc.exists || doc.data().status !== 'completed')) throw new Error('Deletion marker is incomplete');
        const {access_token} = await app.options.credential.getAccessToken();
        for (const id of ids) {
            for (const [location, expected] of [[`_deleted_accounts/${id}`, true], [`courier_live_location/${id}`, null]]) {
                const response = await fetch(`${databaseURL}/${location}.json`, {headers: {Authorization: `Bearer ${access_token}`}});
                if (!response.ok || await response.json() !== expected) throw new Error('RTDB cleanup verification failed');
            }
        }
        if (accounts.length || profiles.length) throw new Error('An account or profile still exists');
        console.log(JSON.stringify({verified: true, authenticationAbsent: true, profilesAbsent: true,
            deletionMarkersCompleted: true, locationsAbsent: true, rtdbAccessRevoked: true, preservedTrips: trips.size}));
        return;
    }
    if (process.argv[2] !== '--delete-rizki') return;

    const allIds = [...new Set([...ids, ...profiles.map(doc => doc.id)])];
    const {access_token} = await app.options.credential.getAccessToken();
    async function rtdb(location, method = 'GET', data) {
        const response = await fetch(`${databaseURL}/${location}.json`, {method,
            headers: {Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json'},
            ...(data === undefined ? {} : {body: JSON.stringify(data)})});
        if (!response.ok) throw new Error(`RTDB ${method} failed: ${response.status}`);
        return response.json();
    }
    const backupDir = path.join(process.cwd(), '.artifacts', 'firebase-security-2026-11-14');
    fs.mkdirSync(backupDir, {recursive: true, mode: 0o700});
    const locations = {};
    for (const id of allIds) locations[id] = await rtdb(`courier_live_location/${encodeURIComponent(id)}`);
    const backupFile = path.join(backupDir, 'rizki-before.json');
    // Preserve the first backup when an interrupted cleanup is resumed.
    if (!fs.existsSync(backupFile)) fs.writeFileSync(backupFile, JSON.stringify({accounts,
        profiles: profiles.map(doc => ({id: doc.id, data: doc.data()})), locations}, null, 2), {mode: 0o600});

    const marker = status => ({status, deletedBy: 'operator:user-request', updatedAt: FieldValue.serverTimestamp()});
    const begin = db.batch();
    allIds.forEach(id => begin.set(db.collection('account_deletions').doc(id), marker('pending'), {merge: true}));
    await begin.commit();
    for (const uid of courier.uids) {
        try { await auth.updateUser(uid, {disabled: true}); await auth.revokeRefreshTokens(uid); }
        catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
    }
    await rtdb('_deleted_accounts', 'PATCH', Object.fromEntries(allIds.map(id => [id, true])));
    for (const id of allIds) await rtdb(`courier_live_location/${encodeURIComponent(id)}`, 'DELETE');
    const cleanup = db.batch();
    allIds.forEach(id => cleanup.delete(db.collection('users').doc(id)));
    await cleanup.commit();
    for (const uid of courier.uids) {
        try { await auth.deleteUser(uid); }
        catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
    }
    const complete = db.batch();
    allIds.forEach(id => complete.set(db.collection('account_deletions').doc(id), marker('completed'), {merge: true}));
    await complete.commit();
    for (const uid of courier.uids) {
        try { await auth.getUser(uid); throw new Error('Authentication account still exists'); }
        catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
    }
    const remaining = await db.getAll(...allIds.map(id => db.collection('users').doc(id)));
    if (remaining.some(doc => doc.exists)) throw new Error('A profile still exists');
    console.log(JSON.stringify({deleted: true, canonicalId: courier.id, removedAuthUids: courier.uids,
        removedProfiles: allIds, tripsPreserved: trips.size}));
}
main().then(() => process.exit(0)).catch(error => {
    console.error('Rizki cleanup failed', {code: error.code || 'unknown', message: error.message});
    process.exit(1);
});
