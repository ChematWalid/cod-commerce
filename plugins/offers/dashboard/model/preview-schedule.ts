/** The timer a schedule waits with: `setTimeout`/`clearTimeout` in the app, a fake in tests. */
export interface PreviewTimer<Handle> {
  set(run: () => void, ms: number): Handle;
  clear(handle: Handle): void;
}

export interface PreviewScheduleOptions<Input, Handle> {
  /** The quiet time after the last change before the preview is fetched. */
  readonly debounceMs: number;
  readonly timer: PreviewTimer<Handle>;
  /** Asks for the preview of `input`. */
  readonly fetch: (input: Input) => void;
}

export interface PreviewSchedule<Input> {
  /** The form changed: fetch `input` once the changes stop, unless it equals the last fetched input. */
  change(input: Input): void;
  /** The editor closed: nothing is fetched any more. */
  dispose(): void;
}

const keyOf = (input: unknown): string => JSON.stringify(input);

/**
 * Debounces the editor's live preview (D2516): one request per quiet period, none for an input equal to the last one
 * fetched, none after `dispose`. Pure, so it is tested with a fake timer; the hook only wires it to React.
 */
export function createPreviewSchedule<Input, Handle>(
  options: PreviewScheduleOptions<Input, Handle>,
): PreviewSchedule<Input> {
  let pending: Handle | undefined;
  let lastFetched: string | undefined;
  let disposed = false;
  const cancel = (): void => {
    if (pending !== undefined) options.timer.clear(pending);
    pending = undefined;
  };
  const fire = (input: Input): void => {
    pending = undefined;
    const key = keyOf(input);
    if (disposed || key === lastFetched) return;
    lastFetched = key;
    options.fetch(input);
  };
  return {
    change(input) {
      if (disposed) return;
      cancel();
      pending = options.timer.set(() => {
        fire(input);
      }, options.debounceMs);
    },
    dispose() {
      disposed = true;
      cancel();
    },
  };
}
