const { preflight, ok, err, getBase, verifyToken, findUserByEmail } = require('./_shared');

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  const decoded = verifyToken(event);
  if (!decoded) return err('Unauthorized', 401);
  try {
    const base = getBase();
    const user = await findUserByEmail(base, decoded.email);
    if (!user) return err('User not found', 404);
    const f = user.fields;
    return ok({
      user: {
        id: user.id,
        name: f.Name || '',
        email: f.Email,
        phone: f.Phone || '',
        points: f.Points || 0,
        totalSpent: f.TotalSpent || 0,
        tier: f.TierLevel || 'Rookie',
        memberSince: f.MemberSince || '',
        birthday: f.Birthday || '',
        favoriteSport: f.FavoriteSport || '',
        favoriteTeam: f.FavoriteTeam || '',
        marketingEmails: !!f.MarketingEmails,
        isAdmin: !!f.IsAdmin
      }
    });
  } catch (e) {
    console.error('get-user error', e);
    return err('Could not fetch user', 500);
  }
};
