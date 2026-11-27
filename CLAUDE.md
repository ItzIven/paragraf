# Paragraf: Lern-App Diplom-Finanzwirt (Projektleitfaden für Claude Code)

Ziel: Vorbereitung auf das Hauptstudium und die Laufbahnprüfung in AO, ESt, USt, BdG und Bilanzsteuerrecht. Persönliche Angaben und lokale Pfade stehen in `CLAUDE.local.md` (nicht im Repository).

## Festgelegte Anforderungen
- Web-App (PWA), auf **iPhone und iPad** gleich gut bedienbar und offline nutzbar. Läuft auf GitHub Pages.
- **Dark Mode als Standard**, Hell wählbar. Einstellungen: Schriftgröße, Tagesziel, neue Karten pro Tag, Fächerauswahl.
- **Profile**: 2–3 Personen pro Gerät, je Profil eine 4-stellige PIN.
- **Sync** des Lernstands zwischen Geräten über Supabase (ein Konto je Person). Ohne Sync läuft alles lokal.
- **Drei Lernbereiche**:
  1. Karteikarten mit Wiederholungsplanung (SM-2, vier Bewertungen)
  2. Prüfungsschemata (Lesen oder Schritt für Schritt aus dem Kopf)
  3. Prüfen im **Training** (sofortige Lösung) oder **Klausurmodus** (1 Minute je Punkt, Notenpunkte nach Schlüssel HS 2024, Ergebnis je Lernblock); Fälle mit mehreren Schritten
- **Anspruchsvolle Fragen**: falsche Antwortoptionen sind typische Klausurfehler (falsche Norm, knapp falsche Frist, übersehene Ausnahme). Jede falsche Option erklärt mit `warum`, warum sie falsch ist.
- **Inhalte geschützt**: Inhalte aus Hochschulunterlagen nie ins Repository. Sie liegen in der Supabase-Tabelle `content` und sind nur nach Login lesbar. Im Repo stehen nur `content/blocks.json` (eigener Lernplan) und selbst geschriebene Demo-Inhalte.

## Aufbau (bewusst ohne Build-Schritt und ohne Abhängigkeiten)
```
index.html            App-Hülle, Navigation (Handy: Leiste unten, ab 760 px: Schiene links)
css/app.css           gesamtes Design (Tokens oben in :root / [data-theme])
js/config.js          Supabase-URL + anon key, Fächerliste, gebündelte Inhalte
js/app.js             Start, Hash-Router (#/heute, #/bloecke, #/karten, #/schemata, #/pruefen, #/einstellungen)
js/store.js           Geräte- und Profildaten, Lernstand, Merge + Sync (jüngerer Zeitstempel gewinnt)
js/srs.js             Wiederholungsplanung
js/content.js         lädt blocks.json, Demo-Inhalte und Online-Inhalte (Cache für offline)
js/supabase.js        Auth + REST über fetch
js/views/*.js         je Bildschirm ein Modul mit render(view, params)
content/blocks.json   75 Lernblöcke aus dem Prüfungslehrplan (AO-01 … B-14), Stufe 1–3
content/demo/*.json   öffentliche Demo-Inhalte
supabase/schema.sql   Tabellen progress + content mit RLS
tools/validate-content.mjs  Prüft Inhaltsdateien (vor jedem Upload ausführen)
tools/upload-content.mjs    Lädt Inhalte mit service_role-Schlüssel nach Supabase
docs/INHALTE.md       Format für Karten, Fragen, Schemata
```

## Arbeitsregeln (Tokens sparen)
- Eine Aufgabe pro Sitzung; danach `/clear`. Diese Datei enthält alles Nötige.
- Für neue Inhalte nur die jeweilige Inhaltsdatei anfassen, nicht den App-Code lesen.
- Große PDFs aus dem Obsidian-Vault nie ganz lesen: die Textfassungen unter `_Text/…` gezielt nach Thema/Seite durchsuchen.
- Nach jeder Änderung an Dateien der App-Hülle `VERSION` in `sw.js` erhöhen, sonst bekommen die Geräte das Update nicht.

## Qualitätsregeln für Inhalte (fachlich)
- Jede Karte/Frage hat eine **vollständige Normangabe** (Paragraf, Absatz, Satz, Nummer) und einen Lernblock.
- Rechtsstand prüfen (Fristen, Beträge, Grenzen). Bei Änderungen seit den Skripten den aktuellen Stand verwenden und kenntlich machen.
- Gesetz, Verwaltungsauffassung (AEAO, R/H, BMF) und Rechtsprechung trennen; Urteile nur mit gesichertem Aktenzeichen.
- Fundstelle im Vault angeben (`source` bei Karten, `quelle` bei Schemata), damit man nachlesen kann.
- Unsicherheiten nicht in Inhalte aufnehmen, sondern den Nutzer fragen.

## Quellen
Obsidian-Vault „Studium“ (Pfad in `CLAUDE.local.md`):
- `_Übersichten/ILIAS-Material.md`, `_Übersichten/Lernblöcke Prüfungslehrplan.md`, Fachübersichten
- `<Fach>/ILIAS/…` Skripte, Schemata, Klausuren mit Lösungen; `_Text/…` durchsuchbare Fassungen

## Nächste Schritte
1. ~~Supabase-Projekt anlegen, `schema.sql` ausführen, `js/config.js` füllen~~ erledigt 27.11.2026: Projekt `paragraf` (Frankfurt, Free), Registrierung aus. Inhalte lädt ein Admin-Konto (Tabelle `admins`) in den Einstellungen hoch; kein service_role-Schlüssel nötig.
2. ~~GitHub-Repository anlegen, Pages aktivieren~~ erledigt: github.com/ItzIven/paragraf, https://itziven.github.io/paragraf/ (Branch `main`, `/`).
3. Inhalte Fach für Fach erstellen (Start: AO Stufe 1 und Hauptstudiums-Blöcke AO-11 bis AO-15), validieren, hochladen.
4. Ausbau: Falltrainer (mehrstufige Fälle), Fristenrechner-Training, Lernplan mit Prüfungsterminen.

## Stand (27.11.2026, v0.2.0)
- Fragetyp `rechnen` (Zahleneingabe) und Import von Inhaltsdateien in den Einstellungen ergänzt.
- `inhalte/ao.json`: 52 Karten, 24 Fragen (davon 3 Rechenaufgaben), 8 Schemata; Grundlage HS-Klausur AO 2024 (Analyse im Vault: `_Übersichten/Klausuranalyse HS 2024.md`).
- Fortschritt: `docs/FORTSCHRITT.md` bei jeder Etappe aktualisieren.

## Stand (27.11.2026, v0.3.0)
- Fragetyp Fall (`fall`, `schritt`, `fallSachverhalt`), `punkte`, Notenpunkte nach Schlüssel HS 2024 (docs/INHALTE.md).
- `inhalte/ust.json`: 36 Karten, 14 Fragen, 5 Schemata.
- Rechtsstand prüfen: Die amtlichen Handbücher liegen NICHT im Vault (nur Skripte/Übungen). Normen gegen gesetze-im-internet.de prüfen, Skripte über `_Text/` im Vault. Keine Corona-Sonderregeln aufnehmen (Entscheidung 27.11.2026).
- Geänderte Rechtslage beachten: § 19 UStG ab 2025 (25.000/100.000 €, steuerfrei, Gründungsjahr 25.000 €), § 44 Abs. 3 UStDV 6.000 €, § 152 Abs. 5 S. 2 AO (25 € bei Jahreserklärungen), § 122 Abs. 2 Nr. 1 AO Vier-Tages-Fiktion ab 2025.

- `inhalte/est.json`: 28 Karten, 13 Fragen, 4 Schemata (VZ 2026: Grundfreibetrag 12.348 €, Entfernungspauschale 0,38 € ab km 1, § 33a 12.348 €, Besteuerungsanteil 2026 84 %, § 23 Freigrenze < 1.000 €, § 9 Nr. 1 S. 1 GewStG ab EZ 2025: Kürzung um die als Betriebsausgabe erfasste Grundsteuer (NICHT 0,11 % des Grundsteuerwerts – Entwurfsfassung)).
- Deployment: Repo-Klon unter /home/claude/paragraf; Inhalte (`inhalte/`) nie committen.
- `inhalte/bilr.json` (26/12/4) und `inhalte/bdg.json` (22/12/4): geprüft degressive AfA 30 % (max. 3-fach) für Anschaffungen 07/2025–12/2027, § 7g IAB 50 %/Sonder-AfA 40 %/Gewinngrenze 200.000 €, GWG 800 €/Sammelposten 250–1.000 €, KSt 15 % bis 2027.
