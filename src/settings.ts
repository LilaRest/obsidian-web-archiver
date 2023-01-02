import WebArchiver from "./main";
import { PluginSettingTab, Setting, App, setIcon } from "obsidian";
import { FolderSuggest } from "./suggesters/FolderSuggester";

export const enum NoticesStyles {
  Normal,
  Minimal,
  IconsOnly,
  Hidden
}

export const DEFAULT_SETTINGS: SettingsData = {
  archiveFileParentFolder: "/",
  archiveFileName: "WebArchiver",
  archiveFilePath: "/WebArchiver.md",
  useInternetArchive: true,
  useArchiveToday: false,
  useArchiveBox: false,
  archiveBoxFqdn: "",
  archivedLinkText: "(📁)",
  noticesStyle: NoticesStyles.Normal
}

export interface SettingsData {
  archiveFileParentFolder: string;
  archiveFileName: string;
  archiveFilePath: string;
  useInternetArchive: boolean;
  useArchiveToday: boolean;
  useArchiveBox: boolean;
  archiveBoxFqdn: string;
  archivedLinkText: string;
  noticesStyle: NoticesStyles;
}

export class WebArchiverSettings {
  plugin: WebArchiver;
  _data: SettingsData;
  data: SettingsData;
  lastTimeout: any;


  constructor (plugin: WebArchiver) {
    this.plugin = plugin;
    this._data = {};
  }

  async init () {
    // Load data from the archive file
    await this.load();

    // Set up auto-save for database
		const dataProxy = {
			get: function (target: any, key: string): any {
				if (typeof target[key] === "object" && target[key] !== null) {
					if (key === "_target") return target;
					return new Proxy(target[key], dataProxy)
				}
				return target[key]
			}.bind(this),
			set: async function (target: any, prop: string, value: any) {
				target[prop] = value;
				await this.store();
				return true;
			}.bind(this)
		}
		this.data = new Proxy(this._data, dataProxy);
  }

  async load() {
    const data = await this.plugin.loadData();
    this._data = Object.assign({}, DEFAULT_SETTINGS, data.settings ? data.settings : {});		
  }

  async store() {
    await this.plugin.saveData({
      settings: this._data
    });
  }

  get(key: string): any {
    return this.data[key];
  }

  set(key: string, value: any) {
    this.data[key] = value;
  }
}



export class WebArchiverSettingsTab extends PluginSettingTab {
  plugin: WebArchiver;

  constructor(app: App, plugin: WebArchiver) {
    super(app, plugin);
    this.plugin = plugin;
  }

  async display(): Promise<void> {
    let { containerEl } = this;

    containerEl.empty();

    // Archive file section
    containerEl.createEl("h2", { text: "Archive file", cls: "settings-header" });
    const archiveFileSectionDesc = containerEl.createEl("div", {cls: "settings-section-description"});
    setIcon(archiveFileSectionDesc.createSpan(), "info")
    archiveFileSectionDesc.createSpan({ text: "In order to provide clutter-free archive links, the Web Archiver plugin stores all the archive URLs into a single big archive file. This section allows you to configure where that file must be stored." })

    // * Archive file: Parent folder
    new Setting(containerEl)
      .setName("Archive file > Parent folder")
      .setDesc("Defines the folder in which is stored the archive file.")
      .addSearch((cb) => {
          new FolderSuggest(cb.inputEl);
          cb.setPlaceholder("Example: folder1/folder2")
              .setValue(this.plugin.settings.get("archiveFileParentFolder"))
              .onChange((new_folder) => {
                this.plugin.settings.set("archiveFileParentFolder", new_folder);
                // storeSettings(this.plugin);
                updateFilePathPreview.call(this)
              });
          // @ts-ignore
          cb.containerEl.addClass("templater_search");
      });
    
    // * Archive file: Name
    new Setting(containerEl)
        .setName("Archive file > Name")
        .setDesc("Defines the name of the archive file. If it doesn't exist it will be created automatically.")
        .addText((text) =>
          text
            .setPlaceholder("WebArchiver")
            .setValue(this.plugin.settings.get("archiveFileName"))
            .onChange(async (value) => {
              this.plugin.settings.set("archiveFileName",value);
              // await storeSettings(this.plugin);
              await updateFilePathPreview.call(this)
            })
      )

    // * Archive file: Path + Path preview
    containerEl.createDiv({ cls: ["settings-preview", "settings-archive-file-path-preview"] }).innerHTML = `
      <h3>Preview</h3>
      <main>
        <div>Your archive file is actually stored at : &nbsp; <span class="dynamic"></span></div>
      </main>
    `;
    
    const dynamicEl = containerEl.querySelector(".settings-archive-file-path-preview span.dynamic");
    let lastTimeout = setTimeout(() => 0, 1);
    async function updateFilePathPreview() {
      if (dynamicEl) {
        if (lastTimeout) clearTimeout(lastTimeout);
        lastTimeout = setTimeout(async function () {
          const archiveFilePath = this.plugin.settings.get("archiveFileParentFolder") + (this.plugin.settings.get("archiveFileParentFolder").slice(-1) === "/" ? "" : "/") + this.plugin.settings.get("archiveFileName") + (this.plugin.settings.get("archiveFileName").slice(-3) === ".md" ? "" : ".md")
          dynamicEl.innerHTML = archiveFilePath;
          this.plugin.settings.set("archiveFilePath", archiveFilePath);
          // await storeSettings(this.plugin);
        }.bind(this), 200);
      }
    }
    await updateFilePathPreview.call(this)
    
    // Providers section
    containerEl.createEl("h2", { text: "Providers", cls: "settings-header" });
    const providersSectionDesc = containerEl.createEl("div", {cls: "settings-section-description"});
    setIcon(providersSectionDesc.createSpan(), "info")
    providersSectionDesc.createSpan({ text: "The Web Archiver plugin send every URL you paste in your vault to a web archiving service provider. This section allows you to define to which providers the Web Archiver must send your pasted URLs." })
    
    // * Providers list
    new Setting(containerEl)
      .setName('Providers > Use Internet Archive (archive.org) ?')
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.get("useInternetArchive"))
          .onChange(async (value) => {
            this.plugin.settings.set("useInternetArchive", value);
            // await storeSettings(this.plugin);
          })
      })
    
    new Setting(containerEl)
      .setName('Providers > Use Archive.today (archive.ph) ?')
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.get("useArchiveToday"))
          .onChange(async (value) => {
            this.plugin.settings.set("useArchiveToday", value);
            // await storeSettings(this.plugin);
          })
      })
    
    new Setting(containerEl)
      .setName('Providers > Use ArchiveBox (self-hosted) ?')
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.get("useArchiveBox"))
          .onChange(async (value) => {
            this.plugin.settings.set("useArchiveBox", value);
            // await storeSettings(this.plugin);
            this.display()
          })
      })
      
    // * ArchiveBox specific settings
    if (this.plugin.settings.get("useArchiveBox")) {

      // ArchiveBox server domain
      new Setting(containerEl)
        .setName("Providers > ArchiveBox > Server's domain")
        .setDesc("The FQDN of your self-hosted instance of ArchiveBox")
        .addText((text) =>
          text
            .setPlaceholder("archive.mydomain.com")
            .setValue(this.plugin.settings.get("archiveBoxFqdn"))
            .onChange(async (value) => {
              this.plugin.settings.set("archiveBoxFqdn", value);
              // await storeSettings(this.plugin);
            })
        );
    }

    // Appearance section
    containerEl.createEl("h2", { text: "Appearance", cls: "settings-header" });

    // * Apperance description
    const appearanceSectionDesc = containerEl.createEl("div", {cls: "settings-section-description"});
    setIcon(appearanceSectionDesc.createSpan(), "info")
    appearanceSectionDesc.createSpan({ text: "The Web Archiver plugin will insert archive link automatically and will notify you about archiving process through notice messages. This section allows you to configure how those elements will look like." })
    
    // * Apperance Archived URL's text
    new Setting(containerEl)
      .setName("Appearance > Archive URLs' text")
      .setDesc("Text displayed to represent the archived version of a web URL")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.get("archivedLinkText"))
          .onChange(async (value) => {
            this.plugin.settings.set("archivedLinkText",  value);
            // await storeSettings(this.plugin);
          })
      );

    // * Notices style
    new Setting(containerEl)
      .setName('Appearance > Notice messages style')
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
          .setValue(this.plugin.settings.get("noticesStyle").toString())
          .onChange(async (value) => {
            this.plugin.settings.set("noticesStyle",  +value);
            // await storeSettings(this.plugin);
            this.display();
            updateNoticePreview.call(this);
          })
      });
    
    // * Archive file: Path + Path preview
    const noticePreview = containerEl.createDiv({ cls: ["settings-preview", "settings-notice-preview"] });
    noticePreview.innerHTML = `
      <h3>Preview</h3>
      <main>
        <span>Your notice messages should look like :</span>
        <div class="dynamic notice"></div>
      </main>
    `;
    
    const noticePreviewDynamicEl = containerEl.querySelector(".settings-notice-preview div.dynamic");
    function updateNoticePreview() {
      if (noticePreviewDynamicEl) {

        if (this.plugin.settings.get("noticesStyle") === NoticesStyles.Normal) {
          noticePreview.style.display = "flex";
          noticePreviewDynamicEl.innerHTML = "📁 Web Archiver: Pasted URL successfully queued for archiving. The archived content may take several minutes to be available.";
        }
        else if (this.plugin.settings.get("noticesStyle") === NoticesStyles.Minimal) {
          noticePreview.style.display = "flex";
          noticePreviewDynamicEl.innerHTML = "📁 Web Archiver: Queued.";
        }
        else if (this.plugin.settings.get("noticesStyle") === NoticesStyles.IconsOnly) {
          noticePreview.style.display = "flex";
          noticePreviewDynamicEl.innerHTML = "📁 : ✅";
        }
        else if (this.plugin.settings.get("noticesStyle") === NoticesStyles.Hidden) {
          noticePreview.style.display = "none";
        }
      }
    }
    updateNoticePreview.call(this)

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