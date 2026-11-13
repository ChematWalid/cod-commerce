# #221 browser runs: `after`

Produced by `scripts/evidence/P1.S4-221.sh` on a live compose stack (project `cod-evidence`, demo seed). Each row is one
`vitest run` of the browser config against that stack; a failed row keeps its log next to this file as `run-<n>-<name>.log`.

| | |
| --- | --- |
| Browser tests at | `4797005ac4017ce0e9f957d63ec4b836371ef679` |
| Image from | `e6bfb37f3b1c569ec2c0907a780a2ad2d005f80b` |
| Chromium | 158.0.8127.18 (playwright-core 1.65.0) |
| Plain loops | 6 × (general-settings "right to left", account-menu-close) |
| Throttled loops | 2 × the same, CDP CPU throttling ×4 |
| Caller files | general-settings account-menu account-menu-close shell-appearance shell-nav store-create dashboard-rtl dashboard-arabic roles platform-flags |
| Budgets | 360 s per spec run, 900 s for the caller files, 2100 s in all |
| **Runs / failures** | **17 / 0** |
| Skipped for time | 0 |

| Run | Spec | Result | Tests | Time |
| --- | --- | --- | --- | --- |
| 1 | callers | pass | 98 passed (98) | 457 s |
| 2 | general-settings-rtl | pass | 1 passed | 5 skipped (6) | 15 s |
| 3 | account-menu-close | pass | 4 passed (4) | 20 s |
| 4 | general-settings-rtl | pass | 1 passed | 5 skipped (6) | 8 s |
| 5 | account-menu-close | pass | 4 passed (4) | 19 s |
| 6 | general-settings-rtl | pass | 1 passed | 5 skipped (6) | 9 s |
| 7 | account-menu-close | pass | 4 passed (4) | 20 s |
| 8 | general-settings-rtl | pass | 1 passed | 5 skipped (6) | 9 s |
| 9 | account-menu-close | pass | 4 passed (4) | 18 s |
| 10 | general-settings-rtl | pass | 1 passed | 5 skipped (6) | 9 s |
| 11 | account-menu-close | pass | 4 passed (4) | 19 s |
| 12 | general-settings-rtl | pass | 1 passed | 5 skipped (6) | 9 s |
| 13 | account-menu-close | pass | 4 passed (4) | 20 s |
| 14 | general-settings-rtl-throttled | pass | 1 passed | 5 skipped (6) | 14 s |
| 15 | account-menu-close-throttled | pass | 4 passed (4) | 31 s |
| 16 | general-settings-rtl-throttled | pass | 1 passed | 5 skipped (6) | 13 s |
| 17 | account-menu-close-throttled | pass | 4 passed (4) | 32 s |
