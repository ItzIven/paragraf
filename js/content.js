// Inhalte: Lernblöcke (Prüfungslehrplan) + Karten, Fragen, Schemata je Fach.
// Quelle 1: gebündelte Demo-Dateien. Quelle 2 (vorrangig): Tabelle "content"
// in Supabase, nur nach Login lesbar; wird lokal zwischengespeichert (offline).
import { CONFIG, hasSync } from './config.js';
import { activeProfile } from './store.js';
import * as sb from './supabase.js';

export const db = { blocks: [], cards: [], questions: [], schemas: [], packs: {} };
const CACHE = 'paragraf.content';
const LOCAL = 'paragraf.content.local'; // per Datei importierte Inhalte (ohne Supabase)

function ingest(pack, origin) {
  const f = pack.fach;
  db.packs[f] = { version: pack.version, origin, demo: !!pack.demo, hinweis: pack.hinweis || '' };
  const tag = (x) => ({ ...x, fach: f });
  db.cards = db.cards.filter((x) => x.fach !== f).concat((pack.cards || []).map(tag));
  db.questions = db.questions.filter((x) => x.fach !== f).concat((pack.questions || []).map(tag));
  db.schemas = db.schemas.filter((x) => x.fach !== f).concat((pack.schemas || []).map(tag));
}

export async function loadContent() {
  const blocks = await fetch('content/blocks.json').then((r) => r.json());
  db.blocks = blocks.blocks;
  for (const url of CONFIG.bundledContent) {
    try { ingest(await fetch(url).then((r) => r.json()), 'demo'); } catch { /* offline ohne Cache */ }
  }
  // zuletzt geladene Online-Inhalte (gelten auch offline)
  try { for (const pack of JSON.parse(localStorage.getItem(CACHE) || '[]')) ingest(pack, 'online'); } catch {}
  try { for (const pack of JSON.parse(localStorage.getItem(LOCAL) || '[]')) ingest(pack, 'datei'); } catch {}
}

// Inhaltsdatei (z. B. inhalte/ao.json) direkt auf dem Gerät übernehmen
export function importContent(text) {
  const pack = JSON.parse(text);
  if (!pack.fach || !Array.isArray(pack.cards || []) || !pack.version) throw new Error('Keine gültige Inhaltsdatei');
  const all = JSON.parse(localStorage.getItem(LOCAL) || '[]').filter((x) => x.fach !== pack.fach);
  localStorage.setItem(LOCAL, JSON.stringify([...all, pack]));
  ingest(pack, 'datei');
  return pack;
}

export const localPacks = () => { try { return JSON.parse(localStorage.getItem(LOCAL) || '[]'); } catch { return []; } };

// Per Datei geladene Inhalte nach Supabase übertragen (nur Admin-Konten, siehe schema.sql)
export async function uploadLocal() {
  const p = activeProfile();
  if (!hasSync() || !p?.session) throw new Error('Nicht mit Sync verbunden');
  p.session = await sb.refresh(p.session);
  const done = [];
  for (const pack of localPacks()) { await sb.uploadContent(p.session, pack); done.push(pack.fach); }
  await refreshRemote();
  return done;
}

export async function refreshRemote() {
  const p = activeProfile();
  if (!hasSync() || !p?.session || !navigator.onLine) return false;
  try {
    const rows = await sb.fetchContent(p.session);
    const packs = rows.map((r) => ({ ...r.data, fach: r.fach, version: r.version }));
    localStorage.setItem(CACHE, JSON.stringify(packs));
    packs.forEach((pk) => ingest(pk, 'online'));
    return true;
  } catch { return false; }
}

export const fachName = (id) => CONFIG.faecher.find((f) => f.id === id)?.name || id;
export const blockById = (id) => db.blocks.find((b) => b.id === id);
export const cardsFor = ({ fach, block } = {}) => db.cards.filter((c) => (!fach || c.fach === fach) && (!block || c.block === block));
export const questionsFor = ({ faecher, block } = {}) => db.questions.filter((q) => (!faecher || faecher.includes(q.fach)) && (!block || q.block === block));
