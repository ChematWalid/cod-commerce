// Pricing transcripts of scripts/evidence/P2.S4.sh (D2432): boots the server's Vendure app in process against the live
// evidence stack (its Postgres, Valkey and object storage on the host ports +20000), seeds offers and codes through
// `OfferAdminService`, registers a synthetic fee table (home 800, stop desk 500) on `SHIPPING_QUOTE_REGISTRAR`, calls the
// scoped `PricingService` core (D2408) and writes one Markdown transcript per call. There is no HTTP route before P3.S3,
// so a transcript shows the in-process call, its input and its output, never a status line. Every `quoteToken` is cut to
// `qt1.<payload>.[REDACTED]` here, before anything is written. Run from the server package (workspace packages resolve):
//
//   pnpm exec node --conditions=@cod/source -r ts-node/register/transpile-only \
//     ../../scripts/evidence/P2.S4-quote.ts <world.json> <transcript dir>
//
// The world file (written by P2.S4.sh into its scratch folder, never into docs/) holds the stores' ids and channel
// tokens and the catalog ids the script prices. Refuses APP_ENV=production. Data is synthetic; no phone is sent.
/* global process, Buffer, console */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type {
  OfferAdminService as OfferAdmin,
  OperationContext,
  PricingService as Pricing,
  ShippingQuoteRegistrar,
  StoreScope,
} from '../../plugins/offers';
import type { OfferInput, Quote, QuoteRequestInput } from '../../packages/shared/src';
import type * as VendureCore from '../../apps/server/node_modules/@vendure/core';
import type { Clock } from '../../plugins/offers/domain/ports/clock.port';
import { CLOCK } from '../../plugins/offers/application/tokens';
import { loadEnv } from '../../apps/server/src/config/env';
import { buildVendureConfig } from '../../apps/server/src/config/vendure-config';

// This file lives outside every package: the workspace packages resolve from the server package, like its own code.
const fromServer = createRequire(join(process.cwd(), 'package.json'));
const vendure = fromServer('@vendure/core') as typeof VendureCore;
const offers = fromServer('@cod/plugin-offers') as typeof import('../../plugins/offers');
const shared = fromServer('@cod/shared') as typeof import('../../packages/shared/src');
/** The Nest application context of the bootstrapped worker. */
type App = Awaited<ReturnType<typeof VendureCore.bootstrapWorker>>['app'];

interface WorldStore {
  readonly id: string;
  readonly channelToken: string;
}
interface World {
  readonly a: { readonly businessId: string; readonly a1: WorldStore; readonly a2: WorldStore };
  readonly b: { readonly businessId: string; readonly store: WorldStore };
  /** Vendure core ids (small integers) of what P2.S4.sh created over the catalog Admin API. */
  readonly catalog: {
    readonly product: string;
    readonly red: string;
    readonly blue: string;
    readonly scheduleProduct: string;
    readonly scheduleVariant: string;
    readonly codesProduct: string;
    readonly codesVariant: string;
    readonly draftVariant: string;
    readonly bProduct: string;
  };
}

/** The snowflake ids of the offers the script seeds. */
interface OfferIds {
  readonly quantity: string;
  readonly notStarted: string;
  readonly ended: string;
  readonly welcome: string;
  readonly usedUp: string;
  readonly order10: string;
  readonly save1000: string;
  readonly b: string;
}

/** A store the script prices in: its scope, its own-channel context and the label a transcript shows. */
interface Store {
  readonly scope: StoreScope;
  readonly ctx: OperationContext;
  readonly label: string;
}

const [worldArg, outArg] = process.argv.slice(2);
if (worldArg === undefined || outArg === undefined) throw new Error('usage: P2.S4-quote.ts <world.json> <out dir>');
const outDir: string = outArg;
const world = JSON.parse(readFileSync(worldArg, 'utf8')) as World;
const HOME_FEE = 800;
const DESK_FEE = 500;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const ALGIERS = '16';
const MS_PER_SECOND = 1000;
const TOKEN = /^qt1\.([^.]+)\.(.+)$/;

/** Snowflake ids (business, store, offer) become named placeholders in the transcripts; assertions use the real ids. */
const placeholders = new Map<string, string>();
const remember = (name: string, id: string): void => {
  placeholders.set(id, `<${name}>`);
};

function check(name: string, condition: boolean, value: unknown): void {
  if (!condition) throw new Error(`P2.S4-quote: ${name} does not hold for ${JSON.stringify(value)}`);
}

/** A token keeps its prefix and payload (what it commits to) and loses its signature. */
function redacted(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(TOKEN, 'qt1.$1.[REDACTED]');
  if (Array.isArray(value)) return value.map(redacted);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, redacted(inner)]));
  }
  return value;
}

function shown(value: unknown): string {
  let text = JSON.stringify(redacted(value), null, 2);
  for (const [id, name] of placeholders) text = text.split(id).join(name);
  return text;
}

interface Transcript {
  readonly name: string;
  readonly title: string;
  readonly about: string;
  readonly call: string;
  readonly store: Store;
  readonly input: unknown;
  readonly output: unknown;
}

function write({ name, title, about, call, store, input, output }: Transcript): void {
  const body = [
    `# ${title}`,
    '',
    about,
    '',
    `- Call: \`${call}\` (in process, no HTTP route before P3.S3)`,
    `- Store: ${store.label}`,
    '',
    '## Input',
    '',
    '```json',
    shown(input),
    '```',
    '',
    '## Output',
    '',
    '```json',
    shown(output),
    '```',
    '',
  ].join('\n');
  writeFileSync(join(outDir, `${name}.md`), body);
}

const line = (variantId: string, quantity: number) => ({ variantId, quantity });
const home = { provinceCode: ALGIERS, stopdesk: false } as const;
const desk = { provinceCode: ALGIERS, stopdesk: true } as const;
const request = (lines: QuoteRequestInput['lines'], extra: Partial<QuoteRequestInput> = {}): QuoteRequestInput => ({
  channel: 'storefront',
  lines,
  destination: home,
  ...extra,
});

async function storeOf(app: App, businessId: string, store: WorldStore, label: string): Promise<Store> {
  const raw = await app
    .get(vendure.RequestContextService)
    .create({ apiType: 'admin', channelOrToken: store.channelToken });
  const scope = { businessId: shared.toBusinessId(businessId), storeId: shared.toStoreId(store.id) };
  return { scope, ctx: offers.asOperationContext(raw), label };
}

/** The offers of the run, published, and the code rows they need. */
async function seedOffers(admin: OfferAdmin, a1: Store, b: Store): Promise<OfferIds> {
  const { catalog } = world;
  const now = Date.now();
  const publish = async (store: Store, name: string, input: OfferInput, codes: string[] = []): Promise<string> => {
    const draft = await admin.createDraft(store.ctx, store.scope, input);
    remember(name, draft.id);
    const active = await admin.setStatus(store.ctx, store.scope, draft.id, 'active');
    check(`${name} active`, active.status === 'active', active);
    if (codes.length > 0) {
      const limited = (code: string) => (code === 'usedup15' ? { code, usageLimit: 1 } : { code });
      await admin.addCodes(store.ctx, store.scope, draft.id, codes.map(limited));
    }
    return draft.id;
  };
  const product = (id: string) => [{ refType: 'product' as const, refId: id }];
  const quantity = await publish(a1, 'OFFER_QUANTITY', {
    kind: 'quantity',
    title: '2 pieces 10 %, 3 pieces 15 % and free delivery',
    config: {
      priceMode: 'percent',
      tiers: [
        { quantity: 2, price: 10 },
        { quantity: 3, price: 15, freeDelivery: true },
      ],
    },
    targets: product(catalog.product),
  });
  const percentOff = (title: string, value: number, extra: Partial<OfferInput>): OfferInput => ({
    kind: 'product_discount',
    title,
    config: { valueType: 'percent', value, appliesTo: 'targets' },
    ...extra,
  });
  const notStarted = await publish(
    a1,
    'OFFER_NOT_STARTED',
    percentOff('Starts next week', 5, {
      startsAt: new Date(now + 7 * DAY_MS).toISOString(),
      targets: product(catalog.scheduleProduct),
    }),
  );
  const ended = await publish(
    a1,
    'OFFER_ENDED',
    percentOff('Ended an hour ago', 7, {
      startsAt: new Date(now - 7 * DAY_MS).toISOString(),
      endsAt: new Date(now - HOUR_MS).toISOString(),
      targets: product(catalog.scheduleProduct),
    }),
  );
  const codeOffer = { method: 'codes' as const, targets: product(catalog.codesProduct) };
  const welcome = await publish(a1, 'OFFER_WELCOME10', percentOff('Welcome code', 10, codeOffer), ['welcome10']);
  const usedUp = await publish(a1, 'OFFER_USEDUP15', percentOff('Used-up code', 15, codeOffer), ['usedup15']);
  const orderOff = (title: string, valueType: 'percent' | 'fixed', value: number): OfferInput => ({
    kind: 'order_discount',
    method: 'codes',
    title,
    config: { valueType, value },
  });
  const order10 = await publish(a1, 'OFFER_ORDER10', orderOff('10 % off the order', 'percent', 10), ['order10']);
  const save1000 = await publish(a1, 'OFFER_SAVE1000', orderOff('1,000 DZD off the order', 'fixed', 1000), [
    'save1000',
  ]);
  const bOffer = await publish(
    b,
    'OFFER_B',
    percentOff("Business B's code", 20, { method: 'codes', targets: product(catalog.bProduct) }),
    ['bonly20'],
  );
  return { quantity, notStarted, ended, welcome, usedUp, order10, save1000, b: bOffer };
}

/** The code's uses reach its limit: P3.S4 counts uses at intake, so before it the script sets the column itself. */
async function useUp(app: App, store: Store, code: string): Promise<void> {
  const connection = app.get(vendure.TransactionalConnection);
  const rows: unknown = await connection.rawConnection.query(
    'UPDATE "offers_code" SET "usageCount" = "usageLimit" WHERE "storeId" = $1 AND "code" = $2 RETURNING "id"',
    [store.scope.storeId, code],
  );
  check(`${code} used up`, Array.isArray(rows) && JSON.stringify(rows).includes('id'), rows);
}

const QUOTE_CALL = 'PricingService.quoteForScope(ctx, scope, request)';
const VERIFY_CALL = 'PricingService.verifyQuoteForScope(ctx, scope, token, cart)';
const REPRICE_CALL = 'PricingService.repriceOrderForScope(ctx, scope, input)';

async function main(): Promise<void> {
  vendure.Logger.useLogger(new vendure.DefaultLogger({ level: vendure.LogLevel.Warn }));
  const env = loadEnv();
  if (env.APP_ENV === 'production') throw new Error('P2.S4-quote: refusing APP_ENV=production');
  mkdirSync(outDir, { recursive: true });
  const worker = await vendure.bootstrapWorker(buildVendureConfig(env, 'migrate'));
  try {
    await run(worker.app);
  } finally {
    await worker.app.close();
  }
}

async function run(app: App): Promise<void> {
  const { a, b: bWorld, catalog } = world;
  for (const [name, id] of [
    ['BUSINESS_A', a.businessId],
    ['STORE_A1', a.a1.id],
    ['STORE_A2', a.a2.id],
    ['BUSINESS_B', bWorld.businessId],
    ['STORE_B', bWorld.store.id],
  ] as const) {
    remember(name, id);
  }
  const a1 = await storeOf(app, a.businessId, a.a1, 'A1 (business A, store `demo`)');
  const a2 = await storeOf(app, a.businessId, a.a2, 'A2 (business A, store `demo2`)');
  const b = await storeOf(app, bWorld.businessId, bWorld.store, 'B (business B, store `second`)');
  app.get<symbol, ShippingQuoteRegistrar>(offers.SHIPPING_QUOTE_REGISTRAR).register({
    quote: (_ctx, _scope, input) =>
      Promise.resolve({ resolved: true, baseFee: input.stopdesk ? DESK_FEE : HOME_FEE, overweightFee: 0, speed: null }),
  });
  const ids = await seedOffers(app.get(offers.OfferAdminService), a1, b);
  await useUp(app, a1, 'USEDUP15');
  const pricing = app.get(offers.PricingService);
  await quotes(pricing, a1, ids);
  await verifications(app, pricing, a1, a2);
  await reprice(pricing, a1, ids);
  const isolation = request([line(catalog.codesVariant, 1)], { codes: ['bonly20'] });
  const leaked = await pricing.quoteForScope(a1.ctx, a1.scope, isolation);
  check(
    'B code in A',
    leaked.rejectedCodes.some((r) => r.code === 'BONLY20' && r.reason === 'not_found'),
    leaked,
  );
  check('no B offer in A', !JSON.stringify(leaked).includes(ids.b), leaked);
  write({
    name: 'isolation-b-code-in-a',
    title: "Business B's code in store A1: not found",
    about:
      "`BONLY20` is a published code of business B. Store A1's quote rejects it as `not_found` (the code lookup is scoped " +
      "to A1's business and store, D2406) and no offer of B appears anywhere in the quote.",
    call: QUOTE_CALL,
    store: a1,
    input: isolation,
    output: leaked,
  });
  console.log(JSON.stringify({ event: 'p2s4-quote.done', transcripts: 14 }));
}

async function quoteCase(
  pricing: Pricing,
  store: Store,
  spec: { name: string; title: string; about: string; input: QuoteRequestInput },
  expect: (quote: Quote) => boolean,
): Promise<Quote> {
  const quote = await pricing.quoteForScope(store.ctx, store.scope, spec.input);
  check(spec.name, expect(quote), quote);
  write({ ...spec, call: QUOTE_CALL, store, output: quote });
  return quote;
}

async function quotes(pricing: Pricing, a1: Store, ids: OfferIds): Promise<void> {
  const { catalog } = world;
  await quoteCase(
    pricing,
    a1,
    {
      name: 'quote-1-piece-home',
      title: 'One piece at 4,900 delivered home: 5,700 and a nudge of 980',
      about:
        'The research worked example (AC1, AC2): one piece at 4,900 DZD plus home delivery 800. The 2-piece tier is one ' +
        'unit away and would save 980 DZD (10 % of 4,900 on both pieces, D2416).',
      input: request([line(catalog.red, 1)]),
    },
    (q) =>
      q.total === 5_700 &&
      q.delivery.price === HOME_FEE &&
      q.nudge?.units === 1 &&
      q.nudge.tierQuantity === 2 &&
      q.nudge.saving === 980 &&
      q.available &&
      q.quoteToken !== null,
  );
  await quoteCase(
    pricing,
    a1,
    {
      name: 'quote-2-pieces-home',
      title: 'Two pieces (red + blue) delivered home: 9,620',
      about:
        'One red and one blue variant of the same product count as 2 pieces (D2410): 10 % off each unit, 8,820 + 800.',
      input: request([line(catalog.red, 1), line(catalog.blue, 1)]),
    },
    (q) => q.subtotal === 8_820 && q.total === 9_620 && q.savings === 980 && q.applied[0]?.offerId === ids.quantity,
  );
  await quoteCase(
    pricing,
    a1,
    {
      name: 'quote-3-pieces-free-delivery',
      title: 'Three pieces: 15 % off and free delivery, 12,495',
      about:
        'The 3-piece tier (15 % off, the fixture assumption of the elided research figure) waives delivery (D2414): ' +
        '4,900 − 735 = 4,165 per unit (half-up per unit, D2409), × 3 = 12,495, delivery price 0, waived.',
      input: request([line(catalog.red, 2), line(catalog.blue, 1)]),
    },
    (q) => q.total === 12_495 && q.delivery.price === 0 && q.delivery.waived && q.nudge === null,
  );
  await quoteCase(
    pricing,
    a1,
    {
      name: 'quote-desk',
      title: 'One piece to a stop desk: 5,400',
      about: 'The same piece delivered to a stop desk (fee 500): 4,900 + 500.',
      input: request([line(catalog.red, 1)], { destination: desk }),
    },
    (q) => q.total === 5_400 && q.delivery.fee === DESK_FEE,
  );
  await quoteCase(
    pricing,
    a1,
    {
      name: 'quote-schedule-skipped',
      title: 'Offers outside their schedule: skipped not_started and ended',
      about:
        'Two published automatic offers on this product: one starts next week, one ended an hour ago (D2419, AC3). ' +
        'Both are reported in `skipped` and the price is untouched.',
      input: request([line(catalog.scheduleVariant, 1)]),
    },
    (q) =>
      q.skipped.some((s) => s.offerId === ids.notStarted && s.reason === 'not_started') &&
      q.skipped.some((s) => s.offerId === ids.ended && s.reason === 'ended') &&
      q.applied.length === 0,
  );
  await quoteCase(
    pricing,
    a1,
    {
      name: 'quote-codes',
      title: 'Discount codes: valid, duplicate, not found, used up',
      about:
        '` welcome10 ` is normalised to `WELCOME10` and applies (D2406); the same code again is `duplicate`; `NOPE99` is ' +
        '`not_found`; `usedup15` has reached its usage limit (its count was set to the limit by the script: P3.S4 ' +
        'counts uses) and is `code_limit` (AC4).',
      input: request([line(catalog.codesVariant, 1)], { codes: [' welcome10 ', 'WELCOME10', 'NOPE99', 'usedup15'] }),
    },
    (q) => {
      const reasons = Object.fromEntries(q.rejectedCodes.map((r) => [r.code, r.reason]));
      return (
        q.applied.some((o) => o.offerId === ids.welcome && o.code === 'WELCOME10') &&
        reasons['WELCOME10'] === 'duplicate' &&
        reasons['NOPE99'] === 'not_found' &&
        reasons['USEDUP15'] === 'code_limit'
      );
    },
  );
  await quoteCase(
    pricing,
    a1,
    {
      name: 'quote-not-combinable',
      title: 'Two order discounts that do not combine: the better one applies',
      about:
        'On a 5,000 subtotal `ORDER10` is worth 500 and `SAVE1000` 1,000; neither combines with an order discount (D2411, ' +
        'AC5), so `SAVE1000` applies and `ORDER10` is rejected `not_combinable`.',
      input: request([line(catalog.codesVariant, 2)], { codes: ['order10', 'save1000'] }),
    },
    (q) =>
      q.discountTotal === 1_000 &&
      q.discounts.length === 1 &&
      q.discounts[0]?.offerId === ids.save1000 &&
      q.rejectedCodes.some((r) => r.code === 'ORDER10' && r.reason === 'not_combinable'),
  );
  await quoteCase(
    pricing,
    a1,
    {
      name: 'quote-unavailable-variant',
      title: 'A variant of a draft product: unavailable, no token',
      about:
        'The cart has a variant of a draft product. The gate refuses it (D2423): the quote is `available: false`, lists ' +
        'it in `unavailableVariantIds` and carries no token (D2425); the priced line still shows.',
      input: request([line(catalog.red, 1), line(catalog.draftVariant, 1)]),
    },
    (q) =>
      !q.available &&
      q.quoteToken === null &&
      q.expiresAt === null &&
      q.unavailableVariantIds.join() === catalog.draftVariant &&
      q.lines.length === 1,
  );
}

/** The token with its total lowered and the signature kept: what a buyer editing the payload would send. */
function tamperedTotal(token: string): string {
  const [prefix, payload, signature] = token.split('.');
  if (prefix === undefined || payload === undefined || signature === undefined) throw new Error('not a token');
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { t: number };
  const forged = Buffer.from(JSON.stringify({ ...claims, t: claims.t - 1000 })).toString('base64url');
  return `${prefix}.${forged}.${signature}`;
}

async function verifications(app: App, pricing: Pricing, a1: Store, a2: Store): Promise<void> {
  const { catalog } = world;
  const cart = request([line(catalog.red, 1), line(catalog.blue, 1)]);
  const quote = await pricing.quoteForScope(a1.ctx, a1.scope, cart);
  const token = quote.quoteToken;
  if (token === null || quote.expiresAt === null) throw new Error('P2.S4-quote: the 2-piece quote has no token');
  const verify = async (store: Store, sent: string, name: string, title: string, about: string) => {
    const verdict = await pricing.verifyQuoteForScope(store.ctx, store.scope, sent, cart);
    write({ name, title, about, call: VERIFY_CALL, store, input: { token: sent, cart }, output: verdict });
    return verdict;
  };
  const ok = await verify(
    a1,
    token,
    'verify-round-trip',
    'The 2-piece token, verified with its own cart: ok',
    'The token of `quote-2-pieces-home` (total 9,620), checked in the store that signed it with the same cart (AC7).',
  );
  check('round trip', ok.ok && ok.payload.t === 9_620, ok);
  const tampered = await verify(
    a1,
    tamperedTotal(token),
    'verify-tampered-total',
    'The same token with its total lowered by 1,000: bad_signature',
    'The payload `t` was rewritten from 9,620 to 8,620 and the signature kept: the HMAC over `qt1.<payload>` fails.',
  );
  check('tampered', !tampered.ok && tampered.reason === 'bad_signature', tampered);
  const other = await verify(
    a2,
    token,
    'verify-other-store',
    "Store A1's token verified in store A2: store_mismatch",
    'Same business, another store: the signature holds but the token names store A1 (AC7, multi-tenant).',
  );
  check('other store', !other.ok && other.reason === 'store_mismatch', other);
  // The clock is the plugin's injected port (D2421): set to the token's `exp`, the token is expired at exactly `exp`.
  const clock = app.get<symbol, Clock>(CLOCK);
  const systemNow = clock.now;
  const expiry = Date.parse(quote.expiresAt);
  clock.now = () => new Date(expiry);
  try {
    const expired = await verify(
      a1,
      token,
      'verify-expired',
      'The token at its exp instant: expired',
      `The script set the plugin's clock to the token's \`exp\` (${String(expiry / MS_PER_SECOND)} s, 15 minutes after ` +
        '`iat`): a token expires at `exp`, not after (D2421).',
    );
    check('expired', !expired.ok && expired.reason === 'expired', expired);
  } finally {
    clock.now = systemNow;
  }
}

async function reprice(pricing: Pricing, a1: Store, ids: OfferIds): Promise<void> {
  const { catalog } = world;
  const input = {
    current: request([line(catalog.red, 1)]),
    next: request([line(catalog.red, 2)]),
    orderUsage: { offerIds: [], codes: [] },
  };
  const result = await pricing.repriceOrderForScope(a1.ctx, a1.scope, input);
  check(
    'reprice',
    result.available &&
      result.delta === 3_920 &&
      result.before.total === 5_700 &&
      result.after.total === 9_620 &&
      result.after.quoteToken === null &&
      result.orderFields.lines[0]?.offerIds.includes(ids.quantity) === true,
    result,
  );
  write({
    name: 'reprice-1-to-2',
    title: 'An order of one piece changed to two: delta 3,920',
    about:
      'The order change of D2427: before 5,700, after 9,620 (the 2-piece tier applies), delta 3,920, and the order ' +
      'fields P4.S3 will store (`quotedUnitPrice` 4,410). Nothing is written; neither quote carries a token.',
    call: REPRICE_CALL,
    store: a1,
    input,
    output: result,
  });
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exit(1);
  },
);
