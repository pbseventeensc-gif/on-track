# Pemeriksaan alur SJ untuk Senin, 16 November 2026

Rilis produksi: https://on-track-indol.vercel.app/ (deployment `dpl_Ffk8r9G8K3SvDn9JYSrwBLtSYt6A`).

## Perilaku

Klik grafik oranye/hari memilih seluruh titik pada hari tersebut; batang/angka hijau memilih titik selesai. Klik breakdown memilih identitas titik untuk klien atau region, termasuk nama klien yang didapat dari pencocokan alamat master. Filter grafik (periode, region, kurir, admin) ikut dipakai. Pilihan terlihat di atas Pengiriman Terbaru dan dapat dihapus. Reset Filter juga menghapus pilihan. Ekspor tabel mengikuti pilihan identitas yang sama.

Penugasan region: buka Plan Shipment, pilih region, tanggal/branch bila perlu, pilih kurir pada baris “Tugaskan per region”, lalu klik Tugaskan. Hanya SJ Ready tanpa kurir/pickup customer yang disertakan. Transaksi membaca dokumen terbaru; perubahan penugasan/region/status oleh perangkat lain membatalkan kelompok sebelum penulisan. Maksimum 400 SJ per transaksi. Penugasan checkbox memakai jalur penyimpanan yang sama.

## Bug yang diperbaiki

- Quick Dispatch region hanya menulis localStorage sehingga perangkat kurir tidak menerima tugas.
- Penugasan checkbox membangun ulang dokumen memakai nomor SJ sebagai ID, lalu menghapus dokumen lama. Ini dapat kehilangan nama toko, barang, koordinat, identitas tujuan, dan mengubah identitas QR. Sekarang dokumen asli diperbarui dalam transaksi.
- Status Ready menggunakan ID tampilan yang berbeda dengan ID dokumen asli dan menelan kegagalan tulis. Kini status disimpan ke dokumen asli sebelum tampilan diperbarui.
- Pool dari snapshot server tidak dipublikasikan ke sumber data UI; cache impor lama berpotensi menampilkan data yang sudah ditugaskan. UI kini memakai Pool dari server dan tidak menggabungkan cache browser online.
- Scan QR online dapat mengambil tugas kurir lain, melewati status belum Ready/pickup, dan menampilkan sukses saat penyimpanan gagal. Kini validasi memakai transaksi server serta menolak identitas SJ ganda.
- Kurir menyembunyikan tugas aktif berumur lebih dari tujuh hari. Tugas belum selesai sekarang tetap terlihat. Tanggal tugas server memakai assignedAt lebih dahulu, agar SJ impor sebelumnya muncul sesuai tanggal penugasan.

## Bukti dan batas pengujian

194 tes Node lulus, termasuk pembatalan seluruh transaksi saat satu SJ berubah, kegagalan simpan tanpa sukses palsu, penjagaan pickup/Ready, identitas dokumen/titik, pemuatan Pool setelah refresh, tanggal penugasan Senin, dan filter grafik.

Chrome DevTools Protocol menguji import CSV dua SJ, perubahan Ready, penugasan region Bekasi, klik grafik dan breakdown, kemudian halaman kurir 390 px. Kedua SJ tampil sebagai In Transit dengan toko dan nomor asli. Pengujian transaksi cloud memakai adapter Firestore tiruan; pengujian browser yang menulis data dilakukan hanya di sandbox terisolasi. Tidak ada SJ uji atau penugasan yang ditulis ke database produksi.

Pemeriksaan halaman produksi memakai snapshot database asli yang diberikan ke fungsi sinkronisasi aplikasi dan klik elemen DOM sesungguhnya. Uji ini tidak login sebagai akun kurir/admin produksi. Kamera, GPS, notifikasi, dan perilaku APK pada perangkat Android fisik belum diuji. Bukti lokal ada di `.artifacts/sj-readiness-2026-11-15/` (tidak dipublikasikan).
