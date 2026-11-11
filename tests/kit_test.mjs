// With the real Jade Agent Kit (next to this repository, or $JAK_DIR): chat.connect(kit), a model that builds UI with
// ui_render, the person fills it in and presses a button, the action goes back to the agent; approvals on a real tool.
import { start, hasKit, KIT, sleep } from './_harness.mjs';
if (!hasKit) { console.log(`SKIP: no Jade Agent Kit at ${KIT} (set JAK_DIR)`); process.exit(0); }
const t = await start(); const { ok, ev, page } = t;
await ev(async () => {
  const { createKit } = await import('/kit/dist/jade-agent-kit.js');
  window.kit = await createKit({ assetsBase: '/kit/assets/' });
  // a stand-in for Ollama: streams chunks like /api/chat, and plays a script by turn
  window.model = { cloud: false, host: 'fake', requests: [], async *chat(req) {
    this.requests.push(JSON.parse(JSON.stringify({ messages: req.messages, tools: req.tools.map(t => t.function.name) })));
    const msgs = req.messages; const last = msgs.at(-1); const userText = msgs.filter(m => m.role === 'user').at(-1).content;
    const call = (name, args) => ({ message: { tool_calls: [{ function: { name, arguments: args } }] } });
    if (last.role === 'user' && /sign me up/.test(userText)) {
      yield { message: { thinking: 'A form is best.' } };
      yield call('ui_render', { components: [
        { id: 'root', component: 'Card', props: { title: 'Newsletter' }, children: ['email', 'go'] },
        { id: 'email', component: 'TextField', props: { label: 'Email', bind: '/email', type: 'email', required: true } },
        { id: 'go', component: 'Button', props: { label: 'Subscribe', variant: 'primary', action: { name: 'subscribe', data: { email: { $data: '/email' } } } } },
      ], data: { email: '' } });
      return;
    }
    if (last.role === 'tool' && last.tool_name === 'ui_render') { for (const w of ['Fill ', 'this ', 'in.']) yield { message: { content: w } }; return; }
    if (last.role === 'user' && /^\[ui action\]/.test(userText)) { yield call('ui_update', { surface: 'ui-1', components: [{ id: 'root', component: 'Alert', props: { tone: 'ok', title: 'Subscribed', text: 'Thanks, {{/email}}!' } }] }); return; }
    if (last.role === 'tool' && last.tool_name === 'ui_update') { yield { message: { content: 'You are subscribed.' } }; return; }
    if (last.role === 'user' && /run it/.test(userText)) { yield call('bash', { command: 'echo hello from the kit' }); return; }
    if (last.role === 'tool' && last.tool_name === 'bash') { yield { message: { content: 'Output: ' + last.content.trim() } }; return; }
    yield { message: { content: 'ok' } };
  } };
  document.getElementById('app').innerHTML = '<jade-chat id="c"></jade-chat>';
  await customElements.whenDefined('jade-chat');
  await document.getElementById('c').connect(kit, { ollama: model, model: 'fake', approve: ['bash'] });
});
ok(t.loaded().includes('agent-tools.js'), 'connect() loads the UI tools');
const sys = await ev(() => document.getElementById('c').agent.toolNames && true);
ok(sys, 'a kit agent is connected');

// 1. the agent builds a form inline
const out = await ev(() => document.getElementById('c').send('sign me up for the newsletter'));
ok(out === 'Fill this in.', 'reply: ' + out);
const req0 = await ev(() => model.requests[0]);
ok(req0.tools.includes('ui_render') && req0.tools.includes('ui_update') && req0.tools.includes('bash'), 'the model is offered the UI tools with the kit tools: ' + req0.tools.join(','));
ok(/## Building UI/.test(req0.messages[0].content) && /TextField/.test(req0.messages[0].content), 'the system prompt teaches the catalog');
const toolRes = await ev(() => model.requests[1].messages.at(-1).content);
ok(/Rendered surface "ui-1" \(3 components\)/.test(toolRes), 'ui_render reports back to the model: ' + toolRes);
const S = page.locator('jade-chat jade-surface');
ok(await S.getByRole('heading', { name: 'Newsletter' }).isVisible(), 'the form shows inside the reply');
ok(t.loaded().includes('surface.js') && !t.loaded().includes('surface/data.js'), 'only the surface groups used were loaded');

// 2. the person fills it in and presses the button → the agent gets the action and updates the UI
await S.getByRole('button', { name: 'Subscribe' }).click();
ok((await ev(() => model.requests.length)) === 2, 'required field blocks the action (no new model call)');
await S.getByLabel('Email').fill('grace@x.test');
await S.getByRole('button', { name: 'Subscribe' }).click();
await page.waitForFunction(() => !document.getElementById('c').busy && document.getElementById('c').messages.length === 4, null, { timeout: 10000 });
const act = await ev(() => model.requests[2].messages.filter(m => m.role === 'user').at(-1).content);
ok(/^\[ui action\] surface "ui-1", action "subscribe"/.test(act) && /"email":"grace@x.test"/.test(act), 'the action reaches the agent with the data: ' + act.replace(/\n/g, ' '));
ok(await ev(() => document.getElementById('c').messages[2].text === '▸ subscribe' && document.getElementById('c').messages[2].getAttribute('kind') === 'action'), 'the action shows as a compact chip, not raw JSON');
ok(await S.getByText('Thanks, grace@x.test!').isVisible(), 'ui_update replaced the form with a confirmation that reads the data');
ok((await ev(() => document.getElementById('c').messages[3].text)) === 'You are subscribed.', 'and the agent answered');
const read = await ev(() => kit.tool('ui_read', { surface: 'ui-1' }));
ok(JSON.parse(read).data.email === 'grace@x.test', 'ui_read returns what the person entered');
ok(/surfaces/.test(await ev(() => kit.tool('ui_read', {}))), 'ui_read with no surface lists them');
ok(/TextField\* ?|- TextField/.test(await ev(() => kit.tool('ui_components', { names: ['TextField'] }))), 'ui_components describes components');
await ev(() => kit.tool('ui_theme', { preset: 'paper', mode: 'dark' }));
ok(await ev(() => getComputedStyle(document.documentElement).getPropertyValue('--jade-accent').trim() === '#e39a6b'), 'ui_theme restyles the app');

// 3. a page surface the agent can draw on by name
await ev(() => { const s = document.createElement('jade-surface'); s.setAttribute('name', 'sidebar'); document.body.append(s); });
const pr = await ev(() => kit.tool('ui_render', { surface: 'sidebar', components: [{ id: 'root', component: 'Stat', props: { label: 'Open tasks', value: 3 } }] }));
ok(/Rendered surface "sidebar"/.test(pr) && await page.locator('jade-surface[name=sidebar]').getByText('Open tasks').isVisible(), 'ui_render draws on a named page surface');
ok(/no surface named "nope"/.test(await ev(() => kit.tool('ui_update', { surface: 'nope' }))), 'unknown surfaces are reported');

// 4. approval on a real kit tool (bash runs in the kit's BusyBox)
await ev(() => { window.P = document.getElementById('c').send('run it'); });
await page.waitForFunction(() => document.getElementById('c').messages.at(-1)?.shadowRoot.querySelector('jade-tool-call')?.getAttribute('status') === 'waiting', null, { timeout: 10000 });
ok(true, 'bash waits for approval');
await page.locator('jade-message').last().getByRole('button', { name: 'Allow', exact: true }).click();
const o4 = await ev(() => window.P);
ok(o4 === 'Output: hello from the kit', 'allowed: the kit ran it: ' + o4);
await t.done();
