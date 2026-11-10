// Eve Sandbox Community - the page. Everything the visitor typed is shown with textContent / text nodes,
// never as HTML, so a post can not run code on the page.
import { POST_ID } from './ids.js';

const SITE = 'https://evesandbox.com';
const PAGE = 20, REPLY_PAGE = 30, POST_GAP = 30000, REPLY_GAP = 10000; // the server enforces the same gaps
const MAX_IMG = 5 * 1024 * 1024, MAX_IMGS = 4, IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const ICONS = {
  up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
  share: '<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  back: '<path d="M15 18l-6-6 6-6"/>', fwd: '<path d="M9 6l6 6-6 6"/>', chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>', lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 9"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  page: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>'
};
function icon(n, s = 18, w = 2) {
  const e = document.createElement('span');
  e.className = 'ic';
  e.innerHTML = '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[n] || '') + '</svg>';
  return e;
}

function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) { if (c == null || c === false) continue; e.append(c.nodeType ? c : document.createTextNode(String(c))); }
  return e;
}
const $ = (s, r) => (r || document).querySelector(s);

function ago(ms) {
  if (!ms) return 'just now';
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return Math.round(s / 60) + 'm ago';
  if (s < 86400) return Math.round(s / 3600) + 'h ago';
  if (s < 86400 * 30) return Math.round(s / 86400) + 'd ago';
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
const full = (ms) => (ms ? new Date(ms).toLocaleString() : '');
function hue(s) { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0; return x % 360; }
function avatar(uid, name, size, ver) {
  const letter = h('span', { class: 'av', 'aria-hidden': 'true', text: (Array.from(name || '?')[0] || '?').toUpperCase() });
  letter.style.background = 'hsl(' + hue(uid || name || '') + ',55%,46%)';
  const fit = (e) => { if (size) { e.style.width = e.style.height = size + 'px'; e.style.fontSize = Math.round(size * 0.45) + 'px'; } return e; };
  if (ver && uid) {
    const img = h('img', { class: 'av pic', src: '/img/a/' + uid + '?v=' + ver, alt: '', loading: 'lazy' });
    img.onerror = () => img.replaceWith(fit(letter));
    return fit(img);
  }
  return fit(letter);
}
const USER_RE = /^[a-z0-9_]{3,20}$/;
function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20); }
const MAX_AVATAR = 3 * 1024 * 1024;
const joined = (ms) => new Date(ms).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

// Turns web addresses in plain text into links. Only http(s) addresses; everything else stays text.
function rich(text) {
  const out = [];
  const re = /https?:\/\/[^\s<>"']+/gi;
  let last = 0, m;
  while ((m = re.exec(text))) {
    let url = m[0], tail = '';
    while (/[.,;:!?)\]}]$/.test(url)) { tail = url.slice(-1) + tail; url = url.slice(0, -1); }
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(h('a', { href: url, target: '_blank', rel: 'noopener noreferrer nofollow ugc', text: url.length > 60 ? url.slice(0, 57) + '...' : url }));
    if (tail) out.push(tail);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
function cleanName(s) { return String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 30); }

// Phone photos carry hidden details such as where they were taken. Drawing a JPEG again onto a canvas drops them
// (and keeps the picture the right way up). Other types are sent as they are.
async function prepImage(f) {
  if (f.type !== 'image/jpeg' || !window.createImageBitmap) return f;
  try {
    const bm = await createImageBitmap(f);
    let w = bm.width, hh = bm.height; const big = Math.max(w, hh);
    if (big > 4096) { w = Math.round(w * 4096 / big); hh = Math.round(hh * 4096 / big); }
    const c = document.createElement('canvas'); c.width = w; c.height = hh;
    c.getContext('2d').drawImage(bm, 0, 0, w, hh);
    if (bm.close) bm.close();
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
    if (blob && blob.size > 0) return new File([blob], f.name || 'photo.jpg', { type: 'image/jpeg' });
  } catch (e) { /* keep the original */ }
  return f;
}

const MSG = {
  unavailable: 'Could not reach the server. Check your internet and try again.',
  'security-check': 'A security check is needed. Reload the page and complete it, then try again.',
  'sign-in': 'Please sign in again.',
  'need-name': 'Choose a display name first (account menu, top right).',
  banned: 'This account can not post, reply or vote.',
  'slow-down': 'Please wait a little before posting again.',
  'daily-limit': 'You have reached today\u2019s limit. Please try again tomorrow.',
  'image-too-big': 'Each picture can be 5 MB at most.',
  'too-many-images': 'You can add up to 4 pictures.',
  'bad-image': 'Only JPEG, PNG, WebP or GIF pictures are allowed.',
  'bad-name': 'Use at least 2 characters for the display name.',
  'bad-username': 'Usernames use 3 to 20 letters, numbers or underscores.',
  'reserved-username': 'That username is not available.',
  'username-taken': 'That username is already taken. Try another.',
  'username-wait': 'You can change your username once every 30 days.',
  'bad-bio': 'The bio can be 300 characters at most.',
  'bad-instagram': 'Instagram: type your username or profile link.',
  'bad-discord': 'Discord: type your username or an invite link (discord.gg/...).',
  'bad-x': 'X: type your username or profile link.',
  'bad-youtube': 'YouTube: type your @handle or channel link.',
  'bad-website': 'Website: use a full https:// address.',
  'avatar-too-big': 'A profile picture can be 3 MB at most.',
  'reserved-name': 'Please choose another name.',
  forbidden: 'You are not allowed to do that.',
  'not-found': 'That was not found. It may have been deleted.',
  'not-configured': 'The community is still being set up. Please try again later.',
  'bad-token': 'Sign-in could not be checked. Please try again.',
  'popup-blocked': 'The sign-in window was blocked. Allow pop-ups for this site and press the button again.',
  'unauthorized-domain': 'This address is not allowed for sign-in yet. The site owner must add it in Firebase (Authentication, Settings, Authorized domains).',
  'sign-in-failed': 'Sign-in did not work. Please try again.',
  'wrong-account': 'That is a different account from the one you are signed in with. Please use the same one.',
  'need-recent-login': 'Please confirm it is you, then try again.',
  'password-mismatch': 'The two new passwords are not the same.',
  'same-password': 'Choose a password that is different from the current one.',
  'email-not-verified': 'Please confirm your email first. Open the link we sent you, then sign in again.',
  'wrong-credentials': 'Wrong email or password.',
  'email-in-use': 'That email already has an account. Use Sign in, or \u201cForgot password?\u201d if you do not remember it.',
  'weak-password': 'Use a password of 8 to 128 characters.',
  'bad-email': 'Type a valid email address.',
  'need-password': 'Type your password.',
  'too-many-tries': 'Too many tries. Please wait a few minutes and try again.',
  'email-login-off': 'Email sign-in is not switched on yet. The site owner must enable it in Firebase (Authentication, Sign-in method, Email/Password).'
};
const errText = (e) => MSG[e && e.code] || 'Something went wrong. Please try again.';
// A short technical line under the message, so a problem can be told to the site owner exactly.
const errInfo = (e) => {
  if (!e) return '';
  const bits = [];
  if (e.code) bits.push(e.code);
  if (e.status) bits.push('HTTP ' + e.status);
  if (e.path) bits.push(String(e.path).split('?')[0]);
  if (e.ref) bits.push('ref ' + e.ref);
  if (!e.code && e.message) bits.push(String(e.message).slice(0, 80));
  return bits.join(' | ');
};

// Display choices (theme, text size) are kept in this browser only; nothing about them goes to the server.
const PREF = {
  get(k) { try { return localStorage.getItem('eve-' + k); } catch (e) { return null; } },
  set(k, v) { try { if (v) localStorage.setItem('eve-' + k, v); else localStorage.removeItem('eve-' + k); } catch (e) { /* the choice just lasts until the page is closed */ } }
};
function applyDisplay() {
  const el = document.documentElement, t = PREF.get('theme'), z = PREF.get('size');
  if (t === 'light' || t === 'dark') el.setAttribute('data-theme', t); else el.removeAttribute('data-theme');
  el.style.fontSize = z === 's' ? '13.5px' : z === 'l' ? '17px' : '';
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', t === 'light' ? '#f2f2f7' : '#000000');
}

export function start(store, cfg) {
  applyDisplay();
  const root = $('#app');
  let me = null, ready = false, pending = null, seq = 0, lastPost = 0, lastReply = 0;
  const hooks = { redraw: null };
  const renderHeader = () => $('#hdr').replaceChildren(header());
  const incomplete = () => !!me && (!me.name || !me.username);
  function go(path) { if (location.pathname + location.search + location.hash !== path) history.pushState(null, '', path); render(); }
  const userLink = (user, name, cls) => (user ? h('a', { class: cls || 'unl', href: '/id/' + user, text: name }) : h('b', { text: name }));
  const feed = { sort: 'new', posts: [], cursor: null, done: false, loading: false, tk: 0, sortLoaded: null };
  let current = null; // the post being read

  // ---------- small helpers ----------
  function toast(t, bad) {
    const e = h('div', { class: 'toast' + (bad ? ' bad' : ''), role: 'status', text: t });
    document.body.append(e);
    setTimeout(() => e.classList.add('on'), 10);
    setTimeout(() => { e.classList.remove('on'); setTimeout(() => e.remove(), 300); }, 3200);
  }
  function modal(build) {
    const close = () => { back.remove(); document.removeEventListener('keydown', esc); };
    const esc = (ev) => { if (ev.key === 'Escape') close(); };
    const box = h('div', { class: 'mbox', role: 'dialog', 'aria-modal': 'true' });
    // Close only when the press started AND ended on the dark area. Dragging a selection out of the box must not close it.
    let downOnBack = false, upOnBack = false;
    const back = h('div', { class: 'mback' }, box);
    back.addEventListener('pointerdown', (ev) => { downOnBack = ev.target === back; upOnBack = false; });
    back.addEventListener('pointerup', (ev) => { upOnBack = ev.target === back; });
    back.addEventListener('click', (ev) => { const ok = downOnBack && upOnBack && ev.target === back; downOnBack = upOnBack = false; if (ok) close(); });
    build(box, close);
    document.body.append(back);
    document.addEventListener('keydown', esc);
    const f = box.querySelector('input,textarea,button.pri');
    if (f) f.focus();
    return close;
  }
  const confirmBox = (title, text, ok) => new Promise((res) => {
    let done = false;
    const fin = (v) => { if (!done) { done = true; res(v); } };
    modal((box, close) => {
      box.append(h('h3', { text: title }), h('p', { class: 'mute', text }),
        h('div', { class: 'mrow' },
          h('button', { class: 'btn', type: 'button', text: 'Cancel', onclick: () => { close(); fin(false); } }),
          h('button', { class: 'btn danger', type: 'button', text: ok, onclick: () => { close(); fin(true); } })));
    });
    const obs = new MutationObserver(() => { if (!document.querySelector('.mback')) { fin(false); obs.disconnect(); } });
    obs.observe(document.body, { childList: true });
  });

  // ---------- sign in ----------
  function signInBox() {
    modal((box, close) => {
      box.parentNode.classList.add('signin');
      let mode = 'in', busy = false;
      const err = h('p', { class: 'merr', hidden: true, role: 'alert' });
      const note = h('p', { class: 'mnote', hidden: true, role: 'status' });
      const showErr = (e) => { note.hidden = true; err.hidden = false; err.textContent = typeof e === 'string' ? e : errText(e); };
      const showNote = (t) => { err.hidden = true; note.hidden = false; note.textContent = t; };
      const clear = () => { err.hidden = true; note.hidden = true; };
      const hooks = {
        start() { freshSignIn = true; clear(); },
        cancel() { freshSignIn = false; },
        fail(e) { freshSignIn = false; showErr(e); }
      };

      const email = h('input', { id: 'lemail', type: 'email', autocomplete: 'email', maxlength: '200', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Email' });
      const pw = h('input', { id: 'lpass', type: 'password', autocomplete: 'current-password', maxlength: '128', 'aria-label': 'Password' });
      const eye = h('button', { class: 'eye', type: 'button', text: 'Show', 'aria-label': 'Show or hide the password', onclick: () => { const on = pw.type === 'password'; pw.type = on ? 'text' : 'password'; eye.textContent = on ? 'Hide' : 'Show'; } });
      const pwRow = h('div', { class: 'pwrow' }, pw, eye);
      const pwLabel = h('label', { class: 'fl2', for: 'lpass', text: 'Password' });
      const hint = h('p', { class: 'fine tight', text: 'At least 8 characters.', hidden: true });
      const go2 = h('button', { class: 'btn pri full', type: 'submit', text: 'Sign in' });
      const forgot = h('button', { class: 'linkbtn', type: 'button', text: 'Forgot password?' });
      const resend = h('button', { class: 'linkbtn', type: 'button', text: 'Send the verification email again', hidden: true });
      const back = h('button', { class: 'linkbtn', type: 'button', text: 'Back to sign in', hidden: true });
      const tabIn = h('button', { class: 'tab on', type: 'button', role: 'tab', text: 'Sign in' });
      const tabUp = h('button', { class: 'tab', type: 'button', role: 'tab', text: 'Create account' });
      const tabs = h('div', { class: 'tabs2', role: 'tablist' }, tabIn, tabUp);
      const title = h('h3', { text: 'Join the community' });

      function setMode(m) {
        mode = m; clear(); resend.hidden = true;
        const reset = m === 'reset';
        tabs.hidden = reset;
        tabIn.classList.toggle('on', m === 'in'); tabUp.classList.toggle('on', m === 'up');
        tabIn.setAttribute('aria-selected', String(m === 'in')); tabUp.setAttribute('aria-selected', String(m === 'up'));
        pwLabel.hidden = pwRow.hidden = reset;
        hint.hidden = m !== 'up';
        forgot.hidden = m !== 'in';
        back.hidden = !reset;
        pw.autocomplete = m === 'up' ? 'new-password' : 'current-password';
        go2.textContent = m === 'up' ? 'Create account' : reset ? 'Send reset link' : 'Sign in';
        title.textContent = reset ? 'Reset your password' : 'Join the community';
        if (reset) showNote('Type your email and we will send you a link to choose a new password.');
      }
      tabIn.onclick = () => setMode('in');
      tabUp.onclick = () => setMode('up');
      forgot.onclick = () => setMode('reset');
      back.onclick = () => setMode('in');

      const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      async function submit(ev) {
        ev.preventDefault();
        if (busy) return;
        const em = email.value.trim(), pass = pw.value;
        if (!EMAIL_RE.test(em)) return showErr({ code: 'bad-email' });
        if (mode !== 'reset' && !pass) return showErr({ code: 'need-password' });
        if (mode === 'up' && (pass.length < 8 || pass.length > 128)) return showErr({ code: 'weak-password' });
        busy = true; go2.disabled = true; clear();
        try {
          if (mode === 'up') {
            freshSignIn = false;
            await store.signUpWithEmail(em, pass);
            setMode('in'); pw.value = '';
            showNote('Almost done. We sent a link to ' + em + '. Open it to confirm your email, then sign in here. Check the spam folder if you do not see it.');
          } else if (mode === 'reset') {
            await store.resetPassword(em);
            showNote('If an account uses ' + em + ', a link to choose a new password is on its way. Check the spam folder too.');
          } else {
            freshSignIn = true;
            await store.signInWithEmail(em, pass);
          }
        } catch (e) {
          freshSignIn = false;
          showErr(e);
          if (e && e.code === 'email-not-verified') resend.hidden = false;
        }
        busy = false; go2.disabled = false;
      }
      resend.onclick = async () => {
        const em = email.value.trim(), pass = pw.value;
        if (!EMAIL_RE.test(em) || !pass) return showErr({ code: 'wrong-credentials' });
        resend.disabled = true;
        try { await store.resendVerification(em, pass); resend.hidden = true; showNote('Sent. Open the new link, then sign in here.'); }
        catch (e) { showErr(e); }
        resend.disabled = false;
      };
      const form = h('form', { class: 'eform', novalidate: true, onsubmit: submit },
        h('label', { class: 'fl2', for: 'lemail', text: 'Email' }), email,
        pwLabel, pwRow, hint,
        h('div', { class: 'erow' }, forgot, back),
        err, note,
        h('div', { class: 'erow' }, resend),
        go2);

      const slot = h('div', { class: 'gslot' }, h('p', { class: 'mute center', text: 'Loading...' }));
      box.append(title, tabs, form,
        h('div', { class: 'or' }, h('span', { text: 'or' })),
        slot,
        h('p', { class: 'fine' }, 'By continuing you agree to the ', h('a', { href: SITE + '/terms/', target: '_blank', rel: 'noopener', text: 'Terms' }), ' and ', h('a', { href: SITE + '/privacy/', target: '_blank', rel: 'noopener', text: 'Privacy' }), '.'));
      const gb = h('div', { class: 'gbox' });
      Promise.resolve(store.renderSignIn(gb, hooks)).then(() => slot.replaceChildren(gb), (e) => { slot.replaceChildren(); hooks.fail(e); });
    });
  }
  function nameBox(isNew, then) {
    modal((box, close) => {
      const nm = h('input', { id: 'dname', type: 'text', maxlength: '30', autocomplete: 'off', value: cleanName(me.name || me.suggest), 'aria-label': 'Display name' });
      const us = h('input', { id: 'duser', type: 'text', maxlength: '20', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', value: me.username || slug(me.name || me.suggest), 'aria-label': 'Username' });
      const err = h('p', { class: 'merr', hidden: true });
      const go2 = h('button', { class: 'btn pri', type: 'button', text: 'Continue' });
      const save = async () => {
        const n = cleanName(nm.value), un = us.value.trim().toLowerCase().replace(/^@/, '');
        if (n.length < 2) { err.hidden = false; err.textContent = errText({ code: 'bad-name' }); return; }
        if (!USER_RE.test(un)) { err.hidden = false; err.textContent = errText({ code: 'bad-username' }); return; }
        go2.disabled = true;
        try { await store.setName(me.uid, n, un); me.name = n; me.username = un; close(); renderHeader(); if (then) then(); }
        catch (e) { go2.disabled = false; err.hidden = false; err.textContent = errText(e); }
      };
      go2.onclick = save;
      nm.onkeydown = us.onkeydown = (ev) => { if (ev.key === 'Enter') save(); };
      box.append(h('h3', { text: 'Set up your profile' }),
        h('label', { class: 'fl2', for: 'dname', text: 'Display name' }), nm,
        h('p', { class: 'fine', text: 'Shown on your posts and replies. It does not have to be your real name.' }),
        h('label', { class: 'fl2', for: 'duser', text: 'Username' }), us,
        h('p', { class: 'fine', text: 'Your profile address will be ' + location.host + '/id/username. 3 to 20 letters, numbers or underscores.' }),
        err, h('div', { class: 'mrow' }, go2));
    });
  }
  // Runs fn once the visitor is signed in and has a name.
  function needUser(fn) {
    if (!ready) { toast('One moment...'); return; }
    if (!me) { pending = fn; signInBox(); return; }
    if (incomplete()) { nameBox(true, fn); return; }
    fn();
  }
  function onAuth(u) {
    const was = me;
    me = u; ready = true;
    if (u && u.error) { toast(errText(u.error), true); u = null; me = null; }
    renderHeader();
    if (me) { document.querySelectorAll('.mback.signin').forEach((x) => x.remove()); refreshVotes(); if (hooks.redraw) hooks.redraw(); }
    else {
      feed.posts.forEach((p) => { p.myVote = 0; }); if (current) current.myVote = 0;
      if (hooks.redraw) hooks.redraw();
    }
    if (me && pending) {
      const f = pending; pending = null;
      if (incomplete()) { document.querySelectorAll('.mback').forEach((x) => x.remove()); nameBox(true, f); } else f();
    } else if (incomplete() && freshSignIn) { document.querySelectorAll('.mback').forEach((x) => x.remove()); nameBox(true); }
    freshSignIn = false;
  }
  let freshSignIn = false;

  // ---------- header, footer ----------
  function header() {
    const right = h('div', { class: 'hr' });
    if (!ready) right.append(h('span', { class: 'mute', text: ' ' }));
    else if (!me) right.append(h('button', { class: 'btn pri sm', type: 'button', text: 'Sign in', onclick: signInBox }));
    else {
      const menu = h('div', { class: 'umenu', hidden: true },
        h('div', { class: 'un' }, h('b', { text: me.name || 'New member' }), me.admin ? h('span', { class: 'chip', text: 'Admin' }) : null),
        h('button', { type: 'button', onclick: () => { menu.hidden = true; if (incomplete()) nameBox(true); else go('/id/' + me.username); } }, icon('user', 18), h('span', { text: 'My profile' })),
        h('button', { type: 'button', class: 'set', onclick: () => { menu.hidden = true; go('/#/settings'); } }, icon('gear', 18), h('span', { text: 'Settings' })),
        h('button', { type: 'button', class: 'out', onclick: () => { menu.hidden = true; store.signOut(); } }, icon('logout', 18), h('span', { text: 'Sign out' })));
      const b = h('button', { class: 'ub', type: 'button', 'aria-label': 'Account menu', 'aria-expanded': 'false' }, avatar(me.uid, me.name || '?', 30, me.avatar));
      b.onclick = (ev) => { ev.stopPropagation(); menu.hidden = !menu.hidden; b.setAttribute('aria-expanded', String(!menu.hidden)); };
      right.append(b, menu);
    }
    return h('header', { class: 'top' }, h('div', { class: 'top-in' },
      h('a', { class: 'logo', href: SITE + '/', 'aria-label': 'Eve Sandbox home' }, h('span', { class: 'lm', role: 'presentation' }), h('span', { class: 'lt' }, 'Eve ', h('span', { text: 'Sandbox' }))),
      h('a', { class: 'tag', href: '/', text: 'Community' }), right));
  }
  const footer = () => h('footer', { class: 'foot' }, h('div', { class: 'foot-in' },
    h('span', {}, '© ' + new Date().getFullYear() + ' Eve Sandbox. All rights reserved.'),
    h('span', { class: 'fl' }, h('a', { href: SITE + '/', text: 'Home' }), h('a', { href: SITE + '/terms/', text: 'Terms' }), h('a', { href: SITE + '/privacy/', text: 'Privacy' }), h('a', { href: SITE + '/contact/', text: 'Contact' }))));
  document.addEventListener('click', () => { const m = $('.umenu'); if (m && !m.hidden) m.hidden = true; });

  // ---------- votes ----------
  // One vote request per post at a time, always carrying the newest choice, so quick clicks can never arrive out of order.
  async function sendVote(p) {
    p.sending = true; p.busy = (p.busy || 0) + 1;
    try {
      for (;;) {
        const v = p.want;
        let total;
        try { total = await store.vote(me.uid, p.id, v); }
        catch (e) {
          p.score -= p.want - p.conf; p.myVote = p.conf; p.vlast = Date.now(); paintPost(p);   // undo only what was shown but never confirmed
          toast(errText(e), true); return;
        }
        p.conf = v; p.vlast = Date.now();
        if (p.want === v) { if (typeof total === 'number') p.score = total; paintPost(p); return; }
      }
    } finally { p.sending = false; p.busy -= 1; }
  }
  function voteCol(p, onChange) {
    const sc = h('b', { class: 'sc', text: String(p.score) });
    const up = h('button', { class: 'vb' + (p.myVote === 1 ? ' on' : ''), type: 'button', 'aria-label': 'Upvote', 'aria-pressed': String(p.myVote === 1) }, icon('up', 20, 2.6));
    const dn = h('button', { class: 'vb' + (p.myVote === -1 ? ' on dn' : ''), type: 'button', 'aria-label': 'Downvote', 'aria-pressed': String(p.myVote === -1) }, icon('down', 20, 2.6));
    const col = h('div', { class: 'vc', 'data-pid': p.id }, up, sc, dn);
    const act = (dir) => needUser(() => {
      const old = p.myVote || 0, nv = old === dir ? 0 : dir;
      if (!p.sending) p.conf = old;        // what the server has now, in case this has to be undone
      p.myVote = nv; p.score += nv - old; p.want = nv; p.vlast = Date.now();
      paintPost(p);
      if (!p.sending) sendVote(p);          // a running request will pick up the newest wish by itself
    });
    up.onclick = (ev) => { ev.preventDefault(); ev.stopPropagation(); act(1); };
    dn.onclick = (ev) => { ev.preventDefault(); ev.stopPropagation(); act(-1); };
    return col;
  }
  // Updates the numbers and arrows of one post wherever it is on screen, without rebuilding the page.
  function paintPost(p) {
    document.querySelectorAll('.vc[data-pid="' + p.id + '"]').forEach((col) => {
      const sc = col.querySelector('.sc'), b = col.querySelectorAll('.vb');
      if (sc && sc.textContent !== String(p.score)) sc.textContent = String(p.score);
      if (b.length === 2) {
        b[0].classList.toggle('on', p.myVote === 1); b[0].setAttribute('aria-pressed', String(p.myVote === 1));
        b[1].classList.toggle('on', p.myVote === -1); b[1].classList.toggle('dn', p.myVote === -1); b[1].setAttribute('aria-pressed', String(p.myVote === -1));
      }
    });
    document.querySelectorAll('.rc[data-pid="' + p.id + '"]').forEach((el) => {
      const t = ' ' + p.replyCount + (el.hasAttribute('data-long') ? (p.replyCount === 1 ? ' reply' : ' replies') : '');
      if (el.lastChild && el.lastChild.textContent !== t) el.lastChild.textContent = t;
    });
  }

  // ---------- live sync ----------
  // Every few seconds, while the page is open and in use, ask the server for the real scores and reply counts of what is on screen.
  // Fast while you are using the page (3 s on a post, 5 s on the list), slower while you only watch it, and it stops after 10 quiet minutes.
  const SYNC_IDLE = 10 * 60 * 1000;
  const sync = { busy: false, last: 0, act: Date.now() };
  ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'].forEach((n) => window.addEventListener(n, () => { sync.act = Date.now(); }, { passive: true }));
  const syncDelay = () => {
    const quiet = Date.now() - sync.act, onPost = route().name === 'post';
    if (quiet < 60 * 1000) return onPost ? 3000 : 5000;
    return 10000;
  };
  async function syncTick(force) {
    if (sync.busy || document.visibilityState !== 'visible' || !cfg || !cfg.configured) return;
    if (!force && Date.now() - sync.act > SYNC_IDLE) return;
    const r = route();
    let ids = [], since = null, list = [];
    if (r.name === 'feed') {
      if (feed.loading) return;
      list = feed.posts.slice(0, 40); ids = list.map((p) => p.id);
      if (feed.sort === 'new' && feed.sortLoaded) since = feed.posts.reduce((m, p) => Math.max(m, p.createdAt || 0), 0);
    } else if (r.name === 'post' && current) { list = [current]; ids = [current.id]; }
    else return;
    if (!ids.length && since === null) return;
    sync.busy = true;
    const where = r.name + ':' + (current ? current.id : '') + ':' + feed.sort;
    try {
      const t0 = Date.now();
      const d = await store.getScores(ids, since);
      const r2 = route();
      if (r2.name !== r.name || where !== r2.name + ':' + (current ? current.id : '') + ':' + feed.sort) return;
      let repliesChanged = false;
      list.forEach((p) => {
        const sc = d.scores && d.scores[p.id];
        if (!sc || p.busy || (p.vlast && p.vlast >= t0 - 50)) return;   // skip numbers that were asked for before my latest vote
        p.score = sc.s;
        if (p.replyCount !== sc.r) { p.replyCount = sc.r; repliesChanged = true; }
        if (me && d.mine) p.myVote = d.mine[p.id] || 0;
        paintPost(p);
      });
      const gone = (d.gone || []).filter((x) => ids.indexOf(x) >= 0);
      if (gone.length) {
        if (r.name === 'post') { toast('This post was deleted.'); current = null; go('/'); return; }
        feed.posts = feed.posts.filter((p) => gone.indexOf(p.id) < 0);
        if (hooks.redraw) hooks.redraw();
      }
      if (hooks.pill) hooks.pill(d.newer || 0);
      if (repliesChanged && r.name === 'post' && hooks.replies) hooks.replies();
    } catch (e) { /* try again at the next tick */ }
    finally { sync.busy = false; sync.last = Date.now(); }
  }
  (function loop() { setTimeout(async () => { try { await syncTick(false); } finally { loop(); } }, syncDelay()); })();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - sync.last > 3000) syncTick(true); });
  window.addEventListener('focus', () => { if (Date.now() - sync.last > 3000) syncTick(true); });

  async function refreshVotes() {
    const list = current ? [current] : feed.posts;
    if (!me || !list.length) return;
    try {
      const v = await store.getMyVotes(me.uid, list.map((p) => p.id));
      list.forEach((p) => { p.myVote = v[p.id] || 0; });
      if (hooks.redraw) hooks.redraw();
    } catch (e) { /* votes just show as not voted */ }
  }

  // ---------- share, report, delete ----------
  function postUrl(id) { return location.origin + '/p/' + id; }
  async function share(p) {
    const url = postUrl(p.id);
    if (navigator.share) {
      try { await navigator.share({ title: p.title, text: p.title, url }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    copyText(url, 'Link copied');
  }
  function copyText(t, msg) {
    const ok = () => toast(msg);
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t).then(ok, () => legacy()); } else legacy();
    function legacy() {
      const ta = h('textarea', { style: 'position:fixed;opacity:0' }); ta.value = t; document.body.append(ta); ta.select();
      try { document.execCommand('copy'); ok(); } catch (e) { toast('Copy this link: ' + t); }
      ta.remove();
    }
  }
  function reportBox(postId, replyId) {
    needUser(() => modal((box, close) => {
      const ta = h('textarea', { maxlength: '300', rows: '3', placeholder: 'What is wrong with it? (optional)', 'aria-label': 'Reason' });
      const err = h('p', { class: 'merr', hidden: true });
      const go = h('button', { class: 'btn pri', type: 'button', text: 'Send report' });
      go.onclick = async () => {
        go.disabled = true;
        try { await store.report(me.uid, postId, replyId || '', ta.value.trim().slice(0, 300)); close(); toast('Thanks, we will look at it.'); }
        catch (e) { go.disabled = false; err.hidden = false; err.textContent = errText(e); }
      };
      box.append(h('h3', { text: replyId ? 'Report this reply' : 'Report this post' }), ta, err, h('div', { class: 'mrow' }, h('button', { class: 'btn', type: 'button', text: 'Cancel', onclick: close }), go));
    }));
  }
  async function removePost(p) {
    if (!(await confirmBox('Delete this post?', 'It will be removed for everyone, together with its replies and pictures, and cannot be brought back.', 'Delete'))) return;
    try { await store.deletePost(p.id); toast('Post deleted'); feed.posts = feed.posts.filter((x) => x.id !== p.id); current = null; go('/'); }
    catch (e) { toast(errText(e), true); }
  }
  const canDelete = (x) => me && (me.uid === x.authorId || me.admin);

  // ---------- composers ----------
  function cooldown(last, gap) {
    const left = gap - (Date.now() - last);
    if (left > 0) { toast('Please wait ' + Math.ceil(left / 1000) + ' seconds before posting again.', true); return true; }
    return false;
  }
  function postComposer() {
    const wrap = h('section', { class: 'card comp' });
    let open = false, files = [], urls = [];
    const clearFiles = () => { urls.forEach((u) => URL.revokeObjectURL(u)); urls = []; files = []; };
    const draw = () => {
      wrap.replaceChildren();
      if (!open) {
        const b = h('button', { class: 'cstart', type: 'button' }, icon('plus', 18, 2.4), h('span', { text: 'Start a post...' }));
        b.onclick = () => needUser(() => { open = true; draw(); const t = $('#ptitle'); if (t) t.focus(); });
        wrap.append(b); return;
      }
      const t = h('input', { id: 'ptitle', type: 'text', maxlength: '120', placeholder: 'Title', 'aria-label': 'Title' });
      const b = h('textarea', { id: 'pbody', maxlength: '5000', rows: '5', placeholder: 'Write something (optional)', 'aria-label': 'Post text' });
      const cnt = h('span', { class: 'mute', text: '0 / 5000' });
      b.oninput = () => { cnt.textContent = b.value.length + ' / 5000'; };
      const err = h('p', { class: 'merr', hidden: true });
      const showErr = (m) => { err.hidden = false; err.textContent = m; };
      const picks = h('div', { class: 'picks', hidden: true });
      const pcnt = h('span', { class: 'mute', text: '' });
      const fin = h('input', { type: 'file', accept: IMG_TYPES.join(','), multiple: true, hidden: true, 'aria-label': 'Add pictures' });
      const drawPicks = () => {
        picks.hidden = !files.length;
        picks.replaceChildren(...files.map((f, i) => {
          const rm = h('button', { type: 'button', 'aria-label': 'Remove picture ' + (i + 1) }, icon('x', 12, 3));
          rm.onclick = () => { URL.revokeObjectURL(urls[i]); urls.splice(i, 1); files.splice(i, 1); drawPicks(); };
          return h('div', { class: 'pk' }, h('img', { src: urls[i], alt: 'Picture ' + (i + 1) + ' to upload' }), rm);
        }));
        pcnt.textContent = files.length ? files.length + ' / ' + MAX_IMGS + ' pictures' : '';
        addBtn.disabled = files.length >= MAX_IMGS;
      };
      const addBtn = h('button', { class: 'btn sm', type: 'button' }, icon('image', 16, 2.2), ' Add pictures');
      addBtn.onclick = () => fin.click();
      fin.onchange = async () => {
        const list = Array.from(fin.files || []); fin.value = ''; err.hidden = true;
        for (const f of list) {
          if (files.length >= MAX_IMGS) { showErr('You can add up to ' + MAX_IMGS + ' pictures.'); break; }
          if (IMG_TYPES.indexOf(f.type) < 0) { showErr('Only JPEG, PNG, WebP or GIF pictures are allowed.'); continue; }
          if (f.size > MAX_IMG) { showErr('Each picture can be 5 MB at most. "' + f.name + '" is too big.'); continue; }
          const g = await prepImage(f);
          if (g.size > MAX_IMG) { showErr('Each picture can be 5 MB at most. "' + f.name + '" is too big.'); continue; }
          files.push(g); urls.push(URL.createObjectURL(g));
        }
        drawPicks();
      };
      const postBtn = h('button', { class: 'btn pri', type: 'button', text: 'Post' });
      postBtn.onclick = () => {
        const title = t.value.trim(), body = b.value.trim();
        if (!title) { err.hidden = false; err.textContent = 'Give your post a title.'; return; }
        if (cooldown(lastPost, POST_GAP)) return;
        postBtn.disabled = true; err.hidden = true;
        needUser(async () => {
          try {
            const id = await store.createPost(me.uid, me.name, title, body, files.slice());
            lastPost = Date.now(); feed.posts = []; feed.cursor = null; feed.done = false; clearFiles();
            toast('Posted'); go('/p/' + id);
          } catch (e) { postBtn.disabled = false; err.hidden = false; err.textContent = errText(e); }
        });
        setTimeout(() => { postBtn.disabled = false; }, 4000);
      };
      wrap.append(t, b, picks, h('div', { class: 'crow' }, h('span', { class: 'cl' }, addBtn, fin, pcnt, cnt), h('div', { class: 'mrow' }, h('button', { class: 'btn', type: 'button', text: 'Cancel', onclick: () => { open = false; clearFiles(); draw(); } }), postBtn)), h('p', { class: 'fine' }, 'Pictures: JPEG, PNG, WebP or GIF, up to ' + MAX_IMGS + ' and 5 MB each. Replies are text only.'), err);
    };
    draw();
    return wrap;
  }

  // ---------- views ----------
  function postCard(p) {
    const a = h('a', { class: 'pbody', href: '/p/' + p.id },
      h('h2', { class: 'pt', text: p.title }),
      p.body ? h('p', { class: 'ps', text: p.body.slice(0, 220) }) : null,
      p.images && p.images.length ? h('div', { class: 'pimgs' }, h('img', { src: p.images[0], alt: '', loading: 'lazy' }), p.images.length > 1 ? h('span', { class: 'more-n', text: '+' + (p.images.length - 1) }) : null) : null,
      h('div', { class: 'meta' }, avatar(p.authorId, p.authorName, 20, p.authorAvatar), h('span', { text: p.authorName }), h('span', { text: '·' }), h('span', { text: ago(p.createdAt), title: full(p.createdAt) }),
        h('span', { class: 'rc', 'data-pid': p.id }, icon('chat', 14, 2.2), ' ' + p.replyCount), h('span', { class: 'pid', text: '#' + p.id })));
    const card = h('article', { class: 'card post' }, voteCol(p, () => card.replaceWith(postCard(p))), a);
    return card;
  }
  function feedView() {
    const my = ++seq;
    const goId = h('input', { type: 'text', placeholder: 'Post ID', maxlength: '12', 'aria-label': 'Go to post ID', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
    const goBtn = h('button', { class: 'btn sm', type: 'button', 'aria-label': 'Go' }, icon('search', 16, 2.4));
    const jump = () => { let v = goId.value.trim().toLowerCase(); const m = v.match(/post\/([a-z0-9]+)/); v = m ? m[1] : v.replace(/^#/, ''); if (!v) return; go('/p/' + encodeURIComponent(v)); };
    goBtn.onclick = jump; goId.onkeydown = (e) => { if (e.key === 'Enter') jump(); };
    const tab = (s, l) => h('a', { class: 'tab' + (feed.sort === s ? ' on' : ''), href: s === 'top' ? '/#/top' : '/', text: l });
    const list = h('div', { class: 'plist' });
    const pill = h('button', { class: 'newpill', type: 'button', hidden: true });
    const more = h('button', { class: 'btn more', type: 'button', text: 'Load more' });
    const status = h('div', { class: 'mute center' });
    const empty = h('div', { class: 'nopost', hidden: true }, icon('page', 64, 1.3), h('h2', { text: 'No posts yet' }), h('p', { class: 'mute', text: 'Be the first to start one!' }));
    const draw = () => {
      list.replaceChildren(...feed.posts.map(postCard));
      more.hidden = feed.done || !feed.posts.length;
      status.textContent = feed.loading ? 'Loading...' : '';
      empty.hidden = !(!feed.loading && !feed.posts.length && feed.done);
    };
    async function load(reset) {
      if (feed.loading && !reset) return;
      if (reset) { feed.posts = []; feed.cursor = null; feed.done = false; }
      const tk = ++feed.tk;
      feed.loading = true; draw();
      try {
        const r = await store.listPosts({ sort: feed.sort, after: feed.cursor, size: PAGE });
        if (tk !== feed.tk) return;
        if (me) { try { const v = await store.getMyVotes(me.uid, r.posts.map((p) => p.id)); r.posts.forEach((p) => { p.myVote = v[p.id] || 0; }); } catch (e) { /* ignore */ } }
        if (tk !== feed.tk) return;
        feed.posts = feed.posts.concat(r.posts); feed.cursor = r.cursor; feed.done = r.done; feed.loading = false;
        draw();
      } catch (e) { if (tk !== feed.tk) return; feed.loading = false; status.textContent = ''; list.replaceChildren(h('div', { class: 'card empty' }, h('p', { text: errText(e) }), h('button', { class: 'btn', type: 'button', text: 'Try again', onclick: () => load(true) }))); more.hidden = true; }
    }
    more.onclick = () => load(false);
    hooks.redraw = draw;
    pill.onclick = () => { pill.hidden = true; window.scrollTo({ top: 0 }); load(true); };
    hooks.pill = (n) => { if (feed.sort !== 'new') n = 0; pill.hidden = !n; if (n) pill.textContent = (n >= 99 ? '99+' : n) + (n === 1 ? ' new post' : ' new posts') + ' - show'; };
    const view = h('main', { class: 'wrap' },
      h('div', { class: 'hd' }, h('h1', { text: 'Community' }), h('p', { class: 'mute', text: 'Ask questions, share what you know and help other students.' })),
      postComposer(),
      h('div', { class: 'bar' }, h('div', { class: 'tabs' }, tab('new', 'New'), tab('top', 'Top')), h('div', { class: 'gid' }, goId, goBtn)),
      pill, list, status, empty, h('div', { class: 'center' }, more));
    if (feed.posts.length && feed.sortLoaded === feed.sort) { draw(); } else { feed.sortLoaded = feed.sort; load(true); }
    return view;
  }

  function replyItem(post, r, redraw) {
    const del = canDelete(r) ? h('button', { class: 'lnk', type: 'button' }, icon('trash', 14, 2.2), ' Delete') : null;
    if (del) del.onclick = async () => {
      if (!(await confirmBox('Delete this reply?', 'It will be removed for everyone.', 'Delete'))) return;
      try { await store.deleteReply(post.id, r.id); post.replyCount = Math.max(0, post.replyCount - 1); redraw(r.id); toast('Reply deleted'); } catch (e) { toast(errText(e), true); }
    };
    const rep = h('button', { class: 'lnk', type: 'button' }, icon('flag', 14, 2.2), ' Report');
    rep.onclick = () => reportBox(post.id, r.id);
    return h('div', { class: 'reply', 'data-id': r.id },
      h('div', { class: 'meta' }, avatar(r.authorId, r.authorName, 22, r.authorAvatar), userLink(r.authorUser, r.authorName), h('span', { text: '·' }), h('span', { text: ago(r.createdAt), title: full(r.createdAt) })),
      h('p', { class: 'rb' }, rich(r.body)), h('div', { class: 'acts' }, rep, del));
  }

  // ---------- picture viewer ----------
  // Opens a post's pictures on top of the page: zoom (wheel, double click or pinch), drag to move, arrows or swipe for the next picture, X / Esc / click outside / swipe down to close.
  function openViewer(urls, start) {
    if (document.querySelector('.viewer')) return;
    const n = urls.length;
    let i = 0, scale = 1, tx = 0, ty = 0, moved = false, swipe = null, loadTk = 0;
    const pts = new Map();
    let pinch = null, pan = null, downOnStage = false;
    const prevFocus = document.activeElement;
    const img = h('img', { class: 'vimg', alt: '', draggable: 'false', decoding: 'async' });
    const spin = h('div', { class: 'vspin', 'aria-hidden': 'true' });
    const fail = h('p', { class: 'vfail', hidden: true, text: 'This picture could not be loaded.' });
    const stage = h('div', { class: 'vstage' }, img, spin, fail);
    const closeBtn = h('button', { class: 'vbtn vclose', type: 'button', 'aria-label': 'Close picture' }, icon('x', 22, 2.2));
    const prevBtn = h('button', { class: 'vbtn vprev', type: 'button', 'aria-label': 'Previous picture', hidden: n < 2 }, icon('back', 24, 2.2));
    const nextBtn = h('button', { class: 'vbtn vnext', type: 'button', 'aria-label': 'Next picture', hidden: n < 2 }, icon('fwd', 24, 2.2));
    const count = h('div', { class: 'vcount', hidden: n < 2, 'aria-live': 'polite' });
    const root = h('div', { class: 'viewer', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Picture viewer' }, stage, closeBtn, prevBtn, nextBtn, count);

    const apply = (anim) => {
      img.style.transition = anim ? 'transform .2s ease, opacity .2s' : 'opacity .2s';
      img.style.transform = 'translate3d(' + tx + 'px,' + ty + 'px,0) scale(' + scale + ')';
      img.classList.toggle('zoomed', scale > 1);
    };
    const clamp = () => {
      const w = img.clientWidth * scale, hh = img.clientHeight * scale;
      const mx = Math.max(0, (w - stage.clientWidth) / 2), my = Math.max(0, (hh - stage.clientHeight) / 2);
      tx = Math.min(mx, Math.max(-mx, tx)); ty = Math.min(my, Math.max(-my, ty));
      if (scale <= 1) { tx = 0; ty = 0; }
    };
    const zoomAt = (s2, cx, cy, anim) => {
      s2 = Math.min(5, Math.max(1, s2));
      const r = stage.getBoundingClientRect(), px = cx - (r.left + r.width / 2), py = cy - (r.top + r.height / 2);
      tx = px - (px - tx) * (s2 / scale); ty = py - (py - ty) * (s2 / scale);
      scale = s2; clamp(); apply(anim);
    };
    const pre = (k) => { if (n > 1) { const m = new Image(); m.decoding = 'async'; m.src = urls[(k + n) % n]; } };
    function show(k) {
      i = (k + n) % n; scale = 1; tx = 0; ty = 0;
      const tk = ++loadTk;
      img.style.opacity = '0'; fail.hidden = true; spin.hidden = false; apply(false);
      count.textContent = (i + 1) + ' / ' + n;
      img.alt = 'Picture ' + (i + 1) + ' of ' + n;
      const done = (ok) => { if (tk !== loadTk) return; spin.hidden = true; if (ok) { img.style.opacity = '1'; } else { fail.hidden = false; } pre(i + 1); pre(i - 1); };
      img.onload = () => done(true); img.onerror = () => done(false);
      img.src = urls[i];
      if (img.complete && img.naturalWidth) done(true);
    }
    function close() {
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onResize);
      root.remove(); document.documentElement.classList.remove('vlock');
      if (prevFocus && prevFocus.focus) { try { prevFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    }
    function onKey(ev) {
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(); }
      else if (ev.key === 'ArrowLeft' && n > 1) { ev.preventDefault(); show(i - 1); }
      else if (ev.key === 'ArrowRight' && n > 1) { ev.preventDefault(); show(i + 1); }
      else if (ev.key === '+' || ev.key === '=') { const r = stage.getBoundingClientRect(); zoomAt(scale * 1.4, r.left + r.width / 2, r.top + r.height / 2, true); }
      else if (ev.key === '-') { const r = stage.getBoundingClientRect(); zoomAt(scale / 1.4, r.left + r.width / 2, r.top + r.height / 2, true); }
      else if (ev.key === 'Tab') {
        const f = Array.from(root.querySelectorAll('button')).filter((b) => !b.hidden);
        if (!f.length) return;
        const a = document.activeElement, k = f.indexOf(a);
        ev.preventDefault();
        f[(k + (ev.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    }
    const onResize = () => { clamp(); apply(false); };

    closeBtn.onclick = close;
    prevBtn.onclick = () => show(i - 1);
    nextBtn.onclick = () => show(i + 1);
    stage.addEventListener('wheel', (ev) => { ev.preventDefault(); zoomAt(scale * Math.exp(-ev.deltaY * 0.0022), ev.clientX, ev.clientY, false); }, { passive: false });
    let lastTap = { t: 0, x: 0, y: 0 };
    stage.addEventListener('pointerdown', (ev) => {
      if (ev.button) return;
      downOnStage = ev.target === stage; moved = false;
      pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      try { stage.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
      if (pts.size === 2) {
        const [a, b] = Array.from(pts.values());
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s: scale }; pan = null; swipe = null;
      } else if (pts.size === 1) {
        if (scale > 1) pan = { x: ev.clientX, y: ev.clientY, tx, ty };
        else swipe = { x: ev.clientX, y: ev.clientY };
      }
    });
    stage.addEventListener('pointermove', (ev) => {
      if (!pts.has(ev.pointerId)) return;
      pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pinch && pts.size >= 2) {
        const [a, b] = Array.from(pts.values());
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        zoomAt(pinch.s * d / pinch.d, (a.x + b.x) / 2, (a.y + b.y) / 2, false); moved = true;
      } else if (pan) {
        const dx = ev.clientX - pan.x, dy = ev.clientY - pan.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
        tx = pan.tx + dx; ty = pan.ty + dy; clamp(); apply(false);
      } else if (swipe) {
        const dx = ev.clientX - swipe.x, dy = ev.clientY - swipe.y;
        if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
        if (dy > 0 && Math.abs(dy) > Math.abs(dx)) { img.style.transition = 'none'; img.style.transform = 'translate3d(0,' + dy + 'px,0)'; img.style.opacity = String(Math.max(.35, 1 - dy / 400)); }
      }
    });
    const end = (ev) => {
      if (!pts.has(ev.pointerId)) return;
      const was = swipe;
      pts.delete(ev.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 0) {
        pan = null; swipe = null;
        if (was && ev.type === 'pointerup' && scale <= 1) {
          const dx = ev.clientX - was.x, dy = ev.clientY - was.y;
          if (dy > 100 && dy > Math.abs(dx)) { close(); return; }
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) && n > 1) { show(i + (dx < 0 ? 1 : -1)); return; }
          scale = 1; apply(true); img.style.opacity = '1';
        }
        if (ev.type === 'pointerup' && !moved) {
          // two quick taps (or a double click) zoom in and out
          const now = Date.now();
          if (now - lastTap.t < 320 && Math.hypot(ev.clientX - lastTap.x, ev.clientY - lastTap.y) < 30) {
            lastTap.t = 0; downOnStage = false;
            if (scale > 1) { scale = 1; tx = 0; ty = 0; apply(true); } else zoomAt(2.6, ev.clientX, ev.clientY, true);
            return;
          }
          lastTap = { t: now, x: ev.clientX, y: ev.clientY };
        }
        if (downOnStage && ev.target === stage && !moved && ev.type === 'pointerup') close();
        downOnStage = false;
      } else if (pts.size === 1 && scale > 1) {
        const q = Array.from(pts.values())[0]; pan = { x: q.x, y: q.y, tx, ty };
      }
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
    stage.addEventListener('contextmenu', (ev) => ev.preventDefault());

    document.documentElement.classList.add('vlock');
    document.body.append(root);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onResize);
    show(start || 0);
    closeBtn.focus({ preventScroll: true });
  }

  function postView(id) {
    const my = ++seq;
    const view = h('main', { class: 'wrap' });
    if (!POST_ID.test(id)) { view.append(backLink(), notFound()); return view; }
    const holder = h('div', {}, h('div', { class: 'card empty mute', text: 'Loading...' }));
    view.append(backLink(), holder);
    store.getPost(id).then(async (p) => {
      if (my !== seq) return;
      if (!p) { holder.replaceChildren(notFound()); return; }
      current = p; document.title = 'Eve Sandbox - ' + p.title.slice(0, 60);
      p.myVote = 0;
      if (me) { try { p.myVote = (await store.getMyVotes(me.uid, [p.id]))[p.id] || 0; } catch (e) { /* ignore */ } }
      if (my !== seq) return;
      const replies = []; let rCursor = null, rDone = false, rLoading = false;
      const rList = h('div', { class: 'rlist' }), rMore = h('button', { class: 'btn more', type: 'button', text: 'Load more replies' }), rStat = h('p', { class: 'mute center' });
      const head = h('section', { class: 'card pfull' });
      const drawHead = () => {
        const sh = h('button', { class: 'lnk', type: 'button' }, icon('share', 15, 2.2), ' Share'); sh.onclick = () => share(p);
        const rp = h('button', { class: 'lnk', type: 'button' }, icon('flag', 15, 2.2), ' Report'); rp.onclick = () => reportBox(p.id, '');
        const dl = canDelete(p) ? h('button', { class: 'lnk', type: 'button' }, icon('trash', 15, 2.2), ' Delete') : null; if (dl) dl.onclick = () => removePost(p);
        const idc = h('button', { class: 'pid btnid', type: 'button', title: 'Copy post ID' }, '#' + p.id); idc.onclick = () => copyText(p.id, 'Post ID copied');
        head.replaceChildren(voteCol(p, drawHead), h('div', { class: 'pmain' },
          h('div', { class: 'meta' }, avatar(p.authorId, p.authorName, 24, p.authorAvatar), userLink(p.authorUser, p.authorName), h('span', { text: '·' }), h('span', { text: ago(p.createdAt), title: full(p.createdAt) }), idc),
          h('h1', { class: 'ptitle', text: p.title }), p.body ? h('p', { class: 'pb' }, rich(p.body)) : null,
          p.images && p.images.length ? h('div', { class: 'gal n' + p.images.length }, p.images.map((u, i) => h('div', { class: 'gi', role: 'button', tabindex: '0', 'aria-label': 'View picture ' + (i + 1) + ' of ' + p.images.length, onclick: (ev) => { ev.preventDefault(); openViewer(p.images, i); }, onkeydown: (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openViewer(p.images, i); } } }, h('img', { src: u, alt: 'Picture ' + (i + 1) + ' of ' + p.images.length, loading: 'lazy', draggable: 'false' })))) : null,
          h('div', { class: 'acts' }, h('span', { class: 'rc', 'data-pid': p.id, 'data-long': '1' }, icon('chat', 15, 2.2), ' ' + p.replyCount + (p.replyCount === 1 ? ' reply' : ' replies')), sh, rp, dl)));
      };
      const drawReplies = () => {
        rList.replaceChildren(...replies.map((r) => replyItem(p, r, (gone) => { const i = replies.findIndex((x) => x.id === gone); if (i >= 0) replies.splice(i, 1); drawReplies(); drawHead(); })));
        rMore.hidden = rDone; rStat.textContent = rLoading ? 'Loading...' : (!replies.length ? 'No replies yet.' : '');
      };
      async function loadReplies() {
        if (rLoading) return; rLoading = true; drawReplies();
        try { const r = await store.listReplies(p.id, { after: rCursor, size: REPLY_PAGE }); if (my !== seq) return; replies.push(...r.replies); rCursor = r.cursor; rDone = r.done; }
        catch (e) { toast(errText(e), true); }
        rLoading = false; drawReplies();
      }
      rMore.onclick = loadReplies;
      const box = h('section', { class: 'card comp' });
      const drawBox = () => {
        box.replaceChildren();
        const ta = h('textarea', { maxlength: '2000', rows: '3', placeholder: me ? 'Write a reply...' : 'Sign in to reply', 'aria-label': 'Reply' });
        const err = h('p', { class: 'merr', hidden: true });
        const go = h('button', { class: 'btn pri', type: 'button', text: 'Reply' });
        ta.onfocus = () => { if (!me) { ta.blur(); needUser(() => { drawBox(); const t = $('.comp textarea'); if (t) t.focus(); }); } };
        go.onclick = () => {
          const body = ta.value.trim();
          if (!body) { err.hidden = false; err.textContent = 'Write something first.'; return; }
          if (cooldown(lastReply, REPLY_GAP)) return;
          go.disabled = true; err.hidden = true;
          needUser(async () => {
            try {
              const rid = await store.createReply(me.uid, me.name, p.id, body);
              lastReply = Date.now(); p.replyCount += 1; ta.value = '';
              replies.push({ id: rid, body, authorId: me.uid, authorName: me.name, authorUser: me.username, authorAvatar: me.avatar, createdAt: Date.now() });
              drawReplies(); drawHead(); toast('Reply posted');
            } catch (e) { err.hidden = false; err.textContent = errText(e); }
            go.disabled = false;
          });
          setTimeout(() => { go.disabled = false; }, 4000);
        };
        box.append(ta, err, h('div', { class: 'mrow' }, go));
      };
      drawHead(); drawBox(); holder.replaceChildren(head, box, h('h3', { class: 'rh', text: 'Replies' }), rList, rStat, h('div', { class: 'center' }, rMore));
      loadReplies();
      hooks.replies = () => { if (rLoading) return; replies.length = 0; rCursor = null; rDone = false; loadReplies(); };
      hooks.redraw = () => { drawHead(); drawReplies(); const t = $('.comp textarea'); if (t) t.placeholder = me ? 'Write a reply...' : 'Sign in to reply'; };
    }).catch((e) => { console.error('page error', errInfo(e), e); if (my === seq) holder.replaceChildren(h('div', { class: 'card empty' }, h('p', { text: errText(e) }), h('p', { class: 'fine mute', text: 'This is usually brief. Give it a moment and try again. If it keeps happening, please come back a little later.' }), h('button', { class: 'btn', type: 'button', text: 'Try again', onclick: render }))); });
    return view;
  }
  const backLink = () => h('a', { class: 'back', href: '/' }, icon('back', 16, 2.4), ' All posts');
  const notFound = () => h('div', { class: 'card empty' }, h('h2', { text: 'Post not found' }), h('p', { class: 'mute', text: 'It may have been deleted, or the ID is not right.' }), h('a', { class: 'btn pri', href: '/', text: 'Back to the community' }));


  // ---------- profiles ----------
  function linkChips(links) {
    const out = [];
    const ext = (label, val, href) => h('a', { class: 'lchip', href, target: '_blank', rel: 'noopener noreferrer nofollow ugc' }, h('b', { text: label }), val ? ' ' + val : '');
    if (links.instagram) out.push(ext('Instagram', '@' + links.instagram, 'https://instagram.com/' + encodeURIComponent(links.instagram)));
    if (links.discord) {
      if (/^discord\.gg\/[A-Za-z0-9-]+$/.test(links.discord)) out.push(ext('Discord', 'invite', 'https://' + links.discord));
      else { const b = h('button', { class: 'lchip', type: 'button', title: 'Copy Discord username' }, h('b', { text: 'Discord' }), ' ' + links.discord); b.onclick = () => copyText(links.discord, 'Discord username copied'); out.push(b); }
    }
    if (links.x) out.push(ext('X', '@' + links.x, 'https://x.com/' + encodeURIComponent(links.x)));
    if (links.youtube) out.push(ext('YouTube', '@' + links.youtube, 'https://youtube.com/@' + encodeURIComponent(links.youtube)));
    if (links.website && /^https:\/\//.test(links.website)) { let host = 'link'; try { host = new URL(links.website).hostname; } catch (e) { /* keep */ } out.push(ext('Website', host, links.website)); }
    return out;
  }
  // Cuts the middle square out of the picture and shrinks it to 512 px. This also drops any hidden photo details.
  async function squareJpeg(f) {
    if (!window.createImageBitmap) return f;
    try {
      const bm = await createImageBitmap(f);
      const side = Math.min(bm.width, bm.height), out = Math.min(512, side);
      const c = document.createElement('canvas'); c.width = c.height = out;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, out, out);
      x.drawImage(bm, (bm.width - side) / 2, (bm.height - side) / 2, side, side, 0, 0, out, out);
      if (bm.close) bm.close();
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
      if (blob && blob.size) return blob;
    } catch (e) { /* use the original */ }
    return f;
  }
  function editBox(pf, done) {
    modal((box, close) => {
      box.classList.add('wide');
      const err = h('p', { class: 'merr', hidden: true });
      const showErr = (m) => { err.hidden = false; err.textContent = m; };
      let ver = pf.avatar;
      const avrow = h('div', { class: 'avrow' });
      const fin = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true, 'aria-label': 'Profile picture' });
      const drawAv = () => {
        const pick = h('button', { class: 'btn sm', type: 'button', text: ver ? 'Change picture' : 'Add picture' });
        pick.onclick = () => fin.click();
        const rm = ver ? h('button', { class: 'btn sm', type: 'button', text: 'Remove' }) : null;
        if (rm) rm.onclick = async () => { try { await store.removeAvatar(); ver = 0; pf.avatar = 0; me.avatar = 0; drawAv(); renderHeader(); done(); } catch (e) { showErr(errText(e)); } };
        avrow.replaceChildren(avatar(pf.uid, pf.name, 64, ver), h('div', {}, h('div', { class: 'avbtns' }, pick, rm), h('p', { class: 'fine', text: 'JPEG, PNG or WebP, up to 3 MB.' })));
      };
      fin.onchange = async () => {
        const f = fin.files && fin.files[0]; fin.value = ''; err.hidden = true;
        if (!f) return;
        if (['image/jpeg', 'image/png', 'image/webp'].indexOf(f.type) < 0) { showErr('Use a JPEG, PNG or WebP picture.'); return; }
        if (f.size > MAX_AVATAR) { showErr('A profile picture can be 3 MB at most.'); return; }
        try {
          const v = await store.setAvatar(await squareJpeg(f));
          ver = v; pf.avatar = v; me.avatar = v; drawAv(); renderHeader(); done(); toast('Picture updated');
        } catch (e) { showErr(errText(e)); }
      };
      drawAv();
      const fld = (id, label, val, ph, max) => [h('label', { class: 'fl2', for: id, text: label }), h('input', { id, type: 'text', value: val || '', placeholder: ph || '', maxlength: String(max || 200), autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' })];
      const L2 = pf.links || {};
      const nm = fld('e-name', 'Display name', pf.name, '', 30), us = fld('e-user', 'Username', pf.username, '', 20);
      const bio = h('textarea', { id: 'ebio', maxlength: '300', rows: '4', placeholder: 'Tell people a little about you', 'aria-label': 'Bio' }); bio.value = pf.bio || '';
      const bc = h('span', { class: 'mute', text: bio.value.length + ' / 300' }); bio.oninput = () => { bc.textContent = bio.value.length + ' / 300'; };
      const ig = fld('e-ig', 'Instagram', L2.instagram, 'username or profile link'), dc = fld('e-dc', 'Discord', L2.discord, 'username or invite link (discord.gg/...)'),
        xx = fld('e-x', 'X', L2.x, 'username or profile link'), yt = fld('e-yt', 'YouTube', L2.youtube, '@handle or channel link'), wb = fld('e-web', 'Website', L2.website, 'https://...');
      const lk = h('input', { type: 'checkbox', id: 'elikes', checked: !!pf.showLikes });
      const go2 = h('button', { class: 'btn pri', type: 'button', text: 'Save' });
      go2.onclick = async () => {
        const name = cleanName(nm[1].value), un = us[1].value.trim().toLowerCase().replace(/^@/, '');
        if (name.length < 2) return showErr(errText({ code: 'bad-name' }));
        if (!USER_RE.test(un)) return showErr(errText({ code: 'bad-username' }));
        err.hidden = true; go2.disabled = true;
        try {
          const r = await store.saveProfile({ name, username: un, bio: bio.value.trim(), showLikes: lk.checked,
            links: { instagram: ig[1].value, discord: dc[1].value, x: xx[1].value, youtube: yt[1].value, website: wb[1].value } });
          close(); toast('Profile saved'); renderHeader();
          go('/id/' + r.username + location.search);
        } catch (e) { go2.disabled = false; showErr(errText(e)); }
      };
      box.append(h('h3', { text: 'Edit profile' }), avrow, fin, ...nm, h('p', { class: 'fine', text: 'Shown on your posts and replies.' }), ...us,
        h('p', { class: 'fine', text: 'Your address: ' + location.host + '/id/username. You can change the username once every 30 days.' }),
        h('label', { class: 'fl2', for: 'ebio', text: 'Bio' }), bio, h('div', { class: 'crow' }, bc),
        h('h4', { class: 'fl3', text: 'Links (all optional)' }), ...ig, ...dc, ...xx, ...yt, ...wb,
        h('label', { class: 'chk' }, lk, ' Show the posts I like on my profile'),
        h('p', { class: 'fine', text: 'Off by default. Only upvotes are shown, and only if you turn this on. Everything on a profile is public.' }),
        err, h('div', { class: 'mrow' }, h('button', { class: 'btn', type: 'button', text: 'Cancel', onclick: close }), go2));
    });
  }

  // What a profile tab shows when it has nothing: a picture that fits the tab, a title and one line, all centred in the free space.
  const EMPTY = {
    posts: { ic: 'page', t: 'No posts yet', own: 'Posts you write will show up here.', other: (n) => n + ' has not posted anything yet.' },
    replies: { ic: 'chat', t: 'No replies yet', own: 'Replies you write will show up here.', other: (n) => n + ' has not replied to anything yet.' },
    liked: { ic: 'heart', t: 'No liked posts yet', own: 'Posts you like will show up here.', other: (n) => n + ' has not liked any posts yet.' }
  };
  const emptyBox = (ic, title, line) => h('div', { class: 'nopost pe' }, icon(ic, 56, 1.3), h('h2', { text: title }), h('p', { class: 'mute', text: line }));
  function profReply(r) {
    return h('div', { class: 'reply' },
      h('div', { class: 'meta' }, h('span', { text: 'Replied to' }), h('a', { class: 'unl', href: '/p/' + r.postId, text: r.postTitle || 'a post' }), h('span', { text: '·' }), h('span', { text: ago(r.createdAt), title: full(r.createdAt) })),
      h('p', { class: 'rb' }, rich(r.body)));
  }
  function profileView(uname, tab) {
    const my = ++seq;
    const view = h('main', { class: 'wrap pv' });
    const holder = h('div', { class: 'pvh' }, h('div', { class: 'card empty mute', text: 'Loading...' }));
    view.append(backLink(), holder);
    store.getProfile(uname).then((pf) => {
      if (my !== seq) return;
      if (!pf) { holder.replaceChildren(h('div', { class: 'card empty' }, h('h2', { text: 'Profile not found' }), h('p', { class: 'mute', text: 'There is no member with that username.' }), h('a', { class: 'btn pri', href: '/', text: 'Back to the community' }))); return; }
      document.title = 'Eve Sandbox - ' + pf.name + ' (@' + pf.username + ')';
      const isMe = () => !!me && me.uid === pf.uid;
      const head = h('section', { class: 'card prof' });
      const drawHead = () => {
        const chips = linkChips(pf.links || {});
        const edit = isMe() ? h('button', { class: 'btn sm', type: 'button' }, icon('edit', 15, 2.2), ' Edit profile') : null;
        if (edit) edit.onclick = () => editBox(pf, drawHead);
        head.replaceChildren(...[
          h('div', { class: 'prow' }, avatar(pf.uid, pf.name, 84, pf.avatar), h('div', { class: 'pinfo' }, h('h1', { class: 'pname', text: pf.name }), h('div', { class: 'mute', text: '@' + pf.username }), h('div', { class: 'mute sm', text: 'Joined ' + joined(pf.createdAt) })), edit),
          pf.bio ? h('p', { class: 'pbio' }, rich(pf.bio)) : null,
          chips.length ? h('div', { class: 'lchips' }, chips) : null,
          h('div', { class: 'pstats' }, h('span', {}, h('b', { text: String(pf.counts.posts) }), ' posts'), h('span', {}, h('b', { text: String(pf.counts.replies) }), ' replies'), pf.counts.likes != null ? h('span', {}, h('b', { text: String(pf.counts.likes) }), ' liked') : null)].filter(Boolean));
      };
      const kinds = [['posts', 'Posts', '/id/' + pf.username], ['replies', 'Replies', '/id/' + pf.username + '?tab=replies'], ['liked', 'Liked posts', '/id/' + pf.username + '?tab=liked']];
      const tabs = h('div', { class: 'tabs ptabs' }, kinds.map((k) => h('a', { class: 'tab' + (tab === k[0] ? ' on' : ''), href: k[2], text: k[1] })));
      const list = h('div', { class: 'plist' }), more = h('button', { class: 'btn more', type: 'button', text: 'Load more' }), stat = h('p', { class: 'mute center' });
      let items = [], cursor = null, done = false, loading = false, hidden = false;
      const drawList = () => {
        if (hidden) { list.classList.add('isempty'); list.replaceChildren(emptyBox('lock', 'Liked posts are private', pf.name + ' keeps liked posts private.')); more.hidden = true; stat.textContent = ''; return; }
        const none = !items.length && done && !loading, E = EMPTY[tab];
        list.classList.toggle('isempty', none);
        list.replaceChildren(...(none ? [emptyBox(E.ic, E.t, isMe() ? E.own : E.other(pf.name))] : items.map(tab === 'replies' ? profReply : postCard)));
        more.hidden = done; stat.textContent = loading ? 'Loading...' : '';
      };
      async function loadMore() {
        if (loading) return; loading = true; drawList();
        try {
          const fn = tab === 'replies' ? store.listUserReplies : tab === 'liked' ? store.listUserLikes : store.listUserPosts;
          const r = await fn.call(store, pf.username, { after: cursor, size: PAGE });
          if (my !== seq) return;
          if (r.hidden) hidden = true;
          const got = r.posts || r.replies || [];
          if (me && tab !== 'replies' && got.length) { try { const v = await store.getMyVotes(me.uid, got.map((x) => x.id)); got.forEach((x) => { x.myVote = v[x.id] || 0; }); } catch (e) { /* ignore */ } }
          if (my !== seq) return;
          items = items.concat(got); cursor = r.cursor; done = r.done;
        } catch (e) { toast(errText(e), true); }
        loading = false; drawList();
      }
      more.onclick = loadMore;
      hooks.redraw = () => { drawHead(); if (tab === 'liked') { items = []; cursor = null; done = false; hidden = false; loadMore(); } else drawList(); };
      drawHead(); holder.replaceChildren(head, h('div', { class: 'bar' }, tabs), list, stat, h('div', { class: 'center' }, more));
      loadMore();
    }).catch((e) => { console.error('page error', errInfo(e), e); if (my === seq) holder.replaceChildren(h('div', { class: 'card empty' }, h('p', { text: errText(e) }), h('p', { class: 'fine mute', text: 'This is usually brief. Give it a moment and try again. If it keeps happening, please come back a little later.' }), h('button', { class: 'btn', type: 'button', text: 'Try again', onclick: render }))); });
    return view;
  }

  // ---------- settings ----------
  const SETTINGS = [
    { id: 'account', icon: 'user', title: 'Account', sub: 'Your details, and deleting your account', need: true },
    { id: 'display', icon: 'sun', title: 'Display', sub: 'Theme and text size', need: false },
    { id: 'security', icon: 'shield', title: 'Security', sub: 'Your password and how you sign in', need: true },
    { id: 'privacy', icon: 'eye', title: 'Privacy', sub: 'What other people can see', need: true }
  ];
  function seg(options, current, onPick) {
    const wrap = h('div', { class: 'seg', role: 'radiogroup' });
    options.forEach(([val, label]) => {
      const b = h('button', { type: 'button', role: 'radio', class: val === current ? 'on' : '', 'aria-checked': String(val === current), text: label });
      b.onclick = () => { onPick(val); wrap.querySelectorAll('button').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); }); };
      wrap.append(b);
    });
    return wrap;
  }
  const line = (k, v) => h('div', { class: 'sline' }, h('span', { class: 'sk', text: k }), h('span', { class: 'sv', text: v }));

  function accountSection() {
    const how = me.provider === 'password' ? 'Email and password' : me.provider === 'google' ? 'Google' : '';
    const edit = h('button', { class: 'btn sm', type: 'button', text: 'Edit profile', onclick: () => { if (incomplete()) nameBox(true); else go('/id/' + me.username); } });
    return [
      h('div', { class: 'card sbox' },
        line('Email', me.email || '-'), line('Display name', me.name || 'Not set yet'), line('Username', me.username ? '@' + me.username : 'Not set yet'), how ? line('Signed in with', how) : null,
        h('p', { class: 'fine', text: 'Your name, username, picture, bio and links are changed with Edit profile on your profile page. Your email is never shown to anyone.' }), h('div', { class: 'sact' }, edit)),
      h('div', { class: 'card sbox sdanger' },
        h('h3', { text: 'Delete account' }),
        h('p', { class: 'mute', text: 'Permanently deletes your account, profile and picture. You choose whether your posts, pictures and replies are deleted too. This cannot be undone.' }),
        h('div', { class: 'sact' }, h('button', { class: 'btn danger sm', type: 'button', text: 'Delete my account', onclick: deleteBox })))
    ];
  }
  function displaySection() {
    return [h('div', { class: 'card sbox' },
      h('div', { class: 'sline col' }, h('span', { class: 'sk', text: 'Theme' }),
        seg([['', 'Same as my device'], ['light', 'Light'], ['dark', 'Dark']], PREF.get('theme') || '', (v) => { PREF.set('theme', v); applyDisplay(); })),
      h('div', { class: 'sline col' }, h('span', { class: 'sk', text: 'Text size' }),
        seg([['s', 'Small'], ['', 'Normal'], ['l', 'Large']], PREF.get('size') || '', (v) => { PREF.set('size', v); applyDisplay(); })),
      h('p', { class: 'fine', text: 'These choices are saved in this browser only.' }))];
  }
  function securitySection() {
    if (me.provider === 'google') {
      return [h('div', { class: 'card sbox' }, h('h3', { text: 'Password' }),
        h('p', { class: 'mute', text: 'You sign in with Google, so this account has no password of its own. Your Google password and 2-step verification are managed in your Google account.' }),
        h('div', { class: 'sact' }, h('a', { class: 'btn sm', href: 'https://myaccount.google.com/security', target: '_blank', rel: 'noopener noreferrer', text: 'Open Google account security' })))];
    }
    const err = h('p', { class: 'merr', hidden: true, role: 'alert' });
    const mk = (id, ac, label) => [h('label', { class: 'fl2', for: id, text: label }), h('input', { id, type: 'password', autocomplete: ac, maxlength: '128' })];
    const [l1, cur] = mk('pwcur', 'current-password', 'Current password'), [l2, nw] = mk('pwnew', 'new-password', 'New password'), [l3, rp] = mk('pwrep', 'new-password', 'New password again');
    const go2 = h('button', { class: 'btn pri sm', type: 'submit', text: 'Change password' });
    const forgot = h('button', { class: 'linkbtn', type: 'button', text: 'Forgot your current password?' });
    const form = h('form', { novalidate: true }, l1, cur, l2, nw, l3, rp, h('p', { class: 'fine', text: 'Use 8 to 128 characters.' }), err, h('div', { class: 'sact' }, go2, forgot));
    const bad = (code) => { err.hidden = false; err.textContent = errText({ code }); };
    form.onsubmit = async (ev) => {
      ev.preventDefault(); err.hidden = true;
      if (!cur.value) return bad('need-password');
      if (nw.value.length < 8 || nw.value.length > 128) return bad('weak-password');
      if (nw.value !== rp.value) return bad('password-mismatch');
      if (nw.value === cur.value) return bad('same-password');
      go2.disabled = true;
      try { await store.changePassword(cur.value, nw.value); form.reset(); toast('Your password was changed.'); }
      catch (e) { err.hidden = false; err.textContent = errText(e); }
      go2.disabled = false;
    };
    forgot.onclick = async () => {
      forgot.disabled = true;
      try { await store.resetPassword(me.email); toast('If that account has a password, we sent a reset link to ' + me.email + '.'); }
      catch (e) { toast(errText(e), true); }
      forgot.disabled = false;
    };
    return [h('div', { class: 'card sbox' }, h('h3', { text: 'Change password' }), form,
      me.provider ? null : h('p', { class: 'fine', text: 'Signed in with Google? Then there is no password here: it is managed in your Google account.' }))];
  }
  function privacySection() {
    const sw = h('input', { type: 'checkbox', id: 'swlikes', class: 'sw', role: 'switch' });
    sw.checked = !!me.showLikes;
    sw.onchange = async () => {
      sw.disabled = true;
      try { const on = await store.setShowLikes(sw.checked); me.showLikes = on; toast(on ? 'Your liked posts are now shown on your profile.' : 'Your liked posts are now private.'); }
      catch (e) { sw.checked = !sw.checked; toast(errText(e), true); }
      sw.disabled = false;
    };
    return [h('div', { class: 'card sbox' },
      h('div', { class: 'sline' }, h('label', { class: 'sk', for: 'swlikes', text: 'Show the posts I liked on my profile' }), sw),
      h('p', { class: 'fine', text: 'Off by default. Everyone can always see your display name, username, picture, bio, links, posts and replies. Your email is never shown.' }))];
  }
  const BUILDERS = { account: accountSection, display: displaySection, security: securitySection, privacy: privacySection };

  function deleteBox() {
    modal((box, close) => {
      let how = me.provider === 'google' ? 'google' : 'password', busy = false;
      const err = h('p', { class: 'merr', hidden: true, role: 'alert' });
      const word = h('input', { id: 'delword', type: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', 'aria-label': 'Type DELETE to confirm' });
      const pw = h('input', { id: 'delpass', type: 'password', autocomplete: 'current-password', maxlength: '128', 'aria-label': 'Your password' });
      const pwRow = h('div', {}, h('label', { class: 'fl2', for: 'delpass', text: 'Your password' }), pw);
      const gnote = h('p', { class: 'fine', text: 'A Google window will open so you can confirm it is you.' });
      const swap = h('button', { class: 'linkbtn', type: 'button', hidden: !!me.provider });
      const opt = (id, text) => { const c = h('input', { type: 'checkbox', id }); return [c, h('label', { class: 'opt', for: id }, c, h('span', { text }))]; };
      const [cbPosts, lPosts] = opt('delposts', 'Also delete all my posts (and the pictures on them)');
      const [cbMedia, lMedia] = opt('delmedia', 'Also delete the pictures on my posts');
      const [cbReplies, lReplies] = opt('delreplies', 'Also delete all my replies');
      const choice = h('div', { class: 'opts' }, h('p', { class: 'fl2', text: 'What should happen to what you shared?' }), lPosts, lMedia, lReplies,
        h('p', { class: 'fine', text: 'Anything you leave unticked stays, shown as \u201cDeleted User\u201d. Your votes, reports and profile picture are always removed.' }));
      cbPosts.onchange = () => { if (cbPosts.checked) cbMedia.checked = true; cbMedia.disabled = cbPosts.checked; };
      const ok = h('button', { class: 'btn danger', type: 'button', text: 'Delete my account', disabled: true });
      const cancel = h('button', { class: 'btn', type: 'button', text: 'Cancel', onclick: close });
      const paint = () => {
        pwRow.hidden = how === 'google'; gnote.hidden = how !== 'google';
        swap.textContent = how === 'google' ? 'Use my password instead' : 'Use Google instead';
        ok.disabled = busy || word.value.trim().toUpperCase() !== 'DELETE' || (how === 'password' && !pw.value);
      };
      swap.onclick = () => { how = how === 'google' ? 'password' : 'google'; paint(); };
      word.oninput = pw.oninput = paint;
      ok.onclick = async () => {
        busy = true; paint(); err.hidden = true; ok.textContent = 'Deleting...';
        try {
          await store.deleteAccount(how, pw.value, { deletePosts: cbPosts.checked, deleteMedia: cbMedia.checked, deleteReplies: cbReplies.checked });
          close(); feed.posts = []; feed.cursor = null; feed.done = false; feed.sortLoaded = null;
          toast('Your account has been deleted.'); go('/');
        } catch (e) {
          busy = false; ok.textContent = 'Delete my account'; paint();
          if (e.code !== 'cancelled') { err.hidden = false; err.textContent = errText(e); }
        }
      };
      box.append(h('h3', { text: 'Delete your account?' }),
        h('p', { class: 'mute', text: 'Your account and profile will be permanently deleted. This cannot be undone.' }),
        h('label', { class: 'fl2', for: 'delword', text: 'Type DELETE to confirm' }), word,
        choice, pwRow, gnote, swap, err, h('div', { class: 'mrow' }, cancel, ok));
      paint();
    });
  }

  function settingsView(sec) {
    const view = h('main', { class: 'wrap' });
    const draw = () => {
      document.title = 'Eve Sandbox - Settings';
      const item = SETTINGS.find((x) => x.id === sec);
      if (!ready) { view.replaceChildren(h('div', { class: 'card empty' }, h('p', { class: 'mute', text: 'One moment...' }))); return; }
      if (!item) {
        view.replaceChildren(...[
          h('div', { class: 'hd' }, h('h1', { text: 'Settings' }), h('p', { class: 'mute', text: 'Manage your account and how the community looks for you.' })),
          me ? null : h('div', { class: 'card sbox' }, h('p', { class: 'mute', text: 'Sign in to manage your account. Display settings work without signing in.' }), h('div', { class: 'sact' }, h('button', { class: 'btn pri sm', type: 'button', text: 'Sign in', onclick: signInBox }))),
          h('div', { class: 'card slist' }, SETTINGS.map((x) => h('a', { class: 'srow', href: '/#/settings/' + x.id },
            h('span', { class: 'sic' }, icon(x.icon, 20)), h('span', { class: 'stx' }, h('b', { text: x.title }), h('span', { class: 'mute', text: x.sub })), icon('fwd', 18))))].filter(Boolean));
        return;
      }
      const back = h('a', { class: 'sback', href: '/#/settings' }, icon('back', 18), h('span', { text: 'Settings' }));
      if (item.need && !me) {
        view.replaceChildren(back, h('div', { class: 'card empty' }, h('h2', { text: 'Sign in to continue' }), h('p', { class: 'mute', text: 'Please sign in to see these settings.' }), h('button', { class: 'btn pri', type: 'button', text: 'Sign in', onclick: signInBox })));
        return;
      }
      view.replaceChildren(back, h('div', { class: 'hd' }, h('h1', { text: item.title }), h('p', { class: 'mute', text: item.sub })), ...BUILDERS[item.id]());
    };
    hooks.redraw = draw; draw();
    return view;
  }

  // ---------- router ----------
  function route() {
    const pm = location.pathname.match(/^\/id\/([^/]+)\/?$/);
    if (pm) { let u = pm[1]; try { u = decodeURIComponent(u); } catch (e) { /* keep as typed */ } const t = new URLSearchParams(location.search).get('tab'); return { name: 'profile', user: u.toLowerCase(), tab: t === 'replies' || t === 'liked' ? t : 'posts' }; }
    const pp = location.pathname.match(/^\/p\/([^/]+)\/?$/);
    if (pp) { let id = pp[1]; try { id = decodeURIComponent(id); } catch (e) { /* keep as typed */ } return { name: 'post', id: id.toLowerCase() }; }
    const hsh = location.hash || '#/';
    const sm = hsh.match(/^#\/settings(?:\/([a-z]+))?\/?$/);
    if (sm) return { name: 'settings', sec: sm[1] || '' };
    const m = hsh.match(/^#\/post\/([^/?]+)/);
    if (m) { let id = m[1]; try { id = decodeURIComponent(id); } catch (e) { /* keep as typed */ } return { name: 'post', id: id.toLowerCase() }; }
    return { name: 'feed', sort: hsh.indexOf('#/top') === 0 ? 'top' : 'new' };
  }
  function render() {
    const r = route();
    if (r.name === 'post' && location.hash.indexOf('#/post/') === 0) history.replaceState(null, '', '/p/' + encodeURIComponent(r.id));   // old-style link: show the shareable address
    renderHeader();
    hooks.redraw = null; hooks.pill = null; hooks.replies = null; current = null;
    document.title = 'Eve Sandbox - Community';
    if (r.name === 'feed') {
      if (feed.sort !== r.sort) { feed.sort = r.sort; feed.posts = []; feed.cursor = null; feed.done = false; feed.sortLoaded = null; }
      root.replaceChildren(feedView());
    } else if (r.name === 'settings') root.replaceChildren(settingsView(r.sec));
    else if (r.name === 'profile') root.replaceChildren(profileView(r.user, r.tab));
    else root.replaceChildren(postView(r.id));
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', render);
  window.addEventListener('popstate', render);
  // Links to pages of the community open without reloading the whole page.
  document.addEventListener('click', (ev) => {
    if (ev.defaultPrevented || ev.button || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    const a = ev.target.closest && ev.target.closest('a[href]');
    if (!a || a.target || a.hasAttribute('download')) return;
    let u; try { u = new URL(a.href, location.href); } catch (e) { return; }
    if (u.origin !== location.origin || !(u.pathname === '/' || u.pathname.indexOf('/id/') === 0 || u.pathname.indexOf('/p/') === 0)) return;
    ev.preventDefault(); go(u.pathname + u.search + u.hash);
  });

  // Pictures are shown inside the page only: no right-click menu ("Open image in new tab", "Save image") and no dragging them out.
  document.addEventListener('contextmenu', (ev) => { const t = ev.target; if (t && t.closest && t.closest('img, .gi, .gal, .pimgs, .viewer, .avrow, .av')) ev.preventDefault(); });
  document.addEventListener('dragstart', (ev) => { if (ev.target && ev.target.tagName === 'IMG') ev.preventDefault(); });

  // ---------- logo and loading screen ----------
  // The logo is tried from this site first, then from the main site, and retried, so a slow or failed request no longer leaves the corner empty.
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const tryImg = (u) => new Promise((res) => { const im = new Image(); im.onload = () => res(im.naturalWidth > 0); im.onerror = () => res(false); im.src = u; });
  async function loadLogo() {
    const list = ['/evesandbox.png', SITE + '/evesandbox.png'];
    for (let round = 0; round < 4; round++) {
      // Both addresses are tried at the same time; whichever answers first is used.
      const urls = list.map((base) => (round ? base + '?r=' + round : base));
      const got = await new Promise((res) => {
        let left = urls.length;
        urls.forEach((u) => tryImg(u).then((ok) => { if (ok) res(u); else if (--left === 0) res(null); }));
      });
      if (got) {
        document.documentElement.style.setProperty('--logo', 'url("' + got + '")');
        document.documentElement.classList.add('logo-ok');
        return true;
      }
      await wait(500 * (round + 1));
    }
    return false;
  }
  const logoP = loadLogo();
  const fontsP = (document.fonts && document.fonts.ready) ? document.fonts.ready.catch(() => {}) : Promise.resolve();
  Promise.all([wait(750), Promise.race([logoP.then((ok) => (ok ? wait(450) : 0)), wait(4500)]), Promise.race([fontsP, wait(2600)])]).then(() => {
    const sp = document.getElementById('splash');
    if (!sp) return;
    sp.classList.add('out');
    setTimeout(() => sp.remove(), 700);
  });

  // ---------- go ----------
  $('#ftr').replaceChildren(footer());
  if (!cfg || !cfg.configured) {
    renderHeader();
    root.replaceChildren(h('main', { class: 'wrap' }, h('div', { class: 'card empty' }, h('h2', { text: 'The community is not open yet' }), h('p', { class: 'mute', text: 'It is being set up. Please come back soon.' }), h('a', { class: 'btn pri', href: SITE + '/', text: 'Back to Eve Sandbox' }))));
    return;
  }
  render();
  store.onAuth(onAuth);
}
