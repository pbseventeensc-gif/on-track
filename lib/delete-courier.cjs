// The caller and the target allowlists are server-owned, never read from editable profiles.
function createDeleteHandler({auth, db, database, admins, couriers, timestamp}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (!['POST', 'GET'].includes(req.method)) return res.status(405).json({error: 'Metode tidak diizinkan.'});
    const bearer = /^Bearer (\S+)$/.exec(req.headers.authorization || '');
    if (!bearer) return res.status(401).json({error: 'Silakan login kembali.'});
    let caller;
    try { caller = await auth.verifyIdToken(bearer[1], true); }
    catch { return res.status(401).json({error: 'Sesi login tidak valid atau sudah dicabut.'}); }
    if (!admins.includes(caller.uid)) return res.status(403).json({error: 'Hanya admin pengelola akun yang boleh menghapus akun.'});
    if (req.method === 'GET') return res.status(200).json({canDelete: true});
    const body = req.body || {};
    const courier = couriers.find(c => c.uids.includes(body.uid));
    if (!courier || courier.uids.some(uid => admins.includes(uid) || uid === caller.uid)) {
      return res.status(403).json({error: 'Akun ini tidak boleh dihapus melalui fitur kurir.'});
    }
    if (body.confirmName !== courier.name) return res.status(400).json({error: 'Nama konfirmasi tidak cocok.'});
    const markers = courier.uids.map(uid => db.collection('account_deletions').doc(uid));
    try {
      // Install markers before deleting anything. Firestore rules prevent profile resurrection.
      const begin = db.batch();
      for (const marker of markers) begin.set(marker, {status: 'pending', deletedBy: caller.uid, updatedAt: timestamp()}, {merge: true});
      await begin.commit();
      for (const uid of courier.uids) {
        try { await auth.updateUser(uid, {disabled: true}); await auth.revokeRefreshTokens(uid); }
        catch (e) { if (e.code !== 'auth/user-not-found') throw e; }
      }
      // Server-owned RTDB markers revoke even ID tokens that have not expired yet.
      await database.revokeAccess(courier.uids);
      for (const uid of courier.uids) await database.removeLocation(uid);
      const cleanup = db.batch();
      for (const uid of courier.uids) cleanup.delete(db.collection('users').doc(uid));
      // Legacy profiles may also be keyed by the canonical courier ID.
      cleanup.set(db.collection('account_deletions').doc(courier.id), {status: 'pending', deletedBy: caller.uid, updatedAt: timestamp()}, {merge: true});
      cleanup.delete(db.collection('users').doc(courier.id));
      await cleanup.commit();
      for (const uid of courier.uids) {
        try { await auth.deleteUser(uid); }
        catch (e) { if (e.code !== 'auth/user-not-found') throw e; }
      }
      const complete = db.batch();
      for (const marker of [...markers, db.collection('account_deletions').doc(courier.id)]) {
        complete.set(marker, {status: 'completed', updatedAt: timestamp()}, {merge: true});
      }
      await complete.commit();
      return res.status(200).json({deleted: true, removedUids: courier.uids, canonicalId: courier.id});
    } catch (error) {
      console.error('Courier deletion incomplete', {uid: body.uid, code: error.code || 'unknown'});
      await Promise.allSettled(markers.map(marker => marker.set({status: 'failed', updatedAt: timestamp()}, {merge: true})));
      return res.status(503).json({error: 'Penghapusan belum selesai. Akun mungkin sudah dinonaktifkan. Tekan Hapus lagi untuk melanjutkan.'});
    }
  };
}
module.exports = {createDeleteHandler};
