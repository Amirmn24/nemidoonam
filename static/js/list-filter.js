(() => {
  /**
   * Client-side status filters for list pages.
   * Markup contract:
   *   [data-list-filter]          — filter bar root
   *     data-param                — query param name (default: status)
   *     data-items                — CSS selector for filterable items
   *     data-empty                — CSS selector for empty state
   *     [data-filter]             — chip/button; value="" means all
   *   [data-filter-item]          — each list item
   *     data-status               — status value to match
   *   [data-filter-empty]         — empty state panel
   *     data-msg-all / data-msg-filtered — optional titles
   *     data-desc-all / data-desc-filtered — optional descriptions
   */
  const bars = document.querySelectorAll('[data-list-filter]');
  if (!bars.length) return;

  const readParam = (name) => {
    const params = new URLSearchParams(window.location.search);
    return params.get(name) || '';
  };

  const writeParam = (name, value) => {
    const url = new URL(window.location.href);
    if (value) {
      url.searchParams.set(name, value);
    } else {
      url.searchParams.delete(name);
    }
    window.history.replaceState({}, '', url);
  };

  const applyFilter = (bar, value) => {
    const param = bar.dataset.param || 'status';
    const itemsSelector = bar.dataset.items;
    const emptySelector = bar.dataset.empty;
    if (!itemsSelector) return;

    const root = bar.closest('section') || document;
    const items = root.querySelectorAll(itemsSelector);
    const empty = emptySelector ? root.querySelector(emptySelector) : null;

    let visible = 0;
    items.forEach((item) => {
      const match = !value || item.dataset.status === value;
      item.hidden = !match;
      if (match) visible += 1;
    });

    bar.querySelectorAll('[data-filter]').forEach((chip) => {
      const active = (chip.dataset.filter || '') === value;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    if (empty) {
      empty.hidden = visible > 0;
      const title = empty.querySelector('[data-empty-title]');
      const desc = empty.querySelector('[data-empty-desc]');
      if (title) {
        title.textContent = value
          ? empty.dataset.msgFiltered || title.textContent
          : empty.dataset.msgAll || title.textContent;
      }
      if (desc) {
        desc.textContent = value
          ? empty.dataset.descFiltered || desc.textContent
          : empty.dataset.descAll || desc.textContent;
      }
      const reset = empty.querySelector('[data-filter-reset]');
      if (reset) {
        reset.hidden = !value;
      }
    }

    writeParam(param, value);
  };

  bars.forEach((bar) => {
    const param = bar.dataset.param || 'status';
    const initial = readParam(param);

    bar.querySelectorAll('[data-filter]').forEach((chip) => {
      chip.setAttribute('role', 'button');
      chip.setAttribute('tabindex', '0');
      chip.setAttribute('aria-pressed', 'false');

      const activate = (event) => {
        event.preventDefault();
        applyFilter(bar, chip.dataset.filter || '');
      };

      chip.addEventListener('click', activate);
      chip.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          activate(event);
        }
      });
    });

    const section = bar.closest('section') || document;
    section.querySelectorAll('[data-filter-reset]').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        applyFilter(bar, '');
      });
    });

    applyFilter(bar, initial);
  });
})();
