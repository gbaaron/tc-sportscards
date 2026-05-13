// Admin: list/manage gift card redemptions. POST {id, status, notes} to update.
const { preflight, ok, err, getBase, verifyToken, requireAdmin, fetchAll } = require('./_shared');

const ALLOWED_STATUS = ['Pending', 'Issued', 'Used', 'Expired', 'Cancelled'];

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  const decoded = verifyToken(event);
  if (!decoded) return err('Unauthorized', 401);
  const base = getBase();
  if (!(await requireAdmin(base, decoded))) return err('Admin only', 403);

  if (event.httpMethod === 'GET') {
    try {
      const records = await fetchAll(base('GiftCardRedemptions'), {
        sort: [{ field: 'RequestedAt', direction: 'desc' }]
      });
      const redemptions = records.map(r => ({
        id: r.id,
        code: r.fields.RedemptionCode,
        userEmail: r.fields.UserEmail,
        userName: r.fields.UserName,
        pointsRedeemed: r.fields.PointsRedeemed || 0,
        value: r.fields.GiftCardValue || 0,
        status: r.fields.Status,
        requestedAt: r.fields.RequestedAt,
        issuedAt: r.fields.IssuedAt || '',
        usedAt: r.fields.UsedAt || '',
        notes: r.fields.Notes || ''
      }));
      return ok({ redemptions });
    } catch (e) {
      console.error('admin-gift-cards GET error', e);
      return err('Could not fetch redemptions', 500);
    }
  }

  if (event.httpMethod === 'POST') {
    try {
      const { id, status, notes } = JSON.parse(event.body || '{}');
      if (!id) return err('id required');
      const fields = {};
      if (status) {
        if (!ALLOWED_STATUS.includes(status)) return err('Invalid status');
        fields.Status = status;
        const now = new Date().toISOString();
        if (status === 'Issued') fields.IssuedAt = now;
        if (status === 'Used') fields.UsedAt = now;
      }
      if (notes !== undefined) fields.Notes = notes;
      await base('GiftCardRedemptions').update([{ id, fields }]);
      return ok({ success: true });
    } catch (e) {
      console.error('admin-gift-cards POST error', e);
      return err('Could not update redemption', 500);
    }
  }

  return err('Method not allowed', 405);
};
