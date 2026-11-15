# Uji impor Surat Jalan tanpa database

Jalankan `npm run local`, lalu buka http://localhost:3000 dan pastikan banner kuning **MODE UJI LOKAL** muncul. Server hanya mendengarkan di 127.0.0.1. Jangan memakai `python3 -m http.server` untuk pengujian ini karena server tersebut tetap memuat Firebase produksi.

Server lokal memakai dashboard dan importer proyek yang ada, tetapi menghapus SDK Firebase dan Google Maps dari respons HTML. Content Security Policy memblokir koneksi data keluar, pengiriman form, gambar eksternal (termasuk QR eksternal), worker, dan iframe. Endpoint API tidak disajikan; server menolak semua metode selain GET/HEAD. Tidak ada kredensial server atau database yang digunakan.

1. Buka **SJ Pool / Plan Shipment**, lalu **Import SJ** dan pilih banyak file Excel sekaligus (100 file telah diuji dengan data sintetis).
2. Periksa preview, centang Surat Jalan yang diinginkan, lalu simpan ke pool.
3. Centang Surat Jalan di pool, pilih **pbseventeensc** pada dropdown penugasan, lalu klik **Tugaskan**.
4. Periksa pengantaran aktif. Data uji bertahan setelah refresh melalui localStorage browser, dalam namespace `wtrack_sandbox_v1:`. Master Data customer dan bahan memakai namespace persisten terpisah (`wtrack_master_v1:`), sehingga tetap ada setelah **Hapus data uji**. Master lama otomatis dipindahkan saat halaman dibuka. Unduh **backup JSON** sesudah impor/penugasan; backup mencakup customer dan bahan.

Akun pengguna dipetakan oleh master kurir lokal sebagai `pbseventeensc`, UID `uP70R51x7CbR5ggHEyeXfsjSTfO2`. UID ini berasal dari kode proyek, belum diverifikasi dengan Firebase langsung. Penugasan tetap hanya di browser, belum masuk ke akun online atau ponsel. Peta, GPS langsung, API, dan QR dari layanan eksternal tidak tersedia dalam mode ini.

Uji Chrome: 100 file `.xlsx`, masing-masing 1 SJ unik dengan 7 baris barang, menghasilkan 100 SJ dan 700 baris barang. Semua ditugaskan ke UID di atas, tetap lengkap sesudah refresh, dan masuk backup JSON. Tidak ada error JavaScript atau respons Firebase. Nomor SJ duplikat dilewati tanpa mengubah data lama; SJ baru dalam unggahan yang sama tetap dapat disimpan. Kegagalan kuota browser tetap ditolak tanpa mengubah data sebelumnya. Ukuran hasil uji sekitar 201 KB; ukuran file/isi nyata bisa berbeda.

Mode lokal tidak memangkas data menjadi 500 SJ. Jika ruang browser habis, impor/penugasan ditolak dengan pesan jelas. File gagal baca dilaporkan; cocokkan jumlah file berhasil dan jumlah SJ di preview. Preview hanya menampilkan SJ baru. SJ yang sudah pernah diimpor dan duplikat dalam unggahan disembunyikan, termasuk dari pencarian dan rekap wilayah; jumlah yang dilewati tetap ditampilkan di ringkasan. Jika semua duplikat, preview menampilkan keterangan tidak ada SJ baru. Saat menyimpan, nomor SJ diperiksa ulang (abaikan kapitalisasi dan spasi di awal/akhir). Contoh: 10 SJ dengan 6 SJ lama akan menyimpan 4 SJ baru dan melewati 6 duplikat; unggahan seluruhnya duplikat tidak menambah data. Tabel dengan beberapa baris untuk SJ yang sama belum dikelompokkan otomatis: hanya baris pertama yang dapat diimpor, sehingga gunakan satu formulir SJ per file jika SJ memiliki beberapa barang. Simpan Excel asli dan backup; backup JSON untuk arsip dan belum tersedia tombol pemulihan. Menghapus data uji tidak menghapus Master Data, tetapi membersihkan penyimpanan browser secara manual tetap dapat menghilangkannya.

Importer lokal juga memperbaiki deteksi tabel Excel/CSV: tabel dengan kolom No SJ, Customer, dan Nama Barang/Alamat tidak dianggap sebagai formulir cetak hanya karena memuat nomor SJ. Nama pelanggan yang tidak ditemukan tidak lagi diganti nama pelanggan contoh.

File asli `SJ-1126-01287_205421.xls` telah diuji melalui unggah browser, impor, penugasan lokal ke `pbseventeensc`, dan refresh. Format XLS biner terbaca: pelanggan PT TOYS GAMES INDONESIA, tujuan STORE TOYS KINGDOM GRAND INDONESIA, 7 jenis barang. File sumber memiliki Qty 3+2+1+2+1+1+1 = 11, sementara baris TOTAL tertulis 10. Preview lokal menampilkan peringatan dan meminta konfirmasi sebelum menyimpan SJ dengan selisih tersebut; nilai sumber tidak diubah. Selisih tetap dicatat pada data/backup lokal.

## Melihat hasil dari halaman kurir

Buka http://localhost:3000/kurir.html di tab lain pada browser/profil dan komputer yang sama dengan dashboard http://localhost:3000. Gunakan hostname yang sama pada keduanya; `127.0.0.1` dan `localhost` memiliki penyimpanan browser terpisah. Halaman kurir lokal otomatis memakai profil `pbseventeensc`, tanpa login Firebase. Banner dashboard juga menyediakan tautan **Buka kurir lokal**.

Halaman ini memakai `kurir.html` asli dengan SDK Firebase dihapus dan namespace penyimpanan lokal yang sama. Tugas baru muncul lewat sinkronisasi antar-tab; tombol **Muat ulang tugas** membaca ulang data lokal. Uji dua tab dengan XLS asli berhasil menampilkan `SJ-1126-01287` berstatus **In Transit**, bertahan setelah refresh, dan menyembunyikan tugas kurir lain. Tidak ada error JavaScript maupun respons Firebase selama pengujian.

Tautan localhost ini tidak menyinkronkan data ke ponsel atau aplikasi Firebase. Browser ponsel dan komputer memiliki penyimpanan masing-masing; server ini hanya menerima akses dari komputer lokal.

## Uji dari beberapa PC melalui LAN

Untuk sinkronisasi antar-PC, hentikan server lokal yang memakai port tersebut lalu jalankan `npm run local:lan` pada **satu PC server**. Mode ini mendengarkan di `0.0.0.0:3000` dan mencetak alamat IP LAN beserta link dashboard/kurir. Kedua perangkat harus berada di jaringan yang sama. Buka alamat IP PC server pada perangkat lain, bukan `localhost` milik perangkat masing-masing.

Contoh alamat pada saat pengujian:

- Dashboard: http://192.168.1.71:3000/
- Kurir: http://192.168.1.71:3000/kurir.html

Halaman kurir lokal otomatis memakai profil `pbseventeensc`. Pembaruan diambil setiap sekitar 1,5 detik. PC server harus tetap menyala dan proses server tetap berjalan. Jika alamat IP atau port berubah, gunakan link baru yang dicetak server. Untuk port lain, contoh pada macOS/Linux: `PORT=3001 npm run local:lan`; kedua halaman harus memakai port yang sama.

Mode LAN menyimpan daftar SJ **sementara di memori proses Node**, melalui endpoint khusus `/local-sandbox/state`; tidak memakai Firebase, database, atau berkas penyimpanan server. CSP hanya mengizinkan koneksi data ke server uji yang sama. API produksi tetap ditolak. Browser memakai token sesi server, dan perubahan diperiksa versinya: konflik dari PC lain ditolak serta menampilkan data terbaru untuk diperiksa ulang. Jika koneksi putus, halaman menampilkan status kegagalan, bukan menganggap penugasan sudah tersimpan.

Data mode LAN terpisah dari cache mode browser sebelumnya; tidak otomatis mengunggah cache lama. Unduh backup JSON sebelum menghentikan server karena data memori hilang saat server berhenti. Tombol **Hapus data uji** pada mode LAN menghapus data bersama untuk semua perangkat setelah konfirmasi. Koneksi LAN ini belum masuk ke akun Firebase/aplikasi online.

Uji pada IP LAN dengan dua sesi Chrome yang penyimpanannya terpisah berhasil: unggah XLS asli di dashboard, simpan dan tugaskan ke `pbseventeensc`, lalu halaman kurir menerima `SJ-1126-01287` berstatus **In Transit** secara otomatis dan tetap menampilkannya setelah refresh. Tidak ada error JavaScript atau respons Firebase. Uji API memeriksa penolakan perubahan versi lama, token yang tidak valid, origin lain, dan ID tugas duplikat; proses server baru memulai daftar kosong.

Konfigurasi hosting dan database online tidak diubah. Perbaikan importer di direktori `js/` belum disalin ke `public/` atau aplikasi Android dan belum dipublikasikan. Tutup tab dashboard lama dan buka ulang localhost agar halaman lama yang pernah memuat Firebase tidak terpakai.

## Detail line dan estimasi berat di SJ Pool lokal

Klik nomor SJ di pool untuk membuka/menutup tabel item di bawahnya. Kolom detail: Pilih, Line, Nama barang, Size, Qty, Jenis, M2, KG/M2, Total Berat KG. Centang line sebagai catatan kirim parsial; pilihan ini belum memecah tugas/pengiriman dan penugasan tetap per SJ. Pilihan dan jenis/material tersimpan pada item (`poolLine`) dan bertahan setelah refresh/penugasan lokal. Semua line ditampilkan, termasuk yang pernah disembunyikan sebelum fitur Hide dihapus.

M2 dihitung langsung dari pasangan panjang × lebar pada **Size** dikalikan Qty. Size tanpa satuan dibaca dalam meter; tanda x, ×, *, desimal titik/koma, dan satuan eksplisit cm/mm didukung. Kolom P/L manual telah dihapus; data ukuran manual lama tidak lagi dipakai. Size atau qty yang tidak bisa dibaca menampilkan tanda —. Contoh: 1.35 x 0.55 dengan Qty 28 menghasilkan 20,79 M2. Data ukuran dari file tidak diubah.

Database material lokal menyediakan input nama material dan hasil timbang per m² dalam kg. Nama yang sama memperbarui berat material. Pilih material pada kolom **KG/M2**; berat = M2 × KG/M2 ditampilkan pada kolom Total Berat KG paling kanan; M2 hanya menampilkan luas. Total seluruh line yang dicentang tampil di footer tabel pada sisi kanan. Material belum diberikan tidak diganti angka contoh atau nol. Untuk jasa seperti lipat, pilih **Jasa / tanpa berat** secara eksplisit.

Kolom berat pada baris SJ menjumlahkan hanya line yang dicentang. Jika sebagian belum memiliki data lengkap, angka merupakan subtotal yang sudah dapat dihitung dengan jumlah line yang belum dihitung di bawahnya. Master material tersimpan di browser/profil ini pada namespace sandbox; dalam mode LAN, master material belum disinkronkan antar-PC. Backup JSON lokal mencakup `materials` dan catatan line pada `trips`. Fitur ini belum diaktifkan pada halaman online atau disalin ke aset APK.

## Master Data Bahan dari tabel timbang

Refresh dashboard lokal, lalu pilih **Master Data → Bahan** di sidebar. Data awal berasal dari `Tabel_Berat_Material.xlsx`: 61 nama unik (59 bahan utama dan 2 laminasi), dengan konversi sampel 10 × 10 cm konsisten: gram sampel × 100 / 1000 = KG/M2. Data awal diterapkan sekali; bahan dengan nama sama mempertahankan ID/alias dan memakai berat dari tabel. Edit sesudahnya tidak ditimpa saat refresh. Master yang tidak ada di tabel tetap disimpan.

Halaman menyediakan pencarian, tambah/edit bahan, alias satu per baris, status aktif/nonaktif, dan import XLSX/XLS. Import memperbarui nama yang sama tanpa membuat ID ganda. File yang berisi nama duplikat, nilai KG/M2 tidak valid, atau konversi sampel tidak konsisten ditolak sebelum menyimpan. Menonaktifkan bahan tidak menghapus catatan lama; bahan nonaktif tidak dipilih untuk perhitungan baru.

SJ Pool mencocokkan nama item terhadap nama/alias master secara utuh, mengabaikan kapitalisasi dan sebagian variasi ejaan (ACRILYC/ACRYLIC, VYNIL/VINYL). Pilihan manual pada line mengutamakan bahan yang dipilih. Nama tidak cocok atau varian `FLEXY FRONTLITE 380 HALEAD MV TYPE 380` (0,392 KG/M2) dan `TYPE 383` (0,384 KG/M2) memerlukan pilihan manual jika SJ tidak menyebut variannya. Kolom KG/M2 menampilkan bahan yang cocok otomatis dan pilihan untuk menggantinya; berat line muncul di kolom Total Berat KG paling kanan serta dijumlahkan pada footer untuk line yang dicentang.

Laminasi Doft dan Glosy adalah tambahan, bukan pengganti berat bahan utama. Nama barang dengan Laminating Doff/Doft atau Laminasi Doft otomatis memakai Laminasi Doft yang aktif di master; Glossy/Glosy juga didukung. Tulisan Non Laminating / Tanpa Laminasi tidak mendapat tambahan otomatis. Pilihan manual tetap diutamakan: Tanpa tambahan laminasi menyimpan pilihan kosong; Otomatis dari nama barang mengembalikan deteksi otomatis. Laminasi yang belum ada/ambigu/nonaktif menyebabkan berat belum dihitung, bukan dianggap nol. Rumus line dengan laminasi: Size × Qty × (KG/M2 bahan utama + KG/M2 laminasi). Line jasa dipilih sebagai Jasa / tanpa berat. Bahan yang belum cocok ditandai belum dihitung dan subtotal tidak dianggap total lengkap.

Contoh: Art Paper 0,152 KG/M2 pada Size 1,35 × 0,55 dan Qty 28 menghasilkan M2 20,79 dan berat 3,16008 kg. Master lokal disimpan sebagai mock database persisten terpisah dari data uji. Ini hanya untuk localhost dan tidak disinkronkan melalui LAN/Firebase atau dipublikasikan ke Vercel. Saat aplikasi berjalan online, importer customer memakai koleksi Firestore `clients`.

Koreksi nama Type 380 / Type 383 mengikuti konfirmasi gambar pengguna: label lama tanpa TYPE dan `(2)` diperbaiki otomatis di master lokal tanpa mengganti ID, alias, atau berat yang sudah diedit. Import tabel lama dengan label tersebut juga diarahkan ke nama tipe yang benar agar tidak membuat bahan ganda. SJ yang tidak menyebut tipe tetap memerlukan pilihan manual.

Tampilan master bahan memakai tabel lebar penuh, pencarian, filter Semua/Aktif/Nonaktif, dan pagination 10 baris per halaman. Aksi baris memakai ikon pensil (Edit) dan power (Aktifkan/Nonaktifkan), dengan tooltip serta label aksesibilitas. Tombol Tambah Bahan dan ikon Edit membuka dialog, sehingga form tidak menyempitkan tabel. Perubahan ini hanya mengatur antarmuka; ID, berat, alias, serta status master tetap memakai penyimpanan yang sama.

Tabel detail SJ memakai lebar kolom tetap dan teks nama barang membungkus baris. Dropdown bahan dan laminasi berada pada pembungkus terpisah yang disusun vertikal; tombol custom dropdown mengikuti lebar sel, sehingga teks tidak melebar keluar ke kanan. Tabel detail tidak memakai scroll horizontal. Nama barang dibungkus maksimal tiga baris (teks lengkap pada tooltip). Pada panel sempit, line disusun sebagai kartu dengan label kolom agar kontrol tetap terbaca.


Untuk nama `White Paper Board Sticker Vynil Laminating Doff`, White Paper Board disamakan dengan WPB sebagai bahan utama. Sticker Vynil merupakan lapis pelapis terpisah, dan Doft adalah lapis laminasi. KG/M2 menampilkan tiga dropdown bertumpuk (bahan utama, stiker pelapis, laminasi). Rumus berat menjadi M2 × (KG/M2 WPB + KG/M2 Sticker Vynil + KG/M2 Doft). WPB tanpa ketebalan tetap meminta pilihan 3 mm / 5 mm. Stiker dipilih otomatis hanya jika varian yang cocok tunggal; saat ini master memiliki Sticker Vynil Ritrama 0,273 KG/M2. Varian yang tidak ada / nonaktif / ambigu tidak dianggap nol. Sticker Vynil sebagai bahan utama tanpa papan tidak ditambah ulang. Contoh WPB 3 mm + Sticker Vynil + Doft pada 1 m² menghasilkan 0,589 + 0,273 + 0,136 = 0,998 kg.


## Usage — reporting pemakaian bahan dari SJ

Refresh localhost lalu buka sidebar **Usage**. Kalender **Dari–Sampai** membatasi rentang tanggal secara inklusif; tersedia pilihan dasar tanggal **Tanggal SJ** atau **Tanggal Import**, tombol Bulan Ini, dan Semua Tanggal. Tanggal dokumen dipertahankan saat import baru, terpisah dari waktu import. SJ lama tanpa tanggal dokumen sementara memakai tanggal import dan diberi keterangan. Tanggal tidak valid tidak ditebak.

Rekap Bahan mengelompokkan nama item ke master material, menampilkan jumlah SJ, line, M2 bahan, dan berat KG. Detail per SJ menampilkan tanggal, nomor SJ, item, lapis bahan, M2, dan berat. Export Excel menyediakan Rekap Bahan, Detail SJ, serta daftar Belum Cocok bila ada. Pencarian dan filter bahan berlaku pada rekap/detail/export.

Pemakaian produksi dihitung dari seluruh item SJ import, tidak dari status pengiriman atau centang line kirim parsial. WPB + stiker + laminasi menghasilkan tiga kontribusi M2 terpisah sesuai lapisan masing-masing. Bahan yang belum cocok, Size/Qty tidak valid, dan varian belum jelas ditampilkan dalam daftar pemeriksaan. Baris jasa yang dipilih sebagai Jasa / tanpa berat tidak dihitung sebagai bahan. Berat adalah estimasi berdasarkan Size/Qty SJ dan master KG/M2 saat ini; bukan pengukuran stok/timbangan otomatis. Bahan nonaktif tetap bisa dibaca saat reporting riwayat.

Sumber laporan diarsipkan pada `wtrack_material_usage_sources_v1` dalam namespace data uji. Hanya SJ yang berhasil tersimpan yang ditambahkan; nomor SJ yang sama tidak dihitung ganda. Arsip tetap ada saat SJ keluar/dibersihkan dari pool. Pilihan bahan terbaru pada SJ memperbarui arsipnya, dan perubahan alias/master dipakai saat menghitung laporan. Backup JSON lokal mencakup `usageSources`. Arsip tetap per browser dan dapat dihapus bersama data uji; Master Data customer/bahan berada di namespace persisten terpisah, tetapi belum menjadi database online/LAN bersama.

Pemetaan khusus **Sticker Ritrama Ultra Clear White Ink → Sticker Vynil Ritrama** mengikuti permintaan pengguna. Kolom Kode Unik disembunyikan dari tabel pool dan preview import; ID/kode/QR pada data dan cetakan tetap dipertahankan.


## Alur dispatch lokal: alamat, pending, urgent, dan pickup

Dashboard Recent Shipments menyediakan ikon pensil pada setiap tujuan untuk mengedit alamat. Perubahan memakai deliveryId (atau indeks tujuan dengan pemeriksaan identitas), sehingga dua customer dengan stopIndex sama tidak tertukar. Centang lokasi baru untuk mengosongkan koordinat lama; edit teks biasa mempertahankan koordinat.

Kurir lokal memiliki kolom Catatan tambahan pada laporan pending. Note Kurir tampil di SJ Pool, dengan alasan lama sebagai fallback. Ikon segitiga mengubah prioritas menjadi Urgent; filter Urgent menampilkan antreannya. Alasan, note, dan waktu pending tetap disimpan. Pengiriman yang ditugaskan ulang tidak muncul lagi sebagai pending hanya karena memiliki note riwayat.

Ikon paket menandai Pickup by Customer → Menunggu Pickup. Checkbox penugasan kurir dinonaktifkan selama menunggu. Tombol Sudah Diambil membuka konfirmasi nama pengambil (wajib) dan catatan; baru sesudah disimpan SJ menjadi completed dengan waktu pengambilan. Barang belum ready tidak dapat dikonfirmasi. Pickup dapat dibatalkan agar kembali ke antrean kurir. Hasil pengambilan dan nama penerima terlihat pada dashboard.

Ikon hapus penugasan memakai popover kecil dekat tombol dengan konfirmasi dan umpan balik berhasil. SJ beserta item dan note kembali ke pool. Untuk rute banyak tujuan, hanya tujuan terpilih dipisahkan menjadi SJ pool; tujuan lain dan bukti selesai dipertahankan. Tujuan selesai tidak dapat dibatalkan melalui aksi ini. Perubahan baru dinyatakan berhasil setelah penyimpanan lokal/LAN diterima; konflik versi tetap ditolak.

QR cetak SJ dan stiker sekarang mengarah ke Google Maps memakai alamat tujuan, sesuai perubahan permintaan berikutnya. Alamat tujuan diprioritaskan daripada alamat root; koordinat bawaan import Jakarta tidak dipakai untuk QR. Jika alamat tidak tersedia, QR diganti keterangan agar alamat dilengkapi. Generator tetap SVG lokal hitam putih dengan ruang kosong empat modul, ukuran 79 × 79 px (sekitar 21 mm), tanpa bingkai dan dengan kode unik tepat di bawah. Payload Maps lebih panjang daripada nomor SJ; hasil fisik tetap perlu dicoba pada L310. Nomor SJ dan payload WTRACK lama tetap diterima scanner kurir untuk label lama. Modul-modul baru ini belum diaktifkan pada deploy Vercel maupun APK offline.


## Uji ambil tugas melalui scan QR kurir

Import baru tetap di SJ Pool tanpa kurir. QR cetak tetap berupa URL Google Maps dengan alamat tujuan, ditambah identitas SJ pada fragment URL agar scanner dalam halaman kurir mengenali SJ yang tepat. Kamera biasa membuka Maps; scanner kurir mengambil tugas dari Pool untuk akun yang sedang login (uji lokal menggunakan pbseventeensc). Label perlu dicetak ulang setelah perubahan format ini.

Simpan hasil scan ke server lokal/LAN sebelum menampilkan sukses. SJ yang belum ready, pickup customer, sudah selesai atau milik kurir lain ditolak. Scan ulang tugas sendiri tidak mereset status/bukti/timestamp. Pencarian memakai identitas persis, bukan kecocokan sebagian isi alamat. Konfigurasi auto-assign saat import sebelumnya telah dihapus. SJ lama yang telanjur ditugaskan dapat dikembalikan ke Pool melalui Hapus Penugasan di dashboard.


Tombol Navigasi Maps pada kartu tugas dan modal setelah scan membuka Google Maps Directions (`dir_action=navigate`), dengan asal mengikuti lokasi perangkat. Koordinat valid dipakai per tujuan; koordinat placeholder import lama -6.2088,106.8456, titik tidak valid atau yang perlu ditinjau diabaikan dan memakai nama/alamat tujuan. Import baru tidak mengisi koordinat palsu. Tujuan tanpa pin pada rute banyak tujuan tidak mewarisi pin tujuan lain. Jika lokasi sama sekali kosong, tombol dinonaktifkan. Google Maps yang menentukan tampilan navigasi atau pratinjau rute sesuai ketersediaan lokasi perangkat.

## Pilih beberapa titik untuk rute Maps

Pada halaman kurir lokal, centang kartu pengantaran aktif. Panel **Rute pengantaran**
menampilkan urutan sesuai pilihan; gunakan panah naik/turun untuk mengubahnya,
lalu **Navigasi** untuk membuka Google Maps. Lokasi perangkat menjadi titik awal,
pilihan terakhir menjadi tujuan akhir, dan pilihan sebelumnya menjadi persinggahan.
Pemilihan rute tidak mengubah penugasan, status, atau bukti pengiriman.

Untuk mendukung batas browser ponsel, rute dibagi maksimal empat tujuan per tautan
(tiga persinggahan dan satu tujuan akhir), atau lebih sedikit jika batas panjang URL
tercapai. Selesaikan bagian pertama sebelum membuka bagian berikutnya dari lokasi
perangkat saat itu. Batas dan urutan waypoint mengikuti
[dokumentasi Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started).

Pilihan tersimpan selama halaman terbuka, tersinkron antara Home dan Shipments,
dan otomatis dilepas jika tujuan berubah, selesai, atau pindah dari akun kurir.
Titik riwayat dan tujuan tanpa alamat/pin tidak dapat dipilih. Fitur diaktifkan
hanya oleh mode sandbox lokal; belum disalin ke hosting atau dibangun menjadi APK.

Validasi: 150 tes lulus. Uji browser 390 px memeriksa checkbox tanpa membuka kartu,
perubahan urutan, tautan Maps, sembilan tujuan menjadi tiga bagian, dan penghapusan
pilihan saat tugas selesai/dipindahkan. Belum diuji langsung di Google Maps Android.
