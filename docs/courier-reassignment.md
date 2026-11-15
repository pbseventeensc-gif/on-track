# Pemeriksaan switch penugasan dan Fleet Inventory

APK yang diperiksa: `KurirKita-Terbaru.apk`, SHA-256
`142667ef8d5ee253c038580e34b6a370d1cdf7cb398e5735e10d57ce8e9f556a`.
Inventaris REA: `ev_b77d8250bc2f6b1a7d395034e3b2dd2776dbb20b1adb0a07c186c7a4a56bc4ba`.
Inventaris ini menetapkan identitas paket, bukan perilaku saat dijalankan.

Pemeriksaan statis terpisah menggunakan JADX pada kelas APK
`com.KurirKita.MainActivity` menemukan `WebView.loadUrl` menuju
`https://on-track-indol.vercel.app/kurir.html`, dengan fallback
`file:///android_asset/kurir.html` saat halaman utama gagal dimuat.
Dengan koneksi internet, APK tersebut menggunakan halaman kurir online.
APK yang terpasang pada ponsel pengguna belum dicocokkan langsung.

Halaman kurir berlangganan snapshot Firestore dan membangun ulang daftar
pengantaran. ID penugasan eksplisit sekarang mengalahkan nama, plat dan metadata
destinasi lama, sehingga pengiriman yang dipindahkan tidak tetap terlihat pada
kurir asal. Cache impor lokal juga tidak boleh menambahkan kembali trip yang
sudah ditemukan di Firestore. Uji simulasi snapshot memeriksa perpindahan dari
kurir asal ke kurir pengganti; belum diuji langsung pada dua ponsel.

Fleet Inventory memakai daftar master dan profil akun driver terbaru untuk
pilihan tambah/edit, termasuk Firdaus dan driver baru yang memiliki role driver.
Riski/Rizki dikeluarkan khusus dari daftar inventaris. Relasi driver pada
kendaraan lama dikosongkan ketika inventaris dibaca; kendaraan, pajak, servis,
akun Firebase dan riwayat pengiriman dipertahankan. Penyimpanan inventaris
masih menggunakan localStorage per browser sesuai implementasi sebelumnya.

Validasi: seluruh 115 tes lulus, termasuk simulasi perpindahan tugas pada halaman
kurir online dan aset Android, nama driver terbaru dan migrasi inventaris lama.

Pemeriksaan lanjutan Live Tracking: snapshot Firestore mengalihkan kartu asal ke
penerima untuk switch seluruh trip, serta memperbarui jumlah tugas, total titik,
progres selesai dan pending pada kedua kartu untuk switch sebagian. Pembaruan
ini tidak memerlukan event GPS baru. Filter pencarian dipertahankan saat
snapshot menggambar ulang kartu. Seluruh 124 tes lulus setelah perubahan ini.
Pengujian kartu menggunakan simulasi snapshot dengan data uji, bukan perpindahan
penugasan operasional atau pengamatan langsung pada dua perangkat.
