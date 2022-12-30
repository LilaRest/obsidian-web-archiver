import WebArchiver from "./main";
import { PluginSettingTab, Setting, App, setIcon } from "obsidian";
import { FolderSuggest } from "./suggesters/FolderSuggester";

export const enum ArchivingProviders {
	InternetArchive,
  ArchiveToday,
  ArchiveBox
}

export const enum NoticesStyles {
  Normal,
  Minimal,
  IconsOnly,
  Hidden
}

export interface WebArchiverSettings {
  archiveFileParentFolder: string;
  archiveFileName: string;
  archiveFilePath: string;
  archivingProvider: ArchivingProviders;
  archiveBoxFqdn: string;
  archivedLinkText: string;
  noticesStyle: NoticesStyles;
}

export const DEFAULT_SETTINGS: WebArchiverSettings = {
  archiveFileParentFolder: "/",
  archiveFileName: "WebArchiver",
  archiveFilePath: "/WebArchiver",
  archivingProvider: ArchivingProviders.InternetArchive,
  archiveBoxFqdn: "",
  archivedLinkText: "(📁)",
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
    containerEl.createEl("h2", { text: "Archive file", cls: "settings-header" });
    const archiveFileSectionDesc = containerEl.createEl("div", {cls: "settings-section-description"});
    setIcon(archiveFileSectionDesc.createSpan(), "info")
    archiveFileSectionDesc.createSpan({ text: "In order to provide clutter-free archive links, the Web Archiver plugin stores all the archive URLs into a single big archive file. This section allows you to configure where that file must be stored." })

    // Archive file: Parent folder
    new Setting(containerEl)
      .setName("Archive file > Parent folder")
      .setDesc("Defines the folder in which is stored the archive file.")
      .addSearch((cb) => {
          new FolderSuggest(cb.inputEl);
          cb.setPlaceholder("Example: folder1/folder2")
              .setValue(this.plugin.settings.archiveFileParentFolder)
              .onChange((new_folder) => {
                this.plugin.settings.archiveFileParentFolder = new_folder;
                this.plugin.writeData();
                updateFilePathPreview.call(this)
              });
          // @ts-ignore
          cb.containerEl.addClass("templater_search");
      });
    
    // Archive file: Name
    new Setting(containerEl)
        .setName("Archive file > Name")
        .setDesc("Defines the name of the archive file. If it doesn't exist it will be created automatically.")
        .addText((text) =>
          text
            .setPlaceholder("WebArchiver")
            .setValue(this.plugin.settings.archiveFileName)
            .onChange(async (value) => {
              this.plugin.settings.archiveFileName = value;
              await this.plugin.writeData();
              updateFilePathPreview.call(this)
            })
      )

    containerEl.createDiv({ cls: ["settings-preview", "settings-archive-file-path-preview"] }).innerHTML = `
      <h3>Preview</h3>
      <main>
        <span>Your archive file is actually stored at : &nbsp; <span class="dynamic"></span></span>
      </main>
    `;
    
    const dynamicEl = containerEl.querySelector(".settings-archive-file-path-preview span.dynamic");
    function updateFilePathPreview() {
      if (dynamicEl) {
        const archiveFilePath = this.plugin.settings.archiveFileParentFolder + (this.plugin.settings.archiveFileParentFolder.slice(-1) === "/" ? "" : "/") +  this.plugin.settings.archiveFileName + (this.plugin.settings.archiveFileName.slice(-3) === ".md" ? "" : ".md")
        dynamicEl.innerHTML = archiveFilePath;
      }
    }
    updateFilePathPreview.call(this)
     
    containerEl.createEl("h2", { text: "Providers", cls: "settings-header" });
    const providersSectionDesc = containerEl.createEl("div", {cls: "settings-section-description"});
    setIcon(providersSectionDesc.createSpan(), "info")
    providersSectionDesc.createSpan({ text: "The Web Archiver plugin send every URL you paste in your vault to a web archiving service provider. This section allows you to define to which providers the Web Archiver must send your pasted URLs." })
    
    // Web archiving provider
    new Setting(containerEl)
      .setName('Enabled providers')
      .setDesc('Tells the plugin which web archiving provider it must use.')
      .addDropdown((dropdown) => {
        const options: Record<ArchivingProviders, string> = {
          0: "Internet Archive (archive.org)",
          1: "Archive Today (archive.ph)",
          2: "ArchiveBox (self-hosted)"
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
    
    // ArchiveBox specific settings
    if (this.plugin.settings.archivingProvider === ArchivingProviders.ArchiveBox) {

      // ArchiveBox server domain
      new Setting(containerEl)
        .setName("ArchiveBox server's domain")
        .setDesc("The FQDN of your self-hosted instance of ArchiveBox")
        .addText((text) =>
          text
            .setPlaceholder("archive.mydomain.com")
            .setValue(this.plugin.settings.archiveBoxFqdn)
            .onChange(async (value) => {
              this.plugin.settings.archiveBoxFqdn = value;
              await this.plugin.writeData();
            })
        );
    }

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
    HiddenPoint.createEl("span", { text: "no notice messages" })

    // Support section's title
    containerEl.createEl("h2", { text: "Support my work", cls: "settings-header" });

    // Support message
    containerEl.createEl("p", { text: "That plugin is provided for free to everyone under the MIT license. If it has been helpful to you, you can thank me for free by :" })
    const supportMethods = containerEl.createEl("ul");
    supportMethods.createEl("li", { text: "Following me on Twitter " }).createEl("a", { href: "https://twitter.com/LilaRest", text: "twitter.com/LilaRest"})
    supportMethods.createEl("li", { text: "Following me on Github " }).createEl("a", { href: "https://github.com/LilaRest", text: "github.com/LilaRest"})
    supportMethods.createEl("li", { text: "Starring that plugin " }).createEl("a", { href: "https://github.com/LilaRest/obsidian-web-archiver", text: "LilaRest/obsidian-web-archiver" })
    containerEl.createEl("p", { text: "Also, I accept donations on my personal website : " }).createEl("a", { href: "https://lila.rest/donations", text: "https://lila.rest/donations"})
  }
}