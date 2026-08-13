const { getStore } = require('@netlify/blobs');
const { defaultTasks } = require('./_defaults');

exports.handler = async (event) => {
  const store = getStore('systems-data');

  if (event.httpMethod === 'GET') {
    const data = await store.get('tasks', { type: 'json' });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: data || defaultTasks() })
    };
  }

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch (e) {
      return { statusCode: 400, body: 'Invalid JSON' };
    }
    if (!body.tasks) return { statusCode: 400, body: 'Missing tasks' };
    await store.setJSON('tasks', body.tasks);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 405, body: 'Method not allowed' };
};
