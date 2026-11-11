# Akses internal Realtime Database

Database: `ontrack-fccb8-default-rtdb` (Asia Southeast 1).

Pada 11 November 2026, rules produksi diperbarui menggunakan `database.rules.json`.
Daftar izin berisi 27 UID akun aktif dengan email yang diperiksa melalui Firebase
Authentication saat perubahan ini dibuat. UID dicocokkan secara eksplisit;
membuat akun baru atau login anonim tidak memberikan akses otomatis.

Sesuai kebutuhan operasional saat ini, semua akun dalam daftar tetap boleh
membaca dan mengubah cabang data operasional Realtime Database. Penulisan ke
root dan cabang `_deleted_accounts` ditolak untuk klien. Penanda pencabutan akses
ini hanya bisa ditulis server. UID yang ditandai kehilangan akses meskipun
masih mempunyai ID token yang belum kedaluwarsa.
Ini merupakan pembatasan keanggotaan internal, bukan pembatasan per role/kurir.
Jangan memakai role dari browser atau profil Firestore yang dapat diubah klien
sebagai dasar pemberian akses.

## Menambah atau mencabut akses

- Tinjau akun dan UID melalui Firebase Console → Authentication → Users.
- Tambahkan atau hapus kondisi `auth.uid === 'UID'` pada **kedua** ekspresi
  `.read` dan `$node/.write` di `database.rules.json`.
- Untuk membuat ulang daftar dari ekspor akun yang sudah disetujui:
  `node scripts/build_database_rules.cjs /path/to/reviewed-auth-export.json`.
  Generator memasukkan semua akun aktif dengan email dari ekspor tersebut;
  jangan memakai ekspor yang belum ditinjau karena akun tak dikenal dapat ikut
  memperoleh izin. Jangan commit ekspor Authentication yang berisi hash password.
- Uji rules sebelum menerapkan. Deploy khusus Realtime Database melalui
  `firebase deploy --only database --project ontrack-fccb8` jika Firebase CLI
  tersedia, atau salin `database.rules.json` ke Rules pada database yang tepat.
- Verifikasi hasil publish dan uji login admin/kurir. Akun baru tidak dapat
  menggunakan Realtime Database sampai UID-nya dimasukkan dalam daftar.

## Pengujian

Jalankan emulator Realtime Database pada `127.0.0.1:19000`, kemudian:

```sh
node scripts/test_database_rules.cjs
```

Tes menggunakan namespace lokal `demo-wtrack-rules`, memasang rules lokal, dan
menguji baca/tulis/hapus di root, lokasi kurir, serta pengaturan. Tes ini tidak
terhubung ke database produksi. Ada 81 pemeriksaan: akses admin/kurir melalui
password/Google diizinkan; tanpa login, UID di luar daftar, dan provider anonim
ditolak; akun aplikasi tidak dapat mengganti security rules maupun penanda pencabutan.

Sesudah publish, rules server dicocokkan dengan file lokal. Pemeriksaan baca
langsung di produksi juga memastikan akses publik, UID di luar daftar, dan sesi
anonim ditolak, sedangkan identitas admin dan kurir dalam daftar diizinkan
(menggunakan auth override dengan kredensial pengelola, tanpa menulis data).
Login langsung melalui antarmuka aplikasi belum diuji.

## Backup dan cakupan

Backup sebelum perubahan tersimpan secara lokal di
`.artifacts/firebase-security-2026-11-11/` dan dikecualikan dari Git. Jangan
memublikasikan backup karena berisi data operasional. Rules lama dalam backup
memberikan akses publik; gunakan hanya sebagai referensi, bukan dipulihkan
tanpa meninjau konsekuensinya.

Rules Firestore kemudian diperbarui khusus untuk melindungi `account_deletions`
dari penulisan klien dan mencegah profil pengguna yang sudah dihapus dibuat ulang.
Akses publik lain di Firestore belum diperketat. Storage belum diubah.
Lihat `docs/courier-account-deletion.md` untuk fitur penghapusan akun.
