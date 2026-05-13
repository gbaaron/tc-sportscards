// Admin: list all orders and update order status / tracking.
const { preflight, ok, err, getBase, verifyToken, requireAdmin, fetchAll } = require('./_shared');

const ALLOWED_STATUS = ['Pending', 'Processing', 'Ready for Pickup', 'Shipped', 'Completed', 'Cancelled'];

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  const decoded = verifyToken(event);
  if (!decoded) return err('Unauthorized', 401);
  const base = getBase();
  if (!(await requireAdmin(base, decoded))) return err('Admin only', 403);

  if (event.httpMethod === 'GET') {
    try {
      const records = await fetchAll(base('Orders'), {
        sort: [{ field: 'OrderDate', direction: 'desc' }]
      });
      const orders = records.map(r => ({
        id: r.id,
        orderNumber: r.fields.OrderNumber,
        userEmail: r.fields.UserEmail,
        userName: r.fields.UserName,
        itemsList: r.fields.ItemsList,
        subtotal: r.fields.Subtotal || 0,
        tax: r.fields.Tax || 0,
        total: r.fields.Total || 0,
        pointsEarned: r.fields.PointsEarned || 0,
        pointsRedeemed: r.fields.PointsRedeemed || 0,
        status: r.fields.Status,
        fulfillmentMethod: r.fields.FulfillmentMethod,
        shippingAddress: r.fields.ShippingAddress,
        contactPhone: r.fields.ContactPhone,
        orderDate: r.fields.OrderDate,
        trackingNumber: r.fields.TrackingNumber || '',
        notes: r.fields.Notes || ''
      }));
      return ok({ orders });
    } catch (e) {
      console.error('admin-orders GET error', e);
      return err('Could not fetch orders', 500);
    }
  }

  if (event.httpMethod === 'POST') {
    try {
      const { id, status, trackingNumber, notes } = JSON.parse(event.body || '{}');
      if (!id) return err('id required');
      const fields = {};
      if (status) {
        if (!ALLOWED_STATUS.includes(status)) return err('Invalid status');
        fields.Status = status;
      }
      if (trackingNumber !== undefined) fields.TrackingNumber = trackingNumber;
      if (notes !== undefined) fields.Notes = notes;
      await base('Orders').update([{ id, fields }]);
      return ok({ success: true });
    } catch (e) {
      console.error('admin-orders POST error', e);
      return err('Could not update order', 500);
    }
  }

  return err('Method not allowed', 405);
};
