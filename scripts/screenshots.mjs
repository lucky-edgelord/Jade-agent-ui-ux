// Screenshots of examples/index.html on a desktop (light) and a phone (dark) into /tmp: node scripts/screenshots.mjs
import { start, sleep } from '../tests/_harness.mjs';
for (const [name, vp, scheme] of [['desk', { width: 1280, height: 860 }, 'light'], ['mob', { width: 390, height: 800 }, 'dark']]) {
  const t = await start({ viewport: vp, colorScheme: scheme }); const p = t.page;
  await p.goto('https://ui.test/examples/index.html'); await p.waitForFunction(() => customElements.get('jade-chat'));
  await p.screenshot({ path: `/tmp/${name}-empty.png` });
  await p.locator('jade-chat').getByRole('button', { name: 'Show me what you can do' }).click();
  await p.waitForFunction(() => !document.getElementById('chat').busy, null, { timeout: 20000 }); await sleep(300);
  await p.screenshot({ path: `/tmp/${name}-reply.png` });
  await p.evaluate(() => document.getElementById('chat').send('Make me a sign-up form'));
  await sleep(300); await p.screenshot({ path: `/tmp/${name}-form.png` });
  await p.evaluate(() => { window.P = document.getElementById('chat').send('Run a shell command'); });
  await p.waitForFunction(() => document.getElementById('chat').messages.at(-1).shadowRoot.querySelector('jade-tool-call')?.getAttribute('status') === 'waiting', null, { timeout: 20000 });
  await sleep(300); await p.screenshot({ path: `/tmp/${name}-approve.png` });
  console.log(name, 'scrollWidth', await p.evaluate(() => document.documentElement.scrollWidth), 'errors', t.fail.join('; ') || 'none');
  await t.browser.close();
}
