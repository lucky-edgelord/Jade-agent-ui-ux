// The catalog: everything an AI agent needs to build with this library, as data and as compact prompt text.
//   ELEMENTS     the custom elements (for a coding agent writing a page): attributes, properties, methods, events, parts
//   COMPONENTS   what a surface spec may contain (for an agent building UI at runtime), with props
//   SPEC         the surface spec format, with an example
//   prompt()     all of it as short text for a system prompt; json() for catalog.json
// dist/catalog.json and dist/llms.txt are made from this at build time.
import { COMPONENTS, COMMON } from './components.js';
import { TOKENS, PRESETS } from './theme.js';
export { COMPONENTS, COMMON, TOKENS, PRESETS };

export const ELEMENTS = {
  'jade-chat': {
    description: 'A complete agent chat: messages, streaming, thinking, tool calls with approval, stop, regenerate, edit, retry, copy, suggestions, image attachments, stick-to-bottom scrolling.',
    attributes: { placeholder: 'composer placeholder', greeting: 'empty-state heading', suggestions: 'JSON array of starter prompts (strings or {label, prompt})', attach: 'allow image attachments', 'assistant-name': 'name shown on replies', hint: 'small text under the composer', busy: '(read-only) set while running' },
    properties: { agent: 'a Jade Agent Kit agent (or { prompt, abort, messages, onEvent })', handler: 'async (text, reply, { images, signal, history }) => string', suggestions: 'array of starter prompts', messages: '(read-only) the jade-message elements', history: '[{ role, content }] in handler mode', surfaces: 'Map of surface name → jade-surface the agent made', busy: 'true while running' },
    methods: { 'connect(kit, { approve, ui, brain, …kit.agent options })': 'make a kit agent with approvals and the UI tools', 'send(text, { images })': 'send and run; resolves with the reply text', 'stop()': 'stop the run', 'regenerate()': 'answer the last message again', 'edit(text)': 'change the last user message and run again', 'clear()': 'remove all messages', 'addMessage({ role, content, name, images })': 'add a message element', 'approval(tools)': 'an agent plugin that asks before the tools named', 'scrollToEnd(smooth)': 'jump to the latest message' },
    events: { 'jade-send': 'no agent or handler: { text, images, reply, signal }; write to reply and call reply.finish()', 'jade-run': 'a run starts { text, message }', 'jade-done': 'a run ends { text, message, error, stopped }', 'jade-tool': 'a tool call { name, args }', 'jade-action': 'a surface action { surface, name, data, values }', 'jade-approval': 'an approval was answered { name, args, allowed }' },
    slots: { header: 'above the conversation', empty: 'replaces the empty state' },
    parts: ['log', 'list', 'empty', 'suggestions', 'jump', 'composer', 'message', 'bubble', 'text', 'thinking', 'actions', 'name', 'error', 'composer-form', 'composer-input', 'composer-send'],
  },
  'jade-chat-widget': {
    description: 'A floating chat button in a corner that opens a chat panel (customer service, help desks, sales, an assistant on any page). The <jade-chat> inside loads on the first open; on small screens the panel fills the screen. Esc closes; a reply that arrives while closed shows a dot.',
    attributes: { title: 'panel heading (default "Chat with us")', subtitle: 'line under it', greeting: 'empty-state heading', suggestions: 'JSON array of starter prompts', placeholder: 'composer placeholder', label: "the button's accessible name", position: 'bottom-right | bottom-left', open: 'open (reflects)' },
    properties: { handler: 'async (text, reply, ctx) => … (as <jade-chat>)' },
    methods: { 'open()': '', 'close()': '', 'toggle()': '', 'chat()': '→ Promise of the inner <jade-chat>', 'connect(kit, opts)': 'a Jade Agent Kit agent (as <jade-chat>.connect)', 'send(text)': 'open and send as the person' },
    events: { 'jade-open': '', 'jade-close': '' }, parts: ['button', 'panel', 'header', 'close', 'chat'],
    css: { '--jade-widget-width': '380px', '--jade-widget-height': '560px', '--jade-widget-offset': '20px', '--jade-widget-z': '2147483000' },
  },
  'jade-message': {
    description: 'One chat turn. Assistant turns stream blocks: thinking, markdown text, tool calls and surfaces.',
    attributes: { role: 'user | assistant | system', name: 'label shown above it', actions: 'space-separated: copy edit regenerate', streaming: '(read-only) while streaming', kind: 'action for surface-action messages' },
    methods: { 'begin()': 'start streaming', 'append(delta)': 'add text', 'setText(text)': 'replace text', 'thinking(delta)': 'add reasoning', 'tool(name, args)': 'a tool-call card → handle { done, fail, ask, answer }', 'surface(spec, name)': 'a surface → Promise<jade-surface>', 'meta(text)': 'small label (model)', 'finish({ stopped })': 'end streaming', 'fail(error)': 'show an error with Retry', 'setImages(urls)': 'images above a user message' },
    properties: { text: '(read-only) the text' },
    events: { 'jade-regenerate': '', 'jade-edit': '{ text }', 'jade-retry': '', 'jade-finish': '{ text, stopped, error }' },
    parts: ['bubble', 'text', 'thinking', 'actions', 'name', 'error', 'note'],
  },
  'jade-composer': {
    description: 'The message input: grows with text, Enter sends, Shift+Enter new line, Esc stops; image attach, paste and drop.',
    attributes: { placeholder: '', busy: 'shows Stop instead of Send', disabled: '', attach: 'allow images', multiline: 'Enter makes a new line', hint: 'small text under it' },
    properties: { value: 'the text', images: 'attached images [{ name, type, dataUrl, base64 }]' },
    methods: { 'submit()': '', 'stop()': '', 'focus()': '', 'addFiles(files)': '' },
    events: { 'jade-submit': '{ text, images } (cancelable)', 'jade-stop': '', 'jade-attach': '{ files } that are not images' },
    parts: ['form', 'input', 'send', 'attachments', 'hint'],
  },
  'jade-tool-call': {
    description: 'A tool call card: name, arguments, status, result; ask() turns it into an approval card.',
    attributes: { name: '', status: 'running | done | error | waiting | denied' },
    properties: { args: '', result: '' },
    methods: { 'start(name, args)': '', 'done(result)': '', 'fail(error)': '', 'ask({ message })': 'Promise<boolean>', 'answer(ok)': '' },
    events: { 'jade-approval': '{ name, args, allowed }', 'jade-approval-always': '{ name }' },
    parts: ['card', 'summary', 'name', 'body', 'args', 'result', 'approval'],
  },
  'jade-surface': {
    description: 'Renders UI from a declarative spec (see SPEC and COMPONENTS). Agents build and change it; buttons send actions back.',
    attributes: { name: 'the name agents address it by' },
    properties: { data: '(copy) the data model', spec: '(copy) { root, components, data }', result: 'the last { ok, warnings, count }', onaction: '(detail) => void' },
    methods: { 'render(spec)': 'replace everything → Promise<{ ok, warnings, count }>', 'update({ components, remove, data, root })': 'change part of it', 'setData(path, value)': '', 'getData(path)': '', 'clear()': '' },
    events: { 'jade-action': '{ surface, name, data, values }', 'jade-change': '{ surface, path, value }', 'jade-invalid': '{ surface, fields }', 'jade-render': '{ surface, warnings }' },
    parts: ['root', 'c', 'c <component name in lower case> (e.g. ::part(card))'],
  },
  'jade-markdown': { description: 'Safe markdown (with copyable, highlighted code blocks).', attributes: { text: 'markdown (or the element\'s text content)' }, properties: { text: '' }, methods: { 'append(delta)': 'streaming' }, parts: ['content'] },
  'jade-code': { description: 'A code block with copy and highlighting.', attributes: { lang: '', code: 'or the text content' }, properties: { code: '', lang: '' }, parts: ['code', 'bar'] },
  'jade-auth': {
    description: 'Sign in, create an account and reset a password on a Jade Agent Base (PocketBase) server, plus a "Continue with …" button for each OAuth2 provider the server has on (Google, Facebook, GitHub, …; an agent turns them on with auth_provider_set). Signed in, shows who and Sign out. Server field errors appear on their fields.',
    attributes: { base: 'the server URL (else setBase(), <meta name="jade-base">, or this page)', mode: 'signin | signup | reset' },
    properties: { client: '(read-only) the Jade Agent Base client' }, methods: { 'show(mode)': 'switch between signin, signup and reset' },
    events: { 'jade-auth': '{ user, mode } after signing in or up (mode: signin, signup or the provider name)', 'jade-signout': '' }, parts: ['card', 'form', 'submit', 'providers', 'provider'],
  },
  'jade-pricing': {
    description: "The server's plans as cards (price, limits), the user's plan marked, and Subscribe buttons that open Stripe Checkout.",
    attributes: { base: 'the server URL', currency: 'e.g. USD (default), EUR' }, properties: { navigate: '(url) => void, how to open Checkout (default location.assign)', plans: '(read-only) the plans' },
    methods: { 'load()': 'reload' }, events: { 'jade-checkout': '{ plan, url } (cancelable)', 'jade-needs-signin': '{ plan } when signed out' }, parts: ['grid', 'plan', 'subscribe'],
  },
  'jade-account': {
    description: "The signed-in user's plan and subscription, usage this month against the plan's limits, Manage billing (Stripe portal), and API keys (create, shown once with Copy; revoke).",
    attributes: { base: 'the server URL', currency: 'e.g. USD' }, properties: { navigate: '(url) => void, how to open the portal' },
    methods: { 'load()': 'reload' }, events: { 'jade-key-created': '{ id, prefix }', 'jade-key-revoked': '{ id }', 'jade-portal': '{ url } (cancelable)' }, parts: ['card', 'plan', 'manage', 'keys', 'create-key', 'new-key'],
  },
  'jade-theme-toggle': { description: 'Cycles auto/light/dark and remembers it; with `presets`, also a preset picker.', attributes: { presets: 'show the preset picker' } },
};

export const SPEC = {
  description: 'A surface spec is a flat list of components that point at their children by id, plus a data model.',
  shape: '{ "root": "<id>", "components": [{ "id": "<unique>", "component": "<name>", "props": { … }, "children": ["<id>", …] }], "data": { … } }',
  values: 'Any prop can be a literal, {"$data": "/path"} (live from the data model), or a string with {{/path}} in it. Inside a List template, paths start with $item (e.g. "$item/title") and {{$index}} is the position.',
  inputs: 'Inputs write to the data model at their "bind" path. Read it back with ui_read, or receive it with an action.',
  actions: 'A Button\'s action ("name" or { "name", "data" }) is sent back to the agent as a message: [ui action] … with the action\'s data and every value in the data model. Required fields are checked first.',
  updates: 'ui_update changes part of a surface: components with an existing id replace it, new ids are added, "remove" deletes ids, "data" merges into the model (or [{ path, value }]). Changing only data keeps what the person typed and where they are.',
  example: {
    root: 'root',
    components: [
      { id: 'root', component: 'Card', props: { title: 'Book a table' }, children: ['when', 'size', 'go'] },
      { id: 'when', component: 'TextField', props: { label: 'Date', type: 'date', bind: '/booking/date', required: true } },
      { id: 'size', component: 'Slider', props: { label: 'Guests', bind: '/booking/guests', min: 1, max: 12 } },
      { id: 'go', component: 'Button', props: { label: 'Book for {{/booking/guests}}', variant: 'primary', action: { name: 'book', data: { $data: '/booking' } } } },
    ],
    data: { booking: { date: '', guests: 2 } },
  },
};

const propLine = (k, p) => `${k}${p.required ? '*' : ''}: ${p.enum ? p.enum.join('|') : p.type}${p.description ? ' (' + p.description + ')' : ''}`;
/** the components as compact text: one line each (for a system prompt) */
export function componentsText(names = Object.keys(COMPONENTS)) {
  return names.filter(n => COMPONENTS[n]).map(n => { const c = COMPONENTS[n]; const ps = Object.entries(c.props).map(([k, p]) => propLine(k, p)).join('; ');
    return `- ${n}${c.children ? ' [children]' : ''}: ${c.description}${ps ? ' Props: ' + ps + '.' : ''}`; }).join('\n');
}
/** how to build UI, for a model: the spec format, rules and every component (about 2,500 tokens) */
export function prompt() {
  return `You can show the user interactive UI by calling ui_render with a spec.
${SPEC.description}
Shape: ${SPEC.shape}
${SPEC.values}
${SPEC.inputs}
${SPEC.actions}
${SPEC.updates}
Every component also takes "visible" (often a binding). Props marked * are required. Use only these components:
${componentsText()}
Example: ${JSON.stringify(SPEC.example)}
Keep UI small and purposeful: a form, a choice, a summary card or a table beats a wall of text when the user has to act or compare. Plain answers stay text.`;
}
/** catalog.json */
export function json() { return { name: 'jade-agent-ui-ux', elements: ELEMENTS, components: COMPONENTS, common: COMMON, spec: SPEC, theme: { tokens: TOKENS.map(t => '--jade-' + t), presets: PRESETS } }; }
