import WebArchiver from "./main";
import { PluginSettingTab, Setting, App } from "obsidian";

export const enum ArchivingProviders {
	InternetArchive,
  ArchiveIs,
  ArchiveBox
}

export const enum NoticesStyles {
  Normal,
  Minimal,
  Hidden
}

export interface WebArchiverSettings {
  archivedLinkText: string;
  archivingProvider: ArchivingProviders;
  noticesStyle: NoticesStyles;
}

export const DEFAULT_SETTINGS: WebArchiverSettings = {
  archivedLinkText: '(📁)',
  archivingProvider: ArchivingProviders.InternetArchive,
  noticesStyle: NoticesStyles.Normal
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

    // Settings' section title
    containerEl.createEl("h2", { text: "Settings" });
    
    // Archived URL's text
    new Setting(containerEl)
      .setName("Archive URLs' text")
      .setDesc("Text displayed to represent the archived version of a web URL")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.archivedLinkText)
          .onChange(async (value) => {
            this.plugin.settings.archivedLinkText = value;
            await this.plugin.writeData();
          })
      );
    
    // Web archiving provider
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
    
    // Notices style
    new Setting(containerEl)
      .setName('Notices style')
      .setDesc('The plugin will display notice to inform you about the states of the archiving processes. With this dropdown you can impact how those notices are displayed')
      .addDropdown((dropdown) => {
        const options: Record<NoticesStyles, string> = {
          0: "Normal",
          1: "Minimal",
          2: "Hidden"
        };
        dropdown
          .addOptions(options)
          .setValue(this.plugin.settings.noticesStyle.toString())
          .onChange(async (value) => {
            this.plugin.settings.noticesStyle = +value;
            await this.plugin.writeData();
            this.display();
          })
      });
    
    // Notices styles explanation
    const availableStyles = containerEl.createEl("ul");
    availableStyles.createEl("li", { text: 'Normal: Long format message, e.g.'})

    // Support section's title
    containerEl.createEl("h2", { text: "Support ❤️" });

    // Support message
    containerEl.createEl("p", { text: "That plugin is provided for free for everyone under the MIT license. If it has been helpful to you, please thank me by :" })
    const supportMethods = containerEl.createEl("ul");
    supportMethods.createEl("li", { text: "Following me on Github " }).createEl("a", { href: "https://github.com/LilaRest", text: "@LilaRest"})
    supportMethods.createEl("li", { text: "Giving a like to that plugin " }).createEl("a", { href: "https://github.com/LilaRest/obsidian-web-archiver", text: "LilaRest/obsidian-web-archiver" })
    supportMethods.createEl("li", { text: "Following me on Twitter " }).createEl("a", { href: "https://twitter.com/LilaRest", text: "@LilaRest"})
    
    // and give a like to the plugin repo(https://aaa.fr)")
  }
}