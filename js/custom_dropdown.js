// Custom Dropdown UI Enhancement (Image 2 Specification)
// Replaces native OS <select> popovers with modern, rounded SaaS floating dropdown menus

(function() {
    'use strict';

    let activeMenu = null;
    let activeTrigger = null;

    function closeActiveDropdown() {
        if (activeMenu) {
            if (activeMenu.parentNode) activeMenu.parentNode.removeChild(activeMenu);
            activeMenu = null;
        }
        if (activeTrigger) {
            activeTrigger.classList.remove('active');
            activeTrigger = null;
        }
    }

    function getSelectedOptionText(selectEl) {
        if (!selectEl) return '';
        const idx = selectEl.selectedIndex;
        if (idx >= 0 && selectEl.options[idx]) {
            return selectEl.options[idx].text;
        }
        return selectEl.options[0]?.text || '';
    }

    function positionMenu(triggerEl, menuEl) {
        const rect = triggerEl.getBoundingClientRect();
        const menuWidth = Math.max(rect.width, 220);
        menuEl.style.width = menuWidth + 'px';

        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;

        menuEl.style.left = Math.max(10, Math.min(rect.left, window.innerWidth - menuWidth - 10)) + 'px';

        // Check if menu fits below or should flip above
        const estimatedHeight = Math.min(menuEl.scrollHeight || 300, 360);
        if (spaceBelow < estimatedHeight + 10 && spaceAbove > spaceBelow) {
            // Position above
            menuEl.style.top = (rect.top - estimatedHeight - 6) + 'px';
            menuEl.style.maxHeight = Math.min(spaceAbove - 16, 360) + 'px';
        } else {
            // Position below
            menuEl.style.top = (rect.bottom + 6) + 'px';
            menuEl.style.maxHeight = Math.min(spaceBelow - 16, 360) + 'px';
        }
    }

    function openDropdownMenu(selectEl, triggerEl) {
        if (activeTrigger === triggerEl) {
            closeActiveDropdown();
            return;
        }
        closeActiveDropdown();

        const menu = document.createElement('div');
        menu.className = 'wtrack-custom-dropdown-menu';

        // Build items from select options & optgroups
        const children = Array.from(selectEl.children);
        const currentVal = selectEl.value;

        function appendOptionItem(opt) {
            if (!opt || opt.tagName !== 'OPTION') return;
            const item = document.createElement('div');
            item.className = 'wtrack-dropdown-item';
            const isSelected = (opt.value === currentVal || opt.selected);
            if (isSelected) {
                item.classList.add('active');
            }

            const labelSpan = document.createElement('span');
            labelSpan.textContent = opt.text || opt.label || '';
            item.appendChild(labelSpan);

            if (isSelected) {
                const checkSpan = document.createElement('span');
                checkSpan.className = 'wtrack-item-check';
                checkSpan.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                `;
                item.appendChild(checkSpan);
            }

            item.addEventListener('click', (e) => {
                e.stopPropagation();
                selectEl.value = opt.value;
                
                // Update trigger text
                const textEl = triggerEl.querySelector('.wtrack-select-text');
                if (textEl) textEl.textContent = opt.text;

                // Dispatch events
                selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                selectEl.dispatchEvent(new Event('input', { bubbles: true }));
                if (typeof selectEl.onchange === 'function') {
                    selectEl.onchange();
                }

                closeActiveDropdown();
            });

            menu.appendChild(item);
        }

        children.forEach(child => {
            if (child.tagName === 'OPTGROUP') {
                const header = document.createElement('div');
                header.className = 'wtrack-dropdown-header';
                header.textContent = child.label || '';
                menu.appendChild(header);

                Array.from(child.children).forEach(opt => {
                    appendOptionItem(opt);
                });
            } else if (child.tagName === 'OPTION') {
                appendOptionItem(child);
            }
        });

        document.body.appendChild(menu);
        triggerEl.classList.add('active');
        activeMenu = menu;
        activeTrigger = triggerEl;

        positionMenu(triggerEl, menu);
    }

    function enhanceSelect(selectEl) {
        if (!selectEl || selectEl._wtrackEnhanced) {
            // Already enhanced, just update the trigger text
            if (selectEl && selectEl._wtrackTrigger) {
                const textEl = selectEl._wtrackTrigger.querySelector('.wtrack-select-text');
                if (textEl) textEl.textContent = getSelectedOptionText(selectEl);
            }
            return;
        }

        // Hide native select visually while keeping it fully functional in DOM
        selectEl.classList.add('wtrack-select-hidden');

        // Create trigger button
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'wtrack-custom-select-trigger';
        
        // Inherit styling cues
        if (selectEl.id) trigger.setAttribute('data-target-select', selectEl.id);
        if (selectEl.style.width) trigger.style.width = selectEl.style.width;
        if (selectEl.style.minWidth) trigger.style.minWidth = selectEl.style.minWidth;
        if (selectEl.classList.contains('form-select-sm')) {
            trigger.style.minHeight = '32px';
            trigger.style.padding = '4px 10px';
            trigger.style.fontSize = '0.8rem';
        }

        const textSpan = document.createElement('span');
        textSpan.className = 'wtrack-select-text';
        textSpan.textContent = getSelectedOptionText(selectEl);

        const chevronSpan = document.createElement('span');
        chevronSpan.className = 'wtrack-select-chevron';
        chevronSpan.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m6 9 6 6 6-6"></path>
            </svg>
        `;

        trigger.appendChild(textSpan);
        trigger.appendChild(chevronSpan);

        // Insert trigger immediately after the hidden select
        selectEl.parentNode.insertBefore(trigger, selectEl.nextSibling);

        selectEl._wtrackEnhanced = true;
        selectEl._wtrackTrigger = trigger;

        // Toggle dropdown on click
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            openDropdownMenu(selectEl, trigger);
        });

        // Sync when select value changes programmatically
        selectEl.addEventListener('change', () => {
            textSpan.textContent = getSelectedOptionText(selectEl);
        });

        // Watch for changes in select options (e.g. innerHTML updates)
        const observer = new MutationObserver(() => {
            textSpan.textContent = getSelectedOptionText(selectEl);
        });
        observer.observe(selectEl, { childList: true, subtree: true, attributes: true });
    }

    function initAllCustomSelects() {
        // Target dropdown selectors across dashboard
        const targetSelectors = [
            '#sel-courier',
            '#recent-carrier-filter',
            '#recent-status-filter',
            '#fleet-filter-type',
            '#fleet-filter-status',
            '#header-branch-filter',
            '#kpi-vehicle-filter',
            '#audit-vehicle-filter',
            '#audit-courier-select',
            '#pool-region-select',
            '#bulk-courier-select',
            '#archive-courier-filter',
            '#archive-category-filter',
            '#fleet-input-category',
            '#fleet-input-personil'
        ];

        targetSelectors.forEach(sel => {
            const el = document.querySelector(sel);
            if (el && el.tagName === 'SELECT') {
                enhanceSelect(el);
            }
        });

        // Also enhance any remaining .form-select if not already enhanced
        document.querySelectorAll('select.form-select').forEach(el => {
            // Avoid hidden template selects or clone containers
            if (el.offsetParent !== null || el.id) {
                enhanceSelect(el);
            }
        });
    }

    // Global click listener to close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (activeMenu && !activeMenu.contains(e.target) && (!activeTrigger || !activeTrigger.contains(e.target))) {
            closeActiveDropdown();
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeActiveDropdown();
        }
    });

    // Reposition or close on scroll/resize
    window.addEventListener('scroll', () => {
        if (activeMenu && activeTrigger) {
            positionMenu(activeTrigger, activeMenu);
        }
    }, { passive: true });

    window.addEventListener('resize', () => {
        closeActiveDropdown();
    });

    // Expose API
    window.wtrackDropdown = {
        enhance: enhanceSelect,
        initAll: initAllCustomSelects,
        close: closeActiveDropdown
    };

    // Auto-init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAllCustomSelects);
    } else {
        setTimeout(initAllCustomSelects, 100);
    }

    // Periodic check for dynamically loaded selects
    setInterval(initAllCustomSelects, 1500);

})();
