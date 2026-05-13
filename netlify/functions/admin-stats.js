// Lightweight admin dashboard stats
const { preflight, ok, err, getBase, verifyToken, requireAdmin, fetchAll } = require('./_shared');

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  const decoded = verifyToken(event);
  if (!decoded) return err('Unauthorized', 401);
  const base = getBase();
  if (!(await requireAdmin(base, decoded))) return err('Admin only', 403);
  try {
    const [users, orders, products, giftCards] = await Promise.all([
      fetchAll(base('Users')),
      fetchAll(base('Orders')),
      fetchAll(base('Products')),
      fetchAll(base('GiftCardRedemptions'))
    ]);

    const totalUsers = users.length;
    const totalOrders = orders.length;
    const revenue = orders.reduce((s, o) => s + (o.fields.Total || 0), 0);
    const pointsOutstanding = users.reduce((s, u) => s + (u.fields.Points || 0), 0);
    const pendingOrders = orders.filter(o => o.fields.Status === 'Pending').length;
    const pendingGiftCards = giftCards.filter(g => g.fields.Status === 'Pending').length;
    const lowStock = products.filter(p => p.fields.IsAvailable && (p.fields.Stock || 0) > 0 && (p.fields.Stock || 0) <= 3).length;
    const outOfStock = products.filter(p => p.fields.IsAvailable && (p.fields.Stock || 0) === 0).length;

    // Tier distribution
    const tierCounts = {};
    for (const u of users) {
      const t = u.fields.TierLevel || 'Rookie';
      tierCounts[t] = (tierCounts[t] || 0) + 1;
    }

    // Recent 7-day orders trend
    const now = Date.now();
    const dailyOrders = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 86400000).toISOString().split('T')[0];
      dailyOrders[d] = 0;
    }
    for (const o of orders) {
      const d = (o.fields.OrderDate || '').split('T')[0];
      if (d in dailyOrders) dailyOrders[d]++;
    }

    return ok({
      totals: {
        users: totalUsers,
        orders: totalOrders,
        revenue: +revenue.toFixed(2),
        products: products.length,
        pointsOutstanding,
        pendingOrders,
        pendingGiftCards,
        lowStock,
        outOfStock
      },
      tierCounts,
      dailyOrders
    });
  } catch (e) {
    console.error('admin-stats error', e);
    return err('Could not fetch stats', 500);
  }
};
