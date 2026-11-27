# Staging server baseline (Ansible)

Turns a fresh Debian 12 VPS into the single staging node of `docs/architecture/infrastructure.md` §1.1: one operator
account with key login only, hardened sshd, a firewall that lets the web ports in from Cloudflare only, pinned Docker
CE, a 2 GB swap file, UTC, unattended security updates, and the data tier (Postgres, PgBouncer, Valkey, Garage) from
the repository's `docker-compose.yml`. Kamal deploys the app roles on top (`deploy/`, P3.S5a Task 6).

Every tool runs from its pinned image through `scripts/ops/tool.sh` (D3503); nothing is installed on the laptop.

## Layout

| Path | What |
|---|---|
| `site.yml` | preflight → base + users → login as the operator → ssh, docker, firewall, swap, data_tier |
| `group_vars/staging/vars.yml` | non-secret settings (operator keys, SSH sources, database names) |
| `group_vars/staging/vault.yml.example` | the secret names; the real `vault.yml` is git-ignored and encrypted |
| `inventory/staging.example.yml` | copy to `inventory/staging.yml` (git-ignored) |
| `requirements.yml` | pinned collections (`community.general` for ufw, `community.docker` for the check run) |
| `tests/` | the local check run's inventory, synthetic values and edge-chain playbook |

| Role | Does |
|---|---|
| `base` | base packages, `TZ=UTC`, unattended upgrades limited to Debian security (no automatic reboot) |
| `users` | `operator_user` (default `cod`) in `sudo` and `docker`, password locked, exactly the listed keys, sudo without password |
| `ssh` | `sshd_config.d/00-cod-hardening.conf`: no root, no passwords, `AllowUsers` the operator; validated with `sshd -t -f` on write and `sshd -t` on the whole config before the restart |
| `docker` | Docker CE, CLI, containerd, buildx and compose at exact versions from download.docker.com (key checked by fingerprint), held; log rotation |
| `firewall` | ufw: SSH first, then 80/443 from the edge ranges, deny the rest; and the `DOCKER-USER` edge chain (below) |
| `swap` | `/swapfile` 2 GB in fstab, `vm.swappiness=10` |
| `data_tier` | `/opt/cod/docker-compose.yml` + `.env` (0600, from the vault, never logged), `docker compose up --wait` of the data services, `CREATE EXTENSION IF NOT EXISTS pg_stat_statements` |

## Why two firewalls

Docker publishes ports with DNAT before the packet reaches ufw's INPUT rules, so ufw alone would leave kamal-proxy's
80/443 open to the world. The firewall role therefore also writes `/usr/local/sbin/cod-edge-firewall`, which builds a
`COD-EDGE` chain that `DOCKER-USER` jumps to: a new connection arriving on the public interface reaches a published port
only from an edge range and only on 80/443 (matched on the original port, before DNAT); replies, container and loopback
traffic pass; everything else from the public interface is dropped. The chain is built aside and swapped in, and the
script refuses an empty range list. `cod-edge-firewall.service` re-runs it whenever Docker starts, so it survives
reboots and Docker restarts. ufw still guards the host's own sockets: SSH, and IPv6 web traffic that Docker's userland
proxy accepts on the host.

The edge ranges are fetched from `https://www.cloudflare.com/ips-v4` and `ips-v6` on every run. A fetch that fails,
returns a non-CIDR line or a list shorter than 10 (v4) / 5 (v6) falls back to the pinned copies in
`roles/firewall/files/` and says so in the run output. Ranges that drop out of the list are removed from ufw.

## First run against the real server (P3.S5b)

1. `cp inventory/staging.example.yml inventory/staging.yml`, set `ansible_host`; leave `ansible_user: root` for the
   first run.
2. Put the operators' **public** keys in `group_vars/staging/vars.yml` (`operator_ssh_public_keys`).
3. `cp group_vars/staging/vault.yml.example group_vars/staging/vault.yml`, fill the values on your machine (formats in
   the root `.env.example`), then `../../scripts/ops/tool.sh ansible-vault encrypt group_vars/staging/vault.yml`.
4. Accept the server's host key once: `ssh root@<address> true` after comparing the fingerprint with the provider's
   console.
5. Install the collections, then run. `tool.sh` hands the playbook your ssh agent (`SSH_AUTH_SOCK`) and, read-only,
   your `~/.ssh/known_hosts`:

   ```sh
   cd infra/ansible
   ../../scripts/ops/tool.sh ansible-galaxy collection install -r requirements.yml -p .ansible/collections
   ../../scripts/ops/tool.sh ansible-playbook site.yml --ask-vault-pass --check --diff   # read it first (needs python3-apt)
   ../../scripts/ops/tool.sh ansible-playbook site.yml --ask-vault-pass
   ```

6. The play logs in as the operator before sshd changes; if that login fails it stops with root still allowed. After
   the run, set `ansible_user: cod` in `inventory/staging.yml`: root can no longer log in.
7. Keep an SSH session open while running the play for the first time, and check a second login before closing it.

## Local check (no server)

```sh
flock -w 3600 /tmp/cod-heavy-jobs.lock timeout 2400 bash scripts/ops/ansible-check.sh
```

It installs the collections, runs `--syntax-check` and `ansible-lint` (production profile), runs `site.yml` with
`--check --diff` against a fresh `debian:12.12` container (`community.docker.docker` connection, synthetic values from
`tests/check-vars.yml`), and applies the edge chain for real to a Docker-in-Docker container with a published port,
probed from another container: reachable before, dropped from outside the ranges, reachable from an allowed range on
80 only. The report goes to `docs/evidence/P3.S5a/ansible-check.md`.

Not exercised in a container (they need a kernel or systemd of their own), so first seen on the real server:

| Skipped | How |
|---|---|
| ufw rules and `ufw enable` | tag `firewall-ufw` |
| `sysctl -p` | tag `host-kernel` |
| allocating, formatting and turning on the swap file | `--check` (handlers of the allocation) |
| sshd, docker restarts; enabling `cod-edge-firewall.service` | `when: service_mgr == 'systemd'` |
| login as the new operator | `when: not ansible_check_mode` (the account is not created in `--check`) |
| Docker CE install and the data tier start | `--check` on a host without the Docker repository |

## Notes

- Node metrics come from a node exporter installed here in P3.S5b (Task 3 dropped the collector's `hostmetrics`).
- `pg_stat_statements` needs `shared_preload_libraries=pg_stat_statements` on the postgres command (compose, Task 3);
  the extension step is idempotent and can be repeated from the runbook.
- Docker CE upgrades: bump `roles/docker/defaults/main.yml` (all packages together) and rerun with `--tags docker`.
  The packages are held, so `apt upgrade` and unattended upgrades leave them alone.
- Kernel security updates install unattended but need a planned reboot (runbook); `base_auto_reboot` stays off.
