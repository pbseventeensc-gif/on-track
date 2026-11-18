# Lepas SJ manual 18 November dan perbaiki tautkan otomatis

Instruksi akhir: “hapus nomor sj yang di tautkan hari ini secara manual saja, dan betulkan fungsi tautkan otomatis nya”. Ruang lingkup berdasarkan waktu pemasangan dalam WIB dan audit `source: admin-manual-link`, bukan tanggal dokumen impor.

## Hasil produksi

- 50 tautan SJ aktif dilepas dari tujuh trip manual; satu catatan tautan lain menunjuk tujuan yang sudah tidak ada dan ikut ditutup.
- Nomor utama, nomor tambahan, referensi SJ asal, waktu/metode penautan, serta penanda verifikasi dari kelompok tersebut dibersihkan. Tautan SJ lain dipertahankan.
- Status pengiriman, foto bukti, alamat, nama tujuan, PT/customer, Admin SJ, GPS, ID/urutan tujuan, dan jumlah stop tetap sama dengan kondisi tepat sebelum pelepasan.
- Sembilan dokumen SJ dengan sumber lengkap dipulihkan ke Pool beserta item, customer, alamat, dan identitas impor aslinya. Import key diarahkan kembali ke dokumen Pool.
- Untuk 42 nomor lainnya (termasuk satu catatan tanpa tujuan), import key dilepas sehingga file SJ dapat diimpor ulang. Dokumen sumber lengkap tidak tersedia; data pengganti tidak dibuat.
- Audit penautan lama tetap tersimpan dengan `unlinkedAt`; `sj_manual_unlinks` mencatat nomor, asal/tujuan sebelumnya, waktu pelepasan, dan status pemulihan.

Penulisan memakai satu commit atomik berisi 169 operasi dengan prasyarat `updateTime`/`exists`. Backup lengkap dibuat sebelum penulisan. Pembacaan ulang memastikan nomor terpilih sudah tidak ada di tujuan manual, status/foto/GPS dan tautan lain tetap sama, sembilan SJ ada di Pool, serta kondisi semua import key sesuai.

## Tautkan otomatis

Pemasangan mengikuti kecocokan toko, bukan urutan daftar. Normalisasi mencakup prefix STORE/TOKO, tanda baca, serta singkatan LW/LP. PT yang berbeda ditolak; jalan atau nomor bangunan yang berbeda ditolak ketika keduanya dapat dibaca. Nama perusahaan penagihan tanpa alamat tujuan tidak cukup untuk pencocokan otomatis. Tujuan yang ambigu tetap harus dipilih manual; beberapa SJ untuk satu tujuan masih didukung.

Pemasangan otomatis kini mencatat `source: admin-auto-link` dan `sjMatchRule: automatic-store-match`; pilihan manual mencatat `admin-manual-link` / `manual-link`. Transaksi memeriksa ulang kecocokan saat penyimpanan, selain pemeriksaan perubahan identitas dan import key yang sudah ada.

## Rilis

Production: https://on-track-indol.vercel.app

Deployment `dpl_DajbaKvxC1hEy3HJhcgiNTVjQFo6`, status **READY**. `sj_links.js` dan `sj_manual_link.js` versi `20261118.2`; `app.js` tetap `20261118.1`. Perubahan lokal, `public/`, dan fallback Android diselaraskan; APK baru tidak dibangun. Rilis menggunakan baseline produksi agar pekerjaan lain di working tree tidak ikut diterbitkan.

296 pengujian lolos, termasuk mempertahankan SJ lama saat SJ hari ini dilepas, mempertahankan POD, kecocokan alamat, tujuan ambigu, dan pemisahan audit otomatis/manual. Uji browser memastikan urutan input terbalik tetap cocok ke toko yang benar dan tidak mengubah bukti/status. Smoke test produksi membaca script versi baru dan memeriksa penolakan alamat yang berbeda tanpa menulis data produksi.

Bukti lokal: `.artifacts/sj-manual-unlink-2026-11-18/{backup,plan,commit,verified,production-result}.json` dan `tests.log`. Arsip ini menggantikan status koreksi parsial dalam `docs/sj-identity-correction-2026-11-18.md`.
