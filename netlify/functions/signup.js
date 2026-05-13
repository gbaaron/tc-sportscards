const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { preflight, ok, err, getBase, findUserByEmail } = require('./_shared');

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);
  try {
    const { name, email, password, phone, favoriteSport, favoriteTeam, marketingEmails, howDidYouHear } = JSON.parse(event.body || '{}');
    if (!name || !email || !password) return err('Name, email, and password are required.');
    if (password.length < 8) return err('Password must be at least 8 characters.');
    const base = getBase();
    const existing = await findUserByEmail(base, email);
    if (existing) return err('An account with that email already exists.');
    const passwordHash = await bcrypt.hash(password, 10);
    const created = await base('Users').create([{
      fields: {
        Name: name,
        Email: email.toLowerCase().trim(),
        Phone: phone || '',
        PasswordHash: passwordHash,
        Points: 0,
        TotalSpent: 0,
        TierLevel: 'Rookie',
        MemberSince: new Date().toISOString().split('T')[0],
        FavoriteSport: favoriteSport || null,
        FavoriteTeam: favoriteTeam || '',
        MarketingEmails: !!marketingEmails,
        HowDidYouHear: howDidYouHear || '',
        IsAdmin: false
      }
    }]);
    const user = created[0];
    const token = jwt.sign({ userId: user.id, email: user.fields.Email, isAdmin: false }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return ok({
      token,
      user: {
        id: user.id,
        name: user.fields.Name,
        email: user.fields.Email,
        points: 0,
        tier: 'Rookie',
        isAdmin: false
      }
    });
  } catch (e) {
    console.error('signup error', e);
    return err('Could not create account.', 500);
  }
};
