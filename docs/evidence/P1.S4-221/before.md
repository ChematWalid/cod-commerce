# #221 browser runs: `before`

Produced by `scripts/evidence/P1.S4-221.sh` on a live compose stack (project `cod-evidence`, demo seed). Each row is one
`vitest run` of the browser config against that stack; a failed row keeps its log next to this file as `run-<n>-<name>.log`.

| | |
| --- | --- |
| Browser tests at | `8fa54c14ef7fc001511589c4a3b5780908fe5c77 (general-settings.browser.test.ts account-menu-close.browser.test.ts dashboard-session.ts shell-appearance-fixtures.ts; the rest at 38f8b71f627f8046e56e2b9d58828592e2de1dab)` |
| Image from | `e6bfb37f3b1c569ec2c0907a780a2ad2d005f80b` |
| Chromium | 158.0.8127.18 (playwright-core 1.65.0) |
| Plain loops | 6 × (general-settings "right to left", account-menu-close) |
| Throttled loops | 2 × the same, CDP CPU throttling ×4 |
| Caller files | not run |
| Budgets | 360 s per spec run, 900 s for the caller files, 2100 s in all |
| **Runs / failures** | **16 / 0** |
| Skipped for time | 0 |

| Run | Spec | Result | Tests | Time |
| --- | --- | --- | --- | --- |
| 1 | general-settings-rtl | pass | 1 passed | 5 skipped (6) | 13 s |
| 2 | account-menu-close | pass | 4 passed (4) | 20 s |
| 3 | general-settings-rtl | pass | 1 passed | 5 skipped (6) | 11 s |
| 4 | account-menu-close | pass | 4 passed (4) | 19 s |
| 5 | general-settings-rtl | pass | 1 passed | 5 skipped (6) | 11 s |
| 6 | account-menu-close | pass | 4 passed (4) | 19 s |
| 7 | general-settings-rtl | pass | 1 passed | 5 skipped (6) | 10 s |
| 8 | account-menu-close | pass | 4 passed (4) | 20 s |
| 9 | general-settings-rtl | pass | 1 passed | 5 skipped (6) | 11 s |
| 10 | account-menu-close | pass | 4 passed (4) | 19 s |
| 11 | general-settings-rtl | pass | 1 passed | 5 skipped (6) | 11 s |
| 12 | account-menu-close | pass | 4 passed (4) | 19 s |
| 13 | general-settings-rtl-throttled | pass | 1 passed | 5 skipped (6) | 17 s |
| 14 | account-menu-close-throttled | pass | 4 passed (4) | 31 s |
| 15 | general-settings-rtl-throttled | pass | 1 passed | 5 skipped (6) | 15 s |
| 16 | account-menu-close-throttled | pass | 4 passed (4) | 32 s |
