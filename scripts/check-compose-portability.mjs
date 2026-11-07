// Reads `docker compose config --format json` on stdin and fails when the stack
// would not move unchanged from a laptop to a VPS (bind mounts, host networking,
// hard-coded loopback in env, published ports that ignore DATA_BIND_ADDR).
import { spawnSync } from 'node:child_process';
import console from 'node:console';
import { Buffer } from 'node:buffer';
import process from 'node:process';

const problems = [];
const LOOPBACK = /localhost|127\.0\.0\.1|host\.docker\.internal/;

function check(config, expectedHostIp, label) {
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
    for (const port of service.ports ?? []) {
      if (port.host_ip !== expectedHostIp) {
        problems.push(`${name}: port ${port.published} binds ${port.host_ip}, expected ${expectedHostIp} (${label})`);
      }
    }
  }
}

const defaultBind = process.env.DATA_BIND_ADDR ?? '127.0.0.1';
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
check(JSON.parse(Buffer.concat(chunks).toString('utf8')), defaultBind, `DATA_BIND_ADDR=${defaultBind}`);

const wide = spawnSync('docker', ['compose', 'config', '--format', 'json'], {
  env: { ...process.env, DATA_BIND_ADDR: '0.0.0.0' },
  encoding: 'utf8',
});
if (wide.status !== 0) {
  problems.push(`docker compose config failed with DATA_BIND_ADDR=0.0.0.0: ${wide.stderr}`);
} else {
  check(JSON.parse(wide.stdout), '0.0.0.0', 'DATA_BIND_ADDR=0.0.0.0');
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('compose config is portable');
