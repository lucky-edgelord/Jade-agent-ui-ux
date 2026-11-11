// Styles shared by the account elements (<jade-auth>, <jade-pricing>, <jade-account>).
export const FORM_CSS = `
:host{display:block}
.card{border:1px solid var(--jade-border);background:var(--jade-surface);border-radius:var(--jade-radius);padding:calc(var(--jade-space) * 2.5);box-shadow:var(--jade-shadow)}
h2{margin:0 0 calc(var(--jade-space) * 1.5);font-size:1.25em;font-weight:650;line-height:1.25}
h3{margin:0;font-size:1em;font-weight:650}
p{margin:0}
.muted{color:var(--jade-muted)}
.small{font-size:.86em}
form{display:flex;flex-direction:column;gap:calc(var(--jade-space) * 1.5)}
label{display:flex;flex-direction:column;gap:4px;font-size:.88em;font-weight:600}
input{font:inherit;font-weight:400;color:inherit;background:var(--jade-bg);border:1px solid var(--jade-border);border-radius:calc(var(--jade-radius) * .6);padding:8px 10px;min-height:38px;width:100%}
input:focus{outline:2px solid var(--jade-focus);outline-offset:0;border-color:transparent}
input[aria-invalid=true]{border-color:var(--jade-danger)}
.ferr{color:var(--jade-danger);font-size:.8em;font-weight:400}
.err{border:1px solid var(--jade-danger);color:var(--jade-danger);border-radius:calc(var(--jade-radius) * .6);padding:8px 10px;font-size:.9em}
.ok{border:1px solid var(--jade-ok);border-radius:calc(var(--jade-radius) * .6);padding:8px 10px;font-size:.9em}
.btn.wide{width:100%;min-height:40px}
.row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.spread{justify-content:space-between}
.link{background:none;border:0;color:var(--jade-accent);cursor:pointer;padding:0;font:inherit;font-size:.88em;text-decoration:underline}
.tabs{display:flex;gap:4px;border-bottom:1px solid var(--jade-border);margin-bottom:calc(var(--jade-space) * 2)}
.tabs button{border:0;background:none;padding:8px 12px;cursor:pointer;color:var(--jade-muted);border-bottom:2px solid transparent;margin-bottom:-1px;font:inherit}
.tabs button[aria-selected=true]{color:var(--jade-fg);border-bottom-color:var(--jade-accent);font-weight:600}
.spin{width:16px;height:16px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:s .7s linear infinite;display:inline-block;vertical-align:-3px}
@keyframes s{to{transform:rotate(360deg)}}
.skel{height:1em;border-radius:6px;background:var(--jade-surface-2);animation:p 1.2s ease-in-out infinite}
@keyframes p{50%{opacity:.5}}
`;
/** a busy button: disables it and shows a spinner while fn runs */
export async function busy(btn, fn) {
  const old = [...btn.childNodes]; btn.disabled = true; btn.setAttribute('aria-busy', 'true');
  const sp = document.createElement('span'); sp.className = 'spin'; sp.setAttribute('aria-hidden', 'true'); btn.prepend(sp);
  try { return await fn(); } finally { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.replaceChildren(...old); }
}
/** money: 19.99 → $19.99 (the currency comes from the element's `currency` attribute) */
export const money = (n, cur = 'USD') => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n); } catch { return `${n} ${cur}`; } };
export const num = n => Number(n || 0).toLocaleString();
