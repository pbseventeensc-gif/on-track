# Penghapusan akun kurir dan driver

## Pemakaian

Pada pengaturan dashboard, **Kelola Akun Kurir & Driver** memiliki tombol
**Hapus Akun**. Admin mengetik nama yang ditampilkan untuk mengonfirmasi.
API memverifikasi ID token Firebase beserta pencabutan sesi dan mencocokkan UID
admin dengan daftar server, bukan role dari browser atau profil Firestore.

Environment `FIREBASE_ACCOUNT_ADMIN_UIDS` produksi mencakup superadmin, admin
logistik, dan pemilik proyek pbseventeensc. Akun admin dan akun sendiri dilindungi
dari penghapusan. Tombol dinonaktifkan bila sesi tidak memiliki izin atau API
belum tersedia.

Target yang boleh dihapus tercantum di `config/courier-accounts.json`, termasuk
alias UID lama Rizki dan Jay. Akun baru perlu didaftarkan di konfigurasi server.
Erwin tetap tercantum **hanya pada konfigurasi server** agar cleanup dapat
diulang, tetapi sudah dihapus dari daftar UI dan pembentukan profil otomatis.

## Proses server

`api/delete-courier.js` memakai Firebase Admin SDK dan `lib/delete-courier.cjs`:

1. Pasang penanda penghapusan Firestore.
2. Nonaktifkan akun Authentication dan cabut refresh token, jika akun masih ada.
3. Pasang penanda RTDB `_deleted_accounts/{uid}` dan hapus lokasi aktif.
4. Hapus profil `users/{uid}` beserta alias canonical.
5. Hapus akun Authentication dan tandai proses `completed`.

Riwayat pengiriman, chat, foto, dan laporan tidak dihapus. Penanda hanya menyimpan
status, waktu, dan UID admin. Client tidak dapat mengubahnya atau membuat ulang
profil yang memiliki penanda. Penanda RTDB memblokir UID termasuk token lama.

Proses lintas layanan tidak atomik. Kegagalan menghasilkan HTTP 503 dan penanda
`failed`, tanpa mengklaim sukses. Admin dapat menekan Hapus Akun lagi untuk
melanjutkan. Akun Authentication yang sudah tidak ada dianggap telah dibersihkan.

## Server dan status deployment

Environment Vercel khusus production:

- `FIREBASE_SERVICE_ACCOUNT_JSON`: kredensial server JSON, disimpan terenkripsi.
- `FIREBASE_ACCOUNT_ADMIN_UIDS`: UID admin tepercaya, dipisahkan koma.

Identitas server khusus:
`wtrack-account-delete@ontrack-fccb8.iam.gserviceaccount.com`.
Custom role `projects/ontrack-fccb8/roles/wtrackAccountDeletion` memberi izin
get/update/delete pengguna Authentication, operasi entitas Firestore, dan
get/update Realtime Database. Tidak ada izin mengubah IAM atau security rules.
Rotasi kunci dilakukan melalui IAM dan pembaruan environment Vercel.
Jangan menaruh kredensial server pada kode atau folder publik.

Rules Firebase sudah diterapkan. Profil Erwin dan lokasi aktifnya sudah dihapus,
penanda `completed` dipasang; akun Authentication-nya memang sudah tidak ada.
Backup profil ada di `.artifacts/firebase-security-2026-11-11/`, dikecualikan dari
Git dan Vercel.

Deployment webapp **belum dijalankan**: perintah deployment Vercel ditolak oleh
izin eksekusi. Environment production sudah disiapkan. Sesi Vercel pbseventeensc
berada di `/tmp/wtrack-vercel-pbseventeensc`, terpisah dari sesi akun lain.
Jalankan dari folder proyek untuk menerapkan:

```sh
npx vercel deploy --prod --yes --global-config /tmp/wtrack-vercel-pbseventeensc
```

Sesudah deployment, periksa API tanpa token menghasilkan 401, login sebagai
admin pengelola, dan pastikan tombol tersedia. Penghapusan melalui antarmuka
dashboard belum diuji. Jangan gunakan akun staf aktif sebagai data uji.

## Validasi

- `npm test`: 5 tes backend untuk otorisasi, target terlarang, alias, penghapusan
  berulang, mempertahankan trips, serta kegagalan parsial.
- `node scripts/test_database_rules.cjs`: 81 pemeriksaan emulator RTDB lokal
  pada port 19000.
- `node scripts/test_firestore_deletion_rules.cjs`: 14 pemeriksaan emulator
  Firestore lokal pada port 18080, termasuk pencegahan pembuatan ulang profil.
- Pemeriksaan sintaks JavaScript dan `git diff --check`.

Rules Firestore masih mempertahankan akses publik lama selain pembatasan
penghapusan di atas. Pekerjaan ini tidak menyelesaikan seluruh akses
Firestore/Storage.
