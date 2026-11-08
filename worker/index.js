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
async function makeSession(env, uid) {
  const p = bytesToB64u(enc.encode(JSON.stringify({ u: uid, e: Date.now() + SESSION_MS })));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env), enc.encode(p));
  return p + '.' + bytesToB64u(sig);
}
async function readSession(env, req) {
  const m = (req.headers.get('cookie') || '').match(/(?:^|;\s*)(?:__Host-)?eve_s=([A-Za-z0-9_\-.]+)/);
  if (!m) return null;
  const [p, s] = m[1].split('.');
  if (!p || !s) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(env), b64uToBytes(s), enc.encode(p));
    if (!ok) return null;
    const o = JSON.parse(new TextDecoder().decode(b64uToBytes(p)));
    return o && typeof o.u === 'string' && o.e > Date.now() ? o.u : null;
  } catch (e) { if (e instanceof HttpErr) throw e; return null; }
}
const cookieHeader = (url, value, maxAge) =>
  (url.protocol === 'https:' ? '__Host-eve_s' : 'eve_s') + '=' + value + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + maxAge + (url.protocol === 'https:' ? '; Secure' : '');

async function currentUser(env, req) {
  const uid = await readSession(env, req);
  if (!uid) return null;
  return (await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(uid).first()) || null;
}
const userOut = (u) => ({ uid: u.id, name: u.name || '', username: u.username || '', avatar: u.avatar || 0, admin: !!u.is_admin, suggest: cleanName(u.gname || ''), banned: !!u.banned });
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
  if (typeof pay.sub !== 'string' || !pay.sub || pay.sub.length > 128 || typeof pay.email !== 'string' || !pay.email || pay.email_verified !== true) fail(401, 'bad-token');
  // Only "Continue with Google" is accepted, even if another way to sign in is switched on in Firebase by mistake.
  if (!pay.firebase || pay.firebase.sign_in_provider !== 'google.com') fail(401, 'bad-token');
  return pay;
}

// ---------- row -> JSON ----------
const postOut = (r) => ({ id: r.id, title: r.title, body: r.body, score: r.score, replyCount: r.reply_count, createdAt: r.created, authorId: r.author_id, authorName: r.aname || 'Member', authorUser: r.auser || '', authorAvatar: r.aav || 0, images: r.img_count });
const replyOut = (r) => ({ id: r.id, body: r.body, authorId: r.author_id, authorName: r.aname || 'Member', authorUser: r.auser || '', authorAvatar: r.aav || 0, createdAt: r.created, postId: r.post_id, postTitle: r.ptitle });
const POST_SQL = 'SELECT p.*, u.name AS aname, u.username AS auser, u.avatar AS aav FROM posts p LEFT JOIN users u ON u.id = p.author_id';

function pageSize(url, def, max) { const n = parseInt(url.searchParams.get('size') || '', 10); return n >= 1 && n <= max ? n : def; }

// ---------- API ----------
async function api(req, env, url) {
  const path = url.pathname, method = req.method;
  let m;
  if (method !== 'GET' && method !== 'HEAD') sameOrigin(req, url);

  if (path === '/api/config' && method === 'GET') {
    const ok = env.FIREBASE_PROJECT_ID && env.FIREBASE_API_KEY && env.FIREBASE_APP_ID;
    return json({ firebase: ok ? { apiKey: env.FIREBASE_API_KEY, authDomain: env.FIREBASE_PROJECT_ID + '.firebaseapp.com', projectId: env.FIREBASE_PROJECT_ID, appId: env.FIREBASE_APP_ID } : null });
  }
  if (path === '/api/me' && method === 'GET') { const u = await currentUser(env, req); return json({ user: u ? userOut(u) : null }); }

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
    return json({ user: userOut(u) }, 200, { 'set-cookie': cookieHeader(url, await makeSession(env, u.id), SESSION_MS / 1000) });
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

// /id/<username>: the same page for everyone, with the right title and preview card for chat apps.
async function profilePage(req, env, url) {
  const m = url.pathname.match(/^\/id\/([A-Za-z0-9_]{1,40})\/?$/);
  if (!m) return env.ASSETS.fetch(req);
  const base = await env.ASSETS.fetch(new Request(new URL('/', url), { method: 'GET', headers: req.headers }));
  if (!base.ok) return base;
  const row = await env.DB.prepare('SELECT id, username, name, bio, avatar FROM users WHERE username = ?').bind(m[1].toLowerCase()).first();
  let html = await base.text();
  const swap = (a, b) => { html = html.replace(a, () => b); };
  swap('<meta charset="utf-8">', '<meta charset="utf-8"><meta name="robots" content="noindex">');
  if (row) {
    const title = esc('Eve Sandbox - ' + (row.name || 'Member') + ' (@' + row.username + ')');
    const desc = esc((row.bio || 'A member of the Eve Sandbox Community.').replace(/\s+/g, ' ').slice(0, 200));
    swap('<title>Eve Sandbox - Community</title>', '<title>' + title + '</title>');
    swap('<meta property="og:title" content="Eve Sandbox - Community">', '<meta property="og:title" content="' + title + '">');
    swap('<meta property="og:description" content="Ask questions, share what you know and help other students.">', '<meta property="og:description" content="' + desc + '">');
    swap('<meta property="og:url" content="https://community.evesandbox.com/">', '<meta property="og:url" content="' + esc(url.origin + '/id/' + row.username) + '">');
    swap('<link rel="canonical" href="https://community.evesandbox.com/">', '<link rel="canonical" href="' + esc(url.origin + '/id/' + row.username) + '">');
    if (row.avatar) swap('<meta property="og:image" content="https://evesandbox.com/evesandbox.png">', '<meta property="og:image" content="' + esc(url.origin + '/img/a/' + row.id + '?v=' + row.avatar) + '">');
  }
  const h = new Headers(base.headers); h.delete('content-length'); h.delete('etag'); h.set('cache-control', 'no-cache');
  return new Response(req.method === 'HEAD' ? null : html, { status: 200, headers: h });
}

// ---------- pictures ----------
async function image(req, env, url) {
  const m = url.pathname.match(/^\/img\/([a-z0-9]{8})\/([0-3])$/), av = url.pathname.match(/^\/img\/a\/([a-z0-9]{12})$/);
  if ((!m && !av) || (req.method !== 'GET' && req.method !== 'HEAD')) return new Response('Not found', { status: 404, headers: BASE_H });
  const o = await env.IMAGES.get(av ? 'a/' + av[1] : m[1] + '/' + m[2]);
  if (!o) return new Response('Not found', { status: 404, headers: BASE_H });
  const h = {
    'content-type': o.httpMetadata && o.httpMetadata.contentType || 'application/octet-stream',
    'cache-control': 'public, max-age=31536000, immutable',
    etag: o.httpEtag,
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; sandbox",
    'cross-origin-resource-policy': 'same-origin',
    'content-disposition': 'inline'
  };
  if (req.headers.get('if-none-match') === o.httpEtag) return new Response(null, { status: 304, headers: h });
  return new Response(req.method === 'HEAD' ? null : o.body, { headers: h });
}

// ---------- share link: /p/<id> gives chat apps a preview card, then sends people to the post ----------
async function sharePage(req, env, url) {
  const m = url.pathname.match(/^\/p\/([a-z0-9]{8})\/?$/);
  const H = { 'content-type': 'text/html; charset=utf-8', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; img-src https:", 'referrer-policy': 'no-referrer' };
  if (!m) return new Response('Not found', { status: 404, headers: BASE_H });
  const p = await env.DB.prepare('SELECT id, title, body, img_count FROM posts WHERE id = ?').bind(m[1]).first();
  if (!p) return new Response('<!doctype html><meta charset="utf-8"><title>Post not found</title><meta name="robots" content="noindex"><meta http-equiv="refresh" content="3;url=/"><p>Post not found. <a href="/">Back to the community</a></p>', { status: 404, headers: H });
  const origin = url.origin, title = p.title.slice(0, 100);
  const desc = (p.body || 'A post in the Eve Sandbox Community.').replace(/\s+/g, ' ').slice(0, 200);
  const img = p.img_count > 0 ? origin + '/img/' + p.id + '/0' : 'https://evesandbox.com/evesandbox.png';
  const dest = '/#/post/' + p.id;
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' + esc(title) + ' - Eve Sandbox Community</title>' +
    '<meta name="robots" content="noindex"><meta name="description" content="' + esc(desc) + '">' +
    '<meta property="og:site_name" content="Eve Sandbox"><meta property="og:type" content="article"><meta property="og:title" content="' + esc(title) + '">' +
    '<meta property="og:description" content="' + esc(desc) + '"><meta property="og:url" content="' + esc(origin + '/p/' + p.id) + '"><meta property="og:image" content="' + esc(img) + '">' +
    '<meta name="twitter:card" content="' + (p.img_count > 0 ? 'summary_large_image' : 'summary') + '">' +
    '<meta http-equiv="refresh" content="0;url=' + dest + '"></head><body><p><a href="' + dest + '">Open the post</a></p></body></html>';
  return new Response(req.method === 'HEAD' ? null : html, { headers: { ...H, 'cache-control': 'public, max-age=60' } });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    try {
      if (url.pathname.startsWith('/api/')) return await api(req, env, url);
      if (url.pathname.startsWith('/img/')) return await image(req, env, url);
      if (url.pathname.startsWith('/p/')) return await sharePage(req, env, url);
      if (url.pathname.startsWith('/id/')) return await profilePage(req, env, url);
      return env.ASSETS ? await env.ASSETS.fetch(req) : new Response('Not found', { status: 404 });
    } catch (e) {
      if (e instanceof HttpErr) return json({ error: e.code }, e.status);
      console.error(e);
      return json({ error: 'server' }, 500);
    }
  }
};
