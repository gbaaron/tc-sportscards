// TC Sports Cards API singleton — all backend calls go through this.
(function () {
  const KEY_TOKEN = 'tc_token';
  const KEY_USER = 'tc_user';

  async function request(endpoint, options = {}) {
    const token = localStorage.getItem(KEY_TOKEN);
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`/api/${endpoint}`, { ...options, headers });
    let data = null;
    try { data = await res.json(); } catch (_) { data = {}; }
    if (!res.ok) {
      const msg = data && data.error ? data.error : `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return data;
  }

  const TCApi = {
    // ---- Auth ----
    async signup(payload) {
      const data = await request('signup', { method: 'POST', body: JSON.stringify(payload) });
      localStorage.setItem(KEY_TOKEN, data.token);
      localStorage.setItem(KEY_USER, JSON.stringify(data.user));
      window.dispatchEvent(new CustomEvent('authStateChanged', { detail: { loggedIn: true, user: data.user } }));
      return data;
    },
    async login(email, password) {
      const data = await request('login', { method: 'POST', body: JSON.stringify({ email, password }) });
      localStorage.setItem(KEY_TOKEN, data.token);
      localStorage.setItem(KEY_USER, JSON.stringify(data.user));
      window.dispatchEvent(new CustomEvent('authStateChanged', { detail: { loggedIn: true, user: data.user } }));
      return data;
    },
    logout() {
      localStorage.removeItem(KEY_TOKEN);
      localStorage.removeItem(KEY_USER);
      window.dispatchEvent(new CustomEvent('authStateChanged', { detail: { loggedIn: false } }));
    },
    isLoggedIn() { return !!localStorage.getItem(KEY_TOKEN); },
    getCurrentUser() { try { return JSON.parse(localStorage.getItem(KEY_USER) || 'null'); } catch (_) { return null; } },
    setCurrentUser(u) { localStorage.setItem(KEY_USER, JSON.stringify(u)); },

    // ---- User ----
    getUser() { return request('get-user'); },
    updateUser(payload) { return request('update-user', { method: 'POST', body: JSON.stringify(payload) }); },
    changePassword(currentPassword, newPassword) {
      return request('change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
    },

    // ---- Products ----
    getProducts() { return request('get-products'); },

    // ---- Orders ----
    createOrder(payload) { return request('create-order', { method: 'POST', body: JSON.stringify(payload) }); },
    getOrders() { return request('get-orders'); },

    // ---- Ratings ----
    rateProduct(productId, stars, comment) {
      return request('rate-product', { method: 'POST', body: JSON.stringify({ productId, stars, comment }) });
    },
    getUserRatings() { return request('get-ratings'); },
    getRecommendations() { return request('get-recommendations'); },

    // ---- Rewards / Gift cards ----
    getTiers() { return request('get-tiers'); },
    redeemGiftCard(pointsAmount) {
      return request('redeem-gift-card', { method: 'POST', body: JSON.stringify({ pointsAmount }) });
    },
    getGiftCards() { return request('get-gift-cards'); },

    // ---- Site config ----
    getSiteConfig() { return request('get-site-config'); },
    getSiteImages() { return request('get-site-images'); },

    // ---- Admin ----
    adminProducts(action, id, fields) {
      return request('admin-products', { method: 'POST', body: JSON.stringify({ action, id, fields }) });
    },
    adminGetOrders() { return request('admin-orders'); },
    adminUpdateOrder(payload) { return request('admin-orders', { method: 'POST', body: JSON.stringify(payload) }); },
    adminGetGiftCards() { return request('admin-gift-cards'); },
    adminUpdateGiftCard(payload) { return request('admin-gift-cards', { method: 'POST', body: JSON.stringify(payload) }); },
    adminStats() { return request('admin-stats'); }
  };

  window.TCApi = TCApi;
})();
