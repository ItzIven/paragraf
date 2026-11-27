// Schlanker Supabase-Zugriff über fetch (Auth + REST), ohne externe Bibliothek.
import { CONFIG } from './config.js';

const base = () => CONFIG.supabaseUrl.replace(/\/$/, '');
const headers = (token) => ({
  apikey: CONFIG.supabaseAnonKey,
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

async function call(path, opts = {}, token) {
  const res = await fetch(base() + path, { ...opts, headers: { ...headers(token), ...(opts.headers || {}) } });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data?.error_description || data?.msg || data?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// Sitzung: { access_token, refresh_token, expires_at, user: { id, email } }
function toSession(d) {
  return { access_token: d.access_token, refresh_token: d.refresh_token,
           expires_at: Date.now() + (d.expires_in - 60) * 1000, user: { id: d.user.id, email: d.user.email } };
}

export async function signIn(email, password) {
  return toSession(await call('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) }));
}

export async function refresh(session) {
  if (session && session.expires_at > Date.now()) return session;
  return toSession(await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: session.refresh_token }) }));
}

export async function pullProgress(session) {
  const rows = await call(`/rest/v1/progress?select=data,updated_at&user_id=eq.${session.user.id}`, {}, session.access_token);
  return rows?.[0] || null;
}

export async function pushProgress(session, data) {
  await call('/rest/v1/progress?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: session.user.id, data, updated_at: new Date().toISOString() }),
  }, session.access_token);
}

export async function uploadContent(session, pack) {
  const { fach, version, ...rest } = pack;
  await call('/rest/v1/content?on_conflict=fach', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ fach, version, data: rest, updated_at: new Date().toISOString() }),
  }, session.access_token);
}

export async function fetchContent(session) {
  return call('/rest/v1/content?select=fach,version,data', {}, session.access_token);
}
