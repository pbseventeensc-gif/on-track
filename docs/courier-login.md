# Pemilihan akun pada login kurir

Ketik minimal dua karakter nama, username atau email. Jika hanya satu akun
cocok, kartu akun dapat diklik atau dipilih dengan keyboard untuk melengkapi
email. Pemilihan mengosongkan password lama dan memindahkan fokus ke password;
pemilihan kartu tidak melakukan login. Potongan yang ambigu menunggu karakter
tambahan. Dua puluh email akun master dicocokkan dengan Firebase Authentication
sebelum dimasukkan ke metadata pilihan; password tidak dibaca atau diubah.

Login email/password hanya membuka aplikasi setelah Firebase berhasil
memverifikasi kredensial. Password kosong, autentikasi gagal, Firebase tidak
tersedia dan pembatalan Google tidak boleh masuk melalui profil cadangan.
Profil yang tersimpan di localStorage juga membutuhkan sesi Firebase yang valid
dan UID yang sesuai. Sesi autentikasi tersimpan tetap didukung.

Perubahan diterapkan pada halaman utama, `public/kurir.html` untuk hosting dan
aset Android. APK yang memuat halaman online menerima pembaruan setelah halaman
dimuat ulang; file APK tidak dibangun ulang pada perubahan ini.

Validasi: 142 tes lulus, termasuk pemilihan kartu, potongan ambigu, akun pensiun,
password kosong, autentikasi ditolak, jaringan gagal, profil cache dan pembatalan
Google. Alur login diuji dengan mock Firebase, bukan password pengguna asli.
