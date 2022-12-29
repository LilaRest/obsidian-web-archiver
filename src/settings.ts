import WebArchiver from "./main";
import { PluginSettingTab, Setting, App } from "obsidian";

export const enum ArchivingProviders {
	InternetArchive,
  ArchiveToday
}

export const enum NoticesStyles {
  Normal,
  Minimal,
  IconsOnly,
  Hidden
}

export interface WebArchiverSettings {
  archivingProvider: ArchivingProviders;
  archivedLinkText: string;
  noticesStyle: NoticesStyles;
}

export const DEFAULT_SETTINGS: WebArchiverSettings = {
  archivedLinkText: "(📁)",
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
    containerEl.createEl("h2", { text: "Settings", cls: "settings-header" });
    
    // Web archiving provider
    new Setting(containerEl)
      .setName('Web archiving provider')
      .setDesc('Tells the plugin which web archiving provider it must use.')
      .addDropdown((dropdown) => {
        const options: Record<ArchivingProviders, string> = {
          0: "Internet Archive (archive.org)",
          1: "Archive Today (archive.ph)"
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
    
    // Settings' section title
    containerEl.createEl("h2", { text: "Appearance", cls: "settings-header" });
    
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

    // Notices style
    new Setting(containerEl)
      .setName('Notices style')
      .setDesc('The plugin will display notice messages to inform you about the states of the archiving processes. With this dropdown you can choose how those notices will be displayed')
      .addDropdown((dropdown) => {
        const options: Record<NoticesStyles, string> = {
          0: "Normal",
          1: "Minimal",
          2: "Icons only",
          3: "Hidden"
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
    const NormalPoint = availableStyles.createEl("li")
    NormalPoint.createEl("strong", { text: "Normal : " })
    NormalPoint.createEl("span", {text: "detailed notice messages, e.g." })
    NormalPoint.createEl("div", { text: "📁 Web Archiver: Pasted URL successfully queued for archiving. The archived content may take several minutes to be available.", cls: ["settings-notice-message", "notice"]})
    
    const MinimalPoint = availableStyles.createEl("li")
    MinimalPoint.createEl("strong", { text: "Minimal : " })
    MinimalPoint.createEl("span", { text: "minimalist notice messages, e.g." })
    MinimalPoint.createEl("div", { text: "📁 Web Archiver: Queued.", cls: ["settings-notice-message", "notice"]})
    
    const NoTextPoint = availableStyles.createEl("li")
    NoTextPoint.createEl("strong", { text: "Icons only : " })
    NoTextPoint.createEl("span", {text: "only icons used in notice messages, e.g." })
    NoTextPoint.createEl("div", { text: '📁 : ✅', cls: ["settings-notice-message", "notice"]})
    
    const HiddenPoint = availableStyles.createEl("li")
    HiddenPoint.createEl("strong", { text: "Hidden : " })
    HiddenPoint.createEl("span", {text: "no notice messages" })
  }
}