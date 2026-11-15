# Grafik pengiriman dari penugasan

Sumber grafik adalah snapshot `trips` pada `allCurrentTrips`, yang juga memuat riwayat. Pool, localStorage online, dan baseline buatan tidak masuk hitungan. Setiap tujuan menghitung satu penugasan; `deliveryId` mencegah penghitungan ulang identitas yang sama. Alamat sama dengan identitas tujuan berbeda tetap merupakan penugasan terpisah. Dokumen tanpa kurir dan pickup customer dikecualikan.

Selesai mengikuti status tujuan `done`, `completed`, atau `delivered`. Status perjalanan hanya menjadi fallback jika tujuan tidak mempunyai status. Foto saja tidak mengubah hitungan selesai. SJ dihitung hanya jika nomor SJ tersimpan; ID perjalanan tidak dianggap nomor SJ.

Tanggal Firestore Timestamp, ISO, dan milliseconds dikonversi ke tanggal WIB. Periode awal/reset adalah Senin–Minggu berjalan; pemilihan tanggal dapat membuka riwayat sebelumnya. Total grafik, breakdown, dan report berasal dari normalisasi penugasan yang sama. Pembaruan master customer merender ulang grafik.

Klien dicari dari alamat master yang sama setelah normalisasi huruf/spasi/tanda baca. Jika beberapa nama berbagi alamat, nama tujuan harus cocok agar nama klien bisa dipilih. Jika belum cocok, alamat ditampilkan tanpa tebakan nama.

Verifikasi 15 November 2026: snapshot online berisi 259 perjalanan dan 3.191 customer. Periode 9–15 November: 661 tujuan, 603 selesai, 20 kurir. Senin 24/24, Selasa 67/67, Rabu 163/153, Kamis 133/131, Jumat 129/112, Sabtu 118/97, Minggu 27/19. Angka ini adalah snapshot pengujian, bukan konstanta aplikasi.

183 tes Node lulus. Chrome DevTools Protocol memeriksa versi halaman online dengan snapshot database asli yang diberikan melalui fungsi sinkronisasi aplikasi, kesamaan total grafik/breakdown, filter tanggal/kurir, screenshot 1440 dan 390 px, serta exception JavaScript. Pengujian ini tidak melakukan login akun atau menulis database. Bukti lokal tersimpan di `.artifacts/volume-sync/` dan tidak dipublikasikan.
