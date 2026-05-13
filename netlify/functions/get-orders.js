const { preflight, ok, err, getBase, verifyToken, fetchAll, escapeFormulaValue } = require('./_shared');

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  const decoded = verifyToken(event);
  if (!decoded) return err('Unauthorized', 401);
  try {
    const base = getBase();
    const safe = escapeFormulaValue(decoded.email.toLowerCase());
    const records = await fetchAll(base('Orders'), {
      filterByFormula: `LOWER({UserEmail}) = '${safe}'`,
      sort: [{ field: 'OrderDate', direction: 'desc' }]
    });
    const orders = records.map(r => ({
      id: r.id,
      orderNumber: r.fields.OrderNumber,
      itemsList: r.fields.ItemsList || '',
      subtotal: r.fields.Subtotal || 0,
      tax: r.fields.Tax || 0,
      total: r.fields.Total || 0,
      pointsEarned: r.fields.PointsEarned || 0,
      pointsRedeemed: r.fields.PointsRedeemed || 0,
      status: r.fields.Status || 'Pending',
      fulfillmentMethod: r.fields.FulfillmentMethod || '',
      orderDate: r.fields.OrderDate || '',
      trackingNumber: r.fields.TrackingNumber || ''
    }));
    return ok({ orders });
  } catch (e) {
    console.error('get-orders error', e);
    return err('Could not fetch orders', 500);
  }
};
