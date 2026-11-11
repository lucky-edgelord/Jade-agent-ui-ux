// Surface components: showing data. Lists and tables re-draw when their bound data changes.
const fmt = v => v == null ? '' : typeof v === 'number' ? v.toLocaleString() : typeof v === 'object' ? JSON.stringify(v) : String(v);

export default {
  Stat(a) {
    const el = a.h('div', { class: 'stat' }); const l = a.h('div', { class: 'l' }), v = a.h('div', { class: 'v' }), d = a.h('div', { class: 'd' }), hp = a.h('div', { class: 'h' });
    el.append(l, v, d, hp);
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
    const el = a.h('div', { class: 'tbl', tabIndex: 0, role: 'region' });
    const paint = () => {
      const rows = [].concat(a.get('rows', []) ?? []).filter(r => r && typeof r === 'object');
      let cols = a.get('columns'); cols = Array.isArray(cols) && cols.length ? cols.map(c => (typeof c === 'string' ? { key: c, label: c } : c)) : Object.keys(rows[0] || {}).map(k => ({ key: k, label: k }));
      if (!rows.length) { el.replaceChildren(a.h('div', { class: 'empty', style: 'padding:10px', text: a.get('empty', 'No rows.') })); return; }
      const al = c => ({ end: 'end', right: 'end', center: 'center' })[c.align] || (rows.every(r => typeof r[c.key] === 'number' || r[c.key] == null) ? 'end' : null);
      const t = a.h('table'); const hr = a.h('tr'); for (const c of cols) hr.append(a.h('th', { scope: 'col', 'data-align': al(c), text: String(c.label ?? c.key) }));
      const tb = a.h('tbody'); for (const r of rows.slice(0, 500)) { const tr = a.h('tr'); for (const c of cols) tr.append(a.h('td', { 'data-align': al(c), text: fmt(r[c.key]) })); tb.append(tr); }
      t.append(a.h('thead', {}, hr), tb); el.replaceChildren(t); el.setAttribute('aria-label', `Table, ${rows.length} rows`);
    };
    a.bind('rows', paint); a.bind('columns', paint); return el;
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
