// Surface components: charts (SVG, drawn with the theme). Redrawn when their bound data changes.
import { CHART_CSS, drawChart } from '../chart-core.js';
export default {
  Chart(a) {
    const el = a.h('div', { class: 'chart' }); const head = a.h('h3', { class: 'chart-t' }); const box = a.h('div'); el.append(head, box);
    // CSS for charts lives with them, so the surface stylesheet stays small
    const st = a.h('style'); st.textContent = CHART_CSS; el.append(st);
    let c = null;
    const paint = () => {
      const t = a.get('title'); head.textContent = t || ''; head.hidden = !t;
      const o = {}; for (const k of ['type', 'x', 'series', 'format', 'height', 'stacked', 'horizontal', 'min', 'max', 'empty', 'legend', 'centerLabel']) { const v = a.get(k); if (v != null) o[k] = v; }
      o.data = a.get('data', []); o.title = t;
      if (c) c.update(o); else c = drawChart(box, o);
    };
    for (const k of ['data', 'type', 'series', 'title', 'x']) a.bind(k, paint);
    requestAnimationFrame(() => c?.update({}));   // measure again once it is in the page
    return el;
  },
};
