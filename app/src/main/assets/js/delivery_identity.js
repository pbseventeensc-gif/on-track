(function (root) {
    const identity = {
        newId() {
            return root.crypto?.randomUUID?.() || `DELIVERY_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        },
        destinationIndex(destinations, target = {}) {
            if (target.deliveryId) return destinations.findIndex(d => d.deliveryId === target.deliveryId);
            const matchesClient = d => !target.destination || d.locationName === target.destination;
            const index = target.destinationIndex;
            if (Number.isInteger(index) && destinations[index] && matchesClient(destinations[index])) return index;
            const matches = destinations.map((d, i) => ({d, i})).filter(({d, i}) =>
                (d.stopIndex || i + 1) === (target.stopIndex || 1) && matchesClient(d));
            return matches.length === 1 ? matches[0].i : -1;
        }
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = identity;
    root.DeliveryIdentity = identity;
})(typeof window !== 'undefined' ? window : globalThis);
