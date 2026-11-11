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
  /** sign-in methods the server offers (password, OAuth2 providers) */
  async authMethods() { return this.fetch(`/api/collections/${this.collection}/auth-methods`, { auth: false }); }
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
