// Auth-aware nav updates, SiteConfig hydration, cart-count badge wiring
(function () {
  function applySiteConfig(config) {
    document.querySelectorAll('[data-config]').forEach(el => {
      const k = el.getAttribute('data-config');
      if (config[k]) el.textContent = config[k];
    });
    document.querySelectorAll('[data-config-href]').forEach(el => {
      const k = el.getAttribute('data-config-href');
      if (config[k]) el.setAttribute('href', config[k]);
    });
  }

  function applySiteImages(images) {
    document.querySelectorAll('[data-image-slot]').forEach(el => {
      const k = el.getAttribute('data-image-slot');
      if (images[k] && images[k].url) {
        if (el.tagName === 'IMG') {
          el.src = images[k].url;
          el.alt = images[k].alt || '';
        } else {
          el.style.backgroundImage = `url('${images[k].url}')`;
        }
      }
    });
  }

  function updateNav() {
    const user = window.TCApi && window.TCApi.getCurrentUser();
    const loggedIn = !!user;
    document.querySelectorAll('[data-guest]').forEach(el => { el.style.display = loggedIn ? 'none' : ''; });
    document.querySelectorAll('[data-auth]').forEach(el => { el.style.display = loggedIn ? '' : 'none'; });
    document.querySelectorAll('[data-admin]').forEach(el => { el.style.display = (loggedIn && user.isAdmin) ? '' : 'none'; });
    document.querySelectorAll('[data-user-name]').forEach(el => { el.textContent = loggedIn ? user.name : ''; });
    document.querySelectorAll('[data-user-points]').forEach(el => { el.textContent = loggedIn ? (user.points || 0).toLocaleString() : '0'; });
    document.querySelectorAll('[data-user-tier]').forEach(el => { el.textContent = loggedIn ? (user.tier || 'Rookie') : ''; });
  }

  function updateCartBadge() {
    const count = window.Cart ? window.Cart.count() : 0;
    document.querySelectorAll('[data-cart-count]').forEach(el => {
      el.textContent = count;
      el.style.display = count > 0 ? '' : 'none';
    });
  }

  window.addEventListener('authStateChanged', updateNav);
  window.addEventListener('cartChanged', updateCartBadge);
  window.addEventListener('storage', (e) => {
    if (e.key === 'tc_user' || e.key === 'tc_token') updateNav();
    if (e.key === 'tc_cart') updateCartBadge();
  });

  window.TCAuth = {
    async init() {
      updateNav();
      updateCartBadge();
      // Wire logout buttons
      document.querySelectorAll('[data-logout]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          window.TCApi.logout();
          window.location.href = '/';
        });
      });
      // Load + apply SiteConfig + SiteImages
      try {
        const [{ config }, { images }] = await Promise.all([
          window.TCApi.getSiteConfig(),
          window.TCApi.getSiteImages()
        ]);
        applySiteConfig(config || {});
        applySiteImages(images || {});
      } catch (_) { /* graceful */ }
      // Mobile nav toggle
      const toggle = document.querySelector('[data-mobile-toggle]');
      const menu = document.querySelector('[data-mobile-menu]');
      if (toggle && menu) {
        toggle.addEventListener('click', () => menu.classList.toggle('open'));
      }
    },
    updateNav,
    updateCartBadge
  };
})();
