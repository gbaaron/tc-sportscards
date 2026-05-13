// Admin CRUD for products. action: 'add' | 'update' | 'delete'
const { preflight, ok, err, getBase, verifyToken, requireAdmin } = require('./_shared');

const ALLOWED_FIELDS = new Set([
  'Name', 'Category', 'Sport', 'Price', 'Description', 'ImageURL',
  'BonusPoints', 'IsAvailable', 'IsOnlineExclusive', 'SortOrder',
  'Year', 'Manufacturer', 'Stock'
]);

function sanitize(fields) {
  const clean = {};
  for (const [k, v] of Object.entries(fields || {})) {
    if (ALLOWED_FIELDS.has(k)) clean[k] = v;
  }
  return clean;
}

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);
  const decoded = verifyToken(event);
  if (!decoded) return err('Unauthorized', 401);
  const base = getBase();
  if (!(await requireAdmin(base, decoded))) return err('Admin only', 403);
  try {
    const { action, id, fields } = JSON.parse(event.body || '{}');
    if (action === 'add') {
      const safe = sanitize(fields);
      if (!safe.Name) return err('Name is required');
      const created = await base('Products').create([{ fields: safe }]);
      return ok({ id: created[0].id });
    }
    if (action === 'update') {
      if (!id) return err('id required');
      const safe = sanitize(fields);
      await base('Products').update([{ id, fields: safe }]);
      return ok({ success: true });
    }
    if (action === 'delete') {
      if (!id) return err('id required');
      await base('Products').destroy([id]);
      return ok({ success: true });
    }
    return err('Unknown action');
  } catch (e) {
    console.error('admin-products error', e);
    return err('Admin operation failed', 500);
  }
};
