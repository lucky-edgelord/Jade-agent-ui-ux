// <jade-message role="user|assistant|system">: one turn of a chat. An assistant turn is a sequence of blocks as they
// stream: thinking (collapsible), text (markdown), tool calls, and surfaces (UI the agent built). Tool calls and
// surfaces load their modules when the first one appears.
//   const m = chat.addMessage({ role: 'assistant' }); m.append('Hel'); m.append('lo'); m.finish();
import { JadeElement, define, h, icon, copyText } from './base.js';
import { renderMarkdown, enhance, MD_CSS } from './markdown.js';

const lazy = (tag, f) => { let p; return () => (p ||= f().then(() => customElements.whenDefined(tag))); };
const loadTool = lazy('jade-tool-call', () => import('./tool-call.js'));
const loadSurface = lazy('jade-surface', () => import('./surface.js'));

class JadeMessage extends JadeElement {
  static styles = `
:host{display:block;padding:calc(var(--jade-space) * .75) 0}
.row{display:flex;flex-direction:column;gap:4px;align-items:flex-start}
:host([role=user]) .row{align-items:flex-end}
.who{font-size:.78em;font-weight:600;color:var(--jade-muted);display:flex;gap:8px;align-items:center}
.who .meta{font-weight:400;font-family:var(--jade-mono);font-size:.95em}
.bubble{max-width:100%;min-width:0}
:host([role=user]) .bubble{background:var(--jade-user);color:var(--jade-user-fg);padding:calc(var(--jade-space) * 1.1) calc(var(--jade-space) * 1.6);border-radius:var(--jade-radius) var(--jade-radius) calc(var(--jade-radius) * .3) var(--jade-radius);max-width:min(85%,640px);white-space:pre-wrap;overflow-wrap:anywhere}
:host([role=assistant]) .bubble{width:100%}
:host([role=system]) .bubble{font-size:.85em;color:var(--jade-muted);font-style:italic}
:host([kind=action]) .bubble{background:transparent;border:1px dashed var(--jade-border);color:var(--jade-muted);font-size:.85em;padding:4px 10px;font-family:var(--jade-mono)}
.imgs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;justify-content:flex-end}
.imgs img{max-width:160px;max-height:120px;border-radius:8px;object-fit:cover}
.think{margin:4px 0 8px;color:var(--jade-muted);font-size:.9em}
.think summary{cursor:pointer;display:inline-flex;align-items:center;gap:6px;list-style:none;user-select:none}
.think summary::-webkit-details-marker{display:none}
.think[open] summary .icon{transform:rotate(90deg)} .think summary .icon{transition:transform .15s}
.think .tb{border-left:2px solid var(--jade-border);padding:2px 0 2px 12px;margin:6px 0 0 6px;white-space:pre-wrap;max-height:300px;overflow:auto}
.think.live summary span{background:linear-gradient(90deg,var(--jade-muted) 40%,var(--jade-fg) 50%,var(--jade-muted) 60%);background-size:300% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:shine 2s linear infinite}
@keyframes shine{from{background-position:100% 0}to{background-position:0 0}}
.dots{display:inline-flex;gap:4px;padding:8px 0}
.dots i{width:7px;height:7px;border-radius:50%;background:var(--jade-muted);animation:b 1.2s infinite ease-in-out}
.dots i:nth-child(2){animation-delay:.15s}.dots i:nth-child(3){animation-delay:.3s}
@keyframes b{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}
.note{font-size:.82em;color:var(--jade-muted);margin-top:4px}
.err{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px;padding:8px 10px;border:1px solid var(--jade-danger);border-radius:calc(var(--jade-radius) * .66);color:var(--jade-danger);font-size:.9em}
.err span{flex:1;min-width:12em}
.actions{display:flex;gap:2px;opacity:0;transition:opacity .15s;min-height:28px}
:host(:hover) .actions,:host(:focus-within) .actions,:host([last]) .actions{opacity:1}
@media (hover:none){.actions{opacity:1}}
:host([streaming]) .actions{visibility:hidden}
.actions .btn{min-height:28px;padding:3px 7px;color:var(--jade-muted)}
.actions .btn:hover{color:var(--jade-fg)}
jade-surface{margin:8px 0}
` + MD_CSS;
  static observedAttributes = ['role', 'name', 'actions'];
  constructor() {
    super(); this._blocks = []; this._raf = 0; this._t0 = 0; this.images = [];
    this.who = h('div', { class: 'who', part: 'name' }, h('span', { class: 'nm' }), h('span', { class: 'meta' }));
    this.body = h('div', { class: 'blocks' }); this.bubble = h('div', { class: 'bubble', part: 'bubble' }, this.body);
    this.bar = h('div', { class: 'actions', part: 'actions' });
    this.shadowRoot.append(h('div', { class: 'row' }, this.who, this.bubble, this.bar));
  }
  connectedCallback() { if (!this.hasAttribute('role')) this.setAttribute('role', 'assistant'); this._labels(); this._actions(); }
  attributeChangedCallback() { this._labels(); this._actions(); }
  get role() { return this.getAttribute('role') || 'assistant'; }
  /** the text of the message (its text blocks, joined) */
  get text() { return this._blocks.filter(b => b.type === 'text').map(b => b.text).join('\n\n'); }
  _labels() {
    const r = this.role; const name = this.getAttribute('name') || (r === 'user' ? 'You' : r === 'assistant' ? 'Assistant' : 'System');
    this.who.querySelector('.nm').textContent = name; this.who.hidden = r === 'user' || r === 'system';
    this.setAttribute('aria-label', name);
  }
  _actions() {
    if (!this.bar) return; const want = (this.getAttribute('actions') ?? 'copy').split(/[\s,]+/).filter(Boolean);
    const b = (name, label, ev) => h('button', { class: 'btn ghost', type: 'button', title: label, 'aria-label': label, onclick: ev }, icon(name));
    this.bar.replaceChildren(...[
      want.includes('copy') && b('copy', 'Copy', async e => { if (await copyText(this.text)) { const btn = e.currentTarget; btn.replaceChildren(icon('check')); setTimeout(() => btn.replaceChildren(icon('copy')), 1400); } }),
      want.includes('edit') && b('edit', 'Edit', () => this.emit('jade-edit', { message: this, text: this.text })),
      want.includes('regenerate') && b('retry', 'Regenerate', () => this.emit('jade-regenerate', { message: this })),
    ].filter(Boolean));
    this.bar.hidden = !want.length || this.role === 'system' || this.getAttribute('kind') === 'action';
  }
  /** start streaming (shows the typing dots until something arrives) */
  begin() { this.toggleAttribute('streaming', true); this.setAttribute('aria-busy', 'true'); this._t0 = performance.now(); if (!this._blocks.length) this.body.replaceChildren(this._dots ||= h('div', { class: 'dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'))); return this; }
  _add(b) { this._dots?.remove(); this._blocks.push(b); this.body.append(b.el); return b; }
  _last(type) { const b = this._blocks[this._blocks.length - 1]; return b && b.type === type ? b : null; }
  /** add streamed text (markdown for assistants, plain for users) */
  append(delta) {
    if (!delta) return this; this._endThink();
    const b = this._last('text') || this._add({ type: 'text', text: '', el: h('div', { class: 'md', part: 'text' }) }); b.text += delta;
    if (!this._raf) this._raf = requestAnimationFrame(() => { this._raf = 0; this._paintText(); });
    return this;
  }
  /** replace all text with `text` */
  setText(text) {
    for (const b of this._blocks.filter(b => b.type === 'text')) b.el.remove();
    this._blocks = this._blocks.filter(b => b.type !== 'text'); return this.append(String(text ?? '')) && this._flush();
  }
  _flush() { if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; } this._paintText(); return this; }
  _paintText() { for (const b of this._blocks) if (b.type === 'text' && b.painted !== b.text) { b.painted = b.text; if (this.role === 'user') b.el.textContent = b.text; else { b.el.innerHTML = renderMarkdown(b.text); enhance(b.el); } } }
  /** add streamed reasoning (a collapsible "Thinking" block) */
  thinking(delta) {
    let b = this._last('think');
    if (!b) { const tb = h('div', { class: 'tb' }); const el = h('details', { class: 'think live', part: 'thinking' }, h('summary', {}, icon('chev'), h('span', { text: 'Thinking…' })), tb); b = this._add({ type: 'think', text: '', el, tb, t0: performance.now() }); }
    b.text += delta; b.tb.textContent = b.text; return this;
  }
  _endThink() { const b = this._blocks.find(x => x.type === 'think' && x.el.classList.contains('live')); if (!b) return; b.el.classList.remove('live'); const s = Math.max(1, Math.round((performance.now() - b.t0) / 1000)); b.el.querySelector('summary span').textContent = `Thought for ${s} s`; }
  /** a tool call block → a handle: { el, ready, done(result), fail(err), ask(opts) → Promise<boolean>, answer(ok) } */
  tool(name, args) {
    this._endThink(); const el = document.createElement('jade-tool-call'); this._add({ type: 'tool', el, name });
    const ready = loadTool().then(() => { customElements.upgrade(el); el.start(name, args); return el; });
    const later = f => (...a) => ready.then(c => c[f](...a));
    return { el, name, ready, done: later('done'), fail: later('fail'), ask: later('ask'), answer: later('answer') };
  }
  /** a surface the agent builds (see surface.js) → Promise<the jade-surface element> */
  async surface(spec = {}, name) {
    this._endThink(); const el = document.createElement('jade-surface'); if (name) el.setAttribute('name', name); this._add({ type: 'surface', el });
    await loadSurface(); customElements.upgrade(el); el.result = await el.render(spec); return el;
  }
  /** images shown above a user's text: data URLs or https URLs */
  setImages(urls = []) {
    this.images = urls; this.$('.imgs')?.remove(); if (!urls.length) return this;
    this.bubble.prepend(h('div', { class: 'imgs' }, urls.filter(u => /^(data:image\/|https:)/.test(u)).map(u => h('img', { src: u, alt: 'attached image' })))); return this;
  }
  /** a small label next to the name (e.g. the model) */
  meta(text) { this.who.querySelector('.meta').textContent = text || ''; return this; }
  /** done streaming. { stopped: true } notes that the person stopped it */
  finish({ stopped = false } = {}) {
    this._flush(); this._endThink(); this._dots?.remove(); this.removeAttribute('streaming'); this.setAttribute('aria-busy', 'false');
    if (stopped) this.bubble.append(h('div', { class: 'note', part: 'note', text: 'Stopped' }));
    this.emit('jade-finish', { message: this, text: this.text, stopped }); return this;
  }
  /** show an error with a Retry button (emits jade-retry) */
  fail(error) {
    this._flush(); this._dots?.remove(); this.removeAttribute('streaming'); this.setAttribute('aria-busy', 'false');
    this.bubble.append(h('div', { class: 'err', part: 'error', role: 'alert' }, icon('alert'), h('span', { text: String(error?.message || error || 'Something went wrong') }),
      h('button', { class: 'btn', type: 'button', onclick: () => this.emit('jade-retry', { message: this }) }, icon('retry'), 'Retry')));
    this.emit('jade-finish', { message: this, text: this.text, error }); return this;
  }
}
define('jade-message', JadeMessage);
export { JadeMessage };
