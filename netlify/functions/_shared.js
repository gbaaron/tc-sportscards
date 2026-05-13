// Shared helpers for TC Sports Cards Netlify Functions
const Airtable = require('airtable');
const jwt = require('jsonwebtoken');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

function getBase() {
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
}

function ok(body, statusCode = 200) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function err(message, statusCode = 400) {
  return { statusCode, headers, body: JSON.stringify({ error: message }) };
}

function preflight(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  return null;
}

function verifyToken(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
  } catch (_) {
    return null;
  }
}

async function fetchAll(table, options = {}) {
  const records = [];
  await table.select(options).eachPage((page, fetchNextPage) => {
    records.push(...page);
    fetchNextPage();
  });
  return records;
}

// Escape a value for use in Airtable filterByFormula string literals.
function escapeFormulaValue(v) {
  return String(v).replace(/'/g, "\\'");
}

async function findUserByEmail(base, email) {
  const safe = escapeFormulaValue(email.toLowerCase());
  const records = await base('Users').select({
    filterByFormula: `LOWER({Email}) = '${safe}'`,
    maxRecords: 1
  }).firstPage();
  return records[0] || null;
}

async function requireAdmin(base, decoded) {
  if (!decoded) return false;
  const user = await findUserByEmail(base, decoded.email);
  return !!(user && user.fields.IsAdmin);
}

// Compute tier from points using RewardsTiers table thresholds (cached per cold start).
let _tierCache = null;
async function getTierForPoints(base, points) {
  if (!_tierCache) {
    const rows = await fetchAll(base('RewardsTiers'), { sort: [{ field: 'MinimumPoints', direction: 'asc' }] });
    _tierCache = rows.map(r => ({
      name: r.fields.TierName,
      min: r.fields.MinimumPoints || 0,
      multiplier: r.fields.PointsMultiplier || 1
    }));
  }
  let current = _tierCache[0];
  for (const t of _tierCache) {
    if (points >= t.min) current = t;
  }
  return current;
}

function genOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TC-${ts}-${rand}`;
}

function genGiftCardCode() {
  const rand = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TCGC-${rand()}-${rand()}`;
}

module.exports = {
  headers,
  getBase,
  ok,
  err,
  preflight,
  verifyToken,
  fetchAll,
  escapeFormulaValue,
  findUserByEmail,
  requireAdmin,
  getTierForPoints,
  genOrderNumber,
  genGiftCardCode
};
