import { existsSync } from 'node:fs';

const ENV_FILE = '.env';

// Variables already in the environment win over the file (Node does not override them).
if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}
