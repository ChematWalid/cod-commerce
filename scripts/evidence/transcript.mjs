// The one place that turns a curl exchange into a redacted Markdown transcript section.
//   node transcript.mjs <response-headers-file> <response-body-file> <output-md>
// Env: TITLE, METHOD, URL, SHOWN_HEADERS (newline separated, already safe to print),
//      SHOWN_BODY (request body to print, or "-" for none).
//      Presigned URL signatures, credentials and session tokens are redacted; binary bodies are summarised (P2.S2).
import { appendFileSync, readFileSync } from 'node:fs';
import process from 'node:process';
import { TextDecoder } from 'node:util';

const [headersFile, bodyFile, outFile] = process.argv.slice(2);
const e = process.env;

const KEEP = new Set([
  'content-type',
  'cache-control',
  'vendure-auth-token',
  'set-cookie',
  'retry-after',
  'location',
  'referrer-policy',
  'etag',
  'content-disposition',
  // What a storefront tenant page tells the edge to keep (ADR 0006 §4, P3.S2).
  'cloudflare-cdn-cache-control',
]);

/** Header value as it may be printed: tokens and cookie values never leave this function. */
function redactHeader(name, value) {
  if (name === 'vendure-auth-token') return '[REDACTED]';
  if (name === 'set-cookie') return value.replace(/^([^=;]+)=[^;]*/, '$1=[REDACTED]');
  return value;
}

const pretty = (text, replacer) => {
  try {
    return JSON.stringify(JSON.parse(text), replacer, 2);
  } catch {
    return text;
  }
};

// curl -D appends one header block per redirect or 100-continue; the last one is the answer.
const blocks = readFileSync(headersFile, 'utf8')
  .trim()
  .split(/\r?\n\r?\n/);
const [statusLine, ...headerLines] = blocks[blocks.length - 1].split(/\r?\n/);
const headers = [];
for (const line of headerLines) {
  const i = line.indexOf(':');
  if (i < 0) continue;
  const name = line.slice(0, i).trim().toLowerCase();
  if (KEEP.has(name)) headers.push(`${name}: ${redactHeader(name, line.slice(i + 1).trim())}`);
}

/** The parts of a presigned URL that would let a reader use it (D2208): kept as names, their values never printed. */
const PRESIGNED_SECRET = /(X-Amz-(?:Signature|Credential|Security-Token)=)[^&"\s<]+/g;
const redactPresigned = (text) => text.replace(PRESIGNED_SECRET, '$1[REDACTED]');

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
/** Content types whose bytes are never printed, by the short name the summary uses. */
const BINARY_KIND = new Map([
  [XLSX_TYPE, 'xlsx'],
  ['application/zip', 'zip'],
]);
const contentType = (headers.find((h) => h.startsWith('content-type:')) ?? '').slice('content-type:'.length).trim();
const mediaType = contentType.split(';')[0].trim().toLowerCase();

/** A spreadsheet download or other non-text answer is shown as `<kind, N bytes>`; text is shown as is. */
function bodyText(bytes) {
  const kind = BINARY_KIND.get(mediaType);
  if (kind !== undefined) return `<${kind}, ${bytes.length} bytes>`;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return `<${mediaType || 'binary'}, ${bytes.length} bytes>`;
  }
}

// Per-check durations vary run to run; the evidence is the ok flag and the error.
const body = pretty(bodyText(readFileSync(bodyFile)).trim(), (k, v) => (k === 'durationMs' ? undefined : v));
const request = [`${e.METHOD} ${e.URL}`, ...(e.SHOWN_HEADERS ?? '').split('\n').filter(Boolean)];
if (e.SHOWN_BODY && e.SHOWN_BODY !== '-') request.push('', pretty(e.SHOWN_BODY));

appendFileSync(
  outFile,
  redactPresigned(
    `### ${e.TITLE}\n\n\`\`\`http\n${request.join('\n')}\n\n${statusLine.trim()}\n${headers.join('\n')}${body ? `\n\n${body}` : ''}\n\`\`\`\n\n`,
  ),
);
