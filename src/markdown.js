// Markdown for chat: safe (every character of the source is escaped; only the tags below are made, links are http(s)
// or mailto, images https or data:image) and made for streaming (an unclosed code fence or list renders as it stands).
// Code blocks get a copy button; the syntax highlighter (highlight.js) downloads with the first code block.
// <jade-markdown> renders its `text` (or its text content); renderMarkdown(text) → an HTML string for your own use.
import { JadeElement, define, copyText } from './base.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = s => String(s).replace(/[&<>"']/g, c => ESC[c]);
const unesc = s => s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[e]);
export const safeHref = u => { u = String(u).trim(); return /^(https?:\/\/|mailto:|#)/i.test(u) ? u : null; };
export const safeSrc = u => { u = String(u).trim(); return /^(https:\/\/|data:image\/(png|jpe?g|gif|webp|avif);base64,)/i.test(u) ? u : null; };

function inline(src) {
  const keep = []; const put = h => `\u0000${keep.push(h) - 1}\u0000`;
  let s = src.replace(/(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g, (_, t, c) => put(`<code>${esc(c.replace(/^ ([\s\S]*) $/, '$1'))}</code>`));
  s = s.replace(/\\([\\`*_{}\[\]()#+\-.!~|>])/g, (_, c) => put(esc(c)));
  s = esc(s);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*?&quot;)?\)/g, (m, alt, u) => { const url = safeSrc(unesc(u)); return url ? put(`<img src="${esc(url)}" alt="${alt}" loading="lazy">`) : alt; });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*?&quot;)?\)/g, (m, text, u) => { const url = safeHref(unesc(u)); return url ? put(`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">`) + text + put('</a>') : text; });
  s = s.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, (m, pre, raw) => {
    let u = raw.split(/&quot;|&#39;|&lt;|&gt;/)[0]; u = u.replace(/[.,;:!?)\]]+$/, ''); if (u.length < 9) return m;
    return `${pre}${put(`<a href="${u}" target="_blank" rel="noopener noreferrer">`)}${u}${put('</a>')}${raw.slice(u.length)}`;
  });
  s = s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*|__(?=\S)([\s\S]*?\S)__/g, (_, a, b) => `<strong>${a ?? b}</strong>`)
    .replace(/(^|[^*\w])\*(?=\S)([^*]*?\S)\*(?!\*)|(^|\W)_(?=\S)([^_]*?\S)_(?!\w)/g, (_, p1, a, p2, b) => `${p1 ?? p2}<em>${a ?? b}</em>`)
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => keep[i]).replace(/\u0000(\d+)\u0000/g, (_, i) => keep[i]);
}
const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([\w+#.-]*)/;
const LIST = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const TSEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const isBlockStart = l => FENCE.test(l) || /^ {0,3}#{1,6}\s/.test(l) || /^ {0,3}>/.test(l) || LIST.test(l) || /^ {0,3}([-*_])( *\1){2,} *$/.test(l);
const cells = l => l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(c => c.trim());

function blocks(lines) {
  let out = '', i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = FENCE.exec(l))) {
      const close = new RegExp(`^ {0,3}${m[1][0]}{${m[1].length},}\\s*$`); const body = []; i++;
      while (i < lines.length && !close.test(lines[i])) body.push(lines[i++]);
      const open = i >= lines.length; i++;
      out += `<div class="code"${open ? ' data-open' : ''}><div class="code-bar"><span>${esc(m[2] || 'text')}</span><button type="button" class="copy" aria-label="Copy code">Copy</button></div><pre data-lang="${esc(m[2].toLowerCase())}"><code>${esc(body.join('\n'))}</code></pre></div>`;
      continue;
    }
    if ((m = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(l))) { const n = m[1].length; out += `<h${n}>${inline(m[2])}</h${n}>`; i++; continue; }
    if (/^ {0,3}([-*_])( *\1){2,} *$/.test(l)) { out += '<hr>'; i++; continue; }
    if (/^ {0,3}>/.test(l)) { const q = []; while (i < lines.length && lines[i].trim() && /^ {0,3}>/.test(lines[i])) q.push(lines[i++].replace(/^ {0,3}> ?/, '')); out += `<blockquote>${blocks(q)}</blockquote>`; continue; }
    if (l.includes('|') && i + 1 < lines.length && TSEP.test(lines[i + 1])) {
      const head = cells(l); const al = cells(lines[i + 1]).map(c => c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : ''); i += 2;
      const rows = []; while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(cells(lines[i++]));
      const td = (t, c, k) => `<${t}${al[k] ? ` style="text-align:${al[k]}"` : ''}>${inline(c || '')}</${t}>`;
      out += `<div class="table"><table><thead><tr>${head.map((c, k) => td('th', c, k)).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${head.map((_, k) => td('td', r[k], k)).join('')}</tr>`).join('')}</tbody></table></div>`;
      continue;
    }
    if ((m = LIST.exec(l))) {
      const base = m[1].length; const ordered = /\d/.test(m[2]); const items = []; let cur = null;
      while (i < lines.length) {
        const x = lines[i]; const lm = LIST.exec(x);
        if (lm && lm[1].length <= base + 1 && /\d/.test(lm[2]) === ordered) { cur = [lm[3]]; items.push(cur); i++; continue; }
        if (!x.trim()) { const nx = lines[i + 1]; if (nx && (/^\s+/.test(nx) && nx.search(/\S/) > base || (LIST.exec(nx)?.[1].length ?? -1) === base)) { cur.push(''); i++; continue; } break; }
        if (x.search(/\S/) > base || (cur && !isBlockStart(x) && !lm)) { cur.push(x.replace(new RegExp(`^\\s{0,${base + 4}}`), '')); i++; continue; }
        if (lm && lm[1].length > base) { cur.push(x.slice(Math.min(base + 2, lm[1].length))); i++; continue; }
        break;
      }
      const start = ordered ? parseInt(m[2]) : 1;
      out += `<${ordered ? 'ol' : 'ul'}${ordered && start !== 1 ? ` start="${start}"` : ''}>${items.map(it => {
        let first = it[0]; let box = '';
        const t = /^\[([ xX])\]\s+/.exec(first); if (t) { box = `<input type="checkbox" disabled${t[1] !== ' ' ? ' checked' : ''}> `; first = first.slice(t[0].length); }
        const rest = it.slice(1); const inner = rest.some(r => r.trim()) ? blocks([first, ...rest]) : inline(first);
        return `<li${box ? ' class="task"' : ''}>${box}${inner.startsWith('<p>') && !rest.some(r => !r.trim()) ? inner.replace(/^<p>([\s\S]*?)<\/p>/, '$1') : inner}</li>`;
      }).join('')}</${ordered ? 'ol' : 'ul'}>`;
      continue;
    }
    const para = []; while (i < lines.length && lines[i].trim() && !(para.length && isBlockStart(lines[i])) && !(lines[i].includes('|') && TSEP.test(lines[i + 1] || ''))) para.push(lines[i++]);
    if (!para.length) para.push(lines[i++]);
    out += `<p>${para.map(p => inline(p.trim())).join('<br>')}</p>`;
  }
  return out;
}
/** markdown → a safe HTML string */
export function renderMarkdown(text) { return blocks(String(text ?? '').replace(/\r\n?/g, '\n').split('\n')); }

/** styles for rendered markdown (inside any shadow root that renders it) */
export const MD_CSS = `
.md{overflow-wrap:anywhere}
.md>:first-child{margin-top:0}.md>:last-child{margin-bottom:0}
.md p,.md ul,.md ol,.md blockquote,.md .table,.md .code{margin:.6em 0}
.md h1,.md h2,.md h3,.md h4,.md h5,.md h6{line-height:1.3;margin:1em 0 .4em;font-weight:650}
.md h1{font-size:1.4em}.md h2{font-size:1.25em}.md h3{font-size:1.1em}.md h4,.md h5,.md h6{font-size:1em}
.md ul,.md ol{padding-left:1.5em}.md li{margin:.2em 0}.md li.task{list-style:none;margin-left:-1.3em}
.md a{color:var(--jade-accent)}
.md code{font-family:var(--jade-mono);font-size:.88em;background:var(--jade-code);padding:.1em .35em;border-radius:5px}
.md blockquote{border-left:3px solid var(--jade-border);margin-left:0;padding-left:1em;color:var(--jade-muted)}
.md hr{border:0;border-top:1px solid var(--jade-border);margin:1em 0}
.md img{max-width:100%;border-radius:calc(var(--jade-radius) * .5)}
.md .table{overflow-x:auto;border:1px solid var(--jade-border);border-radius:calc(var(--jade-radius) * .6)}
.md table{border-collapse:collapse;width:100%;font-size:.93em}
.md th,.md td{padding:6px 10px;border-bottom:1px solid var(--jade-border);text-align:left;vertical-align:top}
.md tr:last-child td{border-bottom:0}.md th{background:var(--jade-surface-2);font-weight:600}
.code{border:1px solid var(--jade-border);border-radius:calc(var(--jade-radius) * .66);overflow:hidden;background:var(--jade-code)}
.code-bar{display:flex;justify-content:space-between;align-items:center;padding:3px 6px 3px 12px;font-size:.78em;color:var(--jade-muted);border-bottom:1px solid var(--jade-border)}
.code-bar .copy{border:0;background:none;color:var(--jade-muted);cursor:pointer;padding:2px 8px;border-radius:6px;font-size:1em}
.code-bar .copy:hover{background:var(--jade-surface-2);color:var(--jade-fg)}
.code pre{margin:0;padding:12px 14px;overflow:auto;font-family:var(--jade-mono);font-size:.86em;line-height:1.5;tab-size:2}
.code pre code{background:none;padding:0;font-size:1em}
.k{color:var(--jade-syn-k)}.s{color:var(--jade-syn-s)}.n{color:var(--jade-syn-n)}.c{color:var(--jade-syn-c);font-style:italic}
`;
let hl = null, hlLoading = null;
/** after markdown is put in `root`: copy buttons work, and code is highlighted (loads highlight.js the first time) */
export function enhance(root) {
  if (!root.__jadeCopy) { root.__jadeCopy = true; root.addEventListener('click', async e => { const b = e.target.closest?.('.copy'); if (!b) return; const code = b.closest('.code')?.querySelector('code'); if (code && await copyText(code.textContent)) { b.textContent = 'Copied'; setTimeout(() => (b.textContent = 'Copy'), 1400); } }); }
  const pres = root.querySelectorAll('pre[data-lang]:not([data-hl])'); if (!pres.length) return;
  const go = () => { for (const p of pres) { const c = p.firstChild; if (c) { c.innerHTML = hl.highlight(c.textContent, p.dataset.lang); p.dataset.hl = ''; } } };
  if (hl) return go();
  (hlLoading ||= import('./highlight.js').then(m => (hl = m))).then(() => { if (pres[0].isConnected) go(); });
}

class JadeMarkdown extends JadeElement {
  static styles = `:host{display:block}` + MD_CSS;
  static observedAttributes = ['text'];
  constructor() { super(); this.box = document.createElement('div'); this.box.className = 'md'; this.box.part = 'content'; this.shadowRoot.append(this.box); this._t = null; this._raf = 0; }
  connectedCallback() { if (this._t == null) this.text = this.getAttribute('text') ?? this.textContent; }
  attributeChangedCallback(n, o, v) { this.text = v ?? ''; }
  /** the markdown source */
  get text() { return this._t ?? ''; }
  set text(v) { this._t = String(v ?? ''); this.render(); }
  /** add to the text (streaming); renders once per frame */
  append(delta) { this._t = (this._t ?? '') + delta; if (!this._raf) this._raf = requestAnimationFrame(() => { this._raf = 0; this.render(); }); }
  render() { this.box.innerHTML = renderMarkdown(this._t ?? ''); enhance(this.box); }
}
define('jade-markdown', JadeMarkdown);
export { JadeMarkdown };
