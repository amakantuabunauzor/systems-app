/* ===== Systems — Life OS app logic ===== */

const API_BASE = '/.netlify/functions';
const CACHE_KEY = 'systems_tasks_cache_v1';
const COMPLETIONS_KEY = 'systems_completions_v1';
const TZ_KEY = 'systems_timezone_v1';

let uid = () => Math.random().toString(36).slice(2, 10);

function defaultTasks() {
  const t = (title, time, recurrence, notify, notes = '') => ({
    id: uid(), title, time, recurrence, notify, notes, enabled: true
  });

  return {
    morning: {
      label: 'Morning',
      tasks: [
        t('Wake up — no snooze', '07:00', 'daily', true, 'Alarm across the room, not on the nightstand.'),
        t('Phone stays in another room', '07:02', 'daily', false),
        t('Pray and study', '07:05', 'daily', true),
        t('Plan the day — 3 priorities max', '07:35', 'daily', true),
        t('Take a bath', '07:50', 'daily', false),
        t('Tidy the house — 15 min timer', '08:10', 'daily', false),
        t('Start work — first task decided last night', '08:30', 'daily', true),
        t('Eat', '10:30', 'daily', true),
        t('Brush teeth', '10:45', 'daily', false),
        t('Exercise — needs a fixed slot', null, 'daily', false, 'Flagged in the audit: this one is still floating. Pick a slot and set a time.'),
      ]
    },
    weekly: {
      label: 'Weekly',
      tasks: [
        t('Weekly planning & review session', '09:00', 'saturday', true, 'Set the week\'s top 3 goals, break each into a daily action, review last week\'s scorecard.'),
        t('Fill in the weekly scorecard', '10:00', 'saturday', false),
      ]
    },
    evening: {
      label: 'Evening',
      tasks: [
        t('Eat after work', '17:30', 'daily', true),
        t('Tidy up, if necessary', '17:50', 'daily', false),
        t('Praise songs', '18:00', 'daily', false),
        t('Personal business activities', '18:10', 'daily', true, 'Today\'s piece of one of this week\'s 3 goals.'),
        t('Put on a message', '19:30', 'daily', false),
        t('In bed by target time', '23:00', 'daily', true, 'Shift 30 min earlier as your wake-time phase advances.'),
      ]
    },
    finance: {
      label: 'Finance',
      tasks: [
        t('Monthly finance review', '09:30', 'monthly', true, 'Did transfers run? Reserve untouched? Any goal account near its target?'),
        t('Set your automatic transfer date', null, 'monthly', false, 'Edit this once you\'ve picked the actual date your transfer rule runs.'),
      ]
    },
    audit: {
      label: 'Audit',
      tasks: [
        t('Which habit broke down this week?', '10:15', 'saturday', false, 'Run it through the four-law diagnostic before next Saturday.'),
        t('Monthly environment audit', '09:30', 'monthly', false, 'Phone, home screen, workspace, kitchen — anything drifted back into place?'),
      ]
    }
  };
}

let state = {
  tasks: null,
  completions: {},
  timezone: 'Africa/Lagos',
  activeTab: 'today'
};

/* ---------- Persistence ---------- */

async function loadTasks() {
  try {
    const res = await fetch(`${API_BASE}/tasks`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.tasks) {
        state.tasks = data.tasks;
        localStorage.setItem(CACHE_KEY, JSON.stringify(data.tasks));
        return;
      }
    }
  } catch (e) { /* offline or not deployed yet — fall through */ }

  const cached = localStorage.getItem(CACHE_KEY);
  state.tasks = cached ? JSON.parse(cached) : defaultTasks();
}

async function saveTasks() {
  localStorage.setItem(CACHE_KEY, JSON.stringify(state.tasks));
  try {
    await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: state.tasks })
    });
  } catch (e) { showToast('Saved locally — will sync when online'); }
}

function loadCompletions() {
  const raw = localStorage.getItem(COMPLETIONS_KEY);
  state.completions = raw ? JSON.parse(raw) : {};
}
function saveCompletions() {
  localStorage.setItem(COMPLETIONS_KEY, JSON.stringify(state.completions));
}

function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/* ---------- Recurrence ---------- */

function dueToday(task, date = new Date()) {
  const day = date.getDay(); // 0 Sun .. 6 Sat
  switch (task.recurrence) {
    case 'daily': return true;
    case 'weekdays': return day >= 1 && day <= 5;
    case 'saturday': return day === 6;
    case 'monthly': return date.getDate() === 1;
    default: return true;
  }
}

/* ---------- Rendering ---------- */

const main = document.getElementById('main');
const SYSTEM_ORDER = ['morning', 'weekly', 'evening', 'finance', 'audit'];

function render() {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === state.activeTab));
  if (state.activeTab === 'today') renderToday();
  else renderSystem(state.activeTab);
  renderStatusStrip();
  renderStreak();
}

function renderStatusStrip() {
  const strip = document.getElementById('statusStrip');
  strip.innerHTML = '';
  SYSTEM_ORDER.forEach(key => {
    const sys = state.tasks[key];
    const due = sys.tasks.filter(t => t.enabled && dueToday(t));
    const done = due.filter(t => isDone(t.id));
    const pct = due.length ? Math.round((done.length / due.length) * 100) : 0;
    const light = document.createElement('div');
    light.className = 'status-light';
    light.title = `${sys.label}: ${done.length}/${due.length} today`;
    light.style.setProperty('--pct', pct + '%');
    strip.appendChild(light);
  });
}

function renderStreak() {
  // Consecutive past days (ending today) where all due tasks for that day were completed.
  let streak = 0;
  let d = new Date();
  while (true) {
    const key = todayKey(d);
    const dayCompletions = state.completions[key] || {};
    const due = SYSTEM_ORDER.flatMap(k => state.tasks[k].tasks.filter(t => t.enabled && dueToday(t, d)));
    if (due.length === 0) { d.setDate(d.getDate() - 1); continue; }
    const allDone = due.every(t => dayCompletions[t.id]);
    if (!allDone) break;
    streak++;
    d.setDate(d.getDate() - 1);
    if (streak > 365) break;
  }
  document.getElementById('streakDisplay').textContent = `${streak}-day streak`;
}

function isDone(taskId, date = new Date()) {
  const key = todayKey(date);
  return !!(state.completions[key] && state.completions[key][taskId]);
}

function toggleDone(taskId) {
  const key = todayKey();
  if (!state.completions[key]) state.completions[key] = {};
  state.completions[key][taskId] = !state.completions[key][taskId];
  saveCompletions();
  render();
}

function fmtTime(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function renderToday() {
  const now = new Date();
  const groups = SYSTEM_ORDER.map(key => {
    const sys = state.tasks[key];
    const due = sys.tasks
      .filter(t => t.enabled && dueToday(t, now))
      .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
    return { key, label: sys.label, due };
  }).filter(g => g.due.length);

  let html = `
    <h1 class="section-heading">Today</h1>
    <p class="section-sub">${now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
  `;

  if (!groups.length) {
    html += `<div class="empty-state">Nothing scheduled for today. Add tasks from each system tab.</div>`;
  }

  groups.forEach(g => {
    html += `<div class="day-label">${g.label}</div><div class="task-list">`;
    g.due.forEach(t => { html += taskRowHtml(t, g.key); });
    html += `</div>`;
  });

  main.innerHTML = html;
  bindTaskRowEvents();
}

function renderSystem(key) {
  const sys = state.tasks[key];
  const tasks = [...sys.tasks].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));

  let html = `
    <h1 class="section-heading">${sys.label}</h1>
    <p class="section-sub">Edit any task's title, time, repeat pattern, or notification — or add your own.</p>
    <div class="task-list">
  `;
  if (!tasks.length) html += `<div class="empty-state">No tasks yet in this system.</div>`;
  tasks.forEach(t => { html += taskRowHtml(t, key, true); });
  html += `</div>
    <button class="add-task-btn" id="addTaskBtn">+ Add a task to ${sys.label}</button>
  `;

  if (key === 'weekly') {
    html += renderScorecard();
  }

  main.innerHTML = html;
  bindTaskRowEvents();
  const addBtn = document.getElementById('addTaskBtn');
  if (addBtn) addBtn.addEventListener('click', () => openTaskSheet(null, key));
}

function renderScorecard() {
  return `
    <div class="day-label">Weekly scorecard (local reference)</div>
    <table class="scorecard">
      <thead><tr><th>Week of</th><th>Goal 1</th><th>Goal 2</th><th>Goal 3</th><th>Done?</th></tr></thead>
      <tbody><tr><td colspan="5" class="dim">Use your Saturday session to fill this in on paper or a sheet — this app tracks daily check-offs, not free-text goals.</td></tr></tbody>
    </table>
  `;
}

function taskRowHtml(t, systemKey, editable = false) {
  const done = isDone(t.id);
  const time = fmtTime(t.time);
  return `
    <div class="task-row ${done ? 'done' : ''}" data-id="${t.id}" data-system="${systemKey}">
      <input type="checkbox" class="task-check" ${done ? 'checked' : ''} data-action="toggle" data-id="${t.id}" />
      <div class="task-body">
        <div class="task-title">${time ? `<span class="task-time">${time}</span>` : ''}${escapeHtml(t.title)}</div>
        ${t.notes ? `<div class="task-notes">${escapeHtml(t.notes)}</div>` : ''}
        <div class="task-meta">
          <span class="pill">${recurrenceLabel(t.recurrence)}</span>
          ${t.notify ? '<span class="pill notify">🔔 notify</span>' : ''}
        </div>
      </div>
      ${editable ? `<button class="task-edit-btn" data-action="edit" data-id="${t.id}" data-system="${systemKey}">✎</button>` : `<button class="task-edit-btn" data-action="edit" data-id="${t.id}" data-system="${systemKey}">✎</button>`}
    </div>
  `;
}

function recurrenceLabel(r) {
  return { daily: 'Daily', weekdays: 'Weekdays', saturday: 'Saturday', monthly: 'Monthly' }[r] || r;
}

function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function bindTaskRowEvents() {
  main.querySelectorAll('[data-action="toggle"]').forEach(el => {
    el.addEventListener('change', () => toggleDone(el.dataset.id));
  });
  main.querySelectorAll('[data-action="edit"]').forEach(el => {
    el.addEventListener('click', () => {
      const sysKey = el.dataset.system || findSystemForTask(el.dataset.id);
      const task = state.tasks[sysKey].tasks.find(t => t.id === el.dataset.id);
      openTaskSheet(task, sysKey);
    });
  });
}

function findSystemForTask(id) {
  for (const key of SYSTEM_ORDER) {
    if (state.tasks[key].tasks.some(t => t.id === id)) return key;
  }
  return null;
}

/* ---------- Task edit sheet ---------- */

let editingTaskId = null;
let editingSystem = null;

function openTaskSheet(task, systemKey) {
  editingTaskId = task ? task.id : null;
  editingSystem = systemKey;
  document.getElementById('taskSheetTitle').textContent = task ? 'Edit task' : 'New task';
  document.getElementById('taskTitle').value = task ? task.title : '';
  document.getElementById('taskTime').value = task ? (task.time || '') : '';
  document.getElementById('taskRecurrence').value = task ? task.recurrence : 'daily';
  document.getElementById('taskNotify').checked = task ? task.notify : false;
  document.getElementById('taskNotes').value = task ? (task.notes || '') : '';
  document.getElementById('deleteTaskBtn').style.display = task ? 'inline-block' : 'none';
  document.getElementById('taskSheet').hidden = false;
}

function closeTaskSheet() {
  document.getElementById('taskSheet').hidden = true;
  editingTaskId = null;
  editingSystem = null;
}

document.getElementById('closeTaskSheet').addEventListener('click', closeTaskSheet);

document.getElementById('taskForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('taskTitle').value.trim();
  if (!title) return;
  const time = document.getElementById('taskTime').value || null;
  const recurrence = document.getElementById('taskRecurrence').value;
  const notify = document.getElementById('taskNotify').checked;
  const notes = document.getElementById('taskNotes').value.trim();

  const sys = state.tasks[editingSystem];
  if (editingTaskId) {
    const t = sys.tasks.find(t => t.id === editingTaskId);
    Object.assign(t, { title, time, recurrence, notify, notes });
  } else {
    sys.tasks.push({ id: uid(), title, time, recurrence, notify, notes, enabled: true });
  }
  await saveTasks();
  closeTaskSheet();
  render();
  showToast('Saved');
});

document.getElementById('deleteTaskBtn').addEventListener('click', async () => {
  if (!editingTaskId) return;
  const sys = state.tasks[editingSystem];
  sys.tasks = sys.tasks.filter(t => t.id !== editingTaskId);
  await saveTasks();
  closeTaskSheet();
  render();
  showToast('Deleted');
});

/* ---------- Tabs ---------- */

document.getElementById('tabbar').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  state.activeTab = btn.dataset.tab;
  render();
});

/* ---------- Settings sheet ---------- */

document.getElementById('settingsBtn').addEventListener('click', () => {
  document.getElementById('settingsSheet').hidden = false;
});
document.getElementById('closeSettings').addEventListener('click', () => {
  document.getElementById('settingsSheet').hidden = true;
});

document.getElementById('resetDefaultsBtn').addEventListener('click', async () => {
  if (!confirm('Reset all tasks to the original five-system defaults? Your custom tasks will be lost.')) return;
  state.tasks = defaultTasks();
  await saveTasks();
  render();
  showToast('Reset to defaults');
});

const TIMEZONES = [
  'Africa/Lagos', 'Africa/Cairo', 'Africa/Johannesburg', 'Europe/London', 'Europe/Berlin',
  'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Asia/Dubai', 'Asia/Kolkata',
  'Asia/Singapore', 'Australia/Sydney', 'UTC'
];

function initTimezoneSelect() {
  const sel = document.getElementById('timezoneSelect');
  sel.innerHTML = TIMEZONES.map(tz => `<option value="${tz}">${tz}</option>`).join('');
  const stored = localStorage.getItem(TZ_KEY);
  state.timezone = stored || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Lagos';
  sel.value = TIMEZONES.includes(state.timezone) ? state.timezone : 'Africa/Lagos';
  sel.addEventListener('change', async () => {
    state.timezone = sel.value;
    localStorage.setItem(TZ_KEY, state.timezone);
    await syncSubscriptionTimezone();
    showToast('Timezone updated');
  });
}

/* ---------- Toast ---------- */

let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

/* ---------- Notifications / Push ---------- */

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function enableNotifications() {
  const statusEl = document.getElementById('notifStatus');
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    statusEl.textContent = 'Push notifications aren\'t supported in this browser.';
    statusEl.style.color = 'var(--danger)';
    return;
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      statusEl.textContent = 'Notifications were not allowed.';
      statusEl.style.color = 'var(--danger)';
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const keyRes = await fetch(`${API_BASE}/vapid-public-key`);
    const { publicKey } = await keyRes.json();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
    }
    await fetch(`${API_BASE}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub, timezone: state.timezone })
    });
    statusEl.textContent = 'Notifications are on.';
    statusEl.style.color = 'var(--good)';
  } catch (err) {
    statusEl.textContent = 'Something went wrong enabling notifications. Check the setup steps in the README.';
    statusEl.style.color = 'var(--danger)';
  }
}

async function syncSubscriptionTimezone() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await fetch(`${API_BASE}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub, timezone: state.timezone })
    });
  } catch (e) { /* not subscribed yet — fine */ }
}

document.getElementById('enableNotifBtn').addEventListener('click', enableNotifications);

/* ---------- Install prompt (PWA) ---------- */

let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (!localStorage.getItem('systems_install_dismissed')) {
    document.getElementById('installBanner').hidden = false;
  }
});
document.getElementById('installBtn').addEventListener('click', async () => {
  document.getElementById('installBanner').hidden = true;
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
  }
});
document.getElementById('dismissInstall').addEventListener('click', () => {
  document.getElementById('installBanner').hidden = true;
  localStorage.setItem('systems_install_dismissed', '1');
});

/* ---------- Service worker registration ---------- */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}

/* ---------- Init ---------- */

async function init() {
  loadCompletions();
  initTimezoneSelect();
  await loadTasks();
  render();
}

init();
