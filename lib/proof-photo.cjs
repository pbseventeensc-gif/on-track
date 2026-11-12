function createProofPhotoHandler(getPhoto) {
    return async function handler(req, res) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (!['GET', 'HEAD'].includes(req.method)) return res.status(405).json({error:'Method not allowed'});
        const id = req.query?.id;
        if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(id)) return res.status(400).json({error:'Invalid photo ID'});
        try {
            const photo = await getPhoto(id);
            if (!photo) return res.status(404).json({error:'Photo not found'});
            const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(photo.dataUrl || '');
            if (!match || photo.dataUrl.length > 900000) return res.status(422).json({error:'Invalid photo data'});
            const buffer = Buffer.from(match[2], 'base64');
            res.setHeader('Content-Type', match[1]);
            res.setHeader('Content-Length', buffer.length);
            res.setHeader('Cache-Control', 'private, max-age=3600');
            return res.status(200).end(req.method === 'HEAD' ? undefined : buffer);
        } catch (error) {
            console.error('Proof photo read failed', {code:error.code || 'unknown'});
            return res.status(503).json({error:'Photo temporarily unavailable'});
        }
    };
}
module.exports = {createProofPhotoHandler};
