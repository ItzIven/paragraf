// Kleine DOM-Helfer
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

// Einfache Auszeichnung in Inhalten: **fett**, Zeilenumbrüche, "- " als Liste
export function rich(s = '') {
  const lines = esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').split('\n');
  let html = '', inList = false;
  for (const l of lines) {
    if (/^- /.test(l)) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${l.slice(2)}</li>`; }
    else { if (inList) { html += '</ul>'; inList = false; } if (l.trim()) html += `<p>${l}</p>`; }
  }
  return html + (inList ? '</ul>' : '');
}

let toastTimer;
export function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

export function sheet(html, onMount) {
  const o = $('#overlay');
  o.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  o.hidden = false;
  const close = () => { o.hidden = true; o.innerHTML = ''; document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  o.onclick = (e) => { if (e.target === o) close(); };
  onMount?.(o.firstElementChild, close);
  o.querySelector('button, [href], input')?.focus();
  return close;
}

export const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
