// Eve Sandbox Community - the server part (one Cloudflare Worker).
// Text lives in the D1 database (binding DB). Pictures live in the R2 bucket (binding IMAGES).
// The Worker only runs for /api/*, /img/* and /p/*; everything else is the static website in ../public.

const MAX_IMG = 5 * 1024 * 1024; // 5 MB per picture
const MAX_IMGS = 4;              // pictures per post
const MAX_AVATAR = 3 * 1024 * 1024; // 3 MB profile picture
const L_BIO = 300;
const USER_RE = /^[a-z0-9_]{3,20}$/;
const RESERVED_USER = new Set(['admin','administrator','moderator','mod','staff','support','eve','evesandbox','system','root','api','id','img','p','null','undefined','help','community','official','team','security','contact','me','anonymous','deleted','everyone','owner']);
const NAME_WAIT = 30 * 24 * 3600 * 1000; // a username can change once every 30 days
const L = { title: 120, body: 5000, reply: 2000, nameMin: 2, nameMax: 30, reason: 300 };
const GAP = { post: 30000, reply: 10000 };            // minimum wait between two posts / two replies of one person
const DAY = { posts: 15, replies: 200, reports: 20, imgBytes: 30 * 1024 * 1024 };
const SESSION_MS = 30 * 24 * 3600 * 1000;
const ID_RE = /^[a-z0-9]{8}$/;
const FIREBASE_JWKS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const RESERVED = /^(admin|administrator|moderator|mod|staff|support|eve sandbox|evesandbox|eve)$/i;

class HttpErr extends Error { constructor(status, code) { super(code); this.status = status; this.code = code; } }
const fail = (s, c) => { throw new HttpErr(s, c); };
const BASE_H = { 'x-content-type-options': 'nosniff', 'cache-control': 'no-store' };
const json = (o, s = 200, h) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', ...BASE_H, ...h } });

const ALPHA = 'abcdefghijkmnpqrstuvwxyz23456789'; // 32 letters/digits (no 0 1 l o), so one byte maps evenly
function newId(n = 8) {
  const b = crypto.getRandomValues(new Uint8Array(n));
  let s = '';
  for (let i = 0; i < n; i++) s += ALPHA[b[i] & 31];
  return s;
}

// ---------- small text helpers ----------
const enc = new TextEncoder();
function b64uToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  const bin = atob(s), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64u(buf) {
  const b = new Uint8Array(buf); let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const cleanText = (s) => String(s == null ? '' : s).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f‪-‮⁦-⁩]/g, '');
const cleanName = (s) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim().slice(0, L.nameMax);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function readJson(req) {
  const t = req.headers.get('content-type') || '';
  if (!/^application\/json/i.test(t)) fail(415, 'bad-request');
  const len = Number(req.headers.get('content-length') || 0);
  if (len > 20000) fail(413, 'bad-request');
  try { const o = await req.json(); if (o && typeof o === 'object') return o; } catch (e) { /* fall through */ }
  return fail(400, 'bad-request');
}

// ---------- sessions (a signed cookie) ----------
async function hmacKey(env) {
  if (!env.SESSION_SECRET || String(env.SESSION_SECRET).length < 32) fail(503, 'not-configured');
  return crypto.subtle.importKey('raw', enc.encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function makeSession(env, uid, prov) {
  const p = bytesToB64u(enc.encode(JSON.stringify({ u: uid, e: Date.now() + SESSION_MS, p: prov === 'password' ? 'password' : prov === 'google.com' ? 'google' : '' })));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env), enc.encode(p));
  return p + '.' + bytesToB64u(sig);
}
async function readSession(env, req, full) {
  const m = (req.headers.get('cookie') || '').match(/(?:^|;\s*)(?:__Host-)?eve_s=([A-Za-z0-9_\-.]+)/);
  if (!m) return null;
  const [p, s] = m[1].split('.');
  if (!p || !s) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(env), b64uToBytes(s), enc.encode(p));
    if (!ok) return null;
    const o = JSON.parse(new TextDecoder().decode(b64uToBytes(p)));
    return o && typeof o.u === 'string' && o.e > Date.now() ? (full ? o : o.u) : null;
  } catch (e) { if (e instanceof HttpErr) throw e; return null; }
}
const cookieHeader = (url, value, maxAge) =>
  (url.protocol === 'https:' ? '__Host-eve_s' : 'eve_s') + '=' + value + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + maxAge + (url.protocol === 'https:' ? '; Secure' : '');

async function currentUser(env, req) {
  const uid = await readSession(env, req);
  if (!uid) return null;
  return (await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(uid).first()) || null;
}
const userOut = (u, prov) => ({ email: u.email || '', provider: prov || '', showLikes: !!u.show_likes, uid: u.id, name: u.name || '', username: u.username || '', avatar: u.avatar || 0, admin: !!u.is_admin, suggest: cleanName(u.gname || ''), banned: !!u.banned });
async function needUser(env, req) { const u = await currentUser(env, req); return u || fail(401, 'sign-in'); }
async function needWriter(env, req) {
  const u = await needUser(env, req);
  if (u.banned) fail(403, 'banned');
  if (!u.name || !u.username) fail(403, 'need-name');
  return u;
}
// A page on another website must not be able to act for a signed-in visitor.
function sameOrigin(req, url) {
  const o = req.headers.get('origin');
  if (!o) fail(403, 'bad-origin');
  let h; try { h = new URL(o).host; } catch (e) { fail(403, 'bad-origin'); }
  if (h !== url.host) fail(403, 'bad-origin');
}

// ---------- sign-in (checks the ID token that Firebase gave the browser after "Continue with Google") ----------
let jwksCache = { keys: null, at: 0, url: '' };
async function signingKeys(env, force) {
  const url = env.FIREBASE_JWKS_URL || FIREBASE_JWKS;
  if (!force && jwksCache.keys && jwksCache.url === url && Date.now() - jwksCache.at < 3600e3) return jwksCache.keys;
  if (force && Date.now() - jwksCache.at < 60e3 && jwksCache.url === url && jwksCache.keys) return jwksCache.keys;
  const r = await fetch(url, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!r.ok) fail(502, 'unavailable');
  const k = (await r.json()).keys || [];
  jwksCache = { keys: k, at: Date.now(), url };
  return k;
}
async function verifyIdToken(env, token) {
  const project = env.FIREBASE_PROJECT_ID;
  if (!project) fail(503, 'not-configured');
  if (typeof token !== 'string' || token.length > 4096) fail(400, 'bad-token');
  const parts = token.split('.');
  if (parts.length !== 3) fail(400, 'bad-token');
  let head, pay;
  try { head = JSON.parse(new TextDecoder().decode(b64uToBytes(parts[0]))); pay = JSON.parse(new TextDecoder().decode(b64uToBytes(parts[1]))); } catch (e) { fail(400, 'bad-token'); }
  if (!head || head.alg !== 'RS256' || !head.kid) fail(400, 'bad-token');
  let jwk = (await signingKeys(env, false)).find((k) => k.kid === head.kid);
  if (!jwk) jwk = (await signingKeys(env, true)).find((k) => k.kid === head.kid);
  if (!jwk) fail(401, 'bad-token');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64uToBytes(parts[2]), enc.encode(parts[0] + '.' + parts[1]));
  if (!ok) fail(401, 'bad-token');
  const now = Date.now() / 1000;
  if (!pay || pay.iss !== 'https://securetoken.google.com/' + project || pay.aud !== project) fail(401, 'bad-token');
  if (!(pay.exp > now - 30) || !(pay.iat <= now + 300) || (pay.auth_time && pay.auth_time > now + 300)) fail(401, 'bad-token');
  if (typeof pay.sub !== 'string' || !pay.sub || pay.sub.length > 128 || typeof pay.email !== 'string' || !pay.email) fail(401, 'bad-token');
  // Only "Continue with Google" and email + password are accepted, even if another way to sign in is switched on in Firebase by mistake.
  const prov = pay.firebase && pay.firebase.sign_in_provider;
  if (prov !== 'google.com' && prov !== 'password') fail(401, 'bad-token');
  // An email + password account can only post after the person clicked the link in the verification email.
  if (pay.email_verified !== true) fail(prov === 'password' ? 403 : 401, prov === 'password' ? 'email-not-verified' : 'bad-token');
  return pay;
}

// ---------- row -> JSON ----------
const postOut = (r) => ({ id: r.id, title: r.title, body: r.body, score: r.score, replyCount: r.reply_count, createdAt: r.created, authorId: r.author_id, authorName: r.aname || 'Deleted User', authorUser: r.auser || '', authorAvatar: r.aav || 0, images: r.img_count });
const replyOut = (r) => ({ id: r.id, body: r.body, authorId: r.author_id, authorName: r.aname || 'Deleted User', authorUser: r.auser || '', authorAvatar: r.aav || 0, createdAt: r.created, postId: r.post_id, postTitle: r.ptitle });
const POST_SQL = 'SELECT p.*, u.name AS aname, u.username AS auser, u.avatar AS aav FROM posts p LEFT JOIN users u ON u.id = p.author_id';

function pageSize(url, def, max) { const n = parseInt(url.searchParams.get('size') || '', 10); return n >= 1 && n <= max ? n : def; }

// ---------- health check (/api/ping): shows whether the site is set up completely. Only "ok / missing / problem", never a value ----------
const BUILD = '2026-11-10b';
async function ping(env, url) {
  const checks = {};
  const probe = async (name, f) => { try { checks[name] = (await f()) ? 'ok' : 'missing'; } catch (e) { console.error('ping ' + name, e && e.message ? e.message : e); checks[name] = 'problem'; } };
  checks.secret = env.SESSION_SECRET && String(env.SESSION_SECRET).length >= 32 ? 'ok' : 'missing';
  checks.firebase = env.FIREBASE_PROJECT_ID && env.FIREBASE_API_KEY && env.FIREBASE_APP_ID ? 'ok' : 'missing';
  await probe('users table', async () => { await env.DB.prepare('SELECT id, google_sub, email, name, username, uname_at, bio, links, avatar, show_likes, banned, is_admin, created FROM users LIMIT 1').first(); return true; });
  await probe('posts table', async () => { await env.DB.prepare('SELECT id, author_id, title, body, score, reply_count, img_count, img_bytes, created FROM posts LIMIT 1').first(); return true; });
  await probe('replies table', async () => { await env.DB.prepare('SELECT id, post_id, author_id, body, created FROM replies LIMIT 1').first(); return true; });
  await probe('votes table', async () => { await env.DB.prepare('SELECT post_id, user_id, value, at FROM votes LIMIT 1').first(); return true; });
  await probe('pictures', async () => !!env.IMAGES && typeof env.IMAGES.get === 'function');
  await probe('pages', async () => { const r = await env.ASSETS.fetch(new Request(url.origin + '/')); const t = await r.text(); return r.ok && t.indexOf('id="app"') > -1; });
  // The preview card must come out with exactly one title, picture and card type, whatever index.html looks like.
  await probe('link previews', async () => {
    const r = await env.ASSETS.fetch(new Request(url.origin + '/'));
    const t = withCard(await r.text(), { title: 'T', desc: 'D', url: url.origin + '/', image: url.origin + '/x.png' });
    const n = (re) => (t.match(re) || []).length;
    return n(/<title>/g) === 1 && n(/property="og:title"/g) === 1 && n(/property="og:image"/g) === 1 && n(/name="twitter:card"/g) === 1;
  });
  checks.logo = (await logoUrl(env, url.origin)).indexOf(url.origin) === 0 ? 'this site' : 'main site';
  const ok = Object.keys(checks).every((k) => checks[k] === 'ok' || k === 'logo');
  // /api/ping?post=<post id> shows what a chat app reads for that post (nothing here is private: it is the post's public title, text and picture).
  const want = url.searchParams.get('post');
  let preview;
  if (want && /^[a-z0-9]{8}$/.test(want)) {
    const { row: p, ok: dbok } = await cardRow(env, POST_CARD_SQL, want);
    if (!dbok) preview = { found: 'database problem' };
    else if (!p) preview = { found: false };
    else {
      const c = await postCard(env, url.origin, p);
      preview = { found: true, address: c.url, title: c.title, description: c.desc, picture: c.image, card: c.big ? 'large picture card' : 'small card with the logo' };
      if (p.img_count > 0) {
        try { const o = await env.IMAGES.head(p.id + '/0'); preview.pictureStored = !!o; if (o) { preview.pictureKB = Math.round(o.size / 1024); preview.pictureType = (o.httpMetadata && o.httpMetadata.contentType) || 'none'; } }
        catch (e) { preview.pictureStored = 'problem'; }
      }
    }
  }
  return json(preview ? { ok, build: BUILD, checks, preview } : { ok, build: BUILD, checks });
}

// A read can fail for a moment on the database side (a restart, a dropped connection). Reads change nothing, so one more try is safe.
async function retryRead(req, f) {
  try { return await f(); }
  catch (e) {
    if (e instanceof HttpErr || (req.method !== 'GET' && req.method !== 'HEAD')) throw e;
    console.error('retrying a read after', e && e.message ? e.message : e);
    await new Promise((r) => setTimeout(r, 120));
    return await f();
  }
}

// ---------- API ----------
async function api(req, env, url) {
  const path = url.pathname, method = req.method;
  let m;
  if (method !== 'GET' && method !== 'HEAD') sameOrigin(req, url);
  if (path === '/api/ping' && method === 'GET') return ping(env, url);

  if (path === '/api/config' && method === 'GET') {
    const ok = env.FIREBASE_PROJECT_ID && env.FIREBASE_API_KEY && env.FIREBASE_APP_ID;
    return json({ firebase: ok ? { apiKey: env.FIREBASE_API_KEY, authDomain: env.FIREBASE_PROJECT_ID + '.firebaseapp.com', projectId: env.FIREBASE_PROJECT_ID, appId: env.FIREBASE_APP_ID } : null });
  }
  if (path === '/api/me' && method === 'GET') {
    const s = await readSession(env, req, true);
    const u = s ? await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(s.u).first() : null;
    return json({ user: u ? userOut(u, s.p) : null });
  }

  if (path === '/api/auth/login' && method === 'POST') {
    const body = await readJson(req);
    const p = await verifyIdToken(env, body.idToken);
    let u = await env.DB.prepare('SELECT * FROM users WHERE google_sub = ?').bind(p.sub).first();
    const gname = cleanName(p.name || '') || null;
    if (!u) {
      // Someone who signed in before with another Google sign-in method keeps their account (same verified email).
      const old = await env.DB.prepare('SELECT * FROM users WHERE email = ? ORDER BY created LIMIT 1').bind(String(p.email).slice(0, 200)).first();
      if (old) { await env.DB.prepare('UPDATE users SET google_sub = ? WHERE id = ?').bind(p.sub, old.id).run(); u = old; u.google_sub = p.sub; }
    }
    if (!u) {
      for (let i = 0; i < 3 && !u; i++) {
        const id = newId(12);
        try { await env.DB.prepare('INSERT INTO users (id, google_sub, email, gname, created) VALUES (?, ?, ?, ?, ?)').bind(id, p.sub, String(p.email).slice(0, 200), gname, Date.now()).run(); }
        catch (e) { u = await env.DB.prepare('SELECT * FROM users WHERE google_sub = ?').bind(p.sub).first(); if (u) break; continue; }
        u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
      }
      if (!u) fail(500, 'server');
    } else if (u.gname !== gname || u.email !== p.email) {
      await env.DB.prepare('UPDATE users SET gname = ?, email = ? WHERE id = ?').bind(gname, String(p.email).slice(0, 200), u.id).run();
      u.gname = gname;
    }
    return json({ user: userOut(u, p.firebase.sign_in_provider === 'password' ? 'password' : 'google') }, 200, { 'set-cookie': cookieHeader(url, await makeSession(env, u.id, p.firebase.sign_in_provider), SESSION_MS / 1000) });
  }
  if (path === '/api/auth/logout' && method === 'POST') return json({ ok: true }, 200, { 'set-cookie': cookieHeader(url, '', 0) });

  if (path === '/api/me/name' && method === 'POST') {
    const u = await needUser(env, req);
    if (u.banned) fail(403, 'banned');
    const b = await readJson(req);
    await setIdentity(env, u, b.name, b.username);
    return json({ ok: true });
  }
  if (path === '/api/me/profile' && method === 'POST') {
    const u = await needUser(env, req);
    if (u.banned) fail(403, 'banned');
    if (!u.name || !u.username) fail(403, 'need-name');
    const b = await readJson(req);
    const bio = cleanText(b.bio).trim();
    if (bio.length > L_BIO) fail(400, 'bad-bio');
    const links = parseLinks(b.links);
    await setIdentity(env, u, b.name, b.username);
    await env.DB.prepare('UPDATE users SET bio = ?, links = ?, show_likes = ? WHERE id = ?').bind(bio, JSON.stringify(links), b.showLikes === true ? 1 : 0, u.id).run();
    const fresh = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(u.id).first();
    return json({ user: userOut(fresh) });
  }
  if (path === '/api/me/likes' && method === 'POST') {
    const u = await needUser(env, req);
    if (u.banned) fail(403, 'banned');
    const b = await readJson(req);
    await env.DB.prepare('UPDATE users SET show_likes = ? WHERE id = ?').bind(b.showLikes === true ? 1 : 0, u.id).run();
    return json({ showLikes: b.showLikes === true });
  }
  if (path === '/api/me' && method === 'DELETE') return deleteAccount(req, env, url);
  if (path === '/api/me/avatar' && method === 'POST') return setAvatar(req, env);
  if (path === '/api/me/avatar' && method === 'DELETE') {
    const u = await needUser(env, req);
    if (u.banned) fail(403, 'banned');
    await env.DB.prepare('UPDATE users SET avatar = 0 WHERE id = ?').bind(u.id).run();
    try { await env.IMAGES.delete('a/' + u.id); } catch (e) { console.error('r2 delete', e); }
    return json({ ok: true });
  }
  if ((m = path.match(/^\/api\/users\/([a-z0-9_]{3,20})(?:\/(posts|replies|likes))?$/)) && method === 'GET') return profileApi(req, env, url, m[1], m[2]);

  if (path === '/api/posts' && method === 'GET') return listPosts(env, url);
  if (path === '/api/posts' && method === 'POST') return createPost(req, env);
  if (path === '/api/votes' && method === 'GET') return myVotes(req, env, url);
  if (path === '/api/scores' && method === 'GET') return scores(req, env, url);
  if (path === '/api/report' && method === 'POST') return report(req, env);

  if ((m = path.match(/^\/api\/posts\/([a-z0-9]{8})$/))) {
    if (method === 'GET') {
      const r = await env.DB.prepare(POST_SQL + ' WHERE p.id = ?').bind(m[1]).first();
      return r ? json({ post: postOut(r) }) : json({ post: null }, 404);
    }
    if (method === 'DELETE') return deletePost(req, env, m[1]);
  }
  if ((m = path.match(/^\/api\/posts\/([a-z0-9]{8})\/vote$/)) && method === 'PUT') return vote(req, env, m[1]);
  if ((m = path.match(/^\/api\/posts\/([a-z0-9]{8})\/replies$/))) {
    if (method === 'GET') return listReplies(env, url, m[1]);
    if (method === 'POST') return createReply(req, env, m[1]);
  }
  if ((m = path.match(/^\/api\/replies\/([a-z0-9]{8})$/)) && method === 'DELETE') return deleteReply(req, env, m[1]);
  return json({ error: 'not-found' }, 404);
}

async function listPosts(env, url) {
  const sort = url.searchParams.get('sort') === 'top' ? 'top' : 'new';
  const size = pageSize(url, 20, 30), cur = url.searchParams.get('cursor') || '';
  let rows;
  if (sort === 'top') {
    const off = cur ? parseInt(cur, 10) : 0;
    if (!(off >= 0 && off <= 5000) || (cur && String(off) !== cur)) fail(400, 'bad-request');
    rows = (await env.DB.prepare(POST_SQL + ' ORDER BY p.score DESC, p.created DESC, p.id DESC LIMIT ? OFFSET ?').bind(size + 1, off).all()).results;
    const done = rows.length <= size;
    return json({ posts: rows.slice(0, size).map(postOut), cursor: done ? null : String(off + size), done });
  }
  if (cur) {
    const c = cur.match(/^(\d{1,15})_([a-z0-9]{8})$/);
    if (!c) fail(400, 'bad-request');
    rows = (await env.DB.prepare(POST_SQL + ' WHERE (p.created < ?1 OR (p.created = ?1 AND p.id < ?2)) ORDER BY p.created DESC, p.id DESC LIMIT ?3').bind(Number(c[1]), c[2], size + 1).all()).results;
  } else rows = (await env.DB.prepare(POST_SQL + ' ORDER BY p.created DESC, p.id DESC LIMIT ?').bind(size + 1).all()).results;
  const done = rows.length <= size, page = rows.slice(0, size), last = page[page.length - 1];
  return json({ posts: page.map(postOut), cursor: done || !last ? null : last.created + '_' + last.id, done });
}

// Live sync: the page asks every few seconds for the current score and reply count of the posts on screen,
// the signed-in person's own votes, which posts were deleted and how many newer posts exist.
async function scores(req, env, url) {
  const ids = (url.searchParams.get('ids') || '').split(',').filter((x) => ID_RE.test(x)).slice(0, 40);
  const sinceRaw = url.searchParams.get('since');
  const since = sinceRaw !== null && /^\d{1,15}$/.test(sinceRaw) ? parseInt(sinceRaw, 10) : null;
  const u = await currentUser(env, req);
  const ph = ids.map(() => '?').join(',');
  const stmts = [];
  if (ids.length) stmts.push(env.DB.prepare('SELECT id, score, reply_count FROM posts WHERE id IN (' + ph + ')').bind(...ids));
  if (ids.length && u) stmts.push(env.DB.prepare('SELECT post_id, value FROM votes WHERE user_id = ? AND post_id IN (' + ph + ')').bind(u.id, ...ids));
  if (since !== null) stmts.push(env.DB.prepare('SELECT COUNT(*) AS n FROM (SELECT 1 FROM posts WHERE created > ? LIMIT 99)').bind(since));
  const res = stmts.length ? await env.DB.batch(stmts) : [];
  let k = 0;
  const out = { scores: {}, gone: [], mine: u ? {} : null, newer: 0 };
  if (ids.length) { const rows = res[k++].results; rows.forEach((r) => { out.scores[r.id] = { s: r.score, r: r.reply_count }; }); out.gone = ids.filter((x) => !out.scores[x]); }
  if (ids.length && u) res[k++].results.forEach((r) => { out.mine[r.post_id] = r.value; });
  if (since !== null) out.newer = res[k++].results[0].n || 0;
  return json(out);
}

async function myVotes(req, env, url) {
  const u = await currentUser(env, req);
  const ids = (url.searchParams.get('ids') || '').split(',').filter((x) => ID_RE.test(x)).slice(0, 30);
  if (!u || !ids.length) return json({ votes: {} });
  const rows = (await env.DB.prepare('SELECT post_id, value FROM votes WHERE user_id = ? AND post_id IN (' + ids.map(() => '?').join(',') + ')').bind(u.id, ...ids).all()).results;
  const votes = {}; rows.forEach((r) => { votes[r.post_id] = r.value; });
  return json({ votes });
}

// A picture is accepted only if its first bytes say it is really a JPEG, PNG, GIF or WebP.
function sniff(b) {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 12 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
  if (b.length > 12 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61) return 'image/gif';
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

async function createPost(req, env) {
  const u = await needWriter(env, req);
  const cl = Number(req.headers.get('content-length') || 0);
  if (cl > MAX_IMGS * MAX_IMG + 100000) fail(413, 'image-too-big');
  if (!/^(multipart\/form-data|application\/x-www-form-urlencoded)/i.test(req.headers.get('content-type') || '')) fail(415, 'bad-request');
  let form; try { form = await req.formData(); } catch (e) { fail(400, 'bad-request'); }
  const title = cleanText(form.get('title')).replace(/\n+/g, ' ').trim();
  const body = cleanText(form.get('body')).trim();
  if (!title || title.length > L.title || body.length > L.body) fail(400, 'bad-request');
  const files = form.getAll('images').filter((f) => f && typeof f === 'object' && typeof f.arrayBuffer === 'function' && f.size > 0);
  if (files.length > MAX_IMGS) fail(400, 'too-many-images');
  const imgs = [];
  let bytes = 0;
  for (const f of files) {
    if (f.size > MAX_IMG) fail(413, 'image-too-big');
    const buf = new Uint8Array(await f.arrayBuffer());
    const type = sniff(buf);
    if (!type) fail(400, 'bad-image');
    imgs.push({ buf, type }); bytes += buf.length;
  }
  const now = Date.now();
  const last = await env.DB.prepare('SELECT created FROM posts WHERE author_id = ? ORDER BY created DESC LIMIT 1').bind(u.id).first();
  if (last && now - last.created < GAP.post) fail(429, 'slow-down');
  const day = await env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(img_bytes), 0) AS b FROM posts WHERE author_id = ? AND created > ?').bind(u.id, now - 86400e3).first();
  if (day.n >= DAY.posts) fail(429, 'daily-limit');
  if (day.b + bytes > DAY.imgBytes) fail(429, 'daily-limit');

  let id = '';
  for (let i = 0; i < 5; i++) { const c = newId(8); if (!(await env.DB.prepare('SELECT 1 FROM posts WHERE id = ?').bind(c).first())) { id = c; break; } }
  if (!id) fail(500, 'server');
  try {
    for (let i = 0; i < imgs.length; i++) {
      await env.IMAGES.put(id + '/' + i, imgs[i].buf, { httpMetadata: { contentType: imgs[i].type, cacheControl: 'public, max-age=31536000, immutable' } });
    }
    await env.DB.prepare('INSERT INTO posts (id, author_id, title, body, img_count, img_bytes, created) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, u.id, title, body, imgs.length, bytes, now).run();
  } catch (e) {
    if (!(await env.DB.prepare('SELECT 1 FROM posts WHERE id = ?').bind(id).first())) await dropImages(env, id, imgs.length);
    throw e;
  }
  return json({ id }, 201);
}

async function dropImages(env, id, n) {
  const keys = []; for (let i = 0; i < Math.max(n, 0); i++) keys.push(id + '/' + i);
  if (keys.length) { try { await env.IMAGES.delete(keys); } catch (e) { console.error('r2 delete', e); } }
}

// Deleting an account removes everything the person made. The browser must have just signed in again (a fresh Firebase token for the same account).
async function deleteAccount(req, env, url) {
  const u = await needUser(env, req);
  if (u.banned) fail(403, 'banned');   // an account that was restricted cannot be erased to start over
  const b = await readJson(req);
  if (b.confirm !== true) fail(400, 'bad-request');
  const p = await verifyIdToken(env, b.idToken);
  if (p.sub !== u.google_sub) fail(403, 'wrong-account');
  if (!(Date.now() / 1000 - (p.auth_time || 0) <= 300)) fail(401, 'need-recent-login');
  // What happens to what the person made is their choice. Without any ticks, only the account goes and posts / replies stay as "Deleted User".
  const wantPosts = b.deletePosts === true, wantReplies = b.deleteReplies === true, wantMedia = wantPosts || b.deleteMedia === true;
  const id = u.id, mine = '(SELECT id FROM posts WHERE author_id = ?1)';
  const keys = ['a/' + u.id];
  if (wantMedia) {
    const posts = (await env.DB.prepare('SELECT id, img_count FROM posts WHERE author_id = ?').bind(id).all()).results || [];
    posts.forEach((r) => { for (let i = 0; i < r.img_count; i++) keys.push(r.id + '/' + i); });
  }
  const st = [
    env.DB.prepare('UPDATE posts SET score = score - COALESCE((SELECT value FROM votes WHERE post_id = posts.id AND user_id = ?1), 0) WHERE id IN (SELECT post_id FROM votes WHERE user_id = ?1)').bind(id),
    env.DB.prepare('DELETE FROM reports WHERE reporter_id = ?1').bind(id),
    env.DB.prepare('DELETE FROM votes WHERE user_id = ?1').bind(id)
  ];
  if (wantReplies || wantPosts) {
    // replies of theirs that go (all of them if they chose replies; the ones under their own posts if the posts go)
    const where = wantReplies ? 'author_id = ?1 OR post_id IN ' + mine : 'post_id IN ' + mine;
    st.push(
      env.DB.prepare('UPDATE posts SET reply_count = (SELECT COUNT(*) FROM replies WHERE post_id = posts.id AND NOT (' + where + ')) WHERE id IN (SELECT post_id FROM replies WHERE ' + where + ')').bind(id),
      env.DB.prepare('DELETE FROM reports WHERE reply_id IN (SELECT id FROM replies WHERE ' + where + ')').bind(id),
      env.DB.prepare('DELETE FROM replies WHERE ' + where).bind(id));
  }
  if (wantPosts) st.push(
    env.DB.prepare('DELETE FROM reports WHERE post_id IN ' + mine).bind(id),
    env.DB.prepare('DELETE FROM votes WHERE post_id IN ' + mine).bind(id),
    env.DB.prepare('DELETE FROM posts WHERE author_id = ?1').bind(id));
  else if (wantMedia) st.push(env.DB.prepare('UPDATE posts SET img_count = 0, img_bytes = 0 WHERE author_id = ?1').bind(id));
  // What stays no longer points to the person at all.
  st.push(env.DB.prepare("UPDATE posts SET author_id = 'deleted' WHERE author_id = ?1").bind(id), env.DB.prepare("UPDATE replies SET author_id = 'deleted' WHERE author_id = ?1").bind(id));
  st.push(env.DB.prepare('DELETE FROM users WHERE id = ?1').bind(id));
  await env.DB.batch(st);
  for (let i = 0; i < keys.length; i += 1000) { try { await env.IMAGES.delete(keys.slice(i, i + 1000)); } catch (e) { console.error('r2 delete', e); } }
  return json({ ok: true }, 200, { 'set-cookie': cookieHeader(url, '', 0) });
}

async function deletePost(req, env, id) {
  const u = await needUser(env, req);
  if (u.banned) fail(403, 'banned');
  const p = await env.DB.prepare('SELECT id, author_id, img_count FROM posts WHERE id = ?').bind(id).first();
  if (!p) fail(404, 'not-found');
  if (p.author_id !== u.id && !u.is_admin) fail(403, 'forbidden');
  await env.DB.batch([
    env.DB.prepare('DELETE FROM votes WHERE post_id = ?').bind(id),
    env.DB.prepare('DELETE FROM replies WHERE post_id = ?').bind(id),
    env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id)
  ]);
  await dropImages(env, id, p.img_count);
  return json({ ok: true });
}

async function vote(req, env, id) {
  const u = await needWriter(env, req);
  const v = (await readJson(req)).value;
  if (v !== 1 && v !== -1 && v !== 0) fail(400, 'bad-request');
  if (!(await env.DB.prepare('SELECT 1 FROM posts WHERE id = ?').bind(id).first())) fail(404, 'not-found');
  const first = v === 0
    ? env.DB.prepare('DELETE FROM votes WHERE post_id = ? AND user_id = ?').bind(id, u.id)
    : env.DB.prepare('INSERT INTO votes (post_id, user_id, value, at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (post_id, user_id) DO UPDATE SET value = excluded.value, at = excluded.at').bind(id, u.id, v, Date.now());
  const res = await env.DB.batch([
    first,
    env.DB.prepare('UPDATE posts SET score = (SELECT COALESCE(SUM(value), 0) FROM votes WHERE post_id = ?1) WHERE id = ?1').bind(id),
    env.DB.prepare('SELECT score FROM posts WHERE id = ?').bind(id)
  ]);
  const row = res[2].results[0];
  return json({ score: row ? row.score : 0 });
}

async function listReplies(env, url, postId) {
  const size = pageSize(url, 30, 50), cur = url.searchParams.get('cursor') || '';
  let rows;
  const sel = 'SELECT r.*, u.name AS aname, u.username AS auser, u.avatar AS aav FROM replies r LEFT JOIN users u ON u.id = r.author_id WHERE r.post_id = ?1';
  if (cur) {
    const c = cur.match(/^(\d{1,15})_([a-z0-9]{8})$/);
    if (!c) fail(400, 'bad-request');
    rows = (await env.DB.prepare(sel + ' AND (r.created > ?2 OR (r.created = ?2 AND r.id > ?3)) ORDER BY r.created, r.id LIMIT ?4').bind(postId, Number(c[1]), c[2], size + 1).all()).results;
  } else rows = (await env.DB.prepare(sel + ' ORDER BY r.created, r.id LIMIT ?2').bind(postId, size + 1).all()).results;
  const done = rows.length <= size, page = rows.slice(0, size), last = page[page.length - 1];
  return json({ replies: page.map(replyOut), cursor: done || !last ? null : last.created + '_' + last.id, done });
}

async function createReply(req, env, postId) {
  const u = await needWriter(env, req);
  const body = cleanText((await readJson(req)).body).trim();
  if (!body || body.length > L.reply) fail(400, 'bad-request');
  if (!(await env.DB.prepare('SELECT 1 FROM posts WHERE id = ?').bind(postId).first())) fail(404, 'not-found');
  const now = Date.now();
  const last = await env.DB.prepare('SELECT created FROM replies WHERE author_id = ? ORDER BY created DESC LIMIT 1').bind(u.id).first();
  if (last && now - last.created < GAP.reply) fail(429, 'slow-down');
  const day = await env.DB.prepare('SELECT COUNT(*) AS n FROM replies WHERE author_id = ? AND created > ?').bind(u.id, now - 86400e3).first();
  if (day.n >= DAY.replies) fail(429, 'daily-limit');
  const id = newId(8);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO replies (id, post_id, author_id, body, created) VALUES (?, ?, ?, ?, ?)').bind(id, postId, u.id, body, now),
    env.DB.prepare('UPDATE posts SET reply_count = (SELECT COUNT(*) FROM replies WHERE post_id = ?1) WHERE id = ?1').bind(postId)
  ]);
  return json({ id, createdAt: now }, 201);
}

async function deleteReply(req, env, id) {
  const u = await needUser(env, req);
  if (u.banned) fail(403, 'banned');
  const r = await env.DB.prepare('SELECT id, post_id, author_id FROM replies WHERE id = ?').bind(id).first();
  if (!r) fail(404, 'not-found');
  if (r.author_id !== u.id && !u.is_admin) fail(403, 'forbidden');
  await env.DB.batch([
    env.DB.prepare('DELETE FROM replies WHERE id = ?').bind(id),
    env.DB.prepare('UPDATE posts SET reply_count = (SELECT COUNT(*) FROM replies WHERE post_id = ?1) WHERE id = ?1').bind(r.post_id)
  ]);
  return json({ ok: true });
}

async function report(req, env) {
  const u = await needWriter(env, req);
  const b = await readJson(req);
  const postId = String(b.postId || ''), replyId = String(b.replyId || '');
  if (!ID_RE.test(postId) || (replyId && !ID_RE.test(replyId))) fail(400, 'bad-request');
  const reason = cleanText(b.reason).trim().slice(0, L.reason);
  const day = await env.DB.prepare('SELECT COUNT(*) AS n FROM reports WHERE reporter_id = ? AND created > ?').bind(u.id, Date.now() - 86400e3).first();
  if (day.n >= DAY.reports) fail(429, 'daily-limit');
  await env.DB.prepare('INSERT OR IGNORE INTO reports (id, post_id, reply_id, reporter_id, reason, created) VALUES (?, ?, ?, ?, ?, ?)').bind(newId(10), postId, replyId, u.id, reason, Date.now()).run();
  return json({ ok: true }, 201);
}

// ---------- profiles ----------
async function setIdentity(env, u, nameIn, userIn) {
  const sets = [], binds = [];
  if (nameIn !== undefined && nameIn !== null) {
    const name = cleanName(nameIn);
    if (name.length < L.nameMin) fail(400, 'bad-name');
    if (RESERVED.test(name) && !u.is_admin) fail(400, 'reserved-name');
    if (name !== u.name) { sets.push('name = ?'); binds.push(name); }
  } else if (!u.name) fail(400, 'bad-name');
  if (userIn !== undefined && userIn !== null && userIn !== '') {
    const un = String(userIn).trim().toLowerCase().replace(/^@/, '');
    if (!USER_RE.test(un)) fail(400, 'bad-username');
    if (RESERVED_USER.has(un) && !u.is_admin) fail(400, 'reserved-username');
    if (un !== u.username) {
      if (u.username && u.uname_at && Date.now() - u.uname_at < NAME_WAIT) fail(429, 'username-wait');
      sets.push('username = ?', 'uname_at = ?'); binds.push(un, u.username ? Date.now() : 0);
    }
  } else if (!u.username) fail(400, 'bad-username');
  if (!sets.length) return;
  try { await env.DB.prepare('UPDATE users SET ' + sets.join(', ') + ' WHERE id = ?').bind(...binds, u.id).run(); }
  catch (e) { if (/UNIQUE|constraint/i.test(String((e && e.message) || e))) fail(409, 'username-taken'); throw e; }
}

// Links are stored as short, checked handles (never as free web addresses, except the website), so a profile
// can not hold a script link or a look-alike address.
function parseLinks(raw) {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = {}, str = (k) => (typeof o[k] === 'string' ? o[k].trim() : '');
  let v, m;
  if ((v = str('instagram'))) {
    m = v.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:\?.*)?$/i); v = m ? m[1] : v.replace(/^@/, '');
    if (!/^[A-Za-z0-9._]{1,30}$/.test(v)) fail(400, 'bad-instagram'); out.instagram = v;
  }
  if ((v = str('discord'))) {
    m = v.match(/^(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/([A-Za-z0-9-]{2,32})\/?$/i);
    if (m) out.discord = 'discord.gg/' + m[1];
    else { v = v.replace(/^@/, '').toLowerCase(); if (!/^[a-z0-9_.]{2,32}$/.test(v)) fail(400, 'bad-discord'); out.discord = v; }
  }
  if ((v = str('x'))) {
    m = v.match(/^(?:https?:\/\/)?(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/?(?:\?.*)?$/i); v = m ? m[1] : v.replace(/^@/, '');
    if (!/^[A-Za-z0-9_]{1,15}$/.test(v)) fail(400, 'bad-x'); out.x = v;
  }
  if ((v = str('youtube'))) {
    m = v.match(/^(?:https?:\/\/)?(?:www\.)?youtube\.com\/@([A-Za-z0-9._-]{3,30})\/?(?:\?.*)?$/i); v = m ? m[1] : v.replace(/^@/, '');
    if (!/^[A-Za-z0-9._-]{3,30}$/.test(v)) fail(400, 'bad-youtube'); out.youtube = v;
  }
  if ((v = str('website'))) {
    if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
    let w; try { w = new URL(v); } catch (e) { fail(400, 'bad-website'); }
    if (w.protocol !== 'https:' || w.username || w.password || !/^[^.]+(\.[^.]+)+$/.test(w.hostname) || w.href.length > 200) fail(400, 'bad-website');
    w.hash = ''; out.website = w.href;
  }
  return out;
}

async function setAvatar(req, env) {
  const u = await needUser(env, req);
  if (u.banned) fail(403, 'banned');
  if (Number(req.headers.get('content-length') || 0) > MAX_AVATAR + 100000) fail(413, 'avatar-too-big');
  if (!/^multipart\/form-data/i.test(req.headers.get('content-type') || '')) fail(415, 'bad-request');
  let form; try { form = await req.formData(); } catch (e) { fail(400, 'bad-request'); }
  const f = form.get('avatar');
  if (!f || typeof f !== 'object' || typeof f.arrayBuffer !== 'function' || !f.size) fail(400, 'bad-request');
  if (f.size > MAX_AVATAR) fail(413, 'avatar-too-big');
  const buf = new Uint8Array(await f.arrayBuffer());
  const type = sniff(buf);
  if (type !== 'image/jpeg' && type !== 'image/png' && type !== 'image/webp') fail(400, 'bad-image');
  if (u.avatar && Date.now() - u.avatar < 5000) fail(429, 'slow-down');
  await env.IMAGES.put('a/' + u.id, buf, { httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' } });
  const v = Date.now();
  await env.DB.prepare('UPDATE users SET avatar = ? WHERE id = ?').bind(v, u.id).run();
  return json({ avatar: v });
}

// One page of a list ordered newest first. base must end with a WHERE clause; kt / kid are the sort columns.
async function keyset(env, url, base, binds, kt, kid) {
  const size = pageSize(url, 20, 30), cur = url.searchParams.get('cursor') || '';
  let q = base, b = binds.slice();
  if (cur) {
    const c = cur.match(/^(\d{1,15})_([a-z0-9]{8})$/);
    if (!c) fail(400, 'bad-request');
    q += ' AND (' + kt + ' < ? OR (' + kt + ' = ? AND ' + kid + ' < ?))'; b.push(Number(c[1]), Number(c[1]), c[2]);
  }
  q += ' ORDER BY ' + kt + ' DESC, ' + kid + ' DESC LIMIT ?'; b.push(size + 1);
  const rows = (await env.DB.prepare(q).bind(...b).all()).results;
  const done = rows.length <= size, page = rows.slice(0, size), last = page[page.length - 1];
  return { page, done, cursor: done || !last ? null : last.kt + '_' + last.kid };
}

async function profileApi(req, env, url, uname, what) {
  const row = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(uname).first();
  if (!row) fail(404, 'not-found');
  const viewer = await currentUser(env, req);
  const isMe = !!viewer && viewer.id === row.id;
  const canSeeLikes = isMe || !!row.show_likes;
  if (!what) {
    const [pc, rc, lc] = await env.DB.batch([
      env.DB.prepare('SELECT COUNT(*) AS n FROM posts WHERE author_id = ?').bind(row.id),
      env.DB.prepare('SELECT COUNT(*) AS n FROM replies WHERE author_id = ?').bind(row.id),
      env.DB.prepare('SELECT COUNT(*) AS n FROM votes WHERE user_id = ? AND value = 1').bind(row.id)
    ]);
    let links = {}; try { links = JSON.parse(row.links || '{}') || {}; } catch (e) { /* none */ }
    return json({ profile: { uid: row.id, username: row.username, name: row.name || 'Member', bio: row.bio || '', links, avatar: row.avatar || 0, createdAt: row.created, showLikes: !!row.show_likes, isMe,
      counts: { posts: pc.results[0].n, replies: rc.results[0].n, likes: canSeeLikes ? lc.results[0].n : null } } });
  }
  if (what === 'posts') {
    const r = await keyset(env, url, POST_SQL.replace('SELECT p.*,', 'SELECT p.*, p.created AS kt, p.id AS kid,') + ' WHERE p.author_id = ?', [row.id], 'p.created', 'p.id');
    return json({ posts: r.page.map(postOut), cursor: r.cursor, done: r.done });
  }
  if (what === 'replies') {
    const r = await keyset(env, url, 'SELECT r.*, u.name AS aname, u.username AS auser, u.avatar AS aav, p.title AS ptitle, r.created AS kt, r.id AS kid FROM replies r JOIN posts p ON p.id = r.post_id LEFT JOIN users u ON u.id = r.author_id WHERE r.author_id = ?', [row.id], 'r.created', 'r.id');
    return json({ replies: r.page.map(replyOut), cursor: r.cursor, done: r.done });
  }
  if (!canSeeLikes) return json({ hidden: true, posts: [], cursor: null, done: true });
  const r = await keyset(env, url, 'SELECT p.*, u.name AS aname, u.username AS auser, u.avatar AS aav, v.at AS kt, p.id AS kid FROM votes v JOIN posts p ON p.id = v.post_id LEFT JOIN users u ON u.id = p.author_id WHERE v.user_id = ? AND v.value = 1', [row.id], 'v.at', 'p.id');
  return json({ posts: r.page.map(postOut), cursor: r.cursor, done: r.done });
}

// The app's own page (index.html), fetched without the browser's "has it changed?" headers so the answer is always a full page.
async function appPage(req, env, url) {
  const hd = new Headers(req.headers);
  ['if-none-match', 'if-modified-since', 'range', 'if-range'].forEach((k) => hd.delete(k));
  return env.ASSETS.fetch(new Request(new URL('/', url), { method: 'GET', headers: hd }));
}
const descOf = (t, fallback) => ((t || '').replace(/\s+/g, ' ').trim() || fallback).slice(0, 200);
// Puts a page's own title, text and picture into the preview card that chat apps and search show.
// It does not depend on the exact wording of index.html: every old title / description / og: / twitter: / canonical tag is
// removed and one fresh set goes in right after <meta charset>, so the card is right even if index.html is an older or edited copy.
function withCard(html, c) {
  const title = esc(c.title), desc = esc(c.desc), url = esc(c.url), img = esc(c.image), alt = esc(c.imageAlt || c.title);
  html = html
    .replace(/<title[^>]*>[\s\S]*?<\/title>\s*/gi, '')
    .replace(/<meta\s+(?:name|property)\s*=\s*["'](?:description|robots|og:[^"']*|twitter:[^"']*)["'][^>]*>\s*/gi, '')
    .replace(/<link\s+rel\s*=\s*["']canonical["'][^>]*>\s*/gi, '');
  const tags =
    '<title>' + title + '</title>' +
    '<meta name="description" content="' + desc + '">' +
    (c.index ? '<meta name="robots" content="index, follow, max-image-preview:large">' : '<meta name="robots" content="noindex">') +
    '<link rel="canonical" href="' + url + '">' +
    '<meta property="og:site_name" content="Eve Sandbox">' +
    '<meta property="og:type" content="' + (c.type || 'website') + '">' +
    '<meta property="og:title" content="' + title + '">' +
    '<meta property="og:description" content="' + desc + '">' +
    '<meta property="og:url" content="' + url + '">' +
    '<meta property="og:image" content="' + img + '">' +
    '<meta property="og:image:alt" content="' + alt + '">' +
    '<meta name="twitter:card" content="' + (c.big ? 'summary_large_image' : 'summary') + '">' +
    '<meta name="twitter:title" content="' + title + '">' +
    '<meta name="twitter:description" content="' + desc + '">' +
    '<meta name="twitter:image" content="' + img + '">' +
    '<meta name="twitter:image:alt" content="' + alt + '">' +
    (c.ld ? '<script type="application/ld+json">' + JSON.stringify(c.ld).replace(/</g, '\\u003c') + '</script>' : '');
  if (/<meta\s+charset[^>]*>/i.test(html)) return html.replace(/<meta\s+charset[^>]*>/i, (m) => m + tags);
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + '<meta charset="utf-8">' + tags);
  return '<meta charset="utf-8">' + tags + html;
}

// The picture chat apps show when a post or profile has none of its own: this site's copy of the logo if it is there, otherwise the main site's.
const logoMemo = {};
async function logoUrl(env, origin) {
  const m = logoMemo[origin];
  if (m && Date.now() - m.at < 600e3) return m.url;
  let u = 'https://evesandbox.com/evesandbox.png';
  try {
    const r = await env.ASSETS.fetch(new Request(origin + '/evesandbox.png', { method: 'GET' }));
    if (r.ok && /^image\//i.test(r.headers.get('content-type') || '')) u = origin + '/evesandbox.png';
    if (r.body) r.body.cancel();
  } catch (e) { /* keep the main site's logo */ }
  logoMemo[origin] = { at: Date.now(), url: u };
  return u;
}
function pageResponse(req, base, html, status) {
  const h = new Headers(base.headers); h.delete('content-length'); h.delete('etag'); h.delete('last-modified'); h.set('cache-control', 'no-cache');
  return new Response(req.method === 'HEAD' ? null : html, { status: status || 200, headers: h });
}

// One look-up for a page card. A database hiccup must never stop the page itself from opening, so it is tried twice and,
// if it still fails, the visitor gets the normal page (the app then loads its own data, with its own retries) and the failure goes to the log.
async function cardRow(env, sql, bind) {
  for (let i = 0; i < 2; i++) {
    try { return { row: await env.DB.prepare(sql).bind(bind).first(), ok: true }; }
    catch (e) { console.error('card look-up failed (try ' + (i + 1) + ')', e && e.message ? e.message : e); if (i === 0) await new Promise((r) => setTimeout(r, 120)); }
  }
  return { row: null, ok: false };
}

// /id/<username>: the same page for everyone, with the right title and preview card for chat apps.
async function profilePage(req, env, url) {
  const m = url.pathname.match(/^\/id\/([A-Za-z0-9_]{1,40})\/?$/);
  if (!m) return env.ASSETS.fetch(req);
  const base = await appPage(req, env, url);
  if (!base.ok) return base;
  const { row } = await cardRow(env, 'SELECT id, username, name, bio, avatar FROM users WHERE username = ?', m[1].toLowerCase());
  let html = await base.text();
  if (row) {
    html = withCard(html, {
      title: 'Eve Sandbox - ' + (row.name || 'Member') + ' (@' + row.username + ')',
      desc: descOf(row.bio, 'A member of the Eve Sandbox Community.'),
      url: url.origin + '/id/' + row.username,
      image: row.avatar ? url.origin + '/img/a/' + row.id + '?v=' + row.avatar : await logoUrl(env, url.origin),
      imageAlt: (row.name || 'Member') + "'s profile picture", big: false, index: true
    });
  } else html = withCard(html, { title: 'Eve Sandbox - Community', desc: 'Ask questions, share what you know and help other students.', url: url.origin + '/', image: await logoUrl(env, url.origin) });
  return pageResponse(req, base, html);
}

// ---------- pictures ----------
async function image(req, env, url) {
  const m = url.pathname.match(/^\/img\/([a-z0-9]{8})\/([0-3])$/), av = url.pathname.match(/^\/img\/a\/([a-z0-9]{12})$/);
  if ((!m && !av) || (req.method !== 'GET' && req.method !== 'HEAD')) return new Response('Not found', { status: 404, headers: BASE_H });
  // A picture is only for showing inside the community's pages. Opening its address as a page (new tab, "Open image in new tab") is refused.
  const dest = (req.headers.get('sec-fetch-dest') || '').toLowerCase();
  if (dest === 'document' || dest === 'iframe' || dest === 'frame' || dest === 'embed' || dest === 'object') return new Response(null, { status: 302, headers: { location: '/', 'cache-control': 'no-store' } });
  const o = await env.IMAGES.get(av ? 'a/' + av[1] : m[1] + '/' + m[2]);
  if (!o) return new Response('Not found', { status: 404, headers: BASE_H });
  const h = {
    'content-type': o.httpMetadata && o.httpMetadata.contentType || 'application/octet-stream',
    'cache-control': 'public, max-age=31536000, immutable',
    vary: 'Sec-Fetch-Dest',
    etag: o.httpEtag,
    'x-content-type-options': 'nosniff',
    'x-robots-tag': 'noindex, noimageindex',   // chat apps may fetch a picture for a preview card; search engines should not list it
    'content-security-policy': "default-src 'none'; sandbox",
    'cross-origin-resource-policy': 'same-origin',
    'content-disposition': 'inline'
  };
  if (req.headers.get('if-none-match') === o.httpEtag) return new Response(null, { status: 304, headers: h });
  return new Response(req.method === 'HEAD' ? null : o.body, { headers: h });
}

// ---------- /p/<id>: the post itself. People get the app, chat apps get a preview card with the post's title, text and first picture ----------
const POST_CARD_SQL = 'SELECT p.id, p.title, p.body, p.img_count, p.created, p.reply_count, u.name AS aname, u.username AS auser FROM posts p LEFT JOIN users u ON u.id = p.author_id WHERE p.id = ?';
// What a chat app is shown for one post. Used for the real page and for the check at /api/ping?post=<id>, so both always agree.
async function postCard(env, origin, p) {
  const has = p.img_count > 0;
  const c = {
    title: p.title.slice(0, 100) + ' - Eve Sandbox Community',
    desc: descOf(p.body, 'A post by ' + (p.aname || 'a deleted user') + ' in the Eve Sandbox Community.'),
    url: origin + '/p/' + p.id,
    image: has ? origin + '/img/' + p.id + '/0' : await logoUrl(env, origin),
    imageAlt: has ? 'Picture from the post "' + p.title.slice(0, 80) + '"' : 'Eve Sandbox', type: 'article', big: has,
    index: true,
    ld: {
      '@context': 'https://schema.org', '@type': 'DiscussionForumPosting', headline: p.title.slice(0, 110),
      url: origin + '/p/' + p.id, mainEntityOfPage: origin + '/p/' + p.id,
      datePublished: new Date(p.created).toISOString(), commentCount: p.reply_count || 0,
      author: Object.assign({ '@type': 'Person', name: p.aname || 'Deleted User' }, p.auser ? { url: origin + '/id/' + p.auser } : {}),
      isPartOf: { '@type': 'WebSite', name: 'Eve Sandbox Community', url: origin + '/' }
    }
  };
  const t = String(p.body || '').replace(/\s+/g, ' ').trim();
  if (t) c.ld.text = t.slice(0, 500);
  if (has) c.ld.image = c.image;
  return c;
}
// /p/sitemap.xml: the newest posts, for search engines (it lives under /p/, which this Worker already answers, so no setting has to change).
async function sitemap(env, url) {
  let rows = [];
  try { rows = (await env.DB.prepare('SELECT id, created FROM posts ORDER BY created DESC, id DESC LIMIT 1000').all()).results || []; }
  catch (e) { console.error('sitemap failed', e && e.message ? e.message : e); return new Response('Try again later', { status: 503, headers: { 'retry-after': '120' } }); }
  const body = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    rows.map((r) => '<url><loc>' + url.origin + '/p/' + r.id + '</loc><lastmod>' + new Date(r.created).toISOString() + '</lastmod></url>').join('\n') + '\n</urlset>\n';
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=600', 'x-content-type-options': 'nosniff' } });
}
async function sharePage(req, env, url) {
  if (url.pathname === '/p/sitemap.xml' && (req.method === 'GET' || req.method === 'HEAD')) return await sitemap(env, url);
  const m = url.pathname.match(/^\/p\/([a-z0-9]{8})\/?$/);
  const base = await appPage(req, env, url);
  if (!base.ok) return base;
  if (!m) return pageResponse(req, base, await base.text(), 404);   // not a post address: the app shows "not found"
  const { row: p, ok } = await cardRow(env, POST_CARD_SQL, m[1]);
  let html = await base.text();
  if (!ok) return pageResponse(req, base, html);                    // the database did not answer: open the app anyway, it asks again itself
  if (!p) return pageResponse(req, base, withCard(html, { title: 'Post not found - Eve Sandbox Community', desc: 'This post does not exist or was deleted.', url: url.origin + '/', image: await logoUrl(env, url.origin) }), 404);
  return pageResponse(req, base, withCard(html, await postCard(env, url.origin, p)));
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    try {
      if (url.pathname.startsWith('/api/')) return await retryRead(req, () => api(req, env, url));
      if (url.pathname.startsWith('/img/')) return await image(req, env, url);
      if (url.pathname.startsWith('/p/')) return await sharePage(req, env, url);
      if (url.pathname.startsWith('/id/')) return await profilePage(req, env, url);
      return env.ASSETS ? await env.ASSETS.fetch(req) : new Response('Not found', { status: 404 });
    } catch (e) {
      if (e instanceof HttpErr) return json({ error: e.code }, e.status);
      const ref = newId(6);
      console.error('ref ' + ref, e && e.stack ? e.stack : e);
      return json({ error: 'server', ref }, 500);
    }
  }
};
