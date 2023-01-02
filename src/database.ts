import WebArchiver from "./main";

export enum ArchiveStatus {
  Queued = "queued",
  Requested = "requesed",
  Error = "error",
  Archived = "archived"
}

export interface Archive {
  archive: string,
  status: ArchiveStatus,
  errCode: number
}

export interface ArchivedUrl {
  url: string,
  datetime: Date,
  internetArchive: Archive,
  archiveToday: Archive,
  archiveBox: Archive
}

export interface WebArchiverDatabase {
  [index: string]: ArchivedUrl;
}

export async function loadDatabase(plugin: WebArchiver) {
  // Get and create the archiveFile if it doesn't exist 
  let archiveFile = plugin.app.vault.getAbstractFileByPath(this.settings.archiveFilePath);
  if (!archiveFile) archiveFile = await plugin.app.vault.create(plugin.settings.archiveFilePath, ""); 

  // Convert the archive file as JSON
  // * Match all level 2 UID headings 
  let archiveFileContent = await plugin.app.vault.read(archiveFile)
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
  plugin.database = JSON.parse(archiveFileContent)
}

export async function storeDatabase(plugin: WebArchiver) {
  // Build nex text content
  let newTextContent = "";
  for (const [id, archivedUrl] of Object.entries(plugin.database)) {
    newTextContent += `## ${id.toString()}\n`;
    newTextContent += JSON.stringify(archivedUrl, null, 4);
    newTextContent += "\n";
  }
  console.log(newTextContent);
 
  // Get the archiveFile object
  let archiveFile = plugin.app.vault.getAbstractFileByPath(this.settings.archiveFilePath);

  // Write the new text content
  plugin.app.vault.modify(archiveFile, newTextContent);
}