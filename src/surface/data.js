// Surface components: showing data. Lists and tables re-draw when their bound data changes.
import { formatter, drawChart } from '../chart-core.js';
const fmt = v => v == null ? '' : typeof v === 'number' ? v.toLocaleString() : typeof v === 'object' ? JSON.stringify(v) : String(v);
/** a column's format: number, compact, percent, currency[:EUR], date, datetime, or text */
const cellFormat = f => f === 'date' || f === 'datetime' ? (v => { if (v == null || v === '') return ''; const d = new Date(v); return Number.isNaN(+d) ? String(v) : f === 'date' ? d.toLocaleDateString() : d.toLocaleString(); }) : /^(number|compact|percent|currency)/.test(f) ? formatter(f) : fmt;

export default {
  Stat(a) {
    const el = a.h('div', { class: 'stat' }); const l = a.h('div', { class: 'l' }), v = a.h('div', { class: 'v' }), d = a.h('div', { class: 'd' }), hp = a.h('div', { class: 'h' });
    const sp = a.h('div', { class: 'sp' }); el.append(l, a.h('div', { class: 'vr' }, v, sp), d, hp);
    a.bind('spark', x => { sp.hidden = !Array.isArray(x) || x.length < 2; if (!sp.hidden) drawChart(sp, { type: 'sparkline', data: x, title: a.get('label'), width: 90, height: 28 }); });
    a.bind('label', x => (l.textContent = x ?? '')); a.bind('value', x => (v.textContent = fmt(x)));
    a.bind('delta', x => { d.textContent = x ?? ''; d.hidden = !x; }); a.bind('help', x => { hp.textContent = x ?? ''; hp.hidden = !x; });
    a.bind('tone', x => { if (x) el.dataset.tone = x; else { const s = String(a.get('delta', '')); el.dataset.tone = /^\s*[+▲↑]/.test(s) ? 'ok' : /^\s*[-−▼↓]/.test(s) ? 'danger' : ''; } });
    return el;
  },
  Progress(a) {
    const el = a.h('div', { class: 'prog' }); const lb = a.h('div', { class: 'lb' }); const name = a.h('span'), pct = a.h('span'); lb.append(name, pct);
    const bar = a.h('div', { class: 'bar', role: 'progressbar' }); const fill = a.h('i'); bar.append(fill); el.append(lb, bar);
    const paint = () => {
      const max = Math.max(1, +a.get('max', 100) || 100); const raw = a.get('value'); const lab = a.get('label', '');
      name.textContent = lab; bar.setAttribute('aria-label', lab || 'Progress'); lb.hidden = !lab && raw == null;
      if (raw == null || raw === '') { bar.dataset.ind = ''; bar.removeAttribute('aria-valuenow'); pct.textContent = ''; return; }
      delete bar.dataset.ind; const v = Math.max(0, Math.min(max, +raw || 0)); const p = Math.round((v / max) * 100);
      fill.style.width = p + '%'; pct.textContent = p + '%'; bar.setAttribute('aria-valuemin', 0); bar.setAttribute('aria-valuemax', max); bar.setAttribute('aria-valuenow', v);
    };
    a.bind('value', paint); a.bind('max', paint); a.bind('label', paint); return el;
  },
  Table(a) {
    // sort by a header click (sortable: false turns it off), a search box (search: true), pages (pageSize)
    const el = a.h('div', { class: 'tblw' }); const scroll = a.h('div', { class: 'tbl', tabIndex: 0, role: 'region' });
    const q = a.h('input', { type: 'search', class: 'tbl-q', placeholder: 'Search…', 'aria-label': 'Search the table' });
    const pager = a.h('div', { class: 'tbl-p' }); let sortKey = null, dir = 1, page = 0, query = '';
    q.addEventListener('input', () => { query = q.value.trim().toLowerCase(); page = 0; paint(); });
    const paint = () => {
      const all = [].concat(a.get('rows', []) ?? []).filter(r => r && typeof r === 'object');
      let cols = a.get('columns'); cols = Array.isArray(cols) && cols.length ? cols.map(c => (typeof c === 'string' ? { key: c, label: c } : c)) : Object.keys(all[0] || {}).map(k => ({ key: k, label: k }));
      q.hidden = !a.get('search'); const sortable = a.get('sortable', true) !== false; const size = Math.max(0, +a.get('pageSize', 0) || 0);
      let rows = query ? all.filter(r => cols.some(c => String(r[c.key] ?? '').toLowerCase().includes(query))) : all;
      if (sortKey != null) rows = rows.slice().sort((x, y) => { const p = x[sortKey], r = y[sortKey]; return (p == null) - (r == null) || (typeof p === 'number' && typeof r === 'number' ? p - r : String(p ?? '').localeCompare(String(r ?? ''), undefined, { numeric: true })) * dir; });
      const pages = size ? Math.max(1, Math.ceil(rows.length / size)) : 1; page = Math.min(page, pages - 1);
      const shown = size ? rows.slice(page * size, page * size + size) : rows.slice(0, 500);
      if (!rows.length) scroll.replaceChildren(a.h('div', { class: 'empty', style: 'padding:10px', text: query ? 'No rows match.' : a.get('empty', 'No rows.') }));
      else {
        const al = c => ({ end: 'end', right: 'end', center: 'center' })[c.align] || (all.every(r => typeof r[c.key] === 'number' || r[c.key] == null) ? 'end' : null);
        const fm = c => (c.format ? cellFormat(c.format) : fmt);
        const t = a.h('table'); const hr = a.h('tr');
        for (const c of cols) {
          const th = a.h('th', { scope: 'col', 'data-align': al(c) }); const label = String(c.label ?? c.key);
          if (sortable && c.sortable !== false) {
            const on = sortKey === c.key; th.setAttribute('aria-sort', on ? (dir > 0 ? 'ascending' : 'descending') : 'none');
            th.append(a.h('button', { type: 'button', class: 'sort', onclick: () => { if (sortKey === c.key) dir = -dir; else { sortKey = c.key; dir = 1; } page = 0; paint(); } }, label, a.h('span', { 'aria-hidden': 'true', class: 'ar', text: on ? (dir > 0 ? ' ▲' : ' ▼') : '' })));
          } else th.textContent = label;
          hr.append(th);
        }
        const tb = a.h('tbody'); for (const r of shown) { const tr = a.h('tr'); for (const c of cols) { const v = r[c.key]; const td = a.h('td', { 'data-align': al(c) }); if (c.format === 'badge') td.append(a.h('span', { class: 'badge', 'data-tone': (c.tones || {})[v] || '', text: fmt(v) })); else td.textContent = fm(c)(v); tr.append(td); } tb.append(tr); }
        t.append(a.h('thead', {}, hr), tb); scroll.replaceChildren(t); scroll.setAttribute('aria-label', `Table, ${rows.length} rows`);
      }
      pager.hidden = pages < 2; pager.replaceChildren();
      if (pages > 1) pager.append(a.h('button', { type: 'button', class: 'btn', disabled: page === 0, onclick: () => { page--; paint(); } }, 'Previous'), a.h('span', { 'aria-live': 'polite', text: `Page ${page + 1} of ${pages}` }), a.h('button', { type: 'button', class: 'btn', disabled: page >= pages - 1, onclick: () => { page++; paint(); } }, 'Next'));
    };
    el.append(q, scroll, pager); a.bind('rows', paint); a.bind('columns', paint); return el;
  },
  List(a) {
    const tpl = a.props.template; const el = a.h(a.get('ordered') ? 'ol' : 'ul', { class: 'lst' + (tpl ? ' tpl' : '') });
    const src = a.props.items; const base = src && typeof src === 'object' && typeof src.$data === 'string' ? src.$data : null;
    const paint = () => {
      const items = a.get('items', []); const arr = Array.isArray(items) ? items : [];
      if (!arr.length) { el.replaceChildren(a.h('li', { class: 'empty', style: 'list-style:none', text: a.get('empty', 'Nothing here yet.') })); return; }
      el.replaceChildren(...arr.slice(0, 500).map((it, i) => {
        const li = a.h('li');
        if (tpl && base) { const n = a.build(tpl, { base: '/' + String(base).replace(/^\//, '') + '/' + i, index: i }); if (n) li.append(n); }
        else if (tpl) { a.warn('a template needs items bound to data ({"$data": "/path"})'); li.textContent = fmt(it); }
        else if (typeof it === 'string') { li.innerHTML = a.md(it).replace(/^<p>([\s\S]*)<\/p>$/, '$1'); a.enhance(li); }
        else li.textContent = fmt(it);
        return li;
      }));
    };
    a.bind('items', paint); return el;
  },
  KeyValue(a) {
    const el = a.h('dl', { class: 'kv' });
    a.bind('items', v => {
      const items = Array.isArray(v) ? v : v && typeof v === 'object' ? Object.entries(v).map(([key, value]) => ({ key, value })) : [];
      el.replaceChildren(...items.flatMap(it => [a.h('dt', { text: fmt(it?.key) }), a.h('dd', { text: fmt(it?.value) })]));
    }, []);
    return el;
  },
};
