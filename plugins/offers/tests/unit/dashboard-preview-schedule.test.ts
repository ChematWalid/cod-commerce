import { describe, expect, it } from 'vitest';
import { createPreviewSchedule, type PreviewTimer } from '../../dashboard/model/preview-schedule';

const DEBOUNCE_MS = 300;

/** A timer driven by the test: `advance` runs what is due. */
function fakeTimer() {
  let now = 0;
  let nextHandle = 1;
  const due = new Map<number, { readonly at: number; readonly run: () => void }>();
  const timer: PreviewTimer<number> = {
    set: (run, ms) => {
      const handle = nextHandle++;
      due.set(handle, { at: now + ms, run });
      return handle;
    },
    clear: (handle) => {
      due.delete(handle);
    },
  };
  const advance = (ms: number): void => {
    now += ms;
    for (const [handle, entry] of [...due]) {
      if (entry.at > now) continue;
      due.delete(handle);
      entry.run();
    }
  };
  return { timer, advance };
}

function scheduleWithRecorder() {
  const { timer, advance } = fakeTimer();
  const fetched: unknown[] = [];
  const schedule = createPreviewSchedule({
    debounceMs: DEBOUNCE_MS,
    timer,
    fetch: (input) => {
      fetched.push(input);
    },
  });
  return { schedule, advance, fetched };
}

describe('preview schedule', () => {
  it('fetches the preview once after rapid field changes', () => {
    // Arrange
    const { schedule, advance, fetched } = scheduleWithRecorder();

    // Act
    schedule.change({ title: 'a' });
    advance(100);
    schedule.change({ title: 'ab' });
    advance(100);
    schedule.change({ title: 'abc' });
    advance(DEBOUNCE_MS);

    // Assert
    expect(fetched).toEqual([{ title: 'abc' }]);
  });

  it('does not refetch an unchanged input', () => {
    // Arrange
    const { schedule, advance, fetched } = scheduleWithRecorder();
    schedule.change({ title: 'a' });
    advance(DEBOUNCE_MS);

    // Act
    schedule.change({ title: 'a' });
    advance(DEBOUNCE_MS);
    schedule.change({ title: 'b' });
    advance(DEBOUNCE_MS);

    // Assert
    expect(fetched).toEqual([{ title: 'a' }, { title: 'b' }]);
  });

  it('fetches nothing after dispose', () => {
    // Arrange
    const { schedule, advance, fetched } = scheduleWithRecorder();
    schedule.change({ title: 'a' });

    // Act
    schedule.dispose();
    advance(DEBOUNCE_MS);
    schedule.change({ title: 'b' });
    advance(DEBOUNCE_MS);

    // Assert
    expect(fetched).toEqual([]);
  });
});
