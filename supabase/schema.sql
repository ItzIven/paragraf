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

-- Zugangscode: Inhalte ohne eigenes Konto freischalten (einmal je Gerät in der App eingeben).
-- Der Code liegt nur als bcrypt-Hash im nicht freigegebenen Schema "private".
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.zugang (
  id         int primary key default 1 check (id = 1),
  code_hash  text not null,
  updated_at timestamptz not null default now()
);
alter table private.zugang enable row level security; -- keine Richtlinie: nur die Funktion unten liest

create or replace function public.inhalte_mit_code(code text)
returns setof public.content
language plpgsql
security definer
set search_path = ''
as $$
begin
  if code is null or length(code) < 8 or not exists (
    select 1 from private.zugang z where z.code_hash = extensions.crypt(code, z.code_hash)
  ) then
    perform pg_sleep(1); -- bremst Durchprobieren
    raise exception 'Zugangscode ungültig' using errcode = '28000';
  end if;
  return query select * from public.content;
end;
$$;
revoke all on function public.inhalte_mit_code(text) from public;
grant execute on function public.inhalte_mit_code(text) to anon, authenticated;

-- Code festlegen oder ändern (mind. 8 Zeichen; ändern sperrt alle alten Geräte beim nächsten Abgleich aus):
-- insert into private.zugang (id, code_hash) values (1, extensions.crypt('DEIN-CODE', extensions.gen_salt('bf')))
--   on conflict (id) do update set code_hash = excluded.code_hash, updated_at = now();

-- Nach dem Anlegen deines Kontos einmal ausführen (E-Mail anpassen):
-- insert into public.admins (user_id) select id from auth.users where email = 'deine@mail.de';

-- Hinweis: Selbstregistrierung in Authentication → Sign In / Providers → Email
-- abschalten ("Allow new users to sign up" aus). Konten legst du im Dashboard
-- unter Authentication → Users → "Add user" an (2–3 Personen).
