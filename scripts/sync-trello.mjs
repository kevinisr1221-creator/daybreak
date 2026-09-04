#!/usr/bin/env node
/**
 * Rebuilds the PROJECTS array in index.html from Trello.
 *
 * Model (matches how the Life OS board is actually laid out):
 *   a list  -> a tier   (Active -> focus, Maintain -> maintain, Parked -> parked)
 *   a card  -> a project
 *   a card's checklist items -> done[] / remaining[]
 *   a card's due date -> deadline
 *
 * The wording that gives the dashboard its voice — emoji, tagline, cheer,
 * stage names — is NOT taken from Trello. It lives in daybreak.config.json,
 * keyed by a slug of the project name, so a sync never overwrites it.
 *
 * Safety: this refuses to write a result that looks like a failed fetch
 * (too few projects, unparseable output). A bad sync leaves index.html alone.
 *
 * Env: TRELLO_KEY, TRELLO_TOKEN
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = path.join(ROOT, 'index.html');
const CONFIG = path.join(ROOT, 'daybreak.config.json');

const START = '// <<<DAYBREAK:PROJECTS:START>>>';
const END = '// <<<DAYBREAK:PROJECTS:END>>>';
const WEEK_START = '// <<<DAYBREAK:WEEK:START>>>';
const WEEK_END = '// <<<DAYBREAK:WEEK:END>>>';

// If a sync ever returns fewer than this, treat it as a broken fetch rather
// than as Kevin having deleted almost everything.
const MIN_PROJECTS = 3;

const KEY = process.env.TRELLO_KEY;
const TOKEN = process.env.TRELLO_TOKEN;

const die = msg => { console.error('✗ ' + msg); process.exit(1); };

if (!KEY || !TOKEN) die('TRELLO_KEY and TRELLO_TOKEN must be set.');

const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));

const auth = `key=${encodeURIComponent(KEY)}&token=${encodeURIComponent(TOKEN)}`;

async function trello(endpoint, params = '') {
  const url = `https://api.trello.com/1${endpoint}?${auth}${params ? '&' + params : ''}`;
  const r = await fetch(url);
  if (!r.ok) die(`Trello ${endpoint} returned ${r.status} ${r.statusText}`);
  return r.json();
}

const slug = n => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Card titles carry display furniture the dashboard adds back itself:
// a leading emoji, an ordering prefix ("1 — ", "NEXT UP — "), and inline
// urgency notes ("· ENDS IN 6 DAYS") that go stale the moment they are written.
function parseCardName(raw) {
  let s = raw.trim();
  const emojiMatch = s.match(/^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)\s*/u);
  const emoji = emojiMatch ? emojiMatch[1] : null;
  if (emojiMatch) s = s.slice(emojiMatch[0].length);
  s = s.replace(/^\d+\s+[—–-]\s+/, '');
  s = s.replace(/^(NEXT UP|UP NEXT)\s*[—–-]\s*/i, '');
  s = s.split(/\s+·\s+/)[0];
  // Trailing "(28–30 Aug)" / "(starts end Sept)" duplicates the deadline the
  // dashboard already renders from the card's due date.
  s = s.replace(/\s*\([^)]*\)\s*$/, '');
  return { emoji, name: s.trim() };
}

// Card titles drift ("Clipping business" becomes "Clipping business takes slot
// 1 on 31 Aug"). An exact slug match would silently drop the curated wording,
// so fall back to the longest curated key the card name starts with.
function findCurated(key) {
  if (cfg.curated[key]) return cfg.curated[key];
  const hit = Object.keys(cfg.curated)
    .filter(k => key.startsWith(k) || k.startsWith(key))
    .sort((a, b) => b.length - a.length)[0];
  return hit ? cfg.curated[hit] : null;
}

// Boards carry note cards ("READ ME — what parked means") that are not
// projects. They would otherwise render as one.
function isNoteCard(name) {
  return (cfg.ignoreCards || []).some(pat => new RegExp(pat, 'iu').test(name));
}

function tierFor(listName) {
  for (const [needle, tier] of Object.entries(cfg.listTiers)) {
    if (listName.toLowerCase().includes(needle.toLowerCase())) return tier;
  }
  return null;
}

const esc = s => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const js = v => JSON.stringify(v);

async function main() {
  const lists = await trello(`/boards/${cfg.board}/lists`, 'fields=name');
  const cards = await trello(
    `/boards/${cfg.board}/cards`,
    'checklists=all&checklist_fields=name&fields=name,due,idList,closed,shortUrl,desc'
  );

  const listById = Object.fromEntries(lists.map(l => [l.id, l.name]));
  const projects = [];
  const unmatched = [];

  for (const card of cards) {
    if (card.closed) continue;
    const listName = listById[card.idList] || '';
    const tier = tierFor(listName);
    if (!tier) continue; // This Week / Done / Rhythms / North Star are not projects

    if (isNoteCard(card.name)) continue;

    const { emoji, name } = parseCardName(card.name);
    const key = slug(name);
    const curated = findCurated(key);
    if (!curated) unmatched.push(name);

    const items = (card.checklists || []).flatMap(c => c.checkItems || []);
    const done = items.filter(i => i.state === 'complete').map(i => i.name);
    const remaining = items
      .filter(i => i.state !== 'complete')
      .map(i => ({ id: i.id, t: i.name }));

    const stages = curated?.stages || cfg.defaults.stages;
    // Position on the stage track from how much of the card is ticked off.
    const total = done.length + remaining.length;
    const ratio = total ? done.length / total : 0;
    const stageIndex = total ? Math.min(stages.length - 1, Math.floor(ratio * stages.length)) : 0;

    projects.push({
      id: curated?.id || key,
      emoji: curated?.emoji || emoji || cfg.defaults.emoji,
      name: curated?.name || name,
      cat: tier,
      tagline: curated?.tagline || (card.desc || '').split('\n')[0].slice(0, 120) || cfg.defaults.tagline,
      stages,
      stageIndex,
      deadline: card.due ? card.due.slice(0, 10) : null,
      deadlineLabel: card.due
        ? new Date(card.due).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        : null,
      done,
      remaining,
      board: card.shortUrl || `https://trello.com/b/${cfg.board}/`,
      cheer: curated?.cheer || cfg.defaults.cheer
    });
  }

  // The "This Week (max 5)" list is the weekly focus. Its cards are standalone,
  // not checklist items, so each entry carries its own label rather than
  // pointing at a project's checklist id (those ids change on every sync).
  const weekList = lists.find(l =>
    l.name.toLowerCase().includes(String(cfg.weekListMatch).toLowerCase()));
  const week = !weekList ? [] : cards
    .filter(c => !c.closed && c.idList === weekList.id)
    .slice(0, 5)
    .map(c => {
      const { emoji, name } = parseCardName(c.name);
      // Attribute the task to a project when the wording matches one, so the
      // home list still shows which project a task belongs to.
      const owner = projects.find(p =>
        p.remaining.some(r => r.t.toLowerCase() === name.toLowerCase()) ||
        name.toLowerCase().includes(p.name.toLowerCase()));
      return {
        id: c.id,
        name,
        pname: owner ? owner.name.split('—')[0].trim() : 'This week',
        pemoji: owner ? owner.emoji : (emoji || '🔥'),
        deadline: owner ? owner.deadline : (c.due ? c.due.slice(0, 10) : null),
        est: null,
        why: (c.desc || '').split('\n')[0].slice(0, 120) || null
      };
    });

  if (projects.length < MIN_PROJECTS) {
    die(`Only ${projects.length} projects came back (expected >= ${MIN_PROJECTS}). ` +
        `Refusing to overwrite index.html — this looks like a bad fetch, not a real change.`);
  }

  // Keep the dashboard's tier order stable regardless of Trello's ordering.
  const order = { focus: 0, next: 1, maintain: 2, parked: 3 };
  projects.sort((a, b) => (order[a.cat] ?? 9) - (order[b.cat] ?? 9));

  const body = projects.map(p => {
    const lines = [
      `  { id:${js(p.id)}, emoji:${js(p.emoji)}, name:${js(p.name)}, cat:${js(p.cat)},`,
      `    tagline:${js(p.tagline)},`,
      `    stages:${js(p.stages)}, stageIndex:${p.stageIndex},`,
      `    deadline:${js(p.deadline)}, deadlineLabel:${js(p.deadlineLabel)},`,
      `    done:${js(p.done)},`,
      `    remaining:${js(p.remaining)},`,
      `    board:${js(p.board)},`,
      `    cheer:${js(p.cheer)} }`
    ];
    return lines.join('\n');
  }).join(',\n\n');

  const block =
    `${START} generated by scripts/sync-trello.mjs — edit daybreak.config.json instead\n` +
    `// last synced ${new Date().toISOString()}\n` +
    `const PROJECTS = [\n${body}\n];\n${END}`;

  const html = fs.readFileSync(HTML, 'utf8');
  const a = html.indexOf(START);
  const b = html.indexOf(END);
  if (a < 0 || b < 0) die('Markers not found in index.html.');

  let next = html.slice(0, a) + block + html.slice(b + END.length);

  // Only rewrite the weekly list when the list actually resolved. If it is
  // missing or renamed, leave whatever is there rather than emptying the
  // home screen on the strength of a bad lookup.
  if (weekList) {
    const wa = next.indexOf(WEEK_START);
    const wb = next.indexOf(WEEK_END);
    if (wa < 0 || wb < 0) die('Week markers not found in index.html.');
    const weekBlock =
      `${WEEK_START}\nconst THIS_WEEK = [\n` +
      week.map(t => `  ${js(t)}`).join(',\n') +
      `\n];\n${WEEK_END}`;
    next = next.slice(0, wa) + weekBlock + next.slice(wb + WEEK_END.length);
  } else {
    console.warn(`! No list matching "${cfg.weekListMatch}" — left the weekly list as it was.`);
  }

  // Parse the generated array before trusting it near index.html.
  try {
    new Function(next.slice(next.indexOf('const PROJECTS = ['), next.indexOf(END)));
  } catch (e) {
    die('Generated PROJECTS array does not parse: ' + e.message);
  }

  if (next === html) {
    console.log('No change — Trello matches the dashboard.');
    return;
  }

  fs.writeFileSync(HTML, next);
  console.log(`✓ Synced ${projects.length} projects and ${week.length} weekly task(s) from Trello.`);
  const counts = projects.reduce((m, p) => ((m[p.cat] = (m[p.cat] || 0) + 1), m), {});
  console.log('  ' + Object.entries(counts).map(([k, v]) => `${k}:${v}`).join('  '));
  if (unmatched.length) {
    console.log(`\n  ${unmatched.length} project(s) had no entry in daybreak.config.json`);
    console.log('  and fell back to defaults. Add a "curated" entry to give them a voice:');
    unmatched.forEach(n => console.log(`    - ${n}  (key: ${slug(n)})`));
  }
}

main().catch(e => die(e.stack || e.message));
