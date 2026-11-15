# Pending Pool dan foto cloud — 15 November 2026

Produksi: https://on-track-indol.vercel.app/ (deployment `dpl_Gt9vEjQWToP3DGz3auXcscUWUi2g`).

Laporan Pending/Gagal menyimpan foto melalui jalur bukti yang sama dengan completion: Storage, dengan fallback dokumen `delivery_proofs` dan endpoint `/api/proof-photo`. Foto base64 tidak dimasukkan ke dokumen perjalanan online. Tidak ada gambar SVG pengganti yang dinyatakan sebagai bukti foto. Laporan hanya menampilkan sukses sesudah transaksi server berhasil dan memeriksa identitas titik, kepemilikan kurir, serta status selesai dari server terbaru.

SJ dengan satu titik kembali ke Pool dalam dokumen yang sama, tanpa kurir aktif. Untuk perjalanan dengan beberapa titik, hanya titik gagal yang dipisahkan ke dokumen Pool; saudara yang selesai dipertahankan. Identitas deliveryId, nomor SJ, barang, alasan, catatan, foto, waktu, kurir sebelumnya dan sourceTripId disimpan. `failedAttempts` menyimpan riwayat kegagalan. Penugasan berikutnya membersihkan flag pending aktif dan mempertahankan riwayat tersebut.

Pending/Gagal berada di atas impor baru, termasuk impor urgent. Pending tertua didahulukan. Pending lama tetap muncul pada tampilan harian sehingga tidak tertutup oleh filter tanggal impor baru. Region/branch/pencarian tetap menyaring data. Tujuan aktif saudara tidak dianggap gagal hanya karena induk memiliki alasan pending lama.

197 tes Node lulus. Chrome DevTools Protocol menguji versi yang sudah dipasang online dengan dua titik pada perjalanan QA terpisah. Gambar PNG netral “QA FOTO UJI WTRACK — Bukan bukti pengiriman operasional” dipilih lewat file input aplikasi dan dikompresi oleh fungsi asli. Titik pertama selesai, titik kedua dilaporkan gagal dan masuk Pool. Foto selesai tersimpan di Firebase Storage, foto pending diuji melalui fallback Firestore. Kedua URL merespons HTTP 200 image/jpeg, 21.847 byte, 1000×750 piksel dan dapat didekode browser. Foto pending masih terbaca setelah reload. Pool menempatkan SJ pending di atas impor urgent baru. Tidak ada exception JavaScript.

Geolocation Chrome dengan koordinat simulasi -6.2,106.8 dan akurasi 10 m mengembalikan lokasi yang sesuai. Tidak ada perangkat pada `adb devices`; sensor GPS, izin kamera Android, dan kamera fisik APK tidak diuji. Pemilihan gambar menguji jalur file, kompresi, unggah, transaksi penyimpanan, pembacaan ulang dan tampilan gambar secara nyata.

Semua dokumen QA, dokumen foto fallback, dan objek Storage yang dibuat pengujian telah dibersihkan. Tidak ada penugasan operasional yang diubah. Bukti lokal tersimpan pada `.artifacts/photo-pending-2026-11-15/` dan tidak dipublikasikan.
