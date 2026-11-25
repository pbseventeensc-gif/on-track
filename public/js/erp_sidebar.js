/**
 * Wellen Print ERP - Modular Sidebar Accordion & Navigation Controller
 * Mendukung pencarian instan, toggle grup accordion, mode collapsed icon-only, dan integrasi switchTab
 */

(function(window) {
    'use strict';

    // State accordion yang terbuka (default buka: job-intake dan production)
    const openGroups = new Set(['job-intake', 'production', 'qc-shipping']);

    function toggleSidebarGroup(groupId) {
        const groupEl = document.querySelector(`.sidebar-accordion-group[data-group="${groupId}"]`);
        if (!groupEl) return;

        const isCurrentlyOpen = groupEl.classList.contains('open');
        if (isCurrentlyOpen) {
            groupEl.classList.remove('open');
            openGroups.delete(groupId);
        } else {
            groupEl.classList.add('open');
            openGroups.add(groupId);
        }
    }

    function openGroupForView(viewId) {
        // Cari sub-item yang memiliki viewId ini
        const subItem = document.querySelector(`[onclick*="${viewId}"]`);
        if (subItem) {
            const parentGroup = subItem.closest('.sidebar-accordion-group');
            if (parentGroup) {
                parentGroup.classList.add('open');
                const gId = parentGroup.getAttribute('data-group');
                if (gId) openGroups.add(gId);
            }
        }
    }

    function filterSidebarMenus(query) {
        const q = (query || '').toLowerCase().trim();
        const groups = document.querySelectorAll('.sidebar-accordion-group');

        groups.forEach(g => {
            const titleEl = g.querySelector('.group-title');
            const groupTitle = titleEl ? titleEl.innerText.toLowerCase() : '';
            const subItems = g.querySelectorAll('.sub-nav-item');
            let hasMatchingSub = false;

            subItems.forEach(item => {
                const itemText = item.innerText.toLowerCase();
                if (!q || itemText.includes(q) || groupTitle.includes(q)) {
                    item.style.display = 'flex';
                    hasMatchingSub = true;
                } else {
                    item.style.display = 'none';
                }
            });

            if (!q) {
                // Kembalikan ke state semula
                const gId = g.getAttribute('data-group');
                if (openGroups.has(gId)) {
                    g.classList.add('open');
                } else {
                    g.classList.remove('open');
                }
                g.style.display = 'block';
            } else if (hasMatchingSub || groupTitle.includes(q)) {
                g.classList.add('open');
                g.style.display = 'block';
            } else {
                g.style.display = 'none';
            }
        });
    }

    function openModulePlaceholder(title, category, el) {
        // Sembunyikan seluruh view section
        document.querySelectorAll('.view-section').forEach(v => {
            v.classList.remove('active');
            v.style.display = 'none';
        });

        // Tampilkan view 404 placeholder
        const target = document.getElementById('view-placeholder-404');
        if (target) {
            target.classList.add('active');
            target.style.display = 'block';
        }

        const titleEl = document.getElementById('placeholder-404-title');
        if (titleEl) titleEl.innerText = title || 'Modul Belum Tersedia';

        const badgeEl = document.getElementById('placeholder-404-badge');
        if (badgeEl) badgeEl.innerText = category ? `${category} • 404 Dalam Pengembangan` : '404 • Modul Dalam Pengembangan';

        // Kelola class active di navigasi
        document.querySelectorAll('.nav-link-custom').forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.sub-nav-item').forEach(l => l.classList.remove('active'));

        if (el) el.classList.add('active');

        // Buka grup accordion tempat item ini berada jika tertutup
        if (el) {
            const parentGroup = el.closest('.sidebar-accordion-group');
            if (parentGroup) {
                parentGroup.classList.add('open');
                const gId = parentGroup.getAttribute('data-group');
                if (gId) openGroups.add(gId);
            }
        }

        if (typeof window.updatePageTitleHeader === 'function') {
            window.updatePageTitleHeader(title || 'Modul', el, category);
        }

        const sb = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (sb && window.innerWidth <= 991) sb.classList.remove('open');
        if (backdrop) backdrop.classList.remove('active');
    }

    // Ekspor ke window global
    window.toggleSidebarGroup = toggleSidebarGroup;
    window.openGroupForView = openGroupForView;
    window.filterSidebarMenus = filterSidebarMenus;
    window.openModulePlaceholder = openModulePlaceholder;

    // Terapkan tema warna soft (gradasi lembut, tanpa blok warna solid mencolok)
    function injectSoftThemeOnline() {
        if (typeof document === 'undefined' || document.getElementById('wtrack-soft-ui-theme')) return;
        const style = document.createElement('style');
        style.id = 'wtrack-soft-ui-theme';
        style.textContent = `
            /* Soft gradient buttons - no harsh solid blocks */
            .btn-primary,
            .btn-bulk-sj-blue {
                background: linear-gradient(135deg, #eff6ff 0%, #e0edff 100%) !important;
                border: 1px solid #bfdbfe !important;
                color: #1e40af !important;
                box-shadow: 0 1px 2px rgba(30, 64, 175, 0.06) !important;
                transition: background 0.18s ease, border-color 0.18s ease, transform 0.16s ease, box-shadow 0.18s ease;
            }
            .btn-primary:hover,
            .btn-bulk-sj-blue:hover {
                background: linear-gradient(135deg, #e0edff 0%, #dbeafe 100%) !important;
                border-color: #93c5fd !important;
                color: #1d4ed8 !important;
                transform: translateY(-1px);
                box-shadow: 0 3px 8px rgba(37, 99, 235, 0.10) !important;
            }
            .btn-bulk-sj-delete {
                background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%) !important;
                border: 1px solid #fecdd3 !important;
                color: #be123c !important;
                box-shadow: none !important;
                transition: background 0.18s ease, transform 0.16s ease;
            }
            .btn-bulk-sj-delete:hover {
                background: linear-gradient(135deg, #ffe4e6 0%, #fecdd3 100%) !important;
                color: #9f1239 !important;
                transform: translateY(-1px);
            }
            .btn-success {
                background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%) !important;
                border: 1px solid #a7f3d0 !important;
                color: #065f46 !important;
                box-shadow: 0 1px 2px rgba(6, 95, 70, 0.06) !important;
            }
            .btn-success:hover {
                background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%) !important;
                border-color: #6ee7b7 !important;
                color: #064e3b !important;
            }
            .btn-danger {
                background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%) !important;
                border: 1px solid #fecaca !important;
                color: #991b1b !important;
                box-shadow: 0 1px 2px rgba(153, 27, 27, 0.06) !important;
            }
            .btn-danger:hover {
                background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%) !important;
                border-color: #fca5a5 !important;
                color: #7f1d1d !important;
            }
            .btn-warning {
                background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%) !important;
                border: 1px solid #fde68a !important;
                color: #92400e !important;
                box-shadow: 0 1px 2px rgba(146, 64, 14, 0.06) !important;
            }
            .btn-warning:hover {
                background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%) !important;
                border-color: #fcd34d !important;
                color: #78350f !important;
            }
            .btn-info {
                background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%) !important;
                border: 1px solid #bae6fd !important;
                color: #075985 !important;
                box-shadow: 0 1px 2px rgba(7, 89, 133, 0.06) !important;
            }
            .btn-info:hover {
                background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%) !important;
                border-color: #7dd3fc !important;
                color: #0c4a6e !important;
            }
            .btn-secondary,
            .btn-dark {
                background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important;
                border: 1px solid #cbd5e1 !important;
                color: #334155 !important;
                box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04) !important;
            }
            .btn-secondary:hover,
            .btn-dark:hover {
                background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%) !important;
                border-color: #94a3b8 !important;
                color: #0f172a !important;
            }

            /* Soft outline buttons */
            .btn-outline-primary {
                background: #f8fbff !important;
                border-color: #bfdbfe !important;
                color: #1e40af !important;
            }
            .btn-outline-primary:hover {
                background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%) !important;
                color: #1d4ed8 !important;
            }
            .btn-outline-success {
                background: #f4fdf9 !important;
                border-color: #a7f3d0 !important;
                color: #065f46 !important;
            }
            .btn-outline-success:hover {
                background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%) !important;
                color: #064e3b !important;
            }
            .btn-outline-danger {
                background: #fff8f8 !important;
                border-color: #fecaca !important;
                color: #991b1b !important;
            }
            .btn-outline-danger:hover {
                background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%) !important;
                color: #7f1d1d !important;
            }
            .btn-outline-warning {
                background: #fffdf5 !important;
                border-color: #fde68a !important;
                color: #92400e !important;
            }
            .btn-outline-warning:hover {
                background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%) !important;
                color: #78350f !important;
            }

            /* Soft gradient badges */
            .badge.bg-primary {
                background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%) !important;
                color: #1e40af !important;
                border: 1px solid #bfdbfe !important;
            }
            .badge.bg-success {
                background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%) !important;
                color: #065f46 !important;
                border: 1px solid #a7f3d0 !important;
            }
            .badge.bg-danger {
                background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%) !important;
                color: #991b1b !important;
                border: 1px solid #fecaca !important;
            }
            .badge.bg-warning {
                background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%) !important;
                color: #92400e !important;
                border: 1px solid #fde68a !important;
            }
            .badge.bg-info {
                background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%) !important;
                color: #075985 !important;
                border: 1px solid #bae6fd !important;
            }
            .badge.bg-secondary,
            .badge.bg-dark {
                background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important;
                color: #475569 !important;
                border: 1px solid #e2e8f0 !important;
            }
            .badge.bg-primary.text-white,
            .badge.bg-success.text-white,
            .badge.bg-danger.text-white,
            .badge.bg-warning.text-white,
            .badge.bg-info.text-white,
            .badge.bg-secondary.text-white,
            .badge.bg-dark.text-white {
                color: inherit !important;
            }
            .badge.bg-primary.text-white { color: #1e40af !important; }
            .badge.bg-success.text-white { color: #065f46 !important; }
            .badge.bg-danger.text-white { color: #991b1b !important; }
            .badge.bg-warning.text-white { color: #92400e !important; }
            .badge.bg-info.text-white { color: #075985 !important; }
            .badge.bg-secondary.text-white,
            .badge.bg-dark.text-white { color: #475569 !important; }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    // Sembunyikan grup Production lama & item Analytics placeholder di online
    function hideLegacyProductionOnline() {
        if (window.WTRACK_LOCAL_SANDBOX) return;
        const prodGroup = document.querySelector('.sidebar-accordion-group[data-group="production"]');
        if (prodGroup) prodGroup.remove();
        openGroups.delete('production');
        [
            'nav-volume-comparison',
            'nav-analytics-efficiency',
            'nav-analytics-waste',
            'nav-analytics-cost'
        ].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
    }

    injectSoftThemeOnline();
    hideLegacyProductionOnline();

    // Inisialisasi saat DOM siap
    document.addEventListener('DOMContentLoaded', () => {
        injectSoftThemeOnline();
        hideLegacyProductionOnline();
        openGroups.forEach(gId => {
            const el = document.querySelector(`.sidebar-accordion-group[data-group="${gId}"]`);
            if (el) el.classList.add('open');
        });
    });

})(typeof window !== 'undefined' ? window : global);
