// TC Sports Cards — Universal Helper Bot (Section 28 of CLAUDE.md)
// Uses OpenAI gpt-3.5-turbo via native fetch (Node 18+).
// Pulls live site context from Airtable (products, tiers, config) and grounds answers.
// Logs every turn to BotConversations for auditing.

const { getBase, fetchAll, ok, err, preflight, headers } = require('./_shared');

// ----- Constants ---------------------------------------------------------

const MODEL = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
const MAX_TOKENS = 500;
const TEMPERATURE = 0.5;
const MAX_HISTORY = 12;          // last N turns sent to OpenAI (keeps prompt small)
const MAX_USER_MESSAGE_LEN = 1000;

// In-memory caches (per cold start)
let _productsCache = null;
let _tiersCache = null;
let _configCache = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ----- Site context fetchers --------------------------------------------

async function getSiteContext(base) {
  const now = Date.now();
  if (_productsCache && (now - _cacheTime) < CACHE_TTL_MS) {
    return { products: _productsCache, tiers: _tiersCache, config: _configCache };
  }

  const [products, tiers, configRows] = await Promise.all([
    fetchAll(base('Products'), { filterByFormula: '{IsActive} = TRUE()', maxRecords: 50 })
      .catch(() => []),
    fetchAll(base('RewardsTiers'), { sort: [{ field: 'MinimumPoints', direction: 'asc' }] })
      .catch(() => []),
    fetchAll(base('SiteConfig')).catch(() => [])
  ]);

  _productsCache = products.map(p => ({
    name: p.fields.ProductName || p.fields.Name,
    category: p.fields.Category,
    price: p.fields.Price,
    description: (p.fields.Description || '').slice(0, 200)
  })).filter(p => p.name);

  _tiersCache = tiers.map(t => ({
    name: t.fields.TierName,
    min: t.fields.MinimumPoints || 0,
    multiplier: t.fields.PointsMultiplier || 1,
    perks: t.fields.PerksDescription || ''
  }));

  _configCache = {};
  for (const row of configRows) {
    const key = row.fields.Key || row.fields.key;
    const val = row.fields.Value || row.fields.value;
    if (key) _configCache[key] = val;
  }

  _cacheTime = now;
  return { products: _productsCache, tiers: _tiersCache, config: _configCache };
}

// ----- System prompt -----------------------------------------------------

function buildSystemPrompt(ctx) {
  const productLines = ctx.products.length
    ? ctx.products.slice(0, 30).map(p =>
        `- ${p.name}${p.category ? ` (${p.category})` : ''}${p.price ? ` — $${Number(p.price).toFixed(2)}` : ''}`
      ).join('\n')
    : '(no active products listed)';

  const tierLines = ctx.tiers.length
    ? ctx.tiers.map(t =>
        `- ${t.name}: ${t.min}+ points, ${t.multiplier}x earn rate. ${t.perks}`
      ).join('\n')
    : '- Rookie: 0+ points, 1.0x earn rate.\n- Veteran: 250+ points, 1.25x.\n- All-Star: 750+ points, 1.5x.\n- Hall of Famer: 1500+ points, 2.0x.';

  const hoursWeekday = ctx.config.hours_weekday || 'Mon–Fri: 11am – 7pm';
  const hoursSat = ctx.config.hours_saturday || 'Saturday: 10am – 6pm';
  const hoursSun = ctx.config.hours_sunday || 'Sunday: Closed';
  const addr1 = ctx.config.address_line1 || '123 Main Avenue';
  const addr2 = ctx.config.address_line2 || 'Zeeland, MI 49464';
  const phone = ctx.config.phone || '(616) 555-0100';
  const email = ctx.config.contact_email || 'hello@tcsportscards.com';

  return `You are "Counter Helper", the smart assistant for TC Sports Cards — a sports card hobby shop in Zeeland, Michigan.

YOUR VOICE:
- Knowledgeable hobby-shop regular: friendly but not bubbly.
- Concise. 1–3 sentence answers unless the user clearly wants more.
- No emojis. No exclamation overload.
- Talk like someone who actually works the shop counter.

WHAT YOU KNOW:

Shop info:
- Address: ${addr1}, ${addr2}
- Hours: ${hoursWeekday}; ${hoursSat}; ${hoursSun}
- Phone: ${phone}
- Email: ${email}
- We carry vintage and modern sports cards: singles, sealed boxes, supplies. The online catalog is a curated set of online-exclusive drops; the shop case has much more.

Rewards program (every online order earns points; 100 points = $1 gift card; minimum 500 points to redeem):
${tierLines}

Featured products currently online:
${productLines}

WHAT YOU CAN ANSWER:
- Hours, location, contact, directions.
- Online product availability and price (from the list above).
- How the rewards/points/tier system works, how to redeem gift cards.
- General sports card hobby questions (sets, eras, condition grading basics).
- Account questions: where to log in, how to sign up, how to see orders.

WHAT YOU MUST REFUSE OR DEFLECT:
- Specific card valuations or appraisals — say "I can't quote values here; bring it into the shop or call us."
- Medical, legal, or financial advice.
- Anything off-topic from the shop or the hobby.
- Personal info about other customers or staff.
- Anything you're not sure about — never invent a price, a product, a phone number, or a policy.

If you don't know, say so and offer to connect them to a human: "I don't have that handy — give the shop a call at ${phone} or stop by during open hours."`;
}

// ----- OpenAI call -------------------------------------------------------

async function callOpenAI(messages) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS
    })
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`OpenAI ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  const choice = data.choices && data.choices[0];
  return {
    content: (choice && choice.message && choice.message.content) || '',
    tokensIn: (data.usage && data.usage.prompt_tokens) || 0,
    tokensOut: (data.usage && data.usage.completion_tokens) || 0
  };
}

// ----- Fire-and-forget logging ------------------------------------------

function logTurn(base, payload) {
  // Never block UX on logging
  base('BotConversations').create([{ fields: payload }]).catch(e => {
    console.error('BotConversations log failed:', e.message);
  });
}

// ----- Handler -----------------------------------------------------------

exports.handler = async (event) => {
  const pre = preflight(event);
  if (pre) return pre;

  if (event.httpMethod !== 'POST') return err('POST only', 405);

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (_) {
    return err('Invalid JSON', 400);
  }

  const { messages = [], sessionId = '', userEmail = '' } = payload;

  // Validate input
  if (!Array.isArray(messages) || !messages.length) {
    return err('messages array required', 400);
  }

  // Find latest user message and clip
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  if (!lastUser || !lastUser.content) return err('No user message', 400);
  if (typeof lastUser.content !== 'string') return err('Bad message format', 400);
  const userText = lastUser.content.slice(0, MAX_USER_MESSAGE_LEN);

  try {
    const base = getBase();
    const ctx = await getSiteContext(base);
    const systemPrompt = buildSystemPrompt(ctx);

    // Trim history to last MAX_HISTORY user/assistant turns
    const trimmed = messages
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-MAX_HISTORY)
      .map(m => ({ role: m.role, content: m.content.slice(0, MAX_USER_MESSAGE_LEN) }));

    // Ensure last is the (clipped) user message
    if (trimmed.length === 0 || trimmed[trimmed.length - 1].role !== 'user') {
      trimmed.push({ role: 'user', content: userText });
    } else {
      trimmed[trimmed.length - 1] = { role: 'user', content: userText };
    }

    const openaiMessages = [
      { role: 'system', content: systemPrompt },
      ...trimmed
    ];

    const { content, tokensIn, tokensOut } = await callOpenAI(openaiMessages);

    // Fire-and-forget log
    logTurn(base, {
      SessionID: sessionId || 'anon',
      UserID: userEmail || '',
      UserMessage: userText,
      AssistantMessage: content.slice(0, 2000),
      Model: MODEL,
      TokensIn: tokensIn,
      TokensOut: tokensOut,
      Timestamp: new Date().toISOString()
    });

    return ok({ reply: content, model: MODEL });
  } catch (e) {
    console.error('helper-bot error:', e.message);
    return ok({
      reply: "I'm having trouble reaching my brain right now — give the shop a call or try again in a sec.",
      error: true
    });
  }
};
