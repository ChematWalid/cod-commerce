const MIN_PORT = 1;
const MAX_PORT = 65535;

/** True for a TCP port number. The env schema and the container healthcheck share this one rule. */
export const isPort = (value: number): boolean => Number.isInteger(value) && value >= MIN_PORT && value <= MAX_PORT;

/** The api port inside a container. */
export const DEFAULT_API_PORT = 3000;

/** The worker's health endpoint port. */
export const DEFAULT_WORKER_HEALTH_PORT = 3020;

/** The api port for host-run development and the compose publish (3000 is taken on the dev machine). */
export const DEV_API_PORT = 3100;
