// <jade-chat>: a complete agent chat. Give it a Jade Agent Kit agent, a handler function, or listen for jade-send.
//   await chat.connect(kit, { brain: true, approve: ['bash', 'write', 'edit'] })   // a kit agent + the UI tools
//   chat.agent = await kit.agent({ … })                                              // or your own kit agent
//   chat.handler = async (text, reply, { images, signal, history }) => { reply.append('…'); }   // any backend
// Streams text and thinking, shows tool calls (and asks before the tools you name), stop, regenerate, edit, retry,
// copy, suggestions, image attachments, and stays at the bottom unless the person scrolls up to read.
import { JadeElement, define, h, icon } from './base.js';
import './message.js';
import './composer.js';

const STICK = 80;   // px from the bottom that still counts as "at the bottom"
class JadeChat extends JadeElement {
  static styles = `
:host{display:flex;flex-direction:column;min-height:0;height:100%;background:var(--jade-bg);color:var(--jade-fg);position:relative;contain:layout}
.log{flex:1;overflow-y:auto;overscroll-behavior:contain;min-height:0;scroll-padding-bottom:16px}
.list{max-width:var(--jade-chat-width,760px);margin:0 auto;padding:calc(var(--jade-space) * 2) calc(var(--jade-space) * 2) calc(var(--jade-space) * 1)}
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:14px;min-height:50%;padding:32px 16px;color:var(--jade-muted)}
.empty h2{margin:0;font-size:1.35em;font-weight:650;color:var(--jade-fg)}
.sugg{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:560px}
.sugg .btn{border-radius:999px;text-align:left}
.foot{padding:0 calc(var(--jade-space) * 2) calc(var(--jade-space) * 2);max-width:var(--jade-chat-width,760px);width:100%;margin:0 auto;position:relative}
.jump{position:absolute;left:50%;transform:translateX(-50%);top:-48px;border-radius:999px;box-shadow:var(--jade-shadow);z-index:2}
.jump[hidden]{display:none}
`;
  static observedAttributes = ['placeholder', 'suggestions', 'greeting', 'attach', 'assistant-name', 'hint'];
  constructor() {
    super();
    this.history = []; this.surfaces = new Map(); this.busy = false; this._agent = null; this.handler = null;
    this._cur = null; this._tools = []; this._always = new Set(); this._asks = new Set(); this._stick = true; this._userAt = 0; this._unseen = 0; this._queue = [];
    this.status = h('div', { class: 'sr', role: 'status', 'aria-live': 'polite' });
    this.list = h('div', { class: 'list', part: 'list' });
    this.emptyEl = h('div', { class: 'empty', part: 'empty' }, h('slot', { name: 'empty' }, h('h2', { class: 'greet' }), h('div', { class: 'sugg', part: 'suggestions' })));
    this.log = h('div', { class: 'log', part: 'log', role: 'log', 'aria-label': 'Conversation', tabIndex: 0 }, this.emptyEl, this.list);
    this.jumpBtn = h('button', { class: 'btn jump', type: 'button', part: 'jump', hidden: true, onclick: () => this.scrollToEnd(true) }, icon('down'), h('span', { text: 'Latest' }));
    this.composer = h('jade-composer', { part: 'composer', exportparts: 'form: composer-form, input: composer-input, send: composer-send' });
    this.shadowRoot.append(h('slot', { name: 'header' }), this.log, h('div', { class: 'foot' }, this.jumpBtn, this.composer), this.status);
    // the person's scroll intent: wheel, touch, keys or dragging the bar mean they want to stay where they put it
    const intent = () => (this._userAt = performance.now());
    this.log.addEventListener('wheel', intent, { passive: true }); this.log.addEventListener('touchmove', intent, { passive: true });
    this.log.addEventListener('pointerdown', e => { if (e.composedPath()[0] === this.log) intent(); }, { passive: true });   // the scrollbar
    this.log.addEventListener('keydown', e => { if (/^(PageUp|PageDown|ArrowUp|ArrowDown|Home|End| )$/.test(e.key) && e.composedPath()[0] === this.log) intent(); });
    this.log.addEventListener('scroll', () => {
      const d = this.log.scrollHeight - this.log.scrollTop - this.log.clientHeight;
      if (d <= STICK) { this._stick = true; this._unseen = 0; } else if (performance.now() - this._userAt < 600) this._stick = false;
      this._jump();
    }, { passive: true });
    new ResizeObserver(() => { if (this._stick) this.log.scrollTop = this.log.scrollHeight; this._jump(); }).observe(this.list);
    this.composer.addEventListener('jade-submit', e => { e.stopPropagation(); this.send(e.detail.text, { images: e.detail.images }).catch(() => {}); });
    this.composer.addEventListener('jade-stop', e => { e.stopPropagation(); this.stop(); });
    this.shadowRoot.addEventListener('jade-regenerate', e => { e.stopPropagation(); this.regenerate(); });
    this.shadowRoot.addEventListener('jade-retry', e => { e.stopPropagation(); this.regenerate(); });
    this.shadowRoot.addEventListener('jade-edit', e => { e.stopPropagation(); this._editUI(e.detail.message); });
    this.shadowRoot.addEventListener('jade-approval-always', e => this._always.add(e.detail.name));
  }
  connectedCallback() { this._sync(); }
  attributeChangedCallback() { this._sync(); }
  _sync() {
    for (const a of ['placeholder', 'attach', 'hint']) { const v = this.getAttribute(a); v == null ? this.composer.removeAttribute(a) : this.composer.setAttribute(a, v); }
    this.$('.greet').textContent = this.getAttribute('greeting') ?? 'How can I help?';
    let s = this._sugg; if (!s) { try { s = JSON.parse(this.getAttribute('suggestions') || '[]'); } catch { s = []; } }
    this.$('.sugg').replaceChildren(...s.map(x => { const t = typeof x === 'string' ? x : x.prompt; return h('button', { class: 'btn', type: 'button', onclick: () => this.send(t).catch(() => {}) }, typeof x === 'string' ? x : x.label || t); }));
    this.emptyEl.hidden = this.list.children.length > 0;
  }
  /** starter prompts: ['Summarize this', { label, prompt }] */
  get suggestions() { return this._sugg || []; }
  set suggestions(v) { this._sugg = v; this._sync(); }

  // ---------- the backend ----------
  /** a Jade Agent Kit agent (or anything with prompt(text, { images }), abort(), messages and onEvent) */
  get agent() { return this._agent; }
  set agent(a) {
    this._agent = a; if (!a) return; import('./tool-call.js');   // agents call tools: fetch the card now, in the background
    if (a.__jadeChat === this) return;
    const prev = a.onEvent; a.onEvent = e => { try { prev?.(e); } catch {} if (a === this._agent) this._event(e); }; a.__jadeChat = this;
  }
  /**
   * Make a kit agent for this chat: kit.agent(opts) plus approvals and (ui: true, the default) the UI tools.
   * @param {object} kit  a Jade Agent Kit (createKit())
   * @param {{ approve?: true|string[], ui?: boolean|object, brain?: any, plugins?: object[] } & object} [opts]  other options go to kit.agent()
   */
  async connect(kit, { approve, ui = true, plugins = [], ...opts } = {}) {
    const ps = [...plugins];
    if (approve) ps.push(this.approval(approve));
    if (ui) { const t = await (await import('./agent-tools.js')).uiTools({ chat: this, ...(typeof ui === 'object' ? ui : {}) }); (await kit.use('tools')).addAll(t.defs); ps.push(t.plugin); this.ui = t; }
    this.agent = await kit.agent({ ...opts, plugins: ps }); return this.agent;
  }
  /** an agent plugin that asks the person before the tools named (true: every tool). Pass it in kit.agent({ plugins }) */
  approval(tools = true) {
    const needs = n => !this._always.has(n) && (tools === true || [].concat(tools).includes(n));
    return { name: 'approval', beforeTool: async (agent, { name, args }) => {
      if (!needs(name)) return null;
      const card = [...this._tools].reverse().find(t => t.name === name) || this._cur?.tool(name, args); if (!card) return null;
      const ask = card.ask(); this._asks.add(card); this._say(`The agent wants to run ${name}. Allow or deny.`);
      const ok = await ask; this._asks.delete(card);
      return ok ? null : 'Error: the user denied this tool call. Do not retry it; ask the user what to do instead.';
    } };
  }

  // ---------- messages ----------
  /** add a message: { role, content, name, images, kind } → the jade-message element */
  addMessage({ role = 'assistant', content = '', name, images, kind } = {}) {
    const m = h('jade-message', { role, part: 'message', exportparts: 'bubble, text, thinking, actions, name, error, note' });
    if (name || (role === 'assistant' && this.getAttribute('assistant-name'))) m.setAttribute('name', name || this.getAttribute('assistant-name'));
    if (kind) m.setAttribute('kind', kind);
    this.list.append(m); this.emptyEl.hidden = true;
    if (images?.length) m.setImages(images); if (content) m.setText(content);
    if (!this._stick) { this._unseen++; this._jump(); }
    return m;
  }
  get messages() { return [...this.list.querySelectorAll('jade-message')]; }
  /** remove every message (and reset the agent's conversation) */
  clear() { this.stop(); this.list.replaceChildren(); this.history = []; this.surfaces.clear(); this._agent?.reset?.(); this._sync(); }
  scrollToEnd(smooth) { this._stick = true; this._unseen = 0; this.log.scrollTo({ top: this.log.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); this._jump(); }
  _jump() { const away = !this._stick && this.log.scrollHeight - this.log.scrollTop - this.log.clientHeight > STICK; this.jumpBtn.hidden = !away; this.jumpBtn.querySelector('span').textContent = this._unseen ? `${this._unseen} new` : 'Latest'; }
  _say(t) { this.status.textContent = ''; setTimeout(() => (this.status.textContent = t), 50); }
  _marks() {
    const ms = this.messages; const lastA = ms.findLast(m => m.role === 'assistant'), lastU = ms.findLast(m => m.role === 'user' && m.getAttribute('kind') !== 'action');
    for (const m of ms) { m.setAttribute('actions', m === lastA ? 'copy regenerate' : m === lastU ? 'copy edit' : 'copy'); m.toggleAttribute('last', m === lastA); }
  }

  // ---------- running ----------
  /**
   * Send a message and run the agent. Resolves with the reply's text.
   * @param {string} text  @param {{ images?: Array<{dataUrl, base64}|string>, kind?: 'action', display?: string }} [o]
   */
  send(text, o = {}) {
    if (this.busy) return new Promise((ok, no) => this._queue.push({ text, o, ok, no }));
    const imgs = (o.images || []).map(i => typeof i === 'string' ? { dataUrl: i, base64: i.split(',')[1] ?? i } : i);
    const user = this.addMessage({ role: 'user', content: o.display ?? text, images: imgs.map(i => i.dataUrl), kind: o.kind });
    user.text0 = text; user.imgs0 = imgs; this.scrollToEnd();
    return this._run(text, imgs, user);
  }
  async _run(text, imgs, user) {
    const m = this.addMessage({ role: 'assistant' }).begin(); this._cur = m; this._tools = []; this.busy = true; this.composer.busy = true;
    this.toggleAttribute('busy', true); this._marks(); this._say('The assistant is responding.'); this._ctrl = new AbortController();
    this.emit('jade-run', { text, message: m });
    let out = '', err = null, stopped = false;
    try {
      if (this._agent) out = await this._agent.prompt(text, imgs.length ? { images: imgs.map(i => i.base64) } : undefined);
      else if (this.handler) {
        const r = await this.handler(text, this._reply(m), { images: imgs, signal: this._ctrl.signal, history: this.history.slice() });
        out = typeof r === 'string' ? r : m.text; if (typeof r === 'string' && !m.text) m.setText(r);
      } else {
        const fin = new Promise(ok => m.addEventListener('jade-finish', e => ok(e.detail), { once: true }));
        if (this.emit('jade-send', { text, images: imgs, reply: m, signal: this._ctrl.signal })) throw new Error('No agent is connected. Set chat.agent, chat.handler, or handle jade-send.');
        const d = await Promise.race([fin, new Promise(ok => this._ctrl.signal.addEventListener('abort', () => ok({ text: m.text }), { once: true }))]); out = d.text;
      }
      stopped = this._ctrl.signal.aborted || out === '(stopped)';
      if (out === '(stopped)') out = m.text;
      else if (out && !m.text && !this._tools.length) m.setText(out);
      this.history.push({ role: 'user', content: text }, { role: 'assistant', content: m.text || out });
    } catch (e) { err = e; }
    await Promise.allSettled(this._tools.map(t => t.ready));
    for (const t of this._tools) if (t.el.status === 'running') stopped ? t.fail('stopped') : null;
    if (!m.hasAttribute('aria-busy') || m.getAttribute('aria-busy') === 'true') err ? m.fail(err) : m.finish({ stopped });
    this.busy = false; this.composer.busy = false; this.removeAttribute('busy'); this._cur = null; this._marks();
    this._say(err ? 'The assistant hit an error.' : stopped ? 'Stopped.' : 'The assistant replied.');
    this.emit('jade-done', { text: m.text, message: m, error: err, stopped });
    const next = this._queue.shift(); if (next) this.send(next.text, next.o).then(next.ok, next.no);
    if (err) throw err; return m.text;
  }
  /** what a handler writes with: append, thinking, tool, surface, setText, meta, message, signal */
  _reply(m) {
    const self = this;
    return { message: m, signal: this._ctrl.signal, append: d => m.append(d), thinking: d => m.thinking(d), setText: t => m.setText(t), meta: t => m.meta(t),
      tool(name, args) { const t = m.tool(name, args); self._tools.push(t); return t; }, surface: (spec, name) => m.surface(spec, name), finish: o => m.finish(o) };
  }
  /** a kit agent event → the current reply */
  _event(e) {
    const m = this._cur; if (!m) return;
    switch (e.type) {
      case 'thinking': m.thinking(e.delta); break;
      case 'text': m.append(e.delta); break;
      case 'tool_call': { const t = m.tool(e.name, e.args); this._tools.push(t); this.emit('jade-tool', { name: e.name, args: e.args }); break; }
      case 'tool_result': { const t = this._tools.find(x => x.name === e.name && !x.settled); if (t) { t.settled = true; t.done(e.result); } break; }
      case 'route': m.meta(e.model); break;
    }
  }
  /** stop the run (and deny any pending approval) */
  stop() {
    if (!this.busy) return; this._ctrl?.abort();
    for (const t of this._asks) t.answer(false); this._asks.clear();
    this._agent?.abort?.();
    for (const q of this._queue.splice(0)) q.no(new DOMException('stopped', 'AbortError'));
  }
  /** answer the last message again */
  async regenerate() { const u = this._trimToLastUser(); if (u) return this._run(u.text0 ?? u.text, u.imgs0 || [], u); }
  /** change the last message the person sent and run again */
  async edit(text) { const u = this._trimToLastUser(); if (!u) return; u.text0 = text; u.setText(text); return this._run(text, u.imgs0 || [], u); }
  _trimToLastUser() {
    if (this.busy) this.stop(); const ms = this.messages; const u = ms.findLast(m => m.role === 'user'); if (!u) return null;
    for (const m of ms.slice(ms.indexOf(u) + 1)) m.remove();
    const a = this._agent; if (a?.messages) { const i = a.messages.findLastIndex(x => x.role === 'user'); if (i >= 0) a.messages.length = i; }
    const j = this.history.findLastIndex(x => x.role === 'user'); if (j >= 0) this.history.length = j;
    return u;
  }
  _editUI(m) {
    if (this.busy) return; this.composer.value = m.text0 ?? m.text; this.composer.focus();
    const done = e => { if (!e.detail.text) return; e.preventDefault(); e.stopImmediatePropagation(); this.composer.value = ''; this.edit(e.detail.text).catch(() => {}); };
    this.composer.addEventListener('jade-submit', done, { once: true, capture: true });
  }
}
define('jade-chat', JadeChat);
export { JadeChat };
