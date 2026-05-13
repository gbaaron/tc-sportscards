const { preflight, ok, err, getBase, fetchAll } = require('./_shared');

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  try {
    const base = getBase();
    const records = await fetchAll(base('Products'), {
      filterByFormula: 'AND({IsAvailable} = TRUE())',
      sort: [{ field: 'SortOrder', direction: 'asc' }]
    });
    const products = records.map(r => ({
      id: r.id,
      name: r.fields.Name,
      category: r.fields.Category,
      sport: r.fields.Sport,
      price: r.fields.Price || 0,
      description: r.fields.Description || '',
      imageURL: r.fields.ImageURL || '',
      bonusPoints: r.fields.BonusPoints || 0,
      isOnlineExclusive: !!r.fields.IsOnlineExclusive,
      avgRating: r.fields.AvgRating || 0,
      ratingCount: r.fields.RatingCount || 0,
      year: r.fields.Year || '',
      manufacturer: r.fields.Manufacturer || '',
      stock: r.fields.Stock || 0
    }));
    return ok({ products });
  } catch (e) {
    console.error('get-products error', e);
    return err('Could not fetch products', 500);
  }
};
