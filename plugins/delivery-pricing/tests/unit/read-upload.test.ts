import { Agent, createServer, type IncomingMessage, request, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { readBodyAtMost } from '../../api/read-upload';

const LIMIT = 16;
/** Far above what the socket buffers hold, so a request left paused never finishes sending. */
const HUGE_BODY = Buffer.alloc(8 * 1024 * 1024, 0x20);
const ANSWER_TIMEOUT_MS = 5_000;

interface Answer {
  readonly status: number;
  readonly connection: string | undefined;
  readonly body: string;
}

/** A server answering how many bytes `readBodyAtMost` read, 413 past the limit, the request as Express hands it on. */
function bodyReadingServer(): Server {
  return createServer((incoming: IncomingMessage, response: ServerResponse) => {
    // Express sets `req.res`; the controller hands `readBodyAtMost` the request as Express gives it.
    const req = Object.assign(incoming, { res: response });
    void readBodyAtMost(req, LIMIT).then((bytes) => {
      response.statusCode = bytes.length > LIMIT ? 413 : 200;
      response.end(String(bytes.length));
    });
  });
}

/** POSTs `body` through `agent`; answers once the response ended, whether or not the upload finished. */
function post(port: number, agent: Agent, body: Buffer): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const call = request({ port, method: 'POST', agent, headers: { 'content-length': body.length } }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode ?? 0,
          connection: res.headers.connection,
          body: Buffer.concat(chunks).toString(),
        });
      });
    });
    // The server may close the socket while the rest of an over-limit body is still being sent.
    call.on('error', (error) => {
      if (call.writableFinished) reject(error);
    });
    call.end(body);
  });
}

const withinTimeout = <T>(work: Promise<T>): Promise<T | 'timed out'> =>
  Promise.race([
    work,
    new Promise<'timed out'>((resolve) => {
      setTimeout(() => {
        resolve('timed out');
      }, ANSWER_TIMEOUT_MS);
    }),
  ]);

describe('readBodyAtMost', () => {
  let server: Server | undefined;
  let agent: Agent | undefined;

  afterEach(() => {
    agent?.destroy();
    server?.closeAllConnections();
    server?.close();
  });

  it('reads a body within the limit whole', async () => {
    // Arrange
    server = bodyReadingServer().listen(0);
    agent = new Agent({ keepAlive: true, maxSockets: 1 });
    const { port } = server.address() as AddressInfo;

    // Act
    const answer = await post(port, agent, Buffer.from('level,code'));

    // Assert
    expect(answer).toMatchObject({ status: 200, body: '10' });
  });

  it('answers past the limit with Connection: close, and the next request on that client is answered', async () => {
    // Arrange
    server = bodyReadingServer().listen(0);
    agent = new Agent({ keepAlive: true, maxSockets: 1 });
    const { port } = server.address() as AddressInfo;

    // Act
    const over = await withinTimeout(post(port, agent, HUGE_BODY));
    const next = await withinTimeout(post(port, agent, Buffer.from('a,b')));

    // Assert
    expect(over).toMatchObject({ status: 413, connection: 'close' });
    expect(next).toMatchObject({ status: 200, body: '3' });
  });
});
