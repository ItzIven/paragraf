import { progress, activeProfile, today, syncState } from '../store.js';
import { db, fachName } from '../content.js';
import { buildQueue } from '../srs.js';
import { esc, pct } from '../ui.js';
import { CONFIG } from '../config.js';

export function render(view) {
  const p = activeProfile();
  const faecher = progress.settings.faecher;
  const cards = db.cards.filter((c) => faecher.includes(c.fach));
  const queue = buildQueue(cards);
  const doneToday = progress.days[today()] || 0;
  const goal = progress.settings.dailyGoal;

  const days = [...Array(14)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (13 - i)); return progress.days[today(d)] > 0; });
  let streak = 0; for (let i = days.length - 1; i >= 0; i--) { if (days[i]) streak++; else if (i < days.length - 1) break; }

  const perFach = CONFIG.faecher.filter((f) => faecher.includes(f.id)).map((f) => {
    const bl = db.blocks.filter((b) => b.fach === f.id);
    const score = bl.reduce((s, b) => s + (progress.blocks[b.id]?.status || 0), 0);
    return { ...f, pct: pct(score, bl.length * 3) };
  });
  const next = db.blocks.filter((b) => faecher.includes(b.fach) && (progress.blocks[b.id]?.status || 0) < 3).sort((a, b) => a.stufe - b.stufe)[0];
  const lastExam = progress.exams.at(-1);
  const hour = new Date().getHours();
  const hello = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Hallo' : 'Guten Abend';

  view.innerHTML = `
    <div class="head"><div><h1>${hello}, ${esc(p.name)}</h1><div class="sub">${new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}${p.session ? ` · Sync ${syncState.status}` : ''}</div></div></div>
    <div class="today">
      <section class="panel due-card">
        <h2 style="margin:0">Heute fällig</h2>
        <div class="count">${queue.length}<small>Karten</small></div>
        <div><div class="row small muted"><span>Tagesziel</span><span class="spacer"></span><span>${doneToday} / ${goal}</span></div><div class="bar"><i style="width:${Math.min(100, pct(doneToday, goal))}%"></i></div></div>
        <div class="row small muted"><span>${streak ? `${streak} ${streak === 1 ? 'Tag' : 'Tage'} in Folge gelernt` : 'Noch keine Lernserie, heute geht es los'}</span></div>
        <div class="streak" aria-hidden="true">${days.map((on) => `<i class="${on ? 'on' : ''}"></i>`).join('')}</div>
        <a class="btn btn--primary" href="#/karten/faellig">${queue.length ? 'Karten lernen' : 'Neue Karten ansehen'}</a>
      </section>
      <section class="panel stack">
        <h2 style="margin:0">Prüfungsreife</h2>
        <div class="fach-list">${perFach.map((f) => `<div class="fach-row"><b>${f.id}</b><div class="bar"><i style="width:${f.pct}%"></i></div><span>${f.pct} %</span></div>`).join('')}</div>
        <p class="small muted">Berechnet aus deiner Einschätzung der Lernblöcke.</p>
        <a class="btn" href="#/bloecke">Lernblöcke öffnen</a>
      </section>
    </div>
    ${next ? `<h2>Als Nächstes</h2>
    <a class="reg-item" href="#/bloecke/${next.id}" data-status="${progress.blocks[next.id]?.status || 0}" style="text-decoration:none;color:inherit">
      <span class="code">${next.id}</span><span><span class="title">${esc(next.titel)}</span><br><span class="meta">${fachName(next.fach)} · Stufe ${next.stufe}</span></span><span class="prio">${next.prio}</span></a>` : ''}
    ${lastExam ? `<h2>Letzte Prüfung</h2><div class="panel row"><div><b>${pct(lastExam.right, lastExam.n)} %</b> richtig · ${lastExam.n} Fragen · ${lastExam.mode === 'klausur' ? 'Klausurmodus' : 'Training'}</div><span class="spacer"></span><a class="btn" href="#/pruefen">Neue Runde</a></div>` : ''}
  `;
}
export const onStoreChange = () => { const v = document.getElementById('view'); if (location.hash.startsWith('#/heute') || !location.hash) render(v); };
