// <jade-code lang="js">…</jade-code>: a code block with a copy button and highlighting (the highlighter loads with it).
import { JadeElement, define } from './base.js';
import { MD_CSS, esc, enhance } from './markdown.js';

class JadeCode extends JadeElement {
  static styles = `:host{display:block}.code{margin:0}` + MD_CSS;
  static observedAttributes = ['lang', 'code'];
  constructor() { super(); this._c = null; }
  connectedCallback() { if (this._c == null) this.code = this.getAttribute('code') ?? this.textContent.replace(/^\n/, '').replace(/\n\s*$/, ''); }
  attributeChangedCallback(n, o, v) { if (n === 'code') this.code = v ?? ''; else this.render(); }
  /** the source code */
  get code() { return this._c ?? ''; }
  set code(v) { this._c = String(v ?? ''); this.render(); }
  get lang() { return this.getAttribute('lang') || ''; }
  set lang(v) { this.setAttribute('lang', v); }
  render() {
    if (this._c == null) return; const l = this.lang.toLowerCase();
    this.shadowRoot.innerHTML = `<div class="code" part="code"><div class="code-bar" part="bar"><span>${esc(l || 'text')}</span><button type="button" class="copy" aria-label="Copy code">Copy</button></div><pre data-lang="${esc(l)}"><code>${esc(this._c)}</code></pre></div>`;
    enhance(this.shadowRoot);
  }
}
define('jade-code', JadeCode);
export { JadeCode };
