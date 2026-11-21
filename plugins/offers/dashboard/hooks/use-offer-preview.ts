import type { OfferPreview, OfferPreviewInput } from '@cod/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PREVIEW_DEBOUNCE_MS } from '../constants';
import { useOfferPreview, useTargetProduct } from '../editor-queries';
import type { OfferEditorForm } from '../model/editor-form';
import { listErrorMessageId } from '../model/list-view';
import { createPreviewSchedule, type PreviewSchedule } from '../model/preview-schedule';
import { previewInputOf, sampleProductIdOf } from '../model/preview-input';
import type { StoreScope } from '../queries';

export interface PreviewState {
  readonly preview?: OfferPreview;
  /** The catalogue id of the last preview's refusal. */
  readonly error?: string;
  readonly loading: boolean;
}

/** The input the schedule last let through, once the form has been quiet for `debounceMs`. */
function useDebouncedInput(input: OfferPreviewInput, debounceMs: number): OfferPreviewInput | null {
  const [settled, setSettled] = useState<OfferPreviewInput | null>(null);
  const schedule = useRef<PreviewSchedule<OfferPreviewInput> | null>(null);
  useEffect(() => {
    const created = createPreviewSchedule<OfferPreviewInput, ReturnType<typeof setTimeout>>({
      debounceMs,
      timer: {
        set: (run, ms) => setTimeout(run, ms),
        clear: (handle) => {
          clearTimeout(handle);
        },
      },
      fetch: setSettled,
    });
    schedule.current = created;
    return () => {
      created.dispose();
    };
  }, [debounceMs]);
  useEffect(() => {
    schedule.current?.change(input);
  }, [input]);
  return settled;
}

/**
 * The live preview of the editor's form (D2516): priced by the server at the first buy product's price when it is
 * known, asked again once the form is quiet for `debounceMs`, never for an unchanged input.
 */
export function usePreview(
  scope: StoreScope | null,
  form: OfferEditorForm,
  debounceMs: number = PREVIEW_DEBOUNCE_MS,
): PreviewState {
  const sample = useTargetProduct(scope, sampleProductIdOf(form)).data?.price ?? null;
  const input = useMemo(() => previewInputOf(form, sample), [form, sample]);
  const answer = useOfferPreview(scope, useDebouncedInput(input, debounceMs));
  return {
    loading: answer.isFetching,
    ...(answer.data === undefined ? {} : { preview: answer.data }),
    ...(answer.isError ? { error: listErrorMessageId(answer.error) } : {}),
  };
}
