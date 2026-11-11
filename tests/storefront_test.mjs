// The account elements against a real Jade Agent Base server (built from ../jade-agent-base or $JAB_DIR) with a stand-in
// for Stripe: sign up, plans, Checkout, a signed Stripe webhook, the portal, API keys.
import { spawnSync, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { start, sleep } from './_harness.mjs';
const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const src = path.resolve(process.env.JAB_DIR || path.join(ROOT, '../jade-agent-base'));
if (!fs.existsSync(path.join(src, 'billing'))) { console.log('SKIP: no Jade Agent Base with billing (set JAB_DIR)'); process.exit(0); }
const bin = path.join(os.tmpdir(), 'jab-ui-test');
const b = spawnSync('go', ['build', '-o', bin, './cmd/jab'], { cwd: src, encoding: 'utf8' });
if (b.status !== 0) { console.log(b.stderr); process.exit(1); }

// a stand-in for Stripe
const stripe = http.createServer((req, res) => {
  let body = ''; req.on('data', d => (body += d)); req.on('end', () => {
    const r = { '/v1/customers': { id: 'cus_1' }, '/v1/products': { id: 'prod_1' }, '/v1/prices': { id: 'price_pro' }, '/v1/checkout/sessions': { id: 'cs_1', url: 'https://checkout.stripe.test/cs_1' }, '/v1/billing_portal/sessions': { url: 'https://billing.stripe.test/p_1' } }[req.url];
    res.statusCode = r ? 200 : 400; res.end(JSON.stringify(r || { error: { message: 'unknown ' + req.url } }));
  });
}).listen(0);
await new Promise(r => stripe.once('listening', r));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jab-ui-'));
const env = { ...process.env, STRIPE_API_BASE: `http://127.0.0.1:${stripe.address().port}` };
const run = (...a) => { const r = spawnSync(bin, [...a, '--dir', path.join(dir, 'pb_data')], { encoding: 'utf8', env }); if (r.status !== 0) throw new Error(r.stderr); return r.stdout.trim(); };
run('superuser', 'upsert', 'root@example.com', '1234567890');
const boss = run('agent', 'create', 'boss', '--scopes', 'all').split('\n').pop();
const port = 19000 + Math.floor(Math.random() * 900);
const srv = spawn(bin, ['serve', '--http', `127.0.0.1:${port}`, '--dir', path.join(dir, 'pb_data'), '--publicDir', path.join(dir, 'pub'), '--hooksDir', path.join(dir, 'hooks')], { stdio: 'ignore', env });
const B = `http://127.0.0.1:${port}`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(B + '/api/health')).ok) break; } catch {} await sleep(100); }
const tool = async (name, args = {}) => { const r = await fetch(`${B}/api/agent/tools/${name}`, { method: 'POST', headers: { Authorization: boss, 'Content-Type': 'application/json' }, body: JSON.stringify(args) }); const j = await r.json(); if (!r.ok) throw new Error(name + ': ' + JSON.stringify(j)); return j.result; };
// an agent sets up the shop
await tool('module_enable', { name: 'billing' });
await tool('billing_setup', { secret_key: 'sk_test_1', webhook_secret: 'whsec_1' });
await tool('plan_set', { name: 'free', description: 'Try it out' });
await tool('plan_set', { name: 'pro', price_month: 9, monthly_tokens: 5000000, rpm: 600, description: 'For real work' });
await tool('plan_set', { name: 'team', price_month: 49, description: 'Soon' });
await tool('plan_publish', { plan: 'pro' });
const cleanup = () => { srv.kill(); stripe.close(); fs.rmSync(dir, { recursive: true, force: true }); };

const t = await start();
const { ok, ev, page } = t;
await t.page.context().route('https://base.test/**', async route => {
  const q = route.request(); const u = new URL(q.url()); const h = { ...q.headers() }; delete h.host;
  const r = await fetch(B + u.pathname + u.search, { method: q.method(), headers: h, body: ['GET', 'HEAD'].includes(q.method()) ? undefined : q.postDataBuffer() });
  const headers = Object.fromEntries(r.headers); delete headers['content-encoding']; delete headers['content-length'];
  await route.fulfill({ status: r.status, headers, body: Buffer.from(await r.arrayBuffer()) });
});
page.on('dialog', d => d.accept());
await ev(() => {
  document.getElementById('app').style.height = 'auto';
  document.getElementById('app').innerHTML = '<jade-auth id="auth" base="https://base.test"></jade-auth><jade-pricing id="pricing" base="https://base.test"></jade-pricing><jade-account id="acct" base="https://base.test"></jade-account>';
  window.NAV = []; window.EV = [];
  for (const id of ['pricing', 'acct']) document.getElementById(id).addEventListener('jade-checkout', e => EV.push(['checkout', e.detail]));
  document.addEventListener('jade-needs-signin', e => EV.push(['needs', e.detail])); document.addEventListener('jade-auth', e => EV.push(['auth', e.detail.mode]));
});
await page.waitForFunction(() => ['jade-auth', 'jade-pricing', 'jade-account'].every(t => customElements.get(t)));
for (const id of ['pricing', 'acct']) await ev(id => { document.getElementById(id).navigate = u => NAV.push(u); }, id);
ok(!t.loaded().some(f => /^(chat|surface|tool-call|highlight)\.js$/.test(f)), 'only the account elements load: ' + t.loaded().filter(f => !f.startsWith('chunk')).join(', '));
const P = page.locator('#pricing'), A = page.locator('#auth'), C = page.locator('#acct');
await P.getByRole('heading', { name: 'Pro' }).waitFor();
ok(await P.getByText('$9').isVisible() && await P.getByText('5,000,000 tokens a month').isVisible() && await P.getByRole('button', { name: 'Coming soon' }).isVisible(), 'pricing shows plans, prices, limits, and plans not on sale');
ok(await C.getByText('Sign in to see').isVisible(), 'account asks to sign in');
await P.getByRole('button', { name: 'Choose pro' }).click();
ok((await ev(() => EV.find(e => e[0] === 'needs')?.[1].plan)) === 'pro', 'subscribing signed out asks to sign in');

// sign up: client-side checks, then the server's own errors on their fields
await A.getByRole('tab', { name: 'Create account' }).click();
await A.getByLabel('Email').fill('ada@example.com'); await A.getByLabel('Password').fill('short');
await A.getByRole('button', { name: 'Create account' }).click();
ok(await A.getByText('Use at least 8 characters.').isVisible() && (await A.getByLabel('Password').getAttribute('aria-invalid')) === 'true', 'password too short is caught on its field');
await A.getByLabel('Password').fill('password123'); await A.getByRole('button', { name: 'Create account' }).click();
await A.getByText('Signed in as').waitFor();
ok((await ev(() => EV.filter(e => e[0] === 'auth').map(e => e[1]).join())) === 'signup', 'sign up signs in (jade-auth)');
await C.getByRole('heading', { name: 'Free' }).waitFor();
ok(await P.locator('section.current').getByRole('heading', { name: 'Free' }).isVisible(), 'every element updates: pricing marks the current plan, account shows it');
await A.getByRole('button', { name: 'Sign out' }).click();
await A.getByRole('tab', { name: 'Create account' }).click();
await A.getByLabel('Email').fill('ada@example.com'); await A.getByLabel('Password').fill('password123'); await A.getByRole('button', { name: 'Create account' }).click();
await A.locator('.ferr:not(:empty), .err:not([hidden])').first().waitFor();
ok(/already has an account/i.test(await A.locator('.ferr:not(:empty), .err:not([hidden])').first().textContent()), 'the server says the email is taken: ' + await A.locator('.ferr:not(:empty), .err:not([hidden])').first().textContent());
await A.getByRole('tab', { name: 'Sign in' }).click();
await A.getByLabel('Email').fill('ada@example.com'); await A.getByLabel('Password').fill('wrong-password'); await A.getByRole('button', { name: 'Sign in' }).click();
await A.getByRole('alert').waitFor();
ok(/do not match/.test(await A.getByRole('alert').textContent()), 'a wrong password says so');
await A.getByLabel('Password').fill('password123'); await A.getByRole('button', { name: 'Sign in' }).click();
await A.getByText('Signed in as').waitFor();
ok(true, 'signs in');

// subscribe: Checkout opens with the server's Stripe URL
await P.getByRole('button', { name: 'Choose pro' }).waitFor();
await P.getByRole('button', { name: 'Choose pro' }).click();
await page.waitForFunction(() => NAV.length > 0);
ok((await ev(() => NAV[0])) === 'https://checkout.stripe.test/cs_1', 'Subscribe opens Stripe Checkout');
// Stripe tells the server it was paid (a signed webhook), the user refreshes
const payload = JSON.stringify({ id: 'evt_1', type: 'customer.subscription.created', data: { object: { id: 'sub_1', customer: 'cus_1', status: 'active', items: { data: [{ price: { id: 'price_pro' }, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] } } } });
const ts = Math.floor(Date.now() / 1000); const sig = crypto.createHmac('sha256', 'whsec_1').update(`${ts}.${payload}`).digest('hex');
const wh = await fetch(B + '/api/billing/webhook', { method: 'POST', headers: { 'Stripe-Signature': `t=${ts},v1=${sig}`, 'Content-Type': 'application/json' }, body: payload });
ok(wh.ok, 'the signed webhook is accepted');
await ev(async () => (await (await import(FROM + 'base-client.js')).baseClient('https://base.test')).refresh());
await C.getByRole('heading', { name: 'Pro' }).waitFor();
ok(await C.getByText('active').isVisible() && await C.getByText(/Renews/).isVisible() && await C.getByText('/ 5,000,000').isVisible(), 'the account shows Pro, active, its renewal date and token limit');
ok(await P.locator('section.current').getByRole('heading', { name: 'Pro' }).isVisible(), 'pricing marks Pro as current');
await ev(() => { NAV.length = 0; });
await C.getByRole('button', { name: 'Manage billing' }).click();
await page.waitForFunction(() => NAV.length > 0);
ok((await ev(() => NAV[0])) === 'https://billing.stripe.test/p_1', 'Manage billing opens the Stripe portal');

// API keys: shown once, listed, revoked
await C.getByLabel('New API key').fill('laptop'); await C.getByRole('button', { name: 'Create key' }).click();
await C.locator('[part=new-key]').waitFor();
const key = await C.locator('[part=new-key]').textContent();
ok(key.startsWith('jab_') && await C.getByRole('cell', { name: 'laptop', exact: true }).isVisible(), 'a new key is shown once and listed');
const me = await fetch(B + '/api/gateway/me', { headers: { Authorization: 'Bearer ' + key } });
ok(me.ok && (await me.json()).plan.name === 'pro', 'the key works against the gateway, on the pro plan');
await C.getByRole('button', { name: 'Revoke laptop' }).click();
await C.getByText('No keys yet.').waitFor();
ok((await fetch(B + '/api/gateway/me', { headers: { Authorization: 'Bearer ' + key } })).status === 401, 'revoking a key ends it');
// the token survives a reload
await page.reload(); await page.evaluate(async from => { window.UI = await import('/' + from); }, t.from);
await ev(() => { document.getElementById('app').innerHTML = '<jade-account base="https://base.test"></jade-account>'; });
await page.locator('jade-account').getByRole('heading', { name: 'Pro' }).waitFor();
ok(true, 'still signed in after a reload');
if (process.env.JUI_SHOTS) {
  for (const [name, vp, scheme] of [['store-desk', { width: 1100, height: 1300 }, 'light'], ['store-mob', { width: 390, height: 1500 }, 'dark']]) {
    await page.setViewportSize(vp); await page.emulateMedia({ colorScheme: scheme });
    await ev(() => { document.getElementById('app').innerHTML = '<div style="padding:16px;display:grid;gap:16px"><jade-auth base="https://base.test"></jade-auth><jade-pricing base="https://base.test"></jade-pricing><jade-account base="https://base.test"></jade-account></div>'; document.body.style.background = 'var(--jade-bg)'; });
    await page.locator('jade-account').getByRole('heading', { name: 'Pro' }).waitFor(); await sleep(300);
    await page.screenshot({ path: `/tmp/${name}.png`, fullPage: true });
  }
}
cleanup();
await t.done();
