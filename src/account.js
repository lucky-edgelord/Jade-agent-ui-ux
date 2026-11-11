// <jade-account base="…" currency="USD">: the signed-in user's plan and subscription, this month's usage against the
// plan's limits, Manage billing (the Stripe portal), and API keys: make one (shown once, with Copy), revoke one.
// Signed out, it shows a short note (put a <jade-auth> next to it).
// Events: jade-key-created { id, prefix } · jade-key-revoked { id } · jade-portal { url } (cancel it to open it yourself)
import { JadeElement, define, h, icon, copyText } from './base.js';
import { baseClient } from './base-client.js';
import { FORM_CSS, busy, money, num } from './forms.js';

class JadeAccount extends JadeElement {
  static styles = FORM_CSS + `
.stack{display:flex;flex-direction:column;gap:calc(var(--jade-space) * 2)}
.meter{height:8px;border-radius:999px;background:var(--jade-surface-2);overflow:hidden;margin-top:6px}
.meter i{display:block;height:100%;background:var(--jade-accent)}.meter i.hi{background:var(--jade-warn)}.meter i.full{background:var(--jade-danger)}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:calc(var(--jade-space) * 2);margin-top:calc(var(--jade-space) * 1.5)}
.k{font-size:.8em;color:var(--jade-muted)}.v{font-size:1.3em;font-weight:700;font-variant-numeric:tabular-nums}
table{width:100%;border-collapse:collapse;font-size:.9em}
th,td{text-align:left;padding:8px 6px;border-bottom:1px solid var(--jade-border)}th{font-weight:600;color:var(--jade-muted);font-size:.85em}
tr:last-child td{border-bottom:0}
code{font-family:var(--jade-mono);font-size:.9em}
.newkey{display:flex;gap:8px;align-items:center;background:var(--jade-surface-2);border-radius:8px;padding:8px 10px;margin-top:10px;overflow:auto}
.newkey code{flex:1;white-space:nowrap}
.tag{font-size:.75em;border:1px solid var(--jade-border);border-radius:999px;padding:1px 8px;color:var(--jade-muted)}
.tag.on{color:var(--jade-ok);border-color:var(--jade-ok)}.tag.warn{color:var(--jade-warn);border-color:var(--jade-warn)}
form.inline{flex-direction:row;align-items:flex-end;gap:8px}form.inline label{flex:1}
`;
  static observedAttributes = ['base', 'currency'];
  constructor() { super(); this._onChange = () => this.load(); this.navigate = url => location.assign(url); }
  get client() { return baseClient(this.getAttribute('base') || undefined); }
  connectedCallback() { this._up = true; this._bind(); this.load(); }
  disconnectedCallback() { this._up = false; this._c?.removeEventListener('change', this._onChange); }
  attributeChangedCallback(n, o, v) { if (this._up && o !== v) { this._bind(); this.load(); } }
  _bind() { const c = this.client; if (c !== this._c) { this._c?.removeEventListener('change', this._onChange); this._c = c; c.addEventListener('change', this._onChange); } }
  async load() {
    const c = this.client;
    if (!c.signedIn) { this._seq = (this._seq || 0) + 1; this.shadowRoot.replaceChildren(h('div', { class: 'card muted', part: 'card', text: 'Sign in to see your plan, usage and API keys.' })); return; }
    this.shadowRoot.replaceChildren(h('div', { class: 'card', 'aria-busy': 'true' }, h('div', { class: 'skel', style: 'width:30%' }), h('div', { class: 'skel', style: 'margin-top:12px' })));
    const seq = this._seq = (this._seq || 0) + 1;
    try {
      const [usage, bill, keys] = await Promise.all([c.usage(), c.billing().catch(() => null), c.keys()]);
      if (seq !== this._seq) return; // a newer load is under way
      this.render(usage, bill, keys);
    } catch (e) { if (seq === this._seq) this.shadowRoot.replaceChildren(h('div', { class: 'err', role: 'alert', text: 'Your account could not be loaded: ' + e.message })); }
  }
  render(usage, bill, keys) {
    const cur = this.getAttribute('currency') || 'USD'; const p = usage.plan || {}; const m = usage.month || {};
    const meter = (used, cap) => { if (!cap) return null; const pct = Math.min(100, Math.round((used / cap) * 100)); return h('div', { class: 'meter', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct, 'aria-label': `${pct}% used` }, h('i', { class: pct >= 100 ? 'full' : pct >= 80 ? 'hi' : '', style: `width:${pct}%` })); };
    const status = bill?.status; const stTag = status ? h('span', { class: 'tag ' + (status === 'active' || status === 'trialing' ? 'on' : 'warn'), text: status.replace('_', ' ') }) : null;
    const err = h('div', { class: 'err', role: 'alert', hidden: true });
    const manage = bill?.has_billing_account ? h('button', { class: 'btn', type: 'button', part: 'manage', onclick: async e => { err.hidden = true; try { await busy(e.currentTarget, async () => { const url = await this.client.portal(); if (this.emit('jade-portal', { url })) this.navigate(url); }); } catch (x) { err.textContent = x.message; err.hidden = false; } } }, 'Manage billing') : null;
    const renews = bill?.current_period_end ? new Date(bill.current_period_end.replace(' ', 'T')).toLocaleDateString() : '';
    const planCard = h('section', { class: 'card', part: 'plan', 'aria-label': 'Plan and usage' },
      h('div', { class: 'row spread' }, h('div', {}, h('div', { class: 'k', text: 'Plan' }), h('div', { class: 'row' }, h('h2', { style: 'margin:0', text: p.name ? p.name[0].toUpperCase() + p.name.slice(1) : '—' }), stTag)), manage),
      renews && (status === 'active' || status === 'trialing') ? h('p', { class: 'muted small', text: `Renews ${renews}` }) : null,
      err,
      h('div', { class: 'stats' },
        h('div', {}, h('div', { class: 'k', text: 'Tokens this month' }), h('div', { class: 'v', text: num(m.tokens) + (p.monthly_tokens ? ` / ${num(p.monthly_tokens)}` : '') }), meter(m.tokens, p.monthly_tokens)),
        h('div', {}, h('div', { class: 'k', text: 'Usage this month' }), h('div', { class: 'v', text: money(m.cost || 0, cur) + (p.monthly_budget ? ` / ${money(p.monthly_budget, cur)}` : '') }), meter(m.cost, p.monthly_budget)),
        p.rpm ? h('div', {}, h('div', { class: 'k', text: 'Rate limit' }), h('div', { class: 'v', text: `${num(p.rpm)}/min` })) : null));
    this.shadowRoot.replaceChildren(h('div', { class: 'stack' }, planCard, this.keysCard(keys)));
  }
  keysCard(keys) {
    const c = this.client; const err = h('div', { class: 'err', role: 'alert', hidden: true }); const shown = h('div');
    const nameIn = h('input', { id: 'kname', name: 'name', placeholder: 'e.g. laptop', maxLength: 100, autocomplete: 'off' });
    const make = h('button', { class: 'btn primary', type: 'submit', part: 'create-key' }, 'Create key');
    const form = h('form', { class: 'inline' }, h('label', { for: 'kname' }, 'New API key', nameIn), make);
    form.addEventListener('submit', async e => {
      e.preventDefault(); err.hidden = true;
      try {
        await busy(make, async () => {
          const k = await c.createKey(nameIn.value.trim()); nameIn.value = '';
          const copy = h('button', { class: 'btn', type: 'button', onclick: async ev => { if (await copyText(k.key)) { ev.currentTarget.replaceChildren(icon('check'), 'Copied'); } } }, icon('copy'), 'Copy');
          shown.replaceChildren(h('div', { class: 'ok', role: 'status' }, h('strong', { text: 'Copy your key now: it will not be shown again.' }), h('div', { class: 'newkey' }, h('code', { part: 'new-key', text: k.key }), copy)));
          this.emit('jade-key-created', { id: k.id, prefix: k.prefix });
          this._refreshKeys(tbody);
        });
      } catch (x) { err.textContent = x.message; err.hidden = false; }
    });
    const tbody = h('tbody');
    this._fillKeys(tbody, keys);
    return h('section', { class: 'card', part: 'keys', 'aria-label': 'API keys' },
      h('h2', { text: 'API keys' }), h('p', { class: 'muted small', style: 'margin-bottom:12px', text: 'Use a key as Authorization: Bearer <key> with the OpenAI or Ollama API of this server.' }),
      form, err, shown,
      h('div', { style: 'overflow-x:auto;margin-top:12px' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', { text: 'Name' }), h('th', { text: 'Key' }), h('th', { text: 'Last used' }), h('th', {}))), tbody)));
  }
  async _refreshKeys(tbody) { try { this._fillKeys(tbody, await this.client.keys()); } catch {} }
  _fillKeys(tbody, keys) {
    const live = keys.filter(k => !k.revoked);
    if (!live.length) { tbody.replaceChildren(h('tr', {}, h('td', { colSpan: 4, class: 'muted', text: 'No keys yet.' }))); return; }
    tbody.replaceChildren(...live.map(k => h('tr', {},
      h('td', { text: k.name || '—' }), h('td', {}, h('code', { text: k.prefix + '…' })),
      h('td', { class: 'muted', text: k.last_used ? new Date(k.last_used.replace(' ', 'T')).toLocaleString() : 'never' }),
      h('td', { style: 'text-align:right' }, h('button', { class: 'btn ghost', type: 'button', 'aria-label': `Revoke ${k.name || k.prefix}`, onclick: async e => {
        if (!confirm(`Revoke ${k.name || k.prefix}? Apps using it stop working.`)) return;
        await busy(e.currentTarget, () => this.client.revokeKey(k.id)); this.emit('jade-key-revoked', { id: k.id }); this._refreshKeys(tbody);
      } }, 'Revoke')))));
  }
}
define('jade-account', JadeAccount);
export { JadeAccount };
