import { useLingui } from '@lingui/react';
import { Button } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { KIND_CHIPS_TEST_ID } from '../constants';
import type { KindChip } from '../model/app-type-cards';

interface KindChipsProps {
  readonly chips: readonly KindChip[];
  /** The kind shown, `null` for every kind. */
  readonly kind: string | null;
  readonly onKind: (kind: string | null) => void;
}

function Chip(props: { readonly pressed: boolean; readonly label: string; readonly onPress: () => void }): ReactNode {
  return (
    <Button
      type="button"
      size="sm"
      variant={props.pressed ? 'default' : 'outline'}
      aria-pressed={props.pressed}
      className="rounded-full"
      onClick={props.onPress}
    >
      {props.label}
    </Button>
  );
}

/** Every kind, or one: a chip per kind the create dialog offers. */
export function KindChips({ chips, kind, onKind }: KindChipsProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label={i18n._('offers.kind-filter')}
      data-testid={KIND_CHIPS_TEST_ID}
    >
      <Chip
        pressed={kind === null}
        label={i18n._('offers.kind-all')}
        onPress={() => {
          onKind(null);
        }}
      />
      {chips.map((chip) => (
        <Chip
          key={chip.kind}
          pressed={kind === chip.kind}
          label={i18n._(chip.labelId)}
          onPress={() => {
            onKind(chip.kind);
          }}
        />
      ))}
    </div>
  );
}
