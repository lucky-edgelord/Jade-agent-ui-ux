// The loader, lazy loading and theming.
import { start, sleep } from './_harness.mjs';
const t = await start(); const { ok, ev } = t;

ok((await ev(() => UI.VERSION)) === '1.0.0', 'VERSION');
ok(t.loaded().every(f => /^(jade-ui|theme|index|chunk-[\w]+)\.js$/.test(f)), 'importing the loader fetches only the core: ' + t.loaded().join(', '));
// nothing is defined until it appears
ok(!(await ev(() => !!customElements.get('jade-chat'))), 'jade-chat is not loaded before it is used');
await ev(() => { document.getElementById('app').innerHTML = '<jade-markdown text="**hi**"></jade-markdown>'; });
await t.page.waitForFunction(() => customElements.get('jade-markdown'));
ok(await ev(() => document.querySelector('jade-markdown').shadowRoot.querySelector('strong')?.textContent === 'hi'), 'autoload defines jade-markdown when it appears');
ok(!t.loaded().some(f => /^(chat|surface|tool-call|highlight|agent-tools|catalog)\.js$/.test(f)), 'unused modules are not fetched');
// a nested, later insertion
await ev(() => { const d = document.createElement('div'); d.innerHTML = '<section><jade-code lang="js">const a = 1</jade-code></section>'; document.body.append(d); });
await t.page.waitForFunction(() => customElements.get('jade-code'));
await t.page.waitForFunction(() => document.querySelector('jade-code').shadowRoot.querySelector('pre[data-hl]'));
ok(t.loaded().includes(t.from.startsWith('src') ? 'highlight.js' : 'highlight.js'), 'the highlighter loads with the first code block');
ok(await ev(() => document.querySelector('jade-code').shadowRoot.querySelector('.k')?.textContent === 'const'), 'code is highlighted');
// load()
await ev(() => UI.load('tool-call', 'jade-composer'));
ok(await ev(() => !!customElements.get('jade-tool-call') && !!customElements.get('jade-composer')), 'load() defines by short or full name');
ok(await ev(() => UI.load('nope').then(() => false, e => /unknown element/.test(e.message))), 'load() rejects unknown elements');

// theme: the default is applied by the first element; presets load when used
ok(await ev(() => getComputedStyle(document.documentElement).getPropertyValue('--jade-accent').trim() === '#0b7a5b'), 'default theme applied');
ok(!t.loaded().some(f => f.includes('midnight')), 'other presets are not fetched up front');
await ev(() => UI.setTheme({ preset: 'midnight', mode: 'dark' }));
ok(t.loaded().some(f => f.includes('midnight')), 'a preset downloads when chosen');
ok(await ev(() => getComputedStyle(document.documentElement).getPropertyValue('--jade-accent').trim() === '#8b85ff'), 'preset + mode applied');
await ev(() => UI.setTheme({ tokens: { accent: '#e11d48' }, density: 'compact', radius: 4 }));
ok(await ev(() => { const s = getComputedStyle(document.documentElement); return s.getPropertyValue('--jade-accent').trim() === '#e11d48' && s.getPropertyValue('--jade-space').trim() === '6px' && s.getPropertyValue('--jade-radius').trim() === '4px'; }), 'tokens, density and radius override; options merge');
ok(await ev(() => UI.getTheme().preset === 'midnight'), 'getTheme keeps the merged options');
ok(await ev(() => UI.setTheme({ tokens: { nope: 'x' } }).then(() => false, e => /unknown token/.test(e.message))), 'unknown tokens are rejected');
await ev(() => { const s = document.createElement('div'); s.id = 'scoped'; s.innerHTML = '<jade-markdown text="x"></jade-markdown>'; document.body.append(s); return UI.setTheme({ target: s, preset: 'paper', mode: 'light' }); });
ok(await ev(() => getComputedStyle(document.querySelector('#scoped jade-markdown')).getPropertyValue('--jade-accent').trim() === '#a14a1f' && getComputedStyle(document.documentElement).getPropertyValue('--jade-accent').trim() === '#e11d48'), 'scoped theme affects only its target');
// tokens cross shadow DOM
ok(await ev(() => getComputedStyle(document.querySelector('jade-markdown').shadowRoot.querySelector('.md')).getPropertyValue('--jade-accent').trim().length > 0), 'tokens reach inside shadow roots');
// catalog lazily
const cat = await ev(async () => { const c = await UI.catalog(); return { n: Object.keys(c.COMPONENTS).length, p: c.prompt().length, el: Object.keys(c.ELEMENTS).length }; });
ok(cat.n >= 25 && cat.el === 8 && cat.p > 2000, `catalog: ${cat.n} components, ${cat.el} elements, prompt ${cat.p} chars`);
await t.done();
