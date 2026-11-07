# Second pass: interactive walkthrough on the test account

Test account (owner Walid, store `test-store-walid.tassyir.io`, 7-day trial), 2026-11-06. Here actions were actually performed, so results and API payloads are recorded. Data models are in [data-model.md](data-model.md).

## Onboarding (new account)
- Register is 3 steps; step 3 is "Name your store": Store name, Store address (`<sub>.tassyir.io` with live "is available" check), Store language (العربية / Français / English, "the language your customers shop in, not the dashboard"), optional logo (≤5 MB) → Create my store.
- Trial banner: "7 days left on your free trial" + Upgrade.
- Home on an empty account: "Get your store ready for its first order" checklist (0 of 4): Add your first product (~3 min) → Connect a delivery company → Place a test order → Confirm your test order; each step has a CTA and a "Watch how" video; "Hide for now". "Needs you" and "Your numbers" show greyed **Example** data until real orders exist.

## Products
- Create: `POST /business/:bid/products` → 201 with the full product (see data model). Redirects to `/products/:id/edit`, toast "Product created successfully!".
- Image upload: drag-and-drop zone → `POST /business/:bid/upload` → CDN URL.
- Variants: Options (name + values typed with Enter, drag to reorder options and values, remove) → auto-generated variant matrix (Red/S, Red/M, Blue/S, Blue/M) with columns Variant (image), Options, SKU (auto `<sku>-n`), Custom Price, Hidden, Variant actions → "Create landing page for this variant".
- Edit page adds: Preview, Save Changes, Details / Add Landing Page tabs (landing pages only once saved), "Clean up images" and "Clean with AI" for images, **Offers** section ("Add a quantity offer", list of offers on the product), **Store page** section (which product-page template it uses, "Customize").

## Storefront order → delivered (full lifecycle, test order #00000001)
1. **Storefront form** (Arabic default theme): full name, phone (must start 05/06/07), wilaya, commune (labelled "(مكتب متوفر)" when stop-desk exists), delivery type radio with live prices (office 500 / home 800 DA), order summary with the upsell nudge "add one more piece to save 980 DA", "الدفع عند الاستلام" (COD), CTA "تأكيد الطلب". Product page also: colour/size pickers, qty, "اطلب الآن", "أضف للسلة", delivery promise, reviews, FAQ. → `/success` thank-you page.
2. **Abandoned checkout** recorded as soon as name + phone + location were filled (before submit).
3. **Spam hold**: the order was held (reasons TEST_ORDER, JUNK_PHONE); released with "Not spam" → became order **#00000001** (numbering starts on release).
4. **Order page, pending**: buttons Confirm / Edit Order / More actions. **Offers panel for the agent**: "Now: 1 piece · 2 pieces: DZD 8,820 (+3,920 for this order) · Closest offer · Switch · 3 pieces … Free delivery · Switch": the agent upsells on the call with one click. Switching edits the order; the timeline logs an audit diff ("Edited by … Total 5,700 → 9,620; Items ×1 → ×2"). Internal comments appear in the timeline.
5. **Confirm** → `POST /orders/confirm/:id` (body `{}`) → status confirmed, `confirmedAt`. Button becomes **Dispatch**.
6. **Dispatch** dialog "Select delivery agent" (customer, product, agent per row) → `POST /orders/dispatch { ids[], agentId }` → `{ message, dispatchedOrders[], nonDispatchedOrders[], failedAndUnhandled[], stockBlocked[], stockShort[], wrongPhone[], hubUnavailable[], provinceUnavailable[], townUnavailable[], productUnavailable[], carrierStockBlocked[], carrierRateLimited[], carrierAuthFailed[], carrierAuthKinds{}, deliverySystemRetired[], devStoreRestricted[], senderBalanceRequired[], freeShippingPriceMismatch[], failureReasons{}, locationShort[], validationQueued[], validationFailed[] }` (the full dispatch-failure taxonomy). Toast "Successfully dispatched 1 out of 1 order(s)". Redirects to Tracking with the parcel drawer open.
7. **Parcel drawer** (`/tracking?orderId=`): header order no., stage pill (To Desk), date, total; stepper Awaiting Validation → In Transit → Out for Delivery → Delivered; tabs Overview / History / Notes; Shipment (agent, delivery type, tracking number (private courier = order number), dispatched date); Recipient (copy phone/address); items and totals; footer **Print label**, **Undispatch**, **Update Status**.
8. **Update Status** (manual for private courier): To Desk, In Desk, In Transit, Arrived at Province, Out for Delivery, Delivered, Returned. Intermediate → `PATCH /orders/tracking/:id { trackingStatus: "OUT_FOR_DELIVERY" }`; Delivered → `POST /orders/deliver/:id`; (Returned → return flow).
Order record after delivery also has: `dispatched, dispatchedAt, validated, validationQueuedAt, trackingNumber, carrierParcelId, trackingStatus, trackingHistory[{timestamp, trackingStatus, duration}], parcelStage, parcelStageSince, notesHistory, hasNotes, lastCheckedAt, nextCheckAt (carrier polling), carrierDeletedAt, carrierDriverPhone(+At), carrierPayout, returned, returnedAt, totalWeightKg, totalVolumeCm3, assignmentHops, assignmentFlagged, lastTouchedAt/ById, canUndispatch, undispatchCarrierCleanup, attribution, history, comments, assignmentEvents`.

## Other order actions (performed)
| Action | UI | API |
|---|---|---|
| Confirm | button on pending order | `POST /orders/confirm/:id {}` |
| Dispatch | button on confirmed order → agent dialog | `POST /orders/dispatch { ids[], agentId }` |
| Set custom status | More actions → custom status names listed at top | `PATCH /orders/:id { status: "<custom name>" }` |
| Schedule callback | More actions → Schedule order → date picker | `POST /orders/schedule/:id { scheduleDate }`; header shows "Scheduled for …"; appears under Callbacks tab |
| Cancel | More actions → Cancel order → dialog "Why is this order cancelled? (optional)" listing reasons with keyboard numbers 1–7 + Note → Keep order / Cancel order | `POST /orders/cancel/:id { cancelReasonId?, note? }`; with no reasons configured it cancels instantly ("No reason given") |
| Restore cancelled | Restore button | `PATCH /orders/:id { status: "pending" }` |
| Duplicate | More actions → Duplicate order → `/orders/create?duplicate=:id` prefilled form ("Copied from order #…", original vs calculated total, "Use calculated total", also copies delivery agent) | `POST /orders/:id/duplicate { orderClient{…, shippingFee}, orderItems[], shippingPrice, total, stopdesk }` |
| Mark as spam | More actions (pending orders) | `/orders/:id/mark-spam` |
| Delivered | tracking Update Status → Delivered | `POST /orders/deliver/:id` |
| Intermediate tracking | Update Status → To Desk / In Desk / In Transit / Arrived at Province / Out for Delivery | `PATCH /orders/tracking/:id { trackingStatus }` |
| Returned | Update Status → Returned | `POST /orders/return/:id` |
| Process return | Returns → Process → dialog: returned products with qty, Damaged Quantity, "Some units didn't arrive?" → Didn't arrive ("stay counted with the carrier, not in your stock"), live split Back to stock N · Damaged N, Team notes (also shown in order comments) → Process Return | `POST /orders/returns/process/:id { products:[{ productId, variantId, totalQuantity, damageQuantity }] }` |
| Exchange | More actions → Exchange order | only for Ecotrack, Yalidine-family, ZR Express, Ecom Delivery agents (`GET /orders/:id/exchange-prefill` → `{ eligible:false, reason }`) |
| "Complete" (delivered orders) | button | `PATCH /orders/:id {status:"delivered"}` → 404 in testing (looks like a Tassyir bug) |
More-actions menu differs by state: pending = Schedule, Add a discount, Duplicate, Mark as spam, Cancel; delivered = Schedule, Exchange, Add a discount (disabled once with carrier), Duplicate, Trust this device, Cancel.

## Status settings (performed)
- "Use suggested reasons" seeds 7 Arabic cancel reasons: لم يرد على الهاتف (no answer), غيّر رأيه (changed mind), سعر التوصيل مرتفع (delivery too expensive), طلب وهمي / غير جاد (fake), طلب مكرر (duplicate), المنتج غير متوفر (out of stock), أخرى (other, asks for a note). Each shows its order count. Toggle "Require a reason when cancelling".
- Custom status: `POST /custom-status { name, description, color (#hex from 9 named colours) }` → `{ id, name, description, color, kind: "order", isActive, creator }`. Empty state "Create your first custom status".
- "Use label statuses" toggle: coloured labels on the Tracking page (kind `label`), invisible to customers; turning off hides without deleting.

## Home after activity
Once the 4 onboarding steps are done: "Your store is ready. Four steps done. Now let's get your first real order" + store link with Copy. KPIs fill with real data; "Needs you" empty state "Nothing needs you right now — every order is called and everything confirmed has shipped"; Money on the way per carrier ("Paid out today", Record collection); Today on the map ("Alger leads with 2 orders", low→high legend); Next steps nudges (e.g. "Meta Ads isn't connected → Connect").

## Cash collection and finance (performed)
- **Record a collection** dialog: which carrier paid you (held amount per carrier, "Paid out today", "Last collection: none recorded"), how much received (defaults to everything held), More options: Into wallet (or "Not into a wallet"), note → "Record DZD N". `POST /finance/cashout/delivery { deliveryAgentId, walletId, note, amount? }` → `Collection { id, deliveryAgentId, amount, currency, startDate, endDate, orderCount, transactionId, expectedAmount, difference, differenceCategory, payoutRefs, isOpeningBalance, note }`. Toast "Collection from Private Courier recorded".
- **Automatic wallet ledger** (default wallet "Cash" auto-created): Stock purchase (one per variant when stock is added at a buy price), Return fee (DZD 200 per returned parcel, default), Carrier payout (+). Columns Date, Movement (type + subject), Pot, By, Amount; totals Money in / Money out / Net change. Overdrawn warning: "usually because your starting cash was never recorded → Record what you actually have".
- **What's coming** (7/30/90 days): due expenses vs cash; empty-state nudge to add rent/salaries.
- **Profit report** for the range (worked example): Collected revenue 8,820 (100%) − Product cost 4,000 (45%, buy price at sale) + Delivery net +800 (9%) − Returns 200 (2%) = Gross profit 5,420 (61%) − Ad spend 0 − Expenses 0 = **Net profit "at most" +5,420**, "your real profit is lower: 1 cost is missing". KPIs: profit per delivered order ("Incomplete" when costs missing), ad cost per delivered order, delivery rate 50%, confirmation rate 75%. "Missing from this profit" checklist (Meta disconnected → Reconnect; no fixed costs → "I have none" / Add a cost). Chart "Money in, money out" per day (collected, costs, net). "Your money right now": live balance at carriers, working money = at carriers + on the road + in stock (items × buy price), last collection.

## Customers (with data)
- Detail page: name, phone, wilaya · commune, "Customer since", buttons **WhatsApp / Call / Create order**; KPIs Orders (N, N in progress), Delivered (x of y, % of finished), Returned (N, last on …), Spent (delivered orders only); In progress list; All orders table (Order, Date, Items, Total, Status); Contact; Addresses (wilaya · commune · home/desk, usage count); Internal note.
- More actions: Copy phone, Block customer → "Block X? New orders from this number will be refused on all your stores. The N orders already placed stay as they are." Reason: Refused delivery more than once / Fake orders / Abusive on the phone / Other; "Also cancel the order that hasn't shipped yet".

## Builder in detail (store "Custom" theme, Home page)
Top bar: theme name, Desktop / Mobile, page switcher, Ask Tassya, Undo, Redo, Preview, Publish. Left tabs: Sections / Styles / Tassya. Section list grouped "Shown on every page" (Announcement Bar, Header), "Page sections", "Footer". Keyboard: Enter opens settings, F2 renames, Alt+↑/↓ moves, Delete removes, Shift+F10 more actions. Per section: Hide, Actions menu, panel header with "Ask for changes" (AI), Hide section, Delete section.
**Shared section groups**: Appearance: colour scheme (Default / Tinted / Inverse / Accent / Custom, auto-derived from store colours), background image with overlay, shape dividers (top/bottom edge), image style (Clean / Duotone using primary colour). Spacing: top/bottom/start/end padding. Visibility: All / Desktop only / Mobile only.
**Section settings**:
- Hero Banner: carousel mode; headline, subheading, button text and link; background; layout (centered…), text alignment, vertical position; button shadow; button style Primary/Secondary/Outline; height S/M/L/Full screen.
- Header: store name, logo; logo position on computers (start / center / above menu); phones (icons first / menu first); height Compact/Normal/Tall; sticky on scroll (hide / stay visible); show search, show cart; navigation links with dropdown links; menu text.
- Product grid: title and alignment; product source (all products / selection), count 4/8/12, order; carousel; cards per phone/tablet/computer; peek next card; arrows; indicator (none/dots/scrollbar); card style (store card or customise); "View all" link (link/filled/outline).
- Collections: title; which collections (all or chosen + order); display Row/Grid/List; columns computer 2–4 / phone 1–2; name on/under photo; photo shape; name alignment; button text; stagger columns; zoom on hover; product count.
- Image with Text: image ("use a real photo — exaggerated images cause delivery refusals"), title, text, text colour, button text/link (default `#in-page-checkout-block`), button style; style Side by side / Overlap / Full bleed; image side, ratio, vertical align, card behind text.
- Trust Badges: display Row; badges with icon (cash on delivery, truck, easy returns…), title, subtitle; Add badge.
- Reviews: title, layout carousel, sort manual, show rating summary / dates / wilaya; reviews with rating, name, wilaya, text, photo or **chat screenshot**, date, verified badge ("real photo reviews in your dialect sell more").
- FAQ: title, line under title, alignment, open first item, style Divided/Cards, layout Questions only / Beside a photo; Q&A list.
- Footer: layout One line / Stacked / Columns; footer text; social links (Facebook, Instagram, WhatsApp number).
**Styles**:
- Colors: brand colour, accent colour, canvas Light/Dark; harmonized palettes from your colour or ready-made (Warm, Cool, High-contrast, Soft, Mono); Advanced colours.
- Typography: font pairings (Cairo; Changa·Cairo; Cairo·Tajawal; Rubik·Almarai; Changa·Almarai; Tajawal·Cairo; Reem Kufi·Cairo), **Direction RTL/LTR**, body/heading font, heading weight, body size, section title size, section labels style and case.
- Buttons & corners: style Solid/Outline/Soft, size, border radius; secondary button; **Order button** (size, weight: "Buy now and the checkout button"); buttons on inverse sections.
- Components: global **product card** (style Default/Minimal/Bordered, ratio 1:1/3:4/adapt, hover zoom/second photo, spacing, name/price size, hover lift, shadow, arrow, show price/badge/discount badge/rating/brand/highlights/buy button + when), badges (fill, size, corners), fields (corners, fill page/surface), option buttons (outline/filled), **filters** for collection/search pages (groups style, open first, values auto/checkboxes/pills/colour swatch, swatch shape/size).
- Layout & motion: spacing Tight/Balanced/Airy; content width; photo corners; shadows; motion None/Subtle/Lively.
- Page code: custom JavaScript per store (runs only on the published store; `?nocode` disables it; "Ask Tassya" to write it).
- Advanced: advanced mode (custom CSS per block), reset store to defaults.

## Builder page templates
Page switcher: Home · Product pages (Default product page — "N products" using it; New product page) · Collection · Checkout · Success · Search. Product pages have a "preview with product" picker and **"Customize for this product only"** (forks the template into a per-product page). Banner "Default product page — changes here apply to N products". Status pill "Not published yet" when the draft differs.
| Template | Sections |
|---|---|
| Home | Announcement Bar, Header, Hero Banner, Product grid, Collections, Image with Text, Trust Badges, Reviews, FAQ, Footer (default "Custom" theme) |
| Product page | Announcement Bar, Header, **Gallery**, **Product Info**, **In-Page Checkout**, Description, Product grid (similar products), Reviews, FAQ, Footer |
| Collection | Announcement Bar, Header, **Collection header**, Product grid, Footer |
| Checkout (cart) | Announcement Bar, Header, In-Page Checkout, Trust Badges, Footer |
| Success | Announcement Bar, Header, **Success Message**, Footer |
| Search | Announcement Bar, Header, Product grid (search results), Footer |
Product-page section settings:
- **Gallery**: carousel mode, ratio 1:1/3:4/4:3/adapt, zoom, thumbnails (count), indicator dots/bar/none, arrows + style circle/square/minimal.
- **Product Info**: Order now button + CTA text, quantity selector (compact/full width, label), Add to cart button (style), button order (order first / cart first), name size, badge + text, brand, highlights, SKU, delivery note, variant picker (buttons/dropdown), pre-select first available variant.
- **In-Page Checkout (COD form)**: title, submit button text; form style; button animation; delivery method selected by default (Desk/Home), option style buttons/list, show each option's price; name + phone on one row; show order summary; quantity selector in summary; let buyers choose each item's options; field icons; **show address field**; **show note field**; show expected delivery date; **sticky order button** + text.
- Description: show title, alignment.
Builder **Tassya** tab (Beta): "Let's design it together — nothing goes live until you publish", suggestion chips ("Make my store feel more premium", "Add a reviews section under the banner", "Use my brand colour across the store").

## Landing pages (performed)
- Product edit → **Add Landing Page** → dialog "What does this page sell? Whole product / Chosen variants", name → Create. `POST /business/:bid/landing-pages { productId, storeId, name, deliveryAgentId, bgColor, layout:[{ type: "checkout", order, title, bgColor, primaryColor, titleColor, hasAddress, showQuantity }], button:{ text, bgColor, textColor }, isActive }` → `LandingPage { id, productId, storeId, deliveryFeeGroupId, deliveryAgentId, deliverySpeeds, defaultDeliverySpeed, bundleId, offerMode: product, offerId, scopeOptionValueIds[], scopeVariantKeys[], name, layout[], button, customCss, isActive }`.
- Each landing page is a tab on the product edit page (`?landingPage=:id`): Active toggle, Settings, Preview; **Content & Layout** block list (the Order form block is Required), Ask Tassya, **Add block**, **Generate with AI (−20 credits)**; live phone preview on the right.
- **Block library** ("Add a block"; also "Ask Tassya for a block — she builds it in your page's colours"):
  - Basics: Image (photo or ad frame, full width), Text (title/paragraph/list), Video (muted MP4 link, or TikTok/YouTube), Button (go to order form or open WhatsApp), Spacer.
  - Convince the buyer: Benefits (2–6 lines with icons), Reviews (stars and photos), Before/after slider, FAQ, Countdown (end date or "only a few left"), Trust strip (COD, 58 wilayas, exchange).
  - Advanced: Custom code (HTML/CSS/JS).
- **Order form block settings**:
  - Title.
  - Fields: Name and Phone always on; Second phone; Wilaya ("delivery is priced by wilaya"); Commune (required toggle); Address (required toggle); Note; Email; name + phone on one row.
  - Your questions: custom questions.
  - Delivery: choice shown as List / Tiles; selected first Home or Desk; show each price; show when it arrives.
  - Product & offers: show product above the form; options as Buttons or Lists; show quantity.
  - Summary & button: show summary (Open / Folded); button text; colours; sticky order button + text.
  - Language: العربية / Français / English; direction RTL/LTR.
  - After the order: Thank-you page / WhatsApp / Link; thank-you words.
  - Spacing: outside/inside per side, 0–96 px, presets.
  - Advanced: custom CSS for this block.

## Offers (7 kinds) — `/stores/:sid/offers/new?goal=…|type=…`
Shared parts of every offer editor:
- Name; headline above the offer (Arabic).
- How buyers get it: Automatic / With codes.
- Who and where: Everyone / First order / Returning buyers.
- Shown on: Store, Landing pages, Shopify order form, Dashboard orders, Orders from installed apps.
- Dates and limits: start (on publish or a date), end, Algeria time UTC+1; total-uses limit; per-buyer limit.
- Combines with (order discounts / product offers / free delivery).
- Live Summary card and an **Arabic order-form preview** with a sample price.
- Footer: Discard / Save as draft / Publish.

Per kind:
1. **Quantity offer** (`goal=sellMore`, kind `quantity`, recommended): products/variants; tiers of N pieces priced as % off or total price; quick chips 5/10/15/20%; "Selected when the form opens" (preselected tier); free delivery per tier; add more tiers.
2. **Free delivery** (`goal=delivery`): from N pieces or from an amount; delivery type Home and desk / Home only / Desk only; all wilayas or chosen wilayas; note "You pay the delivery company the fee the buyer doesn't".
3. **Product discount** (`goal=stock`): every product / specific items / collections; % or fixed DZD; cap the discount; show a countdown.
4. **Discount codes** (`goal=influencers`): product discount plus codes (Code n, per-code uses limit, Add a code, Generate a code, uppercase), "one code per influencer, see what each brings"; form shows "لديك كود خصم؟".
5. **Buy X get Y** (`type=bxgy`): what the customer buys (every product / items / collections); the gift comes from the same or other products; buys N pcs → gets M pcs; gift price Free / % off / fixed; most times per order; the gift is a visible line the buyer can remove.
6. **Order discount** (`type=order_discount`): % or fixed, cap; minimum: every order / from amount / from pieces.
7. **Add-on** (`type=addon`): 1–5 add-on products; offered with any order or specific products; price fixed / % off / amount off; pieces per order; where: checkbox in the order form, or one tap on the thank-you page (added to the same order while unconfirmed).

## Collections
- Create `/stores/:sid/categories/new`: image, title, description; "Add products automatically when they match conditions" → **Products must match All / Any**; condition fields Tag, Brand, Price, On sale, Title + every product option name (Color, Size…); operators "is any of" / "is not"; live "which products match" preview; manual Add products; Visibility (show on store); Organization (position).

## Carriers (connect forms) — `/delivery` → Add Delivery Agent
Common fields: Account name (optional, to tell several accounts of one carrier apart) · "Validate automatically on dispatch" (ship as soon as dispatched; otherwise parcels wait in "Awaiting validation") · "Write parcel opening in the delivery note" (prefixes « Ouverture du colis : autorisée / non autorisée ») · Overweight fee (allowance kg, rate per extra kg; ZR also volumetric allowance). Several carriers have a "Watch how to connect" video.
| Carrier (system) | Credentials | Status updates |
|---|---|---|
| Private Courier | Assigned employee (a team member is the courier) | Manual |
| Yalidine Express, Goupex, Economiqua, WeCan (Yalidine platform) | API ID, Token, Webhook secret, Departure province (wilaya) | Webhook `https://api.tassyir.io/yalidine-webhook`, event `parcel_status_updated` |
| Ecotrack (generic) | Token, Base URL | Polling (inferred) |
| DHD, Anderson, TSL, Navex, 48HR (Ecotrack platform) | Token | Polling (inferred) |
| ZR Express (new) | API key, API ID | — |
| NOEST | GUID, Token | — |
| Maystro Delivery | Token (no auto-validate option; syncs products: `maystroProductId`) | — |
| Elogistia | API key | — |
| Ecom Delivery V2 | API key, Token | — |
| Zimou Express | Token; webhook URL shown after connect | Webhook |
| Osen Express | Token; "Customer may open the parcel" Allow / Don't allow | — |
Connecting Private Courier: toast "Private Courier connected"; carriers table row = name, system, assigned employee, status Active, created date, menu (Edit, Refund Rates, Delete).

API: `POST /stores/:sid/offers` (201, draft) → `POST /stores/:sid/offers/:id/publish`; `GET /stores/:sid/offers/:id` includes `performance { orders, deliveredRevenue, discountGiven }`; `GET /stores/:sid/offers/app-types` (offer kinds contributed by installed apps).
