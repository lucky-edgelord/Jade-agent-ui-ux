// <jade-auth base="https://shop.example.com">: sign in, create an account, reset a password (Jade Agent Base / PocketBase
// users). Signed in, it shows who and a Sign out button. Field errors from the server appear on their fields.
// When the server has OAuth2 providers on (Google, Facebook, GitHub, …), a "Continue with …" button shows for each.
// Events: jade-auth { user, mode } after signing in or up (mode: signin, signup or the provider) · jade-signout
import { JadeElement, define, h } from './base.js';
import { baseClient, openPopup } from './base-client.js';
import { FORM_CSS, busy } from './forms.js';

class JadeAuth extends JadeElement {
  static styles = FORM_CSS + `:host{max-width:400px}.oauth{display:grid;gap:8px}.or{display:flex;align-items:center;gap:10px;color:var(--jade-muted);font-size:.85em;margin:14px 0 4px}.or::before,.or::after{content:"";flex:1;border-top:1px solid var(--jade-border)}`;
  static observedAttributes = ['base', 'mode'];
  constructor() { super(); this._mode = 'signin'; this._onChange = () => this.render(); }
  /** the Jade Agent Base client this element uses */
  get client() { return baseClient(this.getAttribute('base') || undefined); }
  connectedCallback() { this._mode = this.getAttribute('mode') || this._mode; this._bind(); this.render(); }
  async _loadMethods() {
    const c = this.client; let m = null; try { m = await c.authMethods(); } catch {}
    if (c !== this.client) return;
    this._providers = m?.oauth2?.enabled ? (m.oauth2.providers || []) : []; this._password = m ? m.password?.enabled !== false : true;
    if (!c.signedIn && (this._providers.length || !this._password)) this.render();
  }
  disconnectedCallback() { this._c?.removeEventListener('change', this._onChange); }
  attributeChangedCallback(n, o, v) { if (n === 'mode' && v) this._mode = v; if (this.isConnected) { this._bind(); this.render(); } }
  _bind() { const c = this.client; if (c !== this._c) { this._c?.removeEventListener('change', this._onChange); this._c = c; c.addEventListener('change', this._onChange); this._providers = []; this._password = true; if (this.isConnected) this._loadMethods(); } }
  /** show signin | signup | reset */
  show(mode) { this._mode = mode; this.render(); }
  render() {
    const c = this.client;
    if (c.signedIn) {
      const out = h('button', { class: 'btn', type: 'button', onclick: () => { c.signOut(); this.emit('jade-signout', {}); } }, 'Sign out');
      this.shadowRoot.replaceChildren(h('div', { class: 'card', part: 'card' }, h('div', { class: 'row spread' }, h('p', {}, 'Signed in as ', h('strong', { text: c.user.email || c.user.name || c.user.id })), out)));
      return;
    }
    const m = this._mode;
    const tab = (id, label) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(m === id), onclick: () => this.show(id) }, label);
    const field = (name, label, type, extra = {}) => { const id = 'f-' + name; return h('label', { for: id }, label, h('input', { id, name, type, required: true, autocomplete: extra.ac, minLength: extra.min }), h('span', { class: 'ferr', id: id + '-e', 'aria-live': 'polite' })); };
    const err = h('div', { class: 'err', role: 'alert', hidden: true });
    const note = h('div', { class: 'ok', role: 'status', hidden: true });
    const submit = h('button', { class: 'btn primary wide', type: 'submit', part: 'submit' }, m === 'signup' ? 'Create account' : m === 'reset' ? 'Send reset link' : 'Sign in');
    const form = h('form', { part: 'form', noValidate: true },
      m === 'reset' ? h('p', { class: 'muted small', text: 'We will email you a link to choose a new password.' }) : null,
      field('email', 'Email', 'email', { ac: 'email' }),
      m !== 'reset' ? field('password', 'Password', 'password', { ac: m === 'signup' ? 'new-password' : 'current-password', min: m === 'signup' ? 8 : undefined }) : null,
      err, note, submit,
      m === 'signin' ? h('button', { class: 'link', type: 'button', onclick: () => this.show('reset') }, 'Forgot your password?') : null,
      m === 'reset' ? h('button', { class: 'link', type: 'button', onclick: () => this.show('signin') }, 'Back to sign in') : null);
    form.addEventListener('submit', async e => {
      e.preventDefault(); err.hidden = true; note.hidden = true;
      for (const i of form.querySelectorAll('input')) { i.removeAttribute('aria-invalid'); form.querySelector(`#${i.id}-e`).textContent = ''; }
      const email = form.email.value.trim(), password = form.password?.value || '';
      const bad = (name, msg) => { const i = form.querySelector(`#f-${name}`); if (!i) return false; i.setAttribute('aria-invalid', 'true'); i.setAttribute('aria-describedby', `f-${name}-e`); form.querySelector(`#f-${name}-e`).textContent = msg; return true; };
      if (!/^\S+@\S+\.\S+$/.test(email)) { bad('email', 'Enter an email address.'); form.email.focus(); return; }
      if (m === 'signup' && password.length < 8) { bad('password', 'Use at least 8 characters.'); form.password.focus(); return; }
      if (m === 'signin' && !password) { bad('password', 'Enter your password.'); form.password.focus(); return; }
      try {
        await busy(submit, async () => {
          if (m === 'reset') { await c.resetPassword(email); note.textContent = 'If that email has an account, a reset link is on its way.'; note.hidden = false; return; }
          const user = m === 'signup' ? await c.signUp(email, password) : await c.signIn(email, password);
          this.emit('jade-auth', { user, mode: m });
        });
      } catch (x) {
        let shown = false;
        for (const [k, v] of Object.entries(x.fields || {})) shown = bad(k, k === 'email' && /unique/i.test(v) ? 'That email already has an account. Sign in instead.' : v) || shown;
        if (!shown) { err.textContent = m === 'signin' && x.status === 400 ? 'That email and password do not match an account.' : x.message; err.hidden = false; }
      }
    });
    const provs = m === 'reset' ? [] : this._providers || [];
    const perr = h('div', { class: 'err', role: 'alert', hidden: true });
    const social = provs.length ? h('div', { class: 'oauth', part: 'providers' }, ...provs.map(p => {
      const label = p.displayName || p.name[0].toUpperCase() + p.name.slice(1);
      const b = h('button', { class: 'btn wide', type: 'button', part: 'provider', 'data-provider': p.name }, `Continue with ${label}`);
      b.addEventListener('click', async () => {
        perr.hidden = true; const popup = openPopup();
        try { await busy(b, async () => { const user = await c.signInWith(p.name, { popup }); this.emit('jade-auth', { user, mode: p.name }); }); }
        catch (x) { if (!x.cancelled) { perr.textContent = x.message; perr.hidden = false; } }
      });
      return b;
    }), perr) : null;
    const password = this._password !== false;
    this.shadowRoot.replaceChildren(h('div', { class: 'card', part: 'card' },
      m === 'reset' ? h('h2', { text: 'Reset your password' }) : password ? h('div', { class: 'tabs', role: 'tablist' }, tab('signin', 'Sign in'), tab('signup', 'Create account')) : h('h2', { text: 'Sign in' }),
      social, social && password ? h('p', { class: 'or', 'aria-hidden': 'true' }, h('span', { text: 'or' })) : null, password || m === 'reset' ? form : null));
  }
}
define('jade-auth', JadeAuth);
export { JadeAuth };
