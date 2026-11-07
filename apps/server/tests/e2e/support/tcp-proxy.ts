import { createConnection, createServer, type Server, type Socket } from 'node:net';
import type { AddressInfo } from 'node:net';

const LOOPBACK = '127.0.0.1';

/** A loopback TCP proxy whose upstream can be cut and restored, to take a service away from a running server. */
export interface TcpProxy {
  /** The proxy's port; it stays the same across {@link cut} and {@link restore}. */
  readonly port: number;
  /** Stops accepting connections and drops every open one: clients get "connection refused" from now on. */
  cut(): Promise<void>;
  /** Accepts connections again on the same port; a no-op while it already does. */
  restore(): Promise<void>;
  /** Cuts the proxy for good. */
  close(): Promise<void>;
}

function listen(server: Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, LOOPBACK, () => {
      server.off('error', reject);
      resolve((server.address() as AddressInfo).port);
    });
  });
}

/** Starts a proxy from a free loopback port to `target`. */
export async function startTcpProxy(target: { host: string; port: number }): Promise<TcpProxy> {
  const sockets = new Set<Socket>();
  const track = (socket: Socket): void => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    // A dropped connection is the point of `cut`; its errors are expected.
    socket.on('error', () => socket.destroy());
  };
  const createProxyServer = (): Server =>
    createServer((client) => {
      const upstream = createConnection(target);
      track(client);
      track(upstream);
      client.pipe(upstream).pipe(client);
    });

  let server = createProxyServer();
  const port = await listen(server, 0);

  const cut = async (): Promise<void> => {
    const closed = new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
    for (const socket of sockets) {
      socket.destroy();
    }
    await closed;
  };

  return {
    port,
    cut,
    restore: async () => {
      if (server.listening) {
        return;
      }
      server = createProxyServer();
      await listen(server, port);
    },
    close: async () => {
      if (server.listening) {
        await cut();
      }
    },
  };
}
