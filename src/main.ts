// import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { Plugin, Editor, MarkdownView } from 'obsidian';
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

		// Catch every paste event
		this.registerEvent(this.app.workspace.on('editor-paste',
			function (evt: ClipboardEvent, editor: Editor) {
				if (evt.clipboardData) {
					const pastedText = evt.clipboardData.getData("text/plain");

					// If the pasted text is an URL
					if (urlRegex.test(pastedText)) {

						// Archive that URL on the choosen archiving provider
						const archivedUrl = "https://archive.org/test";

						// Append the archived URL next to the pasted URL
						editor.replaceRange(` [${this.settings.archivedLinkText}](${archivedUrl})`, editor.getCursor());
					}
				}
		}.bind(this)));
	}
	
  async onunload() {
    // Release any resources configured by the plugin.
	}
	
	async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}