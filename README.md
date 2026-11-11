# Jade Agent UI/UX

Web components for AI agents, loaded from a CDN with one import. They are themeable, lazy all the way down, and made
for [Jade Agent Kit](https://github.com/lucky-edgelord/Jade-agent-kit). Any agent backend works too.

- **`<jade-chat>`**: a complete agent chat. It streams text and thinking, shows tool calls (and asks before the tools
  you name), and has stop, regenerate, edit, retry, copy, suggestions and image attachments. It stays at the bottom
  unless the person scrolls up to read, with a "jump to latest" button, and screen readers hear one announcement per
  reply instead of one per token.
- **`<jade-surface>`**: UI that **an agent builds** at runtime from declarative JSON, in the shape of Google's A2UI.
  The agent chooses components from a catalog this library owns, binds them to a data model, and gets the person's
  button presses back as actions. No HTML, script or style from the agent ever reaches the page.
- **Agent tools** for Jade Agent Kit: `ui_render`, `ui_update`, `ui_read`, `ui_components`, `ui_theme`.
- **A catalog for agents**: [`dist/catalog.json`](dist/catalog.json) and [`dist/llms.txt`](dist/llms.txt) describe
  every element, prop, event, CSS part and surface component, so a coding agent can build pages with it too.
- **Theming** with `--jade-*` design tokens: four presets, light/dark/auto, density, radius, `::part()`, and scoped themes.
- Also `<jade-markdown>` (safe, streaming), `<jade-code>`, `<jade-message>`, `<jade-composer>`, `<jade-tool-call>`
  and `<jade-theme-toggle>`.

## Quick start

```html
<script type="module" src="https://cdn.jsdelivr.net/gh/lucky-edgelord/Jade-agent-ui-ux@v1.0.0/dist/jade-ui.js"></script>

<jade-chat style="height:100vh" suggestions='["What can you do?", "Make me a form"]' attach></jade-chat>

<script type="module">
  import { createKit } from 'https://cdn.jsdelivr.net/gh/lucky-edgelord/Jade-agent-kit@v3.0.0/dist/jade-agent-kit.js';
  const kit = await createKit({ ollamaKey: '…', persist: 'my-app' });
  await customElements.whenDefined('jade-chat');
  await document.querySelector('jade-chat').connect(kit, { brain: true, approve: ['bash', 'write', 'edit'] });
</script>
```

`connect(kit, options)` makes a kit agent (`kit.agent(options)`). It adds approval cards for the tools in `approve`,
and the UI tools with a short guide to the catalog in the system prompt (`ui: false` turns that off). Always pin a
version (`@v1.0.0`). Open [`examples/index.html`](examples/index.html) for a demo that runs without a model.

### Any other backend

```js
chat.handler = async (text, reply, { images, signal, history }) => {
  for await (const token of myStream(text, { signal })) reply.append(token);   // also reply.thinking(), reply.tool(name, args)
};
// or: chat.agent = anything with prompt(text, { images }), abort(), messages and onEvent (kit events)
// or: chat.addEventListener('jade-send', e => { e.preventDefault(); /* write to e.detail.reply, then reply.finish() */ });
```

## Lazy loading

`jade-ui.js` is only a loader (2.4 KB gzipped, with the default theme). It watches the page and downloads an
element's module the first time its tag appears. Inside the elements it is the same: the tool-call card loads with an
agent, the syntax highlighter with the first code block, each group of surface components when a spec first uses it,
and each theme preset when it is chosen.

| What | Loads when | gzip, with what it imports |
| --- | --- | --- |
| `jade-ui.js` (loader, theme) | you import it | 2.4 KB |
| `chat.js` (+ message, composer, markdown) | `<jade-chat>` appears | 16.4 KB |
| `tool-call.js` | an agent is connected, or the first tool call | 5.7 KB |
| `highlight.js` | the first code block | 1.6 KB |
| `surface.js` | `<jade-surface>` appears, or an agent first builds UI | 14.7 KB |
| `surface/layout.js`, `content.js`, `inputs.js`, `data.js` | a spec uses one of their components | 1.3, 1.0, 2.1, 1.5 KB |
| `agent-tools.js` (+ catalog) | `chat.connect()` or `uiTools()` | 9.6 KB |
| `themes/midnight.js`, `paper.js`, `contrast.js` | that preset is chosen | 0.3 KB each |

```js
import { load, stopAutoload } from '…/dist/jade-ui.js';
await load('chat', 'surface');            // fetch ahead of time
stopAutoload();                           // or load only what you ask for
import '…/dist/surface.js';               // or skip the loader: every module defines its own element
```

## Theming

Every element reads CSS custom properties, which pass into shadow DOM. Set them with `setTheme()` or plain CSS:

```js
import { setTheme } from '…/dist/jade-ui.js';
await setTheme({ preset: 'midnight', mode: 'auto', density: 'compact', radius: 8, tokens: { accent: '#e11d48' } });
await setTheme({ target: document.querySelector('#sidebar'), preset: 'paper', mode: 'dark' });   // one part of the page
```

```css
:root { --jade-accent: #e11d48; --jade-radius: 4px; --jade-font: "Inter", sans-serif; }
jade-chat::part(bubble) { box-shadow: none; }
jade-chat::part(composer-send) { border-radius: 8px; }
jade-surface::part(card) { border-width: 2px; }
```

- **Presets**: `jade` (default), `midnight`, `paper`, `contrast`, each with light and dark.
- **Modes**: `auto` follows the system, or `light` / `dark`. `<jade-theme-toggle presets>` cycles the mode, picks a
  preset and remembers the choice.
- **Tokens**: `bg`, `surface`, `surface-2`, `fg`, `muted`, `border`, `accent`, `accent-fg`, `user`, `user-fg`, `code`,
  `ok`, `warn`, `danger`, `syn-k`, `syn-s`, `syn-n`, `syn-c`, `radius`, `space`, `font`, `mono`, `font-size`, `shadow`,
  `focus`. Each is `--jade-<token>`. `--jade-chat-width` sets the conversation's width.
- **Parts**: every element lists its `::part()` names in the catalog.

## The chat

| Pattern | How |
| --- | --- |
| Streaming | Text renders as markdown once per frame; an unclosed code fence or list still renders while it streams. |
| Thinking | A collapsible "Thinking…" block that becomes "Thought for N s". |
| Tool calls | A card per call: name, an argument preview, status and timing; expand for arguments and the result. |
| Approval | `approve: ['bash']` (or `chat.approval(tools)` as a kit plugin) shows Allow, Always allow, Deny. Deny tells the agent not to retry; Stop denies a pending approval. |
| Stop | The send button becomes Stop (or press Escape); what streamed stays, marked "Stopped". |
| Regenerate, edit, retry | On the last reply and the last message; the kit agent's history is trimmed to match. |
| Scrolling | Follows the stream at the bottom; scrolling up (wheel, touch, keys, scrollbar) pauses it and shows "N new". |
| Accessibility | `role="log"`; each message is labelled; `aria-busy` while streaming; one status announcement per reply; keyboard throughout. |
| Input | Grows with the text; Enter sends, Shift+Enter is a new line; attach, paste or drop images (`attach`); sends while busy are queued. |

Events: `jade-run`, `jade-done`, `jade-tool`, `jade-action`, `jade-approval`, and `jade-send` without a backend.

## UI an agent builds: surfaces

An agent describes UI as a flat list of components that point at their children by id, plus a data model:

```js
await surface.render({
  root: 'root',
  components: [
    { id: 'root', component: 'Card', props: { title: 'Book a table' }, children: ['when', 'size', 'go'] },
    { id: 'when', component: 'TextField', props: { label: 'Date', type: 'date', bind: '/booking/date', required: true } },
    { id: 'size', component: 'Slider', props: { label: 'Guests', bind: '/booking/guests', min: 1, max: 12 } },
    { id: 'go', component: 'Button', props: { label: 'Book for {{/booking/guests}}', variant: 'primary',
      action: { name: 'book', data: { $data: '/booking' } } } },
  ],
  data: { booking: { date: '', guests: 2 } },
});
surface.addEventListener('jade-action', e => console.log(e.detail));   // { surface, name: 'book', data, values }
```

- **Components** (27). Layout: Column, Row, Grid, Card, Tabs, Divider, Spacer. Content: Heading, Text (markdown),
  Badge, Image, Code, Alert, Link. Inputs: Button, TextField, TextArea, Select, RadioGroup, Checkbox, Switch, Slider.
  Data: Stat, Progress, Table, List (with item templates), KeyValue. Their props are in the catalog.
- **Values** can be literals, `{ "$data": "/path" }` (live), or strings with `{{/path}}`. Inside a List template, use
  `$item/…` and `{{$index}}`. Every component takes `visible`.
- **Inputs** write to the model at their `bind` path. Buttons check required fields, then send their action.
- **`update()`** replaces or adds components by id, removes ids, or merges data. A data-only update keeps focus and
  what was typed.
- **Problems come back as warnings** that a model can act on: unknown components or props, missing children, cycles,
  unreachable components, unsafe URLs. Nothing unsafe is rendered.
- **Safety**: components come only from the catalog; text is set as text; markdown is escaped; links must be http(s)
  or mailto and images https or `data:image`; data paths cannot reach `__proto__`. There is a limit of 1,000
  components and 32 levels of nesting.

### With Jade Agent Kit

`chat.connect(kit)` gives the agent these tools. Or add them yourself:
`const ui = await uiTools({ chat }); kit.tools.addAll(ui.defs); kit.agent({ plugins: [ui.plugin] })`.

| Tool | Does |
| --- | --- |
| `ui_render` | Show UI inline in the reply under a name (`ui-1`, … by default), or on a page surface: `<jade-surface name="sidebar">`. |
| `ui_update` | Change part of a surface by name. |
| `ui_read` | What the person entered (the data model), the spec, or the list of surfaces. |
| `ui_components` | The catalog, or chosen components. |
| `ui_theme` | Restyle the app: preset, mode, density, radius, tokens. |

When the person presses a button, the agent receives `[ui action] surface "…", action "…"` with the action's data and
every value. The chat shows it as a small chip. Without a chat, pass `uiTools({ onAction })`.

## For AI coding agents

[`dist/llms.txt`](dist/llms.txt) is a short guide to everything here. [`dist/catalog.json`](dist/catalog.json) has the
same as data: `elements` (attributes, properties, methods, events, slots, parts), `components` (props as JSON-schema-like
types), the surface `spec`, and the theme `tokens` and `presets`. In code: `const { prompt, json } = await catalog()`.

## Things to know

- **Browsers**: current Chrome, Edge, Firefox and Safari (custom elements, shadow DOM, constructable stylesheets).
- **Frameworks**: these are standard custom elements; in React 19, Vue, Svelte or Angular, set properties such as
  `agent` and `handler` on a ref, and listen for the `jade-*` events.
- **Content-Security-Policy**: no `eval` and no inline scripts. Elements style themselves with constructable
  stylesheets; the theme is one `<style>` element and markdown tables align with `style` attributes, which a strict
  `style-src` blocks. Allow `'unsafe-inline'` styles, or define the `--jade-*` tokens in your own stylesheet.
- **Self-hosting**: copy `dist/` anywhere; modules find each other by relative URL.

## Development

```sh
npm install && npx playwright install chromium
npm test                       # builds dist/ and runs the browser tests (tests/*_test.mjs)
JUI_SRC=1 node tests/run.mjs   # the same tests against src/
node scripts/screenshots.mjs   # screenshots of the demo, desktop light and phone dark
```

`tests/kit_test.mjs` runs the chat against the real Jade Agent Kit when it is checked out next to this repository
(or `JAK_DIR=…`). `dist/` is committed for jsDelivr, and CI fails if it is out of date. Release: bump `version` in
`package.json` and `VERSION` in `src/index.js`, `npm test`, commit, then tag `vX.Y.Z`.

## License

MIT
