import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '../../..');
const TRANSCRIPT = join(repoRoot, 'scripts/evidence/transcript.mjs');
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const SIGNED_QUERY =
  'X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=GKsynthetic%2F20261120%2Fgarage%2Fs3%2Faws4_request' +
  '&X-Amz-Date=20261120T000000Z&X-Amz-Expires=600&X-Amz-Security-Token=synthetic-session-token' +
  '&X-Amz-Signature=0123456789abcdef&X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost';
const SIGNED_URL = `http://127.0.0.1:23900/bucket/uploads/b/1/s/2/imports/3/source?${SIGNED_QUERY}`;

describe('evidence transcript.mjs (P2.S2 Task 13)', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'transcript-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  /** Runs the script on one exchange and answers the Markdown it appended. */
  function transcriptOf(contentType: string, body: Buffer | string, env: Record<string, string> = {}): string {
    const headers = join(dir, 'h');
    const bodyFile = join(dir, 'b');
    const out = join(dir, 'out.md');
    writeFileSync(headers, `HTTP/1.1 200 OK\r\ncontent-type: ${contentType}\r\n\r\n`);
    writeFileSync(bodyFile, body);
    writeFileSync(out, '');
    execFileSync(process.execPath, [TRANSCRIPT, headers, bodyFile, out], {
      env: { ...process.env, TITLE: 't', METHOD: 'GET', URL: 'http://127.0.0.1/x', SHOWN_BODY: '-', ...env },
    });
    return readFileSync(out, 'utf8');
  }

  it('summarises a spreadsheet body as its kind and size instead of printing its bytes', () => {
    // Arrange
    const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff, 0xfe, 0x00, 0x01]);

    // Act
    const text = transcriptOf(XLSX_TYPE, zip);

    // Assert
    expect(text).toContain('<xlsx, 9 bytes>');
    expect(text).not.toContain('PK');
  });

  it('summarises a body that is not UTF-8 text by its content type and size', () => {
    // Arrange
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff]);

    // Act
    const text = transcriptOf('application/octet-stream', png);

    // Assert
    expect(text).toContain('<application/octet-stream, 9 bytes>');
  });

  it('keeps a CSV body as text', () => {
    // Act
    const text = transcriptOf('text/csv; charset=utf-8', 'product_key,name\r\nEV-1,Shirt\r\n');

    // Assert
    expect(text).toContain('product_key,name');
  });

  it('redacts the signature, credential and session token of a presigned URL in a JSON body', () => {
    // Act
    const text = transcriptOf('application/json', JSON.stringify({ uploadUrl: SIGNED_URL, downloadUrl: SIGNED_URL }));

    // Assert
    expect(text).not.toContain('0123456789abcdef');
    expect(text).not.toContain('GKsynthetic');
    expect(text).not.toContain('synthetic-session-token');
    expect(text).toContain('X-Amz-Signature=[REDACTED]');
    expect(text).toContain('X-Amz-Credential=[REDACTED]');
    expect(text).toContain('X-Amz-Security-Token=[REDACTED]');
    expect(text).toContain('X-Amz-Expires=600');
  });

  it('redacts a presigned URL in the request line', () => {
    // Act
    const text = transcriptOf('application/xml', '<Error/>', { METHOD: 'PUT', URL: SIGNED_URL });

    // Assert
    expect(text).toContain('PUT http://127.0.0.1:23900/bucket/uploads/b/1/s/2/imports/3/source?');
    expect(text).not.toContain('0123456789abcdef');
    expect(text).not.toContain('GKsynthetic');
  });
});
