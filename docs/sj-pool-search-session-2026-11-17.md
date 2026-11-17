# Pencarian SJ Pool dan sesi admin / kurir

## Perbaikan 17 November 2026

Pencarian Pool sebelumnya menunggu 250 ms, mengganti seluruh DOM Pool, kemudian
memaksa fokus kembali ke akhir input lewat timer lain. Snapshot Firestore yang
datang sebelum timer pencarian selesai memakai query lama. Akibatnya input bisa
terasa lambat, posisi kursor berpindah, dan fokus berpindah kembali setelah admin
mengklik kontrol lain.

Sekarang query disimpan pada setiap input, hasil diperbarui setelah 100 ms,
dan pencarian hanya memperbarui badan tabel serta pagination. Input dan toolbar
tetap dipakai. Render penuh dari snapshot mempertahankan node input dan posisi
seleksi jika input memang sedang aktif, tanpa timer pemaksaan fokus. Pencarian
nomor juga menerima spasi, tanda `#`, dan variasi tanda hubung saat menempelkan SJ.
Filter tanggal, region, branch dan status tetap berlaku.

## Kembali ke login

Admin dan kurir sebelumnya sama-sama menggunakan Firebase app `[DEFAULT]` pada
origin yang sama. Login/logout kurir dapat mengubah sesi dashboard pada tab lain.
Ini merupakan jalur masalah yang ditemukan dalam kode; tidak ada log kejadian
historis dari browser pengguna untuk memastikan pemicu kejadian yang dilaporkan.

Halaman kurir kini memakai Firebase app `wtrack-courier`, termasuk Auth,
Firestore, Storage, pengaturan RTDB jika SDK tersedia, dan token pengajuan servis.
Admin tetap memakai sesi default yang sudah ada. Logout admin tetap berlaku untuk
tab admin lain dan token yang dicabut tetap memerlukan login kembali. Tidak ada
bypass login melalui profil cache.

Tab kurir lama perlu dimuat ulang untuk memakai pemisahan ini; setelah pembaruan,
kurir dapat diminta login satu kali karena namespace sesi berubah. Sesi admin
tidak dimigrasikan atau dihapus. APK baru tidak dibangun; fallback source Android
disinkronkan dengan web.

## Verifikasi

- 257 pengujian Node lolos, termasuk pencarian parsial / format tempel, query saat
  snapshot datang, pembatalan debounce lama, dan logout kurir yang menjaga sesi admin.
- Uji browser dengan 1.200 SJ dan CPU diperlambat 4×: pencarian sekitar 135 ms;
  input, posisi kursor dan fokus tetap sesuai. Tidak ada error JavaScript.
- Sumber utama, `public`, dan fallback Android identik untuk aset yang diubah.
- Vercel production `dpl_G29ANgZmuWQdNzDZ42eAGnsZprmw`: READY,
  https://on-track-indol.vercel.app. Script Pool `20261117.8`, build kurir
  `97dc1647f683390d`.

Referensi perilaku sesi lintas tab:
https://firebase.google.com/docs/auth/web/auth-state-persistence
