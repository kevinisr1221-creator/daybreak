# Deploying the Daybreak backend

The frontend (`index.html`) needs no backend. It is a single file and already
runs on GitHub Pages. **Everything except cloud sync works without a server.**

Deploy this only if you want your progress to follow you between your phone and
your laptop, or you want Daybreak to read your Trello boards.

---

## What the backend does

| Endpoint | Purpose |
|---|---|
| `POST /api/signup` | Creates an account, returns `userId` + `token` (shown once) |
| `PUT /api/state/:userId` | Saves your progress. Bearer token required |
| `GET /api/state/:userId` | Reads it back. Bearer token required |
| `POST /api/trello/boards/:userId` | Reads cards from Trello boards you name |
| `GET /health` | Liveness check |

Every user-scoped route requires `Authorization: Bearer <token>`. A `userId`
alone gets you a `403` — tokens are stored hashed and compared in constant time.
State is written to disk, so a restart does not discard anyone's backup.

---

## Deploy it

The service is a plain Node app: one process, no database, no build step. It
needs a **persistent disk** — on a platform with an ephemeral filesystem, every
redeploy wipes the saved state.

### Fly.io

```bash
fly launch --no-deploy          # generates fly.toml
fly volumes create daybreak_data --size 1
```

Then in `fly.toml`:

```toml
[env]
  DATA_DIR = "/data"
  ALLOWED_ORIGIN = "https://kevinisr1221-creator.github.io"

[[mounts]]
  source = "daybreak_data"
  destination = "/data"
```

```bash
fly deploy
```

### Render

New → Web Service → connect this repo.

- Build: `npm install`
- Start: `npm start`
- Add a **Disk** mounted at `/data`
- Env: `DATA_DIR=/data`, `ALLOWED_ORIGIN=https://kevinisr1221-creator.github.io`

### Railway

`railway up`, add a volume at `/data`, set the same two env vars.

---

## Environment variables

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3000` | Usually set by the platform |
| `DATA_DIR` | `./.data` | **Point at a mounted disk** or data is lost on redeploy |
| `ALLOWED_ORIGIN` | `*` | Set to your Pages URL so other sites can't call your API |

---

## Connect Daybreak to it

1. Open Daybreak → **Profile** → **☁️ Connect cloud sync**
2. Paste the backend URL (e.g. `https://daybreak-api.fly.dev`)

It signs you up, stores the token in that browser, and pushes on every change.
On a second device, connecting creates a *separate* account — to share progress,
copy `daybreak.cloud.id` / `daybreak.cloud.token` from the first device's
localStorage into the second.

> The token is the only credential and is shown once. It is stored hashed
> server-side, so losing it means starting a new account.

---

## Trello

Get a key at <https://trello.com/app-key> and a token via the authorize link on
that page, then:

```bash
curl -X POST https://YOUR-BACKEND/api/trello/boards/YOUR_USER_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"trelloKey":"...","trelloToken":"...","boardIds":["HEGufcHJ"]}'
```

Board ids are the short code in a board URL:
`trello.com/b/HEGufcHJ/life-os` → `HEGufcHJ`.

Credentials are passed per request and never stored.

This endpoint **reads** boards. It does not yet write completed tasks back to
Trello, and the returned cards are not yet merged into the dashboard's project
list — that wiring is the remaining piece.

---

## Run it locally

```bash
npm install
npm start
curl localhost:3000/health
```
