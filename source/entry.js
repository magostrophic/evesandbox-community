import { createStore } from './store.api.js';
import { start } from './app.js';
(async () => {
  let fb = null;
  try { const r = await fetch('/api/config', { credentials: 'same-origin' }); if (r.ok) fb = (await r.json()).firebase || null; } catch (e) { /* shows "not open yet" */ }
  if (fb) start(createStore(fb), { configured: true });
  else start({ onAuth() {}, signOut() {} }, null);
})();
