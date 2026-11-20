import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PREVIEW_DELAY_MS } from '../../dashboard/constants';
import type { StoreCollectionProductPageDto, StoreCollectionRuleDto } from '../../dashboard/dto';
import { type PreviewState, PreviewRequester } from '../../dashboard/model/preview-request';

const STORE_A = { storeId: '1', channelToken: 'token-a' };
const STORE_B_TOKEN = 'token-b';

const ruleOf = (tagId: string): StoreCollectionRuleDto => ({
  version: 1,
  match: 'all',
  conditions: [{ field: 'tag', operator: 'is_any_of', values: [tagId] }],
});
const pageOf = (count: number): StoreCollectionProductPageDto => ({ items: [], totalItems: count });

/** A deferred answer the test settles when it wants, as a slow server would. */
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function harness() {
  let token: string | null = STORE_A.channelToken;
  const shown: PreviewState[] = [];
  const fetchPreview = vi.fn<(rule: StoreCollectionRuleDto) => Promise<StoreCollectionProductPageDto>>();
  const requester = new PreviewRequester({ readToken: () => token, fetchPreview }, (state) => {
    shown.push(state);
  });
  return {
    requester,
    fetchPreview,
    shown,
    answers: () => shown.filter((state) => state.kind === 'answered'),
    switchStore: (): void => {
      token = STORE_B_TOKEN;
    },
  };
}

describe('preview request', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits 400 ms after the last change', async () => {
    // Arrange
    const h = harness();
    h.fetchPreview.mockResolvedValue(pageOf(3));

    // Act
    h.requester.request(STORE_A, ruleOf('7301234567890123401'));
    await vi.advanceTimersByTimeAsync(PREVIEW_DELAY_MS - 1);
    h.requester.request(STORE_A, ruleOf('7301234567890123402'));
    await vi.advanceTimersByTimeAsync(PREVIEW_DELAY_MS - 1);
    const callsBefore = h.fetchPreview.mock.calls.length;
    await vi.advanceTimersByTimeAsync(1);

    // Assert
    expect(callsBefore).toBe(0);
    expect(h.fetchPreview.mock.calls).toEqual([[ruleOf('7301234567890123402')]]);
    expect(h.answers()).toEqual([{ kind: 'answered', page: pageOf(3) }]);
  });

  it('drops an answer for an older draft', async () => {
    // Arrange
    const h = harness();
    const older = deferred<StoreCollectionProductPageDto>();
    h.fetchPreview.mockReturnValueOnce(older.promise).mockResolvedValueOnce(pageOf(7));

    // Act
    h.requester.request(STORE_A, ruleOf('7301234567890123401'));
    await vi.advanceTimersByTimeAsync(PREVIEW_DELAY_MS);
    h.requester.request(STORE_A, ruleOf('7301234567890123402'));
    await vi.advanceTimersByTimeAsync(PREVIEW_DELAY_MS);
    older.resolve(pageOf(99));
    await vi.runAllTimersAsync();

    // Assert
    expect(h.answers()).toEqual([{ kind: 'answered', page: pageOf(7) }]);
  });

  it('drops a preview answer whose store is no longer active', async () => {
    // Arrange
    const h = harness();
    const slow = deferred<StoreCollectionProductPageDto>();
    h.fetchPreview.mockReturnValueOnce(slow.promise);

    // Act
    h.requester.request(STORE_A, ruleOf('7301234567890123401'));
    await vi.advanceTimersByTimeAsync(PREVIEW_DELAY_MS);
    h.switchStore();
    slow.resolve(pageOf(5));
    await vi.runAllTimersAsync();

    // Assert
    expect(h.answers()).toEqual([]);
    expect(h.shown.some((state) => state.kind === 'failed')).toBe(false);
  });

  it('asks nothing without a complete rule and forgets a pending one', async () => {
    // Arrange
    const h = harness();

    // Act
    h.requester.request(STORE_A, ruleOf('7301234567890123401'));
    h.requester.request(STORE_A, null);
    await vi.runAllTimersAsync();

    // Assert
    expect(h.fetchPreview).not.toHaveBeenCalled();
    expect(h.shown.at(-1)).toEqual({ kind: 'idle' });
  });

  it('shows a server refusal of the current draft', async () => {
    // Arrange
    const h = harness();
    const refusal = new Error('collections.rate-limited');
    h.fetchPreview.mockRejectedValueOnce(refusal);

    // Act
    h.requester.request(STORE_A, ruleOf('7301234567890123401'));
    await vi.runAllTimersAsync();

    // Assert
    expect(h.shown.at(-1)).toEqual({ kind: 'failed', error: refusal });
  });
});
