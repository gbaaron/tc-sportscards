// Client-side cart, stored in localStorage. tc_cart = [{id, name, price, quantity, imageURL, bonusPoints, stock}]
(function () {
  const KEY = 'tc_cart';

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { return []; } }
  function save(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('cartChanged', { detail: { items } }));
  }

  const Cart = {
    items() { return load(); },
    count() { return load().reduce((s, i) => s + (i.quantity || 1), 0); },
    subtotal() { return load().reduce((s, i) => s + (i.price * (i.quantity || 1)), 0); },
    bonusPoints() { return load().reduce((s, i) => s + ((i.bonusPoints || 0) * (i.quantity || 1)), 0); },
    add(product, qty = 1) {
      const items = load();
      const existing = items.find(i => i.id === product.id);
      if (existing) {
        existing.quantity = (existing.quantity || 1) + qty;
        if (product.stock && existing.quantity > product.stock) existing.quantity = product.stock;
      } else {
        items.push({
          id: product.id,
          name: product.name,
          price: product.price,
          imageURL: product.imageURL || '',
          bonusPoints: product.bonusPoints || 0,
          stock: product.stock || 999,
          quantity: qty
        });
      }
      save(items);
    },
    updateQty(id, qty) {
      const items = load();
      const it = items.find(i => i.id === id);
      if (!it) return;
      it.quantity = Math.max(1, Math.min(it.stock || 999, parseInt(qty, 10) || 1));
      save(items);
    },
    remove(id) {
      save(load().filter(i => i.id !== id));
    },
    clear() { save([]); }
  };

  window.Cart = Cart;
})();
