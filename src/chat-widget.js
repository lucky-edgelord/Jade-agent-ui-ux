// <jade-chat-widget>: a floating chat button in a corner that opens a chat panel, for customer service, help desks,
// sales or any assistant that should sit on top of a page. The chat itself (<jade-chat>) loads on the first open.
//   <jade-chat-widget title="Acme support" greeting="Hi! How can we help?" suggestions='["Where is my order?"]'></jade-chat-widget>
//   widget.handler = async (text, reply) => { reply.append('…'); }      // any backend
//   await widget.connect(kit, { model, system })                          // or a Jade Agent Kit agent
// Attributes: title, subtitle, greeting, suggestions (JSON), placeholder, label (the button's name), position
// (bottom-right | bottom-left), open. Events: jade-open, jade-close. Esc closes; focus returns to the button.
// Size with --jade-widget-width / --jade-widget-height; on small screens the panel fills the screen.
import { JadeElement, define, h } from './base.js';

const svg = (d, size = 24) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size); s.setAttribute('aria-hidden', 'true'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.innerHTML = d; return s; };
const BUBBLE = '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z"/>';
const CLOSE = '<path d="M6 6l12 12M18 6L6 18"/>';
const FWD = ['greeting', 'suggestions', 'placeholder', 'attach', 'assistant-name', 'hint'];

class JadeChatWidget extends JadeElement {
  static styles = `
:host{position:fixed;z-index:var(--jade-widget-z,2147483000);bottom:var(--jade-widget-offset,20px);right:var(--jade-widget-offset,20px);font-size:var(--jade-font-size,15px)}
:host([position=bottom-left]){right:auto;left:var(--jade-widget-offset,20px)}
.fab{width:56px;height:56px;border-radius:50%;border:0;background:var(--jade-accent);color:var(--jade-accent-fg);cursor:pointer;display:grid;place-items:center;
  box-shadow:0 6px 20px rgb(0 0 0/.22);transition:transform .15s ease;margin-left:auto}
:host([position=bottom-left]) .fab{margin-left:0}
.fab:hover{transform:scale(1.06)}
.dot{position:absolute;top:2px;right:2px;width:12px;height:12px;border-radius:50%;background:var(--jade-danger,#c0392b);border:2px solid var(--jade-bg,#fff)}
.wrap{position:relative;width:56px;height:56px;margin-left:auto}
:host([position=bottom-left]) .wrap{margin-left:0}
.panel{position:absolute;bottom:72px;right:0;width:var(--jade-widget-width,380px);height:var(--jade-widget-height,560px);max-height:calc(100vh - 110px);max-width:calc(100vw - 32px);
  display:flex;flex-direction:column;background:var(--jade-bg,#fff);color:var(--jade-fg);border:1px solid var(--jade-border);border-radius:var(--jade-radius,12px);
  box-shadow:0 18px 50px rgb(0 0 0/.25);overflow:hidden;transform-origin:bottom right;animation:pop .16s ease-out}
:host([position=bottom-left]) .panel{right:auto;left:0;transform-origin:bottom left}
@keyframes pop{from{opacity:0;transform:translateY(8px) scale(.97)}}
header{display:flex;align-items:center;gap:10px;padding:12px 12px 12px 16px;background:var(--jade-accent);color:var(--jade-accent-fg)}
header .t{flex:1;min-width:0}
header h2{margin:0;font-size:1em;font-weight:600;line-height:1.3}
header p{margin:0;font-size:.82em;opacity:.85}
header button{background:transparent;border:0;color:inherit;cursor:pointer;border-radius:8px;padding:6px;display:grid;place-items:center}
header button:hover{background:rgb(255 255 255/.15)}
.body{flex:1;min-height:0;display:flex}
.body>*{flex:1;min-height:0;height:100%}
.loading{margin:auto;color:var(--jade-muted)}
@media (max-width:480px){.panel,:host([position=bottom-left]) .panel{position:fixed;inset:0;width:auto;height:auto;max-height:none;max-width:none;border-radius:0;border:0}
  :host([open]) .wrap{visibility:hidden}}`;
  static observedAttributes = ['open', 'title', 'subtitle', 'label', ...FWD];
  constructor() {
    super();
    this._dot = h('span', { class: 'dot', hidden: true });
    this.fab = h('button', { class: 'fab', part: 'button', type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', onclick: () => this.toggle() }, svg(BUBBLE, 26));
    this._h2 = h('h2', { id: 'jw-title' }); this._sub = h('p', { hidden: true });
    const close = h('button', { type: 'button', 'aria-label': 'Close chat', part: 'close', onclick: () => this.close() }, svg(CLOSE, 20));
    this._body = h('div', { class: 'body' }, h('p', { class: 'loading', text: 'Loading…' }));
    this.panel = h('div', { class: 'panel', part: 'panel', role: 'dialog', 'aria-labelledby': 'jw-title', hidden: true },
      h('header', { part: 'header' }, h('div', { class: 't' }, this._h2, this._sub), h('slot', { name: 'header' }), close), this._body);
    this.shadowRoot.append(this.panel, h('div', { class: 'wrap' }, this.fab, this._dot));
    // Esc closes (caught before the chat sees it), unless a reply is streaming: then Esc stops it as usual
    this.panel.addEventListener('keydown', e => { if (e.key === 'Escape' && !this._chat?.busy) { e.stopPropagation(); e.preventDefault(); this.close(); } }, true);
    this._handler = null; this._chat = null; this._loading = null;
  }
  connectedCallback() { this._sync(); if (this.hasAttribute('open')) this.open(); }
  attributeChangedCallback(n, o, v) {
    if (n === 'open') { if ((v != null) !== this.isOpen) v != null ? this.open() : this.close(); return; }
    this._sync();
  }
  _sync() {
    const title = this.getAttribute('title') || 'Chat with us';
    this._h2.textContent = title; const sub = this.getAttribute('subtitle'); this._sub.textContent = sub || ''; this._sub.hidden = !sub;
    this.fab.setAttribute('aria-label', this.getAttribute('label') || (this.isOpen ? 'Close chat' : `Open chat: ${title}`));
    if (this._chat) for (const a of FWD) { const v = this.getAttribute(a); v == null ? this._chat.removeAttribute(a) : this._chat.setAttribute(a, v); }
  }
  get isOpen() { return !this.panel.hidden; }
  /** the <jade-chat> inside (loaded on first use) → Promise<JadeChat> */
  chat() {
    return (this._loading ||= import('./chat.js').then(() => {
      const c = document.createElement('jade-chat'); c.setAttribute('part', 'chat'); c.setAttribute('exportparts', 'composer, composer-form, composer-input, composer-send');
      c.style.height = '100%'; c.style.border = '0'; c.style.borderRadius = '0';
      if (this._handler) c.handler = this._handler;
      this._chat = c; this._sync(); this._body.replaceChildren(c);
      // a reply that arrives while the panel is closed shows a dot on the button
      c.addEventListener('jade-done', () => { if (!this.isOpen) this._dot.hidden = false; });
      return c;
    }));
  }
  /** answer with any backend: async (text, reply, ctx) => … (see <jade-chat>) */
  get handler() { return this._chat ? this._chat.handler : this._handler; }
  set handler(fn) { this._handler = fn; if (this._chat) this._chat.handler = fn; }
  /** answer with a Jade Agent Kit agent: the same options as <jade-chat>.connect */
  async connect(kit, opts) { return (await this.chat()).connect(kit, { ui: false, ...opts }); }
  async open() {
    if (this.isOpen) return;
    this.panel.hidden = false; this._dot.hidden = true; this.fab.setAttribute('aria-expanded', 'true'); this.fab.replaceChildren(svg(CLOSE, 24));
    if (!this.hasAttribute('open')) this.setAttribute('open', ''); this._sync(); this.emit('jade-open', {});
    const c = await this.chat(); await customElements.whenDefined('jade-chat');
    if (this.isOpen) requestAnimationFrame(() => (c.composer?.focus?.() ?? c.focus?.()));
  }
  close() {
    if (!this.isOpen) return;
    this.panel.hidden = true; this.fab.setAttribute('aria-expanded', 'false'); this.fab.replaceChildren(svg(BUBBLE, 26));
    if (this.hasAttribute('open')) this.removeAttribute('open'); this._sync(); this.emit('jade-close', {}); this.fab.focus();
  }
  toggle() { return this.isOpen ? this.close() : this.open(); }
  /** send a message as the person (opens the panel) */
  async send(text, o) { await this.open(); return (await this.chat()).send(text, o); }
}
define('jade-chat-widget', JadeChatWidget);
export { JadeChatWidget };
