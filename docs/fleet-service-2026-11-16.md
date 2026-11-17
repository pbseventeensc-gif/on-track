# Pengajuan servis armada — 16 November 2026

Aplikasi kurir memiliki menu **Pengajuan Servis Kendaraan** pada Beranda. Menu
tersedia setelah server memverifikasi akun driver dalam master, custom claim
`role` driver, atau UID personel yang ditugaskan pada Fleet Inventory. Penugasan
canonical/nama master juga dikenali. Akun `pbseventeensc` diberi pengecualian
khusus melalui UID tetap untuk pengujian; pengajuannya ditandai **Akun testing**.
Role akun pengantaran dan hak login yang sudah ada tetap digunakan.

Pemohon memilih kendaraan, memasukkan keluhan minimal 10 karakter, kilometer
opsional, serta 2–6 foto berbeda. Foto bisa ditambahkan bertahap dan dihapus
sebelum dikirim. JPEG/PNG/WebP maksimal 10 MB per sumber dikompres di browser
menjadi JPEG maksimal 180 KB. Form dan foto tetap tersedia saat pengiriman gagal,
dan pembaruan otomatis halaman menunggu sampai tidak ada draft servis. APK
mendukung pemilihan beberapa foto melalui pemilih file Android.

Dashboard Fleet Inventory menampilkan panel **Pengajuan Servis Driver**, termasuk
keluhan, foto yang dapat diperbesar, jumlah pengajuan menunggu, dan tombol
Setujui/Tolak. Penolakan wajib memiliki alasan. Status dan catatan tampil pada
riwayat pemohon; daftar diperbarui saat dibuka, dimuat ulang manual, atau setiap
30 detik ketika halaman aktif. Maksimal 100 pengajuan terbaru ditampilkan.
Persetujuan pengajuan tidak menandai pekerjaan bengkel selesai dan tidak membuat
log riwayat servis selesai secara otomatis.

## Data dan izin

`api/fleet-service.js` memverifikasi ID token Firebase beserta pencabutan sesi,
menolak akun anonim/nonaktif, dan menjalankan `lib/fleet-service.cjs`.
`FIREBASE_SERVICE_ADMIN_UIDS` adalah daftar UID Super Admin yang ditetapkan di
server. Custom claim `super_admin`/`superadmin` juga diperbolehkan. Role dari
browser atau dokumen profil yang dapat diedit tidak memberikan hak persetujuan.
Daftar admin server disiapkan dari akun pengelola tepercaya yang sudah ada;
akun testing pemilik proyek mempertahankan akses pengelolaan yang sudah ada.

Koleksi `fleet_service_requests`, `fleet_service_photos`, dan
`fleet_service_config` tidak dapat dibaca/ditulis langsung dari SDK client.
Seluruh akses melalui API yang memeriksa pemilik atau Super Admin. Foto tersimpan
sebagai dokumen terpisah tanpa URL publik; isi foto dikecualikan dari indexing.
Permintaan dan semua foto ditulis dalam satu transaksi. ID draft tetap membuat
percobaan ulang tidak menggandakan pengajuan. Transaksi persetujuan hanya dapat
memproses status `pending` satu kali.

`config/fleet-service.json` menyimpan master UID, pengecualian testing, dan metadata
awal armada. Dashboard menyinkronkan metadata armada ke registry server dengan
nomor versi. Konflik antarperangkat tidak ditimpa otomatis; admin meninjau data
lokal sebelum menekan **Muat ulang & sinkronkan armada**. Nomor telepon dan rincian
riwayat servis tidak disalin ke registry pengajuan. Driver baru yang belum masuk
master atau belum ditugaskan pada armada memerlukan custom claim driver dari
pengelola server.

Akun layanan server memerlukan izin `datastore.databases.get` untuk transaksi,
selain izin operasi entitas Firestore yang sudah tersedia. Izin tambahan ini
dipasang pada custom role layanan yang sudah ada. Rujukan: [Firebase IAM](https://firebase.google.com/docs/firestore/security/iam).

## Pemasangan baru

Pengguna APK yang sudah terpasang cukup menutup lalu membuka aplikasi saat
online untuk menerima fitur servis dari Vercel. Installer berikut tersedia
untuk pemasangan baru.

Versi APK `1.1`, versionCode `2`; sertifikat penandatanganan sama dengan APK lama.
Aset web canonical disalin ke `public` dan aset APK lewat
`scripts/sync-web-assets.cjs`. Build dan salin installer sebelum deployment:

```sh
node scripts/sync-web-assets.cjs
./gradlew :app:assembleDebug
cp app/build/outputs/apk/debug/app-debug.apk KurirKita-Servis-1.1.apk
cp KurirKita-Servis-1.1.apk public/KurirKita-Servis-1.1.apk
```

`download.html` dan QR-nya mengarah ke installer tersebut. `.vercelignore`
memperbolehkan hanya installer baru ini dari semua file APK yang biasanya
dikecualikan. File biner tetap tidak dimasukkan ke Git.

## Validasi

- `npm test`: 219 tes lulus, termasuk akses driver/testing, foto wajib dan unik,
  transaksi gagal, retry, izin persetujuan, konflik keputusan/registry, pembacaan
  foto, escaping, dan perlindungan draft dari reload.
- Emulator Firestore: 18 pemeriksaan koleksi servis dan 14 pemeriksaan regresi
  penanda penghapusan akun lulus.
- Browser mobile 390 px dan dashboard desktop: pemilihan foto bertahap, kompresi,
  gagal-kirim/retry tanpa kehilangan form, satu pengajuan tersimpan, pembacaan
  foto, persetujuan dan catatan kembali ke driver, serta menu tersembunyi untuk
  kurir biasa lulus.
- Build Android berhasil; isi `assets/js/fleet_service.js` pada APK cocok dengan
  source, dan sertifikat APK cocok dengan installer sebelumnya.

Bukti QA disimpan di `.artifacts/fleet-service-2026-11-16/`, dikecualikan dari
Git dan deployment.

## Hasil deployment

Produksi diperbarui di https://on-track-indol.vercel.app/ dengan deployment
`dpl_2DqT3Ru8orYLsSbFSXKxS4s3RRq4`. Installer tersedia di
https://on-track-indol.vercel.app/KurirKita-Servis-1.1.apk dan halaman
https://on-track-indol.vercel.app/download.html. Ukuran APK 36.704.337 byte,
SHA-256 `618fd73344e23d5f12c834c6f36cc584779bfba908bbdafee56cbba2eba048ff`.

Uji langsung server menggunakan akun testing yang diminta berhasil: dua foto
tersimpan, retry ID sama menghasilkan satu pengajuan, daftar Super Admin dan
pemohon dapat membacanya, foto memerlukan akses pemilik/admin, serta persetujuan
akun Super Admin tampil kembali ke pemohon. Akses Firestore langsung ditolak dan
installer dapat diunduh. Satu contoh pengajuan berlabel **Akun testing**
dipertahankan dengan catatan bahwa tidak ada kerusakan atau instruksi bengkel
nyata. Pengajuan percobaan awal milik pengujian ini beserta fotonya dibersihkan.

Kredensial server sempat tercetak pada keluaran alat ketika memeriksa format
konfigurasi. Kunci pengganti sudah dipasang sebagai Secret di Vercel, layanan
sudah diverifikasi, kunci lama dicabut melalui IAM, dan salinan kredensial lokal
yang dipakai selama pekerjaan dihapus. Kredensial tidak dimasukkan ke Git atau
aset publik.
