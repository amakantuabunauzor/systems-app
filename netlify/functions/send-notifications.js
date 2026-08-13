const { schedule } = require('@netlify/functions');
const webpush = require('web-push');
const { getStore } = require('@netlify/blobs');
const { defaultTasks } = require('./_defaults');

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:you@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

function localNowInTZ(tz) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
    weekday: 'short'
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type).value;
  return {
    year: get('year'), month: get('month'), day: get('day'),
    hour: Number(get('hour')), minute: Number(get('minute')),
    weekday: get('weekday') // Mon, Tue, ... Sun
  };
}

function isDueNow(task, local) {
  if (!task.enabled || !task.notify || !task.time) return false;

  const weekdayNum = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[local.weekday];
  const recurOk = {
    daily: true,
    weekdays: weekdayNum >= 1 && weekdayNum <= 5,
    saturday: weekdayNum === 6,
    monthly: Number(local.day) === 1
  }[task.recurrence];
  if (!recurOk) return false;

  const [h, m] = task.time.split(':').map(Number);
  const taskMinutes = h * 60 + m;
  const nowMinutes = local.hour * 60 + local.minute;
  return Math.abs(nowMinutes - taskMinutes) < 5;
}

const handler = async () => {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.log('VAPID keys not configured — skipping send.');
    return { statusCode: 200, body: 'not configured' };
  }

  const store = getStore('systems-data');
  const tasksData = (await store.get('tasks', { type: 'json' })) || defaultTasks();
  const subs = (await store.get('subscriptions', { type: 'json' })) || [];
  if (!subs.length) return { statusCode: 200, body: 'no subscriptions' };

  const allTasks = Object.values(tasksData).flatMap((sys) => sys.tasks);
  const sent = [];
  let currentSubs = subs;

  for (const sub of subs) {
    const local = localNowInTZ(sub.timezone || 'Africa/Lagos');
    const dateKey = `${local.year}-${local.month}-${local.day}`;

    for (const task of allTasks) {
      if (!isDueNow(task, local)) continue;

      const sentKey = `sent:${dateKey}:${task.id}:${sub.subscription.endpoint.slice(-24)}`;
      const already = await store.get(sentKey);
      if (already) continue;

      try {
        await webpush.sendNotification(sub.subscription, JSON.stringify({
          title: task.title,
          body: task.notes || 'Scheduled in your Systems app.',
          tag: task.id,
          url: '/'
        }));
        await store.set(sentKey, '1');
        sent.push(task.id);
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          currentSubs = currentSubs.filter((s) => s.subscription.endpoint !== sub.subscription.endpoint);
          await store.setJSON('subscriptions', currentSubs);
        }
      }
    }
  }

  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sent }) };
};

exports.handler = schedule('*/5 * * * *', handler);
