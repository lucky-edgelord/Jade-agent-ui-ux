// Theming: design tokens as CSS custom properties (--jade-*). They cross shadow DOM, so every component reads them.
//   setTheme({ preset: 'midnight', mode: 'dark', density: 'compact', radius: 6, tokens: { accent: '#e11d48' } })
//   setTheme({ … , target: el })   theme one part of the page only
// The default preset ("jade") is built in; the others download the first time they are used (themes/*.js).
const KEYS = ['bg', 'surface', 'surface-2', 'fg', 'muted', 'border', 'accent', 'accent-fg', 'user', 'user-fg', 'code',
  'ok', 'warn', 'danger', 'syn-k', 'syn-s', 'syn-n', 'syn-c'];
export const TOKENS = [...KEYS, 'radius', 'space', 'font', 'mono', 'font-size', 'shadow', 'focus'];
/** the built-in preset: [light, dark] */
const JADE = [
  ['#f7faf8', '#ffffff', '#eef4f1', '#15201b', '#5d6d66', '#dbe5e0', '#0b7a5b', '#ffffff', '#e3f3ec', '#15201b', '#f0f4f2', '#1f8a5b', '#a8650f', '#c0392b', '#0b6e99', '#9a3f1c', '#7a4bb3', '#6a7d74'],
  ['#0e1411', '#141c18', '#1b2520', '#e4ede8', '#93a69c', '#26332d', '#3ddc97', '#062012', '#183326', '#e4ede8', '#111915', '#3ddc97', '#f2c14e', '#ff6b6b', '#76c4ee', '#f0a47e', '#c8a4f0', '#7f9489'],
];
export const PRESETS = ['jade', 'midnight', 'paper', 'contrast'];
const LOADERS = { midnight: () => import('./themes/midnight.js'), paper: () => import('./themes/paper.js'), contrast: () => import('./themes/contrast.js') };
const DENSITY = { compact: 6, cozy: 8, comfortable: 10 };
const state = new Map();   // target → current options
let uid = 0, applied = false;

const toVars = (arr) => Object.fromEntries(KEYS.map((k, i) => [k, arr[i]]));
function css(sel, light, dark, o) {
  const shared = { radius: (o.radius ?? 12) + 'px', space: (DENSITY[o.density] || DENSITY.cozy) + 'px',
    font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    'font-size': '15px', shadow: '0 1px 2px rgb(0 0 0 / .06), 0 4px 16px rgb(0 0 0 / .06)', focus: 'var(--jade-accent)', ...(o.shared || {}) };
  const block = (vars, scheme) => `${sel}{${Object.entries({ ...shared, ...vars, ...(o.tokens || {}) }).map(([k, v]) => `--jade-${k}:${v};`).join('')}color-scheme:${scheme}}`;
  if (o.mode === 'light') return block(light, 'light');
  if (o.mode === 'dark') return block(dark, 'dark');
  return block(light, 'light') + `@media (prefers-color-scheme:dark){${block(dark, 'dark')}}`;
}
async function presetVars(name) {
  if (!name || name === 'jade') return JADE.map(toVars);
  if (!LOADERS[name]) throw new Error(`unknown theme preset "${name}". Presets: ${PRESETS.join(', ')}`);
  return (await LOADERS[name]()).default.map(toVars);
}
/**
 * Apply a theme to the page (or to `target` and what is inside it). Options merge with the current ones.
 * @param {{ preset?: string, mode?: 'auto'|'light'|'dark', density?: 'compact'|'cozy'|'comfortable', radius?: number,
 *           tokens?: Record<string,string>, target?: Element }} o
 */
export async function setTheme(o = {}) {
  const target = o.target || document.documentElement; const prev = state.get(target) || { preset: 'jade', mode: 'auto' };
  const next = { ...prev, ...o, tokens: o.tokens === null ? undefined : { ...(prev.tokens || {}), ...(o.tokens || {}) } }; delete next.target;
  for (const k of Object.keys(next.tokens || {})) if (!TOKENS.includes(k)) throw new Error(`unknown token "${k}". Tokens: ${TOKENS.join(', ')}`);
  const [light, dark] = await presetVars(next.preset);
  let sel = ':root';
  if (target !== document.documentElement) { target.dataset.jadeTheme ||= String(++uid); sel = `[data-jade-theme="${target.dataset.jadeTheme}"]`; }
  const id = 'jade-theme' + (sel === ':root' ? '' : '-' + target.dataset.jadeTheme);
  let el = document.getElementById(id); if (!el) { el = document.createElement('style'); el.id = id; document.head.prepend(el); }
  el.textContent = css(sel, light, dark, next); state.set(target, next); applied = true;
  if (target === document.documentElement) document.documentElement.dataset.jadeMode = next.mode;
  document.dispatchEvent(new CustomEvent('jade-theme', { detail: { ...next, target } }));
  return next;
}
/** the current theme options (of the page, or of `target`) */
export const getTheme = (target = document.documentElement) => ({ ...(state.get(target) || { preset: 'jade', mode: 'auto' }) });
/** components call this: the default theme, unless the page already set one (or styles --jade-* itself) */
export function ensureTheme() {
  if (applied || typeof document === 'undefined') return; applied = true;
  if (getComputedStyle(document.documentElement).getPropertyValue('--jade-accent')) return;
  const el = document.createElement('style'); el.id = 'jade-theme'; el.textContent = css(':root', ...JADE.map(toVars), {}); document.head.prepend(el);
}
