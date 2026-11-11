// <jade-account> and <jade-pricing> load once when they upgrade (attributes + connect), and a key shown after
// creating it stays on screen (a second, late load used to replace it).
import { start, sleep } from './_harness.mjs';
const t = await start();
const { ok, ev, page } = t;
const calls = { me: 0, plans: 0 };
const tok = 'x.' + Buffer.from(JSON.stringify({ id: 'u1', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.y';
await page.context().route('https://base.test/**', async r => {
  const u = new URL(r.request().url()); const j = b => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  await new Promise(x => setTimeout(x, 150 + Math.random() * 150));
  if (u.pathname === '/api/gateway/me') { calls.me++; return j({ plan: { name: 'free', monthly_tokens: 1000 }, month: { tokens: 5, cost: 0 } }); }
  if (u.pathname === '/api/billing/me') return j({ plan: '', status: '' });
  if (u.pathname === '/api/collections/api_keys/records') return j({ items: [] });
  if (u.pathname === '/api/gateway/keys') return j({ key: 'jab_new_key_123', id: 'k1', prefix: 'jab_new', name: 'laptop' });
  if (u.pathname === '/api/collections/plans/records') { calls.plans++; return j({ items: [{ name: 'free', price_month: 0, active: true }] }); }
  return r.fulfill({ status: 404, body: '{}' });
});
await ev(t => { localStorage.setItem('jade-base:https://base.test', JSON.stringify({ token: t, user: { id: 'u1', email: 'a@b.c' } })); }, tok);
await ev(() => { document.getElementById('app').innerHTML = '<jade-account base="https://base.test" currency="USD"></jade-account><jade-pricing base="https://base.test" currency="USD"></jade-pricing>'; });
const C = page.locator('jade-account');
await C.getByLabel('New API key').waitFor();
await C.getByLabel('New API key').fill('laptop');
await C.getByRole('button', { name: 'Create key' }).click();
await C.locator('[part=new-key]').waitFor();
await sleep(800);
ok(calls.me === 1, 'the account loaded once on upgrade: ' + calls.me);
ok(calls.plans === 1, 'pricing loaded once on upgrade: ' + calls.plans);
ok(await C.locator('[part=new-key]').isVisible(), 'the new key stays on screen');
await ev(() => document.querySelector('jade-account').setAttribute('currency', 'EUR'));
await sleep(600);
ok(calls.me === 2, 'a real attribute change reloads');
await t.done();
