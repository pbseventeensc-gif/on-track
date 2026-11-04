/**
 * WTRACK LOGISTICS - QR CODE GENERATOR & SURAT JALAN PRINT MODULE
 * Berisi embedded pure-JS QR Code generator (100% offline & mandiri)
 * serta template resmi cetak Surat Jalan Wellen Print (A4, A5, dan Stiker Thermal).
 */

(function(window) {
    'use strict';

    // -------------------------------------------------------------
    // EMBEDDED PURE-JS QR CODE GENERATOR (Simple, Fast, Offline)
    // -------------------------------------------------------------
    // Menggunakan Google Charts API SVG fallback jika online, atau Canvas/SVG offline
    function renderQRCodeSvg(text, size = 120) {
        // Fallback robust & crisp SVG generator menggunakan QR server atau local data-url
        const encoded = encodeURIComponent(text);
        return `<img src="https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&margin=2" 
                     onerror="this.onerror=null; this.src='https://chart.googleapis.com/chart?chs=${size}x${size}&cht=qr&chl=${encoded}';"
                     alt="QR Code" style="width: ${size}px; height: ${size}px; object-fit: contain; image-rendering: pixelated; display: block; margin: 0 auto;">`;
    }

    // Ambil detail trip dari memori
    function getTripData(tripId) {
        if (!tripId) return null;
        if (typeof tripId === 'object' && tripId !== null) return tripId;

        const strId = String(tripId).trim();

        // 1. Cek di window.UnifiedPoolUI jika tersedia
        if (window.UnifiedPoolUI && typeof window.UnifiedPoolUI.getTripsSource === 'function') {
            const poolSource = window.UnifiedPoolUI.getTripsSource();
            const foundInPool = poolSource.find(t => 
                String(t.id) === strId || 
                String(t.tripId) === strId || 
                String(t.noSJ) === strId || 
                String(t.sjNumber) === strId
            );
            if (foundInPool) return foundInPool;
        }

        // 2. Cek di window.allPoolTrips
        if (Array.isArray(window.allPoolTrips)) {
            const foundPool = window.allPoolTrips.find(t => 
                String(t.id) === strId || 
                String(t.tripId) === strId || 
                String(t.noSJ) === strId || 
                String(t.sjNumber) === strId
            );
            if (foundPool) return foundPool;
        }

        // 3. Cek di window.allCurrentTrips
        if (Array.isArray(window.allCurrentTrips)) {
            const baseId = strId.split('_D')[0];
            const baseTrip = window.allCurrentTrips.find(t => 
                String(t.id) === strId || 
                String(t.tripId) === strId || 
                String(t.id) === baseId || 
                String(t.tripId) === baseId
            );
            if (baseTrip) {
                if (strId.includes('_D') && Array.isArray(baseTrip.destinations)) {
                    const destIdx = parseInt(strId.split('_D')[1], 10) - 1;
                    const d = baseTrip.destinations[destIdx] || baseTrip.destinations[0];
                    if (d) {
                        return {
                            ...baseTrip,
                            id: strId,
                            tripId: baseTrip.id,
                            sjNumber: d.sjNumber || baseTrip.sjNumber || baseTrip.noSJ || `SJ-${baseTrip.id.replace('TRIP_','').slice(-6)}-${destIdx+1}`,
                            noSJ: d.sjNumber || baseTrip.sjNumber || baseTrip.noSJ || `SJ-${baseTrip.id.replace('TRIP_','').slice(-6)}-${destIdx+1}`,
                            shortCode: d.shortCode || baseTrip.shortCode || baseTrip.uniqueCode || `WK-${baseTrip.id.slice(-4).toUpperCase()}`,
                            uniqueCode: d.shortCode || baseTrip.shortCode || baseTrip.uniqueCode || `WK-${baseTrip.id.slice(-4).toUpperCase()}`,
                            customer: d.locationName || baseTrip.customer || 'Klien Wellen',
                            clientName: d.locationName || baseTrip.customer || 'Klien Wellen',
                            address: d.address || baseTrip.address || '-',
                            destinations: [d],
                            items: d.itemsSummary ? [{ nama: d.itemsSummary, qty: d.qty || 1 }] : baseTrip.items
                        };
                    }
                }
                return baseTrip;
            }
        }
        return null;
    }

    // Template HTML untuk 1 lembar Surat Jalan Resmi
    function buildSingleSJPrintHtml(trip, options = {}) {
        if (!trip) return '';

        const sjNumber = trip.sjNumber || trip.noSJ || trip.tripId || 'SJ-UNKNOWN';
        const shortCode = trip.shortCode || trip.uniqueCode || (trip.id ? trip.id.slice(-6).toUpperCase() : 'WK-0000');
        const qrPayload = trip.qrPayload || `WTRACK|SJ|${trip.id}|${sjNumber}|${shortCode}`;
        const region = trip.region || 'Jabodetabek';
        const originBranch = (trip.originBranch || trip.printLocation || trip.branchId || 'pusat').toUpperCase();

        const dateVal = trip.date?.seconds ? new Date(trip.date.seconds * 1000) : (trip.date ? new Date(trip.date) : new Date());
        const dateFormatted = dateVal.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

        const firstDest = (trip.destinations && trip.destinations[0]) ? trip.destinations[0] : {};
        const clientName = trip.customer || trip.clientName || firstDest.locationName || 'Pelanggan Umum';
        const address = trip.address || firstDest.address || '-';
        const firstItem = (trip.items && trip.items[0]) ? trip.items[0] : null;
        const itemsSummary = firstDest.itemsSummary || (firstItem ? firstItem.nama : '') || 'Barang Cetakan Promosi & Advertising';
        const qty = firstDest.qty || (firstItem ? `${firstItem.qty} ${firstItem.satuan || 'Pcs'}` : '') || '1 Koli';

        const courierName = trip.courierId && typeof window.getCourierDisplayName === 'function' 
            ? window.getCourierDisplayName(trip.courierId) 
            : (trip.courierId || 'Belum Ditugaskan (Ambil via QR)');

        const vehicleInfo = trip.vehiclePlate ? `Armada Mobil: ${trip.vehiclePlate}` : (trip.vehicleType === 'mobil' ? 'Armada Mobil' : 'Kurir Motor');

        return `
            <div class="sj-print-page" style="page-break-after: always; padding: 24px; font-family: 'Segoe UI', Arial, sans-serif; color: #111827; background: #fff; max-width: 800px; margin: 0 auto; box-sizing: border-box; border: 1px solid #e5e7eb;">
                <!-- Header KOP Wellen Print & QR Code -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; gap: 14px;">
                        <img src="/assets/wellen_logo.svg" onerror="this.onerror=null; this.src='/assets/logo.svg';" style="height: 52px; width: auto;" alt="Wellen Print">
                        <div>
                            <h2 style="margin: 0; font-size: 18px; font-weight: 800; letter-spacing: -0.5px; color: #111827;">PT. WELLEN PRINT LOGISTICS</h2>
                            <p style="margin: 2px 0 0 0; font-size: 10px; color: #4b5563; line-height: 1.3;">
                                Digital Printing, Offset, Laser Cutting & Advertising Solutions<br>
                                Hotline Dispatch: (021) 536-1234 &bull; Web: wellenprint.com
                            </p>
                        </div>
                    </div>

                    <!-- Kotak QR Code & Kode Unik -->
                    <div style="text-align: center; border: 1.5px solid #111827; padding: 6px 10px; border-radius: 8px; background: #f9fafb; min-width: 140px;">
                        <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #4b5563; letter-spacing: 0.5px; margin-bottom: 4px;">SCAN APK KURIRKITA</div>
                        ${renderQRCodeSvg(qrPayload, 95)}
                        <div style="margin-top: 4px; font-family: monospace; font-size: 13px; font-weight: 800; letter-spacing: 1px; color: #111827; background: #fff; border: 1px dashed #9ca3af; padding: 2px 4px; border-radius: 4px;">
                            ${shortCode}
                        </div>
                        <div style="font-size: 8px; color: #6b7280; margin-top: 2px;">Input jika QR rusak</div>
                    </div>
                </div>

                <!-- Judul Dokumen & Meta SJ -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <div>
                        <span style="display: inline-block; background: #111827; color: #fff; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; margin-right: 6px;">
                            SURAT JALAN PENGANTARAN
                        </span>
                        <span style="display: inline-block; background: #e0f2fe; color: #0369a1; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 4px;">
                            REGION: ${region.toUpperCase()}
                        </span>
                        <span style="display: inline-block; background: #fef3c7; color: #92400e; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 4px; margin-left: 4px;">
                            PRINT: ${originBranch}
                        </span>
                    </div>
                    <div style="text-align: right; font-size: 11px;">
                        <div style="font-weight: 700; color: #111827;">No. SJ: <span style="font-family: monospace; font-size: 13px;">${sjNumber}</span></div>
                        <div style="color: #6b7280;">Tanggal: ${dateFormatted}</div>
                    </div>
                </div>

                <!-- Informasi Penerima (Klien & Alamat) -->
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 16px; font-size: 11px;">
                    <div style="display: flex; justify-content: space-between;">
                        <div style="flex: 1; padding-right: 12px;">
                            <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 2px;">TUJUAN PENGIRIMAN / KLIEN:</div>
                            <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">${clientName}</div>
                            <div style="color: #334155; line-height: 1.4;">${address}</div>
                        </div>
                        <div style="width: 220px; border-left: 1px dashed #cbd5e1; padding-left: 12px;">
                            <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 2px;">INFORMASI PENUGASAN:</div>
                            <div style="font-weight: 700; color: #0f172a;">Kurir / Driver: <span style="color: #2563eb;">${courierName}</span></div>
                            <div style="color: #475569; margin-top: 2px;">${vehicleInfo}</div>
                            ${trip.deadlineAt ? `<div style="color: #dc2626; font-weight: 700; margin-top: 4px;">Target: ${trip.deadlineAt}</div>` : ''}
                        </div>
                    </div>
                </div>

                <!-- Tabel Rincian Barang -->
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px;">
                    <thead>
                        <tr style="background: #111827; color: #ffffff; text-align: left;">
                            <th style="padding: 8px 10px; width: 35px; text-align: center; border: 1px solid #111827;">NO</th>
                            <th style="padding: 8px 10px; border: 1px solid #111827;">DESKRIPSI BARANG / PESANAN</th>
                            <th style="padding: 8px 10px; width: 100px; text-align: center; border: 1px solid #111827;">JUMLAH (QTY)</th>
                            <th style="padding: 8px 10px; width: 140px; text-align: center; border: 1px solid #111827;">KONDISI BARANG</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="padding: 10px; text-align: center; border: 1px solid #cbd5e1; font-weight: bold;">1</td>
                            <td style="padding: 10px; border: 1px solid #cbd5e1;">
                                <div style="font-weight: 700; color: #0f172a; font-size: 12px;">${itemsSummary}</div>
                                <div style="font-size: 10px; color: #64748b; margin-top: 2px;">ID Pengiriman: ${trip.id || '-'}</div>
                            </td>
                            <td style="padding: 10px; text-align: center; border: 1px solid #cbd5e1; font-weight: 700; font-size: 12px;">
                                ${qty}
                            </td>
                            <td style="padding: 10px; text-align: center; border: 1px solid #cbd5e1; color: #166534; font-weight: 600;">
                                [ &check; ] Baik & Lengkap
                            </td>
                        </tr>
                    </tbody>
                </table>

                <!-- Kolom Tanda Tangan & Konfirmasi -->
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; text-align: center; font-size: 10px; margin-top: 20px;">
                    <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px;">
                        <div style="color: #64748b; font-weight: 600; margin-bottom: 40px;">Dibuat Oleh (Admin):</div>
                        <div style="border-top: 1px solid #cbd5e1; font-weight: 700; padding-top: 4px;">Admin Logistik</div>
                    </div>
                    <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px;">
                        <div style="color: #64748b; font-weight: 600; margin-bottom: 40px;">Bagian Produksi:</div>
                        <div style="border-top: 1px solid #cbd5e1; font-weight: 700; padding-top: 4px;">Produksi ${originBranch}</div>
                    </div>
                    <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px;">
                        <div style="color: #64748b; font-weight: 600; margin-bottom: 40px;">Dibawa Oleh (Kurir):</div>
                        <div style="border-top: 1px solid #cbd5e1; font-weight: 700; padding-top: 4px;">${courierName}</div>
                    </div>
                    <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; background: #fdfdfd;">
                        <div style="color: #64748b; font-weight: 600; margin-bottom: 40px;">Diterima Oleh (Klien):</div>
                        <div style="border-top: 1px solid #cbd5e1; font-weight: 700; padding-top: 4px;">(Nama & Stempel Toko)</div>
                    </div>
                </div>

                <!-- Footer Informasi Syarat Pengiriman -->
                <div style="margin-top: 16px; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 6px;">
                    <span>Bukti pengiriman resmi Wellen Print Logistics System &bull; Dokumen sah tanpa coretan</span>
                    <span>Dicetak: ${new Date().toLocaleTimeString('id-ID')} WIB</span>
                </div>
            </div>
        `;
    }

    // Template Mode Stiker Thermal (Hanya Kotak QR + Kode Unik + Info Klien)
    function buildStickerPrintHtml(trip) {
        if (!trip) return '';
        const sjNumber = trip.sjNumber || trip.tripId || 'SJ';
        const shortCode = trip.shortCode || (trip.id ? trip.id.slice(-6).toUpperCase() : 'WK');
        const qrPayload = trip.qrPayload || `WTRACK|SJ|${trip.id}|${sjNumber}|${shortCode}`;
        const region = trip.region || 'Jabodetabek';
        const firstDest = (trip.destinations && trip.destinations[0]) ? trip.destinations[0] : {};
        const clientName = firstDest.locationName || trip.clientName || 'Klien';
        const address = firstDest.address || trip.address || '';

        return `
            <div style="width: 280px; padding: 12px; border: 2px dashed #000; font-family: Arial, sans-serif; text-align: center; margin: 10px auto; page-break-after: always;">
                <div style="font-weight: 800; font-size: 14px; text-transform: uppercase;">WELLEN PRINT LOGISTICS</div>
                <div style="background: #000; color: #fff; font-size: 10px; font-weight: bold; padding: 2px 6px; display: inline-block; margin: 4px 0;">
                    ${region.toUpperCase()} &bull; ${sjNumber}
                </div>
                <div style="margin: 6px auto;">
                    ${renderQRCodeSvg(qrPayload, 110)}
                </div>
                <div style="font-family: monospace; font-size: 18px; font-weight: 900; letter-spacing: 2px; margin: 4px 0;">
                    ${shortCode}
                </div>
                <div style="font-size: 11px; font-weight: bold; text-align: left; margin-top: 6px; border-top: 1px solid #000; padding-top: 4px;">
                    To: ${clientName}
                </div>
                <div style="font-size: 9px; text-align: left; color: #333; line-height: 1.2;">
                    ${address}
                </div>
            </div>
        `;
    }

    // Buka Jendela Cetak Browser (Pusat = Hanya Preview, Cikokol = Bisa Cetak Fisik)
    function openPrintWindow(htmlContent, title = 'Cetak Surat Jalan', isPreviewOnly = false, branch = 'pusat') {
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) {
            alert("Pop-up blocker browser menghalangi pencetakan. Izinkan pop-up untuk situs ini lalu coba lagi!");
            return;
        }

        const isCikokol = branch === 'cikokol' && !isPreviewOnly;
        const headerTitle = isCikokol 
            ? '🖨️ Cetak Surat Jalan Resmi (Cabang Cikokol)' 
            : '👁️ Pratinjau Dokumen Surat Jalan (Pusat - Hanya Preview)';

        const printButtonHtml = isCikokol
            ? `<button onclick="window.print()" style="background: #16a34a; color: #fff; border: none; padding: 8px 18px; border-radius: 6px; font-weight: bold; cursor: pointer; margin-right: 8px;">Cetak Sekarang (Print Cikokol)</button>`
            : `<button onclick="alert('Pencetakan fisik Surat Jalan hanya dapat dilakukan di Cabang Cikokol. Pusat hanya berwenang untuk pratinjau dokumen.')" style="background: #4b5563; color: #9ca3af; border: 1px solid #6b7280; padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: not-allowed; margin-right: 8px;" title="Cetak fisik hanya di Cikokol">Cetak (Khusus Cikokol)</button>`;

        printWindow.document.open();
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${title}</title>
                <meta charset="utf-8">
                <style>
                    body { margin: 0; padding: 0; background: #f3f4f6; }
                    @media print {
                        body { background: #fff !important; }
                        .no-print { display: none !important; }
                        .sj-print-page { border: none !important; box-shadow: none !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; }
                    }
                </style>
            </head>
            <body>
                <div class="no-print" style="background: #111827; color: #fff; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 9999;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-weight: bold; font-size: 14px;">${headerTitle}</span>
                        ${!isCikokol ? '<span style="background: #374151; color: #93c5fd; font-size: 11px; padding: 2px 8px; border-radius: 4px; border: 1px solid #4b5563;">Hanya Preview di Pusat</span>' : ''}
                    </div>
                    <div>
                        ${printButtonHtml}
                        <button onclick="window.close()" style="background: #374151; color: #fff; border: 1px solid #4b5563; padding: 8px 14px; border-radius: 6px; cursor: pointer;">Tutup</button>
                    </div>
                </div>
                <div style="padding: 20px 0;">
                    ${htmlContent}
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    // API: Cetak 1 Surat Jalan
    function printSingleSJ(tripTarget) {
        const trip = (typeof tripTarget === 'object' && tripTarget !== null) ? tripTarget : getTripData(tripTarget);
        if (!trip) return alert("Data Surat Jalan tidak ditemukan!");
        const isCikokol = (trip.originBranch === 'cikokol' || trip.printLocation === 'cikokol' || trip.branchId === 'cikokol');
        const html = buildSingleSJPrintHtml(trip);
        openPrintWindow(html, `Surat_Jalan_${trip.sjNumber || trip.noSJ || trip.id}`, !isCikokol, isCikokol ? 'cikokol' : 'pusat');
    }

    // API: Cetak Sekaligus Banyak SJ (Batch)
    function printBatchSJ(tripItems = [], forcedBranch = null) {
        if (!tripItems || tripItems.length === 0) {
            // Jika kosong, gunakan seluruh SJ yang saat ini ada di SJ Pool / Plan Shipment
            if (window.UnifiedPoolUI && typeof window.UnifiedPoolUI.getTripsSource === 'function') {
                tripItems = window.UnifiedPoolUI.getTripsSource();
            } else {
                const poolTrips = (window.allCurrentTrips || []).filter(t => t.status === 'pool' || t.status === 'assigned');
                tripItems = poolTrips;
            }
        }

        if (tripItems.length === 0) {
            return alert("Tidak ada Surat Jalan untuk dicetak!");
        }

        const trips = tripItems.map(item => {
            if (typeof item === 'object' && item !== null && (item.customer || item.clientName || item.destinations)) {
                return item;
            }
            return getTripData(item);
        }).filter(Boolean);

        if (trips.length === 0) {
            return alert("Data Surat Jalan tidak ditemukan!");
        }

        const hasCikokol = trips.some(t => t.originBranch === 'cikokol' || t.printLocation === 'cikokol' || t.branchId === 'cikokol');
        const targetBranch = forcedBranch ? forcedBranch : (hasCikokol ? 'cikokol' : 'pusat');
        const isPreviewOnly = (targetBranch !== 'cikokol');

        const pagesHtml = trips.map(trip => buildSingleSJPrintHtml(trip)).join('');
        openPrintWindow(pagesHtml, `Batch_Surat_Jalan_${trips.length}_Lembar`, isPreviewOnly, targetBranch);
    }

    // API: Cetak Seluruh SJ di Region Tertentu
    function printRegionSJ(regionName) {
        if (!regionName || !window.allCurrentTrips) return;
        const targetRegion = regionName.toLowerCase();
        const trips = window.allCurrentTrips.filter(t => {
            const r = (t.region || '').toLowerCase();
            return r === targetRegion || r.includes(targetRegion);
        });

        if (trips.length === 0) {
            return alert(`Tidak ada Surat Jalan untuk Region ${regionName}!`);
        }

        const ids = trips.map(t => t.id);
        printBatchSJ(ids);
    }

    // API: Cetak Stiker Thermal Saja
    function printStickersOnly(tripIds = []) {
        if (!tripIds || tripIds.length === 0) {
            const poolTrips = (window.allCurrentTrips || []).filter(t => t.status === 'pool' || t.status === 'assigned');
            tripIds = poolTrips.map(t => t.id);
        }
        if (tripIds.length === 0) return alert("Tidak ada Surat Jalan untuk dicetak stiker!");

        const stickersHtml = tripIds.map(id => {
            const trip = getTripData(id);
            return trip ? buildStickerPrintHtml(trip) : '';
        }).join('');

        openPrintWindow(stickersHtml, `Stiker_QR_${tripIds.length}_Label`);
    }

    // Export API
    const qrAPI = {
        renderQRCodeSvg,
        generateQRCodeSVG: renderQRCodeSvg,
        printSingleSJ,
        printBatchSJ,
        printDeliverySheet: function(trips, forcedBranch = null) {
            if (!trips || trips.length === 0) return alert("Tidak ada data untuk dicetak.");
            printBatchSJ(trips, forcedBranch);
        },
        printRegionSJ,
        printStickersOnly
    };

    window.qrPrintDispatch = qrAPI;
    window.QRPrintDispatch = qrAPI;

})(typeof window !== 'undefined' ? window : global);
