// Jade Agent UI/UX: web components for AI agents, from a CDN, lazy all the way down. This file is only the loader:
//   import 'https://cdn.jsdelivr.net/gh/lucky-edgelord/Jade-agent-ui-ux@v1.0.0/dist/jade-ui.js';
//   <jade-chat></jade-chat>          ← its module downloads when the tag appears on the page
// Each element's module also works on its own (import '…/dist/chat.js'), and nothing else is fetched until used.
import { setTheme, getTheme, PRESETS, TOKENS } from './theme.js';
export { setTheme, getTheme, PRESETS, TOKENS };
export const VERSION = '1.1.0';

/** every element and the module that defines it */
export const ELEMENTS = {
  'jade-chat': () => import('./chat.js'),
  'jade-message': () => import('./message.js'),
  'jade-composer': () => import('./composer.js'),
  'jade-tool-call': () => import('./tool-call.js'),
  'jade-markdown': () => import('./markdown.js'),
  'jade-code': () => import('./code.js'),
  'jade-surface': () => import('./surface.js'),
  'jade-theme-toggle': () => import('./theme-toggle.js'),
  'jade-auth': () => import('./auth.js'),
  'jade-pricing': () => import('./pricing.js'),
  'jade-account': () => import('./account.js'),
};
const pending = new Map();
/** load elements by tag ('jade-chat', or 'chat'): resolves when they are defined */
export function load(...tags) {
  return Promise.all(tags.flat().map(t => {
    const tag = t.startsWith('jade-') ? t : 'jade-' + t; const f = ELEMENTS[tag];
    if (!f) return Promise.reject(new Error(`unknown element "${t}". Elements: ${Object.keys(ELEMENTS).join(', ')}`));
    if (!pending.has(tag)) pending.set(tag, f().then(() => customElements.whenDefined(tag), e => { pending.delete(tag); throw e; }));
    return pending.get(tag);
  }));
}
const scan = root => { for (const el of root.querySelectorAll?.(':not(:defined)') || []) { const t = el.localName; if (ELEMENTS[t]) load(t).catch(e => console.error('[jade-ui]', e)); } };
let observer = null;
/** define jade-* elements as they appear (started on import; call stopAutoload() to load only with load()) */
export function autoload(root = document) {
  if (observer || typeof MutationObserver === 'undefined') return;
  scan(root);
  observer = new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) { if (ELEMENTS[n.localName]) load(n.localName).catch(() => {}); scan(n); } });
  observer.observe(root.documentElement || root, { childList: true, subtree: true });
}
export function stopAutoload() { observer?.disconnect(); observer = null; }

/** the component catalog for agents (elements, surface components, spec format): loads catalog.js */
export async function catalog() { return (await import('./catalog.js')); }
/** the Jade Agent Base server the account elements use (unless they have a `base` attribute): loads base-client.js */
export async function setBase(url) { (await import('./base-client.js')).setBase(url); }
/** the client for a Jade Agent Base server (sign in, plans, usage, keys, checkout): loads base-client.js */
export async function baseClient(url) { return (await import('./base-client.js')).baseClient(url); }
/** tools for a Jade Agent Kit agent to build UI (ui_render, ui_update, …): loads agent-tools.js */
export async function uiTools(o) { return (await import('./agent-tools.js')).uiTools(o); }

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => autoload(), { once: true }); else autoload();
}
