// The one place that turns a curl exchange into a redacted Markdown transcript section.
//   node transcript.mjs <response-headers-file> <response-body-file> <output-md>
// Env: TITLE, METHOD, URL, SHOWN_HEADERS (newline separated, already safe to print),
//      SHOWN_BODY (request body to print, or "-" for none).
import { appendFileSync, readFileSync } from 'node:fs';
import process from 'node:process';

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

// Per-check durations vary run to run; the evidence is the ok flag and the error.
const body = pretty(readFileSync(bodyFile, 'utf8').trim(), (k, v) => (k === 'durationMs' ? undefined : v));
const request = [`${e.METHOD} ${e.URL}`, ...(e.SHOWN_HEADERS ?? '').split('\n').filter(Boolean)];
if (e.SHOWN_BODY && e.SHOWN_BODY !== '-') request.push('', pretty(e.SHOWN_BODY));

appendFileSync(
  outFile,
  `### ${e.TITLE}\n\n\`\`\`http\n${request.join('\n')}\n\n${statusLine.trim()}\n${headers.join('\n')}${body ? `\n\n${body}` : ''}\n\`\`\`\n\n`,
);
