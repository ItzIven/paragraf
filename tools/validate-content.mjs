// Prüft Inhaltsdateien auf Format, doppelte IDs und gültige Lernblöcke.
// Aufruf: node tools/validate-content.mjs content/demo/ao.json inhalte/*.json
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const blocks = JSON.parse(await readFile(new URL('../content/blocks.json', import.meta.url), 'utf8')).blocks;
const blockIds = new Set(blocks.map((b) => b.id));
const FAECHER = ['AO', 'ESt', 'USt', 'BdG', 'BilR'];

export function validate(p) {
  const e = [];
  const ids = new Set();
  const id = (x, where) => { if (!x.id) e.push(`${where}: id fehlt`); else if (ids.has(x.id)) e.push(`doppelte id ${x.id}`); else ids.add(x.id); };
  const blk = (x, where) => { if (x.block && !blockIds.has(x.block)) e.push(`${where} ${x.id}: unbekannter Block ${x.block}`); };
  if (!FAECHER.includes(p.fach)) e.push(`fach muss eines von ${FAECHER.join(', ')} sein`);
  if (!p.version) e.push('version fehlt');
  (p.cards || []).forEach((c) => { id(c, 'Karte'); blk(c, 'Karte'); if (!c.front || !c.back) e.push(`Karte ${c.id}: front/back fehlt`); });
  (p.questions || []).forEach((q) => {
    id(q, 'Frage'); blk(q, 'Frage');
    if (!q.frage) e.push(`Frage ${q.id}: frage fehlt`);
    if (q.typ === 'rechnen') { if (typeof q.loesung !== 'number') e.push(`Frage ${q.id}: rechnen braucht loesung (Zahl)`); if (!q.erklaerung) e.push(`Frage ${q.id}: rechnen braucht erklaerung (Rechenweg)`); }
    else if (!Array.isArray(q.optionen) || q.optionen.length < 3) e.push(`Frage ${q.id}: mindestens 3 Optionen`);
    else {
      if (!q.optionen.some((o) => o.richtig)) e.push(`Frage ${q.id}: keine richtige Option`);
      if (q.optionen.filter((o) => !o.richtig).some((o) => !o.warum)) e.push(`Frage ${q.id}: jede falsche Option braucht "warum"`);
    }
  });
  const faelle = {};
  (p.questions || []).forEach((q) => { if (q.fall) (faelle[q.fall] ||= []).push(q); if (q.punkte != null && !(q.punkte > 0)) e.push(`Frage ${q.id}: punkte muss > 0 sein`); });
  Object.entries(faelle).forEach(([f, qs]) => {
    const nrs = qs.map((q) => q.schritt).sort((a, b) => a - b);
    if (nrs.some((n, i) => n !== i + 1)) e.push(`Fall ${f}: schritt muss 1, 2, 3 … lückenlos sein`);
    if (!qs.find((q) => q.schritt === 1)?.fallSachverhalt) e.push(`Fall ${f}: Schritt 1 braucht fallSachverhalt`);
  });
  (p.schemas || []).forEach((s) => { id(s, 'Schema'); blk(s, 'Schema'); if (!s.titel || !s.schritte?.length) e.push(`Schema ${s.id}: titel/schritte fehlt`); });
  return e;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let bad = 0;
  for (const f of process.argv.slice(2)) {
    const errs = validate(JSON.parse(await readFile(f, 'utf8')));
    console.log(errs.length ? `✗ ${f}\n  ${errs.join('\n  ')}` : `✓ ${f}`);
    bad += errs.length;
  }
  process.exit(bad ? 1 : 0);
}
