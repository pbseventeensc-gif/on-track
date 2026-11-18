/* Coalesce live updates and only refresh panels the administrator is viewing. */
(function (root) {
    'use strict';
    let timer = null;
    const dirty = new Set();
    function activeView() { return root.document?.querySelector('.view-section.active')?.id || 'view-dashboard'; }
    function visible() { return !root.document?.hidden; }
    function schedule(kind = 'trips') {
        dirty.add(kind);
        if (timer !== null || !visible()) return;
        timer = root.setTimeout(flush, 180);
    }
    function flush() {
        timer = null;
        if (!visible()) return;
        const changes = new Set(dirty); dirty.clear();
        const view = activeView();
        if (view === 'view-dashboard') {
            root.updateGlobalStats?.({telemetryOnly: !changes.has('trips')});
            if (changes.has('trips')) root.renderRecentShipments?.();
        } else if (view === 'view-monitor') root.refreshAllMonitorData?.();
        else if (changes.has('trips')) {
            if (view === 'view-fleet') root.renderKPIView?.();
            if (view === 'view-pool') root.UnifiedPoolUI?.scheduleRender?.();
            if (view === 'view-reports') root.loadFullHistory?.();
            if (view === 'view-courier-audit') root.renderCourierAuditView?.();
        }
    }
    root.document?.addEventListener('visibilitychange', () => { if (visible() && dirty.size) schedule('resume'); });
    root.AdminRuntime = {schedule, activeView};
})(typeof window !== 'undefined' ? window : globalThis);
