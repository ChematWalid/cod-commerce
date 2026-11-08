/** The merchant dashboard's route on the api (ADR 0010; `app.ourdomain/` from P3.S5), without slashes. */
export const DASHBOARD_ROUTE = 'dashboard';

/** The dashboard's public base path, which the Vite build bakes into its asset URLs. */
export const DASHBOARD_BASE_PATH = `/${DASHBOARD_ROUTE}`;
