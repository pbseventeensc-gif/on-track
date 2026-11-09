// Custom Dropdown UI Enhancement (Tablet & Mobile Optimized)
// Replaces native OS <select> popovers with modern, rounded SaaS floating dropdown menus on desktop/tablet
// and smooth Mobile Bottom Sheets on mobile screens, with full touch and viewport resilience.

(function() {
    'use strict';

    let activeMenu = null;
    let activeTrigger = null;
    let activeBackdrop = null;
    let lastWindowWidth = window.innerWidth;
    let lastTriggerTime = 0;

    function isTouchDevice() {
        return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    }

    function closeActiveDropdown() {
        if (activeMenu) {
            if (activeMenu.parentNode) activeMenu.parentNode.removeChild(activeMenu);
            activeMenu = null;
        }
        if (activeBackdrop) {
            if (activeBackdrop.parentNode) activeBackdrop.parentNode.removeChild(activeBackdrop);
            activeBackdrop = null;
        }
        if (activeTrigger) {
            activeTrigger.classList.remove('active');
            activeTrigger = null;
        }
        document.body.classList.remove('wtrack-dropdown-open');
    }

    function getSelectedOptionText(selectEl) {
        if (!selectEl) return '';
        const idx = selectEl.selectedIndex;
        if (idx >= 0 && selectEl.options[idx]) {
            return selectEl.options[idx].text;
        }
        return selectEl.options[0]?.text || '';
    }

    function getDropdownTitle(selectEl) {
        const id = (selectEl.id || '').toLowerCase();
        if (id.includes('carrier') || id.includes('personil') || id.includes('courier')) return 'Pilih Personil / Kurir';
        if (id.includes('status')) return 'Pilih Status Pengiriman';
        if (id.includes('branch')) return 'Pilih Cabang';
        if (id.includes('region')) return 'Pilih Wilayah';
        if (id.includes('vehicle') || id.includes('armada')) return 'Pilih Kendaraan';
        if (id.includes('category')) return 'Pilih Kategori';
        return 'Pilih Opsi';
    }

    function positionMenu(triggerEl, menuEl) {
        if (window.innerWidth <= 640) return; // Mobile uses clean bottom sheet

        const rect = triggerEl.getBoundingClientRect();
        const menuWidth = Math.min(Math.max(rect.width, 240), window.innerWidth - 20);
        menuEl.style.width = menuWidth + 'px';

        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;

        // Clamp horizontally so it stays cleanly on screen
        const leftPos = Math.max(10, Math.min(rect.left, window.innerWidth - menuWidth - 10));
        menuEl.style.left = leftPos + 'px';

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

        const isMobile = window.innerWidth <= 640;
        const isTouch = isTouchDevice();
        const selectId = (selectEl.id || '').toLowerCase();
        const totalOptions = selectEl.options ? selectEl.options.length : 0;
        const hasOptgroups = selectEl.querySelector('optgroup') !== null;
        // Status filter with few options should not have search input
        const isSearchable = !selectId.includes('status') && (totalOptions > 6 || hasOptgroups || selectId.includes('carrier') || selectId.includes('personil') || selectId.includes('courier'));

        // 1. Backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'wtrack-dropdown-backdrop';
        if (isMobile) {
            backdrop.classList.add('wtrack-mobile-backdrop');
        }
        document.body.appendChild(backdrop);
        requestAnimationFrame(() => backdrop.classList.add('show'));

        const dismissHandler = (e) => {
            e.stopPropagation();
            e.preventDefault();
            closeActiveDropdown();
        };
        backdrop.addEventListener('click', dismissHandler);
        backdrop.addEventListener('touchend', dismissHandler);
        activeBackdrop = backdrop;

        // 2. Menu container
        const menu = document.createElement('div');
        menu.className = 'wtrack-custom-dropdown-menu';
        if (isMobile) {
            menu.classList.add('wtrack-mobile-sheet');
            document.body.classList.add('wtrack-dropdown-open');

            // Handle bar
            const handle = document.createElement('div');
            handle.className = 'wtrack-sheet-handle';
            menu.appendChild(handle);

            // Header with title and close button
            const headerWrap = document.createElement('div');
            headerWrap.className = 'wtrack-sheet-header';

            const titleSpan = document.createElement('span');
            titleSpan.className = 'wtrack-sheet-title';
            titleSpan.textContent = getDropdownTitle(selectEl);

            const closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.className = 'wtrack-sheet-close';
            closeBtn.setAttribute('aria-label', 'Tutup');
            closeBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            `;
            closeBtn.addEventListener('click', dismissHandler);
            closeBtn.addEventListener('touchend', dismissHandler);

            headerWrap.appendChild(titleSpan);
            headerWrap.appendChild(closeBtn);
            menu.appendChild(headerWrap);
        }

        // 3. Search input (if applicable)
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
                ? 'Cari nama personil...'
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

        // 4. Scrollable items list
        const itemsList = document.createElement('div');
        itemsList.className = 'wtrack-dropdown-items-list';
        menu.appendChild(itemsList);

        const children = Array.from(selectEl.children);
        const currentVal = selectEl.value;

        function resolveOptionAvatar(opt) {
            if (!opt || !opt.value || opt.value === 'all') return '';
            if (opt.dataset && opt.dataset.avatar) return opt.dataset.avatar;
            const parentGroup = opt.parentElement && opt.parentElement.tagName === 'OPTGROUP' ? (opt.parentElement.label || '').toLowerCase() : '';
            const isCourierSelect = selectId.includes('courier') || selectId.includes('carrier') || selectId.includes('personil') || parentGroup.includes('kurir') || parentGroup.includes('driver');
            if (!isCourierSelect) return '';
            const rawText = (opt.text || opt.label || '').replace(/^[^\wA-Za-z]+/, '').split('(')[0].trim();
            if (typeof window.getCourierPhoto === 'function') {
                const mapped = window.getCourierPhoto(opt.value, rawText);
                if (mapped) return mapped;
            }
            if (rawText) {
                return `https://ui-avatars.com/api/?name=${encodeURIComponent(rawText)}&background=0F172A&color=fff&size=64`;
            }
            return '';
        }

        function renderTriggerContent(triggerBtn, sel) {
            const textEl = triggerBtn.querySelector('.wtrack-select-text');
            if (!textEl) return;
            const selectedOpt = sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
            const labelText = getSelectedOptionText(sel);
            const avatarUrl = resolveOptionAvatar(selectedOpt);
            if (avatarUrl) {
                const cleanName = labelText.replace(/"/g, '&quot;');
                textEl.innerHTML = `<span class="d-inline-flex align-items-center gap-2"><img src="${avatarUrl}" alt="" style="width:20px;height:20px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1px solid #cbd5e1;" onerror="this.src='https://ui-avatars.com/api/?name='+encodeURIComponent('${cleanName}')+'&background=0F172A&color=fff'"><span>${labelText}</span></span>`;
            } else {
                textEl.textContent = labelText;
            }
        }

        function selectOption(opt) {
            const hasChanged = selectEl.value !== opt.value;
            selectEl.value = opt.value;
            renderTriggerContent(triggerEl, selectEl);

            if (hasChanged) {
                selectEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
            closeActiveDropdown();
        }

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

            const labelWrap = document.createElement('span');
            labelWrap.style.display = 'inline-flex';
            labelWrap.style.alignItems = 'center';
            labelWrap.style.gap = '8px';

            const avatarUrl = resolveOptionAvatar(opt);
            if (avatarUrl) {
                const img = document.createElement('img');
                img.src = avatarUrl;
                img.alt = itemText;
                img.style.cssText = 'width: 24px; height: 24px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 1.5px solid #e2e8f0; background: #f8fafc;';
                const fallbackName = itemText.replace(/^[^\wA-Za-z]+/, '').split('(')[0].trim() || 'K';
                img.onerror = function() {
                    this.onerror = null;
                    this.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=0F172A&color=fff&size=64`;
                };
                labelWrap.appendChild(img);
            }

            const labelSpan = document.createElement('span');
            labelSpan.textContent = itemText;
            labelWrap.appendChild(labelSpan);
            item.appendChild(labelWrap);

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

            // Safe touch and click interaction (touchmove displacement avoids accidental selection on scroll)
            let touchStartY = 0;
            let touchMoved = false;

            item.addEventListener('touchstart', (e) => {
                touchStartY = e.touches[0].clientY;
                touchMoved = false;
            }, { passive: true });

            item.addEventListener('touchmove', (e) => {
                if (Math.abs(e.touches[0].clientY - touchStartY) > 10) {
                    touchMoved = true;
                }
            }, { passive: true });

            item.addEventListener('touchend', (e) => {
                if (!touchMoved) {
                    e.preventDefault();
                    e.stopPropagation();
                    selectOption(opt);
                }
            });

            item.addEventListener('click', (e) => {
                e.stopPropagation();
                selectOption(opt);
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

                // Filter direct items
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
                if (!isMobile) positionMenu(triggerEl, menu);
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

        if (!isMobile) {
            positionMenu(triggerEl, menu);
        }

        // Auto-focus search input ONLY on non-touch desktop!
        // On touch devices (mobile & tablet), NEVER auto-focus to prevent the virtual keyboard from popping up and breaking viewport!
        if (searchInput && !isTouch && window.innerWidth > 768) {
            setTimeout(() => {
                searchInput.focus();
            }, 50);
        }
    }

    function updateTriggerTextWithAvatar(selectEl, trigger) {
        if (!selectEl || !trigger) return;
        const textEl = trigger.querySelector('.wtrack-select-text');
        if (!textEl) return;
        const selectedOpt = selectEl.options && selectEl.selectedIndex >= 0 ? selectEl.options[selectEl.selectedIndex] : null;
        const labelText = getSelectedOptionText(selectEl);
        let avatarUrl = '';
        if (selectedOpt && selectedOpt.value && selectedOpt.value !== 'all') {
            if (selectedOpt.dataset && selectedOpt.dataset.avatar) {
                avatarUrl = selectedOpt.dataset.avatar;
            } else {
                const selectId = (selectEl.id || '').toLowerCase();
                const parentGroup = selectedOpt.parentElement && selectedOpt.parentElement.tagName === 'OPTGROUP' ? (selectedOpt.parentElement.label || '').toLowerCase() : '';
                if (selectId.includes('courier') || selectId.includes('carrier') || selectId.includes('personil') || parentGroup.includes('kurir') || parentGroup.includes('driver')) {
                    const rawText = labelText.replace(/^[^\wA-Za-z]+/, '').split('(')[0].trim();
                    if (typeof window.getCourierPhoto === 'function') {
                        avatarUrl = window.getCourierPhoto(selectedOpt.value, rawText) || '';
                    }
                    if (!avatarUrl && rawText) {
                        avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(rawText)}&background=0F172A&color=fff&size=64`;
                    }
                }
            }
        }
        if (avatarUrl) {
            const cleanName = labelText.replace(/"/g, '&quot;');
            const newHtml = `<span class="d-inline-flex align-items-center gap-2"><img src="${avatarUrl}" alt="" style="width:20px;height:20px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1px solid #cbd5e1;" onerror="this.src='https://ui-avatars.com/api/?name='+encodeURIComponent('${cleanName}')+'&background=0F172A&color=fff'"><span>${labelText}</span></span>`;
            if (textEl.innerHTML !== newHtml) {
                textEl.innerHTML = newHtml;
            }
        } else {
            if (textEl.textContent !== labelText) {
                textEl.textContent = labelText;
            }
        }
    }

    function enhanceSelect(selectEl) {
        if (!selectEl || selectEl._wtrackEnhanced) {
            if (selectEl && selectEl._wtrackTrigger) {
                updateTriggerTextWithAvatar(selectEl, selectEl._wtrackTrigger);
            }
            return;
        }

        selectEl.classList.add('wtrack-select-hidden');

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'wtrack-custom-select-trigger';

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

        selectEl.parentNode.insertBefore(trigger, selectEl.nextSibling);

        selectEl._wtrackEnhanced = true;
        selectEl._wtrackTrigger = trigger;
        updateTriggerTextWithAvatar(selectEl, trigger);

        // Toggle dropdown on click / touch with debounce to prevent double-firing
        const handleTrigger = (e) => {
            const now = Date.now();
            if (now - lastTriggerTime < 280) return;
            lastTriggerTime = now;
            e.stopPropagation();
            e.preventDefault();
            openDropdownMenu(selectEl, trigger);
        };

        trigger.addEventListener('touchend', handleTrigger);
        trigger.addEventListener('click', handleTrigger);

        selectEl.addEventListener('change', () => {
            updateTriggerTextWithAvatar(selectEl, trigger);
        });

        const observer = new MutationObserver(() => {
            updateTriggerTextWithAvatar(selectEl, trigger);
        });
        observer.observe(selectEl, { childList: true, subtree: true, attributes: true });
    }

    function initAllCustomSelects() {
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
            '#pool-region-filter',
            '#pool-print-filter',
            '#pool-bulk-courier',
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

        document.querySelectorAll('select.form-select').forEach(el => {
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

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeActiveDropdown();
        }
    });

    // Reposition floating menu on window scroll (desktop/tablet only)
    window.addEventListener('scroll', (e) => {
        if (activeMenu && activeMenu.contains(e.target)) return;
        if (activeMenu && activeTrigger && window.innerWidth > 640) {
            positionMenu(activeTrigger, activeMenu);
        }
    }, { passive: true, capture: true });

    // ONLY close on resize if window width changed significantly (e.g. tablet rotation or desktop resize).
    // NEVER close on height-only changes (which happen when virtual keyboard opens on phone/tablet)!
    window.addEventListener('resize', () => {
        if (Math.abs(window.innerWidth - lastWindowWidth) > 50) {
            lastWindowWidth = window.innerWidth;
            closeActiveDropdown();
        }
    });

    window.wtrackDropdown = {
        enhance: enhanceSelect,
        initAll: initAllCustomSelects,
        close: closeActiveDropdown
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAllCustomSelects);
    } else {
        setTimeout(initAllCustomSelects, 100);
    }

    setInterval(initAllCustomSelects, 1500);

})();
