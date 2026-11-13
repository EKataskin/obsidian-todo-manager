import { Editor, MarkdownFileInfo, MarkdownView, Menu, MenuItem, Notice, Plugin, TFile, moment, Component, MarkdownRenderer, debounce, editorInfoField } from "obsidian";
import { EditorView, ViewUpdate } from "@codemirror/view";
import { CompleteTemplate, DEFAULT_SETTINGS, TodoManagerSettings, MoveOptions, MoveResult } from "./src/types";
import { TodoManagerSettingTab } from "./src/settings";
import { changedRange, moveCompletedTasks } from "./src/mover";
import { calloutType } from "./src/taskParser";
import { isPathExcluded } from "./src/exclusions";
import { setTaskStatus, taskStatus } from "./src/taskChars";
import { createStatusIcon, statusChars } from "./src/statusIcon";
import { formatDate, isDateTemplate, removeDates, setDateStamp, templateLines } from "./src/dateTemplate";
import { applyCompleteTemplate, undoCompletion, withBuiltinTemplate } from "./src/completeTemplate";
import { Lang, Strings, getStrings } from "./src/i18n";

/** Delay before the auto mode reacts, so it does not interrupt typing. */
const AUTO_MOVE_DEBOUNCE_MS = 400;

/** The menu section of the plugin's items: the menu keeps them together, between separators. */
const MENU_SECTION = "todo-manager";

/**
 * Detects the UI language from Obsidian's locale (via the bundled moment
 * instance, which Obsidian sets from the app language). Falls back to English.
 */
function detectLang(): Lang {
	const locale = (moment.locale() || "en").toLowerCase();
	if (locale.startsWith("de")) return "de";
	if (locale.startsWith("ru")) return "ru";
	return "en";
}

export default class TodoManagerPlugin extends Plugin {
	settings!: TodoManagerSettings;
	/** Localized UI strings, resolved once at load time. */
	strings: Strings = getStrings(detectLang());

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new TodoManagerSettingTab(this.app, this));

		// Each move comes without and with the completion date.
		const moves = [
			{ id: "move-completed-tasks", title: this.strings.cmdMoveCompleted, withDate: false },
			{ id: "move-completed-tasks-with-date", title: this.strings.cmdMoveCompletedWithDate, withDate: true },
		];

		// Works in any view mode: through the editor when one is open, else on the file.
		for (const move of moves) {
			this.addCommand({
				id: move.id,
				name: move.title,
				checkCallback: (checking) => {
					const file = this.app.workspace.getActiveFile();
					if (!file || file.extension !== "md") return false;
					if (!checking) void this.runOnFile(file, move.withDate);
					return true;
				},
			});
		}

		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor, info) => {
				for (const move of moves) {
					menu.addItem((item) =>
						item
							.setTitle(move.title)
							.setIcon("check-check")
							.setSection(MENU_SECTION)
							.onClick(() => this.runMoveCompleted(editor, move.withDate))
					);
				}
				const lines = this.taskLines(editor);
				if (lines.length > 0) {
					this.addStatusMenu(menu, editor, lines);
					this.addDateMenu(menu, editor, lines, info.file?.path ?? "");
					this.addCompleteMenu(menu, editor, lines);
				}
			})
		);

		// The "More options" menu of a note and its tab, but not the file explorer.
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file, source) => {
				if (source === "file-explorer-context-menu") return;
				if (!(file instanceof TFile) || file.extension !== "md") return;
				for (const move of moves) {
					menu.addItem((item) =>
						item
							.setTitle(move.title)
							.setIcon("check-check")
							.setSection(MENU_SECTION)
							.onClick(() => this.runOnFile(file, move.withDate))
					);
				}
			})
		);

		// Auto mode reacts to a checked checkbox, not to typing.
		this.registerEditorExtension(
			EditorView.updateListener.of((update) => {
				if (!this.settings.autoMode || !this.isCheck(update)) return;
				const info = update.state.field(editorInfoField, false);
				if (info?.editor && info.file) this.autoMove(info.editor, info, info.file);
			})
		);
		this.register(() => this.autoMove.cancel());
	}

	async loadSettings() {
		const data = (await this.loadData()) as Partial<TodoManagerSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
		// A removed setting: it leaves data.json on the next save.
		delete (this.settings as { appendCompletionDate?: unknown }).appendCompletionDate;
		this.settings.completeTemplates = withBuiltinTemplate(this.settings.completeTemplates, this.doneTemplate());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/** The valid lines of the date templates setting. */
	private dateTemplates(): string[] {
		return templateLines(this.settings.dateTemplate).filter(isDateTemplate);
	}

	/** The template of the dates added on moving: the first valid one, else the default. */
	private firstDateTemplate(): string {
		return this.dateTemplates()[0] ?? templateLines(DEFAULT_SETTINGS.dateTemplate)[0];
	}

	private moveOptions(returnUnchecked: boolean, appendDate = false): MoveOptions {
		return {
			calloutHeader:
				calloutType(this.settings.calloutHeader) !== null
					? this.settings.calloutHeader
					: DEFAULT_SETTINGS.calloutHeader,
			appendDate,
			datePosition: this.settings.datePosition,
			// The first template adds dates, the others are only recognized.
			dateTemplate: this.firstDateTemplate(),
			otherDateTemplates: this.dateTemplates().slice(1),
			closedChars: this.settings.closedChars || DEFAULT_SETTINGS.closedChars,
			returnUnchecked,
			today: new Date(),
		};
	}

	private runMoveCompleted(editor: Editor, withDate: boolean) {
		const result = moveCompletedTasks(editor.getValue(), this.moveOptions(true, withDate));
		this.applyResult(editor, result);
		this.showResult(result);
	}

	/** Uses an open editor of the file (keeps the cursor), else rewrites the file itself. */
	private async runOnFile(file: TFile, withDate: boolean) {
		const editor = this.editorFor(file);
		if (editor) return this.runMoveCompleted(editor, withDate);
		let result!: MoveResult;
		await this.app.vault.process(file, (text) => {
			result = moveCompletedTasks(text, this.moveOptions(true, withDate));
			return result.text;
		});
		this.showResult(result);
	}

	/** The editor of a note that shows the file in Source or Live Preview mode. */
	private editorFor(file: TFile): Editor | null {
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view;
			if (view instanceof MarkdownView && view.file === file && view.getMode() === "source") {
				return view.editor;
			}
		}
		return null;
	}

	/** Task lines in the cursor's line or the selection. */
	private taskLines(editor: Editor): number[] {
		const from = editor.getCursor("from");
		const to = editor.getCursor("to");
		// A selection that ends at the start of a line does not take that line.
		const last = to.line > from.line && to.ch === 0 ? to.line - 1 : to.line;
		const lines: number[] = [];
		for (let i = from.line; i <= last; i++) {
			if (taskStatus(editor.getLine(i)) !== null) lines.push(i);
		}
		return lines;
	}

	/** Rewrites the lines in one transaction, so one undo step. */
	private changeLines(editor: Editor, lines: number[], change: (text: string) => string) {
		editor.transaction({
			changes: lines.map((line) => {
				const text = editor.getLine(line);
				return { from: { line, ch: 0 }, to: { line, ch: text.length }, text: change(text) };
			}),
		});
	}

	/** A menu item with a submenu; without submenus the items go right into the menu. */
	private addSubmenu(menu: Menu, title: string, icon: string): { submenu: Menu | undefined; target: Menu } {
		let submenu: Menu | undefined;
		menu.addItem((item) => {
			item.setTitle(title).setIcon(icon).setSection(MENU_SECTION);
			// Submenus are not in the public API.
			submenu = (item as MenuItem & { setSubmenu?: () => Menu }).setSubmenu?.();
		});
		return { submenu, target: submenu ?? menu };
	}

	/**
	 * "Completion date" with one item per date template, filled with today's
	 * date, and "Remove date" when a line has a date of any of them.
	 */
	private addDateMenu(menu: Menu, editor: Editor, lines: number[], sourcePath: string) {
		const templates = this.dateTemplates();
		if (templates.length === 0) return;
		const today = new Date();
		const removable = lines.some((line) => {
			const text = editor.getLine(line);
			return removeDates(text, templates) !== text;
		});
		const { target } = this.addSubmenu(menu, this.strings.menuCompletionDate, "calendar-check");
		// Rendered markdown may hold child components; they go when the menu closes.
		const renderer = new Component();
		renderer.load();
		menu.onHide(() => renderer.unload());
		for (const template of templates) {
			target.addItem((item) =>
				item
					// The template is shown as it looks in the note, e.g. <small> or **bold**.
					.setTitle(
						createFragment((el) => {
							// Themes style rendered markdown only inside "markdown-rendered".
							const span = el.createSpan("todo-manager-date-item markdown-rendered");
							void MarkdownRenderer.render(this.app, formatDate(template, today), span, sourcePath, renderer);
						})
					)
					.onClick(() =>
						this.changeLines(
							editor,
							lines,
							(text) => setDateStamp(text, template, today, this.settings.datePosition) ?? text
						)
					)
			);
		}
		if (!removable) return;
		target.addSeparator();
		target.addItem((item) =>
			item
				.setTitle(this.strings.menuRemoveDate)
				.setIcon("calendar-x")
				.onClick(() => this.changeLines(editor, lines, (text) => removeDates(text, templates) ?? text))
		);
	}

	/** The built-in "Done" complete template as it is on the first run, made of the general settings. */
	private doneTemplate(): CompleteTemplate {
		return {
			name: this.strings.completeDefaultName,
			// The char Obsidian itself puts on a click in Reading view.
			char: "x",
			dateTemplate: this.firstDateTemplate(),
			datePosition: this.settings.datePosition,
			move: true,
			builtin: true,
		};
	}

	/**
	 * "Complete by template" with the templates of the settings, and the undo of
	 * a completion last.
	 */
	private addCompleteMenu(menu: Menu, editor: Editor, lines: number[]) {
		const templates = this.settings.completeTemplates.filter((t) => t.name && t.char);
		const { target } = this.addSubmenu(menu, this.strings.menuCompleteByTemplate, "list-checks");
		// The status icon, then the name.
		const title = (char: string, name: string) =>
			createFragment((el) => {
				const span = el.createSpan("todo-manager-template-item");
				createStatusIcon(span, char, false);
				span.createSpan({ text: name });
			});
		for (const template of templates) {
			target.addItem((item) =>
				item
					.setTitle(title(template.char, template.name))
					.onClick(() =>
						this.replaceText(editor, applyCompleteTemplate(editor.getValue(), lines, template, this.moveOptions(false)))
					)
			);
		}
		// The date is looked for by the date templates, then by those of the complete templates.
		const dateTemplates = [
			...new Set([...this.dateTemplates(), ...this.settings.completeTemplates.map((t) => t.dateTemplate).filter(isDateTemplate)]),
		];
		target.addSeparator();
		target.addItem((item) =>
			item
				.setTitle(title(" ", this.strings.menuUndoCompletion))
				.onClick(() =>
					this.replaceText(editor, undoCompletion(editor.getValue(), lines, dateTemplates, this.moveOptions(true)))
				)
		);
	}

	/** "Task status" with one item per status char. */
	private addStatusMenu(menu: Menu, editor: Editor, lines: number[]) {
		const current = new Set(lines.map((line) => taskStatus(editor.getLine(line))));
		const { submenu, target } = this.addSubmenu(menu, this.strings.menuTaskStatus, "square-check");
		for (const char of statusChars(this.settings.menuChars)) {
			target.addItem((item) =>
				item
					// "mod-columns" lays out the submenu in columns, "is-current" marks the
					// current status with a background; see styles.css.
					.setTitle(
						createFragment((el) => {
							const icon = createStatusIcon(el, char);
							icon.toggleClass("mod-columns", !!submenu);
							icon.toggleClass("is-current", current.size === 1 && current.has(char));
						})
					)
					.onClick(() => this.changeLines(editor, lines, (text) => setTaskStatus(text, char) ?? text))
			);
		}
	}

	private showResult(result: MoveResult) {
		new Notice(
			result.movedCount + result.returnedCount > 0
				? this.strings.noticeMoved(result.movedCount, result.returnedCount)
				: this.strings.noticeNoCompleted
		);
	}

	/**
	 * True when the update leaves more closed tasks and only swaps chars in
	 * place: a checkbox was checked. Typing "- [x]" by hand changes the length.
	 */
	private isCheck(update: ViewUpdate): boolean {
		if (!update.docChanged) return false;
		const closedChars = this.settings.closedChars || DEFAULT_SETTINGS.closedChars;
		const closed = (doc: ViewUpdate["state"]["doc"], from: number, to: number) => {
			let count = 0;
			for (let n = doc.lineAt(from).number; n <= doc.lineAt(to).number; n++) {
				const status = taskStatus(doc.line(n).text);
				if (status !== null && closedChars.includes(status)) count++;
			}
			return count;
		};
		let inPlace = true;
		let grew = 0;
		update.changes.iterChanges((fromA, toA, fromB, toB) => {
			if (toA - fromA !== toB - fromB) inPlace = false;
			grew += closed(update.state.doc, fromB, toB) - closed(update.startState.doc, fromA, toA);
		});
		return inPlace && grew > 0;
	}

	/** Works on the edited note, even if another note is active when the timer fires. */
	private autoMove = debounce(
		(editor: Editor, info: MarkdownFileInfo, file: TFile) => {
			// The editor may show another note by now (navigation inside the same tab).
			if (info.file !== file) return;
			if (isPathExcluded(file.path, this.settings.excludedPaths)) return;
			const result = moveCompletedTasks(editor.getValue(), this.moveOptions(false));
			if (result.movedCount > 0) {
				this.applyResult(editor, result);
				new Notice(this.strings.noticeAutoMoved(result.movedCount));
			}
		},
		AUTO_MOVE_DEBOUNCE_MS,
		true
	);

	private applyResult(editor: Editor, result: MoveResult) {
		if (result.movedCount + result.returnedCount > 0) this.replaceText(editor, result.text);
	}

	/** Replaces only the changed part, so the cursor, scroll and folds elsewhere stay put. */
	private replaceText(editor: Editor, text: string) {
		const { from, to, insert } = changedRange(editor.getValue(), text);
		if (from === to && insert === "") return;
		editor.replaceRange(insert, editor.offsetToPos(from), editor.offsetToPos(to));
	}
}
