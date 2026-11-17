# Pembaruan otomatis aplikasi driver — 16 November 2026

Pengguna APK yang sudah terpasang menerima fitur servis dari Vercel. Cukup tutup
lalu buka aplikasi saat online, tanpa mengunduh atau memasang APK lagi. APK lama
sudah memuat `https://on-track-indol.vercel.app/kurir.html` melalui WebView.

Pengecekan versi dijalankan pada `pageshow` saat halaman dibuka atau dipulihkan,
saat kembali terlihat, saat koneksi pulih, dan setiap 60 detik. Build berbeda
memicu reload halaman. Form servis yang belum dikirim, foto yang sedang dipilih,
dan modal bukti tetap menunda reload sampai aman. Sesi login tidak dihapus.

Header Vercel menetapkan `no-store` untuk halaman kurir dan metadata versi,
serta revalidasi JavaScript pada setiap pemuatan. `download.html` menjelaskan
pembaruan otomatis untuk pengguna lama; tombol unduh menjadi pilihan pemasangan
baru, dan unduhan tidak dimulai otomatis.

Validasi: 225 tes otomatis lulus. Uji browser berhasil untuk halaman lama yang
berpindah build saat dibuka, kembali dari latar, kembali online, perlindungan
draft, tutup/buka halaman, dan retensi sesi; tidak ada unduhan APK. Bukti ada di
`.artifacts/courier-auto-update-2026-11-16/`.

Deployment produksi selesai di https://on-track-indol.vercel.app/ dengan build
kurir `c6d0274daffed8e5`. Verifikasi langsung `/kurir`, `/kurir.html`, metadata
versi, JavaScript pembaruan, dan halaman unduhan lulus. Header cache produksi
sesuai konfigurasi, script dan build cocok dengan source lokal, serta halaman
unduhan tidak lagi memicu pemasangan APK secara otomatis.
