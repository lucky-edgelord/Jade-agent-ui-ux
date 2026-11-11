// <jade-chart>: a chart (line, area, bar, donut, pie, sparkline) for dashboards. Give it rows as JSON or a property:
//   <jade-chart type="bar" x="month" series="signups,paid" format="compact" data='[{"month":"Jan","signups":30,"paid":4}]'></jade-chart>
//   chart.data = rows   ·   chart.options = { stacked: true, horizontal: true, height: 300, format: 'currency:EUR' }
// Series colours come from --jade-chart-1 … --jade-chart-8 (or a palette that follows the theme's accent).
import { JadeElement, define, h } from './base.js';
import { CHART_CSS, drawChart } from './chart-core.js';

const BOOL = ['stacked', 'horizontal'];
class JadeChart extends JadeElement {
  static styles = `:host{display:block;min-width:0}:host([type=sparkline]){display:inline-block}h3{margin:0 0 6px;font-size:.95em;font-weight:600}` + CHART_CSS;
  static observedAttributes = ['type', 'x', 'series', 'data', 'format', 'height', 'width', 'stacked', 'horizontal', 'title', 'legend', 'empty', 'center-label', 'locale'];
  constructor() { super(); this._data = null; this._opts = {}; this._head = h('h3', { part: 'title', hidden: true }); this._box = h('div', { part: 'chart' }); this.shadowRoot.append(this._head, this._box); }
  connectedCallback() { this._draw(); }
  disconnectedCallback() { this._c?.destroy(); this._c = null; }
  attributeChangedCallback() { if (this.isConnected) this._draw(); }
  /** the rows: [{ x: …, series1: 1, … }] (or numbers for a sparkline, or { label: value } for a donut) */
  get data() { return this._data ?? this._attrData(); }
  set data(v) { this._data = v; if (this.isConnected) this._draw(); }
  /** extra options: { stacked, horizontal, height, format, min, max, colors, legend, zero, dots, center, centerLabel } */
  get options() { return this._opts; }
  set options(v) { this._opts = v || {}; if (this.isConnected) this._draw(); }
  _attrData() { try { return JSON.parse(this.getAttribute('data') || '[]'); } catch { return []; } }
  _draw() {
    const a = n => this.getAttribute(n); const title = a('title');
    this._head.textContent = title || ''; this._head.hidden = !title || a('type') === 'sparkline';
    let series = a('series'); if (series) { try { series = JSON.parse(series); } catch { series = series.split(',').map(s => s.trim()).filter(Boolean); } }
    const o = { type: a('type') || 'line', data: this.data, x: a('x') || undefined, series: series || undefined, format: a('format') || undefined, title: title || undefined, empty: a('empty') || undefined,
      height: a('height') ? +a('height') : undefined, width: a('width') ? +a('width') : undefined, centerLabel: a('center-label') || undefined, locale: a('locale') || undefined,
      legend: a('legend') === 'false' ? false : a('legend') === 'true' ? true : undefined, ...Object.fromEntries(BOOL.map(b => [b, this.hasAttribute(b)])), ...this._opts };
    this._c?.destroy(); this._c = drawChart(this._box, o);
  }
}
define('jade-chart', JadeChart);
export { JadeChart };
