/*
TODO:
- Add "Archive all vault's URLs" command
*/

// import { App, Modal, Notice, PluginSettingTab, Setting } from 'obsidian';
import { Plugin, Editor, Notice, request } from 'obsidian';
import { WebArchiverSettings, DEFAULT_SETTINGS, WebArchiverSettingsTab } from "./settings";

const urlRegex = /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/

export default class WebArchiver extends Plugin {
	settings: WebArchiverSettings;

	async onload() {
    // Print console message
		console.log(`Loading "Web Archiver 📁" plugin...`);

		// Initialize the settings tab
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.addSettingTab(new WebArchiverSettingsTab(this.app, this))

		// Listen on every paste event
		this.registerEvent(this.app.workspace.on('editor-paste',
			async function (evt: ClipboardEvent, editor: Editor) {
				if (evt.clipboardData) {
					const pastedText = evt.clipboardData.getData("text/plain");

					// If the pasted text is an URL perform archiving
					if (urlRegex.test(pastedText)) {
						
						// Build the archived URL
						let archivedUrl = "";
						if (this.settings.archivingProvider === 0) archivedUrl = "https://web.archive.org/web/";
						else if (this.settings.archivingProvider === 1) archivedUrl = "https://archive.ph/";
						else if (this.settings.archivingProvider === 2) archivedUrl = "https://archivebox.custom.domain/archive/";
						archivedUrl += pastedText;

						// Check if the URL requires archiving or is already archived.
						let requiresArchiving = false;
						try {
							await request({ url: archivedUrl });
						}
						catch (e) {
							if (e.status === 404) {
								requiresArchiving = true;
							}
							else {
								new Notice(`📁 Web Archiver: Archiving request returned a ${e.status} error. Please ensure the archiving provider is joinable.`);
								return;
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
								await request({ url: saveUrl });
							}
							catch (e) {
								new Notice(`📁 Web Archiver: Archiving request returned a ${e.status} error. Please ensure the archiving provider is joinable.`);
								return;
							}
								
							new Notice(`📁 Web Archiver: Archiving request sent. The content may take some time to be available.`);
						}

						// Append the archived URL next to the pasted URL
						editor.replaceRange(` [${this.settings.archivedLinkText}](${archivedUrl})`, editor.getCursor());
					}
				}
		}.bind(this)));
	}
	
	async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
	}
}