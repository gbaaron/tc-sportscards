const { preflight, ok, err, getBase, verifyToken, findUserByEmail } = require('./_shared');

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);
  const decoded = verifyToken(event);
  if (!decoded) return err('Unauthorized', 401);
  try {
    const { name, phone, birthday, favoriteSport, favoriteTeam, marketingEmails } = JSON.parse(event.body || '{}');
    const base = getBase();
    const user = await findUserByEmail(base, decoded.email);
    if (!user) return err('User not found', 404);
    const fields = {};
    if (name !== undefined) fields.Name = name;
    if (phone !== undefined) fields.Phone = phone;
    if (birthday !== undefined) fields.Birthday = birthday || null;
    if (favoriteSport !== undefined) fields.FavoriteSport = favoriteSport || null;
    if (favoriteTeam !== undefined) fields.FavoriteTeam = favoriteTeam;
    if (marketingEmails !== undefined) fields.MarketingEmails = !!marketingEmails;
    await base('Users').update([{ id: user.id, fields }]);
    return ok({ success: true });
  } catch (e) {
    console.error('update-user error', e);
    return err('Could not update user', 500);
  }
};
