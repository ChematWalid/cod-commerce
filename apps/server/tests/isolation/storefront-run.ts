import { INTERNAL_AUTH_HEADERS, type InternalSigningKey } from '@cod/shared/internal-auth';
import { type RawResponse, signedHeaders } from '../e2e/support/signed-request';
import type {
  StorefrontCall,
  StorefrontExpectation,
  StorefrontIsolationCase,
  StorefrontPair,
} from './cases/storefront-catalog';

const OK = 200;
const NOT_FOUND = 404;

/** The headers of `call`: its signature, if any, then the `x-store-id` it sends beside it. */
export function storefrontHeadersOf(key: InternalSigningKey, call: StorefrontCall): Record<string, string> {
  const { signing } = call;
  const signed =
    signing.kind === 'signed'
      ? signedHeaders(
          key,
          { method: 'GET', path: call.path },
          signing.storeId === undefined ? {} : { storeId: signing.storeId },
        )
      : {};
  const header: Record<string, string> =
    signing.storeHeader === undefined ? {} : { [INTERNAL_AUTH_HEADERS.storeId]: signing.storeHeader };
  return { ...signed, ...header };
}

/** What `answer` got wrong against `expectation`, one line per failure; none when it holds. */
export function storefrontFailuresOf(
  expectation: StorefrontExpectation,
  pair: StorefrontPair,
  answer: Pick<RawResponse, 'status' | 'body'>,
): string[] {
  if (expectation.kind === 'refused') {
    const failures = answer.status === NOT_FOUND ? [] : [`status ${String(answer.status)}, expected 404`];
    return answer.body === '' ? failures : [...failures, 'a refusal carried a body'];
  }
  const failures = answer.status === OK ? [] : [`status ${String(answer.status)}, expected 200`];
  const missing = expectation.shows(pair).filter((value) => !answer.body.includes(value));
  const leaked = expectation.hides(pair).filter((value) => answer.body.includes(value));
  return [
    ...failures,
    ...missing.map((value) => `missing its own ${JSON.stringify(value)}`),
    ...leaked.map((value) => `leaked ${JSON.stringify(value)}`),
  ];
}

/** One run of a cell: the attacker, what came back, and how often the store guard ran for it. */
export interface StorefrontOutcome {
  readonly case: StorefrontIsolationCase;
  readonly attacker: 'A' | 'B';
  readonly answer: RawResponse;
  readonly guardCalls: number;
  readonly failures: readonly string[];
}

/** How the matrix reaches the server and counts the store guard's runs. */
export interface StorefrontRunner {
  send(call: StorefrontCall): Promise<RawResponse>;
  guardCalls(): number;
}

/**
 * Runs every cell from A against B and from B against A, one at a time so each guard count belongs to one call. A
 * cell that must never reach the guard fails when the guard ran; one that must reach it fails when it did not.
 */
export async function runStorefrontMatrix(
  runner: StorefrontRunner,
  cases: readonly StorefrontIsolationCase[],
  holdings: Readonly<Record<'A' | 'B', StorefrontPair['attacker']>>,
): Promise<StorefrontOutcome[]> {
  const outcomes: StorefrontOutcome[] = [];
  for (const testCase of cases) {
    for (const attacker of ['A', 'B'] as const) {
      const pair = { attacker: holdings[attacker], victim: holdings[attacker === 'A' ? 'B' : 'A'] };
      const before = runner.guardCalls();
      const answer = await runner.send(testCase.call(pair));
      const guardCalls = runner.guardCalls() - before;
      const reached = guardCalls > 0;
      const guardFailure = reached === testCase.reachesGuard ? [] : [`store guard ran ${String(guardCalls)} times`];
      const failures = [...storefrontFailuresOf(testCase.expect, pair, answer), ...guardFailure];
      outcomes.push({ case: testCase, attacker, answer, guardCalls, failures });
    }
  }
  return outcomes;
}
