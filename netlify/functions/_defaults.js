function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function t(title, time, recurrence, notify, notes) {
  return { id: uid(), title, time, recurrence, notify, notes: notes || '', enabled: true };
}

function defaultTasks() {
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
        t('Exercise — needs a fixed slot', null, 'daily', false, 'Still floating — pick a slot and set a time.'),
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

module.exports = { defaultTasks };
