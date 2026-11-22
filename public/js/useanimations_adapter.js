/* UseAnimations (react-useanimations) global adapter for Wtrack */
(function (root) {
    'use strict';

    const BI_TO_UA = {
        'bi-activity': 'activity',
        'bi-alarm': 'clock',
        'bi-android2': 'smartphone',
        'bi-arrow-clockwise': 'refresh',
        'bi-arrow-counterclockwise': 'refreshCcw',
        'bi-arrow-repeat': 'refresh',
        'bi-arrow-right': 'arrowRight',
        'bi-arrows-fullscreen': 'maximize2',
        'bi-bar-chart-line': 'barChart',
        'bi-bell': 'notification',
        'bi-bell-fill': 'notification',
        'bi-bezier2': 'layers',
        'bi-bicycle': 'navigation',
        'bi-box-arrow-in-down': 'download',
        'bi-box-arrow-up-right': 'externalLink',
        'bi-box-seam': 'package',
        'bi-boxes': 'box',
        'bi-building': 'grid',
        'bi-calendar2-check': 'calendar',
        'bi-calendar3': 'calendar',
        'bi-calendar4-week': 'calendar',
        'bi-calendar-event': 'calendar',
        'bi-camera': 'camera',
        'bi-camera-fill': 'camera',
        'bi-card-checklist': 'clipboard',
        'bi-cash-stack': 'dollarSign',
        'bi-chat-dots': 'messageCircle',
        'bi-check': 'check',
        'bi-check-all': 'checkmark',
        'bi-check-circle': 'checkCircle',
        'bi-check-circle-fill': 'checkCircle',
        'bi-check-lg': 'check',
        'bi-check2': 'check',
        'bi-check2-all': 'checkmark',
        'bi-check2-circle': 'checkCircle',
        'bi-check2-square': 'checkBox',
        'bi-chevron-': 'chevronDown',
        'bi-chevron-double-left': 'chevronsLeft',
        'bi-chevron-double-right': 'chevronsRight',
        'bi-chevron-down': 'chevronDown',
        'bi-chevron-right': 'chevronRight',
        'bi-circle-fill': 'star',
        'bi-clipboard': 'clipboard',
        'bi-clipboard2-check': 'clipboard',
        'bi-clock': 'clock',
        'bi-clock-history': 'clock',
        'bi-cloud-arrow-up': 'uploadCloud',
        'bi-cloud-arrow-up-fill': 'uploadCloud',
        'bi-cloud-check': 'uploadCloud',
        'bi-code-slash': 'code',
        'bi-cone-striped': 'alertTriangle',
        'bi-crosshair': 'crosshair',
        'bi-database': 'database',
        'bi-download': 'download',
        'bi-droplet-half': 'droplet',
        'bi-envelope-check': 'fileText',
        'bi-envelope-paper-fill': 'fileText',
        'bi-exclamation-circle': 'alertCircle',
        'bi-exclamation-circle-fill': 'alertCircle',
        'bi-exclamation-triangle': 'alertTriangle',
        'bi-exclamation-triangle-fill': 'alertTriangle',
        'bi-eye': 'visibility',
        'bi-eye-fill': 'visibility',
        'bi-eye-slash': 'visibility',
        'bi-eye-slash-fill': 'visibility',
        'bi-file-earmark-arrow-down': 'download',
        'bi-file-earmark-arrow-up': 'upload',
        'bi-file-earmark-bar-graph': 'barChart2',
        'bi-file-earmark-check': 'fileText',
        'bi-file-earmark-check-fill': 'fileText',
        'bi-file-earmark-excel': 'fileText',
        'bi-file-earmark-spreadsheet': 'table',
        'bi-file-earmark-text-fill': 'fileText',
        'bi-fire': 'zap',
        'bi-folder2': 'folder',
        'bi-folder2-open': 'folder',
        'bi-funnel': 'filter',
        'bi-gear': 'settings',
        'bi-gear-fill': 'settings',
        'bi-geo-alt': 'mapPin',
        'bi-geo-alt-fill': 'mapPin',
        'bi-graph-up-arrow': 'trendingUp',
        'bi-grid-fill': 'grid',
        'bi-hourglass-split': 'clock',
        'bi-image': 'image',
        'bi-images': 'image',
        'bi-inbox': 'inbox',
        'bi-info-circle': 'info',
        'bi-info-circle-fill': 'info',
        'bi-journal-text': 'fileText',
        'bi-kanban': 'table',
        'bi-layers': 'layers',
        'bi-list': 'menu',
        'bi-map': 'map',
        'bi-moon-stars': 'moon',
        'bi-pc-display-horizontal': 'monitor',
        'bi-pencil': 'edit',
        'bi-pencil-square': 'edit2',
        'bi-people': 'users',
        'bi-people-fill': 'users',
        'bi-person': 'user',
        'bi-person-badge': 'user',
        'bi-person-check': 'userCheck',
        'bi-person-gear': 'settings2',
        'bi-person-plus': 'userPlus',
        'bi-person-vcard': 'creditCard',
        'bi-play': 'playPause',
        'bi-plus-circle': 'plusCircle',
        'bi-plus-circle-fill': 'plusCircle',
        'bi-plus-lg': 'plusCircle',
        'bi-printer': 'printer',
        'bi-search': 'searchToX',
        'bi-send': 'send',
        'bi-send-check': 'send',
        'bi-send-fill': 'send',
        'bi-send-plus-fill': 'send',
        'bi-shield-check': 'shield',
        'bi-shield-lock-fill': 'lock',
        'bi-sliders2': 'settings2',
        'bi-speedometer2': 'activity',
        'bi-star-fill': 'star',
        'bi-stopwatch': 'clock',
        'bi-sun': 'sun',
        'bi-table': 'table',
        'bi-tools': 'tool',
        'bi-trash': 'trash2',
        'bi-trash-fill': 'trash2',
        'bi-trash3': 'trash2',
        'bi-truck': 'truck',
        'bi-truck-flatbed': 'truck',
        'bi-truck-front': 'truck',
        'bi-truck-front-fill': 'truck',
        'bi-upload': 'upload',
        'bi-whatsapp': 'phoneCall',
        'bi-x': 'xOctagon',
        'bi-x-circle': 'xOctagon',
        'bi-x-circle-fill': 'xOctagon',
        'bi-x-lg': 'xOctagon'
    };

    const LUCIDE_TO_UA = {
        'qr-code': 'grid',
        'camera': 'camera',
        'keyboard': 'edit2',
        'scan': 'crosshair'
    };

    function resolveIconName(el) {
        if (!el) return null;
        const explicitUa = el.getAttribute && el.getAttribute('data-ua');
        if (explicitUa && root.USEANIMATIONS_DATA && root.USEANIMATIONS_DATA[explicitUa]) return explicitUa;
        const lucideName = el.getAttribute && el.getAttribute('data-lucide');
        if (lucideName && LUCIDE_TO_UA[lucideName]) return LUCIDE_TO_UA[lucideName];
        if (!el.classList) return null;
        for (const cls of el.classList) {
            if (BI_TO_UA[cls]) return BI_TO_UA[cls];
        }
        return null;
    }

    const activeInstances = new Set();

    function pruneDetachedAnimations() {
        activeInstances.forEach((rec) => {
            if (rec.span && rec.span.isConnected) return;
            try { rec.anim && typeof rec.anim.destroy === 'function' && rec.anim.destroy(); } catch (_) {}
            if (rec.triggerTarget && Array.isArray(rec.triggerTarget._uaAnims)) {
                rec.triggerTarget._uaAnims = rec.triggerTarget._uaAnims.filter(a => a !== rec.anim);
            }
            activeInstances.delete(rec);
        });
    }

    function mountIcon(el) {
        if (
            !el ||
            el.dataset.uaDone === '1' ||
            el.classList.contains('no-ua') ||
            el.closest('th, thead, tbody, .table-header, [id^="sort-icon-"], #monitor-list, #notif-list-container, .leaflet-pane, .leaflet-popup-pane')
        ) {
            return;
        }
        if (!root.lottie || !root.USEANIMATIONS_DATA) return;

        const iconName = resolveIconName(el);
        const entry = iconName ? root.USEANIMATIONS_DATA[iconName] : null;
        if (!entry || !entry.animationData) {
            el.dataset.uaDone = '1';
            return;
        }

        const span = root.document.createElement('span');
        const preservedClasses = Array.from(el.classList).filter(c => c !== 'bi' && !c.startsWith('bi-'));
        span.className = ['ua-icon', ...preservedClasses].join(' ');
        span.dataset.ua = iconName;
        span.dataset.uaDone = '1';
        span.setAttribute('aria-hidden', 'true');

        const styleAttr = el.getAttribute('style');
        if (styleAttr) span.setAttribute('style', styleAttr);
        if (el.id) span.id = el.id;
        const titleAttr = el.getAttribute('title');
        if (titleAttr) span.setAttribute('title', titleAttr);

        if (!el.parentNode) return;
        el.parentNode.replaceChild(span, el);

        try {
            const animData = JSON.parse(JSON.stringify(entry.animationData));
            const anim = root.lottie.loadAnimation({
                container: span,
                renderer: 'svg',
                loop: false,
                autoplay: false,
                animationData: animData,
                rendererSettings: {
                    preserveAspectRatio: 'xMidYMid meet'
                }
            });

            const triggerTarget = span.closest('a, button, .sidebar-group-header, .stat-card, .action-btn, .nav-link-custom, .sub-nav-item, .sidebar-search-wrapper') || span;
            if (!triggerTarget.dataset.uaBound) {
                // Play Lottie icon animation on hover (and click)
                triggerTarget._uaAnims = triggerTarget._uaAnims || [];
                const playAll = () => {
                    (triggerTarget._uaAnims || []).forEach(a => {
                        try { a.goToAndPlay(0, true); } catch (_) {}
                    });
                };
                triggerTarget.addEventListener('mouseenter', playAll);
                triggerTarget.addEventListener('click', playAll);
                triggerTarget.addEventListener('mouseleave', () => {
                    (triggerTarget._uaAnims || []).forEach(a => {
                        try { a.goToAndStop(0, true); } catch (_) {}
                    });
                });
                triggerTarget.dataset.uaBound = '1';
            }
            triggerTarget._uaAnims = triggerTarget._uaAnims || [];
            triggerTarget._uaAnims.push(anim);
            activeInstances.add({ span, anim, triggerTarget });
        } catch (_) {
            // Fallback silently if lottie fails on a detached node
        }
    }

    function upgradeIcons(scope) {
        pruneDetachedAnimations();
        const container = scope && scope.querySelectorAll ? scope : root.document;
        if (!container) return;
        const nodes = container.querySelectorAll('i.bi:not([data-ua-done="1"]):not(.no-ua), i[data-lucide]:not([data-ua-done="1"]):not(.no-ua)');
        nodes.forEach(mountIcon);
    }

    let scheduled = false;
    function scheduleUpgrade() {
        if (scheduled) return;
        scheduled = true;
        const raf = root.requestAnimationFrame || (fn => setTimeout(fn, 16));
        raf(() => {
            scheduled = false;
            upgradeIcons(root.document);
        });
    }

    function init() {
        upgradeIcons(root.document);
        if (typeof root.MutationObserver === 'function' && root.document.body) {
            const observer = new root.MutationObserver((mutations) => {
                let hasRemoved = false;
                let hasAdded = false;
                for (const m of mutations) {
                    if (m.removedNodes && m.removedNodes.length) hasRemoved = true;
                    if (m.addedNodes && m.addedNodes.length) hasAdded = true;
                    if (hasRemoved && hasAdded) break;
                }
                if (hasRemoved || hasAdded) scheduleUpgrade();
            });
            observer.observe(root.document.body, { childList: true, subtree: true });
        }
    }

    root.UseAnimationsAdapter = {
        upgradeIcons,
        pruneDetachedAnimations,
        getActiveCount: () => activeInstances.size,
        init,
        BI_TO_UA
    };
    if (root.document) {
        if (root.document.readyState === 'loading') {
            root.document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    }
})(typeof window !== 'undefined' ? window : globalThis);
