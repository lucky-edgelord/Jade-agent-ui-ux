// "Continue with …" in <jade-auth> against a real Jade Agent Base (built from ../jade-agent-base or $JAB_DIR) and a
// stand-in OpenID Connect provider: the agent turns the provider on, the person clicks, a window opens at the provider,
// PocketBase gets the answer and the page is signed in.
import { spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { start, sleep } from './_harness.mjs';
const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const src = path.resolve(process.env.JAB_DIR || path.join(ROOT, '../jade-agent-base'));
if (!fs.existsSync(path.join(src, 'agent/authtools.go'))) { console.log('SKIP: no Jade Agent Base with OAuth2 tools (set JAB_DIR)'); process.exit(0); }
const bin = path.join(os.tmpdir(), 'jab-ui-oauth-test');
const b = spawnSync('go', ['build', '-o', bin, './cmd/jab'], { cwd: src, encoding: 'utf8' });
if (b.status !== 0) { console.log(b.stderr); process.exit(1); }

let deny = false;
const idp = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); let body = ''; req.on('data', d => (body += d)); req.on('end', () => {
    if (u.pathname === '/authorize') { const back = new URL(u.searchParams.get('redirect_uri')); back.searchParams.set('state', u.searchParams.get('state')); back.searchParams.set(deny ? 'error' : 'code', deny ? 'access_denied' : 'good'); res.writeHead(302, { Location: back.toString() }); return res.end(); }
    if (u.pathname === '/token') { const ok = new URLSearchParams(body).get('code') === 'good'; res.writeHead(ok ? 200 : 400, { 'Content-Type': 'application/json' }); return res.end(ok ? '{"access_token":"at-1","token_type":"Bearer","expires_in":3600}' : '{"error":"invalid_grant"}'); }
    if (u.pathname === '/userinfo') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ sub: 'grace-1', email: 'grace@example.com', email_verified: true, name: 'Grace Hopper' })); }
    res.writeHead(404); res.end();
  });
}).listen(0);
await new Promise(r => idp.once('listening', r));
const I = `http://127.0.0.1:${idp.address().port}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jab-ui-oauth-'));
const run = (...a) => { const r = spawnSync(bin, [...a, '--dir', path.join(dir, 'pb_data')], { encoding: 'utf8' }); if (r.status !== 0) throw new Error(r.stderr); return r.stdout.trim(); };
run('superuser', 'upsert', 'root@example.com', '1234567890');
const boss = run('agent', 'create', 'boss', '--scopes', 'all').split('\n').pop();
const pub = path.join(dir, 'pub'); for (const d of ['dist', 'src', 'tests']) fs.cpSync(path.join(ROOT, d), path.join(pub, d), { recursive: true });
const port = 19000 + Math.floor(Math.random() * 900);
const srv = spawn(bin, ['serve', '--http', `127.0.0.1:${port}`, '--dir', path.join(dir, 'pb_data'), '--publicDir', path.join(dir, 'pub'), '--hooksDir', path.join(dir, 'hooks')], { stdio: 'ignore' });
const B = `http://127.0.0.1:${port}`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(B + '/api/health')).ok) break; } catch {} await sleep(100); }
const tool = async (name, args = {}) => { const r = await fetch(`${B}/api/agent/tools/${name}`, { method: 'POST', headers: { Authorization: boss, 'Content-Type': 'application/json' }, body: JSON.stringify(args) }); const j = await r.json(); if (!r.ok) throw new Error(name + ': ' + JSON.stringify(j)); return j.result; };
const cleanup = () => { srv.kill(); idp.close(); fs.rmSync(dir, { recursive: true, force: true }); };

const t = await start();
const { ok, ev, page } = t;
const reload = async () => { await page.goto(B + '/tests/page.html'); await ev(async from => { window.UI = await import(from); }, process.env.JUI_SRC ? '/src/index.js' : '/dist/jade-ui.js'); };
const mount = () => ev(B => { document.getElementById('app').style.height = 'auto'; document.getElementById('app').innerHTML = '<jade-auth id="auth"></jade-auth>'; window.EV = []; document.addEventListener('jade-auth', e => EV.push(e.detail.mode)); }, B);
// no providers: the password form only
await reload(); await mount();
const A = page.locator('#auth');
await A.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
await sleep(300);
ok(await A.locator('[data-provider]').count() === 0, 'no provider buttons when none are on');

await tool('auth_provider_set', { name: 'oidc', display_name: 'Acme ID', client_id: 'cid', client_secret: 'secret', auth_url: I + '/authorize', token_url: I + '/token', user_info_url: I + '/userinfo', pkce: false });
await reload();
await mount();
const btn = A.getByRole('button', { name: 'Continue with Acme ID' });
await btn.waitFor();
ok(await A.getByText('or', { exact: true }).count() === 1 && await A.getByRole('button', { name: 'Sign in', exact: true }).count() === 1, 'the provider button, "or", and the password form');

// the provider says no: an error, still signed out
deny = true;
const [p1] = await Promise.all([page.context().waitForEvent('page'), btn.click()]);
await A.getByRole('alert').filter({ hasText: 'access_denied' }).waitFor();
ok(true, 'a refusal shows the provider\'s error'); ok(p1.isClosed(), 'and the window closes');

// the provider says yes: signed in as the provider's user
deny = false;
const [p2] = await Promise.all([page.context().waitForEvent('page'), btn.click()]);
await A.getByText('grace@example.com').waitFor();
ok((await ev(() => EV.join())) === 'oidc', 'jade-auth fired with the provider');
await sleep(300); ok(p2.isClosed(), 'the window closed');
const u = (await (await fetch(`${B}/api/collections/users/records`, { headers: { Authorization: (await ev(B => JSON.parse(localStorage.getItem('jade-base:' + B)).token, B)) } })).json()).items[0];
ok(u?.name === 'Grace Hopper' && u?.verified === true, 'the account has the provider\'s name and a verified email');

// closing the window cancels quietly
await A.getByRole('button', { name: 'Sign out' }).click();
const [p3] = await Promise.all([page.context().waitForEvent('page'), A.getByRole('button', { name: 'Continue with Acme ID' }).click()]);
await p3.close(); await sleep(900);
ok(await A.getByRole('alert').filter({ hasText: /\S/ }).count() === 0 && !(await A.getByRole('button', { name: 'Continue with Acme ID' }).isDisabled()), 'closing the window cancels without an error');

// password sign-in off: only the providers
await tool('collection_update', { name: 'users', set: { passwordAuth: { enabled: false } } }).catch(e => ok(false, 'turn password off: ' + e.message));
await reload();
await mount(); await A.getByRole('button', { name: 'Continue with Acme ID' }).waitFor(); await sleep(200);
ok(await A.locator('input[type=password]').count() === 0 && await A.getByRole('heading', { name: 'Sign in' }).count() === 1, 'without password sign-in, only the provider buttons');
if (process.env.JUI_SHOTS) { await tool('collection_update', { name: 'users', set: { passwordAuth: { enabled: true } } }); await reload(); await mount(); await A.getByRole('button', { name: 'Continue with Acme ID' }).waitFor(); await page.screenshot({ path: '/tmp/oauth.png' }); }
cleanup();
await t.done();
