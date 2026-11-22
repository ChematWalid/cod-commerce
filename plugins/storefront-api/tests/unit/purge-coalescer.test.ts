import { describe, expect, it } from 'vitest';
import { PurgeCoalescer } from '../../application/purge-coalescer';
import { PURGE_MAX_HOSTNAMES, PURGE_WINDOW_MS } from '../../domain/constants';

/** A clock the test moves by hand. */
class FakeClock {
  private ms = 1_800_000_000_000;

  now = (): number => this.ms;

  advance(ms: number): void {
    this.ms += ms;
  }
}

const STORE_A = '7340032000000001';
const storeId = (index: number): string => String(7340032000000100 + index);

describe('PurgeCoalescer', () => {
  it('purges one store at most once per window, however often it publishes', () => {
    // Arrange: 50 publishes of one store over 60 s, a flush after each
    const clock = new FakeClock();
    const coalescer = new PurgeCoalescer(clock.now);
    const purges: string[][] = [];

    // Act
    for (let publish = 0; publish < 50; publish += 1) {
      coalescer.request(STORE_A, ['demo.example.dz']);
      purges.push(...coalescer.due().map((batch) => [...batch.hostnames]));
      clock.advance(1_200);
    }

    // Assert: one purge at 0 s, one at 30 s
    expect(purges).toHaveLength(2);
    expect(purges.every((hostnames) => hostnames.length <= PURGE_MAX_HOSTNAMES)).toBe(true);
  });

  it('keeps a request made inside the window and purges it once the window is over', () => {
    // Arrange
    const clock = new FakeClock();
    const coalescer = new PurgeCoalescer(clock.now);
    coalescer.request(STORE_A, ['demo.example.dz']);
    coalescer.due();
    clock.advance(1_000);
    coalescer.request(STORE_A, ['demo.example.dz', 'shop.demo.dz']);

    // Act
    const early = coalescer.due();
    clock.advance(PURGE_WINDOW_MS);
    const late = coalescer.due();

    // Assert
    expect(early).toEqual([]);
    expect(late).toEqual([{ hostnames: ['demo.example.dz', 'shop.demo.dz'] }]);
    expect(coalescer.due()).toEqual([]);
  });

  it('batches the hostnames of many stores into requests of at most 100', () => {
    // Arrange: 150 stores with one hostname each in one window
    const clock = new FakeClock();
    const coalescer = new PurgeCoalescer(clock.now);
    for (let index = 0; index < 150; index += 1) coalescer.request(storeId(index), [`s${String(index)}.example.dz`]);

    // Act
    const batches = coalescer.due();

    // Assert
    expect(batches.map((batch) => batch.hostnames.length)).toEqual([100, 50]);
    expect(new Set(batches.flatMap((batch) => batch.hostnames)).size).toBe(150);
  });

  it('sends each hostname once when two stores share it', () => {
    // Arrange
    const coalescer = new PurgeCoalescer(new FakeClock().now);
    coalescer.request(storeId(1), ['shared.example.dz']);
    coalescer.request(storeId(2), ['shared.example.dz', 'other.example.dz']);

    // Act
    const batches = coalescer.due();

    // Assert
    expect(batches).toEqual([{ hostnames: ['shared.example.dz', 'other.example.dz'] }]);
  });

  it('ignores a request without hostnames', () => {
    // Arrange
    const coalescer = new PurgeCoalescer(new FakeClock().now);

    // Act
    coalescer.request(STORE_A, []);

    // Assert
    expect(coalescer.due()).toEqual([]);
    expect(coalescer.pendingStores).toBe(0);
  });
});
