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

-- Hochladen von Inhalten direkt aus der App (Einstellungen → „Auf Supabase hochladen“):
-- nur für Konten, die in public.admins eingetragen sind.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;
create policy "Eigenen Admin-Eintrag sehen" on public.admins
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Inhalte anlegen (Admin)" on public.content
  for insert to authenticated
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));
create policy "Inhalte ändern (Admin)" on public.content
  for update to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

-- Zugriff über die Data API freigeben (neue Projekte geben Tabellen nicht mehr automatisch frei;
-- welche Zeilen erlaubt sind, regeln die RLS-Richtlinien oben)
grant select, insert, update on public.progress to authenticated;
grant select, insert, update on public.content  to authenticated;
grant select on public.admins to authenticated;

-- Nach dem Anlegen deines Kontos einmal ausführen (E-Mail anpassen):
-- insert into public.admins (user_id) select id from auth.users where email = 'deine@mail.de';

-- Hinweis: Selbstregistrierung in Authentication → Sign In / Providers → Email
-- abschalten ("Allow new users to sign up" aus). Konten legst du im Dashboard
-- unter Authentication → Users → "Add user" an (2–3 Personen).
