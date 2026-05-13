const {
  preflight, ok, err, getBase, verifyToken, findUserByEmail,
  getTierForPoints, genOrderNumber
} = require('./_shared');

const TAX_RATE = 0.06; // Michigan state sales tax

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);
  const decoded = verifyToken(event);
  if (!decoded) return err('You must be logged in to order. Online exclusives are for members only.', 401);
  try {
    const {
      items,          // [{ id, name, price, quantity, bonusPoints }]
      fulfillmentMethod, // 'In-Store Pickup' | 'Local Delivery' | 'Shipping'
      shippingAddress,
      contactPhone,
      notes,
      pointsToRedeem  // optional integer points to apply at $0.01 per point... actually 100pts = $1 below
    } = JSON.parse(event.body || '{}');
    if (!Array.isArray(items) || items.length === 0) return err('No items in cart.');
    if (!fulfillmentMethod) return err('Please select a fulfillment method.');

    const base = getBase();
    const user = await findUserByEmail(base, decoded.email);
    if (!user) return err('User not found', 404);

    // Recompute totals server-side. Never trust client.
    const productIds = items.map(i => i.id);
    const fetched = await Promise.all(productIds.map(id => base('Products').find(id).catch(() => null)));
    const itemsList = [];
    let subtotal = 0;
    let baseBonusPoints = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const p = fetched[i];
      if (!p) return err(`Product ${it.id} not available.`);
      if (!p.fields.IsAvailable) return err(`${p.fields.Name} is no longer available.`);
      const qty = Math.max(1, parseInt(it.quantity, 10) || 1);
      if ((p.fields.Stock || 0) > 0 && qty > p.fields.Stock) {
        return err(`Only ${p.fields.Stock} of ${p.fields.Name} in stock.`);
      }
      const price = p.fields.Price || 0;
      subtotal += price * qty;
      baseBonusPoints += (p.fields.BonusPoints || 0) * qty;
      itemsList.push(`${qty} x ${p.fields.Name} @ $${price.toFixed(2)}`);
    }

    // Points redemption: 100 points = $1 store credit toward order
    const redeemPts = Math.max(0, parseInt(pointsToRedeem, 10) || 0);
    const userPts = user.fields.Points || 0;
    if (redeemPts > userPts) return err('You do not have enough points to redeem that much.');
    const redeemValue = Math.floor(redeemPts / 100); // dollars
    const cappedRedeem = Math.min(redeemValue, subtotal); // can't exceed subtotal
    const actualPtsUsed = cappedRedeem * 100;

    const tax = +(subtotal * TAX_RATE).toFixed(2);
    const total = +(subtotal + tax - cappedRedeem).toFixed(2);

    // Points earned: tier multiplier applied to (subtotal in dollars) + product bonus points
    const tier = await getTierForPoints(base, userPts);
    const pointsFromSpend = Math.floor(subtotal) * (tier.multiplier || 1);
    const pointsEarned = Math.floor(pointsFromSpend + baseBonusPoints);

    const orderNumber = genOrderNumber();
    const orderDate = new Date().toISOString();

    await base('Orders').create([{
      fields: {
        OrderNumber: orderNumber,
        UserEmail: user.fields.Email,
        UserName: user.fields.Name || '',
        Items: JSON.stringify(items),
        ItemsList: itemsList.join('\n'),
        Subtotal: +subtotal.toFixed(2),
        Tax: tax,
        Total: total,
        PointsEarned: pointsEarned,
        PointsRedeemed: actualPtsUsed,
        Status: 'Pending',
        FulfillmentMethod: fulfillmentMethod,
        ShippingAddress: shippingAddress || '',
        ContactPhone: contactPhone || user.fields.Phone || '',
        OrderDate: orderDate,
        Notes: notes || ''
      }
    }]);

    // Update user: points balance, total spent, decrement stock
    const newPoints = (userPts - actualPtsUsed) + pointsEarned;
    const newSpent = (user.fields.TotalSpent || 0) + total;
    const newTier = await getTierForPoints(base, newPoints);
    await base('Users').update([{
      id: user.id,
      fields: { Points: newPoints, TotalSpent: +newSpent.toFixed(2), TierLevel: newTier.name }
    }]);

    // Decrement product stock (rate-limited)
    for (let i = 0; i < fetched.length; i++) {
      const p = fetched[i];
      const qty = Math.max(1, parseInt(items[i].quantity, 10) || 1);
      if ((p.fields.Stock || 0) > 0) {
        await base('Products').update([{ id: p.id, fields: { Stock: Math.max(0, (p.fields.Stock || 0) - qty) } }]);
        await new Promise(r => setTimeout(r, 250));
      }
    }

    return ok({
      orderNumber,
      subtotal: +subtotal.toFixed(2),
      tax,
      total,
      pointsEarned,
      pointsRedeemed: actualPtsUsed,
      newPointBalance: newPoints,
      newTier: newTier.name
    });
  } catch (e) {
    console.error('create-order error', e);
    return err('Could not place order', 500);
  }
};
