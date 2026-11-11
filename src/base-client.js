// A small client for Jade Agent Base (PocketBase plus the gateway and billing), shared by <jade-auth>, <jade-pricing>
// and <jade-account>. One client per server URL; the signed-in user's token is kept in localStorage (per browser).
//   const base = baseClient('https://shop.example.com');
//   await base.signIn('ada@example.com', '…');  base.user;  base.addEventListener('change', …)
// Elements take the server from their `base` attribute, else setBase(url), else <meta name="jade-base" content="…">,
// else the page's own origin.
const clients = new Map();
let pageBase = '';

/** the server every element uses unless it has its own `base` attribute */
export function setBase(url) { pageBase = String(url || '').replace(/\/+$/, ''); }
/** the client for a server (made once) */
export function baseClient(url = pageBase) {
  const meta = typeof document !== 'undefined' ? document.querySelector('meta[name="jade-base"]')?.content : '';
  url = String(url || pageBase || meta || (typeof location !== 'undefined' ? location.origin : '')).replace(/\/+$/, '');
  if (!clients.has(url)) clients.set(url, new BaseClient(url));
  return clients.get(url);
}

export class BaseClient extends EventTarget {
  constructor(url, { collection = 'users' } = {}) {
    super(); this.url = url; this.collection = collection; this.key = 'jade-base:' + url;
    this.token = ''; this.user = null;
    try { const s = JSON.parse(localStorage.getItem(this.key) || 'null'); if (s?.token) { this.token = s.token; this.user = s.user; } } catch {}
    if (this.token && this._expired()) this._set('', null);
  }
  get signedIn() { return !!this.token && !!this.user; }
  _expired() { try { const p = JSON.parse(atob(this.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); return p.exp * 1000 < Date.now() + 10_000; } catch { return true; } }
  _set(token, user) {
    this.token = token || ''; this.user = user || null;
    try { if (token) localStorage.setItem(this.key, JSON.stringify({ token, user })); else localStorage.removeItem(this.key); } catch {}
    this.dispatchEvent(new CustomEvent('change', { detail: { user: this.user } }));
  }
  /** call the server; errors carry the server's message (and field errors in .fields) */
  async fetch(path, { method = 'GET', body, auth = true, query } = {}) {
    const u = new URL(this.url + path); for (const [k, v] of Object.entries(query || {})) if (v != null && v !== '') u.searchParams.set(k, String(v));
    const headers = {}; if (body !== undefined) headers['Content-Type'] = 'application/json'; if (auth && this.token) headers.Authorization = this.token;
    let r; try { r = await fetch(u, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch { throw Object.assign(new Error('Cannot reach the server. Check your connection and try again.'), { status: 0 }); }
    const text = await r.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!r.ok) {
      if (r.status === 401 && auth && this.token) this._set('', null);
      const fields = {}; for (const [k, v] of Object.entries(data?.data || {})) if (v?.message) fields[k] = v.message;
      const msg = data?.message || data?.error?.message || data?.error || `Request failed (${r.status})`;
      throw Object.assign(new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)), { status: r.status, fields });
    }
    return data;
  }
  // ---- accounts ----
  async signIn(email, password) {
    const r = await this.fetch(`/api/collections/${this.collection}/auth-with-password`, { method: 'POST', body: { identity: email, password }, auth: false });
    this._set(r.token, r.record); return r.record;
  }
  async signUp(email, password, extra = {}) {
    await this.fetch(`/api/collections/${this.collection}/records`, { method: 'POST', body: { email, password, passwordConfirm: password, ...extra }, auth: false });
    return this.signIn(email, password);
  }
  signOut() { this._set('', null); }
  /** refresh the token and user (e.g. after paying) */
  async refresh() { if (!this.token) return null; const r = await this.fetch(`/api/collections/${this.collection}/auth-refresh`, { method: 'POST' }); this._set(r.token, r.record); return r.record; }
  async resetPassword(email) { await this.fetch(`/api/collections/${this.collection}/request-password-reset`, { method: 'POST', body: { email }, auth: false }); }
  /** sign-in methods the server offers (password, OAuth2 providers); asked once */
  authMethods() { return (this._methods ||= this.fetch(`/api/collections/${this.collection}/auth-methods`, { auth: false }).catch(e => { this._methods = null; throw e; })); }
  /** the OAuth2 providers that are on: [{ name, displayName }] (none when the server cannot say) */
  async providers() { try { const m = await this.authMethods(); return m?.oauth2?.enabled ? (m.oauth2.providers || []).map(p => ({ name: p.name, displayName: p.displayName || p.name })) : []; } catch { return []; } }
  /**
   * sign in with Google, Facebook, GitHub, … (OAuth2, done by PocketBase): a window opens at the provider and closes
   * when they are done. Open the window yourself in the click handler and pass it as popup if you await anything
   * first, or browsers block it. → the user
   */
  async signInWith(provider, { popup } = {}) {
    popup ||= openPopup();
    const fail = m => { try { popup?.close(); } catch {} throw new Error(m); };
    if (!popup) fail('The sign-in window was blocked. Allow pop-ups for this site and try again.');
    let es, timer;
    try {
      const p = ((await this.authMethods())?.oauth2?.providers || []).find(x => x.name === provider);
      if (!p) fail(`Signing in with ${provider} is not available.`);
      const redirectURL = this.url + '/api/oauth2-redirect';
      // PocketBase passes the provider's answer to this page over its realtime channel; the state is our client id
      es = new EventSource(this.url + '/api/realtime');
      const clientId = await new Promise((ok, no) => { es.addEventListener('PB_CONNECT', e => ok(JSON.parse(e.data).clientId), { once: true }); es.onerror = () => no(new Error('Cannot reach the server. Check your connection and try again.')); });
      const answer = new Promise((ok, no) => {
        es.addEventListener('@oauth2', e => { try { ok(JSON.parse(e.data)); } catch (x) { no(x); } }, { once: true });
        timer = setInterval(() => { if (popup.closed) no(Object.assign(new Error('The sign-in window was closed.'), { cancelled: true })); }, 400);
      });
      await this.fetch('/api/realtime', { method: 'POST', body: { clientId, subscriptions: ['@oauth2'] }, auth: false });
      const u = new URL(p.authURL + redirectURL); u.searchParams.set('state', clientId);
      popup.location.href = u.toString();
      const a = await answer;
      if (a.state !== clientId) throw new Error('The sign-in answer did not match. Please try again.');
      if (a.error || !a.code) throw new Error(a.error ? `${p.displayName || provider} said: ${a.error}` : 'The sign-in was not completed.');
      const r = await this.fetch(`/api/collections/${this.collection}/auth-with-oauth2`, { method: 'POST', body: { provider, code: a.code, codeVerifier: p.codeVerifier, redirectURL }, auth: false });
      this._set(r.token, r.record); return r.record;
    } finally { clearInterval(timer); es?.close(); try { popup.close(); } catch {} }
  }
  // ---- plans, usage, keys, billing ----
  async plans() { return (await this.fetch('/api/collections/plans/records', { query: { sort: 'price_month', perPage: 50 }, auth: false })).items || []; }
  async usage() { return this.fetch('/api/gateway/me'); }
  async billing() { try { return await this.fetch('/api/billing/me'); } catch (e) { if (e.status === 404) return null; throw e; } }
  async keys() { return (await this.fetch('/api/collections/api_keys/records', { query: { sort: '-created', perPage: 100 } })).items || []; }
  async createKey(name) { return this.fetch('/api/gateway/keys', { method: 'POST', body: { name } }); }
  async revokeKey(id) { return this.fetch(`/api/gateway/keys/${encodeURIComponent(id)}/revoke`, { method: 'POST' }); }
  /** Stripe Checkout for a plan → its URL */
  async checkout(plan) { return (await this.fetch('/api/billing/checkout', { method: 'POST', body: { plan } })).url; }
  /** the Stripe customer portal → its URL */
  async portal() { return (await this.fetch('/api/billing/portal', { method: 'POST' })).url; }
}

/** a centred window for a provider's sign-in page (open it straight from a click) */
export function openPopup(name = 'jade-oauth2') {
  if (typeof window === 'undefined') return null;
  const w = Math.min(500, screen.availWidth || 500), hh = Math.min(640, screen.availHeight || 640);
  const left = (screen.availLeft || 0) + ((screen.availWidth || w) - w) / 2, top = (screen.availTop || 0) + ((screen.availHeight || hh) - hh) / 2;
  return window.open('about:blank', name, `popup=yes,width=${w},height=${hh},left=${left},top=${top}`);
}
