// Requires the Firestore emulator on 18080 with firestore.rules loaded.
const assert = require('node:assert/strict');
(async () => {
    const base = 'http://127.0.0.1:18080/v1/projects/demo-wtrack-delete/databases/(default)/documents';
    const payload = {fields: {status: {stringValue: 'approved'}}};
    let checks = 0;
    for (const collection of ['fleet_service_requests', 'fleet_service_photos', 'fleet_service_config']) {
        const path = `${base}/${collection}/protected-test-document`;
        const seed = await fetch(path, {method:'PATCH', headers:{Authorization:'Bearer owner','Content-Type':'application/json'}, body:JSON.stringify(payload)});
        assert.equal(seed.status, 200);
        for (const target of [path, path + '/nested/test']) {
            for (const method of ['GET', 'PATCH', 'DELETE']) {
                const response = await fetch(target, {method, headers:{'Content-Type':'application/json'},
                    ...(method === 'PATCH' ? {body:JSON.stringify(payload)} : {})});
                assert.equal(response.status, 403, `${collection}: ${method} must pass through the authenticated API`);
                checks++;
            }
        }
    }
    console.log(`Passed ${checks} fleet service rules checks.`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
