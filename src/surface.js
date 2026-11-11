// <jade-surface name="…">: UI an agent builds from a declarative spec (the shape of Google's A2UI, simplified):
//   surface.render({
//     root: 'root',
//     components: [
//       { id: 'root', component: 'Card', props: { title: 'Sign up' }, children: ['email', 'go'] },
//       { id: 'email', component: 'TextField', props: { label: 'Email', bind: '/form/email', type: 'email', required: true } },
//       { id: 'go', component: 'Button', props: { label: 'Join', variant: 'primary', action: { name: 'join', data: { email: { $data: '/form/email' } } } } },
//     ],
//     data: { form: { email: '' } },
//   })
// Components come only from the catalog (components.js); no HTML, script or style from the spec ever reaches the page.
// Values bind to the data model: { "$data": "/path" } or "text with {{/path}}"; inputs write to it ("bind"). Buttons
// send actions: a jade-action event { surface, name, data, values } (and surface.onaction).
// Each group of components (layout, content, inputs, data) downloads the first time a spec uses it.
import { JadeElement, define, h, icon } from './base.js';
import { COMPONENTS, COMMON } from './components.js';
import { renderMarkdown, enhance, MD_CSS, safeHref, safeSrc, esc } from './markdown.js';

const GROUPS = { layout: () => import('./surface/layout.js'), content: () => import('./surface/content.js'), inputs: () => import('./surface/inputs.js'), data: () => import('./surface/data.js'), charts: () => import('./surface/charts.js') };
const cache = {}, loading = {};
const loadGroup = g => (loading[g] ||= GROUPS[g]().then(m => (cache[g] = m.default), e => { delete loading[g]; throw e; }));
const LIMIT = 1000, DEPTH = 32;
let uid = 0;

// ---------- data paths: "/a/b/0" or "a.b.0" ----------
export const keys = p => String(p ?? '').replace(/^\$item\/?/, '').split(/[/.]/).filter(Boolean).map(k => k.replace(/~1/g, '/').replace(/~0/g, '~'));
export const getPath = (o, p) => keys(p).reduce((v, k) => (v == null ? undefined : Object.prototype.hasOwnProperty.call(Object(v), k) ? v[k] : undefined), o);
export function setPath(o, p, val) {
  const ks = keys(p); if (!ks.length) return val; let cur = o;
  for (let i = 0; i < ks.length - 1; i++) { const k = ks[i]; if (k === '__proto__' || k === 'constructor' || k === 'prototype') return o; if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = /^\d+$/.test(ks[i + 1]) ? [] : {}; cur = cur[k]; }
  const last = ks[ks.length - 1]; if (last !== '__proto__' && last !== 'constructor' && last !== 'prototype') cur[last] = val; return o;
}
const norm = p => '/' + keys(p).join('/');
const related = (a, b) => a === b || a.startsWith(b === '/' ? '/' : b + '/') || b.startsWith(a === '/' ? '/' : a + '/') || a === '/' || b === '/';
const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
function merge(a, b) { if (!b || typeof b !== 'object' || Array.isArray(b)) return b; const o = a && typeof a === 'object' && !Array.isArray(a) ? a : {}; for (const [k, v] of Object.entries(b)) if (k !== '__proto__' && k !== 'constructor') o[k] = merge(o[k], v); return o; }
const isBinding = v => v && typeof v === 'object' && !Array.isArray(v) && typeof v.$data === 'string';
const TPL = /\{\{\s*([^}]+?)\s*\}\}/g;

class JadeSurface extends JadeElement {
  static styles = `
:host{display:block;container-type:inline-size}
.root{display:block}
.col{display:flex;flex-direction:column}
.row{display:flex;flex-wrap:wrap}.row[data-wrap=no]{flex-wrap:nowrap}
.col[data-align=start]{align-items:flex-start}.col[data-align=center]{align-items:center}.col[data-align=end]{align-items:flex-end}
.row{align-items:center}.row[data-align=start]{align-items:flex-start}.row[data-align=end]{align-items:flex-end}.row[data-align=stretch]{align-items:stretch}.row[data-align=baseline]{align-items:baseline}
.row[data-justify=center]{justify-content:center}.row[data-justify=end]{justify-content:flex-end}.row[data-justify=between]{justify-content:space-between}.row[data-justify=around]{justify-content:space-around}
.grid{display:grid}
.card{border:1px solid var(--jade-border);background:var(--jade-surface);border-radius:var(--jade-radius);display:flex;flex-direction:column;gap:calc(var(--jade-space) * 1.5);min-width:0}
.card[data-tone=accent]{border-color:var(--jade-accent)}.card[data-tone=ok]{border-color:var(--jade-ok)}.card[data-tone=warn]{border-color:var(--jade-warn)}.card[data-tone=danger]{border-color:var(--jade-danger)}
.card-h h3{margin:0;font-size:1.05em;font-weight:650}.card-h p{margin:2px 0 0;color:var(--jade-muted);font-size:.9em}
hr.div{border:0;border-top:1px solid var(--jade-border);margin:calc(var(--jade-space) * .5) 0;width:100%}
.spacer{flex:1 1 auto}
.tabs [role=tablist]{display:flex;gap:2px;border-bottom:1px solid var(--jade-border);overflow-x:auto}
.tabs [role=tab]{border:0;background:none;padding:8px 14px;cursor:pointer;color:var(--jade-muted);border-bottom:2px solid transparent;margin-bottom:-1px;white-space:nowrap}
.tabs [role=tab][aria-selected=true]{color:var(--jade-fg);border-bottom-color:var(--jade-accent);font-weight:600}
.tabs [role=tabpanel]{padding-top:calc(var(--jade-space) * 1.5);display:flex;flex-direction:column;gap:calc(var(--jade-space) * 1.5)}
.hd{margin:0;line-height:1.25;font-weight:650}h1.hd{font-size:1.6em}h2.hd{font-size:1.3em}h3.hd{font-size:1.1em}h4.hd{font-size:1em}
.txt[data-size=sm]{font-size:.88em}.txt[data-size=lg]{font-size:1.12em}.txt[data-muted]{color:var(--jade-muted)}.txt[data-align=center]{text-align:center}.txt[data-align=end]{text-align:end}
.badge{display:inline-flex;align-items:center;padding:1px 9px;border-radius:999px;font-size:.8em;font-weight:600;background:var(--jade-surface-2);color:var(--jade-fg);border:1px solid var(--jade-border);width:fit-content}
[data-tone=accent].badge{background:var(--jade-accent);color:var(--jade-accent-fg);border-color:transparent}
[data-tone=ok].badge{color:var(--jade-ok);border-color:currentColor}[data-tone=warn].badge{color:var(--jade-warn);border-color:currentColor}[data-tone=danger].badge{color:var(--jade-danger);border-color:currentColor}
.img{max-width:100%;display:block}.img[data-rounded]{border-radius:var(--jade-radius)}
.alert{display:flex;gap:10px;padding:10px 12px;border-radius:calc(var(--jade-radius) * .75);border:1px solid var(--jade-border);background:var(--jade-surface-2)}
.alert .icon{margin-top:3px;flex:none}.alert strong{display:block}
.alert[data-tone=ok]{border-color:var(--jade-ok)}.alert[data-tone=warn]{border-color:var(--jade-warn)}.alert[data-tone=danger]{border-color:var(--jade-danger)}
.alert[data-tone=ok] .icon{color:var(--jade-ok)}.alert[data-tone=warn] .icon{color:var(--jade-warn)}.alert[data-tone=danger] .icon{color:var(--jade-danger)}.alert[data-tone=info] .icon{color:var(--jade-accent)}
a.link{color:var(--jade-accent)}
.field{display:flex;flex-direction:column;gap:4px;min-width:0}
.row>.field{flex:1 1 200px}
.field>label,.field legend{font-size:.88em;font-weight:600}
.field .req{color:var(--jade-danger);margin-left:2px}
.field .help{font-size:.8em;color:var(--jade-muted)}
.field .bad{font-size:.8em;color:var(--jade-danger)}
.in{font:inherit;color:inherit;background:var(--jade-bg);border:1px solid var(--jade-border);border-radius:calc(var(--jade-radius) * .6);padding:7px 10px;width:100%;min-height:36px}
.in:focus{outline:2px solid var(--jade-focus);outline-offset:0;border-color:transparent}
.in[aria-invalid=true]{border-color:var(--jade-danger)}
textarea.in{resize:vertical}
fieldset.field{border:0;padding:0;margin:0}
.opt,.chk{display:flex;align-items:center;gap:8px;cursor:pointer;min-height:28px}
.opt input,.chk input{accent-color:var(--jade-accent);width:16px;height:16px}
.sw{appearance:none;width:36px!important;height:20px!important;border-radius:999px;background:var(--jade-border);position:relative;cursor:pointer;transition:background .15s;flex:none}
.sw::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .15s}
.sw:checked{background:var(--jade-accent)}.sw:checked::after{transform:translateX(16px)}
input[type=range]{accent-color:var(--jade-accent);width:100%}
.rng{display:flex;justify-content:space-between;font-size:.8em;color:var(--jade-muted)}
.btn[data-full]{width:100%}
.card>.btn:not([data-full]),.col>.btn:not([data-full]){align-self:flex-start}
.stat{display:flex;flex-direction:column;gap:2px;min-width:0}
.stat .l{font-size:.82em;color:var(--jade-muted)}.stat .v{font-size:1.6em;font-weight:700;line-height:1.2;font-variant-numeric:tabular-nums}
.stat .d{font-size:.85em;font-weight:600}.stat[data-tone=ok] .d{color:var(--jade-ok)}.stat[data-tone=danger] .d{color:var(--jade-danger)}.stat[data-tone=warn] .d{color:var(--jade-warn)}.stat .h{font-size:.8em;color:var(--jade-muted)}
.prog{display:flex;flex-direction:column;gap:4px}.prog .lb{display:flex;justify-content:space-between;font-size:.85em}
.bar{height:8px;border-radius:999px;background:var(--jade-surface-2);overflow:hidden}.bar i{display:block;height:100%;background:var(--jade-accent);border-radius:inherit;transition:width .25s}
.bar[data-ind] i{width:35%!important;animation:ind 1.3s ease-in-out infinite}@keyframes ind{from{transform:translateX(-100%)}to{transform:translateX(290%)}}
.tblw{display:flex;flex-direction:column;gap:8px;min-width:0}.tbl-q{font:inherit;padding:6px 10px;border:1px solid var(--jade-border);border-radius:8px;background:var(--jade-surface);color:var(--jade-fg);max-width:260px}
.tbl-p{display:flex;align-items:center;gap:10px;justify-content:flex-end;font-size:.85em;color:var(--jade-muted)}
.tbl th .sort{all:unset;cursor:pointer;display:inline-flex;gap:2px;font-weight:600}.tbl th .sort:focus-visible{outline:2px solid var(--jade-focus);outline-offset:2px}.tbl th .ar{font-size:.75em;color:var(--jade-muted)}
.tbl .badge[data-tone=ok]{background:color-mix(in srgb,var(--jade-ok) 15%,transparent);color:var(--jade-ok)}.tbl .badge[data-tone=warn]{background:color-mix(in srgb,var(--jade-warn) 15%,transparent);color:var(--jade-warn)}.tbl .badge[data-tone=danger]{background:color-mix(in srgb,var(--jade-danger) 15%,transparent);color:var(--jade-danger)}
.stat .vr{display:flex;align-items:flex-end;justify-content:space-between;gap:10px}.stat .sp{flex:none}
.chart{min-width:0}.chart-t{margin:0 0 6px;font-size:.95em;font-weight:600}
.tbl{overflow-x:auto;border:1px solid var(--jade-border);border-radius:calc(var(--jade-radius) * .6)}
.tbl table{border-collapse:collapse;width:100%;font-size:.92em}
.tbl th,.tbl td{padding:7px 10px;border-bottom:1px solid var(--jade-border);text-align:start;vertical-align:top}
.tbl tr:last-child td{border-bottom:0}.tbl th{background:var(--jade-surface-2);font-weight:600;white-space:nowrap}
.tbl [data-align=end]{text-align:end;font-variant-numeric:tabular-nums}.tbl [data-align=center]{text-align:center}
.lst{margin:0;padding-left:1.4em;display:flex;flex-direction:column;gap:4px}.lst.tpl{list-style:none;padding:0;gap:calc(var(--jade-space))}
.empty{color:var(--jade-muted);font-size:.9em}
.kv{display:grid;grid-template-columns:max-content 1fr;gap:4px 16px;margin:0}.kv dt{color:var(--jade-muted)}.kv dd{margin:0;min-width:0;overflow-wrap:anywhere}
.bad-c{border:1px dashed var(--jade-danger);color:var(--jade-danger);padding:6px 10px;border-radius:8px;font-size:.85em;font-family:var(--jade-mono)}
.code{margin:0}
` + MD_CSS;
  static observedAttributes = ['name'];
  constructor() {
    super(); this._c = new Map(); this.model = {}; this.rootId = 'root'; this._binds = []; this._fields = []; this.result = null; this.onaction = null;
    this.box = h('div', { class: 'root', part: 'root' }); this.shadowRoot.append(this.box);
  }
  /** the surface's name (agents address surfaces by name) */
  get name() { return this.getAttribute('name') || ''; }
  set name(v) { this.setAttribute('name', v); }
  /** the data model (a copy) */
  get data() { return clone(this.model); }
  /** the spec as it stands: { root, components, data } */
  get spec() { return { root: this.rootId, components: [...this._c.values()].map(clone), data: this.data }; }
  getData(path) { return clone(getPath(this.model, path)); }
  /** change the data model; bound components update */
  setData(path, value, source) {
    const p = norm(path); if (p === '/') this.model = value && typeof value === 'object' ? value : {}; else setPath(this.model, p, value);
    this._changed(p, source); this.emit('jade-change', { surface: this.name, path: p, value: clone(value) });
  }
  /**
   * Replace everything with a spec → { ok, warnings, count }
   * @param {{ root?: string, components: Array<{ id: string, component: string, props?: object, children?: string[] }>, data?: object }} spec
   */
  async render(spec = {}) {
    if (!spec || typeof spec !== 'object') return this._done({ warnings: ['spec must be an object'], count: 0 });
    this._c.clear(); this.model = clone(spec.data) || {};
    for (const c of [].concat(spec.components || [])) if (c && typeof c.id === 'string') this._c.set(c.id, c);
    this.rootId = spec.root || (this._c.has('root') ? 'root' : [...this._c.keys()][0]);
    return this._paint();
  }
  /**
   * Change part of it → { ok, warnings, count }
   * @param {{ components?: object[], remove?: string[], data?: object | Array<{ path, value }>, root?: string }} patch
   *   components: added, or replacing those with the same id. data: merged into the model, or set path by path.
   */
  async update({ components, remove, data, root } = {}) {
    let repaint = false;
    for (const c of [].concat(components || [])) if (c && typeof c.id === 'string') { this._c.set(c.id, c); repaint = true; }
    for (const id of [].concat(remove || [])) repaint = this._c.delete(id) || repaint;
    if (root && root !== this.rootId) { this.rootId = root; repaint = true; }
    if (Array.isArray(data)) for (const d of data) { const p = norm(d.path); p === '/' ? (this.model = d.value || {}) : setPath(this.model, p, clone(d.value)); if (!repaint) this._changed(p); }
    else if (data && typeof data === 'object') { this.model = merge(this.model, clone(data)); if (!repaint) this._changed('/'); }
    return repaint ? this._paint() : this._done({ warnings: [], count: this.result?.count ?? 0 });
  }
  clear() { this._c.clear(); this.model = {}; this.box.replaceChildren(); this._binds = []; this._fields = []; this.result = null; }
  _done(r) { r.ok = !r.warnings.length; this.result = r; return r; }
  async _paint() {
    const warnings = [];
    const groups = new Set(); for (const c of this._c.values()) { const d = COMPONENTS[c.component]; if (d) groups.add(d.group); }
    await Promise.all([...groups].map(loadGroup));
    const focus = this.shadowRoot.activeElement?.closest?.('[data-id]')?.dataset.id;
    this._binds = []; this._fields = [];
    const ctx = { warnings, count: 0, stack: new Set(), used: new Set() };
    const node = this.rootId ? this._build(this.rootId, ctx, null, 0) : null;
    if (!this.rootId) warnings.push('no components');
    for (const id of this._c.keys()) if (!ctx.used.has(id) && !this._templates().has(id)) warnings.push(`component "${id}" is not reachable from the root "${this.rootId}"`);
    this.box.replaceChildren(...(node ? [node] : []));
    if (focus) this.box.querySelector(`[data-id="${CSS.escape(focus)}"] :is(input,textarea,select,button)`)?.focus({ preventScroll: true });
    this.emit('jade-render', { surface: this.name, warnings });
    return this._done({ warnings, count: ctx.count });
  }
  _templates() { const s = new Set(); for (const c of this._c.values()) if (c.component === 'List' && c.props?.template) s.add(c.props.template); return s; }
  /** a value from the spec: literal, {"$data": path} or a string with {{path}} */
  _value(v, scope) {
    if (isBinding(v)) return clone(getPath(this._root(v.$data, scope), this._abs(v.$data, scope)));
    if (typeof v === 'string' && v.includes('{{')) return v.replace(TPL, (_, p) => { if (p === '$index') return scope ? String(scope.index) : ''; const x = getPath(this._root(p, scope), this._abs(p, scope)); return x == null ? '' : typeof x === 'object' ? JSON.stringify(x) : String(x); });
    if (Array.isArray(v)) return v.map(x => this._value(x, scope));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, this._value(x, scope)]));
    return v;
  }
  _root() { return this.model; }
  _abs(p, scope) { p = String(p).trim(); if (p.startsWith('$item')) return norm((scope?.base || '') + '/' + p.slice(5)); return norm(p); }
  _deps(v, scope, out = []) {
    if (isBinding(v)) out.push(this._abs(v.$data, scope));
    else if (typeof v === 'string' && v.includes('{{')) for (const m of v.matchAll(TPL)) { if (m[1] !== '$index') out.push(this._abs(m[1], scope)); }
    else if (v && typeof v === 'object') for (const x of Object.values(v)) this._deps(x, scope, out);
    return out;
  }
  _changed(path, source) {
    this._binds = this._binds.filter(b => b.owner.isConnected || !b.owner.__built);
    for (const b of this._binds.slice()) if (!(source != null && b.source === source) && b.deps.some(d => related(d, path))) { try { b.run(); } catch (e) { console.warn('[jade-surface]', e); } }
  }
  _build(id, ctx, scope, depth) {
    if (ctx.count >= LIMIT) { if (ctx.count === LIMIT) ctx.warnings.push(`more than ${LIMIT} components; the rest are not shown`); ctx.count++; return null; }
    if (depth > DEPTH) { ctx.warnings.push(`nesting deeper than ${DEPTH} at "${id}"`); return null; }
    if (ctx.stack.has(id)) { ctx.warnings.push(`"${id}" contains itself`); return null; }
    const c = this._c.get(id); ctx.used.add(id);
    if (!c) { ctx.warnings.push(`no component with id "${id}"`); return null; }
    const def = COMPONENTS[c.component];
    if (!def) { ctx.warnings.push(`unknown component "${c.component}" (id "${id}"). Components: ${Object.keys(COMPONENTS).join(', ')}`); return h('div', { class: 'bad-c', text: `Unknown component: ${c.component}` }); }
    const props = c.props && typeof c.props === 'object' ? c.props : {};
    for (const k of Object.keys(props)) if (!def.props[k] && !COMMON[k]) ctx.warnings.push(`${c.component} "${id}" has no prop "${k}" (props: ${Object.keys(def.props).join(', ') || 'none'})`);
    for (const [k, p] of Object.entries(def.props)) if (p.required && props[k] == null) ctx.warnings.push(`${c.component} "${id}" needs "${k}"`);
    if (c.children?.length && !def.children) ctx.warnings.push(`${c.component} "${id}" does not take children`);
    ctx.count++; ctx.stack.add(id);
    const self = this; const owner = { isConnected: false, __built: false };
    const api = {
      id, h, icon, esc, md: renderMarkdown, enhance, safeHref, safeSrc, scope, surface: this, props,
      /** a prop's current value */
      get: (name, fallback) => { const v = self._value(props[name], scope); return v ?? fallback; },
      /** call fn with a prop's value now and whenever its data changes */
      bind(name, fn, fallback) { const run = () => fn(self._value(props[name], scope) ?? fallback); run(); const deps = self._deps(props[name], scope); if (deps.length) self._binds.push({ deps, run, owner }); },
      /** call fn when data under `path` changes (not for changes this element made itself) */
      watch(path, fn, source) { self._binds.push({ deps: [self._abs(path, scope)], run: fn, owner, source }); },
      read: path => clone(getPath(self.model, self._abs(path, scope))),
      write: (path, v, source) => self.setData(self._abs(path, scope), v, source),
      kids: (ids = c.children) => [].concat(ids || []).map(k => self._build(k, ctx, scope, depth + 1)).filter(Boolean),
      build: (cid, sc) => self._build(cid, ctx, sc, depth + 1),
      field: f => self._fields.push(f),
      act: (action, el) => self._act(action, scope, el),
      uid: () => 'j' + (++uid),
      warn: m => ctx.warnings.push(`${c.component} "${id}": ${m}`),
    };
    let el;
    const impl = cache[def.group] && Object.prototype.hasOwnProperty.call(cache[def.group], c.component) ? cache[def.group][c.component] : null;
    try { el = impl ? impl(api) : null; }
    catch (e) { ctx.warnings.push(`${c.component} "${id}" failed: ${e.message}`); el = h('div', { class: 'bad-c', text: `${c.component}: ${e.message}` }); }
    ctx.stack.delete(id);
    if (!el) return null;
    el.dataset.id = id; el.setAttribute('part', 'c ' + c.component.toLowerCase());
    if (props.visible !== undefined) api.bind('visible', v => (el.hidden = !v), true);
    Object.defineProperty(owner, 'isConnected', { get: () => this.box.contains(el) }); owner.__built = true;
    return el;
  }
  _act(action, scope, el) {
    const a = typeof action === 'string' ? { name: action } : action || {}; if (!a.name) return;
    if (a.validate !== false) {
      const bad = this._fields.filter(f => this.box.contains(f.el) && !f.el.closest('[hidden]') && f.required && f.empty());
      for (const f of this._fields) f.invalid?.(bad.includes(f));
      if (bad.length) { bad[0].focus(); this.emit('jade-invalid', { surface: this.name, fields: bad.map(f => f.label) }); return; }
    }
    const detail = { surface: this.name, name: a.name, data: this._value(a.data ?? null, scope), values: this.data };
    if (el) { el.disabled = true; setTimeout(() => { el.disabled = false; }, 600); }
    this.emit('jade-action', detail); try { this.onaction?.(detail); } catch (e) { console.error(e); }
  }
}
define('jade-surface', JadeSurface);
export { JadeSurface, COMPONENTS };
