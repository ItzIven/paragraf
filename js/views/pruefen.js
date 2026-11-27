import { progress, commit } from '../store.js';
import { questionsFor, blockById, fachName } from '../content.js';
import { CONFIG } from '../config.js';
import { esc, rich, shuffle, pct, toast } from '../ui.js';

// #/pruefen · #/pruefen/block/<id>
const cfg = { mode: 'training', n: 10, faecher: null, art: 'alle' };

export function render(view, [kind, arg]) {
  if (kind === 'block') return run(view, { mode: 'training', pool: weighted(questionsFor({ block: arg })), title: `${arg} ${blockById(arg)?.titel || ''}` });
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

function history() {
  const ex = progress.exams.slice(-5).reverse();
  if (!ex.length) return '';
  return `<h2>Bisherige Runden</h2><table class="table"><tr><th>Datum</th><th>Modus</th><th>Ergebnis</th></tr>${ex.map((e) => `<tr><td>${new Date(e.t).toLocaleDateString('de-DE')}</td><td>${e.mode === 'klausur' ? 'Klausur' : 'Training'}</td><td>${e.max ? `${pct(e.got, e.max)} % · ${e.np} NP` : `${pct(e.right, e.n)} %`}</td></tr>`).join('')}</table>`;
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
          ${q.fall ? (() => { const steps = qs.filter((x) => x.fall === q.fall); const first = steps[0]; const k = steps.indexOf(q) + 1;
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
    answers.push({ q, ok });
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
    if (left <= 0) { toast('Zeit abgelaufen'); while (answers.length < qs.length) { const q = qs[answers.length]; picked = answers.length === i ? picked : new Set(); record(q); } i = qs.length; return finish(); }
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
    progress.exams.push({ t: Date.now(), mode, faecher: [...new Set(answers.map((a) => a.q.fach))], n: answers.length, right, got, max, np, perBlock });
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
      <div class="btn-row" style="margin-top:16px"><a class="btn btn--primary" href="#/pruefen">Neue Runde</a><a class="btn" href="#/karten/faellig">Karten lernen</a></div>`;
  };
  draw();
}
