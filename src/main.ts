/*
TODO:
- Add "Parse whole vault and archive all unarchived URLs" command
- Write the README.md
- Submit the plugins to the Obsidian's plugins list
- Set up CI/CD of releases with the Semantic Bot
- Make the archive file read-only by listening on change event on it and preventing the action
- Find an alternative to crypto in UUID else it will not work in mobile versions, see: https://github.com/obsidianmd/obsidian-releases/blob/master/plugin-review.md#nodejs-and-electron-api
*/

import { Plugin, Editor, Notice } from "obsidian";
import { WebArchiverSettings, WebArchiverSettingsTab } from "./settings";
import { WebArchiverDatabase } from "./database";
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

			// Initialize the settings' tab
			this.addSettingTab(new WebArchiverSettingsTab(this.app, this))

			// Initialize the database instance
			this.database = new WebArchiverDatabase(this);
			await this.database.init();

			// Listen on every paste event and archive pasted URLs
			this.registerEvent(this.app.workspace.on('editor-paste',
				async function (evt: ClipboardEvent, editor: Editor) {
					if (evt.clipboardData) {

						// Retrieve pasted text
						const pastedText = evt.clipboardData.getData("text/plain");

						// If the pasted text is an URL, send it to archiving queue
						if (urlRegex.test(pastedText)) {
							evt.preventDefault();

							// Generate archive UUID
							const archiveUUID = genUUID(Object.keys(this.database.data));
						
							// Build the archive link
							const archiveLink = `${pastedText} [${this.settings.get("archivedLinkText")}](${this.settings.get("archiveFileName")}#${archiveUUID})`

							// Append the archive link next to the pasted URL
							editor.replaceRange(archiveLink, editor.getCursor());

							// Move the cursor next to the archive link
							editor.setCursor(editor.getCursor().line, editor.getCursor().ch + archiveLink.length)
						
							await this.database.archive(pastedText, editor, archiveUUID);
						}
					}
				}.bind(this)));

			// Print console message
			console.log(`"Web Archiver 📁" successfully loaded.`);
		}.bind(this))
	}

	notice(normalMessage: string, minimalMessage: string, iconsOnlyMessage: string) {
		if (this.settings.get("noticesStyle") === 0) new Notice("📁 Web Archiver: " + normalMessage);
		else if (this.settings.get("noticesStyle") === 1) new Notice("📁 Web Archiver: " + minimalMessage);
		else if (this.settings.get("noticesStyle") === 2) new Notice("📁: " + iconsOnlyMessage);
	}
}