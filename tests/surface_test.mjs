// <jade-surface>: specs, data binding, inputs, validation, actions, updates, lists, tabs, safety, lazy component groups.
import { start, sleep } from './_harness.mjs';
const t = await start(); const { ok, ev, page } = t;
await ev(() => { document.getElementById('app').innerHTML = '<jade-surface name="main" id="s"></jade-surface>'; });
await page.waitForFunction(() => customElements.get('jade-surface'));
const S = () => page.locator('#s');
ok(!t.loaded().some(f => f.startsWith('surface/')), 'no component group loads before a spec uses it');

// a form: layout + inputs + content, with bindings
const r1 = await ev(() => document.getElementById('s').render({
  root: 'root',
  components: [
    { id: 'root', component: 'Card', props: { title: 'Sign up', subtitle: 'Hi {{/user/name}}' }, children: ['name', 'email', 'plan', 'news', 'n', 'row'] },
    { id: 'name', component: 'TextField', props: { label: 'Name', bind: '/user/name', required: true } },
    { id: 'email', component: 'TextField', props: { label: 'Email', bind: '/user/email', type: 'email', help: 'We never share it' } },
    { id: 'plan', component: 'Select', props: { label: 'Plan', bind: '/user/plan', options: [{ value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }] } },
    { id: 'news', component: 'Switch', props: { label: 'Newsletter', bind: '/user/news' } },
    { id: 'n', component: 'Text', props: { text: 'Plan: **{{/user/plan}}**', visible: { $data: '/user/news' } } },
    { id: 'row', component: 'Row', props: { justify: 'end' }, children: ['go'] },
    { id: 'go', component: 'Button', props: { label: 'Join as {{/user/name}}', variant: 'primary', action: { name: 'join', data: { who: { $data: '/user/name' } } } } },
  ],
  data: { user: { name: '', email: '', plan: 'pro', news: false } },
}));
ok(r1.ok && r1.count === 8, 'renders a valid spec: ' + JSON.stringify(r1));
const groups = t.loaded().filter(f => f.startsWith('surface/')).sort();
ok(groups.join() === 'surface/content.js,surface/inputs.js,surface/layout.js', 'only the groups the spec uses load: ' + groups.join());
ok(await S().getByRole('heading', { name: 'Sign up' }).isVisible(), 'Card title');
ok((await S().getByLabel('Plan').inputValue()) === '1', 'Select shows the bound value');
ok(!(await S().getByText('Plan:').isVisible()), 'visible binding hides the Text while /user/news is false');
await S().getByLabel('Name').fill('Ada');
ok((await ev(() => document.getElementById('s').getData('/user/name'))) === 'Ada', 'typing writes to the data model');
ok(await S().getByRole('button', { name: 'Join as Ada' }).isVisible(), '{{/path}} in a label updates live');
ok(await S().getByText('Hi Ada').isVisible(), '…in a subtitle too');
await S().getByText('Newsletter').click();
ok(await S().getByText('Plan: pro').isVisible(), 'a switch toggles visibility through the data model');
await S().getByLabel('Plan').selectOption({ label: 'Free' });
ok(await S().getByText('Plan: free').isVisible() && (await ev(() => document.getElementById('s').getData('/user/plan'))) === 'free', 'Select writes the option value');

// actions + validation
await ev(() => { window.A = []; document.getElementById('s').addEventListener('jade-action', e => A.push(e.detail)); });
await S().getByLabel('Name').fill('');
await S().getByRole('button', { name: /Join as/ }).click();
ok((await ev(() => A.length)) === 0, 'a required field blocks the action');
ok((await S().getByLabel('Name').getAttribute('aria-invalid')) === 'true' && await S().getByText('This is required.').isVisible(), '…and says why, on the field');
await S().getByLabel('Name').fill('Grace'); await sleep(650);
await S().getByRole('button', { name: /Join as/ }).click();
const a = await ev(() => A[0]);
ok(a && a.surface === 'main' && a.name === 'join' && a.data.who === 'Grace' && a.values.user.plan === 'free' && a.values.user.news === true, 'the action carries its data and every value: ' + JSON.stringify(a));

// update: data only keeps focus and typing; components replace by id
await S().getByLabel('Email').fill('g@x.test'); await S().getByLabel('Email').focus();
const r2 = await ev(() => document.getElementById('s').update({ data: { user: { name: 'Grace H' } } }));
ok(r2.ok && (await S().getByLabel('Name').inputValue()) === 'Grace H' && (await S().getByLabel('Email').inputValue()) === 'g@x.test', 'a data update changes bound fields and keeps the rest');
ok(await ev(() => document.getElementById('s').shadowRoot.activeElement?.type === 'email'), 'focus is kept');
await ev(() => document.getElementById('s').update({ data: [{ path: '/user/plan', value: 'pro' }] }));
ok((await S().getByLabel('Plan').inputValue()) === '1', 'path updates work');
await ev(() => document.getElementById('s').update({ components: [{ id: 'news', component: 'Checkbox', props: { label: 'Send me news', bind: '/user/news' } }] }));
ok(await S().getByRole('checkbox', { name: 'Send me news' }).isChecked(), 'replacing a component by id keeps its data');
ok((await S().getByLabel('Email').inputValue()) === 'g@x.test', 'a repaint keeps typed values (they live in the data model)');

// lists with templates, tables, tabs, stats, progress
const r3 = await ev(() => document.getElementById('s').render({
  components: [
    { id: 'root', component: 'Tabs', props: { tabs: [{ label: 'Todos', children: ['todos'] }, { label: 'Stats', children: ['grid'] }], bind: '/tab' } },
    { id: 'todos', component: 'List', props: { items: { $data: '/todos' }, template: 'todo', empty: 'All done' } },
    { id: 'todo', component: 'Checkbox', props: { label: '{{$index}}. {{$item/title}}', bind: '$item/done' } },
    { id: 'grid', component: 'Grid', props: { columns: 2 }, children: ['st', 'pr', 'tb'] },
    { id: 'st', component: 'Stat', props: { label: 'Revenue', value: 12400, delta: '+8%' } },
    { id: 'pr', component: 'Progress', props: { label: 'Upload', value: { $data: '/pct' } } },
    { id: 'tb', component: 'Table', props: { rows: { $data: '/rows' }, columns: [{ key: 'name', label: 'Name' }, { key: 'qty', label: 'Qty' }] } },
  ],
  data: { tab: 0, todos: [{ title: 'Write tests', done: true }, { title: 'Ship', done: false }], pct: 40, rows: [{ name: 'Bolts', qty: 12 }] },
}));
ok(r3.ok, 'list/tabs/grid spec renders: ' + r3.warnings.join('; '));
ok(await S().getByRole('checkbox', { name: '0. Write tests' }).isChecked() && !(await S().getByRole('checkbox', { name: '1. Ship' }).isChecked()), 'List template with $item and $index');
await S().getByRole('checkbox', { name: '1. Ship' }).check();
ok((await ev(() => document.getElementById('s').getData('/todos/1/done'))) === true, 'template inputs write to their item');
await ev(() => document.getElementById('s').update({ data: [{ path: '/todos', value: [{ title: 'Only one', done: false }] }] }));
ok(await S().getByRole('checkbox', { name: '0. Only one' }).isVisible() && (await S().getByRole('checkbox').count()) === 1, 'the list re-draws when its data changes');
ok(!(await S().getByText('Revenue').isVisible()), 'second tab hidden');
await S().getByRole('tab', { name: 'Stats' }).click();
ok(await S().getByText('Revenue').isVisible() && (await ev(() => document.getElementById('s').getData('/tab'))) === 1, 'tabs switch and keep the index in data');
ok(await S().getByText('12,400').isVisible() && await S().getByText('+8%').isVisible(), 'Stat formats numbers');
ok((await S().getByRole('progressbar').getAttribute('aria-valuenow')) === '40', 'Progress');
await ev(() => document.getElementById('s').setData('/pct', 90));
ok((await S().getByRole('progressbar').getAttribute('aria-valuenow')) === '90', 'Progress follows its binding');
ok(await S().getByRole('cell', { name: 'Bolts' }).isVisible(), 'Table rows');
await S().getByRole('tab', { name: 'Todos' }).focus(); await page.keyboard.press('ArrowRight');
ok((await ev(() => document.getElementById('s').getData('/tab'))) === 1, 'arrow keys move between tabs');
ok(t.loaded().includes('surface/data.js'), 'the data group loaded when used');

// problems are reported, not rendered as anything unsafe
const r4 = await ev(() => document.getElementById('s').render({ components: [
  { id: 'root', component: 'Column', children: ['a', 'b', 'c', 'd', 'missing', 'e'] },
  { id: 'a', component: 'Marquee', props: {} },
  { id: 'b', component: 'Text', props: { text: '<img src=x onerror=alert(1)> [x](javascript:alert(1))', color: 'red' } },
  { id: 'c', component: 'Image', props: { src: 'javascript:alert(1)', alt: 'x' } },
  { id: 'd', component: 'Link', props: { text: 'bad', href: 'javascript:alert(1)' } },
  { id: 'e', component: 'Column', children: ['e'] },
  { id: 'orphan', component: 'Divider' },
] }));
const w = r4.warnings.join('\n');
ok(!r4.ok && /unknown component "Marquee"/.test(w) && /no prop "color"/.test(w) && /no component with id "missing"/.test(w) && /contains itself/.test(w) && /not reachable/.test(w) && /src must be/.test(w) && /href must be/.test(w), 'warnings name every problem:\n' + w);
const unsafe = await ev(() => { const r = document.getElementById('s').shadowRoot; return { img: !!r.querySelector('img[onerror], img[src^="x"]'), js: [...r.querySelectorAll('[href],[src]')].some(e => /javascript/i.test(e.getAttribute('href') || e.getAttribute('src'))), text: r.querySelector('[data-id=b]').textContent }; });
ok(!unsafe.img && !unsafe.js && unsafe.text.includes('<img src=x'), 'unsafe markup and URLs never reach the DOM');
ok((await ev(() => document.getElementById('s').render({ components: Array.from({ length: 1200 }, (_, i) => ({ id: i ? 'x' + i : 'root', component: i ? 'Divider' : 'Column', children: i ? undefined : Array.from({ length: 1199 }, (_, k) => 'x' + (k + 1)) })) }))).warnings.some(x => /more than 1000/.test(x)), 'a component limit');
ok((await ev(() => document.getElementById('s').render({ components: [{ id: 'root', component: 'Column', props: { __proto__x: 1 } }], data: JSON.parse('{"__proto__": {"polluted": 1}}') }).then(() => ({}).polluted))) === undefined, 'no prototype pollution through data');
ok((await ev(() => { const s = document.getElementById('s'); s.setData('/__proto__/polluted', 1); return ({}).polluted; })) === undefined, 'no prototype pollution through paths');
await t.done();
