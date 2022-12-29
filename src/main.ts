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
		this.readData();

		// Initialize the settings tab
		this.addSettingTab(new WebArchiverSettingsTab(this.app, this))

		// Listen on every paste event
		this.registerEvent(this.app.workspace.on('editor-paste',
			async function (evt: ClipboardEvent, editor: Editor) {
				if (evt.clipboardData) {

					// Retrieve pasted text
					const pastedText = evt.clipboardData.getData("text/plain");

					// If the pasted text is an URL start archiving process
					if (urlRegex.test(pastedText)) {

						// If the URL is not already in the database, store it
						if (!(pastedText in this.database.urls)) {
							const pastedUrl: PastedUrl = {
								status: ArchivingStatus.Pasted,
								errorCode: 0
							}
							this.database.urls[pastedText] = pastedUrl;
							this.writeData();
						}
						
						// Build the archive URL
						let archiveUrl = "";
						if (this.settings.archivingProvider === 0) archiveUrl = "https://web.archive.org/web/";
						else if (this.settings.archivingProvider === 1) archiveUrl = "https://archive.ph/";
						else if (this.settings.archivingProvider === 2) archiveUrl = "https://archivebox.custom.domain/archive/";
						archiveUrl += pastedText;

						// Append the archived URL next to the pasted URL
						editor.replaceRange(` [${this.settings.archivedLinkText}](${archiveUrl})`, editor.getCursor());

						// Start the archiving process
						let requiresArchiving = false;
						if (this.database.urls[pastedText].status !== "archived") {

							// Check if the URL is already archived
							request({ url: archiveUrl })
								
								// If it is, set its status to "archived"
								.then(() => {
									this.setUrlStatus(pastedText, "archived");
								})

								// Else, continue archiving process
								.catch(e => {

									// If the error code !== 404, store that one, notice, and abort the process 
									if (e.status !== 404) {
										this.setUrlStatus(pastedText, "error", e.status);
										new Notice(`📁 Web Archiver: Archiving request returned a ${e.status} error. Will retry later, please ensure the archiving server is up.`);
										return;
									}
									
									// Else request for archiving the pasted URL
									else {

										// Build the save URL
										let saveUrl = "";
										if (this.settings.archivingProvider === 0) saveUrl = "https://web.archive.org/save/";
										else if (this.settings.archivingProvider === 1) saveUrl = "https://archive.ph/submit/?url=";
										else if (this.settings.archivingProvider === 2) saveUrl = "https://archivebox.custom.domain/archive/";
										saveUrl += pastedText;

										// Send the archiving request
										this.setUrlStatus(pastedText, "requested");
										request({ url: saveUrl })
											// If the request is successful, set the pasted URL status to "archived"
											.then(() => this.setUrlStatus(pastedText, "archived"))
											
											// Else if an error is returned, store that one, notice, and abort the process.
											.catch(e => {
												this.setUrlStatus(pastedText, "error", e.status);
												new Notice(`📁 Web Archiver: Archiving request returned a ${e.status} error. Will retry later, please ensure the archiving server is up.`);
												return;
											})
									}
								})
							new Notice(`📁 Web Archiver: Archiving process successfuly initiated. The archived content may take several minutes to be available.`);
						}
					}
				}
		}.bind(this)));

		// Print console message
		console.log(`"Web Archiver 📁" successfully loaded.`);
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