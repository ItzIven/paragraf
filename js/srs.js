// Wiederholungsplanung nach dem SM-2-Prinzip, vereinfacht auf vier Bewertungen.
// 1 = Nochmal, 2 = Schwer, 3 = Gut, 4 = Leicht
import { progress, commit, today } from './store.js';

const DAY = 86400000;

export function schedule(cardId, grade) {
  const now = Date.now();
  const c = progress.cards[cardId] || { ivl: 0, ease: 2.5, reps: 0, lapses: 0, first: now };
  if (grade === 1) {
    c.reps = 0; c.lapses += 1; c.ivl = 0; c.ease = Math.max(1.3, c.ease - 0.2);
    c.due = now + 10 * 60 * 1000;           // in 10 Minuten erneut
  } else {
    c.ivl = nextIvl(c, grade);
    c.ease = Math.max(1.3, c.ease + (grade === 2 ? -0.15 : grade === 4 ? 0.15 : 0));
    c.reps += 1;
    c.due = startOfDay(now) + c.ivl * DAY;
  }
  c.t = now;
  progress.cards[cardId] = c;
  const d = today();
  progress.days[d] = (progress.days[d] || 0) + 1;
  commit();
  return c;
}

// Abstand in Tagen für Bewertung 2–4
function nextIvl(c, grade) {
  if (c.reps === 0) return { 2: 1, 3: 2, 4: 4 }[grade];
  if (c.reps === 1) return { 2: 3, 3: 5, 4: 8 }[grade];
  return Math.max(c.ivl + 1, Math.round(c.ivl * (grade === 2 ? 1.2 : grade === 3 ? c.ease : c.ease * 1.3)));
}

const startOfDay = (ms) => { const d = new Date(ms); d.setHours(4, 0, 0, 0); return d.getTime(); };

export const isNew = (id) => !progress.cards[id];
export const isDue = (id) => { const c = progress.cards[id]; return c && c.due <= Date.now(); };

// Liefert die heutige Lernreihe: fällige Karten zuerst, dann neue bis zum Tageslimit
export function buildQueue(cards, { newLimit = progress.settings.newPerDay, onlyDue = false } = {}) {
  const due = cards.filter((c) => isDue(c.id)).sort((a, b) => progress.cards[a.id].due - progress.cards[b.id].due);
  const fresh = onlyDue ? [] : cards.filter((c) => isNew(c.id)).slice(0, Math.max(0, newLimit - newToday()));
  return [...due, ...fresh];
}

export function newToday() {
  const s = startOfDay(Date.now());
  return Object.values(progress.cards).filter((c) => (c.first || 0) >= s).length;
}

export const label = (grade, cardId) => {
  const c = progress.cards[cardId] || { ivl: 0, ease: 2.5, reps: 0 };
  if (grade === 1) return '10 Min';
  const ivl = nextIvl(c, grade);
  return ivl < 31 ? `${ivl} T` : `${Math.round(ivl / 30)} Mon`;
};
