// Charts drawn as SVG with the theme's tokens: line, area, bar (grouped or stacked, vertical or horizontal), donut,
// pie and sparkline. Used by <jade-chart> and the surface Chart component. No dependencies.
//   drawChart(el, { type: 'line', data: [{ month: 'Jan', signups: 30, paid: 4 }, …], x: 'month', series: ['signups', 'paid'] })
// Every chart has a screen-reader table of its numbers, a legend (more than one series) and a tooltip on hover/focus.
const NS = 'http://www.w3.org/2000/svg';
export const CHART_CSS = `
.jc{position:relative;display:flex;flex-direction:column;gap:6px;min-width:0;font-variant-numeric:tabular-nums}
.jc svg{display:block;width:100%;overflow:visible}
.jc .ax text{fill:var(--jade-muted);font-size:11px}
.jc .grid line{stroke:var(--jade-border);stroke-width:1}
.jc .zero{stroke:var(--jade-muted);stroke-width:1}
.jc .hl{stroke:var(--jade-muted);stroke-dasharray:3 3;pointer-events:none}
.jc .lg{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:.82em;color:var(--jade-muted)}
.jc .lg span{display:inline-flex;align-items:center;gap:6px}
.jc .lg i{width:10px;height:10px;border-radius:3px;display:inline-block}
.jc .tip{position:absolute;pointer-events:none;background:var(--jade-surface);color:var(--jade-fg);border:1px solid var(--jade-border);border-radius:8px;
  padding:6px 9px;font-size:.8em;box-shadow:0 6px 18px rgb(0 0 0/.14);white-space:nowrap;z-index:2;transform:translate(-50%,calc(-100% - 10px))}
.jc .tip b{display:block;margin-bottom:2px}
.jc .tip i{width:8px;height:8px;border-radius:2px;display:inline-block;margin-right:6px}
.jc .empty{color:var(--jade-muted);font-size:.9em;padding:20px 0;text-align:center}
.jc .sr{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.jc[data-type=sparkline]{display:inline-flex;vertical-align:middle}
.jc .seg{transition:opacity .12s}.jc .seg:hover,.jc .seg:focus{opacity:.8;outline:none}
.jc .donut-c{font-weight:700;fill:var(--jade-fg)}.jc .donut-l{fill:var(--jade-muted);font-size:11px}
`;
/** series colours: --jade-chart-1 … --jade-chart-8, else a palette that works on light and dark */
const FALLBACK = ['var(--jade-accent,#0b7a5b)', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#ec4899', '#64748b'];
export const color = i => `var(--jade-chart-${(i % 8) + 1},${FALLBACK[i % 8]})`;

const el = (tag, attrs = {}, ...kids) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v); e.append(...kids); return e; };
const div = (cls, text) => { const d = document.createElement('div'); if (cls) d.className = cls; if (text != null) d.textContent = text; return d; };

/** a number formatter: number, compact, percent, currency (or currency:EUR), or a function */
export function formatter(f, locale) {
  if (typeof f === 'function') return f;
  const [kind, arg] = String(f || 'number').split(':');
  const nf = kind === 'compact' ? new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 })
    : kind === 'percent' ? new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 })
    : kind === 'currency' ? new Intl.NumberFormat(locale, { style: 'currency', currency: arg || 'USD', maximumFractionDigits: 2 })
    : new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  return v => (v == null || v === '' || Number.isNaN(+v) ? '–' : nf.format(+v));
}
/** round, readable axis ticks from lo to hi */
export function ticks(lo, hi, n = 5) {
  if (lo === hi) { hi = lo + 1; lo = Math.min(0, lo); }
  const raw = (hi - lo) / Math.max(1, n), mag = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || 10 * mag;
  const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step; const out = [];
  for (let v = a; v <= b + step / 2; v += step) out.push(+v.toFixed(10));
  return out;
}
/** normalise options: data as rows, series as [{ key, label, color }] */
export function normalize(o = {}) {
  let data = o.data ?? [];
  if (data && !Array.isArray(data) && typeof data === 'object') data = Object.entries(data).map(([k, v]) => ({ label: k, value: v }));
  data = (Array.isArray(data) ? data : []).map((r, i) => (typeof r === 'number' ? { x: i + 1, value: r } : r)).filter(r => r && typeof r === 'object');
  const first = data[0] || {};
  const x = o.x || ['label', 'name', 'x', 'date', 'month', 'day', 'category'].find(k => k in first) || Object.keys(first).find(k => typeof first[k] !== 'number') || 'x';
  let series = o.series ?? o.y;
  series = (series ? [].concat(series) : Object.keys(first).filter(k => k !== x && typeof first[k] === 'number')).map((s, i) => (typeof s === 'string' ? { key: s } : s)).filter(s => s?.key);
  series = series.map((s, i) => ({ ...s, label: s.label || s.key, color: s.color || color(i) }));
  return { ...o, type: o.type || 'line', data, x, series, fmt: formatter(o.format, o.locale) };
}

/** draw a chart into a container (replaces its content) → { update(opts) } that redraws on resize */
export function drawChart(host, opts) {
  let o = normalize(opts); let w = 0;
  const box = div('jc'); box.dataset.type = o.type; host.replaceChildren(box);
  const paint = () => {
    w = Math.max(60, Math.floor(box.clientWidth || host.clientWidth || 300));
    box.replaceChildren(); box.dataset.type = o.type;
    if (!o.data.length || !o.series.length) { box.append(div('empty', o.empty || 'No data yet.')); return; }
    if (o.type === 'donut' || o.type === 'pie') pie(box, o, w); else if (o.type === 'sparkline') spark(box, o); else cartesian(box, o, w);
    if (o.type !== 'sparkline') box.append(table(o));
  };
  paint();
  let ro = null;
  if (o.type !== 'sparkline' && typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(() => { const nw = Math.floor(box.clientWidth); if (nw && Math.abs(nw - w) > 2) paint(); }); ro.observe(box); }
  return { update(next) { o = normalize({ ...opts, ...next }); opts = { ...opts, ...next }; paint(); }, destroy() { ro?.disconnect(); }, get options() { return o; } };
}

function legend(o) {
  if (o.legend === false || (o.series.length < 2 && o.legend !== true)) return null;
  const l = div('lg'); l.setAttribute('aria-hidden', 'true');
  for (const s of o.series) { const sp = document.createElement('span'); const i = document.createElement('i'); i.style.background = s.color; sp.append(i, s.label); l.append(sp); }
  return l;
}
function table(o) {
  const t = document.createElement('table'); t.className = 'sr';
  if (o.title) { const c = document.createElement('caption'); c.textContent = o.title; t.append(c); }
  const hr = document.createElement('tr'); for (const h of [o.x, ...o.series.map(s => s.label)]) { const th = document.createElement('th'); th.textContent = h; hr.append(th); }
  t.append(hr);
  for (const r of o.data) { const tr = document.createElement('tr'); for (const [i, k] of [o.x, ...o.series.map(s => s.key)].entries()) { const td = document.createElement('td'); td.textContent = i ? o.fmt(r[k]) : String(r[k] ?? ''); tr.append(td); } t.append(tr); }
  return t;
}
function tip(box) { const t = div('tip'); t.hidden = true; box.append(t); return t; }
function fillTip(t, title, rows, x, y) {
  t.replaceChildren(); const b = document.createElement('b'); b.textContent = title; t.append(b);
  for (const [label, val, c] of rows) { const d = div(); const i = document.createElement('i'); i.style.background = c; d.append(i, `${label}: ${val}`); t.append(d); }
  t.style.left = x + 'px'; t.style.top = y + 'px'; t.hidden = false;
}

function cartesian(box, o, W) {
  const H = +o.height || 240, horiz = o.type === 'bar' && o.horizontal, stacked = !!o.stacked && o.type !== 'line';
  const n = o.data.length, X = r => String(r[o.x] ?? '');
  const val = (r, s) => { const v = +r[s.key]; return Number.isFinite(v) ? v : null; };
  let lo = 0, hi = 0;
  for (const r of o.data) {
    if (stacked) { let p = 0, m = 0; for (const s of o.series) { const v = val(r, s) || 0; v >= 0 ? (p += v) : (m += v); } hi = Math.max(hi, p); lo = Math.min(lo, m); }
    else for (const s of o.series) { const v = val(r, s); if (v != null) { hi = Math.max(hi, v); lo = Math.min(lo, v); } }
  }
  if (o.type === 'line' && o.zero === false) { const vs = o.data.flatMap(r => o.series.map(s => val(r, s))).filter(v => v != null); lo = Math.min(...vs); hi = Math.max(...vs); }
  if (o.min != null) lo = +o.min; if (o.max != null) hi = +o.max;
  const tk = ticks(lo, hi, Math.max(2, Math.round(H / 55))); lo = tk[0]; hi = tk[tk.length - 1];
  const fmtAxis = formatter(String(o.format || '').startsWith('currency') || o.format === 'compact' || !o.format ? (o.format || 'compact') : o.format, o.locale);
  const labW = horiz ? Math.min(140, Math.max(...o.data.map(r => X(r).length)) * 6.5 + 10) : Math.max(...tk.map(v => fmtAxis(v).length)) * 6.5 + 10;
  const pad = { l: labW, r: 10, t: 10, b: horiz ? 22 : 26 };
  const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, height: H, role: 'img', 'aria-label': (o.title ? o.title + ': ' : '') + `${o.type} chart of ${o.series.map(s => s.label).join(', ')} by ${o.x}, ${n} points` });
  const vScale = v => (horiz ? pad.l + ((v - lo) / (hi - lo)) * pw : pad.t + ph - ((v - lo) / (hi - lo)) * ph);
  const band = (horiz ? ph : pw) / n, cat = i => (horiz ? pad.t : pad.l) + band * i + band / 2;
  const grid = el('g', { class: 'grid' }), ax = el('g', { class: 'ax' });
  for (const v of tk) {
    const p = vScale(v);
    if (horiz) { grid.append(el('line', { x1: p, x2: p, y1: pad.t, y2: pad.t + ph })); ax.append(el('text', { x: p, y: H - 6, 'text-anchor': 'middle' }, fmtAxis(v))); }
    else { grid.append(el('line', { x1: pad.l, x2: pad.l + pw, y1: p, y2: p })); ax.append(el('text', { x: pad.l - 8, y: p + 4, 'text-anchor': 'end' }, fmtAxis(v))); }
  }
  // category labels, thinned to fit
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor((horiz ? ph / 16 : pw / (Math.max(...o.data.map(r => X(r).length)) * 6.5 + 12))))));
  o.data.forEach((r, i) => { if (i % every) return; const t = X(r); horiz ? ax.append(el('text', { x: pad.l - 8, y: cat(i) + 4, 'text-anchor': 'end' }, t.length > 20 ? t.slice(0, 19) + '…' : t)) : ax.append(el('text', { x: cat(i), y: H - 8, 'text-anchor': 'middle' }, t)); });
  svg.append(grid, ax);
  if (lo < 0) svg.append(horiz ? el('line', { class: 'zero', x1: vScale(0), x2: vScale(0), y1: pad.t, y2: pad.t + ph }) : el('line', { class: 'zero', x1: pad.l, x2: pad.l + pw, y1: vScale(0), y2: vScale(0) }));
  const plot = el('g'); svg.append(plot);
  if (o.type === 'bar') {
    const k = o.series.length, gw = band * 0.72, bw = stacked ? gw : gw / k;
    o.data.forEach((r, i) => {
      let pos = 0, neg = 0;
      o.series.forEach((s, j) => {
        const v = val(r, s); if (v == null) return;
        let a, b; if (stacked) { if (v >= 0) { a = pos; b = pos += v; } else { a = neg; b = neg += v; } } else { a = 0; b = v; }
        const p1 = vScale(Math.min(a, b)), p2 = vScale(Math.max(a, b)), off = cat(i) - gw / 2 + (stacked ? 0 : j * bw);
        const rect = horiz ? el('rect', { x: p1, y: off, width: Math.max(1, p2 - p1), height: Math.max(1, bw - 1), rx: 2 }) : el('rect', { x: off, y: p2, width: Math.max(1, bw - 1), height: Math.max(1, p1 - p2), rx: 2 });
        rect.setAttribute('fill', s.color); plot.append(rect);
      });
    });
  } else {
    o.series.forEach((s, j) => {
      const pts = o.data.map((r, i) => [cat(i), val(r, s)]);
      let base = o.data.map(() => 0);
      if (stacked) { base = o.data.map(r => o.series.slice(0, j).reduce((t, q) => t + (val(r, q) || 0), 0)); pts.forEach((p, i) => { if (p[1] != null) p[1] += base[i]; }); }
      const segs = []; let cur = [];
      pts.forEach(p => { if (p[1] == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push(p); }); if (cur.length) segs.push(cur);
      for (const sg of segs) {
        const d = sg.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${vScale(p[1]).toFixed(1)}`).join('');
        if (o.type === 'area') {
          const back = sg.map(p => [p[0], stacked ? base[pts.indexOf(p)] : Math.max(lo, 0)]).reverse().map(p => `L${p[0].toFixed(1)},${vScale(p[1]).toFixed(1)}`).join('');
          plot.append(el('path', { d: d + back + 'Z', fill: s.color, 'fill-opacity': stacked ? 0.55 : 0.18, stroke: 'none' }));
        }
        plot.append(el('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
        if (sg.length === 1 || (o.dots ?? n <= 24)) for (const p of sg) plot.append(el('circle', { cx: p[0], cy: vScale(p[1]), r: 2.8, fill: s.color }));
      }
    });
  }
  // hover and keyboard: one category at a time
  const hl = el('line', { class: 'hl', visibility: 'hidden' }); svg.append(hl);
  const t = tip(box); svg.setAttribute('tabindex', '0');
  let idx = -1;
  const show = i => {
    idx = Math.max(0, Math.min(n - 1, i)); const r = o.data[idx], c = cat(idx), sc = box.clientWidth / W;
    if (horiz) hl.setAttribute('visibility', 'hidden'); else { hl.setAttribute('x1', c); hl.setAttribute('x2', c); hl.setAttribute('y1', pad.t); hl.setAttribute('y2', pad.t + ph); hl.setAttribute('visibility', 'visible'); }
    const top = Math.min(...o.series.map(s => vScale(val(r, s) ?? lo)));
    fillTip(t, X(r), o.series.map(s => [s.label, o.fmt(val(r, s)), s.color]), (horiz ? pad.l + pw / 2 : c) * sc, (horiz ? c - band / 2 : Math.max(pad.t + 20, top)) * sc);
  };
  const hide = () => { hl.setAttribute('visibility', 'hidden'); t.hidden = true; idx = -1; };
  svg.addEventListener('pointermove', e => { const r = svg.getBoundingClientRect(); const p = horiz ? (e.clientY - r.top) * (H / r.height) - pad.t : (e.clientX - r.left) * (W / r.width) - pad.l; show(Math.floor(p / band)); });
  svg.addEventListener('pointerleave', hide); svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); show(idx + 1); } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); show(idx < 0 ? n - 1 : idx - 1); } else if (e.key === 'Escape') hide(); });
  const lg = legend(o); box.prepend(...[lg].filter(Boolean)); box.append(svg);
  if (o.legendPosition === 'bottom' && lg) box.append(lg);
}

function pie(box, o, W) {
  // one series: each row is a slice; several series and one row: each series is a slice
  const slices = o.series.length === 1 ? o.data.map((r, i) => ({ label: String(r[o.x] ?? ''), v: Math.max(0, +r[o.series[0].key] || 0), c: o.colors?.[i] || color(i) }))
    : o.series.map(s => ({ label: s.label, v: Math.max(0, +o.data[0][s.key] || 0), c: s.color }));
  const total = slices.reduce((t, s) => t + s.v, 0);
  const size = Math.min(W, +o.height || 220), R = size / 2 - 4, r0 = o.type === 'donut' ? R * 0.62 : 0, cx = size / 2, cy = size / 2;
  const svg = el('svg', { viewBox: `0 0 ${size} ${size}`, height: size, style: `max-width:${size}px`, role: 'img', 'aria-label': (o.title ? o.title + ': ' : '') + slices.map(s => `${s.label} ${o.fmt(s.v)}`).join(', ') });
  const t = tip(box); let a = -Math.PI / 2;
  const pt = (ang, rad) => [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)];
  if (!total) { box.append(div('empty', o.empty || 'No data yet.')); return; }
  for (const s of slices) {
    if (!s.v) continue;
    const da = (s.v / total) * Math.PI * 2, b = a + Math.min(da, Math.PI * 2 - 1e-4), big = da > Math.PI ? 1 : 0;
    const [x1, y1] = pt(a, R), [x2, y2] = pt(b, R), [x3, y3] = pt(b, r0), [x4, y4] = pt(a, r0);
    const d = r0 ? `M${x1},${y1}A${R},${R} 0 ${big} 1 ${x2},${y2}L${x3},${y3}A${r0},${r0} 0 ${big} 0 ${x4},${y4}Z` : `M${cx},${cy}L${x1},${y1}A${R},${R} 0 ${big} 1 ${x2},${y2}Z`;
    const seg = el('path', { d, fill: s.c, class: 'seg', tabindex: '0', stroke: 'var(--jade-bg,#fff)', 'stroke-width': 1.5, 'aria-label': `${s.label}: ${o.fmt(s.v)} (${Math.round((s.v / total) * 100)}%)` });
    const mid = (a + b) / 2, sc = () => box.clientWidth ? Math.min(1, box.clientWidth / size) : 1;
    const on = () => { const [mx, my] = pt(mid, (R + r0) / 2); fillTip(t, s.label, [[`${Math.round((s.v / total) * 100)}%`, o.fmt(s.v), s.c]], mx * sc(), my * sc()); };
    seg.addEventListener('pointerenter', on); seg.addEventListener('focus', on); seg.addEventListener('pointerleave', () => (t.hidden = true)); seg.addEventListener('blur', () => (t.hidden = true));
    svg.append(seg); a += da;
  }
  if (r0) { svg.append(el('text', { x: cx, y: cy + 4, 'text-anchor': 'middle', class: 'donut-c', 'font-size': Math.round(R / 4) }, o.center ?? o.fmt(total))); if (o.centerLabel) svg.append(el('text', { x: cx, y: cy + R / 4 + 4, 'text-anchor': 'middle', class: 'donut-l' }, o.centerLabel)); }
  const lg = div('lg'); lg.setAttribute('aria-hidden', 'true');
  for (const s of slices) { const sp = document.createElement('span'); const i = document.createElement('i'); i.style.background = s.c; sp.append(i, `${s.label} ${Math.round((s.v / total) * 100)}%`); lg.append(sp); }
  box.append(svg, lg);
}

function spark(box, o) {
  const s = o.series[0], vals = o.data.map(r => +r[s.key]).filter(Number.isFinite);
  const W = +o.width || 100, H = +o.height || 28; if (vals.length < 2) { box.append(div('empty', '')); return; }
  const lo = Math.min(...vals), hi = Math.max(...vals), sy = v => H - 2 - ((v - lo) / (hi - lo || 1)) * (H - 4), sx = i => 1 + (i / (vals.length - 1)) * (W - 2);
  const d = vals.map((v, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join('');
  const up = vals[vals.length - 1] >= vals[0], c = o.color || s.color || (up ? 'var(--jade-ok,#1f8a5b)' : 'var(--jade-danger,#c0392b)');
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': `${o.title || 'trend'}: from ${o.fmt(vals[0])} to ${o.fmt(vals[vals.length - 1])}` },
    el('path', { d: d + `L${sx(vals.length - 1)},${H}L${sx(0)},${H}Z`, fill: c, 'fill-opacity': 0.12 }), el('path', { d, fill: 'none', stroke: c, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }),
    el('circle', { cx: sx(vals.length - 1), cy: sy(vals[vals.length - 1]), r: 2.2, fill: c }));
  svg.style.width = W + 'px'; box.append(svg);
}
