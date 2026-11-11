// A small syntax highlighter (keywords, strings, numbers, comments) for the languages agents write most.
// Loaded with the first code block. highlight(code, lang) → escaped HTML with <span class="k|s|n|c">.
const KW = {
  js: 'await async break case catch class const continue default delete do else export extends false finally for from function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while yield',
  ts: 'abstract as any boolean declare enum implements interface keyof namespace number private protected public readonly string type unknown never',
  py: 'and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield self print',
  sh: 'if then else elif fi for while until do done case esac in function return export local echo cd ls cat grep sed awk set unset source exit sudo',
  sql: 'select from where insert into values update set delete create table index view drop alter join left right inner outer on group by order having limit offset as and or not null is in like primary key foreign references distinct union all count sum avg min max',
  rs: 'as async await break const continue crate else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while',
  go: 'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var nil true false',
  css: 'important media supports keyframes from to',
  lisp: 'define lambda let if cond else begin quote set! and or not defn def fn loop recur',
};
const ALIAS = { javascript: 'js', mjs: 'js', jsx: 'js', json: 'js', typescript: 'ts', tsx: 'ts', python: 'py', python3: 'py', bash: 'sh', shell: 'sh', zsh: 'sh', console: 'sh',
  rust: 'rs', golang: 'go', scss: 'css', scheme: 'lisp', clojure: 'lisp', clj: 'lisp', jsonc: 'js', c: 'js', cpp: 'js', 'c++': 'js', java: 'js', kotlin: 'js', swift: 'js', csharp: 'js', cs: 'js', php: 'js', rb: 'py', ruby: 'py', yaml: 'sh', yml: 'sh', toml: 'sh' };
const sets = {};
const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
export function highlight(code, lang = '') {
  let l = ALIAS[lang] || lang; if (!KW[l]) return esc(code);
  const kw = sets[l] ||= new Set((KW[l] + (l === 'ts' ? ' ' + KW.js : '')).split(' '));
  const hash = l === 'py' || l === 'sh', semi = l === 'lisp', slash = !hash && !semi && l !== 'sql';
  const re = new RegExp([
    hash ? '#.*' : semi ? ';.*' : l === 'sql' ? '--.*' : '//.*', slash || l === 'css' ? '/\\*[\\s\\S]*?\\*/' : null,
    l === 'py' ? '"""[\\s\\S]*?"""|\'\'\'[\\s\\S]*?\'\'\'' : null,
    '"(?:[^"\\\\\\n]|\\\\.)*"', "'(?:[^'\\\\\\n]|\\\\.)*'", l === 'js' || l === 'ts' ? '`(?:[^`\\\\]|\\\\.)*`' : null,
    '\\b\\d[\\d_]*(?:\\.\\d+)?(?:e[+-]?\\d+)?\\b|\\b0x[\\da-f]+\\b', '[A-Za-z_$][\\w$!?-]*',
  ].filter(Boolean).map(p => `(${p})`).join('|'), 'gi');
  const n = l === 'css' ? 0 : 1; let out = '', last = 0, m;
  while ((m = re.exec(code))) {
    const t = m[0]; let cls = '';
    if (/^(\/\/|\/\*|#|;|--)/.test(t) && !(l === 'css' && t[0] === '#')) cls = 'c';
    else if (/^["'`]/.test(t)) cls = 's';
    else if (/^\d/.test(t)) cls = 'n';
    else if (kw.has(l === 'sql' ? t.toLowerCase() : t)) cls = 'k';
    if (!cls) continue;
    out += esc(code.slice(last, m.index)) + `<span class="${cls}">${esc(t)}</span>`; last = m.index + t.length;
  }
  void n; return out + esc(code.slice(last));
}
