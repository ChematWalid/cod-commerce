import { SLUG_MAX } from '@cod/shared';
import { TextField } from '@cod/plugin-merchant-shell/shell-api';
import { useLingui } from '@lingui/react';
import { type ReactNode, useEffect, useState } from 'react';
import { SLUG_CHECK_DELAY_MS } from '../constants';
import { useSlugAvailability } from '../editor-queries';
import type { StoreScope } from '../queries';

/** `value` once it has not changed for `delayMs`, so a check runs per pause in typing, not per key. */
function useSettled(value: string, delayMs: number): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSettled(value);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);
  return settled;
}

interface SlugFieldProps {
  readonly scope: StoreScope | null;
  readonly productId: string | null;
  readonly value: string;
  readonly disabled: boolean;
  readonly onChange: (slug: string) => void;
}

/** What the check says about the settled slug, as a catalogue id; nothing while the field is empty or checking. */
function useSlugVerdict(props: SlugFieldProps): string | undefined {
  const settled = useSettled(props.value, SLUG_CHECK_DELAY_MS);
  const check = useSlugAvailability(props.scope, settled, props.productId);
  if (settled.trim() === '' || settled !== props.value || !check.isSuccess) return undefined;
  return check.data.available ? 'catalog.slug-available' : 'catalog.slug-taken';
}

/**
 * The product's URL name in its store. The business-scoped check (D2103) runs 500 ms after the last key; the server
 * decides again on save, and an empty slug is made from the title.
 */
export function SlugField(props: SlugFieldProps): ReactNode {
  const { i18n } = useLingui();
  const verdict = useSlugVerdict(props);
  return (
    <div className="grid gap-1">
      <TextField
        label={i18n._('catalog.editor-slug')}
        hint={i18n._('catalog.editor-slug-hint')}
        value={props.value}
        maxLength={SLUG_MAX}
        disabled={props.disabled}
        onChange={(event) => {
          props.onChange(event.target.value);
        }}
      />
      {verdict !== undefined && (
        <p role="status" className={verdict === 'catalog.slug-taken' ? 'text-destructive text-sm' : 'text-sm'}>
          {i18n._(verdict)}
        </p>
      )}
    </div>
  );
}
