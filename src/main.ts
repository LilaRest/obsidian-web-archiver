/*
TODO:
- Add "Parse whole vault and archive all unarchived URLs" command
- Add URL shorteners support for archived links (Cutt.ly, Kutt, Bit.ly)
- Write the README.md
- Submit the plugins to the Obsidian's plugins list
- Set up CI/CD of releases with the Semantic Bot
- Make the archive file read-only by listening on change event on it and preventing the action
*/

import { Plugin, Editor, Notice, request, moment } from "obsidian";
import { WebArchiverSettings, WebArchiverSettingsTab, loadSettings, storeSettings } from "./settings";
import { WebArchiverDatabase, ArchivedUrl, ArchiveStatus, DEFAULT_ARCHIVE } from "./database";
import { urlRegex } from "./constants";
import { genUUID } from "./uuid" 


export default class WebArchiver extends Plugin {
	settings: WebArchiverSettings;
	database: WebArchiverDatabase;

	async onload() {
    // Print console message
		console.log(`Loading "Web Archiver 📁" plugin...`);

		// Load settings from the data.json file
		await loadSettings(this);

		// Initialize the settings tab
		this.addSettingTab(new WebArchiverSettingsTab(this.app, this))

		// Initialize the database instance
		this.database = new WebArchiverDatabase(this);



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
						const archiveLink = `${pastedText} [${this.settings.archivedLinkText}](${this.settings.archiveFileName}#${archiveUUID})`

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
		if (this.settings.useInternetArchive) {
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
						this.database.setStatus(archiveUUID, "internetArchive", ArchiveStatus.Archived, e.status);
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
						}.bind(this))
					
						// Else if an error is returned, store that one, notice, and abort the process.
						.catch(async function (e) {
							console.log(e);
							this.database.setStatus(archiveUUID, "internetArchive", ArchiveStatus.Error, e.status);
							this.notice(`📁 Web Archiver: Archiving request returned a ${e.status} error. Will retry later, please ensure the archiving server is up.`, `📁 Web Archiver: ${e.status} error.`, "📁 : ❌");
							return;
						}.bind(this))
					}
				}.bind(this))
			}
		}

		// Archive on Archive.today
		if (this.settings.useArchiveToday) {
			if (this.database.get(archiveUUID).archiveToday.status === ArchiveStatus.NotStarted) {

				// Build the archive URL
				const archiveUrl = `https://archive.ph/${moment().format("YYYYMMDDHHmm")}/${url}`;

				
			}
		}

		// Archive on ArchiveBox instance
		if (this.settings.useArchiveBox) {
			if (this.database.get(archiveUUID).archiveBox.status === ArchiveStatus.NotStarted) {
				// Build the archive URL
				const archiveUrl = `https://${this.settings.archiveBoxFqdn}/archive/${moment.now()}/${url}`;
			}
		}
	
		/*// Start the archiving process
		if (this.database.urls[url].status !== ArchiveStatus.Archived) {

			// Check if the URL is already archived
			request({ url: archiveUrl })
				
				// If it is, set its status to "archived"
				.then(response => {
					if (response.contains("No results")) throw { status: 404 }; // Support ArchiveToday which doesn't throw a 404 if the archive doesn't exist, but instead display a code 200 page with "No results" text displayed.
					this.database.setStatus(url, ArchiveStatus.Archived)
				})

				// Else, continue archiving process
				.catch(e => {
					// If the error code !== 404, store that one, notice, and abort the process 
					if (e.status !== 404) {
						this.database.setStatus(url, ArchiveStatus.Error, e.status);
						this.notice(`📁 Web Archiver: Archiving request returned a ${e.status} error. Will retry later, please ensure the archiving server is up.`, `📁 Web Archiver: ${e.status} error.`, "📁 : ❌");
						return;
					}
					
					// Else request for archiving the pasted URL
					else {

						let sentRequest;

						// If the archiving provider is Internet Archive or Archive.today -> use a GET request
						if (this.settings.useInternetArchive || this.settings.useArchiveToday) {

							// Build the save URL
							let saveUrl = "";
							if (this.settings.useInternetArchive) saveUrl = "https://web.archive.org/save/";
							else if (this.settings.useArchiveToday) saveUrl = "https://robustlinks.mementoweb.org/api/?archive=archive.today&url=";
							saveUrl += url;
	
							// Send the archiving request
							sentRequest = request(saveUrl);								
						}

						// Else if the archiving provider is an ArchiveBox instance -> use a POST request
						else if (this.settings.useArchiveBox) {
							sentRequest = request({
								"url": "https://archive.vuethers.org/add/",
								"method": "POST",
								"headers": {
									"Content-Type": "application/x-www-form-urlencoded",
								},
								"body": `url=${url}&parser=auto&tag=&depth=0`,
							})
						}

						// If a request has successful been sent
						if (sentRequest) {
							sentRequest
							// If the request is successful, set the pasted URL status to "archived"
							.then(res => { console.log(res); this.database.setStatus(url, ArchiveStatus.Archived) })
							
							// Else if an error is returned, store that one, notice, and abort the process.
							.catch(e => {
								console.log(e);
								this.database.setStatus(url, ArchiveStatus.Error, e.status);
								this.notice(`📁 Web Archiver: Archiving request returned a ${e.status} error. Will retry later, please ensure the archiving server is up.`, `📁 Web Archiver: ${e.status} error.`, "📁 : ❌");
								return;
							})
	
							// Set the url archiving as "requested"
							this.database.setStatus(url, ArchiveStatus.Requested);
						}
					}
				})
			}*/
		this.notice("📁 Web Archiver: Pasted URL successfully queued for archiving. The archived content may take several minutes to be available.", "📁 Web Archiver: Queued.", "📁 : ✅");
	}

	notice(normalMessage: string, minimalMessage: string, iconsOnlyMessage: string) {
		if (this.settings.noticesStyle === 0) new Notice(normalMessage);
		else if (this.settings.noticesStyle === 1) new Notice(minimalMessage);
		else if (this.settings.noticesStyle === 2) new Notice(iconsOnlyMessage);
	}
}