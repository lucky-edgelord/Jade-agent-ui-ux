// Markdown: what it renders, and that nothing unsafe gets through.
import { start } from './_harness.mjs';
const t = await start(); const { ok, ev } = t;
await ev(async () => { window.M = await import(window.FROM + 'markdown.js'); });
const md = s => ev(s => M.renderMarkdown(s), s);

// safety: no element or attribute from the source, only safe URLs
const evil = [
  '<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '[x](javascript:alert(1))', '[x](JAVASCRIPT:alert(1))', '[x]( javascript:alert(1))',
  '![x](javascript:alert(1))', '![x](data:text/html;base64,PHNjcmlwdD4=)', '![x](http://insecure/x.png)', '<a href="javascript:x">y</a>',
  '[x](https://ok.test" onmouseover="alert(1))', '`<b>`', '```\n</code></pre><script>x</script>\n```', '| a |\n|---|\n| <i onclick=x> |', '**<svg onload=x>**',
  '[a](https://x.test/?q=<script>)', 'https://x.test/"onmouseover="alert(1)', '<iframe src="https://evil">',
];
for (const s of evil) {
  const html = await md(s);
  const bad = await ev(h => { const d = document.createElement('div'); d.innerHTML = h; const els = [...d.querySelectorAll('*')];
    const tagOk = els.every(e => ['P', 'A', 'IMG', 'CODE', 'PRE', 'DIV', 'SPAN', 'BUTTON', 'STRONG', 'EM', 'DEL', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'BR', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR', 'INPUT'].includes(e.tagName));
    const attrOk = els.every(e => [...e.attributes].every(a => ['href', 'src', 'alt', 'target', 'rel', 'class', 'type', 'aria-label', 'data-lang', 'data-open', 'disabled', 'checked', 'style', 'loading', 'start'].includes(a.name)));
    const urlOk = [...d.querySelectorAll('[href],[src]')].every(e => /^(https?:\/\/|mailto:|#|data:image\/)/i.test(e.getAttribute('href') ?? e.getAttribute('src')));
    const styleOk = [...d.querySelectorAll('[style]')].every(e => /^text-align:(left|right|center)$/.test(e.getAttribute('style')));
    return tagOk && attrOk && urlOk && styleOk ? '' : h; }, html);
  ok(!bad, 'safe: ' + JSON.stringify(s).slice(0, 60) + (bad ? ' → ' + bad : ''));
}
ok((await md('<b>hi</b>')).includes('&lt;b&gt;hi&lt;/b&gt;'), 'HTML is shown as text');

// features
const has = (h, ...parts) => parts.every(p => h.includes(p));
ok(has(await md('# Title\n## Sub'), '<h1>Title</h1>', '<h2>Sub</h2>'), 'headings');
ok(has(await md('**b** *i* ~~s~~ `c` _u_'), '<strong>b</strong>', '<em>i</em>', '<del>s</del>', '<code>c</code>', '<em>u</em>'), 'inline styles');
ok(!(await md('snake_case_name and 2*3*4')).includes('<em>'), 'no emphasis inside words or arithmetic');
ok(has(await md('[site](https://a.test) and https://b.test.'), 'href="https://a.test"', 'href="https://b.test"', 'rel="noopener noreferrer"'), 'links and autolinks (trailing dot excluded)');
ok(has(await md('- a\n- b\n  - c\n- d'), '<ul><li>a</li><li>b<ul><li>c</li></ul></li><li>d</li></ul>'), 'nested lists: ' + await md('- a\n- b\n  - c\n- d'));
ok(has(await md('3. x\n4. y'), '<ol start="3">'), 'ordered lists keep their start');
ok(has(await md('- [x] done\n- [ ] todo'), 'type="checkbox" disabled checked', 'class="task"'), 'task lists');
ok(has(await md('| a | b |\n|---|--:|\n| 1 | 2 |'), '<th>a</th>', 'text-align:right', '<td>1</td>'), 'tables');
ok(has(await md('> quote\n> more'), '<blockquote><p>quote<br>more</p></blockquote>'), 'blockquotes');
ok(has(await md('```py\nprint(1)\n```'), 'data-lang="py"', 'print(1)', 'class="copy"'), 'fenced code with a copy button');
ok(has(await md('```js\nconst a = 1\nstill going'), 'data-open', 'still going'), 'an unclosed fence (mid-stream) still renders as code');
ok(has(await md('line one\nline two'), 'line one<br>line two'), 'single newlines are line breaks');
ok(has(await md('a\n\n---\n\nb'), '<hr>'), 'rules');
ok(has(await md('\\*not em\\*'), '*not em*'), 'escapes');
ok(has(await md('![cat](https://x.test/c.png)'), '<img src="https://x.test/c.png" alt="cat"'), 'https images');
// streaming through the element: renders once per frame, copy works
await ev(async () => { await UI.load('markdown'); const m = document.createElement('jade-markdown'); m.id = 'mm'; document.body.append(m); for (const ch of 'Hello **wor') m.append(ch); });
await t.page.waitForFunction(() => document.getElementById('mm').shadowRoot.querySelector('.md').textContent.includes('Hello **wor'));
await ev(() => document.getElementById('mm').append('ld**'));
await t.page.waitForFunction(() => document.getElementById('mm').shadowRoot.querySelector('strong')?.textContent === 'world');
ok(true, 'streamed markdown re-renders as it completes');
await ev(() => { document.getElementById('mm').text = '```\ncopy me\n```'; });
await t.page.locator('#mm').locator('.copy').click();
ok((await ev(() => navigator.clipboard.readText())) === 'copy me', 'copy button copies the code');
await t.done();
