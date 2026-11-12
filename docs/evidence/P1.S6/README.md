# Evidence for P1.S6 (platform plumbing)

Transcripts and screenshots from a live stack (CLAUDE.md §3a.14), produced by `scripts/evidence/P1.S6.sh`. Data is synthetic. Image
built from a tree with no uncommitted change outside the evidence folders and browser tests, last image-relevant commit
`f8d7d93c77efa2895eb14f7c772c6944fab6fba9`. Compose project `cod-evidence`, `PLATFORM_DEMO_HANDLERS=true`.

## API transcripts

| File | Shows |
| --- | --- |
| [`api/webhook-gateway.md`](api/webhook-gateway.md) | A signed demo webhook (200), the same body again (200), the database counts (one key, one stored webhook `processed`, the outbox event `platform.demo` relayed, `demo-log` `done`), a bad signature 401, an unknown account 404, an unknown provider 404, 262 145 bytes 413 |
| [`api/internal-guard.md`](api/internal-guard.md) | Seven unsigned requests on four hosts (404, empty), signed resolve and Shop API (200), each tamper (store, query, method, body, 61 s old) 404, 101 KB 413, the public availability check on four hosts, the storefront rendering the demo store through the signed client |
| [`api/flags.md`](api/flags.md) | Staff `featureFlags`, `updateFeatureFlag`, a business override and `evaluateFeatureFlag` for both businesses, the merchant owner FORBIDDEN |
| [`api/secrets.md`](api/secrets.md) | `setTenantSecret` (value redacted), `tenantSecrets` with `last4`, the second business not seeing it, deleting another business's id not found, the ciphertext-only table |
| [`api/jobs.md`](api/jobs.md) | `platformJobsHealth` before and after `runScheduledTask` of `outbox-sweeper` and `job-reconciler` |
| [`api/activity-log.md`](api/activity-log.md) | The `activity_log` partitions from the catalog, a row in a later partition, `UPDATE` and `DELETE` refused, the activity API across partitions |

Store, business and secret ids and channel tokens are placeholders; every assertion ran on the real values. Request signatures and
secret values are `[REDACTED]` or absent. The host's one client address shares the rate limits, so the script clears the `rl:*`
keys of its own Valkey between groups.

## Screenshots

`screens/flags-<lang>-<viewport>.png` is the staff flags screen (`/platform/flags`) and
`screens/flags-override-dialog-<lang>-<viewport>.png` its Add override dialog, for desktop (1280 px) and mobile (390 px), Arabic and
English. 8 files.

## Browser assertions in `scripts/evidence/P1.S6-screens.mjs`

Each line below is a failing assertion in the script if it does not hold.

- Every shot: dir matches the language and there is no horizontal overflow.
- Every shot: the framework's name appears only inside the licence notice.
- Every shot: the four seeded flags are listed and their keys are wrapped for left-to-right display.

## What was seen in each screenshot (opened by eye, CLAUDE.md §3a.17)

All eight shots are the platform staff's view (the superadmin on the stock dashboard), not the merchant shell. Arabic shots are
`dir=rtl`: the sidebar sits on the right, columns run right to left, the Arabic font is loaded and the flag keys stay left to right.
English shots are `dir=ltr`. No horizontal page overflow (asserted on every shot). No third-party product name or logo is visible
(asserted; the licence notice lives in the merchant account menu, which the staff view does not have). The stock staff chrome keeps
its English "Administration" heading and "Default channel" label in Arabic (D77: platform staff only). Data is synthetic: the
business id typed into the dialog is the demo business's.

| File(s) | Seen |
| --- | --- |
| `flags-en-desktop`, `flags-ar-desktop` | The sidebar's new Platform section is open on Feature flags, the page title and the breadcrumb "Platform" are translated in Arabic. A table of the four seeded flags: key (in the Arabic page also right-aligned but still reading left to right, for example `inbound-webhooks.enabled` wrapped after the dot), description, the default switch, the rollout box at 100 and the override count. `ai.enabled` is off by default with one override (set earlier in the run, see `api/flags.md`); the other three are on. In Arabic the switch knob sits on the other side of its track, as the stock switch mirrors in RTL, and "on" still reads as a dark track. |
| `flags-override-dialog-en-desktop`, `flags-override-dialog-ar-desktop` | The page behind the dim layer shows the `ai.enabled` row opened: its one business override with state and Remove, and the Add override button. The dialog: title "New override for ai.enabled", Scope (Business, translated "النشاط التجاري" in Arabic), Target id with the business id typed and the hint "A plan key, or the id of a business or a store", the enabled switch and Save and Cancel. The close button is at the inline end in both languages and does not touch the title; the id reads left to right in Arabic. |
| `flags-en-mobile`, `flags-ar-mobile` | The sidebar is closed behind its toggle. The Description column is hidden on a phone; key, default switch, rollout and overrides remain. Keys wrap at the dot (`capi.` / `enabled`), which is acceptable for a staff screen. |
| `flags-override-dialog-en-mobile`, `flags-override-dialog-ar-mobile` | The dialog fills the width with a 16 px gutter; Save and Cancel stack full width. Arabic fields and labels are right-aligned, the id stays left to right. |

### Defects

None fixed in this session's code by this evidence run.

### Seen, not changed here

- The flag descriptions are English in the Arabic page: they are the seed's text stored in the database, not catalogue strings, so
  they cannot follow the page language until flags carry translated descriptions (staff-only screen; D77).
- In English on a phone the last column header ("Overrides") is clipped at the right edge: the table scrolls inside its container
  and the page itself does not overflow (asserted). The count under it is visible.
- The breadcrumb ("Platform") is hidden on a phone by the stock top bar.
- The dark theme was not shot: the brief asks for the two viewports and the two languages.
