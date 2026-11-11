// Surface components: content. Text is set with textContent, markdown through the safe renderer, URLs are checked.
const set = (el, k) => v => { if (v == null || v === '' || v === false) delete el.dataset[k]; else el.dataset[k] = v === true ? '' : v; };

export default {
  Heading(a) { const n = Math.max(1, Math.min(4, Math.round(a.get('level', 2)) || 2)); const el = a.h('h' + n, { class: 'hd' }); a.bind('text', v => (el.textContent = v ?? '')); return el; },
  Text(a) {
    const el = a.h('div', { class: 'txt md' });
    a.bind('text', v => { el.innerHTML = a.md(v ?? ''); a.enhance(el); }); a.bind('size', set(el, 'size')); a.bind('muted', set(el, 'muted')); a.bind('align', set(el, 'align'));
    return el;
  },
  Badge(a) { const el = a.h('span', { class: 'badge' }); a.bind('text', v => (el.textContent = v ?? '')); a.bind('tone', set(el, 'tone')); return el; },
  Image(a) {
    const el = a.h('img', { class: 'img', loading: 'lazy', decoding: 'async' });
    a.bind('src', v => { const u = a.safeSrc(v ?? ''); if (u) el.src = u; else { el.removeAttribute('src'); if (v) a.warn('src must be an https:// or data:image URL'); } });
    a.bind('alt', v => (el.alt = v ?? '')); a.bind('rounded', set(el, 'rounded'));
    a.bind('width', v => { if (v) el.style.width = Math.min(4000, +v) + 'px'; }); a.bind('height', v => { if (v) { el.style.height = Math.min(4000, +v) + 'px'; el.style.objectFit = a.get('fit', 'cover'); } });
    return el;
  },
  Code(a) {
    const el = a.h('div', { class: 'code' }); const bar = a.h('div', { class: 'code-bar' }); const lang = a.h('span'); const pre = a.h('pre'); const code = a.h('code');
    bar.append(lang, a.h('button', { type: 'button', class: 'copy', 'aria-label': 'Copy code', text: 'Copy' })); pre.append(code); el.append(bar, pre);
    const paint = () => { const l = String(a.get('lang', '') || '').toLowerCase(); lang.textContent = l || 'text'; pre.dataset.lang = l; delete pre.dataset.hl; code.textContent = String(a.get('code', '') ?? ''); a.enhance(el); };
    a.bind('code', paint); a.bind('lang', paint); return el;
  },
  Alert(a) {
    const el = a.h('div', { class: 'alert', role: 'note' }); const body = a.h('div'); const t = a.h('strong'); const txt = a.h('div', { class: 'md' }); body.append(t, txt);
    a.bind('tone', v => { el.dataset.tone = v || 'info'; el.replaceChildren(a.icon(v === 'ok' ? 'check' : 'alert'), body); if (v === 'danger') el.setAttribute('role', 'alert'); }, 'info');
    a.bind('title', v => { t.textContent = v ?? ''; t.hidden = !v; }); a.bind('text', v => { txt.innerHTML = a.md(v ?? ''); a.enhance(txt); });
    return el;
  },
  Link(a) {
    const el = a.h('a', { class: 'link', target: '_blank', rel: 'noopener noreferrer' });
    a.bind('text', v => (el.textContent = v ?? '')); a.bind('href', v => { const u = a.safeHref(v ?? ''); if (u) el.href = u; else { el.removeAttribute('href'); if (v) a.warn('href must be http(s) or mailto'); } });
    return el;
  },
};
