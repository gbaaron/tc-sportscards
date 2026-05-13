const bcrypt = require('bcryptjs');
const { preflight, ok, err, getBase, verifyToken, findUserByEmail } = require('./_shared');

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);
  const decoded = verifyToken(event);
  if (!decoded) return err('Unauthorized', 401);
  try {
    const { currentPassword, newPassword } = JSON.parse(event.body || '{}');
    if (!currentPassword || !newPassword) return err('Both current and new passwords required.');
    if (newPassword.length < 8) return err('New password must be at least 8 characters.');
    const base = getBase();
    const user = await findUserByEmail(base, decoded.email);
    if (!user) return err('User not found', 404);
    const valid = await bcrypt.compare(currentPassword, user.fields.PasswordHash || '');
    if (!valid) return err('Current password is incorrect.', 401);
    const newHash = await bcrypt.hash(newPassword, 10);
    await base('Users').update([{ id: user.id, fields: { PasswordHash: newHash } }]);
    return ok({ success: true });
  } catch (e) {
    console.error('change-password error', e);
    return err('Could not change password', 500);
  }
};
