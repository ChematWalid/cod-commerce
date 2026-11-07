// Reads `docker compose config --format json` on stdin and fails when the stack
// would not move unchanged from a laptop to a VPS (bind mounts, host networking,
// hard-coded loopback in env, published ports that ignore their bind address: the api's
// API_BIND_ADDR, every other port's DATA_BIND_ADDR).
import { spawnSync } from 'node:child_process';
import console from 'node:console';
import { Buffer } from 'node:buffer';
import process from 'node:process';

const problems = [];
const LOOPBACK = /localhost|127\.0\.0\.1|host\.docker\.internal/;

// Only the api faces clients (through the reverse proxy); data and worker-health ports stay private.
const API_SERVICE = 'api';

function check(config, binds) {
  for (const [name, service] of Object.entries(config.services ?? {})) {
    if (service.network_mode === 'host') problems.push(`${name}: network_mode host`);
    if (service.extra_hosts) problems.push(`${name}: extra_hosts`);
    for (const volume of service.volumes ?? []) {
      if (volume.type === 'bind') problems.push(`${name}: bind mount ${volume.source}`);
    }
    // healthcheck commands are exempt: only `environment` is inspected.
    for (const [key, value] of Object.entries(service.environment ?? {})) {
      if (LOOPBACK.test(String(value))) problems.push(`${name}: env ${key} contains loopback`);
    }
    const [variable, expected] = name === API_SERVICE ? ['API_BIND_ADDR', binds.api] : ['DATA_BIND_ADDR', binds.data];
    for (const port of service.ports ?? []) {
      if (port.host_ip !== expected) {
        problems.push(
          `${name}: port ${port.published} binds ${port.host_ip}, expected ${expected} (${variable}=${expected})`,
        );
      }
    }
  }
}

const LOCAL = '127.0.0.1';
const WIDE = '0.0.0.0';
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
check(JSON.parse(Buffer.concat(chunks).toString('utf8')), {
  api: process.env.API_BIND_ADDR ?? LOCAL,
  data: process.env.DATA_BIND_ADDR ?? LOCAL,
});

const wide = spawnSync('docker', ['compose', 'config', '--format', 'json'], {
  env: { ...process.env, API_BIND_ADDR: WIDE, DATA_BIND_ADDR: WIDE },
  encoding: 'utf8',
});
if (wide.status !== 0) {
  problems.push(`docker compose config failed with API_BIND_ADDR=DATA_BIND_ADDR=${WIDE}: ${wide.stderr}`);
} else {
  check(JSON.parse(wide.stdout), { api: WIDE, data: WIDE });
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('compose config is portable');
