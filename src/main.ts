/*
TODO:
- Add "Parse whole vault and archive all unarchived URLs" command
- Add URL shorteners support for archived links (Cutt.ly, Kutt, Bit.ly)
*/

// import { App, Modal, Notice, PluginSettingTab, Setting } from 'obsidian';
import { Plugin, Editor, Notice, request } from 'obsidian';
import { WebArchiverSettings, DEFAULT_SETTINGS, WebArchiverSettingsTab } from "./settings";
import { PastedUrl, WebArchiverDatabase } from "./database";
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
						if (!(pastedText in this.database)) {
							const pastedUrl: PastedUrl = {
								status: "pasted",
								errorCode: 0
							}
							this.database[pastedText] = pastedUrl;
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

						// Check if the URL requires archiving
						let requiresArchiving = false;
						if (this.database[pastedText].status !== "archived") {
							try {
								await request({ url: archiveUrl });
							}
							catch (e) {
								// If a 404 error is returned, set archiving as required
								if (e.status === 404) {
									requiresArchiving = true;
								}
								// On any other error, store that one and abort the process 
								else {
									this.database[pastedText].status = "error";
									this.database[pastedText].errorCode = e.status;
									this.writeData();
			
									new Notice(`📁 Web Archiver: Archiving request returned a ${e.status} error. Will retry later, please ensure the archiving server is up.`);
									return;
								}
							}

							// Set the URL as "archived" if it doesn't require archiving but doesn't already have an "archived" status
							if (!requiresArchiving && this.database[pastedText].status !== "archived") {
								this.database[pastedText].status = "archived";
								this.database[pastedText].errorCode = 0;
								this.writeData();
							}
						}

						// Archive the URL if required
						if (requiresArchiving) {

							// Build the save URL
							let saveUrl = "";
							if (this.settings.archivingProvider === 0) saveUrl = "https://web.archive.org/save/";
							else if (this.settings.archivingProvider === 1) saveUrl = "https://archive.ph/submit/?url=";
							else if (this.settings.archivingProvider === 2) saveUrl = "https://archivebox.custom.domain/archive/";
							saveUrl += pastedText;

							// Request archiving
							try {
								// Mark the archiving as requested
								this.database[pastedText].status = "requested";
								this.database[pastedText].errorCode = 0;
								this.writeData();
								
								new Notice(`📁 Web Archiver: Archiving request sent. The content may take some time to be available.`);
								
								await request({ url: saveUrl });
							}
							catch (e) {
								// If an error is returned, store, notice it and abort the process.
								this.database[pastedText].status = "error";
								this.database[pastedText].errorCode = e.status;
								this.writeData();
								
								new Notice(`📁 Web Archiver: Archiving request returned a ${e.status} error. Will retry later, please ensure the archiving server is up.`);
								return;
							}
						}
					}
				}
		}.bind(this)));

		// Print console message
		console.log(`"Web Archiver 📁" successfully loaded.`);
	}
	
	async readData() {
		const data = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings ? data.settings : {});
		this.database = data.database ? data.database : {};
  }

  async writeData() {
		await this.saveData({
			settings: this.settings,
			database: this.database
		});
	}
}