/*
TODO:
- Add "Parse whole vault and archive all unarchived URLs" command
- Write the README.md
- Submit the plugins to the Obsidian's plugins list
- Set up CI/CD of releases with the Semantic Bot
- Make the archive file read-only by listening on change event on it and preventing the action
*/

import { Plugin, Editor, Notice, request, moment } from "obsidian";
import { WebArchiverSettings, WebArchiverSettingsTab } from "./settings";
import { WebArchiverDatabase, ArchivedUrl, ArchiveStatus, DEFAULT_ARCHIVE } from "./database";
import { urlRegex } from "./constants";
import { genUUID } from "./uuid" 


export default class WebArchiver extends Plugin {
	settings: WebArchiverSettings;
	database: WebArchiverDatabase;

	async onload() {
		this.app.workspace.onLayoutReady(async function () {
			// Print console message
			console.log(`Loading "Web Archiver 📁" plugin...`);

			// Initialize the settings instance
			this.settings = new WebArchiverSettings(this);
			await this.settings.init();

			// Initialize the settings tab
			this.addSettingTab(new WebArchiverSettingsTab(this.app, this))

			// Initialize the database instance
			this.database = new WebArchiverDatabase(this);
			await this.database.init();

			// Listen on every paste event
			this.registerEvent(this.app.workspace.on('editor-paste',
				async function (evt: ClipboardEvent, editor: Editor) {
					if (evt.clipboardData) {

						// Retrieve pasted text
						const pastedText = evt.clipboardData.getData("text/plain");

						// If the pasted text is an URL, send it to archiving queue
						if (urlRegex.test(pastedText)) {
							evt.preventDefault();

							// Generate archive UUID
							const archiveUUID = genUUID(Object.keys(this.database));
						
							// Build the archive link
							const archiveLink = `${pastedText} [${this.settings.get("archivedLinkText")}](${this.settings.get("archiveFileName")}#${archiveUUID})`

							// Append the archive link next to the pasted URL
							editor.replaceRange(archiveLink, editor.getCursor());

							// Move the cursor next to the archive link
							editor.setCursor(editor.getCursor().line, editor.getCursor().ch + archiveLink.length)
						
							await this.archiveUrl(pastedText, editor, archiveUUID);
						}
					}
				}.bind(this)));

			// Print console message
			console.log(`"Web Archiver 📁" successfully loaded.`);
		}.bind(this))
	}

	async archiveUrl(url: string, editor: Editor, uuid?: string) {

		// Generate archive UUID if it isn't provided.
		const archiveUUID = uuid ? uuid : genUUID(Object.keys(this.database));

		// If the URL is not already in the database, store it
		if (!Object.keys(this.database).contains(archiveUUID)) {
			this.database.data[archiveUUID] = {
				url: url,
				datetime: moment().format("YYYY-MM-DDTHH:mm:ss"),
				internetArchive: Object.assign({}, DEFAULT_ARCHIVE),
				archiveToday: Object.assign({}, DEFAULT_ARCHIVE),
				archiveBox: Object.assign({}, DEFAULT_ARCHIVE)
			}
		}

		// Archive on Internet Archive
		if (this.settings.get("useInternetArchive")) {
			if (this.database.get(archiveUUID).internetArchive.status === ArchiveStatus.NotStarted) {

				// Build the archive URL
				const archiveUrl = `https://web.archive.org/web/${moment().format("YYYYMMDDHHmm")}/${url}`;

				// Check if the URL is already archived
				request({ url: archiveUrl })
				
				// If it is, set its status to "archived"
				.then(async function (res) {
					this.database.setStatus(archiveUUID, "internetArchive", ArchiveStatus.Archived);
					this.database.get(archiveUUID).internetArchive.archive = archiveUrl;
				}.bind(this))
				
				// Else, continue archiving process
				.catch(async function (e) {
					
					// If the error code !== 404, store that one, notice, and abort the process 
					if (e.status !== 404) {
						this.database.setStatus(archiveUUID, "internetArchive", ArchiveStatus.Error, e.status);
						this.notice(`📁 Web Archiver: Archiving request returned a ${e.status} error. Will retry later, please ensure the archiving server is up.`, `📁 Web Archiver: ${e.status} error.`, "📁 : ❌");
						return;
					}
					
					// Else request for archiving the pasted URL
					else {

						// Build the request URL
						const requestUrl = "https://web.archive.org/save/" + url;

						// Send the request
						request(requestUrl)

						// If the request is successful, set the pasted URL status to "archived"
						.then(async function (res) {
							this.database.setStatus(archiveUUID, "internetArchive", ArchiveStatus.Archived)
							this.database.get(archiveUUID).internetArchive.archive = archiveUrl;
						}.bind(this))
					
						// Else if an error is returned, store that one, notice, and abort the process.
						.catch(async function (e) {
							this.database.setStatus(archiveUUID, "internetArchive", ArchiveStatus.Error, e.status);
							this.notice(`📁 Web Archiver: Archiving request returned a ${e.status} error. Will retry later, please ensure the archiving server is up.`, `📁 Web Archiver: ${e.status} error.`, "📁 : ❌");
							return;
						}.bind(this))
						this.database.setStatus(archiveUUID, "internetArchive", ArchiveStatus.Requested);
					}
				}.bind(this))
			}
		}

		// Archive on Archive.today
		if (this.settings.get("useArchiveToday")) {
			if (this.database.get(archiveUUID).archiveToday.status === ArchiveStatus.NotStarted) {

				// Build the archive URL
				const archiveUrl = `https://archive.ph/${moment().format("YYYYMMDDHHmm")}/${url}`;

				// Check if the URL is already archived
				request({ url: archiveUrl })
				
				// If it is, set its status to "archived"
				.then(async function (res) {
					this.database.setStatus(archiveUUID, "archiveToday", ArchiveStatus.Archived);
					console.log(this.database.get(archiveUUID))
					this.database.get(archiveUUID).archiveToday.archive = archiveUrl;
				}.bind(this))
				
				// Else, continue archiving process
				.catch(async function (e) {
					
					// If the error code !== 404, store that one, notice, and abort the process 
					if (e.status !== 404) {
						this.database.setStatus(archiveUUID, "archiveToday", ArchiveStatus.Error, e.status);
						this.notice(`📁 Web Archiver: Archiving request returned a ${e.status} error. Will retry later, please ensure the archiving server is up.`, `📁 Web Archiver: ${e.status} error.`, "📁 : ❌");
						return;
					}
					
					// Else request for archiving the pasted URL
					else {

						// Build the request URL
						const requestUrl = "https://robustlinks.mementoweb.org/api/?archive=archive.today&url=" + url;

						// Send the request
						request(requestUrl)

						// If the request is successful, set the pasted URL status to "archived"
						.then(async function (res) {
							if (res.contains("No results")) throw { status: 404 }; // Support ArchiveToday which doesn't throw a 404 if the archive doesn't exist, but instead display a code 200 page with "No results" text displayed.
							this.database.setStatus(archiveUUID, "archiveToday", ArchiveStatus.Archived)
							this.database.get(archiveUUID).archiveToday.archive = archiveUrl;
						}.bind(this))
					
						// Else if an error is returned, store that one, notice, and abort the process.
						.catch(async function (e) {
							this.database.setStatus(archiveUUID, "archiveToday", ArchiveStatus.Error, e.status);
							this.notice(`📁 Web Archiver: Archiving request returned a ${e.status} error. Will retry later, please ensure the archiving server is up.`, `📁 Web Archiver: ${e.status} error.`, "📁 : ❌");
							return;
						}.bind(this))
						this.database.setStatus(archiveUUID, "archiveToday", ArchiveStatus.Requested);
					}
				}.bind(this))
			}
		}

		// Archive on ArchiveBox instance
		if (this.settings.get("useArchiveBox")) {
			console.log("use")
			if (this.database.get(archiveUUID).archiveBox.status === ArchiveStatus.NotStarted) {
				// Build the archive URL
				const archiveUrl = `https://${this.settings.get("archiveBoxFqdn")}/archive/${moment.now()}/${url}`;
			
				// Check if the URL is already archived
				request({ url: archiveUrl })
				
				// If it is, set its status to "archived"
				.then(async function (res) {
					console.log("aaaa")
					this.database.setStatus(archiveUUID, "archiveBox", ArchiveStatus.Archived);
					this.database.get(archiveUUID).archiveBox.archive = archiveUrl;
				}.bind(this))
				
				// Else, continue archiving process
				.catch(async function (e) {
					
					// If the error code !== 404, store that one, notice, and abort the process 
					if (e.status !== 404) {
						this.database.setStatus(archiveUUID, "archiveBox", ArchiveStatus.Error, e.status);
						this.notice(`📁 Web Archiver: Archiving request returned a ${e.status} error. Will retry later, please ensure the archiving server is up.`, `📁 Web Archiver: ${e.status} error.`, "📁 : ❌");
						return;
					}
					
					// Else request for archiving the pasted URL
					else {

						// Build the request URL
						const requestUrl = "https://web.archive.org/save/" + url;

						// Send the request
						request({
								"url": "https://archive.vuethers.org/add/",
								"method": "POST",
								"headers": {
									"Content-Type": "application/x-www-form-urlencoded",
								},
								"body": `url=${url}&parser=auto&tag=&depth=0`,
							})

						// If the request is successful, set the pasted URL status to "archived"
						.then(async function (res) {
							this.database.setStatus(archiveUUID, "archiveBox", ArchiveStatus.Archived)
							this.database.get(archiveUUID).archiveBox.archive = archiveUrl;
						}.bind(this))
					
						// Else if an error is returned, store that one, notice, and abort the process.
						.catch(async function (e) {
							this.database.setStatus(archiveUUID, "archiveBox", ArchiveStatus.Error, e.status);
							this.notice(`📁 Web Archiver: Archiving request returned a ${e.status} error. Will retry later, please ensure the archiving server is up.`, `📁 Web Archiver: ${e.status} error.`, "📁 : ❌");
							return;
						}.bind(this))
						this.database.setStatus(archiveUUID, "archiveBox", ArchiveStatus.Requested);
					}
				}.bind(this))
			}
		}
	
		this.notice("📁 Web Archiver: Pasted URL successfully queued for archiving. The archived content may take several minutes to be available.", "📁 Web Archiver: Queued.", "📁 : ✅");
	}

	notice(normalMessage: string, minimalMessage: string, iconsOnlyMessage: string) {
		if (this.settings.get("noticesStyle") === 0) new Notice(normalMessage);
		else if (this.settings.get("noticesStyle") === 1) new Notice(minimalMessage);
		else if (this.settings.get("noticesStyle") === 2) new Notice(iconsOnlyMessage);
	}
}