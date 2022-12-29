export interface PastedUrl {
  status: string;
  errorCode: number;
}

export interface WebArchiverDatabase {
  queuedUrls: Object;
  archivedUrls: Object;
}