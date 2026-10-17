import { App, PluginSettingTab, Setting } from "obsidian";
import type DoneMoverPlugin from "../main";
import { calloutType } from "./taskParser";
import { taskCharsFromCss } from "./taskChars";
import { createStatusIcon, statusChars } from "./statusIcon";
import { isDateTemplate, templateLines } from "./dateTemplate";
import { DatePosition } from "./types";

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

	/** The first date template when the tab was opened, to remember it once it changes. */
	private templateOnOpen = "";

	display(): void {
		const { containerEl } = this;
		const s = this.plugin.strings;
		containerEl.empty();
		containerEl.addClass("todo-manager-settings");
		this.templateOnOpen = templateLines(this.plugin.settings.dateTemplate)[0] ?? "";

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
	}

	// Done on close, not on every keystroke, so half-typed templates are not kept.
	hide(): void {
		super.hide();
		const settings = this.plugin.settings;
		const old = this.templateOnOpen;
		if (!old || templateLines(settings.dateTemplate).includes(old) || settings.oldDateTemplates.includes(old)) return;
		settings.oldDateTemplates = [...settings.oldDateTemplates, old];
		void this.plugin.saveSettings();
	}
}
