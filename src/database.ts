import { Editor, MarkdownView, Notice, TFile } from "obsidian";
import { arch } from "os";
import WebArchiver from "./main";

export enum ArchiveStatus {
  NotStarted = "not-started",
  Requested = "requested",
  Error = "error",
  Archived = "archived"
}

export interface Archive {
  archive: string,
  status: ArchiveStatus,
  errCode: number
}

export const DEFAULT_ARCHIVE: Archive = {
  archive: "not available yet",
  status: ArchiveStatus.NotStarted,
  errCode: 0
}

export interface ArchivedUrl {
  url: string,
  datetime: string,
  internetArchive: Archive,
  archiveToday: Archive,
  archiveBox: Archive
}

interface DatabaseData {
  [index: string]: ArchivedUrl;
}

export class WebArchiverDatabase {
  plugin: WebArchiver;
  _data: DatabaseData;
  data: DatabaseData;
  lastTimeout: any;
  
  constructor (plugin: WebArchiver) {
    this.plugin = plugin;
    this._data = {};
  }

  async init() {
    // Load data from the archive file
    await this.load();

    // Set all "requested" and "error" status as "not-started"
		for (const [id, archivedUrl] of Object.entries(this._data)) {
			// Check Internet Archive's archive
			if ([ArchiveStatus.Requested, ArchiveStatus.Error].contains(archivedUrl.internetArchive.status)) this.setStatus(id, "internetArchive", ArchiveStatus.NotStarted);

			// Check Archive.today's archive
			if ([ArchiveStatus.Requested, ArchiveStatus.Error].contains(archivedUrl.archiveToday.status)) this.setStatus(id, "archiveToday", ArchiveStatus.NotStarted);

			// Check Archive.box's archive
			if ([ArchiveStatus.Requested, ArchiveStatus.Error].contains(archivedUrl.archiveBox.status)) this.setStatus(id, "archiveBox", ArchiveStatus.NotStarted);
		}

    // Set up auto-save for database
		this.lastTimeout = setTimeout(() => { }, 0);

		const dataProxy = {
			get: function (target: any, key: string): any {
				if (typeof target[key] === "object" && target[key] !== null) {
					if (key === "_target") return target;
					return new Proxy(target[key], dataProxy)
				}
				return target[key]
			}.bind(this),
			set: function (target: any, prop: string, value: any) {
				target[prop] = value;
				this.onDataChange();
				return true;
			}.bind(this)
		}
		this.data = new Proxy(this._data, dataProxy);
    
    // Make the archive file read-only
    const archiveFile = this.plugin.app.vault.getAbstractFileByPath(this.plugin.settings.get("archiveFilePath"));
    this.plugin.registerEvent((this.plugin.app.workspace.on("editor-change", function (editor: Editor, info: MarkdownView) {

      if (info.file === archiveFile) {
        console.log("a")
        editor.undo();
        console.log(this.plugin.app.workspace)
        new Notice("📁 Web Archiver: The archive-file is read-only.")
      }
    }.bind(this))))
  }

  onDataChange() {
    clearTimeout(this.lastTimeout);
    this.lastTimeout = setTimeout(async function () { await this.store() }.bind(this), 300);
  }

  async load() {
    // Get and create the archiveFile if it doesn't exist 
    let archiveFile = this.plugin.app.vault.getAbstractFileByPath(this.plugin.settings.get("archiveFilePath"));
    if (!archiveFile) archiveFile = await this.plugin.app.vault.create(this.plugin.settings.get("archiveFilePath"), ""); 

    // Convert the archive file as JSON
    // * Match all level 2 UID headings 
    let archiveFileContent = await this.plugin.app.vault.read(archiveFile)
    const markdownHeadings = [...archiveFileContent.matchAll(/^## [a-zA-Z0-9]{6}/gm)]

    // * Remove all line jumps
    archiveFileContent = archiveFileContent.replaceAll("\n", "");

    // * Replace markdown headings by JSON format
    for (const matchedString of markdownHeadings) {
      const markdownHeading = matchedString[0];
      let newHeading = markdownHeading.replace("## ", ', "') + '": ';
      archiveFileContent = archiveFileContent.replace(markdownHeading, newHeading);
    }

    // * Remove the two first chars
    archiveFileContent = archiveFileContent.substring(2);

    // * Surround the whole block with curly braces
    archiveFileContent = "{" + archiveFileContent + "}"; 

    // * Parse the database as JSON and store it in memory
    this._data = JSON.parse(archiveFileContent)
  }

  async store () {
    // Build nex text content
    let newTextContent = "";
    for (const [id, archivedUrl] of Object.entries(this._data)) {
      newTextContent += `## ${id.toString()}\n`;
      newTextContent += JSON.stringify(archivedUrl, null, 4);
      newTextContent += "\n";
    }
  
    // Get the archiveFile object
    let archiveFile = this.plugin.app.vault.getAbstractFileByPath(this.plugin.settings.get("archiveFilePath"));

    // Write the new text content
    this.plugin.app.vault.modify(archiveFile, newTextContent);
  }

  get(archiveUUID: string): ArchivedUrl {
    return this.data[archiveUUID];
  }

  setStatus(archiveId: string, archiveProvider: string, status: ArchiveStatus,     errorCode?: number) {
		if (archiveProvider === "internetArchive") {
			this._data[archiveId].internetArchive.status = status;
			this._data[archiveId].internetArchive.errCode = status === ArchiveStatus.Error ? errorCode ? errorCode : 0 : 0;
		}
		else if (archiveProvider === "archiveToday") {
			this._data[archiveId].archiveToday.status = status;
			this._data[archiveId].archiveToday.errCode = status === ArchiveStatus.Error ? errorCode ? errorCode : 0 : 0;
		}
		else if (archiveProvider === "archiveBox") {
			this._data[archiveId].archiveBox.status = status;
			this._data[archiveId].archiveBox.errCode = status === ArchiveStatus.Error ? errorCode ? errorCode : 0 : 0;
		}
		else {
			throw `Web Archiver: ERROR, setStatus() called with unsuported provider "${archiveProvider}"`
		}
	}
}

