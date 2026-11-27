/** The part of a Node HTTP server the tracker listens to. */
export interface RequestEventSource {
  on(event: 'request', listener: (request: unknown, response: ResponseCloseSource) => void): unknown;
}

/** The part of a Node HTTP response the tracker listens to. */
export interface ResponseCloseSource {
  once(event: 'close', listener: () => void): unknown;
}

/** The part of the drain the tracker reports to. */
export interface RequestCounter {
  requestStarted(): () => void;
}

/**
 * Counts every request of `server` in flight until its response closes (sent or aborted), for the api's
 * request drain. Listening on the server covers every route, GraphQL, REST and the dashboard's files alike.
 */
export function trackInFlightRequests(server: RequestEventSource, counter: RequestCounter): void {
  server.on('request', (_request, response) => {
    response.once('close', counter.requestStarted());
  });
}
