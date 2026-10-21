# Daily Courier Performance & Pending Dispatch Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan fitur sidebar baru "Audit Kurir Harian" (Daily Courier Audit & Pending Map) dengan metrik pengantaran sukses vs gagal/pending, durasi jam kerja efektif (jam pertama assign s/d jam terakhir upload SJ), peta pin sebaran pending interaktif, dan ekspor Excel multi-sheet skala enterprise tanpa mengubah/merusak fungsi sistem yang sudah ada, serta diuji di localhost dengan Chrome DevTools MCP sebelum disetujui untuk deploy.

**Architecture:** 
- Membuat modul independen `js/courier_audit.js` untuk mengisolasi logika ekstraksi metrik, manipulasi DOM, pemetaan Leaflet, dan generator Excel multi-sheet.
- Mendaftarkan entri navigasi sidebar `nav-courier-audit` dan view section container `view-courier-audit` pada `index.html`.
- Mengaitkan tab switcher pada `switchTab()` di `js/app.js` tanpa menyentuh fungsi-fungsi tab lain.
- Menggunakan `SheetJS (XLSX)` yang sudah terpasang untuk mengekspor multi-sheet report (Summary + Pending Breakdown).

**Tech Stack:** JavaScript (ES6+), Leaflet.js, SheetJS (XLSX), Bootstrap 5, Bootstrap Icons, Firebase Firestore, Python 3 HTTP Server (Localhost), Chrome DevTools MCP.

---

## Global Constraints
- Jangan merusak fungsionalitas yang ada (Dashboard, Live Tracking, Dispatch, SJ Pool, KPI Kurir, Pod Archive, dsb.).
- Jangan melakukan git push atau deploy ke Vercel sebelum ada persetujuan eksplisit dari pengguna.
- Jalankan dan uji terlebih dahulu di environment lokal (`localhost`).
- Skema data `trips` dan `destinations` bersifat read-only untuk tampilan audit (non-destructive).

---

## Tasks

- [x] **Task 1: Desain Modul & Komponen UI di `index.html`**
  - [x] Tambahkan item menu di sidebar nav `index.html` dengan ID `nav-courier-audit` (Label: "Audit Kurir Harian", Icon: `bi-clipboard-data-fill` atau `bi-person-check`).
  - [x] Tambahkan `<section id="view-courier-audit" class="view-section" style="display: none;">` lengkap dengan filter bar, 4 kartu ringkasan KPI, tabel rekapitulasi, dan panel peta Leaflet.
  - [x] Hubungkan script baru `<script src="/js/courier_audit.js"></script>` di bagian penutup `index.html`.

- [x] **Task 2: Integrasi Tab Switcher di `js/app.js`**
  - [x] Di dalam fungsi `switchTab(viewId, el)` pada `js/app.js`, tambahkan trigger saat `viewId === 'courier-audit'` untuk memanggil `renderCourierAuditView()`.
  - [x] Pastikan role permission (`isTabAllowedForRole` & `applyRoleAccessControl`) mengizinkan admin/super_admin membuka tab ini.

- [x] **Task 3: Implementasi Logika Inti & Peta di `js/courier_audit.js`**
  - [x] Implementasikan fungsi kalkulasi jam kerja efektif (`firstAssignTime` s/d `lastCompletedTime`).
  - [x] Hitung counter: `delivered`, `failed`, `pending`, durasi efektif, dan indikator lembur (>8 jam).
  - [x] Hubungkan peta Leaflet interaktif (`#courier-audit-map`) dengan pin pending bergradasi oranye dan tombol "Fokus Peta".

- [x] **Task 4: Implementasi Multi-Sheet Enterprise Excel Export**
  - [x] Sheet 1 (`Rekap_Harian_Kurir`): Rangkuman performa, jam assign pertama, jam upload akhir, jam kerja efektif, lembur, dan rasio sukses.
  - [x] Sheet 2 (`Rincian_Pending_Gagal`): Daftar titik kendala lapangan, alamat lengkap, wilayah, koordinat, alasan, dan link foto bukti.
  - [x] Sheet 3 (`Log_Seluruh_Pengantaran`): Log kronologis semua paket untuk audit SLA.

- [x] **Task 5: Pengujian Lokal & Verifikasi Chrome DevTools MCP**
  - [x] Dev server lokal aktif di `http://localhost:8080`.
  - [x] Evaluasi rendering DOM, interaktivitas filter kurir, dan kalkulasi data dengan Chrome DevTools MCP.
  - [x] Screenshot UI berhasil diambil dan diverifikasi.
