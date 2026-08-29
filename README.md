# Daybreak 🌅

Kevin's personal development command center — a warm, encouraging dashboard
built around the projects, tasks, schedule and wins that already exist in his
Trello boards (🧭 Life OS, Isra Digital — Command, LoveWorld Starlight, and the
per-project boards) and his Google Calendar rhythm.

## What it does

- **Today** — a gentle daily overview: one focus project, up to three suggested
  tasks from the week's five, today's progress meter, and the shape of the
  working day. Sundays show a rest card (no laptop — by design).
- **Projects** — every real project, organised the way Kevin's Life OS already
  organises them: 🔥 Current focus (the Big 3) · 📌 Next up · 🌱 Maintain ·
  🧊 Parked on purpose. Each card shows the development journey, % complete
  with *what's finished* and *what remains*, and a link to its Trello board.
- **Rhythm** — the weekday rhythm from his calendar (Devotion 07:00, Morning
  launch 09:00, ON the business, lunch, IN the business, Shutdown 18:15) plus
  the week at a glance.
- **Wins** — real accomplishments already earned, plus unlockable achievements.
- **Progress** — stat tiles, a tasks-per-day chart for the week, and where
  every project stands.

Completing a task updates progress live, celebrates with confetti and an
encouraging toast, and can unlock achievements. Tone throughout is
encouragement, never pressure — progress is framed by what's done, not what's
missing.

## Running it

It's a single self-contained page — no build step, no dependencies.
Open `index.html` in a browser, or host it anywhere static
(Netlify, GitHub Pages, …). State (completed tasks, history, achievements)
persists in the browser via localStorage. Light and dark themes follow the
system preference.
