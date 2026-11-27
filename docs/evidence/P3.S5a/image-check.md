# Role image check (scripts/ops/image-check.sh, 2026-11-27T13:54Z, commit 033d8693)

| Check | Result |
|---|---|
| Image size | 1852 MiB (single-stage baseline `cod-platform:local`: 2300 MiB) |
| ROLE=api user id | 1000 |
| ROLE=worker user id | 1000 |
| ROLE=migrate user id | 1000 |
| ROLE=storefront user id | 1000 |
| Dev dependencies, root node_modules, server src | absent |
| `docker history --no-trunc` secret-like values | none |
| Trivy secret scan | no finding |
| Trivy vulnerabilities | CRITICAL 3, HIGH 96 |
| SBOM | `sbom/summary.md` (2 MiB CycloneDX) |
| RSS api (idle, `docker stats --no-stream`) | 392.1MiB |
| RSS worker (idle, `docker stats --no-stream`) | 300.2MiB |
| RSS storefront (idle, `docker stats --no-stream`) | 123.7MiB |
| `docker compose stop api` | 5709 ms, exit code 0 (limit 30 s) |
| `docker compose stop worker` | 3106 ms, exit code 0 (limit 65 s) |
| `docker compose stop storefront` | 3120 ms, exit code 143 (limit 30 s) |
