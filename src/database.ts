import WebArchiver from "./main";

export enum ArchiveStatus {
  NotStarted = "not-started",
  Requested = "requested",
  Error = "error",
  Archived = "archived"
}

export interface Archive {
  archive: string,
  status: ArchiveStatus,
  errCode: number
}

export const DEFAULT_ARCHIVE: Archive = {
  archive: "not available yet",
  status: ArchiveStatus.NotStarted,
  errCode: 0
}

export interface ArchivedUrl {
  url: string,
  datetime: string,
  internetArchive: Archive,
  archiveToday: Archive,
  archiveBox: Archive
}

export interface WebArchiverDatabase {
  [index: string]: ArchivedUrl;
}

export async function loadDatabase(plugin: WebArchiver) {
  // Get and create the archiveFile if it doesn't exist 
  let archiveFile = plugin.app.vault.getAbstractFileByPath(plugin.settings.archiveFilePath);
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
 
  // Get the archiveFile object
  let archiveFile = plugin.app.vault.getAbstractFileByPath(plugin.settings.archiveFilePath);

  // Write the new text content
  plugin.app.vault.modify(archiveFile, newTextContent);
}