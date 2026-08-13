const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }
  const { subscription, timezone } = body;
  if (!subscription || !subscription.endpoint) {
    return { statusCode: 400, body: 'Missing subscription' };
  }

  const store = getStore('systems-data');
  const subs = (await store.get('subscriptions', { type: 'json' })) || [];
  const idx = subs.findIndex((s) => s.subscription.endpoint === subscription.endpoint);
  const record = { subscription, timezone: timezone || 'Africa/Lagos', updatedAt: new Date().toISOString() };
  if (idx >= 0) subs[idx] = record; else subs.push(record);
  await store.setJSON('subscriptions', subs);

  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
};
