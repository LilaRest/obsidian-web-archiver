import WebArchiver from "./main";
import { PluginSettingTab, Setting, App } from "obsidian";

export const enum ArchivingProviders {
	InternetArchive,
  ArchiveIs,
  ArchiveBox
}

export interface WebArchiverSettings {
  archivedLinkText: string;
  archivingProvider: ArchivingProviders;
}

export const DEFAULT_SETTINGS: WebArchiverSettings = {
  archivedLinkText: '(📁)',
  archivingProvider: ArchivingProviders.InternetArchive
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

    // Archived URL's text
    new Setting(containerEl)
      .setName("Archived URL's text")
      .setDesc("Text displayed to represent the archived version of a web URL")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.archivedLinkText)
          .onChange(async (value) => {
            this.plugin.settings.archivedLinkText = value;
            await this.plugin.writeData();
          })
      );
    
    // 
    new Setting(containerEl)
			.setName('Web archiving provider')
			.setDesc('Tells the plugin which web archiving provider it must use.')
			.addDropdown((dropdown) => {
				const options: Record<ArchivingProviders, string> = {
					0: "Internet Archive (archive.org)",
					1: "ArchiveToday (archive.today / archive.is / archive.ph)",
					2: "ArchiveBox"
				};

				dropdown
					.addOptions(options)
					.setValue(this.plugin.settings.archivingProvider.toString())
					.onChange(async (value) => {
						this.plugin.settings.archivingProvider = +value;
						await this.plugin.writeData();
						this.display();
				})
			});
  }
}