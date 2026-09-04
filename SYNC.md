# Keeping Daybreak in step with Trello

No server, nothing to pay for, nothing to keep running. A GitHub Action reads
your Life OS board once a day, rewrites the project data inside `index.html`,
and commits. That commit triggers the existing Pages deploy, so the live site
updates on its own.

## Turn it on

Two secrets, once. **Settings → Secrets and variables → Actions → New secret**:

| Secret | Where it comes from |
|---|---|
| `TRELLO_KEY` | <https://trello.com/app-key> — the "Key" at the top |
| `TRELLO_TOKEN` | On that same page, click **Token**, approve, copy the result |

Then **Actions → Sync Daybreak from Trello → Run workflow** to try it
immediately rather than waiting for the morning run.

Until the secrets exist the job exits early with a note. It never fails noisily
and never touches `index.html`.

## How your board maps onto the dashboard

The lists on **🧭 Life OS** already are the dashboard's tiers, so nothing about
how you use Trello has to change:

| Trello list | Becomes |
|---|---|
| `🏗️ Active — Big 3` | 🔥 Current focus |
| `📥 Inbox` | 📌 Next up |
| `🌱 Maintain (light touch)` | 🌱 Maintain |
| `🧊 Parked (deliberately)` | 🧊 Parked |
| `🔥 This Week (max 5)` | the task list on the home screen |
| `🎯 North Star`, `🔁 Rhythms`, `✅ Done` | ignored |

Within a project card:

- **checklist items** become its steps — ticked ones count as done, the rest as
  remaining, and the progress bar follows
- the **due date** becomes the deadline shown on the card
- **archived cards** disappear from the dashboard

## Adding a project

Make a card in Active, Inbox, Maintain, or Parked. It appears at the next sync.

Move a card between those lists and the dashboard moves it too — the list is the
source of truth for which tier a project sits in.

## Giving a new project its voice

The warmth is not in Trello and is never overwritten by a sync. Emoji, tagline,
stage names, and the encouraging line live in `daybreak.config.json`, keyed by a
slug of the project name:

```json
"clipping-business": {
  "id": "clip",
  "emoji": "✂️",
  "tagline": "Takes slot 1 on Mon 31 Aug — launch sequence ready",
  "stages": ["Agree", "Proof", "Sell", "Systemise"],
  "cheer": "Week 1 is one page and one decision. That's all."
}
```

A card with no entry still shows up — it just uses its Trello emoji and the
first line of its description. The sync run prints the exact key to add for
anything it didn't recognise, so you can paste it straight in.

Card titles are tidied on the way through: a leading emoji, an ordering prefix
(`1 — `, `NEXT UP — `), a trailing `(28–30 Aug)`, and anything after a `·` are
all stripped, since the dashboard renders those itself.

## When something goes wrong

The sync refuses to write rather than risk wiping the dashboard. It stops, with
a message in the Actions log and `index.html` untouched, if:

- Trello returns an error (bad or expired token, board not visible)
- fewer than three projects come back — treated as a failed fetch, not as you
  having deleted almost everything
- the generated code doesn't parse
- the `<<<DAYBREAK:...>>>` markers in `index.html` are missing

If the `This Week` list can't be found, the weekly list is left exactly as it
was rather than emptied.

## Changing the schedule

`.github/workflows/sync-trello.yml`, `cron: '30 5 * * *'` — 05:30 UTC, before
the 06:00 devotion block. Note that **scheduled runs only fire from the default
branch**, which is `claude/claude-md-documentation-qnnt47`. If the default
branch changes, move this workflow with it.

## Running it locally

```bash
TRELLO_KEY=... TRELLO_TOKEN=... node scripts/sync-trello.mjs
git diff index.html
```

## What it does not do

- It **reads** Trello. Ticking a task in Daybreak does not tick it in Trello —
  your completions stay in that browser.
- It does not touch your streak, history, or unlocked wins. Those are yours and
  live in the browser only, so keep using **Export backup** in Profile now and
  then.
