/**
 * Book form: title/author suggestions only autocomplete; shelf add happens on save.
 */
(function () {
  const form = document.getElementById('book-form');
  if (!form) return;

  const suggestUrl = form.dataset.suggestUrl;
  const excludePk = form.dataset.excludePk || '';
  const titleInput = form.querySelector('[data-book-title]');
  const authorInput = form.querySelector('[data-book-author]');
  const pagesInput = form.querySelector('#id_total_pages');
  const catalogInput = form.querySelector('#id_catalog_book_id');

  const booksPanel = form.querySelector('[data-suggest-panel="books"]');
  const authorsPanel = form.querySelector('[data-suggest-panel="authors"]');
  const booksList = form.querySelector('[data-suggest-list="books"]');
  const authorsList = form.querySelector('[data-suggest-list="authors"]');
  const matchPanel = form.querySelector('[data-book-suggest]');
  const matchList = form.querySelector('[data-suggest-list="match"]');

  if (!suggestUrl || !titleInput || !authorInput) return;

  let timer = null;
  let controller = null;
  let activeScope = null;

  function hidePanel(panel) {
    if (!panel) return;
    panel.hidden = true;
    const list = panel.querySelector('[data-suggest-list]');
    if (list) list.innerHTML = '';
  }

  function hideAllSuggest() {
    hidePanel(booksPanel);
    hidePanel(authorsPanel);
  }

  function hideMatch() {
    if (!matchPanel || !matchList) return;
    matchPanel.hidden = true;
    matchList.innerHTML = '';
  }

  function fillBook(item) {
    if (item.title) titleInput.value = item.title;
    if (item.author) authorInput.value = item.author;
    if (pagesInput && item.total_pages) pagesInput.value = item.total_pages;
    if (catalogInput) {
      catalogInput.value = item.id ? String(item.id) : '';
    }
    hideAllSuggest();
    hideMatch();
    titleInput.focus();
  }

  function fillAuthor(name) {
    authorInput.value = name || '';
    if (catalogInput) catalogInput.value = '';
    hideAllSuggest();
    authorInput.focus();
  }

  function makeItemShell() {
    const wrap = document.createElement('span');
    wrap.className = 'book-suggest-copy';
    wrap.innerHTML = '<strong></strong><small></small>';
    const badge = document.createElement('span');
    badge.className = 'book-suggest-badge';
    return { wrap, badge };
  }

  function renderBookResults(results) {
    if (!booksPanel || !booksList) return;
    booksList.innerHTML = '';
    hidePanel(authorsPanel);
    if (!results.length) {
      hidePanel(booksPanel);
      return;
    }

    results.forEach((item) => {
      const li = document.createElement('li');
      const onShelf = Boolean(item.on_shelf);
      const { wrap, badge } = makeItemShell();
      wrap.querySelector('strong').textContent = item.title;
      wrap.querySelector('small').textContent =
        item.author + ' · ' + (item.source_label || '');

      if (onShelf && item.detail_url) {
        const link = document.createElement('a');
        link.className = 'book-suggest-item';
        link.href = item.detail_url;
        badge.textContent = 'باز کردن';
        link.appendChild(wrap);
        link.appendChild(badge);
        li.appendChild(link);
      } else {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'book-suggest-item';
        badge.textContent = 'انتخاب';
        btn.appendChild(wrap);
        btn.appendChild(badge);
        btn.addEventListener('click', () => fillBook(item));
        li.appendChild(btn);
      }
      booksList.appendChild(li);
    });
    booksPanel.hidden = false;
  }

  function renderAuthorResults(results) {
    if (!authorsPanel || !authorsList) return;
    authorsList.innerHTML = '';
    hidePanel(booksPanel);
    if (!results.length) {
      hidePanel(authorsPanel);
      return;
    }

    results.forEach((item) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'book-suggest-item';
      const { wrap, badge } = makeItemShell();
      wrap.querySelector('strong').textContent = item.author;
      wrap.querySelector('small').textContent = item.source_label || 'نویسنده ثبت‌شده';
      badge.textContent = 'انتخاب';
      btn.appendChild(wrap);
      btn.appendChild(badge);
      btn.addEventListener('click', () => fillAuthor(item.author));
      li.appendChild(btn);
      authorsList.appendChild(li);
    });
    authorsPanel.hidden = false;
  }

  function renderMatchResults(results) {
    if (!matchPanel || !matchList) return;
    matchList.innerHTML = '';
    if (!results.length) {
      hideMatch();
      return;
    }

    results.forEach((item) => {
      const li = document.createElement('li');
      const onShelf = Boolean(item.on_shelf);
      const { wrap, badge } = makeItemShell();
      wrap.querySelector('strong').textContent = item.title;
      wrap.querySelector('small').textContent =
        item.author + ' · ' + (item.source_label || '');

      if (onShelf && item.detail_url) {
        const link = document.createElement('a');
        link.className = 'book-suggest-item';
        link.href = item.detail_url;
        badge.textContent = 'باز کردن';
        link.appendChild(wrap);
        link.appendChild(badge);
        li.appendChild(link);
      } else {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'book-suggest-item';
        badge.textContent = 'انتخاب';
        btn.appendChild(wrap);
        btn.appendChild(badge);
        btn.addEventListener('click', () => fillBook(item));
        li.appendChild(btn);
      }
      matchList.appendChild(li);
    });
    matchPanel.hidden = false;
  }

  async function fetchScope(scope, query) {
    if (controller) controller.abort();
    controller = new AbortController();
    activeScope = scope;
    const url = new URL(suggestUrl, window.location.origin);
    url.searchParams.set('q', query);
    url.searchParams.set('scope', scope);
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      credentials: 'same-origin',
    });
    if (!res.ok || activeScope !== scope) return;
    const data = await res.json();
    const results = data.results || [];
    if (scope === 'authors') renderAuthorResults(results);
    else renderBookResults(results);
  }

  async function fetchMatches() {
    const title = titleInput.value.trim();
    const author = authorInput.value.trim();
    if (title.length < 2 || author.length < 2) {
      hideMatch();
      return;
    }

    if (controller) controller.abort();
    controller = new AbortController();
    const url = new URL(suggestUrl, window.location.origin);
    url.searchParams.set('mode', 'match');
    url.searchParams.set('title', title);
    url.searchParams.set('author', author);
    if (excludePk) url.searchParams.set('exclude', excludePk);

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      credentials: 'same-origin',
    });
    if (!res.ok) return;
    const data = await res.json();
    renderMatchResults(data.results || []);
  }

  function scheduleSearch(scope) {
    const input = scope === 'authors' ? authorInput : titleInput;
    const query = input.value.trim();
    clearTimeout(timer);
    if (catalogInput && scope === 'books') catalogInput.value = '';

    if (query.length < 2) {
      if (scope === 'authors') hidePanel(authorsPanel);
      else hidePanel(booksPanel);
      if (titleInput.value.trim().length >= 2 && authorInput.value.trim().length >= 2) {
        timer = setTimeout(() => fetchMatches().catch(() => {}), 280);
      }
      return;
    }

    timer = setTimeout(() => {
      fetchScope(scope, query).catch(() => {});
    }, 200);
  }

  titleInput.addEventListener('input', () => scheduleSearch('books'));
  authorInput.addEventListener('input', () => scheduleSearch('authors'));
  titleInput.addEventListener('focus', () => {
    if (titleInput.value.trim().length >= 2) scheduleSearch('books');
  });
  authorInput.addEventListener('focus', () => {
    if (authorInput.value.trim().length >= 2) scheduleSearch('authors');
  });
  titleInput.addEventListener('blur', () => {
    setTimeout(() => {
      hidePanel(booksPanel);
      if (titleInput.value.trim().length >= 2 && authorInput.value.trim().length >= 2) {
        fetchMatches().catch(() => {});
      }
    }, 160);
  });
  authorInput.addEventListener('blur', () => {
    setTimeout(() => {
      hidePanel(authorsPanel);
      if (titleInput.value.trim().length >= 2 && authorInput.value.trim().length >= 2) {
        fetchMatches().catch(() => {});
      }
    }, 160);
  });

  form.addEventListener('click', (event) => {
    const fillBtn = event.target.closest('[data-fill-book]');
    if (!fillBtn) return;
    const item = {
      id: fillBtn.dataset.id,
      title: fillBtn.dataset.title,
      author: fillBtn.dataset.author,
      total_pages: fillBtn.dataset.pages,
      on_shelf: fillBtn.dataset.onShelf === '1',
      detail_url: fillBtn.dataset.detailUrl,
    };
    if (item.on_shelf && item.detail_url) {
      window.location.href = item.detail_url;
      return;
    }
    fillBook(item);
  });

  document.addEventListener('click', (event) => {
    if (!form.contains(event.target)) hideAllSuggest();
  });
})();
