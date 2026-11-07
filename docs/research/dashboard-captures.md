# Dashboard captures (raw notes)

Read-only exploration of the logged-in Tassyir dashboard on 2026-11-06. Only structure is recorded (headings, tabs, buttons, columns, fields, endpoints); no customer data.
Base route: `/[locale]/dashboard/:businessId/...`. Store-scoped pages: `/stores/:storeId/...`.
Frontend: Next.js App Router (Turbopack build). Client data via same-origin proxy `/_api/*` → `api.tassyir.io`. Store/product pages load data server-side (RSC), so no client XHR is visible there.
Global calls on every page: `/_api/auth/profile`, `/_api/admin/whoami`, `/_api/business/:id/notifications`, `/_api/business/:id/credits/balance`, `/_api/business/:id/spam/summary`, `/_api/provinces`.
Top bar: sidebar toggle, AI credits counter + "Add credits", "Ask Tassya" (AI assistant), notifications bell, user menu, store switcher (multi-store, shows subdomain).

## Sidebar
Home · Orders (Customers, Spam) · Tracking (Returns) · Products (Collections, Offers, Themes, A/B Testing) · Analytics (Team stats, Marketing) · Inventory (Packaging, Movements) · Finance (Costs, Products, Wilayas, Ads, Wallets, Product study) · Team (Order distribution, Roles & Permissions) · Delivery & Shipping · Apps · Sourcing · Settings (Pixels & Tracking, Domains, Plan & Billing, Status customization, Stock locations, Spam protection)

## Home `/dashboard/:id`
- Greeting + Store / Reports buttons.
- "Today" KPIs: Orders today (+Δ vs same time yesterday), Confirmed (% of today), Returned today, Delivered today.
- "Needs you" action list with deep links: N new orders to call → orders?tab=to-confirm; N confirmed not dispatched → orders?tab=ready; N parcels not moving → tracking?late=1; DZD X held by carrier, no payout for N days → Record collection; N returns to process → tracking/returns; N checkouts abandoned today → orders?status=abandoned&date.
- "Money on the way": held by carriers (per carrier, overdue payout flag, parcel count), still on the road (parcels, amount).
- "Today on the map" (wilaya map).
- "Last 7 days": total / confirmed / delivered / cancelled orders → Analytics.
- "Next steps" nudges (e.g. "profit counts N products as free — add buy price").
- API: `/business/:id/home?storeId`, `/analytics/overview?startDate&endDate&comparison`, `/stores/capi-health`, `/delivery-agents`, `/orders/returns?...returnedAt[gte|lte]`.

## Orders `/orders`
- Buttons: Create Order, Watch Tutorial, Export, Dispatch Orders, Assign Orders, Change Status (bulk), Ask Tassya about your orders.
- Tabs: All, To confirm, Callbacks, Ready to ship (with counts). Date preset "Today".
- Filters: Store, Status, Stock (All / Short on stock), Date (Last 24h, 7/30/90 days, 1 year, calendar range), Wilaya (58), Product (picker with variants), Assignee, Delivery Type (Stopdesk / Home), Duplicates (All / Only / Hide), Offer, Code (promo code), Has discount, Item Count (range).
- Status filter options: Pending, Confirmed, Scheduled, Canceled, Abandoned + custom statuses (merchant-defined, e.g. "no answer ×2").
- Search: order number, customer, phone, product.
- Columns: Order Number, Customer, Items, Delivery, Status, Assignee, Total, Actions. Row actions: Call, Confirm Order, Edit Order, status pill (inline change), "Returning·N" badge. Pagination, page size 20, row selection.
- Export dialog: scope (All orders / This page), template (Everything / Delivery sheet / Accounting), format (Excel / CSV).
- Change Status dialog (bulk): Confirmed, Cancelled, custom statuses.
- API: `/orders?page&limit&excludedStatuses`, `/cancel-reasons?includeArchived`, `/employees/order-managers`.

## Create order `/orders/create`
- Products section: Browse → "Add Product to Order" dialog (search name/SKU/barcode, products expand to variants, multi-select, Add); line items with qty +/−, Remove.
- Customer: "Add Customer Details" dialog: Full Name*, Phone*, Province (wilaya)*, Town (commune)* (depends on province), Address*, Delivery Method* (At Home / Stopdesk).
- Notes. Cancel / Create order.

## Order detail `/orders/:orderId`
- Header: order number, Complete, Edit Order, More actions. Meta: created at, delivery status pill (e.g. Delivered), payment status pill (e.g. Awaiting Carrier Payment).
- Totals: Subtotal, Shipping, Total (item count).
- Order Items (variant, qty, unit, line total).
- Timeline: status transitions with relative time and duration in each stage (Pending → Confirmed → Dispatched …) + internal comments ("Only you and other staff can see comments", Post).
- Client Information: name, phone, wilaya/commune, buyer record (N orders · N delivered · N returned), View customer, Edit Contact Information, Ban Customer.
- Additional Information: Assigned to (select), how it got here (Automatically / manual), Assignment history, Parcel opening (allowed / not, per carrier setting), Order source (came in through: store / dashboard / integration; traffic source + campaign/ad / UTM).
- More actions menu: set custom status, Schedule order, Exchange order, Add a discount (disabled once with carrier), Duplicate order, Trust this device, Cancel order.
- API: `/orders/:id/exchange-prefill`, `/orders/:id/custom-fields`, `/employees/order-managers`.

## Customers `/orders/customers` (+ `/orders/customers/:id`)
- Tabs: All, Repeat, New, Returned an order, Blocked. Filters: Store, Order status, Orders, Returns, Spent, Last order, Wilaya, Sort by. Export. Search name/phone.
- Columns: Customer, Wilaya, Orders, Delivery record, Spent, Last order.
- API: `/customers?page&limit&view&sortBy&sortOrder`.

## Spam `/orders/spam`
- Held orders list; views List / By device; Store filter; link to spam settings.
- API: `/spam/held?limit`, `/spam/rules`.

## Tracking `/tracking`
- Tabs: Active, Awaiting validation, On the way, Delivered, All. Filters: Store, Status, Movement (late), Payment (carrier payout), Wilaya, Dispatched (date), Assignee, Delivery Type, Item Count. Refresh, Export. Search order/phone/name/tracking no.
- Columns: Order Number, Dispatched, Products, Customer, Shipment (carrier + tracking no, copy), Tracking Status, Total.
- Deep-link params: `late=1`, `view=preparing|all`, `payout=`, `carrier=`, `dateFrom/dateTo`.
- API: `/orders/tracking?page&limit&view`, `/delivery-agents`.

## Returns `/tracking/returns`
- Scan returns (barcode). Tabs: To process, Processed, All. Filters: Store, Wilaya, Return Date, Product, Sort. Columns: Order Number, Customer, Returned Items, Carrier (+tracking), Return Date, Action (Process).
- API: `/orders/returns?page&limit&excludedStatuses&sortBy&sortOrder`, `/inventory/locations`.

## Products `/stores/:storeId/products`
- Import Products, Export, Create Product, tutorial. Tabs All / Draft. Filters: Collection, Brand, Tag. Search name/SKU/barcode.
- Columns: Product, Status, Price, Collections, Created, Actions (Preview, Edit, Actions menu).
## Collections `/stores/:storeId/categories` — Create collection.
## Offers `/stores/:storeId/offers` — Create offer (quantity offers, free delivery, discounts, codes per permissions).
## Themes `/stores/:storeId/themes`
- Current theme card: History, More actions, open builder `/stores/:storeId/builder/home`.
- My themes (Try on my store, Apply), Discover themes → `/themes/marketplace`, `/themes/marketplace/:handle` (nocturne, nocturne-ar, merino, merino-ar, focal, linden, …).
## A/B Testing `/stores/:storeId/ab-tests` — "Test a landing page against your product page", Create test.

## Analytics `/analytics`
- Tabs Overview / Marketing. Date range presets + compare period, store filter. AI prompts: "Why did my numbers change?", "Where am I losing orders?".
- KPI cards: Orders placed, Confirmation rate, Delivery rate, Delivered sales, Avg delivered order.
- "Orders placed, by where they are now" stacked per day: Delivered, Returned, On the way, To ship, To confirm, Cancelled.
- Funnel: Orders → Confirmed % → Delivered % → Sales → Average. "Where orders are lost" (cancel reasons).
- Report cards → `/analytics/reports/{products|wilayas|carriers|team}`.
- API: `/analytics/overview`, `/analytics/cancel-reasons?startDate&endDate`.
### Reports (each: Export, date range + compare, store filter, chart top 10, table with "before" + Change, Open → filtered list)
- Products: Product, Orders, Confirmation rate, Delivery rate, Delivered, Returned, Delivered sales.
- Wilayas: Wilaya, Orders, Confirmation rate, Finished, Delivered, Returned, Delivery rate, Delivered sales.
- Carriers: Carrier, Shipped, Days to deliver, Delivered, Returned, Delivery rate, Delivered sales, Cash held.
- Team: Agent, Orders, Confirmation rate, Time to confirm or cancel, Delivered share, Waiting, Cancelled, Delivered, Returned.
### Marketing `?tab=marketing`
- Filters: store, date, product, platform (All / Meta / TikTok). Tree table by Source → campaign → ad: Conversion, Confirmed, Delivered, Spend, Cost / delivered. Conversion funnel. Search campaigns and ads.
- API: `/analytics/marketing?startDate&endDate&compare&series&includeInactive`, `/integrations/facebook-ads/status`, `/integrations/tiktok-ads/status`.

## Inventory `/inventory`
- Tabs: Products, Packaging, Movements (Returns moved to Tracking). Import stock sheet, Export, Add Stock. Filters Store, Stock status; Expand all variants.
- Products columns: Products, On shelf, At carrier, Damaged, Cost / unit, Actions.
- Packaging columns: Packaging, Available Stock, Transit, Delivered, Damaged, Unit Price, Actions; Add Packaging. API `/inventory/packages`.
- Movements columns: Type, item, Direction, Reason, Note, Price, Date (links to order). API `/inventory/history?page&limit`.
- API: `/inventory/locations?includeInactive`.

## Finance `/finance`
- Tabs: Report, Costs, Products, Wilayas, Ads, Wallets, Product study. Record collection (carrier cash collection). Date presets Today / Last 7 days / This month / Last month / Custom.
- Report: "Missing from this profit" (add buy prices / I have none / add a cost, Reconnect ad account), KPI tiles (Profit per delivered order, Ad cost per delivered order, Delivery rate, Confirmation rate), Profit report waterfall (Collected revenue − Product cost − Delivery net − Returns = Gross profit − Ad spend − Expenses), "Money in, money out", "Your money right now".
- Costs: expenses table (Expense, Type, Category, Amount, Next due, Status; recurring), Add expense, ad-spend records (Record), "Your exchange rates" (Set rate, USD→DZD for ad spend). API `/expenses`, `/finance/ads-spend`.
- Products: All / Losing money; columns Product, Delivered, Delivery rate, Collected, Per delivered order, Product profit; "Spread shared costs over the products" toggle. API `/finance/products`.
- Wilayas (per product): Wilaya, Delivered, Delivery rate, Per delivered order, Profit before ads; sort most profit / lowest delivery. API `/finance/products/:id/wilayas`.
- Ads (per product): Ad, Orders, Delivered, Ad cost, Cost per order, Profit after its cost; break-even cost per order. API `/finance/products/:id/ads`.
- Wallets `/finance/wallets`: New wallet, pots (Cash, …), Record what you actually have (reconcile), Add cash, Spend; ledger Date, Movement, Pot, By, Amount; filters pots/types/In/Out; "What's coming". API `/finance/wallets/funding`.
- Product study `/finance/simulator`: New study (profit simulator).
- Campaigns `/finance/campaigns`: "Link ads to products".
- API: `/finance/cashout/delivery/payouts`, `/finance/campaigns?startDate&endDate&view`.

## Team `/team`
- Tabs: Team Members, Order distribution, Roles & Permissions. Invite Team Member. Member tabs All / Active / Pending / Inactive; search.
- Members columns: Employee, Roles, Salary (DZD), Status, Orders, Store access, Joined, Actions (Pay salary, menu: View Details, Edit, Set limit, Stop receiving orders).
- Invite dialog: Email*, Roles*, Store access (All / Only these stores), Base Salary (DZD)*, Commission Structures (Add Commission).
- Order distribution: mode Evenly (fewest open orders) / In turn (round-robin) / Nobody (manual); "When is an order taken back?" (reclaim timeout); Exceptions (rules). API `/orders/assignment-settings`, `/assignment-settings/summary`, `/orders/assignment-rules`.
- Roles: built-in Owner, Manager, Order Manager, Inventory Manager, Accountant, Orders Tracker, Store Manager; table Role, Members, Access, Updated; Create role.
- New role dialog: Name, Description, Start from (template), per-area None / View / Full, per-permission toggles, "Sensitive" flag:
  - Orders (19): create, view, view every member's orders*, delete*, edit, send to delivery, mark delivered, print labels, confirm, cancel*, schedule, create returns*, process returns, view returns, comment, delete comments*, give discount*, view customers, block customers & edit notes.
  - Order tracking (3): view, track every member's orders*, update tracking status.
  - Products & catalog (8): add/view/delete*/edit products; create/view/delete*/edit collections.
  - Offers (4): create/view/delete*/edit.
  - Inventory (4): add stock, view stock, adjust stock, see buy prices*.
  - Finance (7): add/view/delete* finance records; add/view/delete*/edit expenses.
  - Analytics (2): view analytics, view visitors.
  - Team & roles (12): invite/view/remove*/edit members; create/view/delete*/edit roles; set/view/delete*/edit commissions.
  - Delivery (8): connect/view/delete*/edit carriers; create/view/delete*/edit delivery pricing.
  - Store & storefront (15): create stores, view stores, edit store settings, open builder, edit store pages, publish*, discard*, create/view/delete*/edit landing pages, connect/view/remove*/edit domains.
  - Apps & integrations (8): view/connect/manage/disconnect* apps, view/manage WhatsApp, request/view cargo shipments.
  - Settings (3): view business details, edit business/plan/billing*, view activity log.

## Delivery & Shipping `/delivery`
- Tabs Carriers / Delivery Pricing (`?tab=pricing`).
- Carriers columns: Delivery Agent, System, Status, Created, Actions (Edit, Refund Rates, Delete). Add Delivery Agent.
- "Connect a delivery agent" picker: Private Courier, Yalidine Express, TSL Express (Ecotrack), DHD Express (Ecotrack), Ecotrack (generic), Elogistia, Anderson (Ecotrack), Maystro Delivery, ZR Express (new), Economiqua (Yalidine platform), Navex Delivery (Ecotrack), NOEST, Goupex (Yalidine platform), 48HR 2 Express (Ecotrack), 48HR Express (Ecotrack), Ecom Delivery V2, WeCan Services (Yalidine platform), Zimou Express, Osen Express. → carrier "systems" = Yalidine API, Ecotrack API, plus custom APIs.
- Delivery Pricing: Store filter, search, Add pricing option; columns Pricing Option, Delivery Agent, Created, Actions (Edit, Delete).
- New pricing option: Name, Carrier (or No carrier), Charge overweight to the customer, Prices by wilaya table for all 58 wilayas with Home delivery / Stop desk price, Apply to all, Deliver to every wilaya, Stop desk in every delivered wilaya, per-wilaya stop-desk toggle.
- API: `/delivery-fees/v1?page&limit`, `/delivery-fees`.

## Apps `/apps`
- Groups: AI assistants (Claude, ChatGPT), Marketing & messaging (Meta, TikTok Ads), Store platforms (YouCan, Shopify, WooCommerce), Orders & data (Google Sheets, Order Dz). Manage / Connect.
- Google Sheets `/apps/google-sheets`: Export destinations (New sheet), Import orders from a sheet (Connect a sheet, example sheet).
- WooCommerce `/apps/woocommerce/:id`.
- API: `/apps`, `/shopify/stores`, `/order-dz/integrations`, `/mcp/connections?businessId`, ads integration status.

## Sourcing `/sourcing`
- "Import from China, without the logistics": New request; cargo rates. API `/cargo/rates`.

## Store settings `/stores/:storeId/store_settings`
- Tabs: Profile, Pixels & Tracking, Domains, Plan & Billing, Status customization, Stock locations, Spam protection.
- Profile: Store Identity (logo upload, Store Name, Description, Store language AR/FR/EN), Operations (Delivery Fee Group, default Delivery agent, Show Address Field), Sold-out products (Keep showing / Hide). API `/stores/:id`, `/delivery-fees`, `/stores/:id/sold-out-products`.
- Pixels & Tracking: Ad pixels (Meta, TikTok, Snapchat, Google Ads), Analytics & tags (Google Analytics, Google Tag Manager), Product catalog feed URL (copy). API `/stores/:id/meta-capi/health`.
- Domains: subdomain Change, Connect domain. API `/domains?storeId`.
- Plan & Billing: current plan (e.g. Advanced · Monthly), Change plan, Renew early, Manage billing, Cancel renewal; This month's orders quota; AI credits (Buy credits, Credit history); Payment history. API `/billing/payments`, `/billing/subscription`, `/billing/subscription/quota`, `/plans`.
- Status customization: custom statuses table (Status, Description, Created By, Created At, Actions), Create Status; "Use label statuses" toggle; Cancel reasons (Use suggested reasons, Add reason). API `/custom-status`, `/custom-status/settings`, `/cancel-reasons`.
- Stock locations: Name, Type, Wilaya, Ships from here, Actions; Add location.
- Spam protection: Protection level (Off / Standard (recommended) / Strict); Your rules + templates ("Start from a ready-made rule", → `/settings/spam-rules/new?template&store`); Your team's devices (trusted); Daily summary (notify at 20:00); Numbers we never hold (allow-list); Blocked devices and numbers. API `/spam/settings`, `/spam/rules`, `/spam/rules/schema`, `/spam/blocks`, `/spam/trusted-devices`.

## Business settings `/settings`
- Profile: Business Logo, Business Name. Tabs Profile, Plan & Billing, Status customization, Stock locations, Spam protection. API `/businesses/:id`.

## Skipped on purpose (live account, read-only)
- Salary "Pay" dialog (blocked by safety check), any Confirm/Dispatch/Process/Save/Delete, edit dialogs on existing records.
