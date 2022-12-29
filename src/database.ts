export enum ArchivingStatus {
  Pasted,
  Requested,
  Error,
  Archived
}

export interface PastedUrl {
  status: ArchivingStatus;
  errorCode: number;
}

export interface PastedUrls {
  [index: string]: PastedUrl;
}

export interface WebArchiverDatabase {
  urls: PastedUrls;
}

export const DEFAULT_DATABASE: WebArchiverDatabase = {
  urls: {}
}