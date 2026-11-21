/**
 * Opens a presigned download link our server issued for the active store's own job (D2208), in a new tab without
 * opener or referrer. Never used for a link read from a file or a scraped page (D2209).
 */
export function openDownload(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}
