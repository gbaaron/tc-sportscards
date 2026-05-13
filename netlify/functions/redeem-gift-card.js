// Convert points to a store gift card. 100 points = $1 gift card value.
// Creates a pending GiftCardRedemption row; staff issues the actual code in-store/email.
const { preflight, ok, err, getBase, verifyToken, findUserByEmail, genGiftCardCode } = require('./_shared');

const MIN_POINTS = 500;        // can't redeem less than $5 worth
const POINTS_PER_DOLLAR = 100; // 100 points = $1

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);
  const decoded = verifyToken(event);
  if (!decoded) return err('Unauthorized', 401);
  try {
    const { pointsAmount } = JSON.parse(event.body || '{}');
    const pts = parseInt(pointsAmount, 10);
    if (!pts || pts < MIN_POINTS) return err(`Minimum redemption is ${MIN_POINTS} points ($${MIN_POINTS / POINTS_PER_DOLLAR}).`);
    if (pts % POINTS_PER_DOLLAR !== 0) return err(`Points must be a multiple of ${POINTS_PER_DOLLAR}.`);
    const base = getBase();
    const user = await findUserByEmail(base, decoded.email);
    if (!user) return err('User not found', 404);
    if ((user.fields.Points || 0) < pts) return err('You do not have enough points for that redemption.');
    const code = genGiftCardCode();
    const value = pts / POINTS_PER_DOLLAR;
    const now = new Date().toISOString();

    await base('GiftCardRedemptions').create([{
      fields: {
        RedemptionCode: code,
        UserEmail: user.fields.Email,
        UserName: user.fields.Name || '',
        PointsRedeemed: pts,
        GiftCardValue: value,
        Status: 'Pending',
        RequestedAt: now
      }
    }]);
    // Deduct points immediately
    await base('Users').update([{
      id: user.id,
      fields: { Points: (user.fields.Points || 0) - pts }
    }]);
    return ok({
      success: true,
      code,
      value,
      pointsRemaining: (user.fields.Points || 0) - pts,
      message: 'Your gift card request is in! Watch your email \u2014 well send the code within 24 hours.'
    });
  } catch (e) {
    console.error('redeem-gift-card error', e);
    return err('Could not process redemption', 500);
  }
};
