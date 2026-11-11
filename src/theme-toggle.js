// <jade-theme-toggle>: cycles auto → light → dark and remembers the choice (per browser). Add `presets` to also pick
// a preset: <jade-theme-toggle presets></jade-theme-toggle>
import { JadeElement, define, h, icon } from './base.js';
import { setTheme, getTheme, PRESETS } from './theme.js';

const KEY = 'jade-ui-theme';
const NEXT = { auto: 'light', light: 'dark', dark: 'auto' };
const LABEL = { auto: 'Theme: match the system', light: 'Theme: light', dark: 'Theme: dark' };
class JadeThemeToggle extends JadeElement {
  static styles = `:host{display:inline-flex;gap:6px;align-items:center}select{font:inherit;font-size:.9em;color:var(--jade-fg);background:var(--jade-surface);border:1px solid var(--jade-border);border-radius:8px;padding:4px 6px}`;
  constructor() {
    super();
    this.btn = h('button', { class: 'btn ghost', type: 'button', part: 'button', onclick: () => this.set({ mode: NEXT[getTheme().mode || 'auto'] }) });
    this.sel = h('select', { part: 'select', 'aria-label': 'Theme preset', onchange: () => this.set({ preset: this.sel.value }) }, PRESETS.map(p => h('option', { value: p, text: p[0].toUpperCase() + p.slice(1) })));
    this.shadowRoot.append(this.sel, this.btn);
    document.addEventListener('jade-theme', () => this._paint());
  }
  connectedCallback() {
    this.sel.hidden = !this.hasAttribute('presets');
    if (!JadeThemeToggle.restored) { JadeThemeToggle.restored = true; let saved = null; try { saved = JSON.parse(localStorage.getItem(KEY)); } catch {} if (saved) setTheme(saved).catch(() => {}); }
    this._paint();
  }
  async set(o) { const t = await setTheme(o); try { localStorage.setItem(KEY, JSON.stringify({ preset: t.preset, mode: t.mode })); } catch {} }
  _paint() { const t = getTheme(); const m = t.mode || 'auto'; this.btn.replaceChildren(icon(m === 'auto' ? 'auto' : m === 'light' ? 'sun' : 'moon')); this.btn.title = this.btn.ariaLabel = LABEL[m]; this.btn.setAttribute('aria-label', LABEL[m]); this.sel.value = t.preset || 'jade'; }
}
define('jade-theme-toggle', JadeThemeToggle);
export { JadeThemeToggle };
