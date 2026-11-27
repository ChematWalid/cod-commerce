/** The part of a Node HTTP server the tracker listens to and closes when the drain begins. */
export interface RequestEventSource {
  prependListener(event: 'request', listener: (request: unknown, response: TrackedResponse) => void): unknown;
  /** Stops accepting connections; open ones keep serving. */
  close(): unknown;
  closeIdleConnections(): void;
}

/** The part of a Node HTTP response the tracker uses. */
export interface TrackedResponse {
  readonly headersSent: boolean;
  once(event: 'close', listener: () => void): unknown;
  setHeader(name: string, value: string): unknown;
}

/** The part of the drain the tracker reports to and follows. */
export interface RequestCounter {
  readonly isDraining: boolean;
  requestStarted(): () => void;
  onBegin(listener: () => void): void;
}

/** Ends the keep-alive socket once this response is sent, so it carries no further request. */
function closeConnectionAfter(response: TrackedResponse): void {
  if (!response.headersSent) response.setHeader('Connection', 'close');
}

/**
 * Counts every request of `server` in flight until its response closes (sent or aborted), for the api's
 * request drain. Listening on the server covers every route, GraphQL, REST and the dashboard's files alike.
 *
 * When the drain begins the server stops accepting connections (ADR 0013: 503, then stop accepting, then wait):
 * callers that skip the load balancer, such as the storefront's node-local INTERNAL_API_URL, would otherwise keep
 * the in-flight count above zero for the whole drain and be served while Vendure stops its queue and event bus.
 * Idle keep-alive sockets close at once, and every response still to be sent closes its socket after it.
 */
export function trackInFlightRequests(server: RequestEventSource, counter: RequestCounter): void {
  const inFlight = new Set<TrackedResponse>();
  // Prepended so the header is set before the framework's own listener can start writing the response.
  server.prependListener('request', (_request, response) => {
    if (counter.isDraining) closeConnectionAfter(response);
    const finished = counter.requestStarted();
    inFlight.add(response);
    response.once('close', () => {
      inFlight.delete(response);
      finished();
    });
  });
  counter.onBegin(() => {
    server.close();
    server.closeIdleConnections();
    inFlight.forEach(closeConnectionAfter);
  });
}
