// Lernstatistik je Lernblock aus den gespeicherten Runden (progress.exams[].perBlock)
import { progress } from './store.js';
import { esc, pct } from './ui.js';

const DAY = 864e5;
export const tone = (p) => (p >= 75 ? 'ok' : p >= 50 ? 'mid' : 'bad');

// Verlauf eines Blocks: je Runde { t, r, n, mode }
export function blockSeries(id, limit = 12) {
  return progress.exams.filter((e) => e.perBlock?.[id]).slice(-limit)
    .map((e) => ({ t: e.t, r: e.perBlock[id][0], n: e.perBlock[id][1], mode: e.mode }));
}

// Alle Blöcke im Zeitraum, schwächste zuerst. trend: letzte Runde gegenüber dem Schnitt davor (Prozentpunkte)
export function blockTable(days = 30, min = 3) {
  const since = Date.now() - days * DAY, acc = {};
  for (const e of progress.exams) {
    if (e.t < since || !e.perBlock) continue;
    for (const [b, [r, n]] of Object.entries(e.perBlock)) (acc[b] ||= []).push([r, n]);
  }
  return Object.entries(acc).map(([id, rows]) => {
    const r = rows.reduce((s, x) => s + x[0], 0), n = rows.reduce((s, x) => s + x[1], 0);
    let trend = null;
    if (rows.length > 1) {
      const [lr, ln] = rows.at(-1), prev = rows.slice(0, -1);
      trend = pct(lr, ln) - pct(prev.reduce((s, x) => s + x[0], 0), prev.reduce((s, x) => s + x[1], 0));
    }
    return { id, r, n, p: pct(r, n), rounds: rows.length, trend };
  }).filter((x) => x.n >= min).sort((a, b) => a.p - b.p || b.n - a.n);
}

// Säulen je Runde, Höhe = Trefferquote
export function chart(series) {
  if (!series.length) return '';
  const w = 22, gap = 8, h = 64, W = series.length * (w + gap) - gap;
  const bars = series.map((s, i) => {
    const p = pct(s.r, s.n), bh = Math.max(3, Math.round((p / 100) * h));
    const d = new Date(s.t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    return `<rect x="${i * (w + gap)}" y="${h - bh}" width="${w}" height="${bh}" rx="3" class="sbar sbar--${tone(p)}"><title>${d}: ${s.r}/${s.n} (${p} %)${s.mode === 'klausur' ? ', Klausur' : ''}</title></rect>`;
  }).join('');
  return `<svg class="spark" viewBox="0 0 ${W} ${h}" width="${W}" height="${h}" role="img" aria-label="Trefferquote je Runde">${bars}<line x1="0" x2="${W}" y1="${h / 2}" y2="${h / 2}" class="spark-mid"/></svg>`;
}

export const trendText = (t) => (t == null ? '' : t > 0 ? `▲ ${t}` : t < 0 ? `▼ ${-t}` : '±0');
export const pill = (p) => `<span class="pill pill--${tone(p)}">${esc(String(p))} %</span>`;
