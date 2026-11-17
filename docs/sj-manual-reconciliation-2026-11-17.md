# Sinkronisasi SJ Pool dengan pengiriman manual

## Tujuan

Pengiriman yang dibuat lewat **Manual Dispatch** kadang tidak memakai form import SJ.
Fitur **Sinkronkan SJ** mencocokkan tujuan manual tersebut dengan SJ yang masih ada di
SJ Pool. Hanya pasangan yang aman yang boleh dipindahkan; pengiriman perusahaan lain
tidak disentuh.

## Skema data

### Trip manual (`trips/{tripId}`)

```text
destinations[]:
  deliveryId
  clientId          // dari Master Customer untuk pengiriman baru
  storeId           // kunci toko yang dinormalisasi
  locationName
  address
  noSJ / sjNumber   // kosong sampai hasil sinkronisasi
  sjTripId          // dokumen SJ import yang dipakai
  sjMatchedAt
  sjMatchRule       // storeKey
```

Pengiriman manual baru dari pemilihan customer sekarang ikut menyimpan
`clientId` dan `storeId` pada antrean tujuan.

### SJ import (`trips/{importTripId}`)

Sudah memiliki `noSJ`, `customer`/`clientName`, `storeDestination`, `address`,
`sourceFile`. Import baru juga menulis `clientId` dan `storeId`.

### Alias toko (`delivery_point_aliases/{aliasKey}`)

```text
aliasKey       // nama toko manual yang dinormalisasi
storeKey       // kunci toko SJ import
noSJExample
updatedAt
```

Alias dipakai saat nama toko manual berbeda dari nama di Excel, misalnya
`Gyu-Kaku MKG` → `GYUKAKU MALL KELAPA GADING 3`. Alias dibuat sekali lewat
tombol **Hubungkan** dan dipakai untuk pencocokan berikutnya.

### Audit (`sj_reconciliations/{id}`)

```text
noSJ, manualTripId, deliveryId, poolTripId, matchKey, matchedAt, source
```

## Aturan pencocokan

1. Hanya SJ yang masih **Pool** dan belum punya kurir.
2. Hanya tujuan manual yang belum memiliki `noSJ`/`sjNumber`.
3. Nama toko dinormalisasi: huruf kecil, tanda baca/spasi dirapikan,
   prefix `STORE`/`TOKO` dan catatan `UP : ...` dibuang.
4. Satu tujuan manual hanya boleh mendapat **satu SJ**.
5. Satu SJ hanya boleh dipakai untuk **satu tujuan**.
6. Jika satu toko memiliki beberapa SJ, statusnya **ambigu** dan tidak
   diterapkan otomatis; admin memilih nomor SJ yang benar.
7. Jika nama toko berbeda, admin menekan **Hubungkan**, memasukkan nomor SJ,
   lalu alias disimpan. Setelah itu pasangan dapat diterapkan.
8. Semua status ditampilkan lebih dulu; tidak ada perubahan sebelum tombol
   **Terapkan** ditekan.

## Hasil penerapan

- `noSJ`/`sjNumber` ditempel ke tujuan manual; dashboard menampilkan nomornya.
- Dokumen SJ di Pool dihapus.
- `sj_import_keys` diarahkan ke trip manual agar SJ tidak diimpor ganda.
- Nomor SJ tetap dapat dipakai lagi jika trip manual dihapus, karena jalur hapus
  membersihkan key berdasarkan nomor SJ di root maupun tujuan.
- Pool berkurang sesuai jumlah pasangan yang diterapkan.

## Kondisi data saat fitur dibuat

- SJ Pool: **416** (dinamis; 413 dengan `importedAt` hari ini).
- Tujuan manual hari ini: **158** (15 trip, termasuk yang sudah selesai).
- Preview exact match: **15 cocok**, **5 ambigu**, **138 tidak cocok**.
- 138 tidak cocok bukan berarti gagal: sebagian adalah pengiriman perusahaan
  lain, sebagian perlu alias karena nama toko manual lebih pendek.

Fitur ini menampilkan angka tersebut secara transparan. Admin dapat membuat
alias untuk pasangan yang benar-benar sesuai; SJ yang tidak punya pasangan tetap
di Pool.

## Cara pakai

1. Buka **Delivery Order → Sinkronkan SJ**.
2. Pilih tanggal pengiriman manual (default hari ini).
3. Periksa baris **Cocok**; hilangkan centang jika tidak ingin diterapkan.
4. Untuk baris **Ambigu**, pilih salah satu nomor SJ.
5. Untuk baris **Tidak cocok** yang sebenarnya pasangan kita, klik **Hubungkan**
   dan masukkan nomor SJ acuan; alias akan disimpan.
6. Klik **Terapkan N SJ**. Pool langsung berkurang dan dashboard menampilkan
   nomor SJ.

## Verifikasi

- Unit test inti: normalisasi toko, match unik, ambigu, alias, satu SJ tidak
  boleh dipakai dua tujuan, dan baris tanpa toko/alamat tidak cocok.
- Uji browser sandbox: match otomatis, penerapan, pengurangan Pool, dan
  penyimpanan alias berhasil.
- Preview dengan data produksi (read-only): 416 Pool, 158 tujuan manual,
  15 cocok, 5 ambigu, 138 tidak cocok.
- Belum menulis data produksi.
