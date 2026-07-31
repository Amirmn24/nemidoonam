(() => {
  const STORAGE_KEY = 'nemidoonam.sidebarCollapsed';
  const MOBILE_MQ = '(max-width: 900px)';

  const sidebar = document.querySelector('[data-sidebar]');
  const header = document.querySelector('[data-site-header]');
  const body = document.body;

  const syncHeaderHeight = () => {
    if (!header) return;
    const height = Math.ceil(header.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--header-height', `${height}px`);
  };

  syncHeaderHeight();
  window.addEventListener('resize', syncHeaderHeight);
  if (typeof ResizeObserver !== 'undefined' && header) {
    new ResizeObserver(syncHeaderHeight).observe(header);
  }

  if (!sidebar) return;

  const toggleBtns = document.querySelectorAll('[data-sidebar-toggle]');
  const collapseBtn = document.querySelector('[data-sidebar-collapse]');
  const closeBtn = document.querySelector('[data-sidebar-close]');
  const backdrop = document.querySelector('[data-sidebar-backdrop]');

  const isMobile = () => window.matchMedia(MOBILE_MQ).matches;

  const setToggleExpanded = (expanded) => {
    toggleBtns.forEach((btn) => {
      btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      btn.classList.toggle('is-active', expanded);
    });
  };

  const setCollapsed = (collapsed) => {
    body.classList.toggle('sidebar-collapsed', collapsed);
    sidebar.dataset.collapsed = collapsed ? 'true' : 'false';
    if (collapseBtn) {
      collapseBtn.setAttribute(
        'aria-label',
        collapsed ? 'باز کردن سایدبار' : 'جمع‌کردن سایدبار',
      );
      collapseBtn.title = collapsed ? 'باز کردن' : 'جمع‌کردن';
    }
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch (_) {
      /* ignore */
    }
  };

  const openMobile = () => {
    body.classList.add('sidebar-open');
    if (backdrop) backdrop.hidden = false;
    setToggleExpanded(true);
    document.documentElement.style.overflow = 'hidden';
  };

  const closeMobile = () => {
    body.classList.remove('sidebar-open');
    if (backdrop) backdrop.hidden = true;
    setToggleExpanded(false);
    document.documentElement.style.overflow = '';
  };

  const initCollapsed = () => {
    // پیش‌فرض: سایدبار جمع → محتوا تمام‌عرض
    let collapsed = true;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === '0') collapsed = false;
      else if (stored === '1') collapsed = true;
    } catch (_) {
      collapsed = true;
    }
    if (!isMobile()) {
      setCollapsed(collapsed);
    }
  };

  toggleBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (isMobile()) {
        if (body.classList.contains('sidebar-open')) {
          closeMobile();
        } else {
          openMobile();
        }
        return;
      }
      setCollapsed(!body.classList.contains('sidebar-collapsed'));
    });
  });

  if (collapseBtn) {
    collapseBtn.addEventListener('click', () => {
      if (isMobile()) {
        closeMobile();
        return;
      }
      setCollapsed(!body.classList.contains('sidebar-collapsed'));
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeMobile);
  }

  if (backdrop) {
    backdrop.addEventListener('click', closeMobile);
  }

  sidebar.querySelectorAll('[data-sidebar-link]').forEach((link) => {
    link.addEventListener('click', () => {
      if (isMobile()) closeMobile();
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && body.classList.contains('sidebar-open')) {
      closeMobile();
    }
  });

  window.matchMedia(MOBILE_MQ).addEventListener('change', () => {
    closeMobile();
    if (!isMobile()) {
      initCollapsed();
    } else {
      body.classList.remove('sidebar-collapsed');
    }
    syncHeaderHeight();
  });

  initCollapsed();
})();
