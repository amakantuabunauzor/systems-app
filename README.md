# Systems — your five life systems as one app

An installable app (PWA) covering the Morning, Weekly, Evening, Finance, and Audit systems. Every task is editable — title, time, repeat pattern, notes, notify on/off — and tasks with notifications turned on will push to your phone even when the app is closed, via a small serverless function on Netlify (the same host your other sites run on).

---

## What's in this folder

```
index.html, style.css, app.js       → the app itself
manifest.json, service-worker.js    → what makes it installable + able to receive push
icons/                              → app icons (placeholder — swap anytime)
netlify.toml, package.json          → Netlify config + dependencies
netlify/functions/
  tasks.js            → GET/POST your task list (stored in Netlify Blobs)
  subscribe.js        → saves your device's push subscription + timezone
  vapid-public-key.js → hands the client the public key it needs to subscribe
  send-notifications.js → runs every 5 minutes, sends push for any task due now
  _defaults.js         → the default tasks pulled from your 5 system docs
```

No database to set up — task data and push subscriptions live in **Netlify Blobs**, which comes free with your Netlify site.

---

## 1. Get the code onto GitHub

```bash
cd path/to/this/folder
git init
git add .
git commit -m "Initial commit — Systems life OS app"
```

Create a new empty repo on GitHub (no README/gitignore, so it doesn't conflict), then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/systems-app.git
git branch -M main
git push -u origin main
```

---

## 2. Deploy to Netlify

Same flow as greenleaf.institute:

1. Netlify dashboard → **Add new site → Import an existing project**
2. Connect GitHub, pick the repo you just pushed
3. Build settings: **leave build command blank**, publish directory `.` — this is a static site, `netlify.toml` already has the rest
4. Deploy

You'll get a `*.netlify.app` URL immediately. Add a custom domain later from Site settings → Domain management, same as your other projects.

---

## 3. Generate your VAPID keys (for push notifications)

VAPID keys let your server prove to browsers it's allowed to send push messages to them. Generate them once, locally:

```bash
npm install
npm run generate-vapid-keys
```

This prints something like:

```
{ publicKey: 'BExample...', privateKey: 'Xexample...' }
```

Copy both values.

---

## 4. Add environment variables in Netlify

Site settings → **Environment variables** → add:

| Key | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | the publicKey from step 3 |
| `VAPID_PRIVATE_KEY` | the privateKey from step 3 |
| `VAPID_SUBJECT` | `mailto:your-real-email@example.com` |

Trigger a redeploy after adding these (Deploys → Trigger deploy → Deploy site) so the functions pick them up.

---

## 5. Install it on your phone

1. Open your `*.netlify.app` URL (or custom domain) in **Safari** (iPhone) or **Chrome** (Android)
2. iPhone: Share → **Add to Home Screen**. Android/Chrome: you should see an **Install** prompt automatically, or the ⋮ menu → **Install app**
3. Open it from the home screen icon — it now runs full-screen, no browser chrome

---

## 6. Turn on notifications

1. Inside the installed app, tap the ⚙ settings icon
2. Under **Notifications**, tap **Enable notifications**
3. Approve the browser permission prompt
4. Confirm your timezone in the **Timezone** dropdown (defaults to your device's detected zone)

That's it — any task with the 🔔 notify tag will now push at its scheduled time, checked every 5 minutes by the scheduled function.

**Important iPhone note:** push notifications for installed web apps require **iOS 16.4+**, and the app must be added to the home screen first (step 5) — notifications won't work from Safari tabs directly on iOS.

---

## 7. Verify it's actually working

- **Test the function manually** without waiting for a real task time:
  ```bash
  netlify functions:invoke send-notifications
  ```
  (requires the [Netlify CLI](https://docs.netlify.com/cli/get-started/): `npm install -g netlify-cli`, then `netlify login` and `netlify link` inside this folder first)
- **Check logs:** Netlify dashboard → your site → Functions → `send-notifications` → see recent invocations and any errors
- **Quick smoke test:** edit any task's time to 2–3 minutes from now with notify on, save, and wait — you should get a push within the next 5-minute cron tick

---

## 8. Editing tasks

Every task across all five tabs (Today / Morning / Weekly / Evening / Finance / Audit) has an **✎** edit button — change the title, time, repeat pattern (daily / weekdays / Saturday / monthly), notes, or whether it notifies. Use **+ Add a task** at the bottom of any system tab for anything not already there. Changes save to your Netlify Blobs store immediately, so they're the same across every device you install the app on.

If you ever want to start over, Settings → **Reset all tasks to defaults** restores the original set pulled from your five system documents.

---

## 9. What's tracked where

- **Tasks and settings** (titles, times, notify flags, timezone): synced to the server, same across devices
- **Daily check-offs and your streak**: stored locally on each device (not synced across devices in this version) — if you want cross-device streak tracking later, that's a small extension to the `tasks.js`/`subscribe.js` pattern already here (a `completions` blob keyed by date)

---

## 10. Costs

Netlify's free tier covers this comfortably: static hosting, Netlify Blobs, and Scheduled Functions running every 5 minutes are all within free-tier limits for personal use. You won't need to enter a card unless you add a custom domain's paid extras.

---

## Troubleshooting

- **"Notifications aren't supported in this browser"** → you're likely testing in a regular browser tab instead of the installed app, or on an iOS version below 16.4
- **Notification permission granted but nothing arrives** → check that both VAPID env vars are set and you redeployed after adding them; check the function logs (step 7)
- **Tasks not syncing between devices** → confirm both devices are hitting the same deployed URL, not one on `localhost` and one live
