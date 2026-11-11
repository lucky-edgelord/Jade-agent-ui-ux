// <jade-tool-call>: one tool call an agent made: its name, arguments, status and result, collapsible.
// With ask(), it becomes an approval card (Allow once / Always / Deny) and resolves true or false.
// Status: running | done | error | waiting (for approval) | denied.
import { JadeElement, define, h, icon } from './base.js';

const MAX = 4000;
const preview = a => { if (a == null) return ''; if (typeof a !== 'object') return String(a); const v = Object.values(a).find(x => typeof x === 'string' && x.trim()) ?? JSON.stringify(a); return String(v).replace(/\s+/g, ' ').slice(0, 80); };
const pretty = v => typeof v === 'string' ? v : JSON.stringify(v, null, 2);

class JadeToolCall extends JadeElement {
  static styles = `
:host{display:block;margin:6px 0}
details{border:1px solid var(--jade-border);border-radius:calc(var(--jade-radius) * .66);background:var(--jade-surface);overflow:hidden}
summary{display:flex;align-items:center;gap:8px;padding:6px 10px;cursor:pointer;list-style:none;font-size:.88em;min-height:34px}
summary::-webkit-details-marker{display:none}
summary .chev{transition:transform .15s;color:var(--jade-muted)} details[open] .chev{transform:rotate(90deg)}
.name{font-family:var(--jade-mono);font-weight:600}
.arg{color:var(--jade-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
.st{flex:none;font-size:.85em;color:var(--jade-muted);display:flex;align-items:center;gap:4px}
.dot{width:8px;height:8px;border-radius:50%;background:var(--jade-muted)}
:host([status=running]) .dot{background:var(--jade-accent);animation:pulse 1s ease-in-out infinite}
:host([status=done]) .dot{background:var(--jade-ok)} :host([status=error]) .dot,:host([status=denied]) .dot{background:var(--jade-danger)}
:host([status=waiting]) .dot{background:var(--jade-warn)} :host([status=waiting]) details{border-color:var(--jade-warn)}
@keyframes pulse{50%{opacity:.35}}
.body{border-top:1px solid var(--jade-border);padding:8px 10px;display:grid;gap:6px}
.lbl{font-size:.75em;text-transform:uppercase;letter-spacing:.05em;color:var(--jade-muted)}
pre{margin:0;font-family:var(--jade-mono);font-size:.8em;background:var(--jade-code);border-radius:6px;padding:8px 10px;overflow:auto;max-height:320px;white-space:pre-wrap;overflow-wrap:anywhere}
.more{justify-self:start}
.ask{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 10px;border-top:1px solid var(--jade-border);background:var(--jade-surface-2)}
.ask span{flex:1 1 100%;font-size:.88em}
`;
  static observedAttributes = ['name', 'status'];
  constructor() {
    super(); this.args = undefined; this.result = undefined; this._t0 = 0; this._ask = null;
    this.d = h('details', { part: 'card' },
      h('summary', { part: 'summary' }, icon('chev'), h('span', { class: 'name', part: 'name' }), h('span', { class: 'arg' }), h('span', { class: 'st' }, h('span', { class: 'dot' }), h('span', { class: 'stt' }))),
      h('div', { class: 'body', part: 'body' }));
    this.shadowRoot.append(this.d);
  }
  connectedCallback() { if (!this.hasAttribute('status')) this.setAttribute('status', 'running'); this._paint(); }
  attributeChangedCallback() { this._paint(); }
  get name() { return this.getAttribute('name') || ''; }
  set name(v) { this.setAttribute('name', v); }
  get status() { return this.getAttribute('status') || 'running'; }
  /** the call starts: name and arguments */
  start(name, args) { this.name = name; this.args = args; this._t0 = performance.now(); this.setAttribute('status', 'running'); this._paint(); return this; }
  /** the result arrived (a result starting with "Error:" marks it failed) */
  done(result) {
    this.result = result; this.ms = this._t0 ? Math.round(performance.now() - this._t0) : 0;
    if (this.status !== 'denied') this.setAttribute('status', /^Error:/.test(String(result ?? '')) ? 'error' : 'done');
    this._paint(); return this;
  }
  fail(error) { this.result = 'Error: ' + (error?.message || error); this.setAttribute('status', 'error'); this._paint(); return this; }
  /** ask the person to allow this call → Promise<boolean>; resolves 'always' as true and emits jade-approval-always */
  ask({ message } = {}) {
    if (this._ask) return this._ask.p;
    let res; const p = new Promise(r => (res = r));
    const end = (ok, always) => { bar.remove(); this._ask = null; this.setAttribute('status', ok ? 'running' : 'denied'); this.d.open = false; if (always) this.emit('jade-approval-always', { name: this.name }); this.emit('jade-approval', { name: this.name, args: this.args, allowed: ok }); res(ok); };
    const bar = h('div', { class: 'ask', part: 'approval', role: 'group', 'aria-label': `Approve ${this.name}` },
      h('span', { text: message || `Allow the agent to run ${this.name}?` }),
      h('button', { class: 'btn primary', type: 'button', onclick: () => end(true) }, 'Allow'),
      h('button', { class: 'btn', type: 'button', onclick: () => end(true, true) }, `Always allow ${this.name}`),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => end(false) }, 'Deny'));
    this.d.after(bar); this._ask = { p, end }; this.setAttribute('status', 'waiting'); this.d.open = true;
    queueMicrotask(() => bar.querySelector('.btn')?.focus({ preventScroll: true }));
    return p;
  }
  /** settle a pending approval from code (e.g. when the run is stopped) */
  answer(ok) { this._ask?.end(!!ok); }
  _paint() {
    if (!this.d) return; const st = this.status;
    this.$('.name').textContent = this.name; this.$('.arg').textContent = preview(this.args);
    this.$('.stt').textContent = { running: 'running', done: this.ms != null ? (this.ms < 1000 ? this.ms + ' ms' : (this.ms / 1000).toFixed(1) + ' s') : 'done', error: 'failed', waiting: 'needs approval', denied: 'denied' }[st] || st;
    const body = this.$('.body'); body.replaceChildren();
    if (this.args !== undefined) body.append(h('div', { class: 'lbl', text: 'Arguments' }), h('pre', { part: 'args', text: pretty(this.args) }));
    if (this.result !== undefined) {
      const full = pretty(this.result); const pre = h('pre', { part: 'result', text: full.length > MAX ? full.slice(0, MAX) + '\n…' : full });
      body.append(h('div', { class: 'lbl', text: 'Result' }), pre);
      if (full.length > MAX) body.append(h('button', { class: 'btn ghost more', type: 'button', onclick: e => { pre.textContent = full; e.target.remove(); } }, `Show all (${full.length.toLocaleString()} characters)`));
    }
  }
}
define('jade-tool-call', JadeToolCall);
export { JadeToolCall };
