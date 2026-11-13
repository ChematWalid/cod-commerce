# Evidence for P1.S3 (permissions and roles)

Transcripts and screenshots from a live stack (CLAUDE.md §3a.14), produced by `scripts/evidence/P1.S3.sh`. Data is synthetic. Image
built from a tree with no uncommitted change outside the evidence folders and browser tests, last image-relevant commit
`e6bfb37f3b1c569ec2c0907a780a2ad2d005f80b`. Compose project `cod-evidence`; a second api container on port 23101 shares only Valkey and Postgres with the first.

## API transcripts

| File | Shows |
| --- | --- |
| [`api/catalog.md`](api/catalog.md) | `permissionCatalog`, `GET /permissions/catalog` |
| [`api/effective.md`](api/effective.md) | `effectivePermissions` for an owner and a limited member, `GET /permissions` |
| [`api/roles.md`](api/roles.md) | Every role operation in GraphQL and REST, and the activity row after create, update, duplicate and delete |
| [`api/members.md`](api/members.md) | `memberAccess`, `setMemberAccess` and its activity row |
| [`api/activity.md`](api/activity.md) | `activityLog` pages and the cursor; a selected-store member sees the Demo store row and not the Demo2 one (both rows seeded); FORBIDDEN without the permission |
| [`api/refusals.md`](api/refusals.md) | FORBIDDEN (REST and GraphQL, anonymous, a store outside the member's list), a built-in edit, a role in use, self-assignment, a refused escalation |
| [`api/isolation.md`](api/isolation.md) | Cross-tenant: B's channel token, B's role, member and store ids |
| [`api/live-revoke.md`](api/live-revoke.md) | A removed permission and a changed assignment stop working on the next request on a second api process, and a restored one works again |

The ids this run acted on (stores, the roles it used or created, the activity cursor) and channel tokens are placeholders; every assertion ran on the real values. Other built-in role ids in the listings are synthetic and left as they are. Administrator ids are the engine's small integers.

## Browser suite

Run on this stack, since `browser.yml` does not run on pull requests: `pnpm --filter @cod/server test:browser`.

Test Files  15 passed (15)
Tests  123 passed (123)

## Browser flows proved by `scripts/evidence/P1.S3-screens.mjs`

Every line below is a failing assertion in the script if it does not hold; the shots are in `screens/`.

- The licence footer is on the login page.
- ar: a member with only team.roles.view sees the table, no New role button and no row menu.
- ar: a member without team.roles.view has no nav entry; the query answers FORBIDDEN and the page shows the shell's forbidden page.
- ar: deleting a role that has a member shows the translated rbac.role-in-use message.
- ar: with effectivePermissions dropped in the browser the page shows the generic message and no write control.
- ar: the first request after the owner removed team.roles.view on one api is FORBIDDEN on the second api.
- ar: the first request after restoring it is answered on the second api.
- en: a member with only team.roles.view sees the table, no New role button and no row menu.
- en: a member without team.roles.view has no nav entry; the query answers FORBIDDEN and the page shows the shell's forbidden page.
- en: deleting a role that has a member shows the translated rbac.role-in-use message.
- en: with effectivePermissions dropped in the browser the page shows the generic message and no write control.
- en: the first request after the owner removed team.roles.view on one api is FORBIDDEN on the second api.
- en: the first request after restoring it is answered on the second api.
- A selected-store member: businessRoles answers on their store and is FORBIDDEN with the other store's token.

## What was seen in each screenshot (opened by eye, CLAUDE.md §3a.17)

Run of 2026-11-13 (`fix/s4-audit-evidence`, #134, #161): every screen in all four variants, Arabic and English at 1280x800 and
390x844, 40 shots. All 40 were opened, four variants side by side per screen. Signed-in shots use the merchant shell (P1.S5):
the store switcher in the top bar reads `Demo Store` / `demo`; on a phone the sidebar is collapsed to its trigger.

Applies to every shot: no third-party product name or logo. These pages are behind sign-in, so they carry no footer; the licence-required
footer stays on the login page (asserted by the script and the browser test). Arabic shots are `dir=rtl`: sidebar on the right, labels and
text right-aligned, Arabic font loaded. English shots are `dir=ltr`. No horizontal page overflow and no table wider than its container
(both asserted). The seeded owner's email is unverified, so the verification banner above the content is expected. Role names such as
`Evidence ar desktop ...` and `Demo viewer` are synthetic data and stay as typed in both languages.

| File(s) | Seen |
| --- | --- |
| `roles-table-{ar,en}-desktop.png` | Seven built-ins with a translated Built-in badge and translated names, the seeded and evidence custom roles, member counts, Access as `11 / 94` reading left to right in Arabic too (checked on an enlarged crop), Updated date, a row menu on each row. New role at the inline end of the title row. |
| `roles-table-{ar,en}-mobile.png` | After the fix below: long names wrap, Updated is hidden, Members, Access and the row menu are all on screen. |
| `role-dialog-top-*` | Name, Description, Start from, the areas with None and `0 / 19` style counts, footer pinned with the count and Cancel/Save. In Arabic the close button is at the inline end and chevrons at the far edge. On mobile the same content in one column with the footer stacked. |
| `role-dialog-area-*` | Orders expanded: None/View/Full radios, a switch per permission, translated Sensitive badges in red on the sensitive rows. Arabic switches mirror correctly. |
| `roles-duplicate-*` | The new role and its copy in the table, `(copy)` in English and `(نسخة)` in Arabic, with the translated toast. |
| `activity-log-*` | Time, By (hidden on a phone after the fix below), Action and Target, translated actions, a Details link per row. |
| `member-limited-roles-*` | A member with only `team.roles.view`: the table and the Activity log button, no New role button, no row menu; on desktop the sidebar shows Home and Team > Roles & permissions only. |
| `member-no-roles-*` | A member without the permission: no Team entry in the sidebar (Home and Orders only); opening the address directly shows the shell's translated "Access denied" page (`shell-forbidden`) with Go back and Go to dashboard. |
| `refusal-role-in-use-*` | The real server refusal in a translated error toast; the table stays. |
| `permissions-failed-*` | Translated generic error above the table, no New role and no row menu. The failure was caused by dropping that one request in the browser, since the server cannot be made to fail it on demand. |
| `live-revoke-second-api-*` | The member, served by the second api process, after the owner removed the permission on the first: the translated "Access denied" page; the desktop sidebar has only Home left. |

### Defects

- **Fixed (`fix(rbac): fit the roles and activity tables on phones`).** At 390 px the roles table overflowed its scroller: in Arabic the Access column and the row menu were cut off, and in the activity log the Target text was clipped in both languages. The page itself did not overflow, so the original assertion passed. Role names now wrap, the activity log hides the By column on a phone, and the script now fails if a table is wider than its container.
- **Fixed (`fix(rbac): use erasable syntax in shared permission errors`).** A real `docker compose build` failed: the storefront's type check refused the parameter properties in `packages/shared/src/permissions/expand.ts`.

### Activity rows seeded for RBAC-5 (#161)

The two `evidence.store-scoped` rows are written by SQL after the screens and the browser suite, so no screenshot shows them; they
appear only in `api/activity.md` (owner: both stores; member limited to Demo: the Demo row, not the Demo2 row).

### Resolved since the last run

- The store switcher showed the end of the channel's generated code, and the sidebar's `Administration` heading stayed English on
  Arabic pages. The merchant shell (P1.S5) shows `Demo Store` / `demo` in the top-bar switcher and hides the sidebar header.
