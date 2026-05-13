const { preflight, ok, err, getBase, verifyToken, findUserByEmail, fetchAll, escapeFormulaValue } = require('./_shared');

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);
  const decoded = verifyToken(event);
  if (!decoded) return err('Unauthorized', 401);
  try {
    const { productId, stars, comment } = JSON.parse(event.body || '{}');
    if (!productId || !stars) return err('Product and rating required.');
    const s = parseInt(stars, 10);
    if (s < 1 || s > 5) return err('Rating must be 1-5 stars.');
    const base = getBase();
    const user = await findUserByEmail(base, decoded.email);
    if (!user) return err('User not found', 404);
    const product = await base('Products').find(productId).catch(() => null);
    if (!product) return err('Product not found', 404);

    const safeUid = escapeFormulaValue(user.id);
    const safePid = escapeFormulaValue(productId);
    const existing = await base('Ratings').select({
      filterByFormula: `AND({UserID} = '${safeUid}', {ProductID} = '${safePid}')`,
      maxRecords: 1
    }).firstPage();

    const now = new Date().toISOString();
    if (existing.length) {
      await base('Ratings').update([{
        id: existing[0].id,
        fields: { Stars: s, Comment: comment || '', UpdatedAt: now }
      }]);
    } else {
      await base('Ratings').create([{
        fields: {
          UserID: user.id,
          UserEmail: user.fields.Email,
          ProductID: productId,
          ProductName: product.fields.Name || '',
          Stars: s,
          Comment: comment || '',
          CreatedAt: now,
          UpdatedAt: now
        }
      }]);
    }

    // Recompute product avg + count
    const allRatings = await fetchAll(base('Ratings'), {
      filterByFormula: `{ProductID} = '${safePid}'`
    });
    const count = allRatings.length;
    const avg = count > 0 ? allRatings.reduce((sum, r) => sum + (r.fields.Stars || 0), 0) / count : 0;
    await base('Products').update([{
      id: productId,
      fields: { AvgRating: +avg.toFixed(2), RatingCount: count }
    }]);

    return ok({ success: true, avgRating: +avg.toFixed(2), ratingCount: count });
  } catch (e) {
    console.error('rate-product error', e);
    return err('Could not save rating', 500);
  }
};
