/** The process roles of the one server image. Free of imports, so the container healthcheck can read it. */
export const SERVER_ROLES = ['api', 'worker', 'migrate'] as const;

/** One of the {@link SERVER_ROLES}. */
export type ServerRole = (typeof SERVER_ROLES)[number];
