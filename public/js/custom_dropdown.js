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
        const menuWidth = Math.max(rect.width, 240);
        menuEl.style.width = menuWidth + 'px';

        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;

        menuEl.style.left = Math.max(10, Math.min(rect.left, window.innerWidth - menuWidth - 10)) + 'px';

        // Check if menu fits below or should flip above
        const estimatedHeight = Math.min(menuEl.scrollHeight || 340, 420);
        if (spaceBelow < estimatedHeight + 10 && spaceAbove > spaceBelow) {
            // Position above
            menuEl.style.top = Math.max(10, rect.top - estimatedHeight - 6) + 'px';
            menuEl.style.maxHeight = Math.min(spaceAbove - 16, 420) + 'px';
        } else {
            // Position below
            menuEl.style.top = (rect.bottom + 6) + 'px';
            menuEl.style.maxHeight = Math.min(spaceBelow - 16, 420) + 'px';
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

        // Check if dropdown should have search feature
        const totalOptions = selectEl.options ? selectEl.options.length : 0;
        const hasOptgroups = selectEl.querySelector('optgroup') !== null;
        const selectId = (selectEl.id || '').toLowerCase();
        const isSearchable = totalOptions >= 5 || hasOptgroups || selectId.includes('carrier') || selectId.includes('personil') || selectId.includes('courier');

        let searchInput = null;
        let searchClearBtn = null;
        let searchWrap = null;

        if (isSearchable) {
            searchWrap = document.createElement('div');
            searchWrap.className = 'wtrack-dropdown-search-wrapper';
            searchWrap.addEventListener('click', (e) => e.stopPropagation());

            const searchBox = document.createElement('div');
            searchBox.className = 'wtrack-dropdown-search-box';

            searchBox.innerHTML = `
                <svg class="wtrack-dropdown-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
            `;

            searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.className = 'wtrack-dropdown-search-input';
            const placeholder = (selectId.includes('carrier') || selectId.includes('personil') || selectId.includes('courier'))
                ? 'Cari personil...'
                : 'Cari...';
            searchInput.placeholder = placeholder;
            searchInput.setAttribute('autocomplete', 'off');
            searchInput.setAttribute('spellcheck', 'false');

            searchClearBtn = document.createElement('button');
            searchClearBtn.type = 'button';
            searchClearBtn.className = 'wtrack-dropdown-search-clear';
            searchClearBtn.style.display = 'none';
            searchClearBtn.setAttribute('aria-label', 'Clear search');
            searchClearBtn.innerHTML = `
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            `;

            searchBox.appendChild(searchInput);
            searchBox.appendChild(searchClearBtn);
            searchWrap.appendChild(searchBox);
            menu.appendChild(searchWrap);
        }

        // Scrollable items container
        const itemsList = document.createElement('div');
        itemsList.className = 'wtrack-dropdown-items-list';
        menu.appendChild(itemsList);

        // Build items from select options & optgroups
        const children = Array.from(selectEl.children);
        const currentVal = selectEl.value;

        function appendOptionItem(opt, container) {
            if (!opt || opt.tagName !== 'OPTION') return;
            const item = document.createElement('div');
            item.className = 'wtrack-dropdown-item';
            const itemText = opt.text || opt.label || '';
            item.setAttribute('data-text', itemText);

            const isSelected = (opt.value === currentVal || opt.selected);
            if (isSelected) {
                item.classList.add('active');
            }

            const labelSpan = document.createElement('span');
            labelSpan.textContent = itemText;
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

            container.appendChild(item);
        }

        children.forEach(child => {
            if (child.tagName === 'OPTGROUP') {
                const groupSec = document.createElement('div');
                groupSec.className = 'wtrack-dropdown-group-section';

                const header = document.createElement('div');
                header.className = 'wtrack-dropdown-header';
                header.textContent = child.label || '';
                groupSec.appendChild(header);

                Array.from(child.children).forEach(opt => {
                    appendOptionItem(opt, groupSec);
                });
                itemsList.appendChild(groupSec);
            } else if (child.tagName === 'OPTION') {
                appendOptionItem(child, itemsList);
            }
        });

        // Empty state message
        const emptyState = document.createElement('div');
        emptyState.className = 'wtrack-dropdown-empty';
        emptyState.style.display = 'none';
        emptyState.textContent = 'Tidak ada hasil ditemukan';
        itemsList.appendChild(emptyState);

        // Filter functionality
        if (searchInput) {
            const runFilter = () => {
                const query = searchInput.value.toLowerCase().trim();
                if (searchClearBtn) {
                    searchClearBtn.style.display = query ? 'flex' : 'none';
                }

                let visibleCount = 0;

                // Filter items inside optgroups
                const groups = itemsList.querySelectorAll('.wtrack-dropdown-group-section');
                groups.forEach(grp => {
                    let groupVisibleCount = 0;
                    const items = grp.querySelectorAll('.wtrack-dropdown-item');
                    items.forEach(it => {
                        const txt = (it.getAttribute('data-text') || it.textContent || '').toLowerCase();
                        if (!query || txt.includes(query)) {
                            it.style.display = 'flex';
                            groupVisibleCount++;
                            visibleCount++;
                        } else {
                            it.style.display = 'none';
                        }
                    });
                    const hdr = grp.querySelector('.wtrack-dropdown-header');
                    if (hdr) {
                        hdr.style.display = groupVisibleCount > 0 ? 'block' : 'none';
                    }
                });

                // Filter direct items (like "Semua Personil")
                const directItems = itemsList.querySelectorAll(':scope > .wtrack-dropdown-item');
                directItems.forEach(it => {
                    const txt = (it.getAttribute('data-text') || it.textContent || '').toLowerCase();
                    if (!query || txt.includes(query)) {
                        it.style.display = 'flex';
                        visibleCount++;
                    } else {
                        it.style.display = 'none';
                    }
                });

                emptyState.style.display = visibleCount === 0 ? 'block' : 'none';
                positionMenu(triggerEl, menu);
            };

            searchInput.addEventListener('input', runFilter);

            searchClearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                searchInput.value = '';
                searchInput.focus();
                runFilter();
            });

            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    // Select first visible item
                    const firstVisible = Array.from(itemsList.querySelectorAll('.wtrack-dropdown-item'))
                        .find(it => it.style.display !== 'none');
                    if (firstVisible) {
                        firstVisible.click();
                    }
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    closeActiveDropdown();
                }
            });
        }

        document.body.appendChild(menu);
        triggerEl.classList.add('active');
        activeMenu = menu;
        activeTrigger = triggerEl;

        positionMenu(triggerEl, menu);

        // Auto-focus search input
        if (searchInput) {
            setTimeout(() => {
                searchInput.focus();
            }, 30);
        }
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
