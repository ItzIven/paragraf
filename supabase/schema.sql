-- Paragraf: Datenbank für Lernstand-Sync und geschützte Inhalte
-- Im Supabase-Dashboard unter "SQL Editor" einmal komplett ausführen.

-- Lernstand: eine Zeile je Benutzerkonto (gesamter Stand als JSON)
create table if not exists public.progress (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;

create policy "Eigenen Lernstand lesen" on public.progress
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Eigenen Lernstand anlegen" on public.progress
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Eigenen Lernstand ändern" on public.progress
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Lerninhalte je Fach (Karten, Fragen, Schemata). Nur angemeldete Nutzer lesen;
-- geschrieben wird ausschließlich mit dem service_role-Schlüssel (tools/upload-content.mjs).
create table if not exists public.content (
  fach       text primary key,
  version    text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.content enable row level security;

create policy "Inhalte für angemeldete Nutzer" on public.content
  for select to authenticated using (true);

-- Hinweis: Selbstregistrierung in Authentication → Sign In / Providers → Email
-- abschalten ("Allow new users to sign up" aus). Konten legst du im Dashboard
-- unter Authentication → Users → "Add user" an (2–3 Personen).
