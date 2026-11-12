// Stops dragging links/pictures around the page by accident (text boxes still work).
document.addEventListener('dragstart', (ev) => { if (!ev.target.closest || !ev.target.closest('input,textarea')) ev.preventDefault(); });
import { createStore } from './store.api.js';
import { start } from './app.js';
(async () => {
  // The page asks for its settings first. A failed request is told apart from "really not set up": the security check in front of the site expires after a while and can
  // only be passed by opening the page again, so a failure reloads it once (never more than once a minute) and otherwise shows a retry card.
  let fb = null, failed = false;
  for (let i = 0; i < 3; i++) {
    failed = false;
    try {
      const r = await fetch('/api/config', { credentials: 'same-origin', cache: 'no-store' });
      let j = null;
      try { j = await r.json(); } catch (x) { /* not our answer */ }
      if (r.ok && j && typeof j === 'object' && 'firebase' in j) { fb = j.firebase || null; break; }
      failed = true;
    } catch (x) { failed = true; }
    if (i < 2) await new Promise((ok) => setTimeout(ok, 700 * (i + 1)));
  }
  if (failed) {
    try { const t = +sessionStorage.getItem('eve-sc') || 0; if (Date.now() - t > 60000) { sessionStorage.setItem('eve-sc', String(Date.now())); location.reload(); return; } } catch (x) { /* no storage: the card below has a Reload button */ }
    start({ onAuth() {}, signOut() {} }, { configured: false, failed: true });
    return;
  }
  if (fb) start(createStore(fb), { configured: true });
  else start({ onAuth() {}, signOut() {} }, null);
})();
