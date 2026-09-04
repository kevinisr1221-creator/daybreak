# Putting Daybreak on your phone

It installs as a web app — a real icon on your home screen, no browser chrome,
and it opens offline. Nothing to download from a store.

Open **https://kevinisr1221-creator.github.io/daybreak/** on your phone, then:

**iPhone (Safari — it has to be Safari)**
Share button → **Add to Home Screen** → Add.

**Android (Chrome)**
Menu (⋮) → **Install app** (or *Add to home screen*). Daybreak also offers an
**📲 Add to home screen** button on the Profile screen when Chrome allows it.

Launch it from the home-screen icon rather than the browser tab — that is what
gives you the full-screen, no-address-bar version.

## Offline

A service worker keeps the last version you loaded. If you open Daybreak with no
signal it still works; your taps are saved locally and are there when you come
back. When you do have signal it always fetches the current page first, so the
morning's Trello sync is never hidden behind a stale cache.

## Portrait only

Daybreak is one calm column, so it runs upright only. Three things enforce that,
because no single one works everywhere:

| Layer | Where it works |
|---|---|
| `"orientation": "portrait"` in the manifest | Android, installed |
| `screen.orientation.lock()` | Android, installed |
| Rotate-to-portrait overlay | everywhere, including iPhone |

**On iPhone the first two do nothing** — Safari ignores the manifest's
orientation and rejects the lock API. So turning the phone sideways shows a
"turn your phone upright" screen rather than the phone refusing to rotate. That
is as close to a lock as iOS permits any web app.

If your phone's own rotation lock is on, this never comes up at all.

The overlay is deliberately limited to short, touch-driven screens, so Daybreak
still opens normally on a laptop — a desktop window is always "landscape" and
should not be shut out.

## Updating

The page updates itself. The daily Trello sync commits a new build, GitHub Pages
publishes it, and the next time you open Daybreak you get it. If something looks
stale, close the app fully and reopen it.

## If the icon looks wrong after reinstalling

iOS caches home-screen icons aggressively. Remove the icon, close Safari
completely, then add it again.
