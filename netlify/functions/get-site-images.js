const { preflight, ok, err, getBase, fetchAll } = require('./_shared');

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  try {
    const base = getBase();
    const records = await fetchAll(base('SiteImages'));
    const images = {};
    for (const r of records) {
      if (r.fields.SlotName) {
        images[r.fields.SlotName] = {
          url: r.fields.ImageURL || '',
          alt: r.fields.AltText || ''
        };
      }
    }
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      },
      body: JSON.stringify({ images })
    };
  } catch (e) {
    console.error('get-site-images error', e);
    return err('Could not fetch site images', 500);
  }
};
