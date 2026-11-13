import { App, Modal, Notice, PluginSettingTab, Setting, SettingDefinitionItem } from "obsidian";
import type TodoManagerPlugin from "../main";
import { calloutType } from "./taskParser";
import { taskCharsFromCss } from "./taskChars";
import { createStatusIcon, statusChars } from "./statusIcon";
import { isDateTemplate, templateLines } from "./dateTemplate";
import { CompleteTemplate, DatePosition, TodoManagerSettings } from "./types";

/** Marks a field whose input is not saved; styled in styles.css. */
function markInvalid(input: HTMLElement, invalid: boolean) {
	input.setAttribute("aria-invalid", String(invalid));
}

/** Text of all stylesheets loaded in the app: core, theme and CSS snippets. */
function loadedCss(): string {
	let css = "";
	for (const sheet of Array.from(activeDocument.styleSheets)) {
		try {
			for (const rule of Array.from(sheet.cssRules)) css += rule.cssText + "\n";
		} catch {
			// A stylesheet from another origin cannot be read.
		}
	}
	return css;
}

/** A row of task checkboxes, the open one and one per char, drawn by the theme's styles. */
function renderStatusPreview(el: HTMLElement, chars: string) {
	el.empty();
	for (const char of statusChars(chars)) createStatusIcon(el, char);
}

/** How the input of a text field is stored; the other fields are stored as they come. */
const STORED: Partial<Record<keyof TodoManagerSettings, (value: string) => unknown>> = {
	calloutHeader: (v) => v.trim(),
	// Spaces are dropped: "- [ ]" is always an open task.
	closedChars: (v) => v.replace(/\s/g, ""),
	excludedPaths: templateLines,
	dateTemplate: (v) => templateLines(v).join("\n"),
};

export class TodoManagerSettingTab extends PluginSettingTab {
	plugin: TodoManagerPlugin;

	constructor(app: App, plugin: TodoManagerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.containerEl.addClass("todo-manager-settings");
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const s = this.plugin.strings;
		const datePositions = { start: s.datePositionStart, end: s.datePositionEnd };
		return [
			{
				type: "group",
				heading: s.headingMove,
				cls: "todo-manager-group-move",
				items: [
					{ name: s.settingAutoModeName, desc: s.settingAutoModeDesc, control: { type: "toggle", key: "autoMode" } },
					{
						name: s.settingCalloutName,
						desc: s.settingCalloutDesc,
						control: {
							type: "text",
							key: "calloutHeader",
							placeholder: "> [!done]- Done",
							validate: (v) => (calloutType(v.trim()) === null ? s.errorCallout : undefined),
						},
					},
					{
						name: s.settingClosedName,
						desc: s.settingClosedDesc,
						control: {
							type: "text",
							key: "closedChars",
							placeholder: "xX-",
							validate: (v) => (v.trim() === "" ? s.errorEmpty : undefined),
						},
					},
					{
						name: s.settingExcludedName,
						desc: s.settingExcludedDesc,
						control: { type: "textarea", key: "excludedPaths", placeholder: "Templates\nArchiv/2025\nDaily/Scratch.md", rows: 4 },
					},
				],
			},
			{
				type: "group",
				heading: s.headingDate,
				cls: "todo-manager-group-date",
				items: [
					{
						name: s.settingDatePositionName,
						desc: s.settingDatePositionDesc,
						control: { type: "dropdown", key: "datePosition", options: datePositions },
					},
					{
						name: s.settingDateTemplateName,
						desc: s.settingDateTemplateDesc,
						control: {
							type: "textarea",
							key: "dateTemplate",
							placeholder: "<small>[{YYYY-MM-DD}]</small>\n[{MM.YYYY}]",
							rows: 3,
							validate: (v) => {
								const lines = templateLines(v);
								return lines.length > 0 && lines.every(isDateTemplate) ? undefined : s.errorDateTemplates;
							},
						},
					},
				],
			},
			{
				type: "group",
				heading: s.headingStatusMenu,
				items: [{ name: s.settingMenuCharsName, desc: s.settingMenuCharsDesc, render: (setting) => this.renderMenuChars(setting) }],
			},
			{
				type: "list",
				heading: s.headingCompleteTemplates,
				// Rows with an action, not pages: Obsidian adds the delete and drag buttons only to such rows.
				items: this.plugin.settings.completeTemplates.map((t) => ({
					name: t.name,
					action: () => new CompleteTemplateModal(this, t).open(),
				})),
				addItem: { name: s.buttonAddTemplate, action: () => void this.addCompleteTemplate() },
				onReorder: (from, to) => void this.moveCompleteTemplate(from, to),
				onDelete: (i) => void this.deleteCompleteTemplate(i),
			},
			{
				// Under the list: a row above it would part the "+" from the heading.
				// Obsidian skips a row without a control, an action or render, so the description gets an empty render.
				type: "group",
				items: [{ name: "", desc: s.settingCompleteTemplatesDesc, render: () => undefined }],
			},
		];
	}

	getControlValue(key: string): unknown {
		// The textarea shows one path per line.
		if (key === "excludedPaths") return this.plugin.settings.excludedPaths.join("\n");
		return this.plugin.settings[key as keyof TodoManagerSettings];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const store = STORED[key as keyof TodoManagerSettings];
		(this.plugin.settings as unknown as Record<string, unknown>)[key] = store && typeof value === "string" ? store(value) : value;
		await this.plugin.saveSettings();
	}

	/** The status chars field with a preview of the checkboxes and the "From theme" button. */
	private renderMenuChars(setting: Setting) {
		const s = this.plugin.strings;
		const preview = setting.descEl.createDiv("todo-manager-status-preview");
		renderStatusPreview(preview, this.plugin.settings.menuChars);
		setting.addText((text) => {
			text.setValue(this.plugin.settings.menuChars.replace(/\s/g, "")).onChange(async (value) => {
				// Spaces are dropped: the open status is always offered anyway.
				const chars = value.replace(/\s/g, "");
				renderStatusPreview(preview, chars);
				markInvalid(text.inputEl, chars === "");
				if (chars === "") return;
				this.plugin.settings.menuChars = chars;
				await this.plugin.saveSettings();
			});
			setting.addButton((button) =>
				button.setButtonText(s.buttonFromTheme).onClick(() => {
					text.setValue(taskCharsFromCss(loadedCss(), this.plugin.settings.closedChars));
					text.onChanged();
				})
			);
		});
	}

	/** Saves the new list of complete templates and redraws the settings. */
	private async setCompleteTemplates(templates: CompleteTemplate[]) {
		this.plugin.settings.completeTemplates = templates;
		await this.plugin.saveSettings();
		this.update();
	}

	private async addCompleteTemplate() {
		const template: CompleteTemplate = {
			name: this.plugin.strings.newTemplateName,
			char: "x",
			dateTemplate: "",
			datePosition: this.plugin.settings.datePosition,
			move: true,
		};
		// A new array: the one of the defaults must stay empty.
		await this.setCompleteTemplates([...this.plugin.settings.completeTemplates, template]);
		new CompleteTemplateModal(this, template).open();
	}

	private async moveCompleteTemplate(from: number, to: number) {
		const list = [...this.plugin.settings.completeTemplates];
		list.splice(to, 0, ...list.splice(from, 1));
		await this.setCompleteTemplates(list);
	}

	private async deleteCompleteTemplate(index: number) {
		const list = this.plugin.settings.completeTemplates;
		if (list[index]?.builtin) {
			new Notice(this.plugin.strings.noticeBuiltinTemplate);
			return;
		}
		await this.setCompleteTemplates(list.filter((_, i) => i !== index));
	}
}

/** The fields of one complete template in a window. Invalid input is not saved. */
class CompleteTemplateModal extends Modal {
	constructor(
		private tab: TodoManagerSettingTab,
		private template: CompleteTemplate
	) {
		super(tab.app);
	}

	onOpen() {
		const { plugin } = this.tab;
		const s = plugin.strings;
		const t = this.template;
		const el = this.contentEl;
		this.setTitle(t.name);

		/** A text field of the template; `check` returns the error for the trimmed input. */
		const text = (setting: Setting, field: "name" | "char" | "dateTemplate", check: (v: string) => string | undefined) =>
			setting.addText((c) =>
				c.setValue(t[field]).onChange(async (value) => {
					const error = check(value.trim());
					setting.setErrorMessage(error ?? null);
					if (error) return;
					t[field] = value.trim();
					await plugin.saveSettings();
				})
			);

		const name = new Setting(el).setName(s.settingTemplateNameName);
		text(name, "name", (v) => (v === "" ? s.errorEmpty : undefined));
		// The built-in template keeps the name of the interface language.
		name.setDisabled(!!t.builtin);

		text(new Setting(el).setName(s.settingTemplateCharName).setDesc(s.settingTemplateCharDesc), "char", (v) =>
			Array.from(v).length === 1 ? undefined : s.errorOneChar
		);
		text(new Setting(el).setName(s.settingTemplateDateName).setDesc(s.settingTemplateDateDesc), "dateTemplate", (v) =>
			v === "" || isDateTemplate(v) ? undefined : s.errorDateTemplate
		);

		new Setting(el).setName(s.settingDatePositionName).addDropdown((dropdown) =>
			dropdown
				.addOption("start", s.datePositionStart)
				.addOption("end", s.datePositionEnd)
				.setValue(t.datePosition)
				.onChange(async (value) => {
					t.datePosition = value as DatePosition;
					await plugin.saveSettings();
				})
		);

		new Setting(el)
			.setName(s.settingTemplateMoveName)
			.setDesc(s.settingTemplateMoveDesc)
			.addToggle((toggle) =>
				toggle.setValue(t.move).onChange(async (value) => {
					t.move = value;
					await plugin.saveSettings();
				})
			);
	}

	onClose() {
		this.contentEl.empty();
		// The list shows the new name.
		this.tab.update();
	}
}
