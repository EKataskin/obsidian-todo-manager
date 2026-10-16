# Per-list callout: план доработок

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** выполненные задачи переносятся по команде в свёрнутый callout в конце своего раздела (под своим заголовком), а задачи с которых сняли галочку - обратно в раздел.

**Architecture:** документ режется на разделы по заголовкам. Каждый раздел обрабатывается отдельно чистой функцией: полностью выполненные топ-блоки уходят в начало callout раздела, невыполненные блоки из callout (только при ручном запуске) возвращаются в конец списка. Логика остаётся в `src/taskParser.ts` + `src/mover.ts` без импортов Obsidian, `main.ts` только применяет результат через `editor.setValue`.

**Tech Stack:** TypeScript, Obsidian API, esbuild, vitest.

**Spec:** `C:\Мои документы\Obsidian\Knowledge\Temp\task-plugin.md` (разделы «Требования», «Решения», «Настройки»).

## Global Constraints

- Блок выполненных - только родной callout Obsidian (`> [!type]`), не Admonition.
- Список = всё, что под одним заголовком, до следующего заголовка любого уровня. Строки до первого заголовка (без frontmatter) - отдельный раздел. Thematic break (`---`) раздел не делит.
- Перед новым callout всегда одна пустая строка. Если сразу после вставленного callout идёт непустая строка, после него тоже ставится пустая строка.
- Новые выполненные задачи кладутся в **начало** callout, сразу после строки-заголовка; несколько за один запуск - в порядке документа.
- Callout узнаётся по типу из шаблона (`[!done]` → `done`, без учёта регистра), текст заголовка не важен. Существующую строку-заголовок не переписывать.
- Существующий callout редактируется на месте и не переезжает.
- Снятие галочки само ничего не делает. Возврат только при ручном запуске команды (`returnUnchecked: true`); автоперенос вызывает с `returnUnchecked: false`.
- При возврате дата `✅ YYYY-MM-DD` стирается со строк без галочки; у отмеченных подзадач дата остаётся.
- Настройки по умолчанию: `autoMode: false`, `calloutHeader: "> [!done]- Done"`, `appendCompletionDate: true`, `excludedPaths: []`.
- Разделы без изменений возвращаются байт в байт. Перевод строк (`\r\n` / `\n`) сохраняется.
- Строки интерфейса на en, de, ru.

## Review Focus

1. **Повторный запуск** команды на своём же результате ничего не меняет (`movedCount 0`, `returnedCount 0`, текст тот же) - тест в Task 2.
2. **Callout не в конце раздела** (после него пользователь дописал текст) - дополняется на месте, второй не создаётся - тест в Task 2.
3. **Раздел без пустой строки перед следующим заголовком** - вокруг вставленного callout появляются пустые строки, следующий заголовок не прилипает - тест в Task 2.
4. **Frontmatter** (`---` в начале файла) - не считается частью раздела, callout не попадает внутрь него - тест в Task 1.
5. **CRLF-файл** - вставленные строки callout разделены `\r\n` - тест в Task 2.

---

### Task 1: разделы и callout в парсере

**Files:**
- Modify: `src/taskParser.ts` (удалить `DoneSection`, `findDoneSection`, `doneInsertIndex`; добавить новое)
- Test: `src/taskParser.test.ts` (удалить блок `findDoneSection / doneInsertIndex`, добавить новые)

**Interfaces:**
- Produces:
  - `interface Section { contentStart: number; contentEnd: number }` - строки содержимого `[contentStart, contentEnd)`, строка заголовка (если есть) = `contentStart - 1`.
  - `splitSections(lines: string[]): Section[]` - пропускает frontmatter (первая строка `---` до следующей `---`); первый раздел - строки до первого заголовка (может быть пустым диапазоном), далее по разделу на каждый заголовок.
  - `calloutType(header: string): string | null` - тип из строки вида `> [!done]- ...` в нижнем регистре, иначе `null`. Регулярка: `/^>\s*\[!([\w-]+)\]/`.
  - `interface CalloutRange { header: number; end: number }` - индекс строки-заголовка и последней строки тела (включительно), тело - подряд идущие строки, начинающиеся с `>`.
  - `findCallout(lines: string[], section: Section, type: string): CalloutRange | null` - первый callout нужного типа в разделе.
  - `unquote(line: string): string` - снимает `/^> ?/`.
  - `quote(line: string): string` - `""` → `">"`, иначе `"> " + line`.

- [ ] **Step 1: тесты**

```ts
describe("splitSections", () => {
	it("splits by headings of any level and keeps the pre-heading part", () => {
		const lines = ["- [ ] top", "## A", "- [ ] a", "### B", "- [ ] b"];
		expect(splitSections(lines)).toEqual([
			{ contentStart: 0, contentEnd: 1 },
			{ contentStart: 2, contentEnd: 3 },
			{ contentStart: 4, contentEnd: 5 },
		]);
	});
	it("does not split on a thematic break", () => {
		expect(splitSections(["## A", "- [ ] a", "---", "- [ ] b"])).toEqual([
			{ contentStart: 0, contentEnd: 0 },
			{ contentStart: 1, contentEnd: 4 },
		]);
	});
	it("skips frontmatter", () => {
		const lines = ["---", "tags: [x]", "---", "- [ ] a"];
		expect(splitSections(lines)).toEqual([{ contentStart: 3, contentEnd: 4 }]);
	});
});

describe("calloutType", () => {
	it("reads the type case-insensitively", () => {
		expect(calloutType("> [!Done]- Выполнено")).toBe("done");
		expect(calloutType("> [!done]")).toBe("done");
	});
	it("returns null for a non-callout line", () => {
		expect(calloutType("Выполнено")).toBeNull();
		expect(calloutType("> quote")).toBeNull();
	});
});

describe("findCallout", () => {
	it("finds the callout of the given type and its body", () => {
		const lines = ["## A", "- [ ] a", "", "> [!note] x", "> n", "", "> [!done]- X", "> - [x] d", ">", "> - [x] e", "text"];
		const [, section] = splitSections(lines);
		expect(findCallout(lines, section, "done")).toEqual({ header: 6, end: 9 });
	});
	it("returns null when the section has none", () => {
		const lines = ["## A", "- [ ] a"];
		expect(findCallout(lines, splitSections(lines)[1], "done")).toBeNull();
	});
});
```

- [ ] **Step 2:** `npx vitest run src/taskParser.test.ts` - FAIL (функций нет).
- [ ] **Step 3:** реализовать интерфейсы выше в `src/taskParser.ts`.
- [ ] **Step 4:** `npx vitest run src/taskParser.test.ts` - PASS. `mover.ts` пока не компилируется из-за удалённых функций - это чинит Task 2, запускать только этот файл.
- [ ] **Step 5:** коммит `feat: split document into sections and find callouts`.

### Task 2: перенос в callout своего раздела

**Files:**
- Modify: `src/types.ts`, `src/mover.ts` (переписать), `main.ts` (только чтобы компилировалось: `doneHeading` → `calloutHeader`, `returnUnchecked`, убрать команду выделения)
- Test: `src/mover.test.ts` (переписать целиком)

**Interfaces:**
- Consumes: всё из Task 1, а также `parseLines`, `topLevelBlocks`, `isBlockFullyDone`, `splitLines`.
- Produces:
  - `MoveOptions { calloutHeader: string; appendDate: boolean; returnUnchecked: boolean; today: string }`
  - `MoveResult { text: string; movedCount: number; returnedCount: number }`
  - `DoneMoverSettings.calloutHeader: string` вместо `doneHeading`.
  - `moveCompletedTasks(text: string, opts: MoveOptions): MoveResult`
  - `moveSelectedTasks` и `blockEnd`-реэкспорт удаляются. Причина: блок без галочки, перенесённый в callout выделением, вернётся обратно при следующем запуске команды.

Алгоритм на раздел: найти callout (`calloutType(opts.calloutHeader)`); топ-блоки вне callout, у которых `isBlockFullyDone`, вырезать, снять общий отступ (`dedent` уже есть), при `appendDate` дописать дату, обернуть `quote`. Если callout есть - вставить сразу после его строки-заголовка. Если нет - создать `["", opts.calloutHeader, ...body]` после последней непустой строки раздела (после удаления блоков; если непустых нет - после строки заголовка раздела), и добавить `""` после, если следующая строка непустая. Раздел без перенесённых блоков не трогать. `returnUnchecked` в этой задаче игнорируется.

- [ ] **Step 1: тесты.** Общие опции: `{ calloutHeader: "> [!done]- Выполнено", appendDate: false, returnUnchecked: false, today: "2026-10-17" }`; хелпер `run(lines, extra?)` склеивает через `\n` и возвращает результат.

```ts
it("gives each section its own callout and keeps a done sub-task under an open parent", () => {
	const r = run(["## A", "- [x] a1", "- [ ] a2", "", "## B", "- [ ] b1", "\t- [x] b1.1", "- [x] b2"]);
	expect(r.movedCount).toBe(2);
	expect(r.text).toBe(["## A", "- [ ] a2", "", "> [!done]- Выполнено", "> - [x] a1", "",
		"## B", "- [ ] b1", "\t- [x] b1.1", "", "> [!done]- Выполнено", "> - [x] b2"].join("\n"));
});

it("puts new tasks at the top of an existing callout, in document order", () => {
	const r = run(["## A", "- [x] n1", "- [x] n2", "", "> [!done]- Выполнено", "> - [x] old"]);
	expect(r.text).toBe(["## A", "", "> [!done]- Выполнено", "> - [x] n1", "> - [x] n2", "> - [x] old"].join("\n"));
});

it("keeps sub-task indentation inside the callout", () => {
	const r = run(["## A", "- [x] p", "\t- [x] c"]);
	expect(r.text).toBe(["## A", "", "> [!done]- Выполнено", "> - [x] p", "> \t- [x] c"].join("\n"));
});

it("appends the completion date when enabled", () => {
	const r = run(["## A", "- [x] a"], { appendDate: true });
	expect(r.text).toContain("> - [x] a ✅ 2026-10-17");
});

it("finds an existing callout by type and keeps its header", () => {
	const r = run(["## A", "- [x] a", "", "> [!done]- Done"]);
	expect(r.text).toBe(["## A", "", "> [!done]- Done", "> - [x] a"].join("\n"));
});

it("ignores unchecked tasks in the callout when returnUnchecked is off", () => {
	const text = ["## A", "- [ ] a", "", "> [!done]- Выполнено", "> - [ ] back"];
	expect(run(text)).toEqual({ text: text.join("\n"), movedCount: 0, returnedCount: 0 });
});

// Review Focus 1
it("is idempotent", () => {
	const first = run(["## A", "- [x] a", "- [ ] b", "## B", "- [x] c"]);
	const second = moveCompletedTasks(first.text, OPTS);
	expect(second).toEqual({ text: first.text, movedCount: 0, returnedCount: 0 });
});

// Review Focus 2
it("extends a callout in place when text follows it", () => {
	const r = run(["## A", "- [ ] keep", "- [x] a", "", "> [!done]- X", "> - [x] old", "", "Some text"]);
	expect(r.text).toBe(["## A", "- [ ] keep", "", "> [!done]- X", "> - [x] a", "> - [x] old", "", "Some text"].join("\n"));
});

// Review Focus 3
it("separates a new callout from the next heading", () => {
	const r = run(["## A", "- [x] a", "## B"]);
	expect(r.text).toBe(["## A", "", "> [!done]- Выполнено", "> - [x] a", "", "## B"].join("\n"));
});

// Review Focus 5
it("keeps CRLF line endings", () => {
	const r = moveCompletedTasks("## A\r\n- [x] a\r\n", OPTS);
	expect(r.text).toBe("## A\r\n\r\n> [!done]- Выполнено\r\n> - [x] a\r\n");
});
```

Примечание к последнему тесту: исходный текст кончается на `\r\n`, значит последняя строка пустая. Callout вставляется после последней непустой строки, а хвостовая пустая строка остаётся после него.

- [ ] **Step 2:** `npx vitest run src/mover.test.ts` - FAIL.
- [ ] **Step 3:** обновить `types.ts` (`DEFAULT_SETTINGS.calloutHeader = "> [!done]- Done"`), переписать `mover.ts`. В `main.ts`: передать `calloutHeader` и `returnUnchecked: true` для команды, `false` для автопереноса; удалить команду `move-selected-tasks`, `runMoveSelection` и пункт меню выделения; `noticeMoved` пока вызывать как `noticeMoved(movedCount, calloutHeader)` (строки меняет Task 4).
- [ ] **Step 4:** `npm test` - PASS, `npx tsc -noEmit -skipLibCheck` - без ошибок.
- [ ] **Step 5:** коммит `feat: move completed tasks into a per-section callout`.

### Task 3: возврат задач из callout

**Files:**
- Modify: `src/mover.ts`
- Test: `src/mover.test.ts`

**Interfaces:**
- Consumes: `moveCompletedTasks`, `MoveOptions.returnUnchecked`, `unquote` из Task 1-2.
- Produces: `MoveResult.returnedCount` - число вернувшихся топ-блоков.

Правило: при `returnUnchecked` топ-блоки тела callout (после `unquote`), у которых **не** `isBlockFullyDone`, вырезаются из callout. С их строк без галочки стирается `/\s*✅\s*\d{4}-\d{2}-\d{2}/`. Вставка - после конца последнего оставшегося топ-блока задач вне callout; если таких нет - после последней непустой строки перед строкой-заголовком callout. Якорь считается по строкам, которые остаются (уже без перенесённых в этот запуск). Если тело callout опустело - удалить строку-заголовок и одну пустую строку перед ним.

- [ ] **Step 1: тесты** (опции как в Task 2, но `returnUnchecked: true`)

```ts
it("returns an unchecked task to the end of the list", () => {
	const r = run(["## A", "- [ ] a", "", "> [!done]- X", "> - [ ] back", "> - [x] stay"], { returnUnchecked: true });
	expect(r.returnedCount).toBe(1);
	expect(r.text).toBe(["## A", "- [ ] a", "- [ ] back", "", "> [!done]- X", "> - [x] stay"].join("\n"));
});

it("returns the whole block when only a sub-task was unchecked", () => {
	const r = run(["## A", "", "> [!done]- X", "> - [x] p", "> \t- [ ] c"], { returnUnchecked: true });
	expect(r.text).toBe(["## A", "- [x] p", "\t- [ ] c"].join("\n"));
});

it("strips the date only from unchecked lines", () => {
	const r = run(["## A", "", "> [!done]- X", "> - [ ] p ✅ 2026-10-01", "> \t- [x] c ✅ 2026-10-01"], { returnUnchecked: true });
	expect(r.text).toBe(["## A", "- [ ] p", "\t- [x] c ✅ 2026-10-01"].join("\n"));
});

it("moves and returns in one run", () => {
	const r = run(["## A", "- [x] new", "", "> [!done]- X", "> - [ ] back"], { returnUnchecked: true });
	expect(r).toMatchObject({ movedCount: 1, returnedCount: 1 });
	expect(r.text).toBe(["## A", "- [ ] back", "", "> [!done]- X", "> - [x] new"].join("\n"));
});
```

- [ ] **Step 2:** `npx vitest run src/mover.test.ts` - новые FAIL, старые PASS.
- [ ] **Step 3:** реализовать в `mover.ts`.
- [ ] **Step 4:** `npm test` - PASS.
- [ ] **Step 5:** коммит `feat: return unchecked tasks from the callout`.

### Task 4: настройки, команды, строки интерфейса

**Files:**
- Modify: `main.ts`, `src/settings.ts`, `src/i18n.ts`

**Interfaces:**
- Consumes: `calloutType` (Task 1), `MoveResult.returnedCount` (Task 3).
- Produces: настройка «Заголовок блока выполненных» вместо «Заголовок Done».

Изменения:
- `main.ts`: если `calloutType(settings.calloutHeader)` равен `null`, в `MoveOptions` подставлять `DEFAULT_SETTINGS.calloutHeader`. Уведомление: при `movedCount + returnedCount > 0` - `noticeMoved(moved, returned)`, иначе `noticeNoCompleted`. `applyResult` применяет результат, если `movedCount + returnedCount > 0`.
- `settings.ts`: текстовое поле `calloutHeader`, placeholder `> [!done]- Done`. Сохранять только значение, у которого `calloutType` не `null`.
- `i18n.ts`: удалить `cmdMoveSelection`, `noticeNoSelection`, `settingHeadingName/Desc`; `noticeMoved: (moved: number, returned: number) => string`; добавить `settingCalloutName`, `settingCalloutDesc`. Тексты:

| ключ | en | de | ru |
|---|---|---|---|
| `cmdMoveCompleted` | Move completed tasks | Erledigte Aufgaben verschieben | Перенести выполненные задачи |
| `noticeMoved` | Moved: {m}, returned: {r}. | Verschoben: {m}, zurückgeholt: {r}. | Перенесено: {m}, возвращено: {r}. |
| `noticeNoCompleted` | Nothing to move. | Nichts zu verschieben. | Нечего переносить. |
| `settingCalloutName` | Done block header | Kopfzeile des Erledigt-Blocks | Заголовок блока выполненных |
| `settingCalloutDesc` | First line of the callout that holds completed tasks, e.g. "> [!done]- Done". Existing blocks are found by callout type. | Erste Zeile des Callouts für erledigte Aufgaben, z. B. „> [!done]- Erledigt". Vorhandene Blöcke werden am Callout-Typ erkannt. | Первая строка callout для выполненных задач, например «> [!done]- Выполнено». Существующий блок находится по типу callout. |

- [ ] **Step 1:** внести изменения.
- [ ] **Step 2:** `npm run build` - без ошибок, `npm test` - PASS.
- [ ] **Step 3:** коммит `feat: callout header setting, drop selection command`.

### Task 5: свой плагин, сборка и проверка в Obsidian

**Files:**
- Modify: `manifest.json`, `versions.json`, `package.json`, `README.md`

- [ ] **Step 1:** `manifest.json`: `id: "todo-manager"`, `name: "To-Do Manager"`, `version: "0.1.0"`, `author: "EKataskin"`, `authorUrl: "https://github.com/EKataskin"`, `description: "Move completed tasks into a collapsible callout at the end of their own list, and back."`. `versions.json`: `{ "0.1.0": "1.0.0" }`. `package.json`: `name: "todo-manager"`, `version: "0.1.0"`.
- [ ] **Step 2:** `README.md` - описать поведение (раздел = заголовок, callout, возврат по команде, настройки). `README.de.md` не трогать, решает пользователь.
- [ ] **Step 3:** `npm run build`, скопировать `main.js` и `manifest.json` в `C:\Мои документы\Obsidian\Knowledge\.obsidian\plugins\todo-manager\`.
- [ ] **Step 4:** пользователь включает плагин и проверяет на заметке:

```markdown
## Дом
- [x] Купить лампу
- [ ] Повесить полку
	- [x] Купить дюбели

## Работа
- [x] Отчёт
```

Ожидается: у «Дом» и «Работа» свой свёрнутый callout; «Купить дюбели» остаётся на месте. Снять галочку с «Отчёт» в callout (Reading и Live Preview) - callout не сворачивается, задача не двигается. Команда из контекстного меню - «Отчёт» вернулся в список, callout «Работа» исчез.
- [ ] **Step 5:** коммит `chore: rename plugin to To-Do Manager 0.1.0`.
