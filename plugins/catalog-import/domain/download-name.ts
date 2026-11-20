import { InvalidImportInputError } from './errors';
import { isExportKey, isUploadKey } from './object-keys';

/** A server-made attachment name: plain ascii letters, digits, `.`, `_` and `-`, so the header needs no quoting. */
const DOWNLOAD_NAME = /^[A-Za-z0-9._-]{1,100}$/;

/**
 * The checks of a presigned download (D2208): only a key under `exports/`, only a plain ascii name (no product or
 * store text, no quote or line break that could split the `Content-Disposition` header).
 *
 * @throws {@link InvalidImportInputError} when either check fails
 */
export function checkDownload(key: string, downloadName: string): void {
  if (!isExportKey(key) || !DOWNLOAD_NAME.test(downloadName)) throw new InvalidImportInputError();
}

/** The `Content-Disposition` of a download; `downloadName` passed {@link checkDownload}. */
export const attachmentDisposition = (downloadName: string): string => `attachment; filename="${downloadName}"`;

/**
 * The check of a presigned upload (D2208): only a key under `uploads/`, so a browser never gets a write link to a
 * server-made export or error report.
 *
 * @throws {@link InvalidImportInputError} when the key lies elsewhere
 */
export function checkUpload(key: string): void {
  if (!isUploadKey(key)) throw new InvalidImportInputError();
}
