// <jade-pricing base="…" currency="USD">: the server's plans as cards, with the signed-in user's plan marked and a
// Subscribe button that opens Stripe Checkout. Signed out, Subscribe asks to sign in first (jade-needs-signin).
// Events: jade-checkout { plan, url } (cancel it to open the URL yourself) · jade-needs-signin { plan }
import { JadeElement, define, h, icon } from './base.js';
import { baseClient } from './base-client.js';
import { FORM_CSS, busy, money, num } from './forms.js';

class JadePricing extends JadeElement {
  static styles = FORM_CSS + `
.grid{display:grid;gap:calc(var(--jade-space) * 2);grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))}
.plan{display:flex;flex-direction:column;gap:calc(var(--jade-space) * 1.25)}
.plan.current{border-color:var(--jade-accent);box-shadow:0 0 0 1px var(--jade-accent)}
.price{font-size:1.9em;font-weight:700;line-height:1}
.price small{font-size:.45em;font-weight:500;color:var(--jade-muted)}
ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;font-size:.9em;flex:1}
li{display:flex;gap:8px;align-items:flex-start}li .icon{color:var(--jade-ok);margin-top:3px}
.badge{font-size:.72em;font-weight:600;background:var(--jade-accent);color:var(--jade-accent-fg);border-radius:999px;padding:2px 8px}
.plan h3{min-height:1.4em;display:flex;align-items:center}
`;
  static observedAttributes = ['base', 'currency'];
  constructor() { super(); this._onChange = () => this.load(); this.navigate = url => location.assign(url); }
  get client() { return baseClient(this.getAttribute('base') || undefined); }
  connectedCallback() { this._up = true; this._bind(); this.load(); }
  disconnectedCallback() { this._up = false; this._c?.removeEventListener('change', this._onChange); }
  attributeChangedCallback(n, o, v) { if (this._up && o !== v) { this._bind(); this.load(); } }
  _bind() { const c = this.client; if (c !== this._c) { this._c?.removeEventListener('change', this._onChange); this._c = c; c.addEventListener('change', this._onChange); } }
  async load() {
    this.shadowRoot.replaceChildren(h('div', { class: 'grid', 'aria-busy': 'true' }, [1, 2, 3].map(() => h('div', { class: 'card' }, h('div', { class: 'skel', style: 'width:40%' }), h('div', { class: 'skel', style: 'width:60%;margin-top:12px;height:2em' })))));
    const c = this.client; const seq = this._seq = (this._seq || 0) + 1;
    try {
      const [plans, bill] = await Promise.all([c.plans(), c.signedIn ? c.billing().catch(() => null) : null]);
      if (seq !== this._seq) return; // a newer load is under way
      this.plans = plans; this.render(plans, bill);
    } catch (e) { if (seq === this._seq) this.shadowRoot.replaceChildren(h('div', { class: 'err', role: 'alert', text: 'Plans could not be loaded: ' + e.message })); }
  }
  render(plans, bill) {
    const c = this.client; const cur = this.getAttribute('currency') || 'USD';
    const mine = c.signedIn ? (bill?.plan || plans.find(p => p.id === c.user?.plan)?.name || plans.find(p => p.default)?.name) : null;
    const err = h('div', { class: 'err', role: 'alert', hidden: true });
    const cards = plans.map(p => {
      const current = p.name === mine; const paid = p.price_month > 0;
      const feats = [p.monthly_tokens ? `${num(p.monthly_tokens)} tokens a month` : paid ? 'No monthly token cap' : null, p.monthly_budget ? `Up to ${money(p.monthly_budget, cur)} of usage a month` : null, p.rpm ? `${num(p.rpm)} requests a minute` : null].filter(Boolean);
      let btn;
      if (current) btn = h('button', { class: 'btn wide', type: 'button', disabled: true }, 'Your plan');
      else if (!paid) btn = h('button', { class: 'btn wide', type: 'button', disabled: !!mine }, mine ? 'Included' : 'Free');
      else if (!p.stripe_price) btn = h('button', { class: 'btn wide', type: 'button', disabled: true }, 'Coming soon');
      else btn = h('button', { class: 'btn primary wide', type: 'button', part: 'subscribe', onclick: e => this.subscribe(p, e.currentTarget, err) }, `Choose ${p.name}`);
      return h('section', { class: 'card plan' + (current ? ' current' : ''), part: 'plan', 'aria-label': `${p.name} plan` },
        h('div', { class: 'row spread' }, h('h3', { text: p.name[0].toUpperCase() + p.name.slice(1) }), current ? h('span', { class: 'badge', text: 'Current' }) : null),
        h('div', { class: 'price' }, paid ? money(p.price_month, cur) : 'Free', paid ? h('small', { text: ' / month' }) : null),
        p.description ? h('p', { class: 'muted small', text: p.description }) : null,
        h('ul', {}, feats.map(f => h('li', {}, icon('check'), h('span', { text: f })))), btn);
    });
    this.shadowRoot.replaceChildren(err, h('div', { class: 'grid', part: 'grid' }, cards));
  }
  async subscribe(p, btn, err) {
    err.hidden = true; const c = this.client;
    if (!c.signedIn) { this.emit('jade-needs-signin', { plan: p.name }); return; }
    try {
      await busy(btn, async () => { const url = await c.checkout(p.name); if (this.emit('jade-checkout', { plan: p.name, url })) this.navigate(url); });
    } catch (e) { err.textContent = e.message; err.hidden = false; }
  }
}
define('jade-pricing', JadePricing);
export { JadePricing };
