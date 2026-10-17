import { App, PluginSettingTab, Setting } from "obsidian";
import type DoneMoverPlugin from "../main";
import { calloutType } from "./taskParser";
import { taskCharsFromCss } from "./taskChars";
import { createStatusIcon, statusChars } from "./statusIcon";
import { isDateTemplate, templateLines } from "./dateTemplate";
import { CompleteTemplate, DatePosition } from "./types";

/** Marks a field whose input is not saved; styled in styles.css. */
function markInvalid(input: HTMLElement, invalid: boolean) {
	input.setAttribute("aria-invalid", String(invalid));
}

/** Text of all stylesheets loaded in the app: core, theme and CSS snippets. */
function loadedCss(): string {
	let css = "";
	for (const sheet of Array.from(document.styleSheets)) {
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

export class DoneMoverSettingTab extends PluginSettingTab {
	plugin: DoneMoverPlugin;

	constructor(app: App, plugin: DoneMoverPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		const s = this.plugin.strings;
		containerEl.empty();
		containerEl.addClass("todo-manager-settings");

		new Setting(containerEl).setName(s.headingMove).setHeading();

		new Setting(containerEl)
			.setName(s.settingAutoModeName)
			.setDesc(s.settingAutoModeDesc)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoMode).onChange(async (value) => {
					this.plugin.settings.autoMode = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName(s.settingCalloutName)
			.setDesc(s.settingCalloutDesc)
			.addText((text) =>
				text
					.setPlaceholder("> [!done]- Done")
					.setValue(this.plugin.settings.calloutHeader)
					.onChange(async (value) => {
						// Only a valid callout header is saved; partial input is ignored.
						const valid = calloutType(value.trim()) !== null;
						markInvalid(text.inputEl, !valid);
						if (!valid) return;
						this.plugin.settings.calloutHeader = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(s.settingClosedName)
			.setDesc(s.settingClosedDesc)
			.addText((text) =>
				text
					.setPlaceholder("xX-")
					.setValue(this.plugin.settings.closedChars)
					.onChange(async (value) => {
						// Spaces are dropped: "- [ ]" is always an open task.
						const chars = value.replace(/\s/g, "");
						markInvalid(text.inputEl, chars === "");
						if (chars === "") return;
						this.plugin.settings.closedChars = chars;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(s.settingDateName)
			.setDesc(s.settingDateDesc)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.appendCompletionDate)
					.onChange(async (value) => {
						this.plugin.settings.appendCompletionDate = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(s.settingExcludedName)
			.setDesc(s.settingExcludedDesc)
			.addTextArea((text) => {
				text
					.setPlaceholder("Templates\nArchiv/2025\nDaily/Scratch.md")
					.setValue(this.plugin.settings.excludedPaths.join("\n"))
					.onChange(async (value) => {
						this.plugin.settings.excludedPaths = templateLines(value);
						await this.plugin.saveSettings();
					});
				text.inputEl.rows = 4;
			});

		new Setting(containerEl).setName(s.headingDate).setHeading();

		new Setting(containerEl)
			.setName(s.settingDatePositionName)
			.setDesc(s.settingDatePositionDesc)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("start", s.datePositionStart)
					.addOption("end", s.datePositionEnd)
					.setValue(this.plugin.settings.datePosition)
					.onChange(async (value) => {
						this.plugin.settings.datePosition = value as DatePosition;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(s.settingDateTemplateName)
			.setDesc(s.settingDateTemplateDesc)
			.addTextArea((text) => {
				text
					.setPlaceholder("<small>[{YYYY-MM-DD}]</small>\n[{MM.YYYY}]")
					.setValue(this.plugin.settings.dateTemplate)
					.onChange(async (value) => {
						// Only templates with a date format are saved; partial input is ignored.
						const lines = templateLines(value);
						const valid = lines.length > 0 && lines.every(isDateTemplate);
						markInvalid(text.inputEl, !valid);
						if (!valid) return;
						this.plugin.settings.dateTemplate = lines.join("\n");
						await this.plugin.saveSettings();
					});
				text.inputEl.rows = 3;
			});

		new Setting(containerEl).setName(s.headingStatusMenu).setHeading();

		const menuChars = new Setting(containerEl).setName(s.settingMenuCharsName).setDesc(s.settingMenuCharsDesc);
		const preview = menuChars.descEl.createDiv("todo-manager-status-preview");
		menuChars
			.addText((text) => {
				text.setValue(this.plugin.settings.menuChars.replace(/\s/g, "")).onChange(async (value) => {
					// Spaces are dropped: the open status is always offered anyway.
					const chars = value.replace(/\s/g, "");
					renderStatusPreview(preview, chars);
					markInvalid(text.inputEl, chars === "");
					if (chars === "") return;
					this.plugin.settings.menuChars = chars;
					await this.plugin.saveSettings();
				});
				menuChars.addButton((button) =>
					button.setButtonText(s.buttonFromTheme).onClick(() => {
						text.setValue(taskCharsFromCss(loadedCss(), this.plugin.settings.closedChars));
						text.onChanged();
					})
				);
			});
		renderStatusPreview(preview, this.plugin.settings.menuChars);

		new Setting(containerEl).setName(s.headingCompleteTemplates).setHeading();

		new Setting(containerEl).setDesc(s.settingCompleteTemplatesDesc).addButton((button) =>
			button.setButtonText(s.buttonAddTemplate).onClick(async () => {
				const template: CompleteTemplate = {
					name: "",
					char: "x",
					dateTemplate: "",
					datePosition: this.plugin.settings.datePosition,
					move: true,
				};
				// A new array: the one of the defaults must stay empty.
				this.plugin.settings.completeTemplates = [...this.plugin.settings.completeTemplates, template];
				await this.plugin.saveSettings();
				this.display();
			})
		);
		for (const template of this.plugin.settings.completeTemplates) this.renderCompleteTemplate(containerEl, template);
	}

	/** Moves the template one place up (-1) or down (1) in the list and in the menu. */
	private async moveCompleteTemplate(template: CompleteTemplate, step: -1 | 1) {
		const list = [...this.plugin.settings.completeTemplates];
		const i = list.indexOf(template);
		const j = i + step;
		if (i < 0 || j < 0 || j >= list.length) return;
		[list[i], list[j]] = [list[j], list[i]];
		this.plugin.settings.completeTemplates = list;
		await this.plugin.saveSettings();
		this.display();
	}

	/** The fields of one complete template in a frame. Invalid input is not saved. */
	private renderCompleteTemplate(parent: HTMLElement, template: CompleteTemplate) {
		const s = this.plugin.strings;
		const el = parent.createDiv("todo-manager-complete-template");

		new Setting(el)
			.setName(s.settingTemplateNameName)
			.addText((text) => {
				markInvalid(text.inputEl, template.name === "");
				text.setValue(template.name).onChange(async (value) => {
					const name = value.trim();
					markInvalid(text.inputEl, name === "");
					if (name === "") return;
					template.name = name;
					await this.plugin.saveSettings();
				});
			})
			.addExtraButton((button) =>
				button
					.setIcon("arrow-up")
					.setTooltip(s.buttonMoveUp)
					.setDisabled(this.plugin.settings.completeTemplates[0] === template)
					.onClick(() => this.moveCompleteTemplate(template, -1))
			)
			.addExtraButton((button) =>
				button
					.setIcon("arrow-down")
					.setTooltip(s.buttonMoveDown)
					.setDisabled(this.plugin.settings.completeTemplates.at(-1) === template)
					.onClick(() => this.moveCompleteTemplate(template, 1))
			)
			.addExtraButton((button) =>
				button
					.setIcon("trash-2")
					.setTooltip(s.buttonDeleteTemplate)
					.onClick(async () => {
						this.plugin.settings.completeTemplates = this.plugin.settings.completeTemplates.filter((t) => t !== template);
						await this.plugin.saveSettings();
						this.display();
					})
			);

		new Setting(el)
			.setName(s.settingTemplateCharName)
			.setDesc(s.settingTemplateCharDesc)
			.addText((text) => {
				text.inputEl.maxLength = 1;
				text.setValue(template.char).onChange(async (value) => {
					const char = value.trim();
					markInvalid(text.inputEl, char === "");
					if (char === "") return;
					template.char = char;
					await this.plugin.saveSettings();
				});
			});

		new Setting(el)
			.setName(s.settingTemplateDateName)
			.setDesc(s.settingTemplateDateDesc)
			.addText((text) =>
				text
					.setValue(template.dateTemplate)
					.onChange(async (value) => {
						const date = value.trim();
						const valid = date === "" || isDateTemplate(date);
						markInvalid(text.inputEl, !valid);
						if (!valid) return;
						template.dateTemplate = date;
						await this.plugin.saveSettings();
					})
			);

		new Setting(el).setName(s.settingDatePositionName).addDropdown((dropdown) =>
			dropdown
				.addOption("start", s.datePositionStart)
				.addOption("end", s.datePositionEnd)
				.setValue(template.datePosition)
				.onChange(async (value) => {
					template.datePosition = value as DatePosition;
					await this.plugin.saveSettings();
				})
		);

		new Setting(el)
			.setName(s.settingTemplateMoveName)
			.setDesc(s.settingTemplateMoveDesc)
			.addToggle((toggle) =>
				toggle.setValue(template.move).onChange(async (value) => {
					template.move = value;
					await this.plugin.saveSettings();
				})
			);
	}
}
