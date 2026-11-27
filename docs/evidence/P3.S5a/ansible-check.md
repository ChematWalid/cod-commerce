# Ansible baseline check (scripts/ops/ansible-check.sh, 2026-11-27T16:01Z, commit 4df5b91d)

| Check | Result |
|---|---|
| Collections (requirements.yml) | community.general, community.docker installed at their pinned versions |
| ansible-playbook --syntax-check | site.yml and tests/edge-firewall.yml pass |
| ansible-lint (production profile) | Passed: 0 failure(s), 0 warning(s) in 45 files processed of 51 encountered. Profile 'production' was required, and it passed. |
| site.yml `--check --diff` on Debian 12.12 | `cod-ansible-check-target : ok=41 changed=24 unreachable=0 failed=0 skipped=18 rescued=0 ignored=0 ` |
| Vault values in the `--diff` output | none |
| Before the chain, port 80 | answers |
| Edge chain apply (Cloudflare ranges only) | `cod-ansible-edge-target : ok=11 changed=4 unreachable=0 failed=0 skipped=2 rescued=0 ignored=0 ` |
| Probe outside the edge ranges, port 80 | dropped (no answer within 3 s) |
| Edge chain apply (probe address added) | `cod-ansible-edge-target : ok=11 changed=2 unreachable=0 failed=0 skipped=2 rescued=0 ignored=0 ` |
| Probe inside the edge ranges, port 80 | answers |
| Probe inside the edge ranges, non-web published port, port 8081 | dropped (no answer within 3 s) |
| DOCKER-USER after two applies | one jump to COD-EDGE, no leftover chain |

Targets: `debian:12.12@sha256:c66c66fac809bfb56a8001b12f08181a49b6db832d2c8ddabe22b6374264055f` (check run), `docker:29.10.1-dind@sha256:fbbc96e0af32cdc190aff92ba97a1281a115351a723afe21af78879cc55126b0` (edge chain), probes from `busybox:1.37.0@sha256:a7dbc319b1438115a207e11930dc4bb3e643dcb3ec0bdd694bb36cd8fad289ec`.
Skipped in the container (run on the server only): ufw (`firewall-ufw`), sysctl (`host-kernel`), the swap file,
service restarts (no systemd), the login as the operator (the account does not exist in `--check`).
