# SPK Split & Machine Allocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memungkinkan pemecahan (split) pekerjaan SPK ke beberapa mesin/branch, pengalokasian mesin dinamis dari `MachineMaster` untuk 4 branch (DM 1, DM 2, DM 3, Cikokol), serta penerbitan identitas sub-tiket ber-QR Code untuk alur produksi, QC, packing, dan Surat Jalan.

**Architecture:**
- **Split Engine (`js/spk_manager.js`):** Menambahkan fungsi murni untuk memecah item SPK menjadi $N$ sub-tiket (`splitSPKItem`), membatalkan pemecahan (`revertSplitSPKItem`), serta menghitung agregasi status penyelesaian (`getSPKAggregateStatus`).
- **Dynamic Machine Allocation:** Mengintegrasikan dropdown cabang (DM 1, DM 2, DM 3, Cikokol) dan dropdown mesin dinamis dari `MachineMaster.read()` ke tabel preview import SPK.
- **Split Modal Dialog:** Dialog modal `#modal-spk-split` yang interaktif dan responsif, memvalidasi kuantitas pecahan secara real-time (mencegah over/under split), serta mendukung alokasi cabang & mesin berbeda untuk tiap bagian.
- **Agregasi Antrian Produksi & SJ:** Menampilkan relasi induk-anak di tabel antrian SPK (`view-spk`), serta memastikan konversi ke Surat Jalan (SJ) hanya menggabungkan kuantitas utuh ketika seluruh sub-bagian selesai di QC & Packing.

**Tech Stack:** Vanilla JavaScript (ES6+), HTML5 `<dialog>` / Bootstrap 5 Modal, SheetJS (`xlsx`), Node.js `node:test`.

**Spec:** Diskusi alur SPK Import, pembagian 4 Branch & mesin fisik Wellen, serta kebutuhan split beban kuantitas dan alokasi multi-mesin.

## Global Constraints
- Tipografi dan komponen antarmuka wajib konsisten dengan standar Dashboard (`Inter`, font-size 11px/12px/13px, header weight 500, height button 32px, border `#EAECF0`).
- Tanpa AI slop: validasi kuantitas ketat, tidak ada hardcoded mock data silang, penanganan state bersih.
- Kompatibel dengan data lama: jika ada data SPK lama dengan `pusat`, ditangani secara anggun (graceful fallback).
- Selalu sinkronkan perubahan aset via `node scripts/sync-web-assets.cjs` ke `public/` dan `app/src/main/assets/`.
- Verifikasi seluruh alur di localhost server (`http://localhost:8080`).

## Review Focus
1. Validasi split kuantitas: jumlah total kuantitas sub-tiket harus tepat sama dengan kuantitas asli; tidak boleh ada selisih lebih atau kurang.
2. Konsistensi relasi parent-child: pembatalan split (revert) harus mengembalikan item induk semula tanpa merusak urutan baris lainnya.
3. Mesin per cabang: dropdown mesin pada baris preview harus reaktif memperbarui opsi mesin yang relevan saat cabang baris diubah.
4. Filter 4 branch: filter cabang di antrian produksi (`view-spk`) harus bekerja untuk DM 1, DM 2, DM 3, dan Cikokol.
5. Tombol "Buat SJ" pada SPK yang di-split tidak boleh membuat SJ terpotong; hanya boleh dibuat setelah seluruh part selesai atau secara eksplisit mengonfirmasi parsial.

---

### Task 1: Model & Logika Split SPK (`spk_manager.js` core & unit tests)

**Files:**
- Modify: `js/spk_manager.js`
- Test: `tests/spk-split-routing.test.cjs`

**Steps:**
- [x] Buat file test `tests/spk-split-routing.test.cjs` untuk menguji:
  - `splitSPKItem(spkList, itemIndex, splits)`:
    - Membagi 1 SPK menjadi 2 atau lebih sub-tiket dengan kuantitas, cabang, dan mesin berbeda.
    - Menghasilkan nomor SPK bertanda part (`SPK-001/A`, `SPK-001/B`).
    - Menolak split jika jumlah kuantitas pecahan tidak sama dengan kuantitas awal (throw Error atau return false).
  - `revertSplitSPKItem(spkList, parentSpkId)`:
    - Mengembalikan sub-tiket kembali menjadi 1 item utuh seperti sebelum di-split.
  - `getSPKAggregateStatus(parentSpkId, spkList)`:
    - Mengembalikan `completed` hanya jika semua part sudah `completed` / `packing`.
    - Mengembalikan `partial` jika sebagian part sudah selesai namun yang lain masih cetak / antri.
  - `generateSPKQRCodePayload(spkItem)`:
    - Menghasilkan string QR payload standar: `WTRACK:SPK:{spkNumber}:{partCode}:{machineId}`.
- [x] Implementasikan fungsi-fungsi tersebut di `js/spk_manager.js`:
  - `splitSPKItem(list, targetIndex, splits)`
  - `revertSplitSPKItem(list, parentSpkId)`
  - `getSPKAggregateStatus(parentSpkId, list)`
  - `generateSPKQRCodePayload(item)`
- [x] Jalankan test `node --test tests/spk-split-routing.test.cjs` dan pastikan semua lulus.

---

### Task 2: Integrasi UI Preview Import SPK dengan 4 Branch, Mesin Dinamis & Modal Split

**Files:**
- Modify: `index.html` (modal split markup & toolbar 4 branch preview)
- Modify: `js/spk_manager.js` (render preview table, interaksi modal split)
- Modify: `css/machine_master.css` (opsional: styling badge split)
- Test: `tests/spk-split-ui.test.cjs`

**Steps:**
- [x] Buat test `tests/spk-split-ui.test.cjs` untuk menguji:
  - Render preview table memuat dropdown cabang 4 branch (`DM 1`, `DM 2`, `DM 3`, `Cikokol`).
  - Dropdown mesin diisi otomatis berdasarkan mesin yang aktif di cabang tersebut.
  - Baris yang di-split menampilkan indikator badge `Part A`, `Part B` dan tombol batal split.
- [x] Di `index.html`:
  - Ubah tombol alokasi cabang massal di toolbar preview SPK menjadi: `DM 1`, `DM 2`, `DM 3`, `Cikokol`.
  - Tambahkan modal dialog `#modal-spk-split`:
    - Header modal: info nama barang, ukuran, dan total qty asli.
    - Kontainer baris pecahan dinamis (Part A, Part B, dst) dengan input: Qty, Cabang, dan Mesin.
    - Tombol `+ Tambah Mesin / Bagian`.
    - Ringkasan validasi: Total Terbagi vs Qty Asli (dengan indikator status hijau/merah).
    - Tombol footer: "Batal" dan "Terapkan Split".
- [x] Di `js/spk_manager.js`:
  - Update `renderSPKPreviewTable()`:
    - Tampilkan dropdown Branch (`DM 1`, `DM 2`, `DM 3`, `Cikokol`).
    - Tampilkan dropdown Mesin (`spk-preview-machine-select`) yang membaca `MachineMaster.read()`.
    - Tambahkan kolom aksi tombol **`✂️ Split`** atau **`↩️ Satukan`** (jika baris adalah hasil split).
  - Implementasikan fungsi UI modal:
    - `openSplitModal(index)`: membuka dialog dan mengisi data awal split (default 50:50).
    - `addSplitPartRow()`: menambah 1 bagian mesin lagi.
    - `removeSplitPartRow(rowIdx)`: menghapus 1 bagian mesin.
    - `updateSplitValidation()`: menghitung selisih kuantitas secara langsung saat user mengetik angka.
    - `applySplit()`: menerapkan pembagian ke `currentSPKPreviewList` dan me-render ulang tabel preview.
    - `revertSplit(parentSpkId)`: mengembalikan pecahan menjadi 1 baris utuh.
  - Update `setBulkBranch(targetBranch)` untuk mendukung 4 branch.
- [x] Jalankan test `node --test tests/spk-split-ui.test.cjs`.

---

### Task 3: Antrian Produksi (`view-spk`), QR Code Slip & Agregasi Status

**Files:**
- Modify: `js/spk_manager.js` (renderSPKView, filter branch, convertSPKToSuratJalan)
- Modify: `index.html` (filter bar di view-spk)
- Test: `tests/spk-aggregate-sj.test.cjs`

**Steps:**
- [x] Buat test `tests/spk-aggregate-sj.test.cjs` untuk menguji:
  - Antrian produksi memfilter 4 branch dengan benar (`all`, `DM 1`, `DM 2`, `DM 3`, `Cikokol`).
  - SPK hasil split yang belum lengkap dicegah/diberi konfirmasi saat klik "Buat SJ".
  - Saat seluruh part selesai, Surat Jalan terbentuk dengan total kuantitas penuh (gabungan part).
- [x] Di `index.html` dan `js/spk_manager.js`:
  - Perbarui filter bar `view-spk` menjadi 4 branch: `Semua Cabang`, `DM 1`, `DM 2`, `DM 3`, `Cikokol`.
  - Tampilkan kartu statistik counter untuk masing-masing 4 branch.
  - Pada baris SPK di tabel utama:
    - Jika item adalah split part, tampilkan badge part (misal: `<span class="badge bg-info text-dark">Part A (500/1000)</span>`).
    - Tambahkan tombol cetak QR Work Order (`cetakSlipSPK(spkId)`).
  - Pada `convertSPKToSuratJalan(spkId)`:
    - Cek status agregat: jika belum semua part selesai, tampilkan dialog konfirmasi ("Part B masih dalam proses cetak. Yakin ingin membuat Surat Jalan parsial?").
    - Gabungkan data part ke Surat Jalan di SJ Pool dengan rincian yang tepat.
- [x] Jalankan test `node --test tests/spk-aggregate-sj.test.cjs`.

---

### Task 4: Sinkronisasi Aset & Verifikasi Menyeluruh

**Files:**
- Output Sync: `public/`, `app/src/main/assets/`

**Steps:**
- [x] Jalankan `node scripts/sync-web-assets.cjs` untuk menyalin file `js/`, `css/`, dan `index.html`.
- [x] Jalankan seluruh test suite: `node --test tests/*.test.cjs`.
- [x] Verifikasi di local server (`npm run local`) pada browser:
  - Buka modal Import SPK, lakukan preview file Excel.
  - Lakukan pembagian (Split) 1 item ke 2 mesin berbeda (misal 512i dan 1024i di DM 2).
  - Pastikan validasi kuantitas mencegah angka salah.
  - Simpan ke antrian SPK dan uji filter per branch (DM 1, DM 2, DM 3, Cikokol).
