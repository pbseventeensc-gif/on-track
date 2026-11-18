# Koreksi tujuan SJ — 18 November 2026

> Status ini telah digantikan oleh instruksi pelepasan tautan manual hari ini. Lihat [hasil akhir pelepasan dan perbaikan otomatis](sj-manual-unlink-2026-11-18.md).

## Ruang lingkup dan hasil data produksi

Instruksi akhir membatasi koreksi pada pengiriman **18 November**. Perubahan sementara pada pengiriman 17 November telah dibalik dengan backup dan diverifikasi. Nilai tujuan fisik yang diperbarui kurir tetap dipertahankan selama pemulihan.

50 nomor SJ yang masih tertaut pada pengiriman manual 18 November diperiksa:

- 24 SJ memiliki pasangan tujuan terverifikasi: 23 tautan dipindahkan dan satu tetap di tujuan yang benar.
- 26 SJ masih perlu konfirmasi tujuan. Metadata asal disimpan, dan tujuan dengan tautan tersebut mendapat `sjIdentityStatus: needs-review` agar dashboard menampilkan **Periksa tujuan SJ**.
- Status, bukti foto, lokasi GPS, urutan/ID tujuan, dan jumlah stop dipertahankan. Koreksi hanya memindahkan metadata SJ dan mengisi PT/Admin berdasarkan tautan terverifikasi.
- Import key untuk tautan yang berpindah ikut diperbarui. Audit permanen mencatat asosiasi lama, asosiasi baru, identitas asal, dan hasil verifikasi.
- Satu audit lain, SJ-1126-03486, menunjuk deliveryId yang sudah tidak ditemukan pada trip manual. Nomor tersebut tidak termasuk 50 tautan yang masih tersimpan dan belum direkonstruksi karena identitas asal/tujuannya tidak tersedia.

Contoh yang sudah dikoreksi: SJ-1126-03352 → AZKO QBig BSD; SJ-1126-03347 dan SJ-1126-03398 → Chatime Bintaro Living Plaza; SJ-1126-03332 → Neka Pinang. Beberapa SJ dapat tetap bergabung pada satu stop.

SJ-1126-03324 masih perlu konfirmasi: metadata asal menyebut `neka surya kencana tgr`, sedangkan tujuan sebelumnya Neka Ciledug Indah. File asal sudah dihapus dari Pool saat penautan; alamat aslinya tidak tersedia dalam snapshot lokal yang ditemukan. Tidak ada alamat baru yang ditebak.

## Perbaikan aplikasi

- Tombol pemasangan berurutan diganti **Cocokkan tujuan SJ**. Pencocokan otomatis mensyaratkan nama toko yang sama setelah normalisasi; PT yang berbeda dan tujuan ganda tidak dipasangkan otomatis.
- Beberapa SJ untuk satu tujuan tetap didukung.
- Konfirmasi manual memperlihatkan identitas asal dan tujuan. Pasangan yang berbeda/belum terverifikasi ditampilkan secara eksplisit.
- PT, toko, dan alamat asal SJ disimpan dalam snapshot pada tautan baru dan audit.
- Transaksi menolak tujuan yang berubah, nomor/identitas SJ yang berubah, import key yang sudah menunjuk trip lain, dan deliveryId yang hilang. Tidak ada fallback diam-diam ke stop lain ketika deliveryId sudah berubah.
- PT dari snapshot SJ mengisi customer tujuan yang masih kosong pada penautan baru.

## Rilis dan verifikasi

Production: https://on-track-indol.vercel.app

Deployment: `dpl_5SZ9HufWWJnhSnvpx7sZvzn6M4Lt` (**READY**).

Versi script `app.js`, `sj_links.js`, `sj_manual_link.js`: `20261118.1`.

Rilis memakai baseline file produksi untuk perubahan lain yang masih dikerjakan di working tree. Sumber lokal, `public/`, dan fallback Android memuat perbaikan SJ; APK baru tidak dibuat.

Seluruh 290 pengujian lolos. Uji browser memastikan urutan SJ terbalik tetap cocok ke toko yang benar, PT tersimpan, status/foto tetap sama, dan penanda review muncul tanpa error JavaScript. Penulisan data menggunakan commit atomik dengan prasyarat updateTime, backup, pemeriksaan keunikan nomor, dan pembacaan ulang hasil.

Bukti lokal di `.artifacts/sj-identity-audit-2026-11-18/`: `repair-backup.json`, `repair-verified.json`, `rollback-17-verified.json`, `corrections-18.csv`, `needs-review-18.csv`, `browser-result.json`, `production-result.json`.

Untuk menyelesaikan 26 pasangan ambigu dan satu audit tanpa tujuan, diperlukan file SJ asli yang diimpor 18 November atau konfirmasi tujuan berdasarkan nomor SJ.
