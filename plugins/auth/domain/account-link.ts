/** A link into the dashboard carrying a single-use token. Every account link is built here. */
export function accountLink(dashboardUrl: string, path: string, token: string): string {
  return `${dashboardUrl.replace(/\/+$/, '')}${path}?token=${token}`;
}
