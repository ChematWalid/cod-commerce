import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** The server's `.env` holds `DATABASE_URL_DIRECT`, the Postgres the integration tests create their databases on. */
const SERVER_ENV_FILE = join(__dirname, '../../../apps/server/.env');

// Variables already in the environment win over the file (Node does not override them); CI has no file.
if (existsSync(SERVER_ENV_FILE)) {
  process.loadEnvFile(SERVER_ENV_FILE);
}
