const { preflight, ok, err, getBase, fetchAll } = require('./_shared');

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  try {
    const base = getBase();
    const records = await fetchAll(base('RewardsTiers'), {
      sort: [{ field: 'SortOrder', direction: 'asc' }]
    });
    const tiers = records.map(r => ({
      name: r.fields.TierName,
      minimumPoints: r.fields.MinimumPoints || 0,
      multiplier: r.fields.PointsMultiplier || 1,
      perks: r.fields.PerksDescription || '',
      badgeColor: r.fields.BadgeColor || ''
    }));
    return ok({ tiers });
  } catch (e) {
    console.error('get-tiers error', e);
    return err('Could not fetch tiers', 500);
  }
};
