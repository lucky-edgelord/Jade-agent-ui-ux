// The base of every element: an open shadow root with constructable styles, events that cross shadow DOM, small helpers.
import { ensureTheme } from './theme.js';

const sheets = new WeakMap();
/** styles every element shares: tokens with fallbacks, focus ring, reduced motion */
export const BASE_CSS = `
:host{box-sizing:border-box;font-family:var(--jade-font,system-ui,sans-serif);font-size:var(--jade-font-size,15px);color:var(--jade-fg,#15201b);line-height:1.55}
:host([hidden]),[hidden]{display:none!important}
*,*::before,*::after{box-sizing:inherit}
:focus-visible{outline:2px solid var(--jade-focus,#0b7a5b);outline-offset:2px}
button{font:inherit;color:inherit}
.sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--jade-border);background:var(--jade-surface);color:var(--jade-fg);
  border-radius:calc(var(--jade-radius,12px) * .66);padding:calc(var(--jade-space,8px) * .6) calc(var(--jade-space,8px) * 1.5);cursor:pointer;font-size:.92em;line-height:1.3;min-height:32px}
.btn:hover{background:var(--jade-surface-2)}
.btn.primary{background:var(--jade-accent);color:var(--jade-accent-fg);border-color:transparent}
.btn.primary:hover{filter:brightness(1.07)}
.btn.danger{background:var(--jade-danger);color:#fff;border-color:transparent}
.btn.ghost{background:transparent;border-color:transparent}
.btn.ghost:hover{background:var(--jade-surface-2)}
.btn:disabled{opacity:.5;cursor:not-allowed}
.icon{width:1.1em;height:1.1em;flex:none}
@media (prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}
`;
export class JadeElement extends HTMLElement {
  /** the element's own CSS (added after BASE_CSS) */
  static styles = '';
  constructor() {
    super(); ensureTheme();
    const C = this.constructor; let s = sheets.get(C);
    if (!s) { s = new CSSStyleSheet(); s.replaceSync(BASE_CSS + C.styles); sheets.set(C, s); }
    this.attachShadow({ mode: 'open' }).adoptedStyleSheets = [s];
  }
  /** dispatch a CustomEvent that bubbles out of shadow roots; false if a listener called preventDefault() */
  emit(type, detail) { return this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true, cancelable: true })); }
  $(sel) { return this.shadowRoot.querySelector(sel); }
}
/** define once (a second copy of the library on the page is harmless) */
export function define(tag, cls) { if (!customElements.get(tag)) customElements.define(tag, cls); return cls; }
/** build DOM without innerHTML: h('button', { class: 'btn', onclick }, 'text', child) */
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v;
    else if (!tag.includes('-') && k in el && !k.includes('-') && k !== 'list' && k !== 'form') el[k] = v; else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}
/** inline SVG icons (stroke icons, 24 grid) */
const P = {
  send: 'M5 12h14M13 6l6 6-6 6', stop: 'M7 7h10v10H7z', copy: 'M9 9h10v10H9zM5 15V5h10', check: 'M5 12l5 5 9-10',
  retry: 'M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4', edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4', down: 'M12 5v14M6 13l6 6 6-6',
  clip: 'M16 8l-6.5 6.5a2 2 0 0 0 2.8 2.8L19 10.6a4 4 0 0 0-5.7-5.7L6.6 11.6a6 6 0 0 0 8.5 8.5L20 15', x: 'M6 6l12 12M18 6L6 18',
  tool: 'M14 6a4 4 0 0 0 5 5l-8 8a2 2 0 0 1-3-3l8-8a4 4 0 0 1-2-2z', chev: 'M9 6l6 6-6 6', sun: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z', auto: 'M12 3a9 9 0 1 0 0 18zM12 3a9 9 0 0 1 0 18', alert: 'M12 8v5M12 16.5v.5M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z',
};
export function icon(name) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'icon'); s.setAttribute('aria-hidden', 'true');
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', P[name] || ''); s.append(p); return s;
}
/** copy text, with a fallback for pages without clipboard permission */
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  try { const t = h('textarea', { value: text }); t.style.cssText = 'position:fixed;opacity:0'; document.body.append(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return ok; } catch { return false; }
}
