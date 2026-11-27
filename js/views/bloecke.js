import { progress, commit } from '../store.js';
import { db, fachName, cardsFor, questionsFor, blockById } from '../content.js';
import { CONFIG } from '../config.js';
import { esc, sheet, toast, pct } from '../ui.js';
import { blockSeries, chart, pill } from '../stats.js';

const STATUS = ['Offen', 'Begonnen', 'Gelernt', 'Klausurfest'];
const filter = { fach: 'alle', stufe: 'alle' };

export function render(view, [openId]) {
  const st = (id) => progress.blocks[id]?.status || 0;
  const list = db.blocks.filter((b) => (filter.fach === 'alle' || b.fach === filter.fach) && (filter.stufe === 'alle' || String(b.stufe) === filter.stufe));
  const groups = CONFIG.faecher.map((f) => ({ ...f, items: list.filter((b) => b.fach === f.id) })).filter((g) => g.items.length);
  const all = db.blocks;
  const sure = all.filter((b) => st(b.id) === 3).length;

  view.innerHTML = `
    <div class="head"><div><h1>Lernblöcke</h1><div class="sub">${sure} von ${all.length} klausurfest</div></div></div>
    <div class="panel">
      <div class="matrix" aria-label="Übersicht aller Lernblöcke">${all.map((b) => `<i data-status="${st(b.id)}" title="${b.id}"></i>`).join('')}</div>
      <p class="small muted" style="margin-bottom:0">Jedes Kästchen ist ein Block aus deinem Prüfungslehrplan. Rot begonnen, gelb gelernt, grün klausurfest.</p>
    </div>
    <div class="chips" role="group" aria-label="Fach">${['alle', ...CONFIG.faecher.map((f) => f.id)].map((f) => `<button class="chip" data-f="${f}" aria-pressed="${filter.fach === f}">${f === 'alle' ? 'Alle Fächer' : f}</button>`).join('')}</div>
    <div class="chips" role="group" aria-label="Stufe" style="margin-top:-4px">${[['alle', 'Alle Stufen'], ['1', 'Stufe 1 Grundgerüst'], ['2', 'Stufe 2 Rechenblöcke'], ['3', 'Stufe 3 Hauptstudium']].map(([v, l]) => `<button class="chip" data-s="${v}" aria-pressed="${filter.stufe === v}">${l}</button>`).join('')}</div>
    <div class="register">${groups.map((g) => `
      <section class="reg-group"><h2>${g.name} <small>${pct(g.items.reduce((s, b) => s + st(b.id), 0), g.items.length * 3)} %</small></h2>
        <div class="register">${g.items.map((b) => `
          <button class="reg-item" data-id="${b.id}" data-status="${st(b.id)}">
            <span class="code">${b.id}</span>
            <span><span class="title">${esc(b.titel)}</span><br><span class="meta">${STATUS[st(b.id)]} · ${cardsFor({ block: b.id }).length} Karten · ${questionsFor({ block: b.id }).length} Fragen${(() => { const s = blockSeries(b.id, 3); if (!s.length) return ''; const r = s.reduce((a, x) => a + x.r, 0), n = s.reduce((a, x) => a + x.n, 0); return ` · zuletzt ${pill(pct(r, n))}`; })()}</span></span>
            <span class="prio" title="Lernpriorität">${b.prio}</span>
          </button>`).join('')}</div></section>`).join('')}
    </div>`;

  view.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { filter.fach = b.dataset.f; render(view, []); });
  view.querySelectorAll('[data-s]').forEach((b) => b.onclick = () => { filter.stufe = b.dataset.s; render(view, []); });
  view.querySelectorAll('.reg-item').forEach((b) => b.onclick = () => openBlock(b.dataset.id, view));
  if (openId && blockById(openId)) openBlock(openId, view);
}

function openBlock(id, view) {
  const b = blockById(id);
  const cur = progress.blocks[id]?.status || 0;
  const nCards = cardsFor({ block: id }).length, nQ = questionsFor({ block: id }).length;
  const schemas = db.schemas.filter((s) => s.block === id || (s.blocks || []).includes(id));
  const answers = questionsFor({ block: id }).flatMap((q) => progress.answers[q.id]?.ok || []);
  const series = blockSeries(id);
  sheet(`
    <div class="ruled"><div class="margin">${b.id}<br><span class="muted">${b.prio}</span></div>
    <div class="body stack">
      <h2 style="margin:0">${esc(b.titel)}</h2>
      <p class="small muted" style="margin:0">${fachName(b.fach)}, Stufe ${b.stufe}, Lehrplan-PDF S. ${b.lehrplanSeite}</p>
      ${b.normen ? `<p><b>Normanker:</b> ${esc(b.normen)}</p>` : ''}
      ${answers.length ? `<p class="small">Trefferquote zuletzt: <b>${pct(answers.filter(Boolean).length, answers.length)} %</b> aus ${answers.length} Antworten</p>` : ''}
      ${series.length ? `<div><div class="small muted">Verlauf der letzten ${series.length} Runde${series.length > 1 ? 'n' : ''} (Linie = 50 %)</div>${chart(series)}</div>` : ''}
      <div><div class="small muted">Wie sicher bist du?</div>
        <div class="status-pick">${STATUS.map((s, i) => `<button data-s="${i}" aria-pressed="${cur === i}">${s}</button>`).join('')}</div></div>
      <div class="btn-row">
        <a class="btn btn--primary" href="#/karten/block/${id}" ${nCards ? '' : 'aria-disabled="true"'}>${nCards} Karten lernen</a>
        <a class="btn" href="#/pruefen/block/${id}">${nQ} Fragen</a>
      </div>
      ${schemas.map((s) => `<a class="btn btn--ghost btn--block" href="#/schemata/${s.id}">Schema: ${esc(s.titel)}</a>`).join('')}
      ${!nCards && !nQ ? '<p class="small muted">Für diesen Block sind noch keine Inhalte freigegeben.</p>' : ''}
    </div></div>`, (el, close) => {
    el.querySelectorAll('[data-s]').forEach((btn) => btn.onclick = () => {
      progress.blocks[id] = { status: Number(btn.dataset.s), t: Date.now() }; commit();
      toast(`${id}: ${STATUS[btn.dataset.s]}`); close(); render(view, []);
    });
    el.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
  });
}
