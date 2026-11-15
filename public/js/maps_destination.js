(function (root) {
    'use strict';

    const text = value => String(value || '').trim();
    const key = value => text(value).replace(/\s+/g, ' ').toLowerCase();

    function query(destination = {}, trip = {}) {
        const customers = [destination.customer, destination.clientName, trip.customer, trip.clientName]
            .map(key).filter(Boolean);
        const usable = value => {
            const result = text(value);
            if (!result || ['-', 'alamat lokasi', 'tujuan pengantaran'].includes(key(result))) return '';
            if (customers.includes(key(result))) return '';
            // Older imports invented this text from the customer column.
            if (/^alamat kirim\b/i.test(result) && customers.includes(key(result.replace(/^alamat kirim\s*:?\s*/i, '')))) return '';
            return result;
        };
        const address = [destination.deliveryAddress, destination.shippingAddress, destination.address,
            trip.deliveryAddress, trip.shippingAddress, trip.address].map(usable).find(Boolean) || '';
        const store = [destination.storeName, destination.storeDestination, trip.storeName, trip.storeDestination]
            .map(usable).find(Boolean) || '';
        // Store labels often contain the full shipping address after a comma.
        // Never use locationName/destination: older imports populated them from customer.
        const labelledAddress = /^(?:store|toko)\b/i.test(address) ? address : '';
        const storeName = (store || labelledAddress).split(/[,\r\n]|\b(?:jalan|jl\.)\s/i)[0]
            .replace(/^(?:store|toko)\s*[:\-]?\s+/i, '').trim();
        return usable(storeName) || address;
    }

    root.MapsDestination = {query};
})(typeof window !== 'undefined' ? window : globalThis);
