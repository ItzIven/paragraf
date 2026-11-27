// Zentrale Einstellungen. Nach dem Anlegen des Supabase-Projekts hier eintragen
// (Project Settings → API). Der "anon"-Schlüssel ist für den Browser gedacht und
// darf öffentlich sein; geschützt wird über Login + Row Level Security.
export const CONFIG = {
  appName: 'Paragraf',
  version: '0.3.5',
  supabaseUrl: '',      // z. B. 'https://abcdefgh.supabase.co'
  supabaseAnonKey: '',  // langer Schlüssel "anon public"
  faecher: [
    { id: 'AO',   name: 'Abgabenordnung' },
    { id: 'ESt',  name: 'Einkommensteuer' },
    { id: 'USt',  name: 'Umsatzsteuer' },
    { id: 'BdG',  name: 'Besteuerung der Gesellschaften' },
    { id: 'BilR', name: 'Bilanzsteuerrecht' },
  ],
  // Gebündelte (öffentliche) Inhalte. Echte Inhalte aus Skripten/Klausuren
  // kommen nur über Supabase nach dem Login (siehe docs/INHALTE.md).
  bundledContent: ['content/demo/ao.json'],
};

export const hasSync = () => Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
