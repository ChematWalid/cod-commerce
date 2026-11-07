# Base repo evaluation

Date: 2026-11-06. Candidates: the e-commerce repos starred by ChematWalid (13 of 57 stars). Each shortlisted repo was checked against the current code and docs, and scored against [feature-inventory.md](feature-inventory.md).

## Shortlist and why

| Repo | Kept? | Reason |
|---|---|---|
| vendurehq/vendure | ✅ | TypeScript, plugin-first, channels |
| bagisto/bagisto | ✅ | MIT, Laravel, Arabic/RTL, COD built in |
| medusajs/medusa | ✅ | TypeScript, modular, very active |
| spree/spree | ✅ | Multi-store history, React admin in 6.0 |
| saleor/saleor | ✅ | Strong GraphQL commerce core |
| Sylius/Sylius, shopware/shopware, solidusio/solidus | ❌ | Same class as the above but weaker on SaaS tenancy and COD; Shopware's extras are commercial |
| magento/magento2, opencart/opencart | ❌ | Heavy (Magento) or dated (OpenCart) PHP stacks; poor fit for a multi-tenant SaaS |
| shopizer-ecommerce/shopizer, BroadleafCommerce | ❌ | Java; Shopizer inactive since 2025-03; Broadleaf CE has no clear open license |
| reactioncommerce/reaction | ❌ | Discontinued |

## Comparison (scores 1–10)

| Criterion | Vendure | Bagisto | Medusa | Spree | Saleor |
|---|---|---|---|---|---|
| Version checked | 3.8.1 | 2.5.1 | 2.22.4 | 6.0.3 | 3.23.47 |
| Stack | TS · NestJS · GraphQL · TypeORM · React admin | PHP 8.4 · Laravel 13 · Blade/Vue · MySQL | TS · Node · MikroORM · React admin | Rails 8.1 · React admin · Next.js storefront | Python · Django · GraphQL · React admin |
| License | GPLv3 / commercial dual | MIT | MIT + proprietary RBAC/SSO paths | BSD-3 (multi-tenant is Enterprise) | BSD-3 (storefront FSL) |
| Feature coverage | 4 | 4 | 5 | 4 | 3 |
| Stack / code quality | 9 | 8 | 9 | 8 | 8 |
| License fit | 7 | 9 | 6 | 6 | 7 |
| Activity | 9 | 9 | 10 | 9 | 9 |
| Multi-store / tenant (open source) | 6 | 3 | 2 | 3 | 2 |
| i18n / Arabic RTL | 7 | 9 | 7 | 6 | 4 |
| Extensibility | 9 | 8 | 9 | 8 | 7 |
| **Overall** | **6.5** | **6** | **5** | **5** | **4** |
| Effort to full inventory (person-weeks, est.) | 75–100 | 70–100 | 70–100 | 80–110 | 70–100 |

## Feature gap matrix

✅ covered · 🟡 partial · ❌ missing

| # | Area | Vendure | Bagisto | Medusa | Spree | Saleor |
|---|---|---|---|---|---|---|
| 1 | Accounts, business, SaaS billing | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 |
| 2 | Home dashboard (COD KPIs, Needs-you queue) | 🟡 widget API | 🟡 | ❌ | 🟡 | ❌ |
| 3 | Orders & call-centre confirmation | 🟡 custom order states | 🟡 | 🟡 | 🟡 | 🟡 |
| 4 | Customers & spam protection | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 |
| 5 | Tracking, returns, exchanges | 🟡 | 🟡 RMA | 🟡 returns/exchanges | 🟡 returns/exchanges | 🟡 |
| 6 | Delivery (carriers, wilaya pricing) | 🟡 calculator + fulfillment handler | ❌ flat/free only | 🟡 provider interface | 🟡 provider contract | 🟡 |
| 7 | Products, collections, offers | ✅ | ✅ | ✅ | ✅ | ✅ |
| 8 | Store, themes, builder, storefront | ❌ | 🟡 home sections only | ❌ | ❌ (removed in 6.0) | ❌ |
| 9 | Inventory | 🟡 | 🟡 | ✅ | ✅ | 🟡 |
| 10 | Finance | ❌ | ❌ | ❌ | ❌ (margin report only) | ❌ |
| 11 | Analytics | ❌ | 🟡 | ❌ | 🟡 | ❌ |
| 12 | Team, roles, distribution | 🟡 custom permissions, channel roles | 🟡 ~186 ACL keys | 🟡 RBAC is proprietary | 🟡 coarse | 🟡 ~28 perms |
| 13 | Apps & integrations | 🟡 MCP plugin, events | 🟡 | 🟡 | 🟡 webhooks, MCP | 🟡 app platform |
| 14 | Sourcing | ❌ | ❌ | ❌ | ❌ | ❌ |
| 15 | Mobile / extension | ❌ | ❌ | ❌ | ❌ | ❌ |

Missing everywhere, so built by us whichever base we pick:
- Business → Stores SaaS tenancy with subdomains and custom domains; plans, quotas and trial, with phone masking when over quota.
- The COD confirmation workflow: assignment and distribution, duplicates, abandoned checkouts, spam rules, bans.
- Algerian carriers (Yalidine/Ecotrack adapters), 58 wilayas and communes, home / stop-desk pricing, carrier cash and payouts.
- The visual builder, themes and per-product landing pages.
- Finance (profit, expenses, ad spend, wallets, simulator) and the COD analytics reports.

## Revision after the second pass (2026-11-07)
The interactive pass showed that the parts no base covers are bigger than first estimated:
- offer engine with signed quote tokens and upsell nudges;
- spam engine with device and velocity rules;
- block-based landing pages and the full theme builder;
- automatic wallet ledger and P&L;
- carrier failure taxonomy and per-carrier credentials.

What the bases give us (catalog, variants, stock, promotions, auth, admin shell) is now a smaller share of the whole, so feature coverage drops for every repo. The ranking does not change.

| Criterion | Vendure | Bagisto | Medusa | Spree | Saleor |
|---|---|---|---|---|---|
| Feature coverage (was) | 4 → **3** | 4 → **3** | 5 → **4** | 4 → **3** | 3 → **2** |
| Fit for the discovered features (new) | **8**: Promotion conditions/actions map to the 7 offer kinds; stock locations map to locations and transfers; custom permissions map to the 93-permission catalog | 6: cart rules are less flexible; Blade storefront would be replaced anyway | 7: promotion module is good, RBAC is Enterprise | 5 | 5 |
| **Overall** | 6.5 → **6.5** | 6 → **5.5** | 5 → **5** | 5 → **4.5** | 4 → **4** |

A greenfield build (Next.js + NestJS + Postgres, which is Tassyir's own shape: snowflake IDs, `/business/:id/...` REST, Bearer JWT) is now a closer second. Vendure remains the pick because it supplies a tested catalog, variant, stock, promotion and auth core plus an admin shell, and everything Tassyir-specific can live in plugins.

## Recommendation: Vendure

Every candidate leaves about 60% of Tassyir as new code, so the deciding factors are how well each base takes that new code without forking its core, plus tenancy and Arabic.

1. **Plugin-first architecture.** Custom entities, GraphQL extensions, custom permissions, event bus, job queues and React dashboard extensions all fit in plugins. Each Tassyir module (confirmation, carriers, finance, analytics, builder) becomes its own plugin and core stays untouched, which keeps upgrades cheap.
2. **Best open-source multi-tenant starting point.** Channels with channel-scoped roles map to Store; we add a Business entity and host-to-channel routing (est. 6–10 person-weeks). Every other candidate either needs a deep retrofit (Medusa, Saleor) or sells tenancy as a paid closed add-on (Bagisto, Spree).
3. **Clean extension points for COD:**
   - COD is a `PaymentMethodHandler`.
   - Yalidine/Ecotrack fit as a `FulfillmentHandler` plus a job-queue poller.
   - Per-wilaya pricing is a `ShippingCalculator`.
   - The confirm → dispatch → deliver/return flow is a custom `OrderProcess`.
4. **Arabic/RTL is already in the new React dashboard**, and the same TypeScript runs end to end (NestJS backend, React admin, Next.js storefront). That matches Tassyir's own stack.
5. **License:** GPLv3 does not require publishing code for a hosted SaaS. Keep core unmodified and put all our code in plugins (the plugin exception allows any license). Have a lawyer confirm before launch, and buy the commercial license if we ever ship self-hosted installs.

**Runner-up: Bagisto**, if the team prefers PHP/Laravel. It is MIT, has the best Arabic/RTL and ships cash on delivery. But the open-source core has no tenancy, and adding it across 40 packages carries a high data-leak risk.

**Builder plan whatever the base:** a Next.js storefront plus an open-source visual editor (e.g. Puck, MIT), storing page JSON per store. None of the candidates has a usable builder.

**Alternative worth naming:** a greenfield Next.js + Postgres build. The bases mainly save the catalog, promotions, inventory, auth and admin shell (about 15–25 person-weeks). Vendure still wins because those parts are mature and well tested.
