const { preflight, ok, err, getBase, verifyToken, fetchAll, escapeFormulaValue } = require('./_shared');

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  const decoded = verifyToken(event);
  if (!decoded) return err('Unauthorized', 401);
  try {
    const base = getBase();
    const safe = escapeFormulaValue(decoded.email.toLowerCase());
    const records = await fetchAll(base('GiftCardRedemptions'), {
      filterByFormula: `LOWER({UserEmail}) = '${safe}'`,
      sort: [{ field: 'RequestedAt', direction: 'desc' }]
    });
    const cards = records.map(r => ({
      id: r.id,
      code: r.fields.RedemptionCode,
      pointsRedeemed: r.fields.PointsRedeemed || 0,
      value: r.fields.GiftCardValue || 0,
      status: r.fields.Status || 'Pending',
      requestedAt: r.fields.RequestedAt || '',
      issuedAt: r.fields.IssuedAt || '',
      usedAt: r.fields.UsedAt || ''
    }));
    return ok({ giftCards: cards });
  } catch (e) {
    console.error('get-gift-cards error', e);
    return err('Could not fetch gift cards', 500);
  }
};
