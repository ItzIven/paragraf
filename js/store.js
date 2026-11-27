// Gerätedaten (Profile, Darstellung) und Lernstand je Profil.
// Lernstand liegt lokal (offline nutzbar) und wird bei verbundenem Sync-Konto
// mit Supabase abgeglichen: je Eintrag gewinnt der jüngere Zeitstempel.
import { hasSync } from './config.js';
import * as sb from './supabase.js';

const DEV_KEY = 'paragraf.device';
const pKey = (id) => `paragraf.p.${id}`;
const listeners = new Set();

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

export const device = read(DEV_KEY, { theme: 'dark', fontScale: 1, profiles: [], active: null });
export function saveDevice() { write(DEV_KEY, device); }

export function emptyProgress() {
  return {
    cards: {},          // cardId -> { due, ivl, ease, reps, lapses, t }
    blocks: {},         // blockId -> { status: 0..3, t }
    answers: {},        // questionId -> { ok: [bool…letzte 5], t }
    days: {},           // 'YYYY-MM-DD' -> Anzahl Wiederholungen
    exams: [],          // { t, mode, faecher, n, right, perBlock }
    settings: { dailyGoal: 30, newPerDay: 15, faecher: ['AO', 'ESt', 'USt', 'BdG', 'BilR'] },
    t: 0,
  };
}

export let progress = emptyProgress();
export const activeProfile = () => device.profiles.find((p) => p.id === device.active) || null;

export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach((fn) => fn()); }

export function loadProfile(id) {
  device.active = id; saveDevice();
  progress = Object.assign(emptyProgress(), read(pKey(id), {}));
  progress.settings = Object.assign(emptyProgress().settings, progress.settings);
  emit();
  sync();
}

export function logout() { device.active = null; saveDevice(); progress = emptyProgress(); }

let pushTimer;
export function commit() {
  progress.t = Date.now();
  const p = activeProfile();
  if (!p) return;
  write(pKey(p.id), progress);
  emit();
  clearTimeout(pushTimer);
  pushTimer = setTimeout(sync, 2500);
}

export const today = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

// ---------- Profile ----------
async function hashPin(pin, salt) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pin}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const COLORS = ['#82bccd', '#c9a3e0', '#e2b450', '#7cc597'];
export async function createProfile(name, pin) {
  const id = Math.random().toString(36).slice(2, 10);
  const salt = Math.random().toString(36).slice(2);
  device.profiles.push({ id, name, salt, pinHash: await hashPin(pin, salt), color: COLORS[device.profiles.length % COLORS.length], session: null });
  saveDevice();
  return id;
}
export async function checkPin(profile, pin) { return (await hashPin(pin, profile.salt)) === profile.pinHash; }
export function removeProfile(id) {
  device.profiles = device.profiles.filter((p) => p.id !== id);
  localStorage.removeItem(pKey(id));
  if (device.active === id) device.active = null;
  saveDevice();
}

// ---------- Sync ----------
export const syncState = { status: 'aus', last: null, error: null };

export async function connectSync(email, password) {
  const p = activeProfile();
  p.session = await sb.signIn(email, password);
  saveDevice();
  await sync();
}
export function disconnectSync() { const p = activeProfile(); if (p) { p.session = null; saveDevice(); syncState.status = 'aus'; emit(); } }

function mergeMap(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) if (!out[k] || (v?.t || 0) > (out[k]?.t || 0)) out[k] = v;
  return out;
}
function merge(local, remote) {
  const m = emptyProgress();
  m.cards = mergeMap(local.cards, remote.cards);
  m.blocks = mergeMap(local.blocks, remote.blocks);
  m.answers = mergeMap(local.answers, remote.answers);
  m.days = { ...remote.days };
  for (const [d, n] of Object.entries(local.days || {})) m.days[d] = Math.max(n, m.days[d] || 0);
  const seen = new Set();
  m.exams = [...(remote.exams || []), ...(local.exams || [])].filter((e) => !seen.has(e.t) && seen.add(e.t)).sort((x, y) => x.t - y.t).slice(-100);
  m.settings = (remote.t || 0) > (local.t || 0) ? remote.settings : local.settings;
  m.t = Math.max(local.t || 0, remote.t || 0);
  return m;
}

let syncing = false;
export async function sync() {
  const p = activeProfile();
  if (!p || !p.session || !hasSync() || syncing || !navigator.onLine) return;
  syncing = true; syncState.status = 'läuft'; emit();
  try {
    p.session = await sb.refresh(p.session); saveDevice();
    const row = await sb.pullProgress(p.session);
    if (row?.data) progress = merge(progress, row.data);
    write(pKey(p.id), progress);
    await sb.pushProgress(p.session, progress);
    syncState.status = 'ok'; syncState.last = Date.now(); syncState.error = null;
  } catch (e) {
    syncState.status = 'fehler'; syncState.error = e.message;
  } finally { syncing = false; emit(); }
}
window.addEventListener('online', () => sync());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync(); });

// ---------- Sicherung ----------
export function exportData() {
  return JSON.stringify({ app: 'paragraf', profile: activeProfile()?.name, progress }, null, 1);
}
export function importData(json) {
  const d = JSON.parse(json);
  if (d.app !== 'paragraf' || !d.progress) throw new Error('Keine Paragraf-Sicherung');
  progress = merge(progress, d.progress); commit();
}
