// <jade-composer>: where the person types. Grows with the text; Enter sends, Shift+Enter is a new line, Escape stops.
// While busy the send button becomes Stop. With `attach`, images can be attached, pasted or dropped.
// Events: jade-submit { text, images: [{ name, type, dataUrl, base64 }] } · jade-stop · jade-attach { files } (other files)
import { JadeElement, define, h, icon } from './base.js';

const readImage = f => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok({ name: f.name, type: f.type, dataUrl: r.result, base64: String(r.result).split(',')[1] }); r.onerror = () => no(r.error); r.readAsDataURL(f); });

class JadeComposer extends JadeElement {
  static styles = `
:host{display:block}
form{display:flex;flex-direction:column;gap:6px;border:1px solid var(--jade-border);background:var(--jade-surface);border-radius:var(--jade-radius);padding:calc(var(--jade-space) * .75);box-shadow:var(--jade-shadow);transition:border-color .15s}
form:focus-within{border-color:var(--jade-accent)}
form.drag{border-style:dashed;border-color:var(--jade-accent)}
.row{display:flex;align-items:flex-end;gap:6px}
textarea{flex:1;border:0;background:transparent;color:inherit;font:inherit;resize:none;outline:none;padding:6px 6px;max-height:40vh;min-height:1.6em;line-height:1.5}
textarea::placeholder{color:var(--jade-muted)}
.send{width:36px;height:36px;padding:0;border-radius:50%;flex:none}
.att{width:36px;height:36px;padding:0;flex:none}
.files{display:flex;flex-wrap:wrap;gap:6px}
.files:empty{display:none}
.chip{position:relative}
.chip img{width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid var(--jade-border);display:block}
.chip button{position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;padding:0;border:1px solid var(--jade-border);background:var(--jade-surface);cursor:pointer;display:grid;place-items:center}
.chip .icon{width:12px;height:12px}
.hint{font-size:.75em;color:var(--jade-muted);padding:0 6px}
`;
  static observedAttributes = ['placeholder', 'busy', 'disabled', 'attach', 'hint'];
  constructor() {
    super(); this.images = [];
    this.ta = h('textarea', { rows: 1, part: 'input', 'aria-label': 'Message', enterKeyHint: 'send' });
    this.files = h('div', { class: 'files', part: 'attachments' });
    this.attBtn = h('button', { class: 'btn ghost att', type: 'button', 'aria-label': 'Attach images', title: 'Attach images', onclick: () => this.picker.click() }, icon('clip'));
    this.picker = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, onchange: e => { this.addFiles(e.target.files); e.target.value = ''; } });
    this.btn = h('button', { class: 'btn primary send', type: 'submit', part: 'send' });
    this.hintEl = h('div', { class: 'hint', part: 'hint' });
    this.form = h('form', { part: 'form', onsubmit: e => { e.preventDefault(); this.busy ? this.stop() : this.submit(); } },
      this.files, h('div', { class: 'row' }, this.attBtn, this.picker, this.ta, this.btn));
    this.shadowRoot.append(this.form, this.hintEl);
    this.ta.addEventListener('input', () => this._grow());
    this.ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !this.hasAttribute('multiline')) { e.preventDefault(); if (!this.busy) this.submit(); }
      else if (e.key === 'Escape' && this.busy) { e.preventDefault(); this.stop(); }
    });
    this.ta.addEventListener('paste', e => { const fs = [...(e.clipboardData?.files || [])]; if (fs.length && this.hasAttribute('attach')) { e.preventDefault(); this.addFiles(fs); } });
    for (const t of ['dragenter', 'dragover']) this.form.addEventListener(t, e => { if (this.hasAttribute('attach') && e.dataTransfer?.types.includes('Files')) { e.preventDefault(); this.form.classList.add('drag'); } });
    for (const t of ['dragleave', 'drop']) this.form.addEventListener(t, () => this.form.classList.remove('drag'));
    this.form.addEventListener('drop', e => { if (this.hasAttribute('attach') && e.dataTransfer?.files.length) { e.preventDefault(); this.addFiles(e.dataTransfer.files); } });
  }
  connectedCallback() { this._sync(); }
  attributeChangedCallback() { this._sync(); }
  _sync() {
    this.ta.placeholder = this.getAttribute('placeholder') ?? 'Message the agent…';
    this.ta.disabled = this.hasAttribute('disabled'); this.attBtn.hidden = !this.hasAttribute('attach');
    const busy = this.busy; this.btn.replaceChildren(icon(busy ? 'stop' : 'send')); this.btn.setAttribute('aria-label', busy ? 'Stop' : 'Send'); this.btn.title = busy ? 'Stop (Esc)' : 'Send (Enter)';
    this.btn.disabled = this.hasAttribute('disabled') && !busy;
    const hint = this.getAttribute('hint'); this.hintEl.textContent = hint ?? ''; this.hintEl.hidden = !hint;
  }
  get busy() { return this.hasAttribute('busy'); }
  set busy(v) { this.toggleAttribute('busy', !!v); }
  get value() { return this.ta.value; }
  set value(v) { this.ta.value = v ?? ''; this._grow(); }
  focus(o) { this.ta.focus(o); }
  _grow() { this.ta.style.height = 'auto'; this.ta.style.height = this.ta.scrollHeight + 'px'; }
  /** attach images (File objects); other files go out as jade-attach */
  async addFiles(list) {
    const files = [...list]; const imgs = files.filter(f => f.type.startsWith('image/')); const other = files.filter(f => !f.type.startsWith('image/'));
    if (other.length) this.emit('jade-attach', { files: other });
    for (const f of imgs) { const im = await readImage(f); this.images.push(im); this._chips(); }
  }
  _chips() {
    this.files.replaceChildren(...this.images.map((im, i) => h('div', { class: 'chip' }, h('img', { src: im.dataUrl, alt: im.name || 'image' }),
      h('button', { type: 'button', 'aria-label': `Remove ${im.name || 'image'}`, onclick: () => { this.images.splice(i, 1); this._chips(); } }, icon('x')))));
  }
  /** send what is typed (emits jade-submit; cancel it to keep the text) */
  submit() {
    const text = this.ta.value.trim(); if (!text && !this.images.length) return false;
    if (!this.emit('jade-submit', { text, images: this.images.slice() })) return false;
    this.value = ''; this.images = []; this._chips(); return true;
  }
  stop() { this.emit('jade-stop', {}); }
}
define('jade-composer', JadeComposer);
export { JadeComposer };
