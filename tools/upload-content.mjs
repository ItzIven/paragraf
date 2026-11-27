// Lädt Inhaltsdateien in die Supabase-Tabelle "content".
// Aufruf (Node 18+):
//   SUPABASE_URL=https://xyz.supabase.co SUPABASE_SERVICE_KEY=... node tools/upload-content.mjs inhalte/ao.json [weitere.json]
// Der service_role-Schlüssel darf NIE ins Repository oder in den Browser.
import { readFile } from 'node:fs/promises';
import { validate } from './validate-content.mjs';

const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) { console.error('SUPABASE_URL und SUPABASE_SERVICE_KEY setzen.'); process.exit(1); }

for (const file of process.argv.slice(2)) {
  const pack = JSON.parse(await readFile(file, 'utf8'));
  const errors = validate(pack);
  if (errors.length) { console.error(`${file}:\n  ${errors.join('\n  ')}`); process.exit(1); }
  const { fach, version, ...rest } = pack;
  const res = await fetch(`${url}/rest/v1/content?on_conflict=fach`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ fach, version, data: rest, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) { console.error(`${file}: HTTP ${res.status} ${await res.text()}`); process.exit(1); }
  console.log(`${file}: ${fach} Version ${version} hochgeladen (${rest.cards?.length || 0} Karten, ${rest.questions?.length || 0} Fragen, ${rest.schemas?.length || 0} Schemata)`);
}
