// Surface components: layout. Each takes the surface's api (see surface.js) and returns an element.
const step = v => `calc(var(--jade-space) * ${Math.max(0, Math.min(8, Number(v) || 0))})`;
const set = (el, k) => v => { if (v == null || v === '') delete el.dataset[k]; else el.dataset[k] = v; };

export default {
  Column(a) { const el = a.h('div', { class: 'col' }); a.bind('gap', v => (el.style.gap = step(v)), 1.5); a.bind('align', set(el, 'align')); a.bind('padding', v => (el.style.padding = v ? step(v) : '')); el.append(...a.kids()); return el; },
  Row(a) {
    const el = a.h('div', { class: 'row' }); a.bind('gap', v => (el.style.gap = step(v)), 1.5); a.bind('align', set(el, 'align')); a.bind('justify', set(el, 'justify'));
    a.bind('wrap', v => set(el, 'wrap')(v === false ? 'no' : null)); el.append(...a.kids()); return el;
  },
  Grid(a) {
    const el = a.h('div', { class: 'grid' });
    const lay = () => { const n = Math.max(1, Math.min(12, Math.round(a.get('columns', 0)) || 0)); const min = Math.max(60, Number(a.get('minWidth', 180)) || 180); const g = step(a.get('gap', 1.5));
      el.style.gap = g; el.style.gridTemplateColumns = n ? `repeat(auto-fill, minmax(max(${min}px, calc((100% - ${n - 1} * ${g}) / ${n})), 1fr))` : `repeat(auto-fill, minmax(min(100%, ${min}px), 1fr))`; };
    a.bind('columns', lay); a.bind('minWidth', lay); a.bind('gap', lay); el.append(...a.kids()); return el;
  },
  Card(a) {
    const el = a.h('section', { class: 'card' }); const head = a.h('div', { class: 'card-h' }); const t = a.h('h3'); const sub = a.h('p'); head.append(t, sub);
    a.bind('title', v => { t.textContent = v ?? ''; t.hidden = !v; head.hidden = !v && !a.get('subtitle'); if (v) el.setAttribute('aria-label', v); });
    a.bind('subtitle', v => { sub.textContent = v ?? ''; sub.hidden = !v; head.hidden = !v && !a.get('title'); });
    a.bind('tone', set(el, 'tone')); a.bind('padding', v => (el.style.padding = step(v)), 2);
    el.append(head, ...a.kids()); return el;
  },
  Tabs(a) {
    const el = a.h('div', { class: 'tabs' }); const list = a.h('div', { role: 'tablist' }); el.append(list);
    const tabs = [].concat(a.get('tabs', [])).filter(t => t && typeof t === 'object'); const bind = a.props.bind;
    const btns = [], panels = [];
    tabs.forEach((t, i) => {
      const id = a.uid(); const b = a.h('button', { type: 'button', role: 'tab', id: id + 't', 'aria-controls': id + 'p', text: String(t.label ?? `Tab ${i + 1}`) });
      const p = a.h('div', { role: 'tabpanel', id: id + 'p', 'aria-labelledby': id + 't', tabIndex: 0 }); p.append(...a.kids(t.children));
      b.addEventListener('click', () => pick(i, true)); btns.push(b); panels.push(p); list.append(b); el.append(p);
    });
    list.addEventListener('keydown', e => { const i = btns.indexOf(e.target); if (i < 0) return; const n = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (n) { e.preventDefault(); const j = (i + n + btns.length) % btns.length; pick(j, true); btns[j].focus(); } });
    function pick(i, user) { btns.forEach((b, k) => { b.setAttribute('aria-selected', k === i); b.tabIndex = k === i ? 0 : -1; panels[k].hidden = k !== i; }); if (user && bind) a.write(bind, i, el); }
    pick(bind ? Math.max(0, Math.min(tabs.length - 1, Number(a.read(bind)) || 0)) : 0);
    if (bind) a.watch(bind, () => pick(Math.max(0, Math.min(tabs.length - 1, Number(a.read(bind)) || 0))), el);
    if (!tabs.length) a.warn('no tabs');
    return el;
  },
  Divider(a) { return a.h('hr', { class: 'div' }); },
  Spacer(a) { const el = a.h('div', { class: 'spacer', 'aria-hidden': 'true' }); a.bind('size', v => { if (v != null) { el.style.flex = 'none'; el.style.width = el.style.height = step(v); } }); return el; },
};
