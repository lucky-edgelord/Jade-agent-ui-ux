// Tools that let a Jade Agent Kit agent build UI: ui_render, ui_update, ui_read, ui_components, ui_theme.
//   const ui = await uiTools({ chat });                 // chat.connect(kit) does this for you
//   (await kit.use('tools')).addAll(ui.defs);
//   const agent = await kit.agent({ plugins: [ui.plugin] });
// Surfaces live inline in the chat (made by ui_render) or anywhere on the page (<jade-surface name="sidebar">).
// When the person presses a surface's button, the action goes back to the agent as a message (with a chat), or to
// onAction(detail). The plugin adds the tool names and a short guide with the component catalog to the system prompt.
import { prompt, componentsText, COMPONENTS, PRESETS, TOKENS } from './catalog.js';
import { setTheme } from './theme.js';

const NAMES = ['ui_render', 'ui_update', 'ui_read', 'ui_components', 'ui_theme'];
const report = (name, r) => `${r.ok ? 'Rendered' : 'Rendered with problems:'} surface "${name}" (${r.count} components).` + (r.warnings.length ? '\n' + r.warnings.slice(0, 20).map(w => '- ' + w).join('\n') + '\nFix these with ui_update or ui_render.' : '');
const COMP = { type: 'array', description: 'components: [{ "id", "component", "props": {…}, "children": [ids] }]', items: { type: 'object' } };

/**
 * @param {{ chat?: HTMLElement, root?: Document|Element, onAction?: (detail) => void, catalogInPrompt?: boolean, actions?: boolean }} [o]
 *   chat: a <jade-chat>: inline surfaces go into its current reply, and actions come back to the agent as messages
 *   root: where page surfaces are looked up (default document); catalogInPrompt: put the full component list in the
 *   system prompt (default true; otherwise the agent calls ui_components)
 */
export async function uiTools({ chat = null, root = document, onAction = null, catalogInPrompt = true, actions = true } = {}) {
  const made = chat?.surfaces || new Map();
  const find = name => made.get(name) || [...root.querySelectorAll('jade-surface')].find(s => s.getAttribute('name') === name) || null;
  const list = () => [...new Set([...made.keys(), ...[...root.querySelectorAll('jade-surface[name]')].map(s => s.getAttribute('name'))])];
  const ready = async s => { await customElements.whenDefined('jade-surface'); customElements.upgrade(s); return s; };
  const handle = d => {
    if (onAction) try { onAction(d); } catch (e) { console.error(e); }
    if (!chat || !actions) return;
    const text = `[ui action] surface "${d.surface}", action "${d.name}"\n${JSON.stringify({ data: d.data, values: d.values })}`;
    chat.send(text, { kind: 'action', display: `▸ ${d.name}` }).catch(() => {});
  };
  // actions from any surface the agent can reach (inline ones bubble out of the chat; page ones out of root)
  const target = chat || root; const listener = e => { if (e.__jadeSeen) return; e.__jadeSeen = true; const s = e.composedPath()[0]; if (s?.localName === 'jade-surface' && (made.get(s.name) === s || find(s.name) === s)) handle(e.detail); };
  target.addEventListener('jade-action', listener); if (chat && root !== chat) root.addEventListener?.('jade-action', listener);

  const defs = {
    ui_render: {
      description: 'Show interactive UI (a form, a choice, a card, a table, a dashboard) built from catalog components. Replaces the surface\'s content. It appears inline in your reply, under the name you give (or ui-1, ui-2…); a page surface\'s name draws there instead. Returns problems to fix, if any.',
      parameters: { type: 'object', properties: { surface: { type: 'string', description: 'name to update it by later; an existing page surface\'s name draws there (ui_read with no surface lists them)' }, root: { type: 'string', description: 'id of the top component (default "root")' }, components: COMP, data: { type: 'object', description: 'the data model inputs bind to' } }, required: ['components'] },
      async run(a) {
        if (!Array.isArray(a.components)) return 'Error: components must be an array';
        let name = a.surface; let s = name ? find(name) : null;
        if (!s) {
          if (!chat?._cur) return name ? `Error: no surface named "${name}". Surfaces: ${list().join(', ') || 'none'}.` : 'Error: there is no chat reply to show inline UI in. Name a page surface.';
          name ||= 'ui-' + (made.size + 1); s = await chat._cur.surface({}, name); made.set(name, s);
        }
        await ready(s); const r = await s.render({ root: a.root, components: a.components, data: a.data }); return report(name, r);
      },
    },
    ui_update: {
      description: 'Change part of a surface: replace or add components (by id), remove ids, or change data. Changing only data keeps what the person typed.',
      parameters: { type: 'object', properties: { surface: { type: 'string' }, components: COMP, remove: { type: 'array', items: { type: 'string' } }, data: { description: 'merged into the data model, or [{ "path": "/a/b", "value": … }]' }, root: { type: 'string' } }, required: ['surface'] },
      async run(a) { const s = find(a.surface); if (!s) return `Error: no surface named "${a.surface}". Surfaces: ${list().join(', ') || 'none'}`; await ready(s); return report(a.surface, await s.update(a)).replace('Rendered', 'Updated'); },
    },
    ui_read: {
      description: 'Read a surface: its data model (what the person entered) and its spec. With no surface, list the surfaces.',
      parameters: { type: 'object', properties: { surface: { type: 'string' }, spec: { type: 'boolean', description: 'include the components too' } } },
      async run(a) {
        if (!a.surface) return JSON.stringify({ surfaces: list() });
        const s = find(a.surface); if (!s) return `Error: no surface named "${a.surface}". Surfaces: ${list().join(', ') || 'none'}`; await ready(s);
        return JSON.stringify(a.spec ? s.spec : { data: s.data }, null, 1);
      },
    },
    ui_components: {
      description: 'The UI components you can use, with their props (all of them, or the ones named).',
      parameters: { type: 'object', properties: { names: { type: 'array', items: { type: 'string' } } } },
      run: a => (a.names?.length ? componentsText(a.names) || `No such components. Components: ${Object.keys(COMPONENTS).join(', ')}` : prompt()),
    },
    ui_theme: {
      description: `Change the look of the whole app: preset (${PRESETS.join(', ')}), mode (auto, light, dark), density (compact, cozy, comfortable), radius (px) or tokens (colors: ${TOKENS.slice(0, 18).join(', ')}).`,
      parameters: { type: 'object', properties: { preset: { type: 'string', enum: PRESETS }, mode: { type: 'string', enum: ['auto', 'light', 'dark'] }, density: { type: 'string', enum: ['compact', 'cozy', 'comfortable'] }, radius: { type: 'number' }, tokens: { type: 'object', description: '{ "accent": "#e11d48" }' } } },
      async run(a) { const o = {}; for (const k of ['preset', 'mode', 'density', 'radius', 'tokens']) if (a[k] != null) o[k] = a[k]; const t = await setTheme(o); return `Theme: ${JSON.stringify({ preset: t.preset, mode: t.mode, density: t.density, radius: t.radius, tokens: t.tokens })}`; },
    },
  };
  const guide = catalogInPrompt ? '\n\n## Building UI\n' + prompt() : '\n\nYou can show interactive UI with ui_render (call ui_components first to see the components).';
  const plugin = { name: 'ui', tools: NAMES, system: () => guide };
  return { defs, names: NAMES, plugin, surfaces: list, find, dispose() { target.removeEventListener('jade-action', listener); root.removeEventListener?.('jade-action', listener); } };
}
