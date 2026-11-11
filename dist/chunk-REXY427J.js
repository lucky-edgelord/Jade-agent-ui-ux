/*! Jade Agent UI/UX 1.2.0 | MIT | https://github.com/lucky-edgelord/Jade-agent-ui-ux */
import{e as s}from"./chunk-I43RMOTQ.js";var i=new WeakMap,d=`
:host{box-sizing:border-box;font-family:var(--jade-font,system-ui,sans-serif);font-size:var(--jade-font-size,15px);color:var(--jade-fg,#15201b);line-height:1.55}
:host([hidden]),[hidden]{display:none!important}
*,*::before,*::after{box-sizing:inherit}
:focus-visible{outline:2px solid var(--jade-focus,#0b7a5b);outline-offset:2px}
button{font:inherit;color:inherit}
.sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--jade-border);background:var(--jade-surface);color:var(--jade-fg);
  border-radius:calc(var(--jade-radius,12px) * .66);padding:calc(var(--jade-space,8px) * .6) calc(var(--jade-space,8px) * 1.5);cursor:pointer;font-size:.92em;line-height:1.3;min-height:32px}
.btn:hover{background:var(--jade-surface-2)}
.btn.primary{background:var(--jade-accent);color:var(--jade-accent-fg);border-color:transparent}
.btn.primary:hover{filter:brightness(1.07)}
.btn.danger{background:var(--jade-danger);color:#fff;border-color:transparent}
.btn.ghost{background:transparent;border-color:transparent}
.btn.ghost:hover{background:var(--jade-surface-2)}
.btn:disabled{opacity:.5;cursor:not-allowed}
.icon{width:1.1em;height:1.1em;flex:none}
@media (prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}
`,c=class extends HTMLElement{static styles="";constructor(){super(),s();let e=this.constructor,r=i.get(e);r||(r=new CSSStyleSheet,r.replaceSync(d+e.styles),i.set(e,r)),this.attachShadow({mode:"open"}).adoptedStyleSheets=[r]}emit(e,r){return this.dispatchEvent(new CustomEvent(e,{detail:r,bubbles:!0,composed:!0,cancelable:!0}))}$(e){return this.shadowRoot.querySelector(e)}};function f(o,e){return customElements.get(o)||customElements.define(o,e),e}function l(o,e={},...r){let a=document.createElement(o);for(let[t,n]of Object.entries(e||{}))n==null||n===!1||(t.startsWith("on")&&typeof n=="function"?a.addEventListener(t.slice(2),n):t==="class"?a.className=n:t==="text"?a.textContent=n:!o.includes("-")&&t in a&&!t.includes("-")&&t!=="list"&&t!=="form"?a[t]=n:a.setAttribute(t,n===!0?"":n));for(let t of r.flat())t!=null&&t!==!1&&a.append(t instanceof Node?t:String(t));return a}var u={send:"M5 12h14M13 6l6 6-6 6",stop:"M7 7h10v10H7z",copy:"M9 9h10v10H9zM5 15V5h10",check:"M5 12l5 5 9-10",retry:"M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4",edit:"M4 20h4L19 9l-4-4L4 16zM14 6l4 4",down:"M12 5v14M6 13l6 6 6-6",clip:"M16 8l-6.5 6.5a2 2 0 0 0 2.8 2.8L19 10.6a4 4 0 0 0-5.7-5.7L6.6 11.6a6 6 0 0 0 8.5 8.5L20 15",x:"M6 6l12 12M18 6L6 18",tool:"M14 6a4 4 0 0 0 5 5l-8 8a2 2 0 0 1-3-3l8-8a4 4 0 0 1-2-2z",chev:"M9 6l6 6-6 6",sun:"M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",moon:"M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z",auto:"M12 3a9 9 0 1 0 0 18zM12 3a9 9 0 0 1 0 18",alert:"M12 8v5M12 16.5v.5M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z"};function h(o){let e=document.createElementNS("http://www.w3.org/2000/svg","svg");e.setAttribute("viewBox","0 0 24 24"),e.setAttribute("class","icon"),e.setAttribute("aria-hidden","true"),e.setAttribute("fill","none"),e.setAttribute("stroke","currentColor"),e.setAttribute("stroke-width","2"),e.setAttribute("stroke-linecap","round"),e.setAttribute("stroke-linejoin","round");let r=document.createElementNS("http://www.w3.org/2000/svg","path");return r.setAttribute("d",u[o]||""),e.append(r),e}async function b(o){try{return await navigator.clipboard.writeText(o),!0}catch{}try{let e=l("textarea",{value:o});e.style.cssText="position:fixed;opacity:0",document.body.append(e),e.select();let r=document.execCommand("copy");return e.remove(),r}catch{return!1}}export{c as a,f as b,l as c,h as d,b as e};
//# sourceMappingURL=chunk-REXY427J.js.map
