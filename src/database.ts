import { Editor, MarkdownView, Notice, TFile, request, moment } from "obsidian";
import { stringify } from "querystring";
import WebArchiver from "./main";
import { genUUID } from "./uuid" 


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
  writingOngoing: boolean;
  
  constructor (plugin: WebArchiver) {
    this.plugin = plugin;
    this._data = {};
    this.writingOngoing = false;
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
    this.plugin.registerEvent((this.plugin.app.workspace.on("editor-change", async function (editor: Editor, info: MarkdownView) {
      
      if (info.file === archiveFile && !this.writingOngoing) {
        this.writingOngoing = true;
        editor.undo();
        this.writingOngoing = false;
        this.plugin.notice("The archive-file is read-only.", "Read-only.", "👀")
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
    if (archiveFile instanceof TFile) { // Cast archiveFile to TFile, see: https://github.com/obsidianmd/obsidian-releases/blob/master/plugin-review.md#avoid-iterating-all-files-to-find-a-file-by-its-path
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
    let archiveFile =  this.plugin.app.vault.getAbstractFileByPath(this.plugin.settings.get("archiveFilePath"));

    // Write the new text content
    if (archiveFile instanceof TFile) { // Cast archiveFile to TFile, see: https://github.com/obsidianmd/obsidian-releases/blob/master/plugin-review.md#avoid-iterating-all-files-to-find-a-file-by-its-path
      this.writingOngoing = true;
      await this.plugin.app.vault.modify(archiveFile, newTextContent);
      this.writingOngoing = false;
    }
  }

  get(archiveUUID: string): ArchivedUrl {
    return this.data[archiveUUID];
  }
  
  async archive(url: string, archiveUUID?: string) {

    // Generate archive UUID if it isn't provided.
    archiveUUID = archiveUUID ? archiveUUID : genUUID(Object.keys(this.data));

    // If the UUID is not already in the database, store it
    if (!this.get(archiveUUID)) {
      this.data[archiveUUID] = {
        url: url,
        datetime: moment().format("YYYY-MM-DDTHH:mm:ss"),
        internetArchive: Object.assign({}, DEFAULT_ARCHIVE),
        archiveToday: Object.assign({}, DEFAULT_ARCHIVE),
        archiveBox: Object.assign({}, DEFAULT_ARCHIVE)
      }
    }

    // Initiate archiving processes asynchronously.
    this.archiveOnInternetArchive(archiveUUID);
    this.archiveOnArchiveToday(archiveUUID);
    this.archiveOnArchiveBox(archiveUUID);

    // Notice the user that the pasted URL has been successfully processed.
    this.plugin.notice("Pasted URL successfully queued for archiving. The archived content may take several minutes to be available.", "Queued.", "✅");
  }

  async archiveOnInternetArchive(archiveUUID: string) {

    const url = this.get(archiveUUID).url;
      
    // Archive on Internet Archive
    if (this.plugin.settings.get("useInternetArchive")) {
      if (this.get(archiveUUID).internetArchive.status === ArchiveStatus.NotStarted) {

        // Build the archive URL
        const archiveUrl = `https://web.archive.org/web/${moment().format("YYYYMMDDHHmm")}/${url}`;

        // Check if the URL is already archived
        request({ url: archiveUrl })
        
        // If it is, set its status to "archived"
        .then(async function (res) {
          this.setStatus(archiveUUID, "internetArchive", ArchiveStatus.Archived);
          this.get(archiveUUID).internetArchive.archive = archiveUrl;
        }.bind(this))
        
        // Else, continue archiving process
        .catch(async function (e: any) {
          
          // If the error code !== 404, store that one, notice, and abort the process 
          if (e.status !== 404) {
            this.setStatus(archiveUUID, "internetArchive", ArchiveStatus.Error, e.status);
            this.plugin.notice(`Archiving request returned a ${e.status} error. Will retry later, please ensure the archiving server is up.`, `${e.status} error.`, "❌");
            return;
          }
          
          // Else request for archiving the pasted URL
          else {

            // Build the request URL
            const requestUrl = "https://web.archive.org/save/" + url;

            // Send the request
            const saveReq = request(requestUrl)
              
            // Set the archive status as "requested"
            this.setStatus(archiveUUID, "internetArchive", ArchiveStatus.Requested)

            // If the request is successful, set the pasted URL status to "archived"
            saveReq.then(async function (res) {
              this.setStatus(archiveUUID, "internetArchive", ArchiveStatus.Archived)
              this.get(archiveUUID).internetArchive.archive = archiveUrl;
            }.bind(this))
          
            // Else if an error is returned, store that one, notice, and abort the process.
            .catch(async function (e: any) {
              this.setStatus(archiveUUID, "internetArchive", ArchiveStatus.Error, e.status);
              this.plugin.notice(`Archiving request returned a ${e.status} error. Will retry later, please ensure the archiving server is up.`, `${e.status} error.`, "❌");
              return;
            }.bind(this))
          }
        }.bind(this))
      }
    }
  }

  async archiveOnArchiveToday(archiveUUID: string) {

    const url = this.get(archiveUUID).url;

    // Archive on Archive.today
    if (this.plugin.settings.get("useArchiveToday")) {
      if (this.get(archiveUUID).archiveToday.status === ArchiveStatus.NotStarted) {

        // Build the archive URL
        const archiveUrl = `https://archive.ph/${moment().format("YYYYMMDDHHmm")}/${url}`;

        // Check if the URL is already archived
        request({ url: archiveUrl })
                    
        .then(async function (res) {
          // If it is, set its status to "archived"
          if (!res.contains("No results")) {
            this.setStatus(archiveUUID, "archiveToday", ArchiveStatus.Archived);
            this.get(archiveUUID).archiveToday.archive = archiveUrl;
          }
          
          // Else, continue archiving process
          else {
            // Build the request URL
            const requestUrl = "https://robustlinks.mementoweb.org/api/?archive=archive.today&url=" + url;

            // Send the request
            const saveReq = request(requestUrl)
              
            // Set the archive status as "requested"
            this.setStatus(archiveUUID, "archiveToday", ArchiveStatus.Requested)

            // If the request is successful, set the pasted URL status to "archived"
            saveReq.then(async function (res) {
              
              this.setStatus(archiveUUID, "archiveToday", ArchiveStatus.Archived)
              this.get(archiveUUID).archiveToday.archive = archiveUrl;
            }.bind(this))
        
            // Else if an error is returned, store that one, notice, and abort the process.
            .catch(async function (e: any) {
              this.setStatus(archiveUUID, "archiveToday", ArchiveStatus.Error, e.status);
              this.plugin.notice(`Archiving request returned a ${e.status} error. Will retry later, please ensure the archiving server is up.`, `${e.status} error.`, "❌");
              return;
            }.bind(this))
          }
        }.bind(this))
        
        // If an error is thrown:, store that one, notice, and abort the process
        .catch(async function (e: any) {
          this.setStatus(archiveUUID, "archiveToday", ArchiveStatus.Error, e.status);
          this.plugin.notice(`Archiving request returned a ${e.status} error. Will retry later, please ensure the archiving server is up.`, `${e.status} error.`, "❌");
          return;             
        }.bind(this))
      }
    }
  }

  async archiveOnArchiveBox(archiveUUID: string) {
    
    const url = this.get(archiveUUID).url;
    
		// Archive on ArchiveBox instance
		if (this.plugin.settings.get("useArchiveBox")) {
			if (this.get(archiveUUID).archiveBox.status === ArchiveStatus.NotStarted) {
				// Build the archive URL
				const archiveUrl = `https://${this.plugin.settings.get("archiveBoxFqdn")}/archive/${moment.now()}/${url}`;
			
				// Check if the URL is already archived
				request({ url: archiveUrl })
				
				// If it is, set its status to "archived"
				.then(async function (res) {
					this.setStatus(archiveUUID, "archiveBox", ArchiveStatus.Archived);
					this.get(archiveUUID).archiveBox.archive = archiveUrl;
				}.bind(this))
				
				// Else, continue archiving process
				.catch(async function (e: any) {
          console.log("Archive box error !")
					
					// If the error code !== 404, store that one, notice, and abort the process 
					if (e.status !== 404) {
						this.setStatus(archiveUUID, "archiveBox", ArchiveStatus.Error, e.status);
						this.plugin.notice(`Archiving request returned a ${e.status} error. Will retry later, please ensure the archiving server is up.`, `${e.status} error.`, "❌");
						return;
					}
					
					// Else request for archiving the pasted URL
					else {

						// Send the request
						const saveReq = request({
								"url": "https://archive.vuethers.org/add/",
								"method": "POST",
								"headers": {
									"Content-Type": "application/x-www-form-urlencoded",
								},
								"body": `url=${url}&parser=auto&tag=&depth=0`,
            })
              
            // Set the archive status as "requested"
            this.setStatus(archiveUUID, "archiveBox", ArchiveStatus.Requested)

						// If the request is successful, set the pasted URL status to "archived"
						saveReq.then(async function (res) {
							this.setStatus(archiveUUID, "archiveBox", ArchiveStatus.Archived)
							this.get(archiveUUID).archiveBox.archive = archiveUrl;
						}.bind(this))
					
						// Else if an error is returned, store that one, notice, and abort the process.
            .catch(async function (e: any) {
              console.log("Archive box error 2")
							this.setStatus(archiveUUID, "archiveBox", ArchiveStatus.Error, e.status);
							this.plugin.notice(`Archiving request returned a ${e.status} error. Will retry later, please ensure the archiving server is up.`, `${e.status} error.`, "❌");
							return;
						}.bind(this))
					}
				}.bind(this))
			}
		}
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

