// Shipping-quote transcripts of scripts/evidence/P3.S1.sh: boots the server's Vendure app in process against the live
// evidence stack (its Postgres, Valkey and object storage on the host ports +20000, as P2.S4-quote.ts), and quotes store
// A1's delivery to Alger-Centre through the delivery-pricing service (the call P3.S3's checkout makes) and through the
// offers' scoped pricing core, whose shipping seam delivery pricing fills (D2423). There is no HTTP route before P3.S3,
// so a transcript shows the in-process call, its input and its output, never a status line. Every `quoteToken` is cut
// to `qt1.[PAYLOAD REDACTED].[REDACTED]` before anything is written: its base64url payload carries the real business and
// store ids, which the placeholders below cannot reach inside the encoding. Run from the server package (workspace packages resolve):
//
//   pnpm exec node --conditions=@cod/source -r ts-node/register/transpile-only \
//     ../../scripts/evidence/P3.S1-quote.ts <world.json> <transcript dir>
//
// The world file (written by P3.S1.sh into its scratch folder, never into docs/) holds store A1's ids, channel token,
// the product the quotes price and the price its default pricing option charges Alger-Centre. Refuses
// APP_ENV=production. Data is synthetic; no phone is sent.
/* global process, console */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { QuoteRequestInput } from '../../packages/shared/src';
import type { DeliveryStoreScope as StoreScope } from '../../plugins/delivery-pricing';
import type * as VendureCore from '../../apps/server/node_modules/@vendure/core';
import { loadEnv } from '../../apps/server/src/config/env';
import { buildVendureConfig } from '../../apps/server/src/config/vendure-config';

// This file lives outside every package: the workspace packages resolve from the server package, like its own code.
const fromServer = createRequire(join(process.cwd(), 'package.json'));
const vendure = fromServer('@vendure/core') as typeof VendureCore;
const offers = fromServer('@cod/plugin-offers') as typeof import('../../plugins/offers');
const pricing = fromServer('@cod/plugin-delivery-pricing') as typeof import('../../plugins/delivery-pricing');
const shared = fromServer('@cod/shared') as typeof import('../../packages/shared/src');
/** The Nest application context of the bootstrapped worker. */
type App = Awaited<ReturnType<typeof VendureCore.bootstrapWorker>>['app'];

interface World {
  readonly businessId: string;
  readonly storeId: string;
  readonly channelToken: string;
  readonly productId: string;
  readonly variantId: string;
  readonly listPrice: number;
  /** What A1's default pricing option charges home delivery to Alger-Centre (its commune override). */
  readonly communeHomePrice: number;
}

const [worldArg, outArg] = process.argv.slice(2);
if (worldArg === undefined || outArg === undefined) throw new Error('usage: P3.S1-quote.ts <world.json> <out dir>');
const outDir: string = outArg;
const world = JSON.parse(readFileSync(worldArg, 'utf8')) as World;
const ALGER = '16';
const ALGER_CENTRE = 1601;
const TOKEN = /^qt1\.[^.]+\..+$/;
const STORE_LABEL = 'A1 (business A, store `demo`)';

const placeholders = new Map<string, string>([
  [world.businessId, '<BUSINESS_DEMO>'],
  [world.storeId, '<STORE_DEMO>'],
]);

function check(name: string, condition: boolean, value: unknown): void {
  if (!condition) throw new Error(`P3.S1-quote: ${name} does not hold for ${JSON.stringify(value)}`);
}

/** A token keeps its prefix and loses its payload (which encodes the real ids) and its signature. */
function redacted(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(TOKEN, 'qt1.[PAYLOAD REDACTED].[REDACTED]');
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
  readonly input: unknown;
  readonly output: unknown;
}

function write({ name, title, about, call, input, output }: Transcript): void {
  const body = [
    `# ${title}`,
    '',
    about,
    '',
    `- Call: \`${call}\` (in process, no HTTP route before P3.S3)`,
    `- Store: ${STORE_LABEL}`,
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

async function main(): Promise<void> {
  vendure.Logger.useLogger(new vendure.DefaultLogger({ level: vendure.LogLevel.Warn }));
  const env = loadEnv();
  if (env.APP_ENV === 'production') throw new Error('P3.S1-quote: refusing APP_ENV=production');
  mkdirSync(outDir, { recursive: true });
  const worker = await vendure.bootstrapWorker(buildVendureConfig(env, 'migrate'));
  try {
    await run(worker.app);
  } finally {
    await worker.app.close();
  }
}

async function run(app: App): Promise<void> {
  const raw = await app
    .get(vendure.RequestContextService)
    .create({ apiType: 'admin', channelOrToken: world.channelToken });
  const scope: StoreScope = {
    businessId: shared.toBusinessId(world.businessId),
    storeId: shared.toStoreId(world.storeId),
  };
  await serviceQuote(app, raw, scope);
  await offersQuote(app, raw, scope);
  console.log(JSON.stringify({ event: 'p3s1-quote.done', transcripts: 2 }));
}

async function serviceQuote(app: App, raw: VendureCore.RequestContext, scope: StoreScope) {
  const input = {
    provinceCode: ALGER,
    townOns: ALGER_CENTRE,
    stopdesk: false,
    items: [{ productId: world.productId, quantity: 1 }],
  } as const;
  const quote = await app.get(pricing.ShippingQuoteService).quote(pricing.asOperationContext(raw), scope, input);
  check(
    'commune quote',
    quote.resolved && quote.source === 'commune' && quote.baseFee === world.communeHomePrice,
    quote,
  );
  write({
    name: 'shipping-quote-commune',
    title: `Delivery quote to Alger-Centre: ${String(world.communeHomePrice)} DZD from the commune override`,
    about:
      "Store A1's default pricing option overrides Alger-Centre's home price; the quote reads that commune row and says " +
      "so (`source: 'commune'`, D3125). The store comes from the caller's scope, never from the request.",
    call: 'ShippingQuoteService.quote(ctx, scope, request)',
    input,
    output: quote,
  });
}

async function offersQuote(app: App, raw: VendureCore.RequestContext, scope: StoreScope) {
  const input: QuoteRequestInput = {
    channel: 'storefront',
    lines: [{ variantId: world.variantId, quantity: 1 }],
    destination: { provinceCode: ALGER, townOns: String(ALGER_CENTRE), stopdesk: false },
  };
  const quote = await app.get(offers.PricingService).quoteForScope(offers.asOperationContext(raw), scope, input);
  check(
    'offers quote',
    quote.delivery.resolved &&
      quote.delivery.fee === world.communeHomePrice &&
      quote.total === world.listPrice + world.communeHomePrice,
    quote,
  );
  write({
    name: 'offers-quote-delivery',
    title: `Order quote with delivery: ${String(world.listPrice)} + ${String(world.communeHomePrice)} DZD`,
    about:
      "The offers' scoped pricing core (D2408) asks its shipping seam for the fee; delivery pricing answers with the " +
      "store's table (D2423), so the order total carries the commune price.",
    call: 'PricingService.quoteForScope(ctx, scope, request)',
    input,
    output: quote,
  });
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exit(1);
  },
);
