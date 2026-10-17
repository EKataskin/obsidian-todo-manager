import { Editor, MarkdownFileInfo, MarkdownView, Menu, MenuItem, Notice, Plugin, TFile, moment, sanitizeHTMLToDom } from "obsidian";
import { DEFAULT_SETTINGS, DoneMoverSettings, MoveOptions, MoveResult } from "./src/types";
import { DoneMoverSettingTab } from "./src/settings";
import { changedRange, moveCompletedTasks } from "./src/mover";
import { calloutType } from "./src/taskParser";
import { isPathExcluded } from "./src/exclusions";
import { setTaskStatus, taskStatus } from "./src/taskChars";
import { createStatusIcon, statusChars } from "./src/statusIcon";
import { formatDate, isDateTemplate, removeDates, setDateStamp, templateLines } from "./src/dateTemplate";
import { Lang, Strings, getStrings } from "./src/i18n";

/** Delay before the auto mode reacts, so it does not interrupt typing. */
const AUTO_MOVE_DEBOUNCE_MS = 400;

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

export default class DoneMoverPlugin extends Plugin {
	settings!: DoneMoverSettings;
	/** Localized UI strings, resolved once at load time. */
	strings: Strings = getStrings(detectLang());
	private autoTimer: number | null = null;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new DoneMoverSettingTab(this.app, this));

		// Works in any view mode: through the editor when one is open, else on the file.
		this.addCommand({
			id: "move-completed-tasks",
			name: this.strings.cmdMoveCompleted,
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file || file.extension !== "md") return false;
				if (!checking) void this.runOnFile(file);
				return true;
			},
		});

		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor) => {
				menu.addItem((item) =>
					item
						.setTitle(this.strings.cmdMoveCompleted)
						.setIcon("check-check")
						.onClick(() => this.runMoveCompleted(editor))
				);
				const lines = this.taskLines(editor);
				if (lines.length > 0) {
					this.addStatusMenu(menu, editor, lines);
					this.addDateMenu(menu, editor, lines);
				}
			})
		);

		// The "More options" menu of a note and its tab, but not the file explorer.
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file, source) => {
				if (source === "file-explorer-context-menu") return;
				if (!(file instanceof TFile) || file.extension !== "md") return;
				menu.addItem((item) =>
					item
						.setTitle(this.strings.cmdMoveCompleted)
						.setIcon("check-check")
						.onClick(() => this.runOnFile(file))
				);
			})
		);

		this.registerEvent(
			this.app.workspace.on("editor-change", (editor, info) => {
				if (this.settings.autoMode) this.scheduleAutoMove(editor, info);
			})
		);
	}

	onunload() {
		if (this.autoTimer !== null) window.clearTimeout(this.autoTimer);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/** The valid lines of the date templates setting. */
	private dateTemplates(): string[] {
		return templateLines(this.settings.dateTemplate).filter(isDateTemplate);
	}

	/** Earlier first templates; one without a date format would match every line. */
	private oldDateTemplates(): string[] {
		return this.settings.oldDateTemplates.filter(isDateTemplate);
	}

	private moveOptions(returnUnchecked: boolean): MoveOptions {
		const templates = this.dateTemplates();
		return {
			calloutHeader:
				calloutType(this.settings.calloutHeader) !== null
					? this.settings.calloutHeader
					: DEFAULT_SETTINGS.calloutHeader,
			appendDate: this.settings.appendCompletionDate,
			datePosition: this.settings.datePosition,
			// The first template adds dates, the others are only recognized.
			dateTemplate: templates[0] ?? templateLines(DEFAULT_SETTINGS.dateTemplate)[0],
			oldDateTemplates: [...templates.slice(1), ...this.oldDateTemplates()],
			closedChars: this.settings.closedChars || DEFAULT_SETTINGS.closedChars,
			returnUnchecked,
			today: new Date(),
		};
	}

	private runMoveCompleted(editor: Editor) {
		const result = moveCompletedTasks(editor.getValue(), this.moveOptions(true));
		this.applyResult(editor, result);
		this.showResult(result);
	}

	/** Uses an open editor of the file (keeps the cursor), else rewrites the file itself. */
	private async runOnFile(file: TFile) {
		const editor = this.editorFor(file);
		if (editor) return this.runMoveCompleted(editor);
		let result!: MoveResult;
		await this.app.vault.process(file, (text) => {
			result = moveCompletedTasks(text, this.moveOptions(true));
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
			item.setTitle(title).setIcon(icon);
			// Submenus are not in the public API.
			submenu = (item as MenuItem & { setSubmenu?: () => Menu }).setSubmenu?.();
		});
		return { submenu, target: submenu ?? menu };
	}

	/**
	 * "Completion date" with one item per date template, filled with today's
	 * date, and "Remove date" when a line has a date of any known template.
	 */
	private addDateMenu(menu: Menu, editor: Editor, lines: number[]) {
		const templates = this.dateTemplates();
		if (templates.length === 0) return;
		const today = new Date();
		const known = [...templates, ...this.oldDateTemplates()];
		const removable = lines.some((line) => {
			const text = editor.getLine(line);
			return removeDates(text, known) !== text;
		});
		const { target } = this.addSubmenu(menu, this.strings.menuCompletionDate, "calendar-check");
		for (const template of templates) {
			target.addItem((item) =>
				item
					// HTML of the template is shown as it looks in the note, e.g. <small>.
					.setTitle(sanitizeHTMLToDom(formatDate(template, today)))
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
				.onClick(() => this.changeLines(editor, lines, (text) => removeDates(text, known) ?? text))
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

	/** Works on the edited note, even if another note is active when the timer fires. */
	private scheduleAutoMove(editor: Editor, info: MarkdownView | MarkdownFileInfo) {
		const file = info.file;
		if (this.autoTimer !== null) window.clearTimeout(this.autoTimer);
		this.autoTimer = window.setTimeout(() => {
			this.autoTimer = null;
			// The editor may show another note by now (navigation inside the same tab).
			if (!file || info.file !== file) return;
			if (isPathExcluded(file.path, this.settings.excludedPaths)) return;
			const result = moveCompletedTasks(editor.getValue(), this.moveOptions(false));
			if (result.movedCount > 0) {
				this.applyResult(editor, result);
				new Notice(this.strings.noticeAutoMoved(result.movedCount));
			}
		}, AUTO_MOVE_DEBOUNCE_MS);
	}

	/** Replaces only the changed part, so the cursor, scroll and folds elsewhere stay put. */
	private applyResult(editor: Editor, result: MoveResult) {
		if (result.movedCount + result.returnedCount === 0) return;
		const { from, to, insert } = changedRange(editor.getValue(), result.text);
		editor.replaceRange(insert, editor.offsetToPos(from), editor.offsetToPos(to));
	}
}
