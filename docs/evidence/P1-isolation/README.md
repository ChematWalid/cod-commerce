# P1 isolation: a store owner sees only their own business

Live evidence from `scripts/evidence/P1-isolation.sh` on image commit `d0aa75b`. Data is synthetic.

Two businesses, A and B, each get two stores, an owner, a store-limited member, a custom role, a tenant secret, a
template note, a logo, a flag override and two signed demo webhooks. Then A's owner (and B's, for the cases marked
B→A) reaches for the other's data through every merchant endpoint: by id, by list, by write, and with the other's
store token. Each answer is judged (null, FORBIDDEN, a not-found code, or the caller's own data only) and scanned for
every value that identifies the other business. Result: `runs=136 failed=0 unchanged=true`.

The same cases run in CI as `apps/server/tests/e2e/p1-isolation.e2e.test.ts`.

## Matrix (entity × how the attacker reaches)

| Entity | read by id | list | write | victim channel |
|---|---|---|---|---|
| business | [✅ business(id)](api/business.md#businessby-id-a-attacks-b)<br>[✅ business(id) (B→A)](api/business.md#businessby-id-b-attacks-a) | [✅ activeBusiness](api/business.md#businessactive-a-attacks-b)<br>[✅ activeBusiness (B→A)](api/business.md#businessactive-b-attacks-a) | [✅ provisionBusiness](api/business.md#businessprovision-a-attacks-b) | [✅ activeBusiness](api/business.md#businessvictim-channel-a-attacks-b)<br>[✅ activeBusiness (B→A)](api/business.md#businessvictim-channel-b-attacks-a)<br>[✅ business(id)](api/business.md#businessby-id-victim-channel-a-attacks-b)<br>[✅ updateBusiness](api/business.md#businessupdate-victim-channel-a-attacks-b) |
| logo asset | — | — | [✅ updateBusiness(logoAssetId)](api/logo-asset.md#businessupdate-with-victim-logo-a-attacks-b)<br>[✅ createStore(input.logoAssetId)](api/logo-asset.md#storecreate-with-victim-logo-a-attacks-b)<br>[✅ updateStore(input.logoAssetId)](api/logo-asset.md#logoupdate-store-with-victim-logo-a-attacks-b) | — |
| store | [✅ store(id)](api/store.md#storeby-id-a-attacks-b)<br>[✅ store(id) (B→A)](api/store.md#storeby-id-b-attacks-a)<br>[✅ GET /store/by-id/:storeId](api/store.md#storepublic-by-id-a-attacks-b)<br>[✅ GET /store/by-id/:storeId (B→A)](api/store.md#storepublic-by-id-b-attacks-a)<br>[✅ GET /store/resolve?host=](api/store.md#storepublic-resolve-a-attacks-b) | [✅ stores](api/store.md#storelist-a-attacks-b)<br>[✅ stores (B→A)](api/store.md#storelist-b-attacks-a)<br>[✅ switchableStores](api/store.md#storeswitcher-a-attacks-b)<br>[✅ switchableStores (B→A)](api/store.md#storeswitcher-b-attacks-a) | [✅ updateStore(id)](api/store.md#storeupdate-a-attacks-b)<br>[✅ updateStore(id) (B→A)](api/store.md#storeupdate-b-attacks-a)<br>[✅ changeStoreSubdomain(id)](api/store.md#storechange-subdomain-a-attacks-b)<br>[✅ archiveStore(id)](api/store.md#storearchive-a-attacks-b)<br>[✅ createStore(input.subdomain)](api/store.md#storecreate-taken-subdomain-a-attacks-b)<br>[✅ changeStoreSubdomain(subdomain)](api/store.md#storechange-subdomain-taken-a-attacks-b) | [✅ stores](api/store.md#storevictim-channel-a-attacks-b)<br>[✅ switchableStores](api/store.md#storeswitcher-victim-channel-a-attacks-b)<br>[✅ store(id)](api/store.md#storeby-id-victim-channel-a-attacks-b)<br>[✅ createStore](api/store.md#storecreate-victim-channel-a-attacks-b)<br>[✅ updateStore(id)](api/store.md#storeupdate-victim-channel-a-attacks-b)<br>[✅ archiveStore(id)](api/store.md#storearchive-victim-channel-a-attacks-b) |
| role | [✅ businessRole(id)](api/role.md#roleby-id-a-attacks-b)<br>[✅ businessRole(id) (B→A)](api/role.md#roleby-id-b-attacks-a)<br>[✅ GET /roles/:id](api/role.md#rolerest-by-id-a-attacks-b) | [✅ businessRoles](api/role.md#rolelist-a-attacks-b)<br>[✅ businessRoles (B→A)](api/role.md#rolelist-b-attacks-a)<br>[✅ GET /roles](api/role.md#rolerest-list-a-attacks-b) | [✅ createBusinessRole(startFromRoleId)](api/role.md#rolecreate-from-victim-a-attacks-b)<br>[✅ duplicateBusinessRole(id)](api/role.md#roleduplicate-a-attacks-b)<br>[✅ updateBusinessRole(id)](api/role.md#roleupdate-a-attacks-b)<br>[✅ updateBusinessRole(id) (B→A)](api/role.md#roleupdate-b-attacks-a)<br>[✅ deleteBusinessRole(id)](api/role.md#roledelete-a-attacks-b)<br>[✅ POST /roles (startFromRoleId)](api/role.md#rolerest-create-from-victim-a-attacks-b)<br>[✅ PATCH /roles/:id](api/role.md#rolerest-update-a-attacks-b)<br>[✅ DELETE /roles/:id](api/role.md#rolerest-delete-a-attacks-b)<br>[✅ POST /roles/:id/duplicate](api/role.md#rolerest-duplicate-a-attacks-b) | [✅ businessRoles](api/role.md#rolevictim-channel-a-attacks-b)<br>[✅ businessRoles (B→A)](api/role.md#rolevictim-channel-b-attacks-a)<br>[✅ GET /roles](api/role.md#rolerest-victim-channel-a-attacks-b) |
| member | [✅ memberAccess(administratorId)](api/member.md#memberby-id-a-attacks-b)<br>[✅ memberAccess(administratorId) (B→A)](api/member.md#memberby-id-b-attacks-a)<br>[✅ memberAccess(administratorId)](api/member.md#memberowner-by-id-a-attacks-b) | [✅ memberAccess(administratorId)](api/member.md#memberown-access-a-attacks-b)<br>[✅ GET /permissions](api/member.md#membereffective-own-a-attacks-b)<br>[✅ switchableStores](api/member.md#memberswitcher-a-attacks-b) | [✅ setMemberAccess(administratorId)](api/member.md#memberset-victim-member-a-attacks-b)<br>[✅ setMemberAccess(administratorId)](api/member.md#memberset-victim-owner-a-attacks-b)<br>[✅ setMemberAccess(roleIds)](api/member.md#memberset-victim-role-a-attacks-b)<br>[✅ setMemberAccess(storeIds)](api/member.md#memberset-victim-store-a-attacks-b) | [✅ memberAccess(administratorId)](api/member.md#membervictim-channel-a-attacks-b)<br>[✅ effectivePermissions](api/member.md#membereffective-victim-channel-a-attacks-b)<br>[✅ permissionCatalog](api/member.md#membercatalog-victim-channel-a-attacks-b)<br>[✅ GET /permissions](api/member.md#memberrest-effective-victim-channel-a-attacks-b)<br>[✅ GET /permissions/catalog](api/member.md#memberrest-catalog-victim-channel-a-attacks-b)<br>[✅ effectivePermissions](api/member.md#membermember-effective-victim-channel-a-attacks-b) |
| activity log | [✅ activityLog(entityId)](api/activity-log.md#activityvictim-entity-a-attacks-b)<br>[✅ activityLog(actorAdministratorId)](api/activity-log.md#activityvictim-actor-a-attacks-b) | [✅ activityLog](api/activity-log.md#activitylist-a-attacks-b) | — | [✅ activityLog](api/activity-log.md#activityvictim-channel-a-attacks-b) |
| tenant secret | — | [✅ tenantSecrets](api/tenant-secret.md#secretlist-a-attacks-b)<br>[✅ tenantSecrets (B→A)](api/tenant-secret.md#secretlist-b-attacks-a) | [✅ deleteTenantSecret(id)](api/tenant-secret.md#secretdelete-a-attacks-b)<br>[✅ deleteTenantSecret(id) (B→A)](api/tenant-secret.md#secretdelete-b-attacks-a) | [✅ tenantSecrets](api/tenant-secret.md#secretvictim-channel-list-a-attacks-b)<br>[✅ tenantSecrets (B→A)](api/tenant-secret.md#secretvictim-channel-list-b-attacks-a)<br>[✅ setTenantSecret(input)](api/tenant-secret.md#secretvictim-channel-set-a-attacks-b)<br>[✅ deleteTenantSecret(id)](api/tenant-secret.md#secretvictim-channel-delete-a-attacks-b) |
| flag override | [✅ evaluateFeatureFlag(key, businessId)](api/flag-override.md#flagevaluate-a-attacks-b) | [✅ featureFlags](api/flag-override.md#flaglist-a-attacks-b) | [✅ setFeatureFlagOverride(input)](api/flag-override.md#flagset-override-a-attacks-b)<br>[✅ removeFeatureFlagOverride(input)](api/flag-override.md#flagremove-override-a-attacks-b)<br>[✅ updateFeatureFlag(input)](api/flag-override.md#flagupdate-a-attacks-b) | — |
| outbox and jobs | — | [✅ platformJobsHealth](api/outbox-and-jobs.md#jobshealth-a-attacks-b)<br>[✅ platformJobsHealth (B→A)](api/outbox-and-jobs.md#jobshealth-b-attacks-a) | — | — |
| inbound webhook | — | — | [✅ POST /webhooks/demo/:accountKey](api/inbound-webhook.md#webhookcross-signed-a-attacks-b)<br>[✅ POST /webhooks/demo/:accountKey (B→A)](api/inbound-webhook.md#webhookcross-signed-b-attacks-a) | — |
| account | — | [✅ accountProfile](api/account.md#accountprofile-a-attacks-b) | [✅ updateActiveAdministrator(input.emailAddress)](api/account.md#stockupdate-active-administrator-email-a-attacks-b) | [✅ accountProfile](api/account.md#accountprofile-victim-channel-a-attacks-b)<br>[✅ accountProfile (B→A)](api/account.md#accountprofile-victim-channel-b-attacks-a)<br>[✅ GET /auth/profile](api/account.md#accountrest-profile-victim-channel-a-attacks-b)<br>[✅ accountStatus](api/account.md#accountstatus-victim-channel-a-attacks-b)<br>[✅ updateAccountProfile(input)](api/account.md#accountupdate-profile-victim-channel-a-attacks-b)<br>[✅ PATCH /auth/profile](api/account.md#accountrest-update-profile-victim-channel-a-attacks-b) |
| template note | [✅ templateNote(id)](api/template-note.md#noteby-id-a-attacks-b)<br>[✅ templateNote(id) (B→A)](api/template-note.md#noteby-id-b-attacks-a) | [✅ templateNotes](api/template-note.md#notelist-a-attacks-b)<br>[✅ templateNotes (B→A)](api/template-note.md#notelist-b-attacks-a) | [✅ createTemplateNote(input)](api/template-note.md#notecreate-victim-channel-a-attacks-b) | [✅ templateNotes](api/template-note.md#notevictim-channel-a-attacks-b) |
| stock Vendure data | [✅ administrator(id)](api/stock-Vendure-data.md#stockadministrator-by-id-a-attacks-b)<br>[✅ administrator(id) (B→A)](api/stock-Vendure-data.md#stockadministrator-by-id-b-attacks-a)<br>[✅ asset(id)](api/stock-Vendure-data.md#stockasset-by-id-a-attacks-b)<br>[✅ asset(id) (B→A)](api/stock-Vendure-data.md#stockasset-by-id-b-attacks-a)<br>[✅ apiKey(id)](api/stock-Vendure-data.md#stockapi-key-by-id-a-attacks-b)<br>[✅ slugForEntity](api/stock-Vendure-data.md#stockslug-for-entity-a-attacks-b) | [✅ products](api/stock-Vendure-data.md#stockproducts-a-attacks-b)<br>[✅ products (B→A)](api/stock-Vendure-data.md#stockproducts-b-attacks-a)<br>[✅ orders](api/stock-Vendure-data.md#stockorders-a-attacks-b)<br>[✅ customers](api/stock-Vendure-data.md#stockcustomers-a-attacks-b)<br>[✅ assets](api/stock-Vendure-data.md#stockassets-a-attacks-b)<br>[✅ administrators](api/stock-Vendure-data.md#stockadministrators-a-attacks-b)<br>[✅ roles](api/stock-Vendure-data.md#stockroles-a-attacks-b)<br>[✅ channels](api/stock-Vendure-data.md#stockchannels-a-attacks-b)<br>[✅ apiKeys](api/stock-Vendure-data.md#stockapi-keys-a-attacks-b)<br>[✅ sellers](api/stock-Vendure-data.md#stocksellers-a-attacks-b) | [✅ createChannel](api/stock-Vendure-data.md#stockcreate-channel-a-attacks-b)<br>[✅ updateChannel](api/stock-Vendure-data.md#stockupdate-channel-a-attacks-b)<br>[✅ createRole](api/stock-Vendure-data.md#stockcreate-role-a-attacks-b)<br>[✅ createRole (B→A)](api/stock-Vendure-data.md#stockcreate-role-b-attacks-a)<br>[✅ updateRole](api/stock-Vendure-data.md#stockupdate-role-a-attacks-b)<br>[✅ deleteRole](api/stock-Vendure-data.md#stockdelete-role-a-attacks-b)<br>[✅ createAdministrator](api/stock-Vendure-data.md#stockcreate-administrator-a-attacks-b)<br>[✅ updateAdministrator](api/stock-Vendure-data.md#stockupdate-administrator-a-attacks-b)<br>[✅ assignRoleToAdministrator](api/stock-Vendure-data.md#stockassign-role-a-attacks-b)<br>[✅ createApiKey](api/stock-Vendure-data.md#stockcreate-api-key-a-attacks-b)<br>[✅ deleteApiKeys](api/stock-Vendure-data.md#stockdelete-api-keys-a-attacks-b)<br>[✅ createSeller](api/stock-Vendure-data.md#stockcreate-seller-a-attacks-b)<br>[✅ createCustomer](api/stock-Vendure-data.md#stockcreate-customer-a-attacks-b)<br>[✅ updateGlobalSettings](api/stock-Vendure-data.md#stockupdate-global-settings-a-attacks-b) | [✅ activeChannel](api/stock-Vendure-data.md#stockactive-channelvictim-channel-a-attacks-b)<br>[✅ activeChannel (B→A)](api/stock-Vendure-data.md#stockactive-channelvictim-channel-b-attacks-a)<br>[✅ me](api/stock-Vendure-data.md#stockmevictim-channel-a-attacks-b)<br>[✅ activeAdministrator](api/stock-Vendure-data.md#stockactive-administratorvictim-channel-a-attacks-b) |

## Every business had something to take

Rows per business in each P1 tenant table, counted after seeding:

| Table | Rows of A | Rows of B |
|---|---|---|
| `business` | 1 | 1 |
| `administrator` | 2 | 2 |
| `store` | 2 | 2 |
| `business_role` | 8 | 8 |
| `role_binding` | 2 | 2 |
| `member_role_assignment` | 2 | 2 |
| `activity_log` | 2 | 2 |
| `tenant_secret` | 1 | 1 |
| `tenant_data_key` | 1 | 1 |
| `feature_flag_override` | 1 | 1 |
| `inbound_webhook` | 2 | 2 |
| `outbox_event` | 2 | 2 |
| `outbox_delivery` | 2 | 2 |
| `template_note` | 1 | 1 |

Each owner's view of its own business (business, stores, roles, member access, secrets, notes, profile) was read
before and after the attacks and is unchanged (`unchanged=true` above).

## Screens

`screens/<page>-<lang>-<viewport>.png`: owner A's home, store switcher (open), settings, roles and
activity log, in Arabic RTL and English, desktop (1280 px) and mobile (390 px), and B's store opened by direct URL
(not found). The script fails if a screen shows any of B's names, or if the switcher misses A's stores.

- [`activity-log-ar-desktop.png`](screens/activity-log-ar-desktop.png)
- [`activity-log-ar-mobile.png`](screens/activity-log-ar-mobile.png)
- [`activity-log-en-desktop.png`](screens/activity-log-en-desktop.png)
- [`activity-log-en-mobile.png`](screens/activity-log-en-mobile.png)
- [`home-ar-desktop.png`](screens/home-ar-desktop.png)
- [`home-ar-mobile.png`](screens/home-ar-mobile.png)
- [`home-en-desktop.png`](screens/home-en-desktop.png)
- [`home-en-mobile.png`](screens/home-en-mobile.png)
- [`not-found-store-of-b-ar-desktop.png`](screens/not-found-store-of-b-ar-desktop.png)
- [`not-found-store-of-b-ar-mobile.png`](screens/not-found-store-of-b-ar-mobile.png)
- [`not-found-store-of-b-en-desktop.png`](screens/not-found-store-of-b-en-desktop.png)
- [`not-found-store-of-b-en-mobile.png`](screens/not-found-store-of-b-en-mobile.png)
- [`roles-ar-desktop.png`](screens/roles-ar-desktop.png)
- [`roles-ar-mobile.png`](screens/roles-ar-mobile.png)
- [`roles-en-desktop.png`](screens/roles-en-desktop.png)
- [`roles-en-mobile.png`](screens/roles-en-mobile.png)
- [`settings-ar-desktop.png`](screens/settings-ar-desktop.png)
- [`settings-ar-mobile.png`](screens/settings-ar-mobile.png)
- [`settings-en-desktop.png`](screens/settings-en-desktop.png)
- [`settings-en-mobile.png`](screens/settings-en-mobile.png)
- [`switcher-open-ar-desktop.png`](screens/switcher-open-ar-desktop.png)
- [`switcher-open-ar-mobile.png`](screens/switcher-open-ar-mobile.png)
- [`switcher-open-en-desktop.png`](screens/switcher-open-en-desktop.png)
- [`switcher-open-en-mobile.png`](screens/switcher-open-en-mobile.png)
