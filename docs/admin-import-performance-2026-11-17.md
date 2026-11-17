# Performa import SJ & penugasan kurir — 17 November 2026

## Masalah yang dilaporkan

1. Dashboard admin di Windows terasa berat saat mengimpor banyak Surat Jalan (SJ), lalu tab bisa tiba-tiba tertutup.
2. Setelah mencentang beberapa SJ di Delivery Order, langkah berikutnya belum jelas dan SJ yang dipilih tidak terlihat sebagai satu daftar.
3. Tujuan utama: web tetap ringan walaupun mengimpor ratusan/ribuan SJ.

## Penyebab utama yang ditemukan

- **Master customer diambil ulang untuk setiap file.** `parseExcelFile` memanggil `getCustomerAdminSJLookup()` di dalam pembacaan tiap file. Impor 100 file berarti 100 kali pembacaan koleksi `clients` (ribuan dokumen) hanya untuk mengisi kolom Admin SJ.
- **Preview import merender semua baris sekaligus.** Satu baris memiliki checkbox, input admin, dan dua `<select>` (region dan branch). Ribuan baris berarti puluhan ribu elemen DOM dalam satu `innerHTML`.
- **Tabel Plan Shipment merender semua SJ sekaligus**, lalu dirender ulang setiap kali snapshot Firestore berubah dan setiap ketikan pencarian.
- **Pembacaan seluruh koleksi `trips`** dilakukan saat simpan hanya untuk memeriksa nomor SJ duplikat. Biaya dan memori membesar seiring riwayat pengiriman.
- **ID trip bisa bertabrakan** karena memakai `Date.now()` + 4 karakter acak. Pada batch ribuan SJ, tabrakan ID membuat satu SJ terlewat saat cache browser digabung.
- **Pencarian langsung memicu render ulang** pada setiap karakter, tanpa debounce.

## Perubahan yang diterapkan

### Import SJ (`js/sj_import_engine.js`)

- Master Admin SJ diambil **sekali per batch** lalu diteruskan ke setiap file.
- Preview import **dipaginasi** (50/100/250 baris per halaman; default 100). Hanya halaman aktif yang masuk DOM.
- Pencarian preview **di-debounce 250 ms**, tetapi tetap mencari di seluruh hasil import (bukan hanya halaman aktif).
- Pilihan checkbox disimpan di model, sehingga berlaku **lintas halaman** dan saat pencarian/filter berubah.
- Tombol simpan membaca pilihan dan hasil edit dari model, bukan dari elemen DOM halaman aktif.
- Pemeriksaan duplikat online hanya menanyakan **nomor SJ kandidat** (`where('noSJ','in',...)` per 30 nomor). Pembacaan penuh koleksi `trips` hanya dipakai sebagai fallback bila query gagal.
- ID trip memakai **UUID + urutan batch** sehingga tidak ada tabrakan pada batch besar.
- Ada baris **progres dan tombol Batal** saat membaca file; pembacaan file memberi kesempatan browser bernapas (`yieldToUI`) di antara file.
- Setelah simpan, data preview dibersihkan dari memori.

### Delivery Order / Plan Shipment (`js/unified_pool_ui.js`)

- Tabel pool **dipaginasi** (25/50/100/200 baris; default 50).
- Pencarian pool **di-debounce 250 ms**.
- Pilihan SJ disimpan di satu `Set`, sehingga tidak hilang saat pindah halaman, mengganti filter, atau setelah data dirender ulang.
- Header checkbox memilih **semua SJ pada hasil filter** (semua halaman), bukan hanya baris yang terlihat.
- Saat ada SJ dipilih, muncul bar aksi yang menampilkan:
  - jumlah SJ dipilih,
  - ringkasan region,
  - peringatan bila ada SJ Belum Ready / Pickup / sudah ditugaskan,
  - contoh nomor SJ yang dipilih dan jumlah sisanya,
  - tombol **Lanjut Tugaskan**, Cetak, Hapus, Bersihkan.
- Dialog **Tugaskan Surat Jalan** menampilkan:
  - daftar lengkap SJ terpilih beserta customer, region, dan status kelayakan,
  - tombol hapus per SJ dari pilihan,
  - pilihan Kurir Motor / Driver Mobil dan plat/armada opsional,
  - ringkasan jumlah siap vs dilewati,
  - tombol konfirmasi dengan jumlah SJ yang akan ditugaskan.
- Setelah konfirmasi, dialog menampilkan **hasil penugasan** (jumlah SJ, nama kurir, daftar SJ) dan halaman Pool langsung diperbarui.
- Batas **400 SJ per penugasan** dijaga di dialog, di `saveAssignments`, dan tetap divalidasi oleh `SJAssignment`. Pilihan di atas 400 harus dipecah menjadi beberapa batch.
- Pilihan tidak bisa diisi untuk SJ pickup yang sedang menunggu.
- Hapus SJ (satuan maupun terpilih) mencocokkan nomor SJ sekaligus ID dokumen `TRIP_*`, sehingga data di cache lokal benar-benar ikut terhapus.
- Render pool dari snapshot Firestore digabung (debounce 120 ms) agar beberapa pembaruan tidak memicu render berulang.

### Lain-lain

- `css/style.css` mendapat aturan responsif untuk bar pilihan, pagination, dialog penugasan, dan `content-visibility` pada baris preview.
- Versi cache `style.css`, `app.js`, `sj_import_engine.js`, dan `unified_pool_ui.js` dinaikkan agar browser memuat kode baru.
- Aset disinkronkan ke `public/` dan `app/src/main/assets/` dengan `node scripts/sync-web-assets.cjs`.

## Verifikasi

- `npm test`: **229 tes lulus**.
- Uji browser Chrome (localhost, mode sandbox) dengan **100 file CSV = 1.200 SJ**:
  - preview 1.200 SJ dalam ±3,4 detik,
  - hanya **100 baris** yang dirender di preview,
  - lookup master customer hanya **1 kali**,
  - simpan ke pool ±0,16 detik,
  - tabel pool hanya merender **50 baris**,
  - tidak ada error halaman.
- Uji pilihan lintas halaman dengan 120 SJ: pilih semua (120), pindah halaman tetap terpilih, pilih 3 SJ dari dua halaman, buka dialog, hapus satu dari dialog, lalu tutup — semua konsisten.
- Uji penugasan 3 SJ: dialog menampilkan 3 SJ, hasil sukses menampilkan 3 SJ dan kurir, pool berkurang dari 1.200 menjadi 1.197.
- Uji batas 400 SJ: memilih 450 SJ menampilkan pesan batas dan tidak membuka dialog.
- Bukti screenshot dan JSON ada di `.artifacts/admin-perf-2026-11-17/` (tidak dipublikasikan): `selection-bar.png`, `assignment-dialog.png`, `assignment-result.png`, `result.json`, dan `selection-result.json`.

## Catatan operasional

- Impor tetap memakai satu kunci registry per nomor SJ (`sj_import_keys`) dan transaksi Firestore; nomor SJ duplikat dilewati.
- Pemeriksaan duplikat bertahap menambah beberapa query untuk batch besar. Jika jaringan/database menolak query `in`, kode otomatis kembali ke pembacaan penuh agar impor tidak berhenti.
- Pagination hanya mengubah tampilan; data dan hasil ekspor tetap mencakup seluruh SJ pada filter.
- Pilihan SJ tidak disimpan setelah halaman di-refresh; ini disengaja agar tidak ada penugasan tak sengaja.
- Untuk deploy, jalankan sinkronisasi aset dan unggah `public/`; aplikasi Android memakai salinan `app/src/main/assets/`.

## Deployment produksi

- Tanggal: 17 November 2026
- Project: `pos-ec42/on-track`
- Deployment ID: `dpl_BQvF91eJdrp4hbjbuCftbYd43PkP`
- URL deployment: https://on-track-cf1tvc8ac-pos-ec42.vercel.app
- Alias produksi: https://on-track-indol.vercel.app
- Status: `READY`, build 21 detik, total siap 36 detik
- Pemeriksaan produksi: halaman login merespons 200, tidak ada error JavaScript, dan API baru terdeteksi di browser (`openAssignmentModal`, `confirmAssignment`, `setPreviewPage`, `cancelImport`, modal penugasan, pagination import).
- Header cache: `/kurir` dan `/kurir.html` `no-store`; `/js/*` `public, max-age=0, must-revalidate`.
