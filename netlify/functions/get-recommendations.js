// Client-side-style recommendation logic computed server-side.
// Score = category preference (3x) + sport preference (2x) + global avg rating (1.5x) + recency bonus.
// Penalizes already-rated products.
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
    const userRatings = await fetchAll(base('Ratings'), { filterByFormula: `{UserID} = '${safe}'` });
    const products = await fetchAll(base('Products'), {
      filterByFormula: 'AND({IsAvailable} = TRUE())'
    });

    // Build preference vectors from rated products
    const catPref = {};
    const sportPref = {};
    const ratedIds = new Set();
    for (const r of userRatings) {
      ratedIds.add(r.fields.ProductID);
      const product = products.find(p => p.id === r.fields.ProductID);
      if (!product) continue;
      const cat = product.fields.Category;
      const sport = product.fields.Sport;
      const weight = (r.fields.Stars - 3); // -2..+2
      if (cat) catPref[cat] = (catPref[cat] || 0) + weight;
      if (sport) sportPref[sport] = (sportPref[sport] || 0) + weight;
    }

    // Fallback: if user has no ratings, lean on their favoriteSport
    if (Object.keys(sportPref).length === 0 && user.fields.FavoriteSport) {
      sportPref[user.fields.FavoriteSport] = 5;
    }

    const scored = products.map(p => {
      const cat = p.fields.Category;
      const sport = p.fields.Sport;
      const avg = p.fields.AvgRating || 3;
      let score = ((catPref[cat] || 0) * 3) + ((sportPref[sport] || 0) * 2) + (avg * 1.5);
      if (ratedIds.has(p.id)) score -= 10;
      return {
        id: p.id,
        name: p.fields.Name,
        category: p.fields.Category,
        sport: p.fields.Sport,
        price: p.fields.Price || 0,
        imageURL: p.fields.ImageURL || '',
        avgRating: p.fields.AvgRating || 0,
        score
      };
    });
    scored.sort((a, b) => b.score - a.score);
    return ok({ recommendations: scored.slice(0, 6) });
  } catch (e) {
    console.error('get-recommendations error', e);
    return err('Could not fetch recommendations', 500);
  }
};
