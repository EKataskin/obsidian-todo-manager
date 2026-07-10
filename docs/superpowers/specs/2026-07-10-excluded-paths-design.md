# Design: Ausschlussliste für den Auto-Modus (excluded paths)

Datum: 2026-07-10
Status: entworfen, vom Nutzer freigegeben (Konversation)

## Ziel

In den Plugin-Einstellungen können Ordner und Dateien angegeben werden, in denen
der **Auto-Modus** keine erledigten Aufgaben verschiebt. Die manuellen Befehle
(Befehlspalette, Kontextmenü) funktionieren in ausgeschlossenen Dateien weiterhin —
wer sie bewusst aufruft, will sie auch ausführen.

## Einstellung & Datenmodell

- `DoneMoverSettings` erhält ein neues Feld `excludedPaths: string[]`.
- Default: `[]` (nichts ausgeschlossen).
- UI: eine Textarea „Ausgeschlossene Ordner/Dateien" unterhalb der bestehenden
  Einstellungen. Ein Vault-Pfad pro Zeile, z. B.:
  - `Templates` (Ordner)
  - `Archiv/2025` (Unterordner)
  - `Daily/Scratch.md` (einzelne Datei)
- Beim Speichern: Zeilen trimmen, Leerzeilen verwerfen.

## Matching-Logik

Neues Modul `src/exclusions.ts` mit einer reinen Funktion (keine Obsidian-Imports,
wie `mover.ts`/`taskParser.ts`, damit sie unit-testbar bleibt):

```ts
isPathExcluded(filePath: string, excludedPaths: string[]): boolean
```

Regeln:

1. Normalisierung beider Seiten: Backslashes → Slashes, führende/abschließende
   Slashes entfernen, trimmen.
2. Ein Eintrag greift, wenn:
   - er exakt dem Dateipfad entspricht (Datei-Ausschluss), **oder**
   - der Dateipfad mit `Eintrag + "/"` beginnt (Ordner-Ausschluss inkl. aller
     Unterordner).
3. Vergleich ist case-insensitiv, damit Groß-/Kleinschreibungs-Tippfehler nicht
   zu stillen Überraschungen führen.
4. Teilstring-Fallen vermeiden: `Archiv` darf `Archiv-alt/Note.md` **nicht**
   matchen (deshalb Präfix-Vergleich nur mit angehängtem `/`).

## Integration

- `main.ts`, `scheduleAutoMove()`: im Timeout-Callback den Pfad der aktiven Datei
  ermitteln (`view.file?.path`). Ist er ausgeschlossen → still nichts tun.
- Manuelle Befehle und Kontextmenü bleiben unverändert.

## i18n

Neue EN/DE-Strings in `src/i18n.ts`:

- `settingExcludedName` — z. B. „Excluded folders/files" / „Ausgeschlossene Ordner/Dateien"
- `settingExcludedDesc` — erklärt: ein Pfad pro Zeile, Ordner gelten inkl.
  Unterordner, betrifft nur den Auto-Modus.

## Tests

Unit-Tests in `src/exclusions.test.ts` (Vitest, wie bestehende Tests):

- Ordner-Eintrag matcht Datei im Ordner und in Unterordnern
- Datei-Eintrag matcht exakt diese Datei
- `Archiv` matcht `Archiv-alt/...` nicht
- Case-insensitiver Vergleich
- Leere Liste / Leerzeilen / Slash-Varianten (`/Templates/` vs. `Templates`)

## Doku

- README.md und README.de.md: neue Einstellung im Settings-Abschnitt ergänzen.

## Nicht im Umfang

- Glob-/Regex-Muster
- Pfad-Autovervollständigung (Suggester) in den Einstellungen
- Ausschluss der manuellen Befehle
