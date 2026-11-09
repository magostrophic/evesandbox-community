// Talks to the community server (the Worker in ../worker) with plain fetch calls on the same address.
// Sign-in: "Continue with Google" (popup) or email + password, both through Firebase Authentication. The browser gets a Firebase ID token,
// sends it once to /api/auth/login, and the server checks it and sets its own cookie. Firebase keeps nothing afterwards.
import { initializeApp } from 'firebase/app';
import { initializeAuth, inMemoryPersistence, browserPopupRedirectResolver, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
const G_LOGO = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';
function err(code) { const e = new Error(code); e.code = code; return e; }

export function createStore(fbConfig) {
  let user = null, listeners = [], auth = null;
  const tell = () => listeners.forEach((f) => f(user));

  async function once(method, path, body, form) {
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
      const e = err(code); e.status = r.status; e.path = path; if (j && j.ref) e.ref = j.ref;
      if (!j) e.plain = true;   // the answer was not ours (an error page from the network), so trying again may well work
      throw e;
    }
    return j;
  }
  // Reading is retried (up to 3 tries, a short pause between) when the failure looks temporary; changes (posting, voting...) are never repeated.
  async function call(method, path, body, form, once1) {
    const tries = method === 'GET' && !once1 ? 3 : 1;
    for (let i = 1; ; i++) {
      try { return await once(method, path, body, form); }
      catch (e) {
        const temporary = e.code === 'unavailable' || e.code === 'server' || e.status >= 500 || e.plain;
        if (i >= tries || !temporary) throw e;
        await new Promise((res) => setTimeout(res, 350 * i));
      }
    }
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

  // Firebase error codes -> our own short codes (the page turns them into sentences).
  function mapAuthError(e) {
    const c = e && e.code;
    if (c && String(c).indexOf('auth/') !== 0) return e;
    if (c === 'auth/invalid-credential' || c === 'auth/wrong-password' || c === 'auth/user-not-found' || c === 'auth/invalid-login-credentials') return err('wrong-credentials');
    if (c === 'auth/email-already-in-use') return err('email-in-use');
    if (c === 'auth/weak-password') return err('weak-password');
    if (c === 'auth/invalid-email' || c === 'auth/missing-email') return err('bad-email');
    if (c === 'auth/too-many-requests') return err('too-many-tries');
    if (c === 'auth/user-disabled') return err('banned');
    if (c === 'auth/network-request-failed') return err('unavailable');
    if (c === 'auth/operation-not-allowed') return err('email-login-off');
    return err('sign-in-failed');
  }
  const verifyUrl = () => ({ url: location.origin + '/' });
  async function sendVerify(u) {
    try { await sendEmailVerification(u, verifyUrl()); }
    catch (e) { if (e && e.code === 'auth/unauthorized-continue-uri') await sendEmailVerification(u); else throw e; }
  }
  const quietOut = async () => { try { await fbSignOut(authObj()); } catch (e) { /* nothing is kept either way */ } };

  const authObj = () => auth || (auth = initializeAuth(initializeApp(fbConfig), { persistence: inMemoryPersistence, popupRedirectResolver: browserPopupRedirectResolver }));

  return {
    onAuth(cb) {
      listeners.push(cb);
      // Who is signed in is asked right away. If the server does not answer, the page says so once and keeps asking quietly
      // (after 3, 7, 15 and 30 seconds), so a short hiccup after a reload does not leave a signed-in person looking signed out.
      let failed = 0;
      const ask = () => call('GET', '/api/me').then((r) => { user = r.user; cb(user); }, () => {
        user = null;
        if (failed === 0) cb({ error: err('unavailable') });
        if (failed < 4) setTimeout(ask, [3000, 7000, 15000, 30000][failed]);
        failed++;
      });
      ask();
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
    // Email + password. Firebase keeps the password (hashed); our server only ever sees the signed token.
    async signUpWithEmail(email, password) {
      try {
        const res = await createUserWithEmailAndPassword(authObj(), email, password);
        try { await sendVerify(res.user); } catch (e) { /* the account exists; "Resend" can try again */ }
      } catch (e) { throw mapAuthError(e); }
      await quietOut();
    },
    async signInWithEmail(email, password) {
      let idToken;
      try { const res = await signInWithEmailAndPassword(authObj(), email, password); idToken = await res.user.getIdToken(); }
      catch (e) { throw mapAuthError(e); }
      try {
        const r = await call('POST', '/api/auth/login', { idToken });
        user = r.user; tell();
      } finally { await quietOut(); }
    },
    async resendVerification(email, password) {
      try { const res = await signInWithEmailAndPassword(authObj(), email, password); await sendVerify(res.user); }
      catch (e) { throw mapAuthError(e); }
      finally { await quietOut(); }
    },
    async resetPassword(email) {
      try { await sendPasswordResetEmail(authObj(), email, verifyUrl()); }
      catch (e) {
        if (e && e.code === 'auth/unauthorized-continue-uri') { try { await sendPasswordResetEmail(authObj(), email); return; } catch (e2) { e = e2; } }
        if (e && e.code === 'auth/user-not-found') return; // never tell who has an account
        throw mapAuthError(e);
      }
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
    async vote(uid, id, v) { const r = await call('PUT', '/api/posts/' + id + '/vote', { value: v }); return r && typeof r.score === 'number' ? r.score : null; },
    async getScores(ids, since) { return call('GET', '/api/scores?ids=' + ids.join(',') + (since === null || since === undefined ? '' : '&since=' + since), undefined, false, true); },
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
