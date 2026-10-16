import { App, PluginSettingTab, Setting } from "obsidian";
import type DoneMoverPlugin from "../main";
import { calloutType } from "./taskParser";

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
						if (calloutType(value.trim()) === null) return;
						this.plugin.settings.calloutHeader = value.trim();
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
						this.plugin.settings.excludedPaths = value
							.split("\n")
							.map((line) => line.trim())
							.filter((line) => line.length > 0);
						await this.plugin.saveSettings();
					});
				text.inputEl.rows = 4;
			});
	}
}
