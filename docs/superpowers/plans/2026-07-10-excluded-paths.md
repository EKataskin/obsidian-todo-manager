# Excluded Paths for Auto Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a settings-configurable list of vault paths (folders/files) in which the plugin's auto mode does not move completed tasks; manual commands stay unaffected.

**Architecture:** A new pure module `src/exclusions.ts` (no Obsidian imports, unit-tested with Vitest) implements the path matching. The settings model gains an `excludedPaths: string[]` field edited via a textarea (one path per line) in the existing settings tab. `main.ts` consults the matcher inside the auto-move debounce callback and silently skips excluded files.

**Tech Stack:** TypeScript (strict, tabs for indentation), Obsidian Plugin API, Vitest for unit tests, esbuild for bundling.

**Spec:** `docs/superpowers/specs/2026-07-10-excluded-paths-design.md`

## Global Constraints

- Indentation: tabs (match existing files).
- Code comments in English, matching existing comment style/density.
- Pure logic modules (`src/exclusions.ts`) must not import from `obsidian`.
- Every user-visible string exists in English AND German in `src/i18n.ts`.
- Matching is case-insensitive; folder entries match the whole subtree; `Archiv` must NOT match `Archiv-alt/...`.
- Only auto mode is affected — do not touch the manual commands or the editor context menu.
- Run tests with `npm test` (vitest run); typecheck+build with `npm run build`.

---

### Task 1: Pure path-exclusion matcher

**Files:**
- Create: `src/exclusions.ts`
- Test: `src/exclusions.test.ts`

**Interfaces:**
- Consumes: nothing (pure, standalone module).
- Produces: `isPathExcluded(filePath: string, excludedPaths: string[]): boolean` — used by Task 3 in `main.ts`.

- [ ] **Step 1: Write the failing test**

Create `src/exclusions.test.ts` with exactly:

```ts
import { describe, expect, it } from "vitest";
import { isPathExcluded } from "./exclusions";

describe("isPathExcluded", () => {
	it("returns false for an empty exclusion list", () => {
		expect(isPathExcluded("Daily/Note.md", [])).toBe(false);
	});

	it("matches a file directly inside an excluded folder", () => {
		expect(isPathExcluded("Templates/Note.md", ["Templates"])).toBe(true);
	});

	it("matches files in subfolders of an excluded folder", () => {
		expect(isPathExcluded("Archiv/2025/Q1/Note.md", ["Archiv/2025"])).toBe(true);
	});

	it("matches an exact file entry", () => {
		expect(isPathExcluded("Daily/Scratch.md", ["Daily/Scratch.md"])).toBe(true);
	});

	it("does not match siblings of an excluded file", () => {
		expect(isPathExcluded("Daily/Other.md", ["Daily/Scratch.md"])).toBe(false);
	});

	it("does not treat folder entries as plain substring prefixes", () => {
		expect(isPathExcluded("Archiv-alt/Note.md", ["Archiv"])).toBe(false);
	});

	it("compares case-insensitively in both directions", () => {
		expect(isPathExcluded("templates/note.md", ["Templates"])).toBe(true);
		expect(isPathExcluded("Templates/Note.md", ["templates"])).toBe(true);
	});

	it("ignores empty and whitespace-only entries", () => {
		expect(isPathExcluded("Daily/Note.md", ["", "   "])).toBe(false);
	});

	it("returns false for an empty file path", () => {
		expect(isPathExcluded("", ["Templates"])).toBe(false);
	});

	it("normalizes slash variants of entries", () => {
		expect(isPathExcluded("Templates/Note.md", ["/Templates/"])).toBe(true);
		expect(isPathExcluded("Templates/Note.md", ["Templates\\"])).toBe(true);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/exclusions.test.ts`
Expected: FAIL — cannot resolve import `./exclusions` (module does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/exclusions.ts` with exactly:

```ts
// Pure path-exclusion matching. No Obsidian imports here so this stays unit-testable.

/**
 * Normalizes a vault path for comparison: backslashes become slashes,
 * surrounding whitespace and leading/trailing slashes are removed, and the
 * result is lower-cased because matching is case-insensitive.
 */
function normalizePath(path: string): string {
	return path
		.trim()
		.replace(/\\/g, "/")
		.replace(/^\/+|\/+$/g, "")
		.toLowerCase();
}

/**
 * Returns true when filePath matches one of the excluded entries.
 * An entry matches if it equals the file path (file exclusion) or if the
 * file path lies underneath it (folder exclusion including subfolders).
 */
export function isPathExcluded(filePath: string, excludedPaths: string[]): boolean {
	const file = normalizePath(filePath);
	if (file.length === 0) return false;
	return excludedPaths.some((entry) => {
		const excluded = normalizePath(entry);
		if (excluded.length === 0) return false;
		return file === excluded || file.startsWith(excluded + "/");
	});
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/exclusions.test.ts`
Expected: PASS — 10 tests passing.

Then run the whole suite to check nothing else broke: `npm test`
Expected: PASS — all test files green.

- [ ] **Step 5: Commit**

```bash
git add src/exclusions.ts src/exclusions.test.ts
git commit -m "feat: add pure path-exclusion matcher"
```

---

### Task 2: Settings field, i18n strings, and settings UI

**Files:**
- Modify: `src/types.ts` (interface `DoneMoverSettings` + `DEFAULT_SETTINGS`)
- Modify: `src/i18n.ts` (interface `Strings`, `en`, `de`)
- Modify: `src/settings.ts` (append a textarea setting in `display()`)

**Interfaces:**
- Consumes: nothing from Task 1 (independent).
- Produces: `DoneMoverSettings.excludedPaths: string[]` (default `[]`) — used by Task 3; i18n keys `settingExcludedName`, `settingExcludedDesc`.

- [ ] **Step 1: Add the settings field**

In `src/types.ts`, extend the interface and defaults:

```ts
export interface DoneMoverSettings {
	/** When on, fully completed tasks are moved automatically shortly after being checked. */
	autoMode: boolean;
	/** Name of the target heading the tasks are moved under (e.g. "Done"). */
	doneHeading: string;
	/** When on, a "✅ YYYY-MM-DD" completion date is appended to moved checked lines. */
	appendCompletionDate: boolean;
	/** Vault paths (folders or files) in which auto mode stays inactive. */
	excludedPaths: string[];
}

export const DEFAULT_SETTINGS: DoneMoverSettings = {
	autoMode: false,
	doneHeading: "Done",
	appendCompletionDate: true,
	excludedPaths: [],
};
```

- [ ] **Step 2: Add the i18n strings**

In `src/i18n.ts`, add to the `Strings` interface (after `settingDateDesc: string;`):

```ts
	settingExcludedName: string;
	settingExcludedDesc: string;
```

Add to the `en` object (after the `settingDateDesc` entry):

```ts
	settingExcludedName: "Excluded folders/files",
	settingExcludedDesc:
		"One vault path per line. Auto mode stays inactive in these folders " +
		"(including subfolders) and files. Manual commands still work.",
```

Add to the `de` object (after the `settingDateDesc` entry):

```ts
	settingExcludedName: "Ausgeschlossene Ordner/Dateien",
	settingExcludedDesc:
		"Ein Vault-Pfad pro Zeile. Der Auto-Modus bleibt in diesen Ordnern " +
		"(inklusive Unterordnern) und Dateien inaktiv. Manuelle Befehle funktionieren weiterhin.",
```

- [ ] **Step 3: Add the textarea setting**

In `src/settings.ts`, append inside `display()` after the existing "append completion date" setting:

```ts
		new Setting(containerEl)
			.setName(s.settingExcludedName)
			.setDesc(s.settingExcludedDesc)
			.addTextArea((text) => {
				text
					.setPlaceholder("Templates\nArchiv/2025\nDaily/Scratch.md")
					.setValue(this.plugin.settings.excludedPaths.join("\n"))
					.onChange(async (value) => {
						this.plugin.settings.excludedPaths = value
							.split("\n")
							.map((line) => line.trim())
							.filter((line) => line.length > 0);
						await this.plugin.saveSettings();
					});
				text.inputEl.rows = 4;
			});
```

- [ ] **Step 4: Verify with typecheck and tests**

Run: `npm run build`
Expected: PASS — `tsc -noEmit` finds no errors, esbuild writes `main.js`.

Run: `npm test`
Expected: PASS — all tests green (nothing behavioral changed yet).

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/i18n.ts src/settings.ts
git commit -m "feat: add excluded-paths setting with textarea UI"
```

---

### Task 3: Skip auto mode in excluded files

**Files:**
- Modify: `main.ts` (import + guard in `scheduleAutoMove()`)

**Interfaces:**
- Consumes: `isPathExcluded(filePath, excludedPaths)` from Task 1; `settings.excludedPaths` from Task 2.
- Produces: final behavior — auto mode silently does nothing in excluded files.

- [ ] **Step 1: Import the matcher**

In `main.ts`, extend the imports (after the existing `./src/mover` import line):

```ts
import { isPathExcluded } from "./src/exclusions";
```

- [ ] **Step 2: Guard the auto-move callback**

In `scheduleAutoMove()`, add the guard directly after the `if (!view) return;` line:

```ts
			if (isPathExcluded(view.file?.path ?? "", this.settings.excludedPaths)) return;
```

(`view.file` can be null for detached views; the matcher returns false for an empty path, so those keep working as before.)

- [ ] **Step 3: Verify with typecheck and tests**

Run: `npm run build`
Expected: PASS — no type errors, bundle written.

Run: `npm test`
Expected: PASS — all tests green.

- [ ] **Step 4: Commit**

```bash
git add main.ts
git commit -m "feat: skip auto mode in excluded folders/files"
```

---

### Task 4: Documentation (README EN + DE)

**Files:**
- Modify: `README.md` (settings table ~line 34, project-structure table ~line 78)
- Modify: `README.de.md` (settings table ~line 35, project-structure table)

**Interfaces:**
- Consumes: final behavior from Task 3 (documents it).
- Produces: user-facing docs.

- [ ] **Step 1: Update README.md**

Add to the settings table (after the "Append completion date" row):

```markdown
| Excluded folders/files | Vault paths (one per line) where auto mode stays inactive | empty |
```

Add to the project-structure table (after the `src/settings.ts` row):

```markdown
| `src/exclusions.ts` | Path-exclusion matching for auto mode |
```

Update the sentence about Obsidian-free modules to include the new file:

```markdown
`taskParser.ts`, `mover.ts` and `exclusions.ts` have no Obsidian dependencies,
so they are unit-testable without a running Obsidian instance.
```

- [ ] **Step 2: Update README.de.md**

Add to the settings table (after the "Erledigt-Datum anhängen" row):

```markdown
| Ausgeschlossene Ordner/Dateien | Vault-Pfade (einer pro Zeile), in denen der Auto-Modus inaktiv bleibt | leer |
```

Add the same project-structure row as in README.md (the German README mirrors the table):

```markdown
| `src/exclusions.ts` | Pfad-Ausschluss-Logik für den Auto-Modus |
```

If README.de.md contains the equivalent sentence about Obsidian-free modules, extend it the same way:

```markdown
`taskParser.ts`, `mover.ts` und `exclusions.ts` haben keine
Obsidian-Abhängigkeiten und sind daher ohne laufende Obsidian-Instanz testbar.
```

- [ ] **Step 3: Final verification**

Run: `npm test`
Expected: PASS.

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add README.md README.de.md
git commit -m "docs: document excluded folders/files setting"
```
