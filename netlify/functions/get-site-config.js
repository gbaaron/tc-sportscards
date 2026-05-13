const { preflight, ok, err, getBase, fetchAll } = require('./_shared');

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  try {
    const base = getBase();
    const records = await fetchAll(base('SiteConfig'));
    const config = {};
    for (const r of records) {
      if (r.fields.Key) {
        config[r.fields.Key] = r.fields.Value || r.fields.ImageURL || '';
      }
    }
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      },
      body: JSON.stringify({ config })
    };
  } catch (e) {
    console.error('get-site-config error', e);
    return err('Could not fetch site config', 500);
  }
};
