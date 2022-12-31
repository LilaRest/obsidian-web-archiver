/*
TODO:
- Add "Parse whole vault and archive all unarchived URLs" command
- Add URL shorteners support for archived links (Cutt.ly, Kutt, Bit.ly)
- Write the README.md
- Submit the plugins to the Obsidian's plugins list
- Set up CI/CD of releases with the Semantic Bot
- Store pasting datetime in data to allow reviewing later
- Store startus per archiving provider and allow multiple archiving providers
*/

import { Plugin, Editor, Notice, request, moment } from 'obsidian';
import { WebArchiverSettings, DEFAULT_SETTINGS, WebArchiverSettingsTab } from "./settings";
import { PastedUrl, WebArchiverDatabase, ArchivingStatus, DEFAULT_DATABASE } from "./database";
import { urlRegex } from './constants';


export default class WebArchiver extends Plugin {
	settings: WebArchiverSettings;
	database: {};

	async onload() {
    // Print console message
		console.log(`Loading "Web Archiver 📁" plugin...`);

		// Load settings from the JSON file
		await this.loadSettings();

		// Load database from the archive file
		await this.loadDatabase();

		// Initialize the settings tab
		this.addSettingTab(new WebArchiverSettingsTab(this.app, this))

		// Set all "requested" and "error" status as "queued"
		for (const [url, urlObject] of Object.entries(this.database.urls)) {
			if ([ArchivingStatus.Requested, ArchivingStatus.Error].contains(urlObject.status)) this.setUrlStatus(url, ArchivingStatus.Queued);
		}

		// Listen on every paste event
		this.registerEvent(this.app.workspace.on('editor-paste',
			async function (evt: ClipboardEvent, editor: Editor) {
				if (evt.clipboardData) {

					// Retrieve pasted text
					const pastedText = evt.clipboardData.getData("text/plain");

					// If the pasted text is an URL, send it to archiving queue
					if (urlRegex.test(pastedText)) {
						await this.archiveUrl(pastedText, editor)
					}
				}
		}.bind(this)));

		// Print console message
		console.log(`"Web Archiver 📁" successfully loaded.`);
	}

	async archiveUrl(url: string, editor: Editor) {

		// If the URL is not already in the database, store it
		if (!(url in this.database.urls)) {
			const pastedUrl: PastedUrl = {
				status: ArchivingStatus.Queued,
				errorCode: 0
			}
			this.database.urls[url] = pastedUrl;
			await this.writeData();
		}
		
		// Build the archive URL
		let archiveUrl = "";
		if (this.settings.useInternetArchive) archiveUrl = `https://web.archive.org/web/${moment().format("YYYYMMDDHHmm")}/${url}`;
		else if (this.settings.useArchiveToday) archiveUrl = `https://archive.ph/${moment().format("YYYYMMDDHHmm")}/${url}`;
		else if (this.settings.useArchiveBox) archiveUrl = `https://${this.settings.archiveBoxFqdn}/archive/${moment.now()}/${url}`;

		// Append the archived URL next to the pasted URL
		editor.replaceRange(` [${this.settings.archivedLinkText}](${archiveUrl})`, editor.getCursor());

		// Start the archiving process
		if (this.database.urls[url].status !== ArchivingStatus.Archived) {

			// Check if the URL is already archived
			request({ url: archiveUrl })
				
				// If it is, set its status to "archived"
				.then(response => {
					if (response.contains("No results")) throw { status: 404 }; // Support ArchiveToday which doesn't throw a 404 if the archive doesn't exist, but instead display a code 200 page with "No results" text displayed.
					this.setUrlStatus(url, ArchivingStatus.Archived)
				})

				// Else, continue archiving process
				.catch(e => {
					// If the error code !== 404, store that one, notice, and abort the process 
					if (e.status !== 404) {
						this.setUrlStatus(url, ArchivingStatus.Error, e.status);
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
							.then(res => { console.log(res); this.setUrlStatus(url, ArchivingStatus.Archived) })
							
							// Else if an error is returned, store that one, notice, and abort the process.
							.catch(e => {
								console.log(e);
								this.setUrlStatus(url, ArchivingStatus.Error, e.status);
								this.notice(`📁 Web Archiver: Archiving request returned a ${e.status} error. Will retry later, please ensure the archiving server is up.`, `📁 Web Archiver: ${e.status} error.`, "📁 : ❌");
								return;
							})
	
							// Set the url archiving as "requested"
							this.setUrlStatus(url, ArchivingStatus.Requested);
						}
					}
				})
			}
		this.notice("📁 Web Archiver: Pasted URL successfully queued for archiving. The archived content may take several minutes to be available.", "📁 Web Archiver: Queued.", "📁 : ✅");
	}

	notice(normalMessage: string, minimalMessage: string, iconsOnlyMessage: string) {
		if (this.settings.noticesStyle === 0) new Notice(normalMessage);
		else if (this.settings.noticesStyle === 1) new Notice(minimalMessage);
		else if (this.settings.noticesStyle === 2) new Notice(iconsOnlyMessage);
	}
	
	async setUrlStatus(pastedUrl: string, status: ArchivingStatus, errorCode?: number) {
		this.database.urls[pastedUrl].status = status;
		this.database.urls[pastedUrl].errorCode = errorCode ? errorCode : 0;
		await this.writeData();
	}
	
	async loadSettings() {
		const data = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings ? data.settings : {});		
  }

  async saveSettings() {
		await this.saveData({
			settings: this.settings,
		});
	}

	async loadDatabase() {
		// Get and create the archiveFile if it doesn't exist 
		let archiveFile = await this.app.vault.getAbstractFileByPath(this.settings.archiveFilePath);
		if (!archiveFile) archiveFile = await this.app.vault.create(this.settings.archiveFilePath, ""); 

		// Convert the archive file as JSON
		// * Match all level 2 UID headings 
		let archiveFileContent = await this.app.vault.read(archiveFile)
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

		// * Surround the whole block with curly brackets
		archiveFileContent = "{" + archiveFileContent + "}"; 

		// * Parse the database as JSON and store it in memory
		this.database = JSON.parse(archiveFileContent)
	}

	async writeDatabase () {
		
	}
}