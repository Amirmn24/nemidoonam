(() => {
  const stage = document.getElementById('auth-stage');
  if (!stage) return;

  const loginUrl = stage.dataset.loginUrl;
  const signupUrl = stage.dataset.signupUrl;
  const forms = {
    login: stage.querySelector('[data-auth-form="login"]'),
    signup: stage.querySelector('[data-auth-form="signup"]'),
  };

  const isMobileLayout = () => window.matchMedia('(max-width: 800px)').matches;

  const focusFirst = (mode) => {
    const form = forms[mode];
    if (!form || form.hidden) return;
    const input = form.querySelector('input:not([type="hidden"])');
    if (input && !isMobileLayout()) {
      input.focus({ preventScroll: true });
    }
  };

  const setMode = (mode, { push = true } = {}) => {
    if (mode !== 'login' && mode !== 'signup') return;
    if (stage.dataset.mode === mode && push) return;

    stage.dataset.mode = mode;

    Object.entries(forms).forEach(([key, form]) => {
      if (!form) return;
      const active = key === mode;
      form.hidden = !active;
      form.setAttribute('aria-hidden', active ? 'false' : 'true');
    });

    document.title = `${mode === 'signup' ? 'ثبت‌نام' : 'ورود'} · کتابخانه`;

    if (push) {
      const url = mode === 'signup' ? signupUrl : loginUrl;
      const next = `${url}${window.location.search}`;
      const current = `${window.location.pathname}${window.location.search}`;
      if (current !== next) {
        history.pushState({ authMode: mode }, '', next);
      }
    }

    if (isMobileLayout()) {
      stage.scrollTo({ top: 0, behavior: 'smooth' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    window.setTimeout(() => focusFirst(mode), 420);
  };

  stage.querySelectorAll('[data-auth-switch]').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      setMode(el.dataset.authSwitch);
    });
  });

  window.addEventListener('popstate', () => {
    const mode = window.location.pathname.includes('/signup') ? 'signup' : 'login';
    setMode(mode, { push: false });
  });
})();
