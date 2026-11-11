// The components an agent may use on a <jade-surface>: names, props and what they mean. Data only: the surface uses it
// to validate a spec, the catalog to describe it to models. Each group's code downloads when a spec first uses it.
// Prop types: string, number, boolean, array, object, action, path (a data model path like "/form/email"), id[] (child ids).
const S = (description, extra) => ({ type: 'string', description, ...extra });
const N = (description, extra) => ({ type: 'number', description, ...extra });
const B = description => ({ type: 'boolean', description });
const E = (values, description) => ({ type: 'string', enum: values, description });
const TONE = E(['neutral', 'accent', 'ok', 'warn', 'danger'], 'colour of the status');
const GAP = N('space between children, in theme spacing steps (0-8, default 1.5)');
const OPTIONS = { type: 'array', description: 'choices: strings, or { value, label }' };

/** props every component accepts */
export const COMMON = {
  visible: B('show or hide; usually a binding like {"$data": "/showDetails"}'),
};
export const COMPONENTS = {
  // layout
  Column: { group: 'layout', children: true, description: 'Stacks children vertically.', props: { gap: GAP, align: E(['stretch', 'start', 'center', 'end'], 'horizontal alignment'), padding: N('inner space in spacing steps') } },
  Row: { group: 'layout', children: true, description: 'Places children side by side; wraps on small screens unless wrap is false.', props: { gap: GAP, align: E(['center', 'start', 'end', 'stretch', 'baseline'], 'vertical alignment'), justify: E(['start', 'center', 'end', 'between', 'around'], 'horizontal distribution'), wrap: B('wrap to new lines (default true)') } },
  Grid: { group: 'layout', children: true, description: 'A responsive grid of equal columns (fewer on narrow screens).', props: { columns: N('columns on wide screens (default: as many as fit)'), minWidth: N('narrowest a column may get, in px (default 180)'), gap: GAP } },
  Card: { group: 'layout', children: true, description: 'A bordered panel, optionally with a title.', props: { title: S('heading'), subtitle: S('smaller text under the title'), tone: TONE, padding: N('inner space in spacing steps (default 2)') } },
  Tabs: { group: 'layout', children: false, description: 'Tabs; each tab shows its own children.', props: { tabs: { type: 'array', description: '[{ "label": "Details", "children": ["id1", "id2"] }]', required: true }, bind: { type: 'path', description: 'keep the selected tab index in the data model' } } },
  Divider: { group: 'layout', description: 'A horizontal rule.', props: {} },
  Spacer: { group: 'layout', description: 'Empty space; in a Row it pushes the next items to the end.', props: { size: N('spacing steps (default: fill the row)') } },
  // content
  Heading: { group: 'content', description: 'A heading.', props: { text: S('the heading', { required: true }), level: N('1 (largest) to 4, default 2') } },
  Text: { group: 'content', description: 'Text with markdown (bold, lists, links, code).', props: { text: S('markdown', { required: true }), size: E(['sm', 'md', 'lg'], 'default md'), muted: B('secondary colour'), align: E(['start', 'center', 'end'], 'alignment') } },
  Badge: { group: 'content', description: 'A small status label.', props: { text: S('label', { required: true }), tone: TONE } },
  Image: { group: 'content', description: 'An image (https or data:image URLs only).', props: { src: S('URL', { required: true }), alt: S('description for screen readers', { required: true }), width: N('px'), height: N('px'), fit: E(['cover', 'contain'], 'how it fills width x height'), rounded: B('round the corners') } },
  Code: { group: 'content', description: 'A code block with copy and highlighting.', props: { code: S('source', { required: true }), lang: S('language, e.g. js, py, sh, sql, json') } },
  Alert: { group: 'content', description: 'A highlighted message.', props: { title: S('bold first line'), text: S('markdown'), tone: E(['info', 'ok', 'warn', 'danger'], 'default info') } },
  Link: { group: 'content', description: 'A link that opens in a new tab (http, https or mailto).', props: { text: S('link text', { required: true }), href: S('URL', { required: true }) } },
  // inputs and actions
  Button: { group: 'inputs', description: 'A button that sends an action back to the agent (and your app).', props: { label: S('text', { required: true }), action: { type: 'action', description: '"name" or { "name", "data": {…}, "validate": true }. validate (default true) checks required fields first', required: true }, variant: E(['primary', 'secondary', 'ghost', 'danger'], 'default secondary'), disabled: B('greyed out'), full: B('full width') } },
  TextField: { group: 'inputs', description: 'A one-line input bound to the data model.', props: { label: S('label', { required: true }), bind: { type: 'path', description: 'where the value lives, e.g. "/form/email"', required: true }, type: E(['text', 'email', 'number', 'url', 'tel', 'password', 'date', 'time', 'datetime-local', 'search'], 'default text'), placeholder: S('hint inside the field'), required: B('must be filled before an action'), help: S('small text under the field'), min: N('number/date minimum'), max: N('number/date maximum') } },
  TextArea: { group: 'inputs', description: 'A multi-line input bound to the data model.', props: { label: S('label', { required: true }), bind: { type: 'path', description: 'data path', required: true }, rows: N('visible lines (default 4)'), placeholder: S('hint'), required: B('must be filled'), help: S('small text under it') } },
  Select: { group: 'inputs', description: 'A dropdown bound to the data model.', props: { label: S('label', { required: true }), bind: { type: 'path', description: 'data path', required: true }, options: { ...OPTIONS, required: true }, placeholder: S('text when nothing is chosen'), required: B('must be chosen') } },
  RadioGroup: { group: 'inputs', description: 'One choice out of a few, bound to the data model.', props: { label: S('label', { required: true }), bind: { type: 'path', description: 'data path', required: true }, options: { ...OPTIONS, required: true }, required: B('must be chosen') } },
  Checkbox: { group: 'inputs', description: 'A checkbox bound to a boolean.', props: { label: S('label', { required: true }), bind: { type: 'path', description: 'data path', required: true } } },
  Switch: { group: 'inputs', description: 'An on/off switch bound to a boolean.', props: { label: S('label', { required: true }), bind: { type: 'path', description: 'data path', required: true } } },
  Slider: { group: 'inputs', description: 'A range slider bound to a number.', props: { label: S('label', { required: true }), bind: { type: 'path', description: 'data path', required: true }, min: N('default 0'), max: N('default 100'), step: N('default 1') } },
  // data display
  Stat: { group: 'data', description: 'A key number with a label and optional change.', props: { label: S('what it measures', { required: true }), value: S('the number or text', { required: true }), delta: S('change, e.g. "+12%"'), tone: TONE, help: S('small text below'), spark: { type: 'array', description: 'recent values for a small trend line, e.g. [3,5,4,8]' } } },
  Progress: { group: 'data', description: 'A progress bar (no value: indeterminate).', props: { value: N('0 to max'), max: N('default 100'), label: S('label') } },
  Table: { group: 'data', description: 'A table of rows (objects).', props: { columns: { type: 'array', description: '[{ "key": "name", "label": "Name", "align": "start|end|center", "format": "number|compact|percent|currency|currency:EUR|date|datetime|badge", "tones": {"paid": "ok"} }] (default: the first row\'s keys)' }, rows: { type: 'array', description: 'array of objects, or a binding {"$data": "/rows"}', required: true }, empty: S('text when there are no rows'), sortable: B('sort by clicking a header (default true)'), search: B('a search box over the rows'), pageSize: N('rows per page (default: all, up to 500)') } },
  Chart: { group: 'charts', description: 'A chart for dashboards: line, area, bar (grouped, stacked or horizontal), donut, pie or sparkline. Hover or arrow keys show values; screen readers get a table.', props: { type: E(['line', 'area', 'bar', 'donut', 'pie', 'sparkline'], 'default line'), data: { type: 'array', description: 'rows like [{"month":"Jan","signups":30,"paid":4}] or a binding {"$data": "/sales"}; for a donut, rows of {label, value}', required: true }, x: S('the key of the category/date (default: the first text key)'), series: { type: 'array', description: 'keys to plot, or [{ "key", "label", "color" }] (default: every number key)' }, title: S('heading'), format: S('number | compact | percent | currency | currency:EUR'), height: N('px (default 240)'), stacked: B('stack bars or areas'), horizontal: B('horizontal bars'), min: N('axis minimum'), max: N('axis maximum'), legend: B('show the legend (default: with 2+ series)'), centerLabel: S('donut: text under the total'), empty: S('text with no data') } },
  List: { group: 'data', description: 'A list. Items are markdown strings, or objects drawn with a template component that reads "$item/…".', props: { items: { type: 'array', description: 'array, or a binding {"$data": "/todos"}', required: true }, template: { type: 'id', description: 'a component id drawn once per item (inside it, {"$data": "$item/title"} and "{{$item/title}}")' }, ordered: B('numbered'), empty: S('text when the list is empty') } },
  KeyValue: { group: 'data', description: 'Label and value pairs.', props: { items: { type: 'array', description: '[{ "key": "Status", "value": "Shipped" }] or an object', required: true } } },
};
export const GROUP_NAMES = ['layout', 'content', 'inputs', 'data'];
