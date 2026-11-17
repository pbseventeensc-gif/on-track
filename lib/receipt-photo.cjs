// Canvas-safe access to existing public, token-bearing Wtrack proof images only.
function proofUrl(value) {
    if (typeof value !== 'string' || value.length > 2048) return null;
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.hostname !== 'firebasestorage.googleapis.com' || url.port || url.username || url.password || url.hash) return null;
        const match = /^\/v0\/b\/(ontrack-fccb8\.firebasestorage\.app|ontrack-fccb8\.appspot\.com)\/o\/([^/]+)$/.exec(url.pathname);
        if (!match || !/^(proofs_sj|proofs_item|proofs)\//.test(decodeURIComponent(match[2]))) return null;
        if (url.searchParams.get('alt') !== 'media' || !/^[a-zA-Z0-9_-]{16,200}$/.test(url.searchParams.get('token') || '')) return null;
        if ([...url.searchParams.keys()].some(key => !['alt','token'].includes(key))) return null;
        return url.href;
    } catch { return null; }
}
function createReceiptPhotoHandler(fetchPhoto = fetch) {
    return async (req, res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (!['GET','HEAD'].includes(req.method)) return res.status(405).json({error:'Method not allowed'});
        const url = proofUrl(req.query?.source);
        if (!url) return res.status(400).json({error:'Invalid proof photo'});
        try {
            const response = await fetchPhoto(url, {redirect:'error',signal:AbortSignal.timeout(10000)});
            const type = (response.headers.get('content-type') || '').split(';')[0];
            if (!response.ok) return res.status(502).json({error:'Proof photo could not be loaded'});
            if (!['image/jpeg','image/png','image/webp'].includes(type)) return res.status(422).json({error:'Unsupported photo format'});
            const limit = 10 * 1024 * 1024;
            if (Number(response.headers.get('content-length')) > limit) return res.status(413).json({error:'Photo too large'});
            const reader = response.body.getReader(), parts = [];
            let size = 0;
            while (true) {
                const {done,value} = await reader.read();
                if (done) break;
                size += value.length;
                if (size > limit) { await reader.cancel(); return res.status(413).json({error:'Photo too large'}); }
                parts.push(Buffer.from(value));
            }
            res.setHeader('Content-Type',type);
            res.setHeader('Content-Length',size);
            res.setHeader('Cache-Control','private, max-age=3600');
            return res.status(200).end(req.method === 'HEAD' ? undefined : Buffer.concat(parts));
        } catch {
            return res.status(502).json({error:'Proof photo temporarily unavailable'});
        }
    };
}
module.exports = {proofUrl, createReceiptPhotoHandler};
