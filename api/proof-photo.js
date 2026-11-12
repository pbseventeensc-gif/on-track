const {initializeApp, getApps, cert} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const {createProofPhotoHandler} = require('../lib/proof-photo.cjs');

module.exports = async function handler(req, res) {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return res.status(503).json({error:'Photo service not configured'});
    try {
        const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        if (credentials.project_id !== 'ontrack-fccb8') throw new Error('Wrong project');
        const app = getApps().find(app => app.name === 'proof-photo') || initializeApp({credential:cert(credentials)},'proof-photo');
        return await createProofPhotoHandler(async id => {
            const doc = await getFirestore(app).collection('delivery_proofs').doc(id).get();
            return doc.exists ? doc.data() : null;
        })(req,res);
    } catch (error) {
        console.error('Proof photo service unavailable', {code:error.code || 'unknown'});
        return res.status(503).json({error:'Photo service unavailable'});
    }
};
