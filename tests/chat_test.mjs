// <jade-chat> with an agent that behaves like Jade Agent Kit's (same events, plugins and beforeTool), a handler, and events.
import { start, sleep } from './_harness.mjs';
const t = await start(); const { ok, ev, page } = t;
// a scripted agent in the shape of jade-agent-kit's Agent
await ev(() => {
  window.FakeAgent = class {
    constructor(script, { plugins = [] } = {}) { this.script = script; this.plugins = plugins; this.messages = []; this.onEvent = null; this.ctrl = null; this.calls = []; this.toolsRun = []; }
    emit(e) { this.onEvent?.(e); }
    abort() { this.ctrl?.abort(); }
    reset() { this.messages = []; }
    async prompt(text, o = {}) {
      this.calls.push({ text, images: o.images }); this.ctrl = new AbortController(); const sig = this.ctrl.signal;
      this.messages.push({ role: 'user', content: text });
      const steps = typeof this.script === 'function' ? this.script(text, this) : this.script;
      let out = '';
      try {
        for (const s of steps) {
          if (sig.aborted) throw new DOMException('stopped', 'AbortError');
          if (s.wait) await new Promise((ok, no) => { const id = setTimeout(ok, s.wait); sig.addEventListener('abort', () => { clearTimeout(id); no(new DOMException('stopped', 'AbortError')); }); });
          if (s.think) this.emit({ type: 'thinking', delta: s.think });
          if (s.text) { out += s.text; this.emit({ type: 'text', delta: s.text }); }
          if (s.route) this.emit({ type: 'route', model: s.route });
          if (s.throw) throw new Error(s.throw);
          if (s.tool) {
            const { name, args } = s.tool; this.emit({ type: 'tool_call', name, args }); let result = null;
            for (const p of this.plugins) if (p.beforeTool) { const r = await p.beforeTool(this, { name, args }); if (r != null) { result = String(r); break; } }
            if (result == null) { this.toolsRun.push(name); result = s.result ?? 'ok'; }
            this.emit({ type: 'tool_result', name, result }); this.messages.push({ role: 'tool', content: result });
            if (sig.aborted) throw new DOMException('stopped', 'AbortError');
          }
        }
      } catch (e) { this.ctrl = null; if (e.name === 'AbortError') { this.emit({ type: 'done', text: '(stopped)' }); return '(stopped)'; } this.emit({ type: 'error', error: e }); throw e; }
      this.ctrl = null; this.messages.push({ role: 'assistant', content: out }); this.emit({ type: 'done', text: out }); return out;
    }
  };
  document.getElementById('app').innerHTML = '<jade-chat id="c" greeting="Hi there" suggestions=\'["First idea", {"label": "Second", "prompt": "the second prompt"}]\' attach></jade-chat>';
});
await page.waitForFunction(() => customElements.get('jade-chat'));
const sh = (sel) => `document.getElementById('c').shadowRoot.querySelector(${JSON.stringify(sel)})`;
const msgs = () => ev(() => document.getElementById('c').messages.map(m => ({ role: m.role, text: m.text, busy: m.getAttribute('aria-busy'), actions: m.getAttribute('actions') })));
const lazyTool = () => t.loaded().some(f => f === 'tool-call.js');

ok(await ev(new Function(`return ${sh('.greet')}.textContent === 'Hi there' && ${sh('.sugg')}.children.length === 2`)), 'empty state: greeting and suggestions');
ok(await ev(() => document.getElementById('c').shadowRoot.querySelector('[role=log]')?.getAttribute('aria-label') === 'Conversation'), 'the log is role=log with a name');
ok(!lazyTool(), 'tool-call.js is not loaded before an agent is connected');

// 1. no backend: jade-send says so
await ev(() => document.getElementById('c').send('hello').catch(e => (window.E1 = e.message)));
ok(/No agent/.test(await ev(() => window.E1)), 'without an agent or handler, send explains what to connect');
ok(await ev(() => !!document.getElementById('c').messages.at(-1).shadowRoot.querySelector('.err')), 'the error shows with Retry');

// 2. a kit-style agent: thinking, text, tool calls, route
await ev(() => { const c = document.getElementById('c'); c.clear(); c.agent = new FakeAgent([{ route: 'gpt-oss:120b' }, { think: 'Let me ' }, { think: 'look.' }, { wait: 30 }, { tool: { name: 'read', args: { path: '/a.txt' } }, result: 'file body' }, { text: 'The **file** says ' }, { text: 'hi.' }]); });
const out = await ev(() => document.getElementById('c').send('read a.txt'));
ok(out === 'The **file** says hi.', 'send resolves with the reply: ' + out);
ok(lazyTool(), 'connecting an agent loads tool-call.js: ' + t.loaded().join(' '));
const m = await msgs(); ok(m.length === 2 && m[0].role === 'user' && m[1].role === 'assistant' && m[1].busy === 'false', 'user + assistant messages, finished');
const r = await ev(() => { const a = document.getElementById('c').messages[1].shadowRoot; const tc = a.querySelector('jade-tool-call');
  return { think: a.querySelector('.think summary').textContent, thinkText: a.querySelector('.think .tb').textContent, strong: a.querySelector('.md strong')?.textContent, meta: a.querySelector('.meta').textContent,
    tool: tc.getAttribute('status'), tname: tc.name, res: tc.result, order: [...a.querySelector('.blocks').children].map(e => e.className || e.localName) }; });
ok(/Thought for/.test(r.think) && r.thinkText === 'Let me look.', 'thinking streams into a collapsible block: ' + r.think);
ok(r.tool === 'done' && r.tname === 'read' && r.res === 'file body', 'tool call card: done with its result');
ok(r.strong === 'file', 'markdown in the reply');
ok(r.meta === 'gpt-oss:120b', 'route shows the model');
ok(r.order.join() === 'think,jade-tool-call,md', 'blocks in order: ' + r.order.join());
ok((await msgs())[1].actions === 'copy regenerate' && (await msgs())[0].actions === 'copy edit', 'last reply can regenerate; last user message can edit');

// 3. regenerate: trims the agent's messages and runs again without a second user bubble
await ev(() => { const c = document.getElementById('c'); c.agent.script = [{ text: 'Second answer' }]; });
await ev(() => document.getElementById('c').regenerate());
const m3 = await msgs(); ok(m3.length === 2 && m3[1].text === 'Second answer', 'regenerate replaces the reply');
ok(await ev(() => { const a = document.getElementById('c').agent; return a.calls.at(-1).text === 'read a.txt' && a.messages.filter(x => x.role === 'user').length === 1; }), 'regenerate re-sends the same prompt with the agent history trimmed');

// 4. edit
await ev(() => document.getElementById('c').edit('read b.txt'));
const m4 = await msgs(); ok(m4.length === 2 && m4[0].text === 'read b.txt', 'edit changes the last user message and runs again');

// 5. approvals through beforeTool: deny, then allow, then always
await ev(() => { const c = document.getElementById('c'); c.clear(); const a = new FakeAgent([{ tool: { name: 'bash', args: { command: 'rm -rf /tmp/x' } }, result: 'removed' }, { text: 'done' }], { plugins: [c.approval(['bash'])] }); c.agent = a; window.P = c.send('clean up'); });
await page.waitForFunction(() => document.getElementById('c').messages[1]?.shadowRoot.querySelector('jade-tool-call')?.getAttribute('status') === 'waiting');
ok(true, 'the tool waits for approval');
await page.locator('jade-tool-call').getByRole('button', { name: 'Deny' }).click();
await ev(() => window.P);
const d = await ev(() => { const c = document.getElementById('c'); const tc = c.messages[1].shadowRoot.querySelector('jade-tool-call'); return { st: tc.getAttribute('status'), ran: c.agent.toolsRun.length, res: tc.result }; });
ok(d.st === 'denied' && d.ran === 0 && /denied/.test(d.res), 'Deny: the tool does not run and the agent is told');
await ev(() => { window.P = document.getElementById('c').send('again'); });
await page.waitForFunction(() => document.getElementById('c').messages[3]?.shadowRoot.querySelector('jade-tool-call')?.getAttribute('status') === 'waiting');
await page.locator('jade-message').nth(3).locator('jade-tool-call').getByRole('button', { name: 'Always allow bash' }).click();
await ev(() => window.P);
ok(await ev(() => document.getElementById('c').agent.toolsRun.length === 1), 'Always allow: the tool runs');
await ev(() => document.getElementById('c').send('third'));
ok(await ev(() => { const c = document.getElementById('c'); return c.agent.toolsRun.length === 2 && c.messages[5].shadowRoot.querySelector('jade-tool-call').getAttribute('status') === 'done'; }), '…and is not asked again');

// 6. stop: mid-stream, and while waiting for approval
await ev(() => { const c = document.getElementById('c'); c.clear(); c.agent = new FakeAgent([{ text: 'partial ' }, { wait: 5000 }, { text: 'never' }]); window.P = c.send('long'); });
await page.waitForFunction(() => document.getElementById('c').messages[1]?.text === 'partial ');
ok(await ev(() => document.getElementById('c').hasAttribute('busy') && document.getElementById('c').composer.busy), 'busy while running; the composer shows Stop');
await page.keyboard.press('Escape'); // focus is not in the composer: use the button
await page.locator('jade-composer').getByRole('button', { name: 'Stop' }).click();
await ev(() => window.P);
const s6 = await ev(() => { const c = document.getElementById('c'); const m = c.messages[1]; return { text: m.text, note: m.shadowRoot.querySelector('.note')?.textContent, busy: c.busy }; });
ok(s6.text === 'partial ' && s6.note === 'Stopped' && !s6.busy, 'Stop keeps what streamed and notes it was stopped');
await ev(() => { const c = document.getElementById('c'); c.clear(); c.agent = new FakeAgent([{ tool: { name: 'write', args: { path: '/x' } } }, { text: 'wrote' }], { plugins: [c.approval(true)] }); window.P = c.send('write'); });
await page.waitForFunction(() => document.getElementById('c').messages[1]?.shadowRoot.querySelector('jade-tool-call')?.getAttribute('status') === 'waiting');
await ev(() => document.getElementById('c').stop()); await ev(() => window.P);
ok(await ev(() => document.getElementById('c').agent.toolsRun.length === 0 && !document.getElementById('c').busy), 'stopping while asking denies the tool');

// 7. errors and retry
await ev(() => { const c = document.getElementById('c'); c.clear(); c.agent = new FakeAgent([{ text: 'x' }, { throw: 'model unavailable' }]); return c.send('hi').catch(() => {}); });
ok(await ev(() => /model unavailable/.test(document.getElementById('c').messages[1].shadowRoot.querySelector('.err').textContent)), 'errors show in the reply');
await ev(() => { document.getElementById('c').agent.script = [{ text: 'recovered' }]; });
await page.locator('jade-message').nth(1).getByRole('button', { name: 'Retry' }).click();
await page.waitForFunction(() => document.getElementById('c').messages[1]?.text === 'recovered' && !document.getElementById('c').busy);
ok((await msgs()).length === 2, 'Retry runs again in place');

// 8. handler mode, composer, images, queue
await ev(() => { const c = document.getElementById('c'); c.clear(); c.agent = null; c.handler = async (text, reply, o) => { for (const w of ['Echo: ', text]) { reply.append(w); await new Promise(r => setTimeout(r, 5)); } window.H = o; }; });
await page.locator('jade-composer textarea').fill('typed message');
await page.locator('jade-composer textarea').press('Enter');
await page.waitForFunction(() => document.getElementById('c').messages[1]?.text === 'Echo: typed message' && !document.getElementById('c').busy);
ok(await ev(() => document.getElementById('c').composer.value === ''), 'Enter sends and clears the composer');
await page.locator('jade-composer textarea').fill('line 1'); await page.locator('jade-composer textarea').press('Shift+Enter'); await page.keyboard.type('line 2');
ok(await ev(() => document.getElementById('c').composer.value === 'line 1\nline 2'), 'Shift+Enter makes a new line');
await ev(() => { document.getElementById('c').composer.value = ''; });
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
await ev(async png => { const b = await (await fetch(png)).blob(); await document.getElementById('c').composer.addFiles([new File([b], 'dot.png', { type: 'image/png' })]); }, png);
ok(await ev(() => document.getElementById('c').composer.shadowRoot.querySelectorAll('.chip').length === 1), 'attached image shows as a chip');
await page.locator('jade-composer textarea').fill('look'); await page.locator('jade-composer textarea').press('Enter');
await page.waitForFunction(() => !document.getElementById('c').busy && document.getElementById('c').messages.length === 4);
ok(await ev(() => window.H.images.length === 1 && window.H.images[0].base64.length > 10 && document.getElementById('c').messages[2].shadowRoot.querySelectorAll('.imgs img').length === 1), 'images reach the handler and show on the message');
ok(await ev(() => window.H.history.length === 2), 'the handler gets the history');
await ev(() => { const c = document.getElementById('c'); window.Q = Promise.all([c.send('one'), c.send('two')]); });
const q = await ev(() => window.Q); ok(q[0] === 'Echo: one' && q[1] === 'Echo: two', 'sends while busy are queued in order');
// jade-send event mode
await ev(() => { const c = document.getElementById('c'); c.handler = null; c.addEventListener('jade-send', e => { e.preventDefault(); e.detail.reply.append('from event'); e.detail.reply.finish(); }, { once: true }); });
ok((await ev(() => document.getElementById('c').send('evt'))) === 'from event', 'jade-send: the app answers through the event');
// suggestions send
await ev(() => { const c = document.getElementById('c'); c.clear(); c.handler = async (t, r) => r.append('S:' + t); });
await page.getByRole('button', { name: 'Second' }).click();
await page.waitForFunction(() => document.getElementById('c').messages[1]?.text === 'S:the second prompt');
ok(true, 'a suggestion sends its prompt');

// 9. stick to bottom, and the jump button when the person scrolls up
await ev(async () => { const c = document.getElementById('c'); c.clear(); c.handler = async (t, r) => { for (let i = 0; i < 40; i++) { r.append(`Line ${i}\n\n`); await new Promise(x => setTimeout(x, 2)); } }; await c.send('many'); await c.send('more'); });
await sleep(100);
const atEnd = () => ev(() => { const l = document.getElementById('c').shadowRoot.querySelector('.log'); return l.scrollHeight - l.scrollTop - l.clientHeight < 81; });
ok(await atEnd(), 'follows the stream to the bottom');
await ev(() => { const c = document.getElementById('c'); c.handler = async (t, r) => { for (let i = 0; i < 30; i++) { r.append(`More ${i}\n\n`); await new Promise(x => setTimeout(x, 25)); } }; window.P = c.send('even more'); });
await sleep(200); await page.mouse.move(400, 300); await page.mouse.wheel(0, -1500);
await ev(() => window.P); await sleep(150);
ok(!(await atEnd()), 'does not pull the person down while they read history');
ok(await ev(() => !document.getElementById('c').shadowRoot.querySelector('.jump').hidden), 'shows the jump-to-latest button');
await page.locator('jade-chat').getByRole('button', { name: /new|Latest/ }).click(); await page.waitForFunction(() => { const l = document.getElementById('c').shadowRoot.querySelector('.log'); return l.scrollHeight - l.scrollTop - l.clientHeight < 81; }, null, { timeout: 4000 }).catch(async () => console.log('d=', await ev(() => { const l = document.getElementById('c').shadowRoot.querySelector('.log'); return [l.scrollHeight, l.scrollTop, l.clientHeight]; })));
ok(await atEnd(), 'the jump button returns to the latest message');
// status announcements
ok(await ev(() => /replied/.test(document.getElementById('c').shadowRoot.querySelector('[role=status]').textContent)), 'announces once when the reply is done');
await t.done();
