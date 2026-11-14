import { errorCodesOf, type Exchange, type GraphqlBody, type IsolationHttp, type MatrixRequest } from './http';
import type { Expectation, IsolationCase } from './matrix';
import { CATALOG_WORLDS, catalogFingerprints } from './catalog-world';
import { TEAM_WORLDS, teamFingerprints } from './team-world';
import type { BusinessWorld, World } from './world-types';

/** A case as it ran: who attacked whom, what came back, and what was wrong with it. */
export interface Outcome {
  readonly case: IsolationCase;
  readonly attacker: 'A' | 'B';
  readonly exchange: Exchange;
  readonly failures: readonly string[];
}

/**
 * Below this length a value is a Vendure engine id (an administrator's or an asset's small integer), which another
 * table reuses for its own rows: A's channel `2` is not B's asset `2`. Such ids are left out of the scan; their rows
 * are still recognised by the unique values beside them (the owner's and member's addresses and names), and the logo
 * asset by the refusals its cases expect.
 */
const MIN_FINGERPRINT_LENGTH = 8;

/**
 * Every value that identifies the victim's data. Any of them in the attacker's answer is a leak, unless the attacker
 * sent it (an id the attacker names is not news to the attacker).
 */
export function fingerprintsOf(victim: BusinessWorld): string[] {
  const team = TEAM_WORLDS.get(victim.label);
  const catalog = CATALOG_WORLDS.get(victim.label);
  return [
    ...allValuesOf(victim),
    ...(team === undefined ? [] : teamFingerprints(team)),
    ...(catalog === undefined ? [] : catalogFingerprints(catalog)),
  ].filter((value) => value.length >= MIN_FINGERPRINT_LENGTH);
}

function allValuesOf(victim: BusinessWorld): string[] {
  return [
    victim.businessId,
    victim.name,
    victim.owner.email,
    victim.owner.administratorId,
    victim.owner.lastName,
    victim.member.email,
    victim.member.administratorId,
    victim.role.id,
    victim.role.name,
    victim.secret.id,
    victim.note.id,
    victim.note.title,
    victim.logoAssetId,
    ...victim.stores.flatMap((store) => [store.id, store.subdomain, store.channelToken]),
  ];
}

const requestText = (request: MatrixRequest): string =>
  JSON.stringify([request.path, request.body ?? null, request.rawBody ?? null, request.channel?.token ?? null]);

/** The victim's values found in the answer, other than those the request itself carried. */
export function leaksIn(exchange: Exchange, victim: BusinessWorld): string[] {
  const sent = requestText(exchange.request);
  const answer = typeof exchange.body === 'string' ? exchange.body : JSON.stringify(exchange.body);
  return fingerprintsOf(victim).filter((value) => !holds(sent, value) && holds(answer, value));
}

const holds = (text: string, value: string): boolean => text.includes(value);

const operationOf = (request: MatrixRequest): string | undefined =>
  /(?:query|mutation)[^{]*\{\s*(\w+)/.exec((request.body as { query?: string } | undefined)?.query ?? '')?.[1];

type Judge<K extends Expectation['kind']> = (
  exchange: Exchange,
  expect: Extract<Expectation, { kind: K }>,
  attacker: BusinessWorld,
) => string[];

const bodyOf = (exchange: Exchange): GraphqlBody => exchange.body as GraphqlBody;

const judgeForbidden: Judge<'forbidden'> = (exchange) => {
  const codes = errorCodesOf(exchange);
  const operation = operationOf(exchange.request);
  const data = operation === undefined ? undefined : bodyOf(exchange).data?.[operation];
  const refused = codes.includes('FORBIDDEN') && (data === undefined || data === null);
  return refused ? [] : [`wanted FORBIDDEN, got codes [${codes.join()}]`];
};

const judgeNull: Judge<'null'> = (exchange, expect) => {
  const codes = errorCodesOf(exchange);
  const data = bodyOf(exchange).data;
  return codes.length === 0 && data?.[expect.field] === null
    ? []
    : [`wanted ${expect.field} null, got codes [${codes.join()}] and ${JSON.stringify(data ?? null)}`];
};

const judgeCode: Judge<'code'> = (exchange, expect) => {
  const codes = errorCodesOf(exchange);
  return codes.includes(expect.code) ? [] : [`wanted code ${expect.code}, got [${codes.join()}]`];
};

const judgeStatus: Judge<'status'> = (exchange, expect) => {
  const code = (exchange.body as { code?: string } | null)?.code;
  const codeOk = expect.code === undefined || code === expect.code;
  return exchange.status === expect.status && codeOk
    ? []
    : [`wanted HTTP ${String(expect.status)} ${expect.code ?? ''}, got ${String(exchange.status)} ${code ?? ''}`];
};

const judgeOwn: Judge<'own'> = (exchange, expect, attacker) => {
  const codes = errorCodesOf(exchange);
  const answer = JSON.stringify(exchange.body);
  const missing = expect.mustInclude(attacker).filter((value) => !answer.includes(value));
  const present = (expect.mustExclude?.(attacker) ?? []).filter((value) => answer.includes(value));
  const failed = exchange.status >= 400 || codes.length > 0;
  if (failed || missing.length > 0) {
    return [`wanted own data, got HTTP ${String(exchange.status)} codes [${codes.join()}], missing ${missing.join()}`];
  }
  return present.length > 0 ? [`shows data the caller may not see: ${present.join()}`] : [];
};

const JUDGES: { readonly [K in Expectation['kind']]: Judge<K> } = {
  forbidden: judgeForbidden,
  null: judgeNull,
  code: judgeCode,
  status: judgeStatus,
  own: judgeOwn,
};

/** What is wrong with the answer against the expectation, or nothing. */
export function judge(exchange: Exchange, expect: Expectation, attacker: BusinessWorld): string[] {
  // The map pairs each kind with its judge; TypeScript cannot follow that pairing through the index, hence `never`.
  return JUDGES[expect.kind](exchange, expect as never, attacker);
}

/** Who attacks whom in one run of a case. */
export interface Direction {
  readonly attacker: BusinessWorld;
  readonly victim: BusinessWorld;
}

/** Runs one case in one direction. */
export async function runCase(
  http: IsolationHttp,
  world: World,
  testCase: IsolationCase,
  { attacker, victim }: Direction,
): Promise<Outcome> {
  const exchange = await http.send(testCase.request(attacker, victim, world));
  const leaks = leaksIn(exchange, victim).map((value) => `leaks the victim's value ${value}`);
  return {
    case: testCase,
    attacker: attacker.label,
    exchange,
    failures: [...judge(exchange, testCase.expect, attacker), ...leaks],
  };
}

/** Runs every case A→B, and the reverse-direction ones B→A too. */
export async function runMatrix(
  http: IsolationHttp,
  world: World,
  cases: readonly IsolationCase[],
): Promise<Outcome[]> {
  const outcomes: Outcome[] = [];
  for (const testCase of cases) {
    outcomes.push(await runCase(http, world, testCase, { attacker: world.a, victim: world.b }));
    if (testCase.reverse === true) {
      outcomes.push(await runCase(http, world, testCase, { attacker: world.b, victim: world.a }));
    }
  }
  return outcomes;
}
