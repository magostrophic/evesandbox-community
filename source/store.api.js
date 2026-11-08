// Talks to the community server (the Worker in ../worker) with plain fetch calls on the same address.
// Sign-in: "Continue with Google" through Firebase Authentication (popup). The browser gets a Firebase ID token,
// sends it once to /api/auth/login, and the server checks it and sets its own cookie. Firebase keeps nothing afterwards.
import { initializeApp } from 'firebase/app';
import { initializeAuth, inMemoryPersistence, browserPopupRedirectResolver, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut } from 'firebase/auth';
const G_LOGO = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';
function err(code) { const e = new Error(code); e.code = code; return e; }

export function createStore(fbConfig) {
  let user = null, listeners = [], auth = null;
  const tell = () => listeners.forEach((f) => f(user));

  async function call(method, path, body, form) {
    let r;
    try {
      r = await fetch(path, {
        method, credentials: 'same-origin',
        headers: body !== undefined && !form ? { 'content-type': 'application/json' } : undefined,
        body: body === undefined ? undefined : (form ? body : JSON.stringify(body))
      });
    } catch (e) { throw err('unavailable'); }
    let j = null;
    try { j = await r.json(); } catch (e) { /* not JSON */ }
    if (!r.ok) {
      const code = (j && j.error) || (r.status >= 500 ? 'server' : 'bad-request');
      if (code === 'sign-in' && user) { user = null; tell(); }
      throw err(code);
    }
    return j;
  }

  const imgs = (p) => Array.from({ length: p.images || 0 }, (_, i) => '/img/' + p.id + '/' + i);
  const fix = (p) => Object.assign({}, p, { images: imgs(p) });
  async function userList(username, what, { after, size }) {
    const q = new URLSearchParams({ size: String(size || 20) });
    if (after) q.set('cursor', after);
    const r = await call('GET', '/api/users/' + encodeURIComponent(username) + '/' + what + '?' + q);
    if (r.posts) r.posts = r.posts.map(fix);
    return r;
  }

  const authObj = () => auth || (auth = initializeAuth(initializeApp(fbConfig), { persistence: inMemoryPersistence, popupRedirectResolver: browserPopupRedirectResolver }));

  return {
    onAuth(cb) {
      listeners.push(cb);
      call('GET', '/api/me').then((r) => { user = r.user; cb(user); }, () => { user = null; cb({ error: err('unavailable') }); });
    },
    // Puts the "Continue with Google" button into the element el.
    renderSignIn(el, hooks) {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'gbtn';
      btn.innerHTML = G_LOGO + '<span>Continue with Google</span>';
      btn.onclick = async () => {
        btn.disabled = true;
        hooks.start();
        try {
          const res = await signInWithPopup(authObj(), new GoogleAuthProvider(), browserPopupRedirectResolver);
          const idToken = await res.user.getIdToken();
          const r = await call('POST', '/api/auth/login', { idToken });
          user = r.user; tell();
          try { await fbSignOut(authObj()); } catch (e) { /* nothing is kept either way */ }
        } catch (e) {
          const c = e && e.code;
          if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') hooks.cancel();
          else if (c === 'auth/popup-blocked') hooks.fail(err('popup-blocked'));
          else if (c === 'auth/unauthorized-domain') hooks.fail(err('unauthorized-domain'));
          else if (c === 'auth/network-request-failed') hooks.fail(err('unavailable'));
          else if (c && String(c).indexOf('auth/') === 0) hooks.fail(err('sign-in-failed'));
          else hooks.fail(e && e.code ? e : err('sign-in-failed'));
        }
        btn.disabled = false;
      };
      el.replaceChildren(btn);
    },
    async signOut() {
      try { await call('POST', '/api/auth/logout', {}); } catch (e) { /* cookie may stay; the next page load tells */ }
      user = null;
      tell();
    },
    async setName(uid, name, username) { await call('POST', '/api/me/name', { name, username }); if (user) { user.name = name; user.username = username; } },
    async saveProfile(data) { const r = await call('POST', '/api/me/profile', data); if (user) Object.assign(user, r.user); return r.user; },
    async setAvatar(blob) {
      const f = new FormData(); f.append('avatar', blob, 'avatar.jpg');
      const r = await call('POST', '/api/me/avatar', f, true); if (user) user.avatar = r.avatar; return r.avatar;
    },
    async removeAvatar() { await call('DELETE', '/api/me/avatar'); if (user) user.avatar = 0; },
    async getProfile(username) {
      try { return (await call('GET', '/api/users/' + encodeURIComponent(username))).profile; }
      catch (e) { if (e.code === 'not-found') return null; throw e; }
    },
    async listUserPosts(username, o) { return userList(username, 'posts', o); },
    async listUserReplies(username, o) { return userList(username, 'replies', o); },
    async listUserLikes(username, o) { return userList(username, 'likes', o); },
    async listPosts({ sort, after, size }) {
      const q = new URLSearchParams({ sort: sort === 'top' ? 'top' : 'new', size: String(size || 20) });
      if (after) q.set('cursor', after);
      const r = await call('GET', '/api/posts?' + q);
      return { posts: r.posts.map(fix), cursor: r.cursor, done: r.done };
    },
    async getPost(id) {
      try { return fix((await call('GET', '/api/posts/' + id)).post); }
      catch (e) { if (e.code === 'not-found' || e.code === 'bad-request') return null; throw e; }
    },
    async getMyVotes(uid, ids) { return (await call('GET', '/api/votes?ids=' + ids.join(','))).votes || {}; },
    async vote(uid, id, v) { await call('PUT', '/api/posts/' + id + '/vote', { value: v }); },
    async createPost(uid, name, title, body, files) {
      const f = new FormData();
      f.append('title', title); f.append('body', body);
      (files || []).forEach((x) => f.append('images', x, x.name || 'picture'));
      return (await call('POST', '/api/posts', f, true)).id;
    },
    async deletePost(id) { await call('DELETE', '/api/posts/' + id); },
    async listReplies(postId, { after, size }) {
      const q = new URLSearchParams({ size: String(size || 30) });
      if (after) q.set('cursor', after);
      return call('GET', '/api/posts/' + postId + '/replies?' + q);
    },
    async createReply(uid, name, postId, body) { return (await call('POST', '/api/posts/' + postId + '/replies', { body })).id; },
    async deleteReply(postId, replyId) { await call('DELETE', '/api/replies/' + replyId); },
    async report(uid, postId, replyId, reason) { await call('POST', '/api/report', { postId, replyId, reason }); }
  };
}
