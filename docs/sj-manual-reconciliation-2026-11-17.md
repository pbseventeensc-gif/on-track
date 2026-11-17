# Sinkronisasi SJ Pool dengan pengiriman manual

## Tujuan

Pengiriman yang dibuat lewat **Manual Dispatch** kadang tidak memakai form import SJ.
Fitur **Sinkronkan SJ** mencocokkan tujuan manual tersebut dengan SJ yang masih ada di
SJ Pool. Hanya pasangan yang aman yang boleh dipindahkan; pengiriman perusahaan lain
tidak disentuh.

## Skema data

### Trip manual (`trips/{tripId}`)

```text
destinations[]:
  deliveryId
  clientId          // dari Master Customer untuk pengiriman baru
  storeId           // kunci toko yang dinormalisasi
  locationName
  address
  noSJ / sjNumber   // kosong sampai hasil sinkronisasi
  sjTripId          // dokumen SJ import yang dipakai
  sjMatchedAt
  sjMatchRule       // storeKey
```

Pengiriman manual baru dari pemilihan customer sekarang ikut menyimpan
`clientId` dan `storeId` pada antrean tujuan.

### SJ import (`trips/{importTripId}`)

Sudah memiliki `noSJ`, `customer`/`clientName`, `storeDestination`, `address`,
`sourceFile`. Import baru juga menulis `clientId` dan `storeId`.

### Alias toko (`delivery_point_aliases/{aliasKey}`)

```text
aliasKey       // nama toko manual yang dinormalisasi
storeKey       // kunci toko SJ import
noSJExample
updatedAt
```

Alias dipakai saat nama toko manual berbeda dari nama di Excel, misalnya
`Gyu-Kaku MKG` → `GYUKAKU MALL KELAPA GADING 3`. Alias dibuat sekali lewat
tombol **Hubungkan** dan dipakai untuk pencocokan berikutnya.

### Audit (`sj_reconciliations/{id}`)

```text
noSJ, manualTripId, deliveryId, poolTripId, matchKey, matchedAt, source
```

## Aturan pencocokan

1. Hanya SJ yang masih **Pool** dan belum punya kurir.
2. Hanya tujuan manual yang belum memiliki `noSJ`/`sjNumber`.
3. Nama toko dinormalisasi: huruf kecil, tanda baca/spasi dirapikan,
   prefix `STORE`/`TOKO` dan catatan `UP : ...` dibuang.
4. Satu tujuan manual hanya boleh mendapat **satu SJ**.
5. Satu SJ hanya boleh dipakai untuk **satu tujuan**.
6. Jika satu toko memiliki beberapa SJ, statusnya **ambigu** dan tidak
   diterapkan otomatis; admin memilih nomor SJ yang benar.
7. Jika nama toko berbeda, admin menekan **Hubungkan**, memasukkan nomor SJ,
   lalu alias disimpan. Setelah itu pasangan dapat diterapkan.
8. Semua status ditampilkan lebih dulu; tidak ada perubahan sebelum tombol
   **Terapkan** ditekan.

## Hasil penerapan

- `noSJ`/`sjNumber` ditempel ke tujuan manual; dashboard menampilkan nomornya.
- Dokumen SJ di Pool dihapus.
- `sj_import_keys` diarahkan ke trip manual agar SJ tidak diimpor ganda.
- Nomor SJ tetap dapat dipakai lagi jika trip manual dihapus, karena jalur hapus
  membersihkan key berdasarkan nomor SJ di root maupun tujuan.
- Pool berkurang sesuai jumlah pasangan yang diterapkan.

## Kondisi data saat fitur dibuat

- SJ Pool: **416** (dinamis; 413 dengan `importedAt` hari ini).
- Tujuan manual hari ini: **158** (15 trip, termasuk yang sudah selesai).
- Preview exact match: **15 cocok**, **5 ambigu**, **138 tidak cocok**.
- 138 tidak cocok bukan berarti gagal: sebagian adalah pengiriman perusahaan
  lain, sebagian perlu alias karena nama toko manual lebih pendek.

Fitur ini menampilkan angka tersebut secara transparan. Admin dapat membuat
alias untuk pasangan yang benar-benar sesuai; SJ yang tidak punya pasangan tetap
di Pool.

## Cara pakai

1. Buka **Delivery Order → Sinkronkan SJ**.
2. Pilih tanggal pengiriman manual (default hari ini).
3. Periksa baris **Cocok**; hilangkan centang jika tidak ingin diterapkan.
4. Untuk baris **Ambigu**, pilih salah satu nomor SJ.
5. Untuk baris **Tidak cocok** yang sebenarnya pasangan kita, klik **Hubungkan**
   dan masukkan nomor SJ acuan; alias akan disimpan.
6. Klik **Terapkan N SJ**. Pool langsung berkurang dan dashboard menampilkan
   nomor SJ.

## Verifikasi

- Unit test inti: normalisasi toko, match unik, ambigu, alias, satu SJ tidak
  boleh dipakai dua tujuan, dan baris tanpa toko/alamat tidak cocok.
- Uji browser sandbox: match otomatis, penerapan, pengurangan Pool, dan
  penyimpanan alias berhasil.
- Preview dengan data produksi (read-only): 416 Pool, 158 tujuan manual,
  15 cocok, 5 ambigu, 138 tidak cocok.
- Belum menulis data produksi.

## Deployment produksi

- Commit: `5d554f1` — `feat(admin): reconcile SJ Pool with manual delivery destinations`
- Branch `main` sudah di-push ke GitHub.
- Vercel auto-deploy: **success**
- Deployment reference: `DGFsUaTpZRnHV4czZwxRhSd98E14`
- Production alias: https://on-track-indol.vercel.app
- Script production:
  - `app.js?v=20261117.3`
  - `unified_pool_ui.js?v=20261117.3`
  - `sj_reconcile_core.js?v=20261117.1`
  - `sj_reconcile.js?v=20261117.1`
- Smoke test production: `SJReconcile`, `SJReconcileCore`, modal, dan handler tombol tersedia; tidak ada error JavaScript.
- Preview data produksi saat deploy: 416 SJ di Pool, 158 tujuan manual, **15 cocok**, **5 ambigu**, **138 tidak cocok**.
- Tidak ada dokumen produksi yang diubah saat pengembangan/fitur ini dipasang. Penerapan hanya terjadi jika admin menekan **Terapkan**.


## Status penggunaan saat ini

Tombol **Sinkronkan SJ** disembunyikan dari toolbar SJ Pool untuk sementara.
Keputusan operasional 17 November 2026: pengiriman manual hari ini ditangani
lewat **foto Bulk SJ** atau koordinasi dengan admin, bukan auto-sync.

Kode dan modal tetap tersimpan. Untuk menampilkan kembali tombol di kemudian hari,
set `window.WTRACK_ENABLE_SJ_RECONCILE = true` sebelum dashboard dirender
(misalnya lewat pengaturan fitur), lalu muat ulang halaman.

Bulk SJ photo tetap tersedia lewat kartu Live Tracking / Manual Dispatch:
pilih satu atau beberapa foto, upload, lalu buka Audit Bulk SJ untuk melihatnya.

## Alur manual (dictation) — fitur utama

Sesuai keputusan operasional, pencocokan otomatis disembunyikan. Yang dipakai
adalah tautan manual dari SJ Pool:

1. Admin menerima info lisan, misalnya **“kurir Ahmad, SJ-1126-03248”**.
2. Cari SJ tersebut di tabel **SJ Pool**.
3. Klik ikon **Tautkan** (rantai) pada kolom Aksi baris SJ.
4. Di dialog:
   - SJ yang dipilih tampil di atas,
   - ketik nama kurir/toko/alamat untuk mencari tujuan manual,
   - pilih satu tujuan (radio).
5. Klik **Tautkan & Sinkronkan**.
6. Hasil:
   - nomor SJ muncul di dashboard pengiriman manual,
   - SJ dihapus dari Pool,
   - `sj_import_keys` diarahkan ke trip manual,
   - audit `sj_reconciliations` mencatat sumber `admin-manual-link`.

Aturan:

- satu SJ hanya untuk satu tujuan,
- satu tujuan hanya untuk satu SJ,
- tujuan yang sudah punya nomor SJ tidak ditampilkan lagi,
- target bisa berupa pengiriman aktif maupun yang sudah selesai pada tanggal tersebut,
- tanggal tujuan dapat diganti di dialog,
- tidak ada pencocokan otomatis/fuzzy.

Tombol global **Sinkronkan SJ** tetap disembunyikan (`WTRACK_ENABLE_SJ_RECONCILE`).
Aksi **Tautkan** per baris inilah yang muncul di SJ Pool.

## Deployment tautan manual

- Commit: `d2fb572` — `feat(admin): manually link an SJ Pool record to a manual delivery`
- Vercel auto-deploy: **success**
- Deployment reference: `AP5nAZ8XKMY1iM8ozNSMyXB9pQ35`
- Production: https://on-track-indol.vercel.app
- Script SJ Pool: `unified_pool_ui.js?v=20261117.5`
- Script tautan manual: `sj_manual_link.js?v=20261117.1`
- Smoke test: `SJManualLink`, modal, dan halaman tersedia tanpa error JavaScript.
- Pencocokan otomatis tetap tersembunyi; aksi **Tautkan** per baris SJ Pool yang aktif.

## Mode bulk (banyak SJ sekaligus)

Jika beberapa SJ dicentang di SJ Pool, bilah aksi menampilkan tombol
**Tautkan Manual** di samping **Lanjut Tugaskan**.

Alurnya:

1. Centang beberapa SJ di SJ Pool.
2. Klik **Tautkan Manual**.
3. Dialog menampilkan semua SJ terpilih di bagian atas sebagai kartu.
4. Pilih **kurir** pada dropdown di atas tabel.
5. Klik **Tautkan Otomatis**. SJ terpilih dipasangkan berurutan ke tujuan
   manual kurir tersebut yang belum punya SJ.
6. Periksa hasilnya. Jika ada yang tidak sesuai, klik **Lepas** atau pasangkan
   ulang dengan mengklik SJ aktif lalu baris tujuan.
7. Klik **Tautkan N SJ**.

Pasangan otomatis mengikuti urutan kartu SJ dan urutan tujuan pada tabel.
Karena itu, periksa tabel sebelum menekan tombol terapkan.

Setelah diterapkan, setiap SJ dihapus dari Pool dan nomornya masuk ke tujuan
manual yang dipilih. Aturan tetap **satu tujuan = satu SJ** dan **satu SJ = satu
tujuan**.


### Auto-pair per kurir

Jika semua SJ dicentang dan tujuannya milik satu kurir:

- pilih nama kurir pada dropdown **Semua Kurir**,
- klik **Tautkan Otomatis**,
- sistem memasangkan SJ ke tujuan kurir tersebut secara berurutan,
- jumlah yang dipasangkan mengikuti jumlah tujuan/SJ yang tersedia,
- klik **Tautkan N SJ** untuk menyimpan.

Tidak perlu menekan tombol **Pasang** satu per satu.

## Beberapa SJ untuk satu tujuan dan koreksi Romi → Firdaus

Perubahan 17 November 2026 atas instruksi admin: **tautan manual** sekarang
mendukung beberapa SJ pada satu tujuan fisik. Aturan lama satu tujuan = satu SJ
pada alur manual digantikan oleh aturan berikut:

- Satu SJ tetap hanya tertaut ke satu tujuan.
- Satu tujuan dapat menerima beberapa SJ; jumlah stop, status, dan bukti tidak berubah.
- Tautan tambahan disimpan dalam `destinations[].sjLinks[]`, masing-masing dengan
  `noSJ`, `sjTripId`, waktu, aturan tautan, serta metadata customer/store asal import.
- `noSJ`/`sjNumber` tetap berisi nomor utama untuk kompatibilitas alur pengiriman.
- Dashboard, pencarian, laporan, Excel, dan kartu kurir menampilkan semua nomor.
- Tautan manual dapat memilih tujuan yang sudah memiliki SJ. Klik tujuan yang sama
  untuk menambahkan SJ terpilih berikutnya. Melepas pilihan hanya melepas SJ itu.
- Tautkan Otomatis tetap memasangkan berurutan ke tujuan kosong; penambahan beberapa
  SJ pada satu tujuan dipilih secara eksplisit oleh admin.
- Menghapus trip membersihkan seluruh import key, termasuk nomor tambahan.
- Kurir mengunggah bukti untuk stop yang sama; nomor utama pada tujuan dengan
  beberapa SJ tidak dapat diganti dari form unggah kurir.

Koreksi produksi selesai, dari `TRIP_1794881909233` (Romi) ke
`TRIP_1794878154293` (Firdaus):

| Tujuan Firdaus | Nomor SJ |
| --- | --- |
| Gyu-Kaku TSM Cibubur | SJ-1126-03192 |
| AEON Mall Sentul City | SJ-1126-03165 |
| Gyu-Kaku Botani Square | SJ-1126-03167 |
| Molly Tea Kota Wisata | SJ-1126-03227 |
| INFORMA Living World Kota Wisata | SJ-1126-03219, SJ-1126-03229 |
| PT Merapi Maju Makmur | SJ-1126-03213, SJ-1126-03239, SJ-1126-03130 |

Ketiga SJ Merapi digabung pada tujuan Merapi di trip utama Firdaus. Trip Merapi
Firdaus lainnya (`TRIP_1794878298724`) tidak berubah. Jumlah stop tetap: Romi 21,
trip utama Firdaus 11, trip Merapi lainnya 1. Romi masih memiliki 12 nomor SJ lain;
nomor tersebut tidak termasuk koreksi ini.

Penulisan menggunakan commit atomik dengan prasyarat `updateTime` untuk mencegah
penimpaan perubahan kurir. Setiap nomor telah diverifikasi tepat sekali pada tujuan
Firdaus, tidak lagi pada Romi, dan import key menunjuk trip Firdaus. Audit awal
menyimpan referensi tujuan lama dan koreksi; audit perpindahan terpisah juga dibuat.
Backup dan hasil verifikasi berada di direktori lokal yang diabaikan Git:
`.artifacts/admin-reconcile-2026-11-17/transfer-*-backup.json` dan
`verify-nine-result.json`.

Validasi: seluruh 253 pengujian awal lolos, ditambah pengujian batas batch untuk
banyak SJ; uji browser bulk ke satu stop, laporan, dan kartu kurir lolos tanpa
error JavaScript. Salinan web dan fallback Android tersinkron; APK baru belum dibangun.

Deployment Vercel dari working tree lokal: `dpl_ANeE2dpjiyc1ro1VgHkXt46yTZUH`,
status **READY**, alias https://on-track-indol.vercel.app. Smoke test produksi HTTP
200; `SJManualLink` tersedia dan script versi `20261117.7` termuat tanpa error.

### Penyederhanaan popup

Popup Tautkan Manual memakai font Inter dari `--font-sans` dashboard, kontrol
netral, teks ringkas, serta penanda pilihan tanpa warna tambahan. Tombol pasangan
berurutan tetap tersedia. Label versi UI di footer dihapus. Uji browser bulk dan
single lolos; font modal/tombol sama dengan body pada desktop 1440 px dan ponsel
390 px, tanpa overflow modal. Empat pengujian tautan beberapa SJ juga lolos.

Deployment UI: `dpl_FuSHjJuW8WhzPx51N3pLiWHYocsS`, **READY**, production alias
https://on-track-indol.vercel.app. Script tautan manual versi `20261117.8`, CSS
versi `20261117.2`. Perubahan ini tidak menulis data pengiriman.

### Loading Wellen, header tabel, dan dropdown kurir

Spinner loading di popup dan tombol simpan memakai oranye Wellen `#FF471D`.
Header tabel memakai latar `#F2F4F7`, teks lebih tebal dan garis bawah untuk
membedakannya dari baris data. Dropdown kurir memakai komponen bersama dengan
Manual Dispatch, termasuk pencarian dan avatar, dengan ukuran kontrol 36 px.
Menu dropdown dalam modal ditempatkan di dalam modal agar pencarian tetap bisa
menerima fokus dari Bootstrap; menu ditutup ketika modal ditutup.

257 pengujian lolos; uji browser memverifikasi pencarian dropdown, pemilihan
kurir, warna header dan spinner. Deployment production:
`dpl_C68VCBFt7Hph9eZjboHzJ3gH1HZp` (**READY**), script manual link `20261117.9`,
custom dropdown `20261117.1`, CSS `20261117.3`.
