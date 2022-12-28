import WebArchiver from "./main";
import { PluginSettingTab, Setting, App } from "obsidian";

export interface WebArchiverSettings {
	archivedLinkTest: string;
}

export const DEFAULT_SETTINGS: WebArchiverSettings = {
	archivedLinkTest: '(📁)'
}

export class WebArchiverSettingsTab extends PluginSettingTab {
  plugin: WebArchiver;

  constructor(app: App, plugin: WebArchiver) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    let { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName("Archived URL's text")
      .setDesc("Text displayed to represent the archived version of a web URL")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.archivedLinkTest)
          .onChange(async (value) => {
            this.plugin.settings.archivedLinkTest = value;
            await this.plugin.saveSettings();
          })
      );
  }
}