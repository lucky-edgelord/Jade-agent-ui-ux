// Dashboards: <jade-chart>, and the surface Chart, Stat sparklines and a Table with sort, search and pages.
import { start, sleep } from './_harness.mjs';
const t = await start({ viewport: { width: 1100, height: 900 } });
const { ok, ev, page } = t;
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const sales = months.map((m, i) => ({ month: m, revenue: 1200 + i * 340 + (i % 2) * 150, costs: 800 + i * 90 }));
const orders = Array.from({ length: 23 }, (_, i) => ({ id: 1000 + i, customer: ['Ada', 'Grace', 'Linus', 'Alan', 'Barbara'][i % 5] + ' ' + i, total: (i * 37) % 250 + 10, status: ['paid', 'refunded', 'pending'][i % 3], date: `2026-0${(i % 9) + 1}-1${i % 9}` }));
const spec = { root: 'root', data: { sales, orders, plans: [{ label: 'Free', value: 620 }, { label: 'Pro', value: 210 }, { label: 'Team', value: 45 }] }, components: [
  { id: 'root', component: 'Column', children: ['kpis', 'charts', 'tbl'] },
  { id: 'kpis', component: 'Grid', props: { columns: 4 }, children: ['k1', 'k2', 'k3', 'k4'] },
  { id: 'k1', component: 'Card', children: ['s1'] }, { id: 's1', component: 'Stat', props: { label: 'Revenue', value: '$4,350', delta: '+12%', spark: [3, 5, 4, 6, 8, 9] } },
  { id: 'k2', component: 'Card', children: ['s2'] }, { id: 's2', component: 'Stat', props: { label: 'Users', value: 875, delta: '+4%', spark: [10, 11, 13, 12, 15, 17] } },
  { id: 'k3', component: 'Card', children: ['s3'] }, { id: 's3', component: 'Stat', props: { label: 'Churn', value: '2.1%', delta: '-0.4%', spark: [5, 4, 4, 3, 3, 2] } },
  { id: 'k4', component: 'Card', children: ['s4'] }, { id: 's4', component: 'Stat', props: { label: 'Tickets', value: 14 } },
  { id: 'charts', component: 'Grid', props: { columns: 3 }, children: ['c1', 'c2', 'c3'] },
  { id: 'c1', component: 'Card', children: ['line'] }, { id: 'line', component: 'Chart', props: { type: 'area', title: 'Revenue and costs', data: { $data: '/sales' }, x: 'month', format: 'currency' } },
  { id: 'c2', component: 'Card', children: ['bar'] }, { id: 'bar', component: 'Chart', props: { type: 'bar', stacked: true, title: 'Stacked', data: { $data: '/sales' } } },
  { id: 'c3', component: 'Card', children: ['donut'] }, { id: 'donut', component: 'Chart', props: { type: 'donut', title: 'Users by plan', data: { $data: '/plans' }, centerLabel: 'users' } },
  { id: 'tbl', component: 'Card', props: { title: 'Orders' }, children: ['orders'] },
  { id: 'orders', component: 'Table', props: { rows: { $data: '/orders' }, search: true, pageSize: 8, columns: [{ key: 'id', label: '#' }, { key: 'customer', label: 'Customer' }, { key: 'total', label: 'Total', format: 'currency' }, { key: 'status', label: 'Status', format: 'badge', tones: { paid: 'ok', refunded: 'danger', pending: 'warn' } }, { key: 'date', label: 'Date', format: 'date' }] } },
] };
const before = t.loaded().length;
await ev(async s => { document.getElementById('app').style.height = 'auto'; document.getElementById('app').innerHTML = '<jade-surface id="d"></jade-surface>'; await customElements.whenDefined('jade-surface'); window.R = await document.getElementById('d').render(s); }, spec);
ok((await ev(() => R.warnings?.length || 0)) === 0, 'the dashboard spec has no warnings: ' + JSON.stringify(await ev(() => R.warnings)));
ok(t.loaded().includes('surface/charts.js'), 'the charts group loads with a Chart');
const S = page.locator('#d');
ok(await S.locator('.stat svg[role=img]').count() === 3, 'three Stats have sparklines');
const area = S.locator('[data-id=line] svg[role=img]');
ok(/area chart of revenue, costs by month, 6 points/.test(await area.getAttribute('aria-label')), 'the area chart describes itself');
ok(await S.locator('[data-id=line] table.sr tr').count() === 7, 'and has a table for screen readers');
const bb = await area.boundingBox(); ok(bb.width > 200, 'it fills its card: ' + Math.round(bb.width));
await page.mouse.move(bb.x + bb.width * 0.95, bb.y + bb.height / 2);
const tip = S.locator('[data-id=line] .tip');
await tip.waitFor(); ok(/Jun/.test(await tip.innerText()) && /\$3,050/.test(await tip.innerText()), 'hover shows the values: ' + (await tip.innerText()).replace(/\n/g, ' | '));
await area.focus(); await page.keyboard.press('ArrowLeft'); ok(/May/.test(await tip.innerText()), 'arrow keys move through points');
ok(await S.locator('[data-id=bar] rect').count() === 12, 'stacked bars: 2 per month');
ok(await S.locator('[data-id=donut] path.seg').count() === 3 && /875/.test(await S.locator('[data-id=donut] .donut-c').textContent()), 'the donut has 3 slices and the total');
// table
const T = S.locator('[data-id=orders]');
ok(await T.locator('tbody tr').count() === 8 && /Page 1 of 3/.test(await T.locator('.tbl-p').innerText()), 'pages of 8');
await T.getByRole('button', { name: 'Next' }).click(); ok(/Page 2 of 3/.test(await T.locator('.tbl-p').innerText()), 'Next page');
await T.getByRole('button', { name: /^Total/ }).click(); await T.getByRole('button', { name: /^Total/ }).click();
const totals = await T.locator('tbody tr td:nth-child(3)').allInnerTexts(); const nums = totals.map(x => +x.replace(/[$,]/g, '')); ok(nums.every((v, i) => !i || nums[i - 1] >= v) && nums[0] >= 240, 'sort by Total descending, back on page 1: ' + totals[0]);
ok((await T.locator('th[aria-sort=descending]').count()) === 1, 'aria-sort says so');
await T.getByRole('searchbox').fill('grace'); ok(await T.locator('tbody tr').count() === 5 && await T.locator('.tbl-p').isHidden(), 'search filters (and one page hides the pager)');
ok(await T.locator('.badge[data-tone=ok], .badge[data-tone=danger], .badge[data-tone=warn]').count() === 5, 'status badges with tones');
await T.getByRole('searchbox').fill('nobody'); ok(/No rows match/.test(await T.innerText()), 'no matches says so');
// live data
await ev(() => document.getElementById('d').setData('/plans', [{ label: 'Free', value: 1 }, { label: 'Pro', value: 1 }]));
ok(await S.locator('[data-id=donut] path.seg').count() === 2, 'charts redraw when their data changes');
// the element
await ev(() => { const d = document.createElement('div'); d.id = 'el'; d.style.width = '500px'; d.innerHTML = `<jade-chart id="ch" type="bar" horizontal title="Top pages" x="page" format="compact" data='[{"page":"/","views":12000},{"page":"/pricing","views":5400},{"page":"/docs","views":3100}]'></jade-chart><jade-chart id="sp" type="sparkline" data="[1,3,2,5,4,7]"></jade-chart><jade-chart id="e" type="line"></jade-chart>`; document.body.append(d); });
await page.waitForFunction(() => customElements.get('jade-chart'));
const CH = page.locator('#ch');
await CH.locator('svg rect').first().waitFor();
ok(await CH.locator('svg rect').count() === 3 && /Top pages/.test(await CH.getByRole('heading').innerText()), '<jade-chart> draws horizontal bars with a title');
ok(/10K/.test(await CH.locator('svg').innerHTML()), 'compact axis labels');
ok(await page.locator('#sp svg').count() === 1, 'a sparkline element');
ok(/No data yet/.test(await page.locator('#e').evaluate(e => e.shadowRoot.textContent)), 'no data says so');
await ev(() => { document.getElementById('ch').data = [{ page: '/a', views: 1, visits: 2 }]; });
ok(await CH.locator('svg rect').count() === 2 && await CH.locator('.lg span').count() === 2, 'setting data redraws, with a legend for 2 series');
if (process.env.JUI_SHOTS) {
  await ev(() => document.getElementById('el').remove());
  await ev(s => document.getElementById('d').render(s), spec); await sleep(300);
  await page.screenshot({ path: '/tmp/dash.png', fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' }); await page.setViewportSize({ width: 400, height: 900 }); await sleep(300); await page.screenshot({ path: '/tmp/dash-mob.png', fullPage: true });
}
await t.done();
