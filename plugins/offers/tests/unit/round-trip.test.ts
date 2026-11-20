import { describe, expect, it } from 'vitest';

import { roundTrips } from '../fakes/round-trip';
import { rejectionOf } from '../support/rejection';

class Refused extends Error {}

class Store {
  readonly calls: string[] = [];

  read(name: string): Promise<string> {
    this.calls.push(name);
    return Promise.resolve(name);
  }

  refuse(name: string): Promise<string> {
    this.calls.push(name);
    return Promise.reject(new Refused(name));
  }
}

const harness = () => {
  const reported: unknown[] = [];
  const wrap = roundTrips((error) => reported.push(error));
  const first = new Store();
  const second = new Store();
  return { reported, first, second, a: wrap(first), b: wrap(second) };
};

const reportedNames = (reported: unknown[]): string[] =>
  reported.map((error) => (error instanceof Error ? error.message : String(error)));

describe('withRoundTrips', () => {
  it('answers a call on a later turn of the event loop', async () => {
    const { first, a } = harness();

    const answer = a.read('x');
    const ranAtOnce = first.calls.length;

    expect(ranAtOnce).toBe(0);
    expect(await answer).toBe('x');
  });

  it('reports a refusal left pending while another call is awaited', async () => {
    const { reported, a, b } = harness();

    const pending = a.refuse('left pending');
    await b.read('other');
    await rejectionOf(pending);

    expect(reportedNames(reported)).toEqual([expect.stringContaining('left pending')]);
  });

  it('reports the second of two refusals started together and awaited in turn', async () => {
    const { reported, a } = harness();

    const firstRefusal = a.refuse('first');
    const secondRefusal = a.refuse('second');
    await rejectionOf(firstRefusal);
    await rejectionOf(secondRefusal);

    expect(reportedNames(reported)).toEqual([expect.stringContaining('second')]);
  });

  it('still rejects a reported call with the refusal itself', async () => {
    const { a, b } = harness();

    const pending = a.refuse('kept');
    await b.read('other');
    const error = await rejectionOf(pending);

    expect(error).toBeInstanceOf(Refused);
  });

  it('accepts refusals awaited where they start, alone or together', async () => {
    const { reported, a, b } = harness();

    const alone = await rejectionOf(a.refuse('alone'));
    const together = await Promise.allSettled([a.refuse('one'), b.refuse('two')]);

    expect(alone).toBeInstanceOf(Refused);
    expect(together.map((result) => result.status)).toEqual(['rejected', 'rejected']);
    expect(reported).toEqual([]);
  });

  it('accepts a successful call left pending while another call is awaited', async () => {
    const { reported, a, b } = harness();

    const pending = a.read('later');
    await b.read('other');

    expect(await pending).toBe('later');
    expect(reported).toEqual([]);
  });
});
