import { Editor, MarkdownView, Notice, Plugin, moment } from "obsidian";
import { DEFAULT_SETTINGS, DoneMoverSettings, MoveOptions, MoveResult } from "./src/types";
import { DoneMoverSettingTab } from "./src/settings";
import { moveCompletedTasks } from "./src/mover";
import { calloutType } from "./src/taskParser";
import { isPathExcluded } from "./src/exclusions";
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

		this.addCommand({
			id: "move-completed-tasks",
			name: this.strings.cmdMoveCompleted,
			editorCallback: (editor) => this.runMoveCompleted(editor),
		});

		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor) => {
				menu.addItem((item) =>
					item
						.setTitle(this.strings.cmdMoveCompleted)
						.setIcon("check-check")
						.onClick(() => this.runMoveCompleted(editor))
				);
			})
		);

		this.registerEvent(
			this.app.workspace.on("editor-change", () => {
				if (this.settings.autoMode) this.scheduleAutoMove();
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
			closedChars: this.settings.closedChars || DEFAULT_SETTINGS.closedChars,
			returnUnchecked,
			today: formatToday(),
		};
	}

	private runMoveCompleted(editor: Editor) {
		const result = moveCompletedTasks(editor.getValue(), this.moveOptions(true));
		this.applyResult(editor, result);
		new Notice(
			result.movedCount + result.returnedCount > 0
				? this.strings.noticeMoved(result.movedCount, result.returnedCount)
				: this.strings.noticeNoCompleted
		);
	}

	private scheduleAutoMove() {
		if (this.autoTimer !== null) window.clearTimeout(this.autoTimer);
		this.autoTimer = window.setTimeout(() => {
			this.autoTimer = null;
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!view) return;
			if (isPathExcluded(view.file?.path ?? "", this.settings.excludedPaths)) return;
			const editor = view.editor;
			const result = moveCompletedTasks(editor.getValue(), this.moveOptions(false));
			if (result.movedCount > 0) {
				this.applyResult(editor, result);
				new Notice(this.strings.noticeAutoMoved(result.movedCount));
			}
		}, AUTO_MOVE_DEBOUNCE_MS);
	}

	/** Writes the new text back and keeps the cursor at a sensible position. */
	private applyResult(editor: Editor, result: MoveResult) {
		if (result.movedCount + result.returnedCount === 0) return;
		const cursor = editor.getCursor();
		editor.setValue(result.text);
		const line = Math.min(cursor.line, editor.lastLine());
		const ch = Math.min(cursor.ch, editor.getLine(line).length);
		editor.setCursor({ line, ch });
	}
}
