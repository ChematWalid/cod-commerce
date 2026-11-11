import { BAD_PATH } from '../dashboard/constants';

/** Forbidden: a server layer importing dashboard/, even the file its plugin's entry point may re-export. */
export const apiUsesDashboard = BAD_PATH;
