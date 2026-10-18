/**
 * WTrack - Automated Photo Migration to Google Drive 5TB
 * 
 * Migrates all historical photos from Cloudinary/Firebase into Google Drive
 * organized neatly by Year-Month and Date:
 *   KurirTrack_Uploads / YYYY-MM / DD-MM-YYYY / [Nama_Foto].jpg
 */

const fs = require('fs');
const path = require('path');

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwvx6J8im78IZ9hpMHSgDCrNp6UblxDs49uFyu-AokUSdfwT3tVWiJfGHh0nafTupw_/exec';
const MAP_FILE = path.join(__dirname, 'photo_migration_map.json');

let migrationMap = {};
if (fs.existsSync(MAP_FILE)) {
    try {
        migrationMap = JSON.parse(fs.readFileSync(MAP_FILE, 'utf-8'));
    } catch (e) {
        migrationMap = {};
    }
}

function saveMap() {
    fs.writeFileSync(MAP_FILE, JSON.stringify(migrationMap, null, 2), 'utf-8');
}

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

function extractPhotosFromTrips(trips) {
    const queue = [];
    const seenUrls = new Set();

    trips.forEach(doc => {
        const fields = doc.fields || {};
        const tripId = doc.name.split('/').pop();
        const tripShort = '#' + tripId.substring(Math.max(0, tripId.length - 6));
        
        let d = null;
        if (fields.date?.timestampValue) {
            d = new Date(fields.date.timestampValue);
        } else if (fields.date?.mapValue?.fields?.seconds?.integerValue) {
            d = new Date(parseInt(fields.date.mapValue.fields.seconds.integerValue) * 1000);
        } else if (fields.date?.stringValue) {
            d = new Date(fields.date.stringValue);
        } else if (tripId.startsWith('TRIP_')) {
            const num = parseInt(tripId.replace('TRIP_', ''));
            if (!isNaN(num)) d = new Date(num);
        }

        let dateStr = '18-10-2026';
        let monthStr = '2026-10';

        if (d && !isNaN(d.getTime())) {
            const parts = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
            const day = parts.find(p => p.type === 'day')?.value || '01';
            const month = parts.find(p => p.type === 'month')?.value || '10';
            const year = parts.find(p => p.type === 'year')?.value || '2026';
            dateStr = `${day}-${month}-${year}`;
            monthStr = `${year}-${month}`;
        }

        const addPhoto = (url, type, stopIndex = 0, locName = '') => {
            if (!url || typeof url !== 'string') return;
            url.split(',').forEach((u, i) => {
                const clean = u.trim();
                if (!clean.startsWith('http') || clean.includes('drive.google.com') || seenUrls.has(clean)) return;
                seenUrls.add(clean);

                const cleanLoc = (locName || 'Tujuan').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
                const ext = clean.includes('.png') ? 'png' : 'jpg';
                const filename = `${type}_${tripShort.replace('#', '')}_stop${stopIndex}_${cleanLoc}_${i + 1}.${ext}`;

                queue.push({
                    tripId,
                    stopIndex,
                    type,
                    sourceUrl: clean,
                    folderDate: dateStr,
                    monthFolder: monthStr,
                    filename: filename
                });
            });
        };

        if (fields.adminBulkSjUrl) {
            const u = fields.adminBulkSjUrl.stringValue || '';
            addPhoto(u, 'BulkSJ', 0, 'Admin');
        }

        if (fields.destinations?.arrayValue?.values) {
            fields.destinations.arrayValue.values.forEach((dVal, idx) => {
                const d = dVal.mapValue?.fields || {};
                const stopIdx = d.stopIndex?.integerValue || (idx + 1);
                const locName = d.locationName?.stringValue || '';

                if (d.proofPhotoSj) addPhoto(d.proofPhotoSj.stringValue, 'SJ', stopIdx, locName);
                if (d.proofPhotoUrl) addPhoto(d.proofPhotoUrl.stringValue, 'PoD', stopIdx, locName);
                if (d.proofUrl) addPhoto(d.proofUrl.stringValue, 'PoD', stopIdx, locName);
                if (d.pendingProofPhotoUrl) addPhoto(d.pendingProofPhotoUrl.stringValue, 'PendingTutup', stopIdx, locName);

                if (d.proofPhotoItems?.arrayValue?.values) {
                    d.proofPhotoItems.arrayValue.values.forEach(item => {
                        addPhoto(item.stringValue, 'Barang', stopIdx, locName);
                    });
                } else if (d.proofPhotoItems?.stringValue) {
                    addPhoto(d.proofPhotoItems.stringValue, 'Barang', stopIdx, locName);
                }
            });
        }
    });

    return queue;
}

async function uploadToGoogleDriveScript(item) {
    if (migrationMap[item.sourceUrl]) {
        return { status: 'already_migrated', url: migrationMap[item.sourceUrl] };
    }

    try {
        const payload = {
            imageUrl: item.sourceUrl,
            filename: item.filename,
            folderDate: item.folderDate,
            monthFolder: item.monthFolder
        };

        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload),
            redirect: 'follow'
        });

        const data = await res.json();
        if (data && data.status === 'success' && data.url) {
            migrationMap[item.sourceUrl] = data.url;
            saveMap();
            return { status: 'success', url: data.url };
        } else {
            return { status: 'error', error: data.message || 'Script error' };
        }
    } catch (err) {
        return { status: 'error', error: err.message };
    }
}

async function main() {
    console.log('=== Memulai Scan Foto WTrack ===');
    const trips = await fetchAllTrips();
    console.log(`Berhasil mengambil ${trips.length} data trips.`);

    const queue = extractPhotosFromTrips(trips);
    console.log(`Total foto yang siap dipindahkan: ${queue.length} file.`);
    console.log(`Foto yang sudah pernah dipindahkan sebelumnya: ${Object.keys(migrationMap).length} file.`);

    const remaining = queue.filter(item => !migrationMap[item.sourceUrl]);
    console.log(`Sisa yang perlu dipindahkan sekarang: ${remaining.length} file.`);

    if (remaining.length === 0) {
        console.log('Semua foto sudah 100% tersimpan di Google Drive!');
        return;
    }

    // Process in batches
    const BATCH_SIZE = 3;
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
        const batch = remaining.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(item => uploadToGoogleDriveScript(item)));

        results.forEach((r, idx) => {
            const currentItem = batch[idx];
            const currentNum = i + idx + 1;
            if (r.status === 'success') {
                successCount++;
                console.log(`[${currentNum}/${remaining.length}] ✅ Berhasil: ${currentItem.folderDate} -> ${currentItem.filename}`);
            } else if (r.status === 'already_migrated') {
                console.log(`[${currentNum}/${remaining.length}] ⏩ Sudah ada: ${currentItem.filename}`);
            } else {
                failedCount++;
                console.warn(`[${currentNum}/${remaining.length}] ❌ Gagal: ${currentItem.filename} (${r.error})`);
            }
        });

        // Small delay to be polite to Google Apps Script rate limits
        await new Promise(res => setTimeout(res, 300));
    }

    console.log('\n=== Migrasi Selesai ===');
    console.log(`Sukses: ${successCount}`);
    console.log(`Gagal: ${failedCount}`);
    console.log(`Total di Database Map: ${Object.keys(migrationMap).length}`);
}

module.exports = {
    fetchAllTrips,
    extractPhotosFromTrips,
    uploadToGoogleDriveScript,
    main
};

if (require.main === module) {
    main();
}
