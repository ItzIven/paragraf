import { progress } from '../store.js';
import { db, cardsFor, fachName, blockById, loginHint } from '../content.js';
import { buildQueue, schedule, label, isNew, isDue } from '../srs.js';
import { CONFIG } from '../config.js';
import { esc, rich, shuffle } from '../ui.js';

// Routen: #/karten (Auswahl) · #/karten/faellig · #/karten/fach/AO · #/karten/block/AO-04
export function render(view, [mode, arg]) {
  if (!mode) return pick(view);
  const faecher = progress.settings.faecher;
  let deck, title;
  if (mode === 'fach') { deck = cardsFor({ fach: arg }); title = fachName(arg); }
  else if (mode === 'block') { deck = cardsFor({ block: arg }); title = `${arg} ${blockById(arg)?.titel || ''}`; }
  else { deck = db.cards.filter((c) => faecher.includes(c.fach)); title = 'Fällige Karten'; }
  const queue = mode === 'block' ? [...deck.filter((c) => isDue(c.id) || isNew(c.id)), ...shuffle(deck.filter((c) => !isDue(c.id) && !isNew(c.id)))] : buildQueue(deck);
  session(view, queue, title);
}

function pick(view) {
  const faecher = progress.settings.faecher;
  const all = db.cards.filter((c) => faecher.includes(c.fach));
  const due = buildQueue(all).length;
  view.innerHTML = `
    <div class="head"><div><h1>Karteikarten</h1><div class="sub">${all.length} Karten in deinen Fächern</div></div></div>
    ${loginHint()}
    <a class="panel row" href="#/karten/faellig" style="text-decoration:none;color:inherit"><div><h3>Heute fällig</h3><span class="small muted">Wiederholungen zuerst, dann neue Karten bis zu deinem Tageslimit</span></div><span class="spacer"></span><span class="result-big" style="font-size:2rem">${due}</span></a>
    <h2>Nach Fach</h2>
    <div class="register">${CONFIG.faecher.map((f) => { const n = cardsFor({ fach: f.id }).length; const nd = cardsFor({ fach: f.id }).filter((c) => isDue(c.id)).length;
      return `<a class="reg-item" href="#/karten/fach/${f.id}" style="text-decoration:none;color:inherit" data-status="0"><span class="code">${f.id}</span><span><span class="title">${f.name}</span><br><span class="meta">${n ? `${n} Karten · ${nd} fällig` : 'noch keine Inhalte'}</span></span><span></span></a>`; }).join('')}</div>
    <p class="small muted" style="margin-top:1.2rem">Einzelne Lernblöcke startest du unter „Lernblöcke“.</p>`;
}

function session(view, queue, title) {
  let i = 0, shown = false, reviewed = 0;
  const total = queue.length;
  if (!total) {
    view.innerHTML = `<div class="head"><h1>${esc(title)}</h1></div><div class="empty"><p><b>Für heute ist alles erledigt.</b></p><p>Neue Karten kommen morgen dazu. Du kannst einzelne Blöcke jederzeit unter „Lernblöcke“ wiederholen.</p><a class="btn" href="#/bloecke">Lernblöcke</a></div>`;
    return;
  }
  const draw = () => {
    if (i >= queue.length) {
      view.innerHTML = `<div class="head"><h1>Geschafft</h1></div><div class="panel stack"><p><b>${reviewed} Wiederholungen</b> in dieser Runde.</p><div class="btn-row"><a class="btn btn--primary" href="#/heute">Zur Übersicht</a><a class="btn" href="#/pruefen">Wissen prüfen</a></div></div>`;
      return;
    }
    const c = queue[i];
    const blk = blockById(c.block);
    view.innerHTML = `
      <div class="session-top"><a class="btn btn--ghost" href="#/karten" aria-label="Lernrunde beenden">✕</a><div class="bar"><i style="width:${(i / queue.length) * 100}%"></i></div><span class="small muted">${i + 1}/${queue.length}</span></div>
      <article class="flash" aria-live="polite">
        <div class="ruled"><div class="margin">${esc(c.block || '')}${isNew(c.id) ? '<br><span class="muted">neu</span>' : ''}</div><div class="body"><div class="q">${rich(c.front)}</div></div></div>
        ${shown ? `<div class="ruled a"><div class="margin">${esc(c.norm || '')}</div><div class="body">${rich(c.back)}${c.source ? `<div class="src">Fundstelle: ${esc(c.source)}</div>` : ''}</div></div>` : ''}
      </article>
      ${shown ? `<div class="grade">${[[1, 'Nochmal'], [2, 'Schwer'], [3, 'Gut'], [4, 'Leicht']].map(([g, l]) => `<button data-g="${g}"><b>${l}</b><span>${label(g, c.id)}</span></button>`).join('')}</div><p class="kbd">Tasten 1–4</p>`
              : `<button class="btn btn--primary btn--block" id="show" style="margin-top:14px">Antwort zeigen</button><p class="kbd">Leertaste</p>`}
      <p class="small muted">${esc(title)}${blk ? ` · ${esc(blk.titel)}` : ''}</p>`;
    view.querySelector('#show')?.addEventListener('click', () => { shown = true; draw(); });
    view.querySelectorAll('[data-g]').forEach((b) => b.onclick = () => grade(Number(b.dataset.g)));
  };
  const grade = (g) => {
    const c = queue[i];
    schedule(c.id, g); reviewed++;
    if (g === 1) queue.push(c);               // in dieser Runde noch einmal
    i++; shown = false; draw();
  };
  const onKey = (e) => {
    if (!view.querySelector('.flash')) return document.removeEventListener('keydown', onKey);
    if (!shown && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); shown = true; draw(); }
    else if (shown && /^[1-4]$/.test(e.key)) grade(Number(e.key));
  };
  document.addEventListener('keydown', onKey);
  draw();
}
