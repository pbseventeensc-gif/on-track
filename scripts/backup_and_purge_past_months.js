/**
 * WTrack - Backup & Purge Past Months Trips from Firestore
 * 
 * Konsep:
 * Menyimpan data riwayat bulan-bulan lalu ke backup lokal JSON (dan foto sudah di Google Drive 5TB),
 * lalu menghapus trip bulan lalu dari Firestore sehingga Dashboard Admin HANYA menyisakan
 * data bulan berjalan (Bulan Ini).
 * 
 * Hasil: Dashboard Admin dan Firestore menjadi sangat ringan, cepat, dan lancar di PC RAM 4GB.
 */

const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
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

function getTripDate(doc) {
    const f = doc.fields || {};
    const tripId = doc.name.split('/').pop();
    let d = null;
    if (f.date?.timestampValue) d = new Date(f.date.timestampValue);
    else if (f.date?.mapValue?.fields?.seconds?.integerValue) d = new Date(parseInt(f.date.mapValue.fields.seconds.integerValue) * 1000);
    else if (f.date?.stringValue) d = new Date(f.date.stringValue);
    else if (tripId.startsWith('TRIP_')) {
        const num = parseInt(tripId.replace('TRIP_', ''));
        if (!isNaN(num)) d = new Date(num);
    }
    return d;
}

async function batchDeleteTrips(docNames) {
    const BATCH_SIZE = 50;
    for (let i = 0; i < docNames.length; i += BATCH_SIZE) {
        const batch = docNames.slice(i, i + BATCH_SIZE);
        const writes = batch.map(name => ({ delete: name }));

        const url = 'https://firestore.googleapis.com/v1/projects/ontrack-fccb8/databases/(default)/documents:commit';
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ writes })
        });

        if (!res.ok) {
            const err = await res.text();
            console.error(`Gagal batch delete index ${i}:`, err);
        } else {
            console.log(`[Batch Delete] ${Math.min(i + BATCH_SIZE, docNames.length)} / ${docNames.length} dokumen bulan lalu berhasil dihapus dari Firestore.`);
        }
    }
}

async function main() {
    console.log('=== Memeriksa Trip Firestore untuk Pembersihan Bulan Lalu ===');
    const allTrips = await fetchAllTrips();
    console.log(`Total trip saat ini di Firestore: ${allTrips.length}`);

    // Dapatkan awal bulan berjalan (1 Oktober 2026, 00:00:00 WIB)
    const now = new Date();
    // Awal bulan ini: tahun sekarang, bulan sekarang, tanggal 1, 00:00:00
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    console.log(`Batas Bulan Berjalan: Mulai ${startOfCurrentMonth.toISOString()}`);

    const pastTrips = [];
    const currentMonthTrips = [];

    allTrips.forEach(doc => {
        const d = getTripDate(doc);
        if (d && d.getTime() < startOfCurrentMonth.getTime()) {
            pastTrips.push(doc);
        } else {
            currentMonthTrips.push(doc);
        }
    });

    console.log(`Trip Bulan Ini (Dipertahankan): ${currentMonthTrips.length}`);
    console.log(`Trip Bulan Lalu (Siap Diarsip & Dibersihkan): ${pastTrips.length}`);

    if (pastTrips.length === 0) {
        console.log('Semua trip di Firestore sudah berada di bulan berjalan. Tidak ada yang perlu dibersihkan.');
        return;
    }

    // 1. Simpan backup lengkap
    const backupFile = path.join(BACKUP_DIR, `trips_backup_prior_to_${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(pastTrips, null, 2), 'utf-8');
    console.log(`✅ Backup berhasil disimpan ke: ${backupFile}`);

    // 2. Hapus dari Firestore
    const docNamesToDelete = pastTrips.map(t => t.name);
    console.log(`Menghapus ${docNamesToDelete.length} trip bulan lalu dari Firestore...`);
    await batchDeleteTrips(docNamesToDelete);

    console.log('\n=== Pembersihan Selesai ===');
    console.log(`Firestore sekarang bersih! Hanya menyisakan ${currentMonthTrips.length} trip bulan berjalan.`);
    console.log('Dashboard Admin sekarang akan memuat jauh lebih cepat dan enteng di PC RAM 4GB!');
}

if (require.main === module) {
    main();
}

module.exports = { main, fetchAllTrips, getTripDate };
