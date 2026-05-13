const { preflight, ok, err, getBase, verifyToken, findUserByEmail, fetchAll, escapeFormulaValue } = require('./_shared');

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  const decoded = verifyToken(event);
  if (!decoded) return err('Unauthorized', 401);
  try {
    const base = getBase();
    const user = await findUserByEmail(base, decoded.email);
    if (!user) return err('User not found', 404);
    const safe = escapeFormulaValue(user.id);
    const records = await fetchAll(base('Ratings'), {
      filterByFormula: `{UserID} = '${safe}'`,
      sort: [{ field: 'UpdatedAt', direction: 'desc' }]
    });
    const ratings = records.map(r => ({
      id: r.id,
      productId: r.fields.ProductID,
      productName: r.fields.ProductName,
      stars: r.fields.Stars,
      comment: r.fields.Comment || '',
      updatedAt: r.fields.UpdatedAt
    }));
    return ok({ ratings });
  } catch (e) {
    console.error('get-ratings error', e);
    return err('Could not fetch ratings', 500);
  }
};
