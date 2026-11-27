import { progress, commit } from '../store.js';
import { db, questionsFor, blockById, fachName } from '../content.js';
import { CONFIG } from '../config.js';
import { esc, rich, shuffle, pct, toast } from '../ui.js';
import { blockTable, pill, trendText } from '../stats.js';

// #/pruefen · #/pruefen/block/<id>
const cfg = { mode: 'training', n: 10, faecher: null, art: 'alle' };

export function render(view, [kind, arg]) {
  if (kind === 'runde') return runde(view, Number(arg));
  if (kind === 'block') {
    // Fälle immer vollständig: Schritte aus anderen Blöcken mitnehmen
    const own = questionsFor({ block: arg }); const falls = new Set(own.map((q) => q.fall).filter(Boolean));
    const pool = [...own, ...db.questions.filter((q) => q.fall && falls.has(q.fall) && !own.includes(q))];
    return run(view, { mode: 'training', pool: weighted(pool), title: `${arg} ${blockById(arg)?.titel || ''}` });
  }
  cfg.faecher ||= [...progress.settings.faecher];
  const ARTEN = { alle: 'Alle', fall: 'Nur Fälle', rechnen: 'Nur Rechnen' };
  const pool = questionsFor({ faecher: cfg.faecher }).filter((q) => cfg.art === 'alle' || (cfg.art === 'fall' ? q.fall : q.typ === 'rechnen'));
  view.innerHTML = `
    <div class="head"><div><h1>Wissen prüfen</h1><div class="sub">${pool.length} Fragen in der Auswahl</div></div></div>
    <div class="mode-pick" role="group" aria-label="Modus">
      <button data-mode="training" aria-pressed="${cfg.mode === 'training'}"><h3>Training</h3><span class="small muted">Nach jeder Frage siehst du die Lösung mit Norm und Begründung.</span></button>
      <button data-mode="klausur" aria-pressed="${cfg.mode === 'klausur'}"><h3>Klausurmodus</h3><span class="small muted">Mit Zeitlimit, Punkten und Notenpunkten, Auswertung erst am Ende.</span></button>
    </div>
    <h2>Fächer</h2>
    <div class="chips">${CONFIG.faecher.map((f) => `<button class="chip" data-f="${f.id}" aria-pressed="${cfg.faecher.includes(f.id)}">${f.id}</button>`).join('')}</div>
    <h2>Fragenart</h2>
    <div class="chips">${Object.entries(ARTEN).map(([k, t]) => `<button class="chip" data-art="${k}" aria-pressed="${cfg.art === k}">${t}</button>`).join('')}</div>
    <h2>Anzahl Fragen</h2>
    <div class="chips">${[5, 10, 20, 30].map((n) => `<button class="chip" data-n="${n}" aria-pressed="${cfg.n === n}">${n}</button>`).join('')}</div>
    ${cfg.mode === 'klausur' ? '<p class="small muted">Zeit: eine Minute je Punkt (Fragen zählen 1 bis 3 Punkte nach Schwierigkeit). Fälle zählen als Ganzes.</p>' : ''}
    <button class="btn btn--primary btn--block" id="go" ${pool.length ? '' : 'disabled'} style="margin-top:12px">${pool.length ? 'Starten' : 'Keine Fragen in dieser Auswahl'}</button>
    ${weak()}
    ${history()}`;
  view.querySelectorAll('[data-mode]').forEach((b) => b.onclick = () => { cfg.mode = b.dataset.mode; render(view, []); });
  view.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { const f = b.dataset.f; cfg.faecher = cfg.faecher.includes(f) ? cfg.faecher.filter((x) => x !== f) : [...cfg.faecher, f]; render(view, []); });
  view.querySelectorAll('[data-art]').forEach((b) => b.onclick = () => { cfg.art = b.dataset.art; render(view, []); });
  view.querySelectorAll('[data-n]').forEach((b) => b.onclick = () => { cfg.n = Number(b.dataset.n); render(view, []); });
  view.querySelector('#go').onclick = () => run(view, { mode: cfg.mode, pool: weighted(pool, cfg.n), title: cfg.mode === 'klausur' ? 'Klausurmodus' : 'Training' });
}

// Fälle (gleiche "fall"-ID) bleiben als Einheit zusammen, Schritte in Reihenfolge
function units(pool) {
  const map = new Map();
  pool.forEach((q) => { const k = q.fall || q.id; if (!map.has(k)) map.set(k, []); map.get(k).push(q); });
  return [...map.values()].map((u) => u.sort((a, b) => (a.schritt || 0) - (b.schritt || 0)));
}
export const unitCount = (pool) => units(pool).length;

// Fragen, die zuletzt falsch beantwortet wurden, kommen bevorzugt dran
function weighted(pool, n = Infinity) {
  const score = (q) => { const a = progress.answers[q.id]?.ok || []; return a.length ? a.filter(Boolean).length / a.length : 0.5; };
  const avg = (u) => u.reduce((s, q) => s + score(q), 0) / u.length;
  const out = [];
  for (const u of shuffle(units(pool)).sort((a, b) => avg(a) - avg(b) + (Math.random() - 0.5) * 0.4)) {
    if (out.length >= n) break;
    out.push(...u);
  }
  return out;
}

// Notenschlüssel der HS-Aufsichtsarbeiten 2024 (Anteil an der Höchstpunktzahl)
const SCALE = [[96, 15], [91, 14], [87, 13], [82, 12], [78, 11], [73, 10], [68, 9], [64, 8], [59, 7], [54, 6], [50, 5], [40, 4], [30, 3], [25, 2], [20, 1], [0, 0]];
const notenpunkte = (p) => SCALE.find(([min]) => p >= min)[1];
const pts = (q) => q.punkte ?? q.niveau ?? 2;

const fmtDate = (t) => new Date(t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const resultText = (e) => (e.max ? `${pct(e.got, e.max)} % · ${e.np} NP` : `${pct(e.right, e.n)} %`);

function weak() {
  const rows = blockTable(30, 3);
  if (!rows.length) return '';
  return `<h2>Lernblöcke der letzten 30 Tage</h2><p class="small muted" style="margin-top:-6px">Schwächste zuerst, ab 3 beantworteten Fragen. Trend: letzte Runde gegenüber dem Schnitt davor.</p>
    <table class="table"><tr><th>Block</th><th>Quote</th><th>Trend</th><th></th></tr>${rows.slice(0, 8).map((x) => `<tr><td><a href="#/bloecke/${x.id}">${esc(x.id)}</a> <span class="small muted">${esc(blockById(x.id)?.titel || fachName(x.id))}</span></td><td>${pill(x.p)} <span class="small muted">${x.r}/${x.n}</span></td><td class="small">${trendText(x.trend)}</td><td><a href="#/pruefen/block/${x.id}">Üben</a></td></tr>`).join('')}</table>`;
}

function history() {
  const ex = progress.exams.slice(-10).reverse();
  if (!ex.length) return '';
  return `<h2>Bisherige Runden</h2><table class="table"><tr><th>Datum</th><th>Modus</th><th>Ergebnis</th><th></th></tr>${ex.map((e) => `<tr><td>${fmtDate(e.t)}</td><td>${e.mode === 'klausur' ? 'Klausur' : 'Training'}</td><td>${resultText(e)}</td><td>${e.items ? `<a href="#/pruefen/runde/${e.t}">Ansehen</a>` : ''}</td></tr>`).join('')}</table>`;
}

// Rückblick auf eine Runde: jede Frage mit eigener und richtiger Antwort
function runde(view, t, filter = 'alle') {
  const e = progress.exams.find((x) => x.t === t);
  if (!e?.items) { view.innerHTML = '<div class="empty">Für diese Runde sind keine Einzelheiten gespeichert. <a href="#/pruefen">Zurück</a></div>'; return; }
  const byId = new Map(db.questions.map((q) => [q.id, q]));
  const items = e.items.map((it) => ({ ...it, q: byId.get(it.id) }));
  const wrong = items.filter((it) => !it.ok && it.q);
  const shown = items.filter((it) => filter === 'alle' || (filter === 'falsch' ? !it.ok : it.ok));
  const answerText = (q, m) => {
    if (q.typ === 'rechnen') return m === '' || m == null ? '–' : `${m}${q.einheit ? ' ' + q.einheit : ''}`;
    const sel = (m || []).map((i) => q.optionen[i]).filter(Boolean);
    return sel.length ? sel.map((o) => esc(o.text)).join('; ') : '– (keine Antwort)';
  };
  const rightText = (q) => (q.typ === 'rechnen' ? `${Number(q.loesung).toLocaleString('de-DE')}${q.einheit ? ' ' + q.einheit : ''}` : q.optionen.filter((o) => o.richtig).map((o) => esc(o.text)).join('; '));
  const whyText = (q, m) => (q.typ === 'rechnen' ? [] : (m || []).map((i) => q.optionen[i]).filter((o) => o && !o.richtig && o.warum).map((o) => `<li><b>${esc(o.text)}:</b> ${esc(o.warum)}</li>`));
  const sv = (q) => {
    const first = q.fall ? db.questions.find((x) => x.fall === q.fall && x.schritt === 1) : null;
    return `${first?.fallSachverhalt ? `<details class="fall-sv"><summary>Sachverhalt des Falls</summary><div class="small">${rich(first.fallSachverhalt)}</div></details>` : ''}${q.sachverhalt ? `<div class="small">${rich(q.sachverhalt)}</div>` : ''}`;
  };
  view.innerHTML = `
    <div class="head"><div><h1>${e.mode === 'klausur' ? 'Klausurrunde' : 'Trainingsrunde'}</h1><div class="sub">${fmtDate(e.t)} · ${resultText(e)} · ${e.right} von ${e.n} richtig</div></div></div>
    <div class="chips">${[['alle', `Alle (${items.length})`], ['falsch', `Falsch (${items.filter((i) => !i.ok).length})`], ['richtig', `Richtig (${items.filter((i) => i.ok).length})`]].map(([k, l]) => `<button class="chip" data-f="${k}" aria-pressed="${filter === k}">${l}</button>`).join('')}</div>
    <div class="stack" style="margin-top:12px">${shown.map((it) => {
      const q = it.q;
      if (!q) return `<div class="panel small muted">${it.ok ? '✓' : '✗'} Frage ${esc(it.id)} ist in den geladenen Inhalten nicht mehr vorhanden.</div>`;
      const why = whyText(q, it.m);
      return `<details class="panel review ${it.ok ? 'ok' : 'bad'}"><summary><span class="mark">${it.ok ? '✓' : '✗'}</span><span>${esc(q.frage)}</span><span class="small muted">${esc(q.block || q.fach)}${q.fall ? ` · Fall, Schritt ${q.schritt}` : ''}</span></summary>
        <div class="stack small" style="margin-top:10px">${sv(q)}
          <div><b>Deine Antwort:</b> ${answerText(q, it.m)}</div>
          ${it.ok ? '' : `<div><b>Richtig:</b> ${rightText(q)}</div>`}
          ${why.length ? `<ul class="why-list">${why.join('')}</ul>` : ''}
          ${q.erklaerung ? `<div>${rich(q.erklaerung)}</div>` : ''}
          ${q.norm ? `<div class="muted">${esc(q.norm)}</div>` : ''}
        </div></details>`; }).join('') || '<div class="empty">Keine Fragen in dieser Auswahl.</div>'}</div>
    <div class="btn-row" style="margin-top:16px">${wrong.length ? '<button class="btn btn--primary" id="redo">Falsche Fragen üben</button>' : ''}<a class="btn" href="#/pruefen">Zurück</a></div>`;
  view.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => runde(view, t, b.dataset.f));
  view.querySelector('#redo')?.addEventListener('click', () => {
    const ids = new Set(wrong.map((w) => w.q.fall || w.q.id));
    run(view, { mode: 'training', pool: db.questions.filter((q) => ids.has(q.fall || q.id)).sort((a, b) => (a.fall || a.id).localeCompare(b.fall || b.id) || (a.schritt || 0) - (b.schritt || 0)), title: 'Falsche Fragen' });
  });
}

function run(view, { mode, pool, title }) {
  const qs = pool.map((q) => ({ ...q, order: q.typ === 'rechnen' ? [] : shuffle(q.optionen.map((o, i) => ({ ...o, i }))) }));
  let typed = '';
  const answers = []; // { q, picked: [i], ok }
  let i = 0, picked = new Set(), checked = false, timer, end;
  if (!qs.length) { view.innerHTML = '<div class="empty">Für diese Auswahl gibt es noch keine Fragen. <a href="#/pruefen">Zurück</a></div>'; return; }
  if (mode === 'klausur') end = Date.now() + qs.reduce((s, q) => s + pts(q), 0) * 60000;

  // "1.234,56" und "1234.56" werden beide erkannt
  const num = (v) => { let t = String(v).replace(/[^0-9.,-]/g, ''); t = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, '') : t; return Number(t); };
  const isRight = (q, set) => q.typ === 'rechnen'
    ? typed.trim() !== '' && Math.abs(num(typed) - q.loesung) <= (q.toleranz ?? 0)
    : q.order.every((o) => !!o.richtig === set.has(o.i));
  const fmt = (q) => `${Number(q.loesung).toLocaleString('de-DE', { minimumFractionDigits: q.loesung % 1 ? 2 : 0 })}${q.einheit ? ' ' + q.einheit : ''}`;
  const draw = () => {
    if (i >= qs.length) return finish();
    const q = qs[i], calc = q.typ === 'rechnen', multi = !calc && q.optionen.filter((o) => o.richtig).length > 1;
    view.innerHTML = `
      <div class="session-top"><a class="btn btn--ghost" href="#/pruefen" aria-label="Abbrechen">✕</a><div class="bar"><i style="width:${(i / qs.length) * 100}%"></i></div><span class="small muted">${i + 1}/${qs.length}</span>${end ? '<span class="timer" id="timer"></span>' : ''}</div>
      <div class="flash">
        <div class="ruled"><div class="margin">${esc(q.block || q.fach)}<br><span class="muted">${'●'.repeat(pts(q))}</span></div><div class="body">
          ${q.fall ? (() => { const steps = db.questions.filter((x) => x.fall === q.fall).sort((a, b) => a.schritt - b.schritt); const first = steps[0]; const k = q.schritt || steps.findIndex((x) => x.id === q.id) + 1;
            return `<div class="fall-tag">Fall · Schritt ${k} von ${steps.length}</div>${first.fallSachverhalt ? `<details class="fall-sv" ${k === 1 ? 'open' : ''}><summary>Sachverhalt</summary><div class="small">${rich(first.fallSachverhalt)}</div></details>` : ''}`; })() : ''}
          ${q.sachverhalt ? `<div class="small" style="margin-bottom:8px">${rich(q.sachverhalt)}</div>` : ''}
          <div class="q">${rich(q.frage)}</div>
          <div class="small muted">${calc ? `Ergebnis eingeben${q.einheit ? ' in ' + esc(q.einheit) : ''}.` : multi ? 'Mehrere Antworten können richtig sein.' : 'Eine Antwort ist richtig.'}</div>
        </div></div>
        ${calc ? `<div class="calc"><input id="calc" inputmode="decimal" autocomplete="off" placeholder="z. B. 111,50" value="${esc(typed)}" ${checked ? 'disabled' : ''} aria-label="Ergebnis">${q.einheit ? `<span>${esc(q.einheit)}</span>` : ''}</div>${checked ? `<div class="calc-res ${isRight(q) ? 'right' : 'wrong'}">${isRight(q) ? 'Richtig' : 'Richtig wäre'}: ${fmt(q)}</div>` : ''}` : ''}
        <div class="opts">${q.order.map((o, k) => {
          const cls = checked ? (o.richtig ? 'right' : picked.has(o.i) ? 'wrong' : '') : '';
          return `<button class="opt ${cls}" data-i="${o.i}" aria-pressed="${picked.has(o.i)}" ${checked ? 'disabled' : ''}><span class="k">${'ABCDEF'[k]}</span><span>${esc(o.text)}</span>${checked && o.warum ? `<span class="why">${esc(o.warum)}</span>` : ''}</button>`; }).join('')}</div>
        ${checked && q.erklaerung ? `<div class="ruled a"><div class="margin">${esc(q.norm || '')}</div><div class="body">${rich(q.erklaerung)}</div></div>` : ''}
      </div>
      <button class="btn btn--primary btn--block" id="next" style="margin-top:14px" ${picked.size || checked || (calc && typed.trim()) ? '' : 'disabled'}>${mode === 'training' && !checked ? 'Antwort prüfen' : i + 1 < qs.length ? 'Nächste Frage' : 'Auswerten'}</button>`;
    view.querySelectorAll('.opt').forEach((b) => b.onclick = () => {
      const k = Number(b.dataset.i);
      if (multi) picked.has(k) ? picked.delete(k) : picked.add(k); else picked = new Set([k]);
      draw();
    });
    const inp = view.querySelector('#calc');
    if (inp && !checked) {
      inp.oninput = () => { typed = inp.value; view.querySelector('#next').disabled = !typed.trim(); };
      inp.onkeydown = (e) => { if (e.key === 'Enter' && typed.trim()) next(); };
      inp.focus();
    }
    view.querySelector('#next').onclick = next;
    tick();
  };
  const next = () => {
    const q = qs[i];
    if (mode === 'training' && !checked) { checked = true; record(q); return draw(); }
    if (mode === 'klausur') record(q);
    i++; picked = new Set(); typed = ''; checked = false; draw();
  };
  const record = (q) => {
    const ok = isRight(q, picked);
    answers.push({ q, ok, mine: q.typ === 'rechnen' ? typed.trim() : [...picked].sort((a, b) => a - b) });
    const a = progress.answers[q.id] || { ok: [] };
    a.ok = [...a.ok, ok].slice(-5); a.t = Date.now();
    progress.answers[q.id] = a;
  };
  const tick = () => {
    clearTimeout(timer);
    if (!end) return;
    const left = Math.max(0, end - Date.now());
    const el = view.querySelector('#timer');
    if (!el) return;
    el.textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
    if (left <= 0) { toast('Zeit abgelaufen'); while (answers.length < qs.length) { const q = qs[answers.length]; if (answers.length !== i) { picked = new Set(); typed = ''; } record(q); } i = qs.length; return finish(); }
    timer = setTimeout(tick, 1000);
  };
  const finish = () => {
    clearTimeout(timer);
    const right = answers.filter((a) => a.ok).length;
    const max = answers.reduce((s, a) => s + pts(a.q), 0);
    const got = answers.reduce((s, a) => s + (a.ok ? pts(a.q) : 0), 0);
    const pp = max ? Math.round((got / max) * 1000) / 10 : 0;
    const np = notenpunkte(pp);
    const perBlock = {};
    answers.forEach(({ q, ok }) => { const k = q.block || q.fach; perBlock[k] ||= [0, 0]; perBlock[k][1]++; if (ok) perBlock[k][0]++; });
    progress.exams.push({ t: Date.now(), mode, faecher: [...new Set(answers.map((a) => a.q.fach))], n: answers.length, right, got, max, np, perBlock, items: answers.map((a) => ({ id: a.q.id, ok: a.ok, m: a.mine })) });
    commit();
    const p = pct(right, answers.length);
    view.innerHTML = `
      <div class="head"><h1>${esc(title)}: Auswertung</h1></div>
      <div class="panel stack">
        <div class="result-row"><div><div class="result-big">${np}</div><div class="small muted">Notenpunkte</div></div><div><div class="result-big">${pp.toLocaleString('de-DE')} %</div><div class="small muted">${got} von ${max} Punkten</div></div></div>
        <p>${np >= 5 ? (np >= 11 ? 'Das sitzt.' : 'Bestanden, die Lücken stehen unten.') : 'Unter 5 Punkten: hier lohnt sich Wiederholung mit Karten und Schemata.'} ${right} von ${answers.length} Fragen vollständig richtig.</p>
        <p class="small muted">Punkte je Frage nach Schwierigkeit (1–3). Umrechnung nach dem Notenschlüssel der HS-Aufsichtsarbeiten 2024 (5 Punkte ab 50 %, 15 Punkte ab 96 %). Orientierung, keine amtliche Note. Bei Mehrfachauswahl zählt eine Frage nur, wenn genau die richtigen Antworten gewählt sind.</p>
      </div>
      <h2>Nach Lernblock</h2>
      <table class="table"><tr><th>Block</th><th>Richtig</th></tr>${Object.entries(perBlock).map(([b, [r, n]]) => `<tr><td><a href="#/bloecke/${b}">${esc(b)}</a> ${esc(blockById(b)?.titel || fachName(b))}</td><td>${r}/${n}</td></tr>`).join('')}</table>
      ${mode === 'klausur' ? `<h2>Lösungen</h2>${answers.map(({ q, ok }) => `<details class="panel" style="margin-bottom:8px"><summary>${ok ? '✓' : '✗'} ${esc(q.frage)}</summary><div class="small" style="margin-top:8px"><b>Richtig:</b> ${q.typ === 'rechnen' ? fmt(q) : q.optionen.filter((o) => o.richtig).map((o) => esc(o.text)).join('; ')}</div>${q.erklaerung ? `<div class="small">${rich(q.erklaerung)}</div>` : ''}${q.norm ? `<div class="small muted">${esc(q.norm)}</div>` : ''}</details>`).join('')}` : ''}
      <div class="btn-row" style="margin-top:16px"><a class="btn btn--primary" href="#/pruefen">Neue Runde</a><a class="btn" href="#/pruefen/runde/${progress.exams.at(-1).t}">Runde im Detail</a><a class="btn" href="#/karten/faellig">Karten lernen</a></div>`;
  };
  draw();
}
