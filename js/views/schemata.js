import { db, fachName, blockById } from '../content.js';
import { CONFIG } from '../config.js';
import { esc, rich } from '../ui.js';

// #/schemata · #/schemata/<id>
export function render(view, [id]) {
  if (id) return detail(view, db.schemas.find((s) => s.id === id));
  const groups = CONFIG.faecher.map((f) => ({ ...f, items: db.schemas.filter((s) => s.fach === f.id) }));
  view.innerHTML = `
    <div class="head"><div><h1>Prüfungsschemata</h1><div class="sub">Lesen oder Schritt für Schritt aus dem Kopf aufbauen</div></div></div>
    ${groups.map((g) => `<section><h2>${g.name}</h2>${g.items.length
      ? `<div class="schema-list">${g.items.map((s) => `<a class="reg-item" href="#/schemata/${s.id}" style="text-decoration:none;color:inherit" data-status="0"><span class="code">${esc(s.block || g.id)}</span><span><span class="title">${esc(s.titel)}</span><br><span class="meta">${s.schritte.length} Schritte</span></span><span></span></a>`).join('')}</div>`
      : '<div class="empty small">Noch keine Schemata für dieses Fach.</div>'}</section>`).join('')}`;
}

function detail(view, s) {
  if (!s) { view.innerHTML = '<div class="empty">Schema nicht gefunden. <a href="#/schemata">Zur Übersicht</a></div>'; return; }
  let mode = 'lesen', revealed = 0;
  const draw = () => {
    const recall = mode === 'abrufen';
    view.innerHTML = `
      <div class="session-top"><a class="btn btn--ghost" href="#/schemata" aria-label="Zur Übersicht">←</a><span class="small muted">${fachName(s.fach)}${s.block ? ` · ${esc(s.block)} ${esc(blockById(s.block)?.titel || '')}` : ''}</span></div>
      <h1>${esc(s.titel)}</h1>
      ${s.einleitung ? `<p class="lead">${esc(s.einleitung)}</p>` : ''}
      <div class="chips" role="group" aria-label="Modus">
        <button class="chip" data-m="lesen" aria-pressed="${!recall}">Lesen</button>
        <button class="chip" data-m="abrufen" aria-pressed="${recall}">Aus dem Kopf</button>
      </div>
      ${recall ? '<p class="small muted">Überlege dir zuerst den nächsten Prüfungsschritt mit Norm, dann deck ihn auf.</p>' : ''}
      <ol class="steps" style="list-style:none;padding:0;margin:18px 0 0 12px">
        ${s.schritte.map((st, i) => {
          if (recall && i > revealed) return '';
          const hidden = recall && i === revealed;
          return `<li class="step ${recall && i < revealed ? 'done' : ''} ${hidden ? 'current' : ''}">
            ${hidden ? `<button class="btn" id="reveal">Schritt ${i + 1} aufdecken</button>` : `
            <h3>${esc(st.titel)}</h3>
            ${st.norm ? `<div class="norm">${esc(st.norm)}</div>` : ''}
            ${st.detail ? `<div class="detail">${rich(st.detail)}</div>` : ''}
            ${st.falle ? `<div class="trap"><b>Klausurfalle:</b> ${esc(st.falle)}</div>` : ''}`}
          </li>`; }).join('')}
      </ol>
      ${recall && revealed >= s.schritte.length ? '<div class="panel"><b>Schema vollständig.</b> <span class="muted">Wie viele Schritte hattest du richtig im Kopf?</span></div>' : ''}
      ${s.quelle ? `<p class="small muted">Grundlage: ${esc(s.quelle)}</p>` : ''}`;
    view.querySelectorAll('[data-m]').forEach((b) => b.onclick = () => { mode = b.dataset.m; revealed = 0; draw(); });
    view.querySelector('#reveal')?.addEventListener('click', () => { revealed++; draw(); });
  };
  draw();
}
