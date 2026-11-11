// Test setup: serve the repository at https://ui.test (and Jade Agent Kit at https://ui.test/kit/ when it is next to
// this repository, or at $JAK_DIR), open headless Chromium on tests/page.html with the library (dist/, or src/ with
// JUI_SRC=1) imported as window.UI. Every request is recorded, so tests can check what loaded lazily.
import fs from 'node:fs';
import path from 'node:path';
import pw from 'playwright';
const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
export const KIT = path.resolve(process.env.JAK_DIR || path.join(ROOT, '../jade-agent-kit'));
export const hasKit = fs.existsSync(path.join(KIT, 'dist/jade-agent-kit.js'));
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.wasm': 'application/wasm', '.json': 'application/json', '.map': 'application/json', '.css': 'text/css', '.txt': 'text/plain' };

export async function start({ from = process.env.JUI_SRC ? 'src/index.js' : 'dist/jade-ui.js', viewport = { width: 900, height: 700 }, colorScheme = 'light' } = {}) {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport, colorScheme, permissions: ['clipboard-read', 'clipboard-write'] });
  const requests = []; ctx.on('request', r => requests.push(new URL(r.url()).pathname));
  await ctx.route('https://ui.test/**', route => {
    const u = new URL(route.request().url()); let p = decodeURIComponent(u.pathname); let base = ROOT;
    if (p.startsWith('/kit/')) { base = KIT; p = p.slice(4); }
    const f = path.join(base, p);
    if (!f.startsWith(base) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return route.fulfill({ status: 404, body: 'not found' });
    return route.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  await ctx.route(/^https:\/\/(?!ui\.test)/, route => route.fulfill({ status: 404, body: 'offline' }));
  const page = await ctx.newPage(); page.setDefaultTimeout(15000);
  const log = [], fail = []; const ok = (c, m) => { (c ? log : fail).push((c ? 'PASS ' : 'FAIL ') + m); if (process.env.JUI_LIVE) console.log((c ? 'PASS ' : 'FAIL ') + m); };
  page.on('pageerror', e => fail.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) log.push('[console] ' + m.text()); });
  await page.goto('https://ui.test/tests/page.html');
  await page.evaluate(async from => { window.UI = await import('/' + from); window.FROM = '/' + from.replace(/[^/]+$/, ''); }, from);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  return {
    page, ok, ev, log, fail, from, requests, browser,
    /** module files requested so far, relative to dist/ or src/ */
    loaded: () => requests.filter(p => p.startsWith('/' + path.dirname(from) + '/')).map(p => p.slice(path.dirname(from).length + 2)),
    async done() { await browser.close(); for (const l of log) console.log(l); for (const f of fail) console.log(f); console.log(fail.length ? `\n${fail.length} FAILED` : '\nALL PASS'); process.exit(fail.length ? 1 : 0); },
  };
}
export const sleep = ms => new Promise(r => setTimeout(r, ms));
