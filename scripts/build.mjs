// Build dist/: one minified ES module per element (shared code in small chunk files), so a page downloads only what it
// shows. dist/jade-ui.js is the loader. Also writes dist/catalog.json and dist/llms.txt (the catalog, for AI agents).
import { build } from 'esbuild';
import fs from 'node:fs';
import zlib from 'node:zlib';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)));
const src = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
if (!src.includes(`VERSION = '${pkg.version}'`)) throw new Error(`src/index.js VERSION does not match package.json (${pkg.version})`);
export const ENTRIES = {
  'jade-ui': 'src/index.js', theme: 'src/theme.js', chat: 'src/chat.js', 'chat-widget': 'src/chat-widget.js', chart: 'src/chart.js', 'chart-core': 'src/chart-core.js', message: 'src/message.js', composer: 'src/composer.js', 'tool-call': 'src/tool-call.js',
  markdown: 'src/markdown.js', code: 'src/code.js', highlight: 'src/highlight.js', surface: 'src/surface.js', 'theme-toggle': 'src/theme-toggle.js',
  catalog: 'src/catalog.js', 'agent-tools': 'src/agent-tools.js',
  auth: 'src/auth.js', pricing: 'src/pricing.js', account: 'src/account.js', 'base-client': 'src/base-client.js',
  'surface/layout': 'src/surface/layout.js', 'surface/content': 'src/surface/content.js', 'surface/inputs': 'src/surface/inputs.js', 'surface/data': 'src/surface/data.js', 'surface/charts': 'src/surface/charts.js',
  'themes/midnight': 'src/themes/midnight.js', 'themes/paper': 'src/themes/paper.js', 'themes/contrast': 'src/themes/contrast.js',
};
const banner = `/*! Jade Agent UI/UX ${pkg.version} | MIT | https://github.com/lucky-edgelord/Jade-agent-ui-ux */`;
fs.rmSync('dist', { recursive: true, force: true });
const r = await build({ entryPoints: ENTRIES, bundle: true, splitting: true, format: 'esm', target: 'es2022', platform: 'browser', minify: true, sourcemap: 'linked',
  outdir: 'dist', entryNames: '[dir]/[name]', outbase: 'src', chunkNames: 'chunk-[hash]', banner: { js: banner }, logLevel: 'warning', legalComments: 'none', metafile: true });
fs.writeFileSync('dist/meta.json', JSON.stringify(r.metafile));

// the catalog for agents
const cat = await import(new URL('../src/catalog.js', import.meta.url));
fs.writeFileSync('dist/catalog.json', JSON.stringify({ version: pkg.version, ...cat.json() }, null, 1) + '\n');
const el = Object.entries(cat.ELEMENTS).map(([tag, e]) => [`### <${tag}>`, e.description,
  e.attributes && 'Attributes: ' + Object.entries(e.attributes).map(([k, v]) => `${k}${v ? ` (${v})` : ''}`).join('; '),
  e.properties && 'Properties: ' + Object.entries(e.properties).map(([k, v]) => `${k}${v ? ` (${v})` : ''}`).join('; '),
  e.methods && 'Methods: ' + Object.entries(e.methods).map(([k, v]) => `${k}${v ? ` (${v})` : ''}`).join('; '),
  e.events && 'Events: ' + Object.entries(e.events).map(([k, v]) => `${k}${v ? ` ${v}` : ''}`).join('; '),
  e.parts && 'CSS parts: ' + e.parts.join(', ')].filter(Boolean).join('\n')).join('\n\n');
const CDN = `https://cdn.jsdelivr.net/gh/lucky-edgelord/Jade-agent-ui-ux@v${pkg.version}/dist/`;
fs.writeFileSync('dist/llms.txt', `# Jade Agent UI/UX ${pkg.version}

> Themeable, lazy-loaded web components for AI agents, from a CDN. Made for Jade Agent Kit. Load ${CDN}jade-ui.js once;
> each <jade-*> element downloads its module the first time it appears. Machine-readable: ${CDN}catalog.json

## Use it
\`\`\`html
<script type="module">
  import { setTheme } from '${CDN}jade-ui.js';
  import { createKit } from 'https://cdn.jsdelivr.net/gh/lucky-edgelord/Jade-agent-kit@v3.0.0/dist/jade-agent-kit.js';
  const kit = await createKit({ ollamaKey: '…' });
  await document.querySelector('jade-chat').connect(kit, { approve: ['bash', 'write', 'edit'] });
</script>
<jade-chat style="height:100vh" suggestions='["What can you do?"]'></jade-chat>
\`\`\`

## Theming
setTheme({ preset, mode: 'auto'|'light'|'dark', density: 'compact'|'cozy'|'comfortable', radius, tokens, target }).
Presets: ${cat.PRESETS.join(', ')}. Tokens (CSS custom properties): ${cat.TOKENS.map(t => '--jade-' + t).join(', ')}.
Every element also exposes ::part() names (below).

## Elements
${el}

## Surfaces: UI an agent builds at runtime
${cat.prompt()}
`);

const outs = r.metafile.outputs; const gz = f => zlib.gzipSync(fs.readFileSync(f)).length;
const closure = (f, seen = new Set()) => { if (seen.has(f)) return seen; seen.add(f); for (const i of outs[f]?.imports || []) if (i.kind === 'import-statement') closure(i.path, seen); return seen; };
for (const name of Object.keys(ENTRIES)) { const f = `dist/${name}.js`; const files = [...closure(f)]; const z = files.reduce((a, x) => a + gz(x), 0); const own = gz(f);
  console.log(`${name.padEnd(17)} ${(own / 1024).toFixed(1).padStart(5)} KB gzip alone, ${(z / 1024).toFixed(1).padStart(5)} KB with what it imports`); }
