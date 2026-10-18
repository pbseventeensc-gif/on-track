/**
 * WTrack - Apply Google Drive 5TB URLs to Firestore Trips
 * 
 * Membaca photo_migration_map.json hasil migrasi, lalu memperbarui
 * URL Cloudinary/Firebase lama di Firestore menjadi URL Google Drive 5TB yang baru.
 */

const fs = require('fs');
const path = require('path');

const MAP_FILE = path.join(__dirname, 'photo_migration_map.json');

async function fetchAllTrips() {
    let pageToken = '';
    const allTrips = [];
    do {
        const url = 'https://firestore.googleapis.com/v1/projects/ontrack-fccb8/databases/(default)/documents/trips?pageSize=100' + (pageToken ? '&pageToken=' + pageToken : '');
        const res = await fetch(url);
        const data = await res.json();
        if (data.documents) {
            allTrips.push(...data.documents);
        }
        pageToken = data.nextPageToken || '';
    } while (pageToken);
    return allTrips;
}

async function updateTripDoc(docName, updateMaskFields, docFields) {
    const maskParams = updateMaskFields.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
    const url = `https://firestore.googleapis.com/v1/${docName}?${maskParams}`;
    
    const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: docFields })
    });
    return res.ok;
}

async function main() {
    if (!fs.existsSync(MAP_FILE)) {
        console.error('File photo_migration_map.json belum ditemukan. Jalankan migrate_photos_to_gdrive.js terlebih dahulu.');
        return;
    }

    const migrationMap = JSON.parse(fs.readFileSync(MAP_FILE, 'utf-8'));
    const totalMapped = Object.keys(migrationMap).length;
    console.log(`Ditemukan ${totalMapped} foto yang sudah dimigrasi ke Google Drive.`);

    if (totalMapped === 0) {
        console.log('Belum ada foto yang berhasil dimigrasi.');
        return;
    }

    console.log('Mengambil data trips dari Firestore...');
    const trips = await fetchAllTrips();
    console.log(`Menganalisis ${trips.length} trips...`);

    let updatedTripsCount = 0;
    let updatedPhotosCount = 0;

    for (const doc of trips) {
        const fields = doc.fields || {};
        let modified = false;
        const maskFields = [];

        // 1. Bulk SJ Admin
        if (fields.adminBulkSjUrl?.stringValue) {
            const oldUrl = fields.adminBulkSjUrl.stringValue;
            if (migrationMap[oldUrl]) {
                fields.adminBulkSjUrl.stringValue = migrationMap[oldUrl];
                maskFields.push('adminBulkSjUrl');
                modified = true;
                updatedPhotosCount++;
            }
        }

        // 2. Destinations
        if (fields.destinations?.arrayValue?.values) {
            fields.destinations.arrayValue.values.forEach(dVal => {
                const d = dVal.mapValue?.fields;
                if (!d) return;

                ['proofPhotoSj', 'proofPhotoUrl', 'proofUrl', 'pendingProofPhotoUrl'].forEach(key => {
                    if (d[key]?.stringValue) {
                        const oldUrl = d[key].stringValue;
                        if (migrationMap[oldUrl]) {
                            d[key].stringValue = migrationMap[oldUrl];
                            modified = true;
                            updatedPhotosCount++;
                        }
                    }
                });

                if (d.proofPhotoItems?.arrayValue?.values) {
                    d.proofPhotoItems.arrayValue.values.forEach(item => {
                        if (item.stringValue && migrationMap[item.stringValue]) {
                            item.stringValue = migrationMap[item.stringValue];
                            modified = true;
                            updatedPhotosCount++;
                        }
                    });
                }
            });

            if (modified && !maskFields.includes('destinations')) {
                maskFields.push('destinations');
            }
        }

        if (modified) {
            const ok = await updateTripDoc(doc.name, maskFields, fields);
            if (ok) {
                updatedTripsCount++;
                const tripId = doc.name.split('/').pop();
                console.log(`[Trip Updated] ${tripId} berhasil diperbarui dengan URL Google Drive.`);
            }
        }
    }

    console.log('\n=== Sinkronisasi Firestore Selesai ===');
    console.log(`Total Trips Diperbarui: ${updatedTripsCount}`);
    console.log(`Total Foto Diperbarui ke Google Drive: ${updatedPhotosCount}`);
}

if (require.main === module) {
    main();
}

module.exports = { main };
