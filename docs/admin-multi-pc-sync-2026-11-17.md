# Sinkronisasi Plan Shipment antar-PC admin — 17 November 2026

## Gejala

Dua admin membuka dashboard. Admin A mengosongkan Plan Shipment, tetapi Admin B
masih melihat SJ lama. Admin B tidak bisa mengimpor ulang karena muncul
"Semua SJ sudah pernah diimpor. Tidak ada SJ baru disimpan."

## Penyebab

- Tombol hapus/bersihkan Plan Shipment hanya menghapus data di **memori dan
  localStorage browser yang dipakai**. Dokumen `trips` dan registry
  `sj_import_keys` di Firestore tidak dihapus.
- PC lain tetap menerima snapshot Firestore yang masih berisi SJ tersebut.
- Saat impor ulang, registry `sj_import_keys` masih ada sehingga importer
  menganggap SJ sudah pernah diimpor, walaupun PC yang menghapus tidak lagi
  menampilkannya.
- Daftar `wtrack_deleted_pool_ids` adalah hide-list lokal. Daftar ini tidak
  tersinkron dan bahkan bisa menyembunyikan SJ yang sah setelah impor ulang.

## Perbaikan

- Hapus/bersihkan sekarang menghapus **dokumen `trips` dan `sj_import_keys`**
  lewat Firestore batch, sehingga PC lain menerima perubahan dari snapshot.
- Penghapusan online menunggu hasil server. Jika gagal, data tidak disembunyikan
  secara lokal dan admin mendapat pesan error.
- Batch dipecah maksimal 200 SJ (400 operasi) agar berada di bawah batas
  Firestore.
- Hide-list `wtrack_deleted_pool_ids` sekarang hanya dipakai di sandbox lokal.
  Di mode online, Firestore adalah sumber kebenaran; impor ulang tidak
  tersembunyi oleh hide-list lama.
- Importer memeriksa ulang registry: jika `sj_import_keys` menunjuk trip yang
  sudah tidak ada, key dianggap basi dan SJ boleh diimpor ulang.
- Jalur hapus lama di `app.js` (hapus satu SJ, bersihkan pool, hapus tugas,
  hapus titik terakhir) ikut membersihkan key impor.
- Registry key memakai dokumen ID `encodeURIComponent(NO_SJ_UPPERCASE)` yang sama
  dengan jalur impor.

## Catatan migrasi untuk data lama

SJ yang sebelumnya hanya "dihapus" secara lokal **masih ada di Firestore**.
Setelah halaman baru dimuat, SJ tersebut akan muncul kembali di PC yang
menghapusnya. Hapus sekali lagi dengan tombol baru; setelah itu kedua PC akan
sama-sama bersih dan SJ dapat diimpor ulang.

## Verifikasi

- `npm test`: **242 tes lulus**, termasuk:
  - hapus cloud menghapus `trips/<tripId>` dan `sj_import_keys/<NO_SJ>`,
  - pemecahan batch untuk 201 SJ,
  - key registry basi tidak memblokir impor ulang.
- Uji browser sandbox: hapus 2 SJ, hapus 1 SJ, lalu hapus satuan tetap bekerja
  dan cache lokal ikut bersih.
- Uji online memakai Firestore tiruan; transaksi nyata dan dua PC fisik belum
  diuji pada tahap ini.
