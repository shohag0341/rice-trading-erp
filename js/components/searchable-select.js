// Turns a plain <select> into a searchable/filterable dropdown (type to filter, like a search box).
// The original <select> stays in the DOM as the source of truth (hidden visually) so all existing
// code that reads/sets `.value` or listens for 'change' on it keeps working unchanged.
export function makeSearchable(selectId, options = {}) {
    const select = document.getElementById(selectId);
    if (!select) return null;

    const placeholder = options.placeholder || 'Search...';

    const wrapper = document.createElement('div');
    wrapper.className = 'searchable-select-wrapper';
    wrapper.innerHTML = `
        <div class="searchable-select-input-box">
            <input type="text" class="searchable-select-input" placeholder="${placeholder}" autocomplete="off">
            <i class="fa-solid fa-chevron-down searchable-select-arrow"></i>
        </div>
        <div class="searchable-select-dropdown"></div>
    `;
    select.insertAdjacentElement('afterend', wrapper);
    select.classList.add('searchable-select-hidden-native');

    const input = wrapper.querySelector('.searchable-select-input');
    const dropdown = wrapper.querySelector('.searchable-select-dropdown');

    function getOptionItems() {
        return Array.from(select.options).filter(o => o.value !== '');
    }

    function currentLabel() {
        const opt = select.options[select.selectedIndex];
        return (opt && opt.value !== '') ? opt.textContent.trim() : '';
    }

    function renderList(filterText = '') {
        const items = getOptionItems();
        const filtered = filterText
            ? items.filter(o => o.textContent.toLowerCase().includes(filterText.toLowerCase()))
            : items;

        if (!filtered.length) {
            dropdown.innerHTML = `<div class="searchable-select-empty">No match found</div>`;
            return;
        }

        dropdown.innerHTML = filtered.map(o => `
            <div class="searchable-select-item ${o.value === select.value ? 'selected' : ''}" data-value="${o.value}">
                ${o.textContent}
            </div>
        `).join('');

        dropdown.querySelectorAll('.searchable-select-item').forEach(item => {
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                select.value = item.dataset.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                input.value = item.textContent.trim();
                closeDropdown();
            });
        });
    }

    function openDropdown() {
        renderList('');
        dropdown.classList.add('open');
        wrapper.classList.add('open');
    }

    function closeDropdown() {
        dropdown.classList.remove('open');
        wrapper.classList.remove('open');
    }

    input.addEventListener('focus', () => {
        input.value = '';
        openDropdown();
    });

    input.addEventListener('input', () => {
        renderList(input.value);
        dropdown.classList.add('open');
        wrapper.classList.add('open');
    });

    input.addEventListener('blur', () => {
        setTimeout(() => {
            input.value = currentLabel();
            closeDropdown();
        }, 150);
    });

    input.value = currentLabel();

    return {
        // Call this whenever the underlying <select>'s value or option list
        // changes from outside code (edit mode, form reset, options reloaded).
        refresh() {
            input.value = currentLabel();
        }
    };
      }
