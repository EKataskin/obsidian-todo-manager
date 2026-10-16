import { Editor, MarkdownFileInfo, MarkdownView, Menu, MenuItem, Notice, Plugin, TFile, moment } from "obsidian";
import { DEFAULT_SETTINGS, DoneMoverSettings, MoveOptions, MoveResult } from "./src/types";
import { DoneMoverSettingTab } from "./src/settings";
import { changedRange, moveCompletedTasks } from "./src/mover";
import { calloutType } from "./src/taskParser";
import { isPathExcluded } from "./src/exclusions";
import { setTaskStatus, taskStatus } from "./src/taskChars";
import { createStatusIcon, statusChars } from "./src/statusIcon";
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

/** Returns today's local date as YYYY-MM-DD. */
function formatToday(): string {
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
				this.addStatusMenu(menu, editor);
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

	private moveOptions(returnUnchecked: boolean): MoveOptions {
		return {
			calloutHeader:
				calloutType(this.settings.calloutHeader) !== null
					? this.settings.calloutHeader
					: DEFAULT_SETTINGS.calloutHeader,
			appendDate: this.settings.appendCompletionDate,
			datePosition: this.settings.datePosition,
			dateTemplate: this.settings.dateTemplate.includes("{date}")
				? this.settings.dateTemplate
				: DEFAULT_SETTINGS.dateTemplate,
			// An entry without "{date}" would match every line.
			oldDateTemplates: this.settings.oldDateTemplates.filter((t) => t.includes("{date}")),
			closedChars: this.settings.closedChars || DEFAULT_SETTINGS.closedChars,
			returnUnchecked,
			today: formatToday(),
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

	/** "Task status" with one item per status char, for the tasks in the cursor's line or the selection. */
	private addStatusMenu(menu: Menu, editor: Editor) {
		const from = editor.getCursor("from");
		const to = editor.getCursor("to");
		// A selection that ends at the start of a line does not take that line.
		const last = to.line > from.line && to.ch === 0 ? to.line - 1 : to.line;
		const lines: number[] = [];
		const current = new Set<string>();
		for (let i = from.line; i <= last; i++) {
			const status = taskStatus(editor.getLine(i));
			if (status === null) continue;
			lines.push(i);
			current.add(status);
		}
		if (lines.length === 0) return;

		let submenu: Menu | undefined;
		menu.addItem((item) => {
			item.setTitle(this.strings.menuTaskStatus).setIcon("square-check");
			// Submenus are not in the public API; without them the items go right into the menu.
			submenu = (item as MenuItem & { setSubmenu?: () => Menu }).setSubmenu?.();
		});
		for (const char of statusChars(this.settings.menuChars)) {
			(submenu ?? menu).addItem((item) =>
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
					.onClick(() =>
						// One transaction, so one undo step.
						editor.transaction({
							changes: lines.map((line) => {
								const text = editor.getLine(line);
								return {
									from: { line, ch: 0 },
									to: { line, ch: text.length },
									text: setTaskStatus(text, char) ?? text,
								};
							}),
						})
					)
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
