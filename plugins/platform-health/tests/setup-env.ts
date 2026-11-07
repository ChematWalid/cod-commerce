import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** The server's `.env` holds the data-service URLs the integration tests probe. */
const SERVER_ENV_FILE = join(__dirname, '../../../apps/server/.env');

// Variables already in the environment win over the file (Node does not override them).
if (existsSync(SERVER_ENV_FILE)) {
  process.loadEnvFile(SERVER_ENV_FILE);
}
