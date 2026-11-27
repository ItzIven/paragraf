# Inhaltsformat

Eine JSON-Datei je Fach (`fach`: `AO`, `ESt`, `USt`, `BdG` oder `BilR`). Vor dem Hochladen prüfen:

```
node tools/validate-content.mjs inhalte/ao.json
```

## Grundgerüst
```json
{
  "fach": "AO",
  "version": "2026-12-01",
  "hinweis": "optional, erscheint in den Einstellungen",
  "cards": [],
  "questions": [],
  "schemas": []
}
```

## Karteikarte
```json
{ "id": "ao-c-101", "block": "AO-12",
  "front": "Frage",
  "back": "Antwort. **fett**, Zeilenumbruch mit \\n, Liste mit \"- \"",
  "norm": "§ 69 S. 1 AO",
  "source": "Abgabenordnung/ILIAS/… S. 12" }
```

## Frage (Training und Klausurmodus)
```json
{ "id": "ao-q-101", "block": "AO-12", "niveau": 3,
  "sachverhalt": "optional",
  "frage": "…",
  "optionen": [
    { "text": "richtige Antwort", "richtig": true },
    { "text": "typischer Fehler", "warum": "Warum falsch (Pflicht bei falschen Optionen)" }
  ],
  "norm": "…",
  "erklaerung": "Lösungsweg" }
```
- `niveau` 1 bis 3 (wird als Punkte angezeigt).
- Mehrere richtige Optionen sind erlaubt; die Frage zählt nur, wenn genau die richtigen gewählt wurden.
- Mindestens drei Optionen. Falsche Optionen sind typische Klausurfehler, keine offensichtlichen Füller.

## Rechenaufgabe
```json
{ "id": "ao-q-017", "block": "AO-11", "typ": "rechnen", "niveau": 3,
  "sachverhalt": "…", "frage": "Wie hoch sind die Säumniszuschläge?",
  "loesung": 196, "einheit": "€", "toleranz": 0,
  "norm": "§ 240 Abs. 1 AO",
  "erklaerung": "Rechenweg Schritt für Schritt (Pflicht)" }
```
- Keine `optionen`. Eingabe mit Komma oder Punkt wird erkannt (`111,50`, `1.234,56`).
- `toleranz` optional (Standard 0), z. B. `0.01` bei Cent-Beträgen.

## Fall (mehrere Prüfungsschritte zu einem Sachverhalt)
Normale Fragen oder Rechenaufgaben mit gemeinsamer `fall`-ID und fortlaufendem `schritt`. Nur Schritt 1 trägt den `fallSachverhalt`; er wird bei allen Schritten eingeblendet. Ein Fall wird immer vollständig und in Reihenfolge abgefragt.
```json
{ "id": "ao-q-025", "block": "AO-04", "fall": "ao-f-01", "schritt": 1, "punkte": 1,
  "fallSachverhalt": "…", "frage": "…", "optionen": [ … ] }
```

## Punkte und Notenpunkte
`punkte` (optional) überschreibt die Punktzahl einer Frage, sonst zählt `niveau` (1–3). Der Klausurmodus rechnet den Anteil an der Höchstpunktzahl mit dem Schlüssel der HS-Aufsichtsarbeiten 2024 in Notenpunkte um (15 ab 96 %, 14 ab 91, 13 ab 87, 12 ab 82, 11 ab 78, 10 ab 73, 9 ab 68, 8 ab 64, 7 ab 59, 6 ab 54, 5 ab 50, 4 ab 40, 3 ab 30, 2 ab 25, 1 ab 20 %). Zeit: eine Minute je Punkt.

## Inhalte ohne Supabase nutzen
In der App unter **Mehr → Inhalte → Inhaltsdatei laden** die JSON-Datei wählen (z. B. `inhalte/ao.json`). Sie ersetzt die Inhalte dieses Fachs auf dem Gerät, bleibt offline erhalten und ist pro Gerät einmal zu laden.

## Schema
```json
{ "id": "ao-s-haftung", "block": "AO-12", "titel": "Haftung nach § 69 AO",
  "einleitung": "optional",
  "schritte": [
    { "titel": "Haftungsschuldner", "norm": "§§ 34, 35 AO", "detail": "…", "falle": "optional: Klausurfalle" }
  ],
  "quelle": "Fundstelle im Vault" }
```

## IDs
`<fach>-<c|q|s>-<nummer>` in Kleinbuchstaben, z. B. `ust-q-014`. IDs nie ändern, sonst geht der Lernstand zu dieser Karte verloren.
