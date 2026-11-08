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

    // Inisialisasi saat DOM siap
    document.addEventListener('DOMContentLoaded', () => {
        openGroups.forEach(gId => {
            const el = document.querySelector(`.sidebar-accordion-group[data-group="${gId}"]`);
            if (el) el.classList.add('open');
        });
    });

})(typeof window !== 'undefined' ? window : global);
