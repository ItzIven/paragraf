# Paragraf

Lern-App für die Laufbahnprüfung Diplom-Finanzwirt: Karteikarten mit Wiederholungsplanung, Prüfungsschemata und Prüfungsfragen im Trainings- und Klausurmodus. Läuft als Web-App auf iPhone, iPad und Laptop, auch offline.

## Lokal ausprobieren
```
python -m http.server 8000
```
Dann `http://localhost:8000` öffnen. Ohne Supabase läuft alles lokal im Browser.

## 1. Veröffentlichen mit GitHub Pages
1. Neues Repository anlegen, z. B. `paragraf` (öffentlich; Pages für private Repos braucht ein bezahltes Konto).
2. Alle Dateien dieses Ordners hochladen bzw. pushen.
3. Repository → Settings → Pages → Source: „Deploy from a branch“, Branch `main`, Ordner `/ (root)`.
4. Nach etwa einer Minute ist die App unter `https://<benutzername>.github.io/paragraf/` erreichbar.

Im Repository stehen nur der eigene Lernplan und Demo-Inhalte. Inhalte aus Skripten und Klausuren kommen über Supabase und sind nur nach Anmeldung lesbar.

## 2. Sync und geschützte Inhalte mit Supabase
1. Auf supabase.com kostenloses Projekt anlegen (Region Frankfurt).
2. SQL Editor → Inhalt von `supabase/schema.sql` einfügen → Run.
3. Authentication → Sign In / Providers → Email: „Allow new users to sign up“ ausschalten.
4. Authentication → Users → „Add user“: je Person ein Konto (E-Mail + Passwort, „Auto Confirm User“ an).
5. Project Settings → API: „Project URL“ und „anon public“-Schlüssel in `js/config.js` eintragen, committen.
6. In der App: Mehr → „Mit Sync-Konto verbinden“. Auf dem iPad dasselbe Konto verwenden.

Inhalte hochladen (der service_role-Schlüssel bleibt auf dem Laptop, nie ins Repo):
```
node tools/validate-content.mjs inhalte/ao.json
SUPABASE_URL=https://xyz.supabase.co SUPABASE_SERVICE_KEY=… node tools/upload-content.mjs inhalte/ao.json
```
Unter Windows (PowerShell): `$env:SUPABASE_URL="…"; $env:SUPABASE_SERVICE_KEY="…"; node tools/upload-content.mjs inhalte/ao.json`

Lege dafür einen Ordner `inhalte/` an; er steht in `.gitignore` und wird nicht veröffentlicht.

## 3. Auf iPhone und iPad installieren
Safari → App-Adresse öffnen → Teilen → „Zum Home-Bildschirm“. Die App startet dann im Vollbild und funktioniert offline.

## Updates
Nach Änderungen an der App die Konstante `VERSION` in `sw.js` erhöhen und pushen. Die Geräte laden das Update beim nächsten Öffnen.
