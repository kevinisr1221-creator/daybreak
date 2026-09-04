#!/usr/bin/env node
/**
 * Daybreak backend — cloud backup + Trello sync.
 *
 * Design notes:
 *  - Every user-scoped route requires a bearer token. Tokens are issued at
 *    signup and stored hashed; a userId alone is never sufficient to read data.
 *  - State is written to disk (DATA_DIR) so a restart or redeploy does not
 *    silently discard someone's backup.
 *  - Trello sync is a real call to Trello's REST API using the caller's own
 *    key/token. Nothing is stubbed: if credentials are absent the route says so
 *    rather than pretending it worked.
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '.data');
const MAX_STATE_BYTES = 2 * 1024 * 1024;

app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json({ limit: '4mb' }));

/* ---------- storage ---------- */

fs.mkdirSync(DATA_DIR, { recursive: true });
const userFile = id => path.join(DATA_DIR, `${id}.json`);

const safeId = id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id);

async function readUser(id) {
  try {
    return JSON.parse(await fsp.readFile(userFile(id), 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

// Write to a temp file then rename, so an interrupted write can never leave a
// half-written record where a good backup used to be.
async function writeUser(id, record) {
  const tmp = userFile(id) + '.tmp';
  await fsp.writeFile(tmp, JSON.stringify(record));
  await fsp.rename(tmp, userFile(id));
}

/* ---------- auth ---------- */

const hash = t => crypto.createHash('sha256').update(t).digest('hex');

// Compare in constant time so a token cannot be recovered by timing the response.
function tokenMatches(presented, storedHash) {
  const a = Buffer.from(hash(presented));
  const b = Buffer.from(storedHash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function authenticate(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const { userId } = req.params;

  if (!token) return res.status(401).json({ error: 'Missing bearer token' });
  if (!safeId(userId)) return res.status(400).json({ error: 'Bad user id' });

  const record = await readUser(userId);
  if (!record || !tokenMatches(token, record.tokenHash)) {
    // Same response whether the user is absent or the token is wrong, so this
    // endpoint cannot be used to enumerate which accounts exist.
    return res.status(403).json({ error: 'Forbidden' });
  }

  req.record = record;
  next();
}

/* ---------- routes ---------- */

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Creates an account and returns the only copy of the token. It is stored
// hashed, so a lost token cannot be recovered — a new account is needed.
app.post('/api/signup', async (req, res, next) => {
  try {
    const userId = crypto.randomBytes(9).toString('base64url');
    const token = crypto.randomBytes(32).toString('base64url');
    await writeUser(userId, {
      userId,
      tokenHash: hash(token),
      createdAt: new Date().toISOString(),
      state: null,
      lastSync: null
    });
    res.json({ userId, token, note: 'Save this token. It is not recoverable.' });
  } catch (e) { next(e); }
});

app.put('/api/state/:userId', authenticate, async (req, res, next) => {
  try {
    const { state } = req.body;
    if (state === undefined) return res.status(400).json({ error: 'Missing state' });
    if (JSON.stringify(state).length > MAX_STATE_BYTES) {
      return res.status(413).json({ error: 'State too large' });
    }
    const updated = { ...req.record, state, lastSync: new Date().toISOString() };
    await writeUser(req.params.userId, updated);
    res.json({ ok: true, lastSync: updated.lastSync });
  } catch (e) { next(e); }
});

app.get('/api/state/:userId', authenticate, (req, res) => {
  res.json({ state: req.record.state, lastSync: req.record.lastSync });
});

/**
 * Real Trello read. Requires the caller's own Trello key and token, passed per
 * request so the server never holds long-lived credentials for anyone.
 * Get them at https://trello.com/power-ups/admin (key) and /1/authorize (token).
 */
app.post('/api/trello/boards/:userId', authenticate, async (req, res, next) => {
  try {
    const { trelloKey, trelloToken, boardIds } = req.body;
    if (!trelloKey || !trelloToken) {
      return res.status(400).json({
        error: 'Trello credentials required',
        how: 'Send trelloKey and trelloToken in the body. See https://trello.com/app-key'
      });
    }
    if (!Array.isArray(boardIds) || !boardIds.length) {
      return res.status(400).json({ error: 'boardIds must be a non-empty array' });
    }

    const auth = `key=${encodeURIComponent(trelloKey)}&token=${encodeURIComponent(trelloToken)}`;
    const boards = await Promise.all(boardIds.map(async id => {
      const url = `https://api.trello.com/1/boards/${encodeURIComponent(id)}` +
                  `/cards?fields=name,due,dateLastActivity,idList,closed&${auth}`;
      const r = await fetch(url);
      if (!r.ok) return { boardId: id, error: `Trello returned ${r.status}` };
      const cards = await r.json();
      const open = cards.filter(c => !c.closed);
      return {
        boardId: id,
        cardCount: open.length,
        cards: open.map(c => ({ id: c.id, name: c.name, due: c.due, listId: c.idList }))
      };
    }));

    res.json({ ok: true, fetchedAt: new Date().toISOString(), boards });
  } catch (e) { next(e); }
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, req, res, _next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Daybreak backend listening on :${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);
  });
}

module.exports = app;
