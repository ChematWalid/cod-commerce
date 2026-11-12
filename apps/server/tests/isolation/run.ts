import { errorCodesOf, type Exchange, type GraphqlBody, type IsolationHttp, type MatrixRequest } from './http';
import type { Expectation, IsolationCase } from './matrix';
import type { BusinessWorld, World } from './world';

/** A case as it ran: who attacked whom, what came back, and what was wrong with it. */
export interface Outcome {
  readonly case: IsolationCase;
  readonly attacker: 'A' | 'B';
  readonly exchange: Exchange;
  readonly failures: readonly string[];
}

/**
 * Every value that identifies the victim's data. Any of them in the attacker's answer is a leak, unless the attacker
 * sent it (an id the attacker names is not news to the attacker).
 */
export function fingerprintsOf(victim: BusinessWorld): string[] {
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
  return fingerprintsOf(victim).filter((value) => !sent.includes(value) && answer.includes(value));
}

const operationOf = (request: MatrixRequest): string | undefined =>
  /(?:query|mutation)[^{]*\{\s*(\w+)/.exec((request.body as { query?: string } | undefined)?.query ?? '')?.[1];

/** What is wrong with the answer against the expectation, or nothing. */
export function judge(exchange: Exchange, expect: Expectation, attacker: BusinessWorld): string[] {
  const body = exchange.body as GraphqlBody;
  const codes = errorCodesOf(exchange);
  switch (expect.kind) {
    case 'forbidden': {
      const operation = operationOf(exchange.request);
      const data = operation === undefined ? undefined : body.data?.[operation];
      return codes.includes('FORBIDDEN') && (data === undefined || data === null)
        ? []
        : [`wanted FORBIDDEN, got codes [${codes.join()}]`];
    }
    case 'null':
      return codes.length === 0 && body.data?.[expect.field] === null
        ? []
        : [`wanted ${expect.field} null, got codes [${codes.join()}] and ${JSON.stringify(body.data ?? null)}`];
    case 'code':
      return codes.includes(expect.code) ? [] : [`wanted code ${expect.code}, got [${codes.join()}]`];
    case 'status': {
      const code = (exchange.body as { code?: string } | null)?.code;
      const statusOk = exchange.status === expect.status;
      const codeOk = expect.code === undefined || code === expect.code;
      return statusOk && codeOk ? [] : [`wanted HTTP ${String(expect.status)} ${expect.code ?? ''}, got ${String(exchange.status)} ${code ?? ''}`];
    }
    case 'own': {
      const answer = JSON.stringify(exchange.body);
      const missing = expect.mustInclude(attacker).filter((value) => !answer.includes(value));
      const failed = exchange.status >= 400 || codes.length > 0;
      return failed || missing.length > 0 ? [`wanted own data, got HTTP ${String(exchange.status)} codes [${codes.join()}], missing ${missing.join()}`] : [];
    }
  }
}

/** Runs one case with `attacker` against `victim`. */
export async function runCase(
  http: IsolationHttp,
  world: World,
  testCase: IsolationCase,
  attacker: BusinessWorld,
  victim: BusinessWorld,
): Promise<Outcome> {
  const exchange = await http.send(testCase.request(attacker, victim, world));
  const leaks = leaksIn(exchange, victim).map((value) => `leaks the victim's value ${value}`);
  return { case: testCase, attacker: attacker.label, exchange, failures: [...judge(exchange, testCase.expect, attacker), ...leaks] };
}

/** Runs every case A→B, and the reverse-direction ones B→A too. */
export async function runMatrix(http: IsolationHttp, world: World, cases: readonly IsolationCase[]): Promise<Outcome[]> {
  const outcomes: Outcome[] = [];
  for (const testCase of cases) {
    outcomes.push(await runCase(http, world, testCase, world.a, world.b));
    if (testCase.reverse === true) outcomes.push(await runCase(http, world, testCase, world.b, world.a));
  }
  return outcomes;
}
