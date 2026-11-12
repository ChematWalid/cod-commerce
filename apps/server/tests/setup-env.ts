import { existsSync } from 'node:fs';

const ENV_FILE = '.env';

// Variables already in the environment win over the file (Node does not override them).
if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

// `loadEnv` has no APP_ENV default (D400), and the e2e suites build their env from `process.env`. A `.env` that lacks
// it (a fresh checkout, CI without `.env.example`) must not turn into a failure that says nothing about the test.
process.env['APP_ENV'] ??= 'test';
