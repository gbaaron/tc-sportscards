const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { preflight, ok, err, getBase, findUserByEmail } = require('./_shared');

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);
  try {
    const { email, password } = JSON.parse(event.body || '{}');
    if (!email || !password) return err('Email and password required.');
    const base = getBase();
    const user = await findUserByEmail(base, email);
    if (!user) return err('Invalid email or password.', 401);
    const valid = await bcrypt.compare(password, user.fields.PasswordHash || '');
    if (!valid) return err('Invalid email or password.', 401);
    const token = jwt.sign({ userId: user.id, email: user.fields.Email, isAdmin: !!user.fields.IsAdmin }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return ok({
      token,
      user: {
        id: user.id,
        name: user.fields.Name,
        email: user.fields.Email,
        points: user.fields.Points || 0,
        tier: user.fields.TierLevel || 'Rookie',
        isAdmin: !!user.fields.IsAdmin
      }
    });
  } catch (e) {
    console.error('login error', e);
    return err('Login failed.', 500);
  }
};
