/*
TODO:
- Add "Parse whole vault and archive all unarchived URLs" command
- Add URL shorteners support for archived links (Cutt.ly, Kutt, Bit.ly)
*/

// import { App, Modal, Notice, PluginSettingTab, Setting } from 'obsidian';
import { Plugin, Editor, Notice, request } from 'obsidian';
import { WebArchiverSettings, DEFAULT_SETTINGS, WebArchiverSettingsTab } from "./settings";
import { PastedUrl, WebArchiverDatabase, ArchivingStatus, DEFAULT_DATABASE } from "./database";
import { urlRegex } from './constants';


export default class WebArchiver extends Plugin {
	settings: WebArchiverSettings;
	database: WebArchiverDatabase;

	async onload() {
    // Print console message
		console.log(`Loading "Web Archiver 📁" plugin...`);

		// Read data from the JSON file
		await this.readData();

		// Initialize the settings tab
		this.addSettingTab(new WebArchiverSettingsTab(this.app, this))

		// Set all "requested" status as "pasted"
		for (const [url, urlObject] of Object.entries(this.database.urls)) {
			if (urlObject.status === ArchivingStatus.Requested) this.database.urls[url].status = ArchivingStatus.Queued;
		}

		// Listen on every paste event
		this.registerEvent(this.app.workspace.on('editor-paste',
			async function (evt: ClipboardEvent, editor: Editor) {
				if (evt.clipboardData) {

					// Retrieve pasted text
					const pastedText = evt.clipboardData.getData("text/plain");

					// If the pasted text is an URL start archiving process
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
			this.writeData();
		}
		
		// Build the archive URL
		let archiveUrl = "";
		if (this.settings.archivingProvider === 0) archiveUrl = "https://web.archive.org/web/";
		else if (this.settings.archivingProvider === 1) archiveUrl = "https://archivebox.custom.domain/archive/";
		archiveUrl += url;

		// Append the archived URL next to the pasted URL
		editor.replaceRange(` [${this.settings.archivedLinkText}](${archiveUrl})`, editor.getCursor());

		// Start the archiving process
		if (this.database.urls[url].status !== ArchivingStatus.Archived) {

			// Check if the URL is already archived
			request({ url: archiveUrl })
				
				// If it is, set its status to "archived"
				.then(() => this.setUrlStatus(url, ArchivingStatus.Archived))

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

						// Build the save URL
						let saveUrl = "";
						if (this.settings.archivingProvider === 0) saveUrl = "https://web.archive.org/save/";
						else if (this.settings.archivingProvider === 1) saveUrl = "https://archivebox.custom.domain/archive/";
						saveUrl += url;

						// Send the archiving request
						this.setUrlStatus(url, ArchivingStatus.Requested);
						request({ url: saveUrl })
							// If the request is successful, set the pasted URL status to "archived"
							.then((response) => this.setUrlStatus(url, ArchivingStatus.Archived))
							
							// Else if an error is returned, store that one, notice, and abort the process.
							.catch(e => {
								this.setUrlStatus(url, ArchivingStatus.Error, e.status);
								this.notice(`📁 Web Archiver: Archiving request returned a ${e.status} error. Will retry later, please ensure the archiving server is up.`, `📁 Web Archiver: ${e.status} error.`, "📁 : ❌");
								return;
							})
					}
				})
			}
		this.notice("📁 Web Archiver: Archiving process successfuly initiated. The archived content may take several minutes to be available.", "📁 Web Archiver: Initiated.", "📁 : ✅");
	}

	notice(normalMessage: string, minimalMessage: string, iconsOnlyMessage: string) {
		if (this.settings.noticesStyle === 0) new Notice(normalMessage);
		else if (this.settings.noticesStyle === 1) new Notice(minimalMessage);
		else if (this.settings.noticesStyle === 2) new Notice(iconsOnlyMessage);
	}
	
	async setUrlStatus(pastedUrl: string, status: ArchivingStatus, errorCode?: number) {
		this.database.urls[pastedUrl].status = status;
		this.database.urls[pastedUrl].errorCode = errorCode ? errorCode : 0;
		this.writeData();
	}
	
	async readData() {
		const data = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings ? data.settings : {});
		this.database = Object.assign({}, DEFAULT_DATABASE, data.database ? data.database : {});
		
  }

  async writeData() {
		await this.saveData({
			settings: this.settings,
			database: this.database
		});
	}
}