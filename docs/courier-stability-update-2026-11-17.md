# Stabilitas aplikasi kurir, navigasi, dan pembaruan web — 17 November 2026

## Gejala yang dilaporkan

1. Aplikasi kurir kadang tertutup atau terasa keluar sendiri.
2. Penugasan tiba-tiba hilang lalu muncul lagi.
3. Tombol navigasi Maps tidak berjalan.
4. Ingin pembaruan fitur tanpa memasang APK baru terus-menerus.

## Penyebab yang ditemukan

- **Build hash pembaruan mencakup seluruh file `js/`.** Setiap deploy dashboard admin mengubah hash, sehingga semua halaman kurir menganggap ada versi baru dan memuat ulang WebView. Reload ini terlihat seperti aplikasi keluar dan daftar tugas sempat kosong.
- **Reload bisa terjadi di layar tugas aktif.** Pemeriksaan versi hanya melihat form/modal, bukan layar yang sedang dibuka.
- **Snapshot Firestore dari cache/offline langsung mengganti `masterShipments`.** Snapshot kosong sementara membuat daftar tugas hilang, lalu snapshot server berikutnya memunculkannya lagi.
- **Beberapa listener Firestore dibuat ulang** saat Firebase Auth memulihkan sesi, menambah peluang daftar kosong sementara.
- **Link navigasi memakai `target="_blank"`.** Android WebView tanpa multi-window mengabaikan link tersebut, sehingga tombol Maps tidak bereaksi.
- **URL Google Maps tidak diarahkan ke aplikasi Maps.** APK lama membuka link di WebView; APK baru kini memakai intent Maps.
- **Fallback offline tidak punya mekanisme kembali online.** Halaman fallback bisa tertahan dalam kondisi lama.
- **Tombol back Android langsung menutup Activity** saat WebView tidak punya riwayat.

## Perubahan yang diterapkan

### Pembaruan web tanpa APK

- `scripts/courier-build.cjs` menghitung hash **hanya dari aset kurir**: `kurir.html`, `delivery_identity`, `maps_destination`, `courier_admin`, `qr_claim`, `fleet_service`, `courier_route`, dan `courier_updates`.
- Perubahan `js/app.js` atau modul admin lain **tidak lagi memicu reload kurir**.
- `courier_updates.js`:
  - hanya reload saat halaman berada di **Home/Login** dan tidak ada modal/form aktif,
  - menampilkan overlay **“Memperbarui aplikasi…”** sebelum reload,
  - menampilkan banner jika pembaruan tertunda,
  - menyimpan percobaan versi di `sessionStorage` untuk mencegah reload berulang,
  - tetap memeriksa saat `pageshow`, kembali terlihat, online, dan setiap 60 detik.
- Halaman kurir tetap dimuat dari `https://on-track-indol.vercel.app/kurir.html`; perubahan HTML/JS berikutnya langsung aktif saat aplikasi dibuka online, tanpa memasang APK baru.

### Penugasan tidak hilang/berkedip

- Snapshot `fromCache` yang kosong atau lebih lama **tidak menimpa daftar tugas** yang sudah terlihat.
- Snapshot server yang sudah terkonfirmasi tetap dapat mengosongkan daftar setelah tugas dipindahkan/selesai.
- Listener Firestore tidak dibuat ulang untuk kurir yang sama, mengurangi daftar kosong sementara.
- Logout membersihkan listener, kunci langganan, dan daftar tugas.

### Navigasi Maps

- Semua link navigasi diubah dari `target="_blank"` menjadi `target="_self"` + `openMapsNavigation()`.
- APK lama: link dibuka di WebView yang sama sehingga tombol tidak lagi mati.
- APK baru: `AndroidBridge.openExternal()` membuka aplikasi Google Maps native.
- `MainActivity` menangani intent `google.com/maps`, `maps.google.com`, `geo:`, `google.navigation:`, `tel:`, dan WhatsApp.
- `setSupportMultipleWindows(true)` + handler popup membuka link target baru secara eksternal.

### Ketahanan APK

- `onRenderProcessGone` memuat ulang WebView jika renderer Android crash, bukan menutup aplikasi.
- `onReceivedError` mencoba ulang sekali, lalu memakai halaman offline yang menyuntikkan tombol/pemantau online untuk kembali ke halaman remote.
- `onPageFinished` mengaktifkan pemulihan otomatis saat koneksi kembali.
- Tombol back Android memanggil `window.kurirHandleBack()`: menutup modal, keluar dari scanner, atau kembali ke Home sebelum Activity ditutup.
- `onPause`/`onResume`/`onDestroy` WebView dirapikan untuk mengurangi pemakaian memori.

## Kompatibilitas APK lama

Perbaikan web (build hash, reload aman, snapshot, link Maps `target=_self`) langsung berlaku pada APK yang sudah terpasang karena halaman dimuat dari Vercel.

Perbaikan native berikut memerlukan **satu kali pemasangan APK baru** dan setelah itu pembaruan web tidak perlu APK lagi:

- membuka Google Maps langsung di aplikasi Maps,
- pemulihan renderer WebView,
- penanganan tombol back yang lebih baik,
- fallback offline dengan tombol “Coba lagi”.

## Verifikasi

- `npm test`: **239 tes lulus**.
- Tes baru:
  - build hash hanya berubah untuk aset kurir,
  - reload tidak terjadi di layar tugas aktif,
  - build stamp lama tidak menyebabkan reload berulang,
  - snapshot cache kosong tidak menghapus tugas,
  - snapshot server tetap dapat mengosongkan tugas setelah transfer,
  - link Maps tidak lagi `target="_blank"` dan memakai bridge native saat tersedia.
- `./gradlew :app:compileDebugKotlin --offline`: **BUILD SUCCESSFUL**.
- Verifikasi produksi dan deployment dicatat setelah deploy.

## Deployment produksi

- Tanggal: 17 November 2026
- Project: `pos-ec42/on-track`
- Deployment ID: `dpl_5JAVG7omjJvPqLp8hKEc6JhciAtU`
- URL deployment: https://on-track-axbcd6mfn-pos-ec42.vercel.app
- Alias produksi: https://on-track-indol.vercel.app
- Status: `READY`, build 20 detik, total siap 46 detik
- Build kurir: `f3e99958f8e4516e`
- Verifikasi produksi:
  - `/kurir` dan `/assets/app-version.json` → 200, `cache-control: no-store`
  - build di halaman sama dengan metadata versi
  - `target=_self` dan `openMapsNavigation` aktif
  - `window.kurirHandleBack` dan `window.CourierUpdates` tersedia
  - tidak ada error JavaScript pada smoke test 390 px
- Deployment ini memuat perbaikan web; APK lama otomatis memakainya saat membuka halaman online. Perbaikan native memerlukan APK berikutnya.
