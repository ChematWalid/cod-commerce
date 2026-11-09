import { createServer, type Server, Socket } from 'node:net';

/** A TCP proxy to a real service that a test can make hang or refuse, as a network fault does. */
export class TcpProxy {
  private readonly sockets = new Set<Socket>();
  private readonly server: Server;
  private forwarding = true;

  private constructor(private readonly target: { host: string; port: number }) {
    this.server = createServer((client) => {
      this.pipe(client);
    });
  }

  /** Starts a proxy on a free local port that forwards to `target`. */
  static async start(target: { host: string; port: number }): Promise<TcpProxy & { readonly port: number }> {
    const proxy = new TcpProxy(target);
    await new Promise<void>((resolve) => proxy.server.listen(0, '127.0.0.1', resolve));
    const address = proxy.server.address();
    if (address === null || typeof address === 'string') throw new Error('proxy has no port');
    return Object.assign(proxy, { port: address.port });
  }

  /** Keeps every connection open but silently drops what flows through: a hung socket. */
  stopForwarding(): void {
    this.forwarding = false;
  }

  /** Closes the listener and every connection: later connection attempts are refused. */
  async refuseConnections(): Promise<void> {
    for (const socket of this.sockets) socket.destroy();
    await new Promise<void>((resolve) => {
      this.server.close(() => {
        resolve();
      });
    });
  }

  private pipe(client: Socket): void {
    const upstream = new Socket();
    upstream.connect(this.target.port, this.target.host);
    for (const socket of [client, upstream]) {
      this.sockets.add(socket);
      socket.on('error', () => socket.destroy());
      socket.on('close', () => this.sockets.delete(socket));
    }
    client.on('data', (chunk: Buffer) => {
      if (this.forwarding) upstream.write(chunk);
    });
    upstream.on('data', (chunk: Buffer) => {
      if (this.forwarding) client.write(chunk);
    });
  }
}
