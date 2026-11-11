// Surface components: inputs (two-way bound to the data model through `bind`) and buttons (actions).
const opts = list => [].concat(list ?? []).map(o => (o && typeof o === 'object' ? { value: o.value ?? o.label, label: String(o.label ?? o.value) } : { value: o, label: String(o) }));

// a labelled field: label, control, help and error text, and its registration for required checks
function field(a, control, { group = false } = {}) {
  const id = a.uid(); const wrap = a.h(group ? 'fieldset' : 'div', { class: 'field' });
  const label = a.h(group ? 'legend' : 'label', group ? {} : { for: id }); const help = a.h('div', { class: 'help', id: id + 'h' }); const bad = a.h('div', { class: 'bad', id: id + 'e', 'aria-live': 'polite' });
  if (!group) control.id = id;
  const req = !!a.get('required');
  a.bind('label', v => { label.textContent = v ?? ''; if (req) label.append(a.h('span', { class: 'req', 'aria-hidden': 'true', text: '*' })); });
  a.bind('help', v => { help.textContent = v ?? ''; help.hidden = !v; });
  const ctl = group ? wrap : control; ctl.setAttribute('aria-describedby', id + 'h ' + id + 'e'); if (req) ctl.setAttribute('aria-required', 'true');
  bad.hidden = true; wrap.append(label, control, help, bad);
  return { wrap, id, req, register(empty, focus) {
    a.field({ el: wrap, required: req, label: a.get('label', ''), empty, focus,
      invalid(on) { bad.hidden = !on; bad.textContent = on ? 'This is required.' : ''; ctl.setAttribute('aria-invalid', on ? 'true' : 'false'); } });
  } };
}
const path = a => { const p = a.props.bind; if (typeof p !== 'string' || !p) a.warn('needs "bind": a data path like "/form/name"'); return typeof p === 'string' ? p : null; };

export default {
  Button(a) {
    const el = a.h('button', { type: 'button', class: 'btn' });
    a.bind('label', v => (el.textContent = v ?? ''));
    a.bind('variant', v => { el.className = 'btn' + (v && v !== 'secondary' ? ' ' + v : ''); });
    a.bind('disabled', v => (el.disabled = !!v)); a.bind('full', v => (v ? (el.dataset.full = '') : delete el.dataset.full));
    el.addEventListener('click', () => a.act(a.props.action, el));
    if (a.props.action == null) a.warn('needs an "action"');
    return el;
  },
  TextField(a) {
    const t = String(a.get('type', 'text')); const type = ['text', 'email', 'number', 'url', 'tel', 'password', 'date', 'time', 'datetime-local', 'search'].includes(t) ? t : 'text';
    const input = a.h('input', { class: 'in', type, autocomplete: type === 'password' ? 'off' : undefined }); const f = field(a, input); const p = path(a);
    a.bind('placeholder', v => (input.placeholder = v ?? '')); a.bind('min', v => (v != null ? input.setAttribute('min', v) : null)); a.bind('max', v => (v != null ? input.setAttribute('max', v) : null));
    const read = () => { const v = a.read(p); input.value = v == null ? '' : String(v); };
    if (p) { read(); a.watch(p, read, input); input.addEventListener('input', () => { a.write(p, type === 'number' ? (input.value === '' ? null : Number(input.value)) : input.value, input); if (input.getAttribute('aria-invalid') === 'true' && input.value) input.setAttribute('aria-invalid', 'false'); }); }
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { const b = input.closest('.card,.col,.root')?.querySelector('.btn.primary'); b?.click(); } });
    f.register(() => !String(input.value).trim(), () => input.focus()); return f.wrap;
  },
  TextArea(a) {
    const input = a.h('textarea', { class: 'in' }); const f = field(a, input); const p = path(a);
    a.bind('rows', v => (input.rows = Math.max(2, Math.min(30, +v || 4))), 4); a.bind('placeholder', v => (input.placeholder = v ?? ''));
    const read = () => { const v = a.read(p); input.value = v == null ? '' : String(v); };
    if (p) { read(); a.watch(p, read, input); input.addEventListener('input', () => a.write(p, input.value, input)); }
    f.register(() => !input.value.trim(), () => input.focus()); return f.wrap;
  },
  Select(a) {
    const sel = a.h('select', { class: 'in' }); const f = field(a, sel); const p = path(a); let list = [];
    const read = () => { const v = a.read(p); const i = list.findIndex(o => o.value === v || String(o.value) === String(v)); sel.selectedIndex = i < 0 ? 0 : i + (sel.dataset.ph != null ? 1 : 0); };
    a.bind('options', v => {
      list = opts(v); const ph = a.get('placeholder', a.get('required') ? 'Choose…' : null);
      sel.replaceChildren(...(ph != null ? [a.h('option', { value: '', text: ph, disabled: !!a.get('required') })] : []), ...list.map((o, i) => a.h('option', { value: String(i), text: o.label })));
      if (ph != null) sel.dataset.ph = ''; else delete sel.dataset.ph; if (p) read();
    }, []);
    if (p) { a.watch(p, read, sel); sel.addEventListener('change', () => a.write(p, sel.value === '' ? null : list[+sel.value]?.value ?? null, sel)); }
    f.register(() => sel.value === '' || a.read(p) == null, () => sel.focus()); return f.wrap;
  },
  RadioGroup(a) {
    const box = a.h('div', { role: 'radiogroup', class: 'col', style: 'gap:2px' }); const f = field(a, box, { group: true }); const p = path(a); const name = a.uid(); let list = [];
    const read = () => { const v = a.read(p); box.querySelectorAll('input').forEach((r, i) => (r.checked = list[i] && String(list[i].value) === String(v))); };
    a.bind('options', v => {
      list = opts(v);
      box.replaceChildren(...list.map((o, i) => { const r = a.h('input', { type: 'radio', name, value: String(i) }); r.addEventListener('change', () => a.write(p, list[i].value, box)); return a.h('label', { class: 'opt' }, r, o.label); }));
      read();
    }, []);
    if (p) a.watch(p, read, box);
    f.register(() => a.read(p) == null || a.read(p) === '', () => box.querySelector('input')?.focus()); return f.wrap;
  },
  Checkbox(a) { return toggle(a, false); },
  Switch(a) { return toggle(a, true); },
  Slider(a) {
    const input = a.h('input', { type: 'range', class: 'rngi' }); const out = a.h('output'); const f = field(a, input); const p = path(a);
    const lim = a.h('div', { class: 'rng' }); f.wrap.insertBefore(lim, input.nextSibling);
    const conf = () => { const min = +a.get('min', 0) || 0, max = +a.get('max', 100) || 100; input.min = min; input.max = max; input.step = +a.get('step', 1) || 1; lim.replaceChildren(a.h('span', { text: String(min) }), out, a.h('span', { text: String(max) })); };
    a.bind('min', conf); a.bind('max', conf); a.bind('step', conf);
    const read = () => { const v = a.read(p); input.value = v == null ? input.min : v; out.textContent = input.value; };
    if (p) { read(); a.watch(p, read, input); input.addEventListener('input', () => { out.textContent = input.value; a.write(p, Number(input.value), input); }); }
    return f.wrap;
  },
};
function toggle(a, sw) {
  const input = a.h('input', { type: 'checkbox', class: sw ? 'sw' : '' }); if (sw) input.setAttribute('role', 'switch');
  const text = a.h('span'); const el = a.h('label', { class: 'chk' }, input, text); const p = path(a);
  a.bind('label', v => (text.textContent = v ?? ''));
  const read = () => (input.checked = !!a.read(p));
  if (p) { read(); a.watch(p, read, input); input.addEventListener('change', () => a.write(p, input.checked, input)); }
  return el;
}
