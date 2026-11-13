import { useLingui } from '@lingui/react';
import { Button, Switch, TableCell, TableRow } from '@vendure/dashboard';
import { Fragment, type ReactNode, useState } from 'react';
import { flagDescription } from '../flag-description';
import { useUpdateFlag } from '../hooks/use-flag-mutations';
import type { FlagDto } from '../queries';
import { LtrRun } from './ltr-run';
import { OverrideList } from './override-list';
import { RolloutField } from './rollout-field';

/** Hidden on a phone: the key, the switch, the rollout and the overrides are what staff act on. */
const DESCRIPTION_COLUMN_CLASS = 'hidden md:table-cell';

/** The stock stylesheet sets `direction: rtl` on every element, which the `dir` attribute does not beat. */
const KEY_STYLE = { direction: 'ltr', unicodeBidi: 'isolate', display: 'inline-block' } as const;

/** A key breaks after a dot or a hyphen, never inside a word. */
const keyParts = (key: string): string[] => key.split(/(?<=[.-])/);

function KeyCell({ flagKey }: { readonly flagKey: string }): ReactNode {
  return (
    <bdi dir="ltr" style={KEY_STYLE}>
      {keyParts(flagKey).map((part, index) => (
        <Fragment key={`${String(index)}:${part}`}>
          {part}
          <wbr />
        </Fragment>
      ))}
    </bdi>
  );
}

function DefaultSwitch({ flag }: { readonly flag: FlagDto }): ReactNode {
  const { i18n } = useLingui();
  const update = useUpdateFlag(flag.key);
  return (
    <Switch
      className="cod-flags-switch"
      data-testid={`flag-default-${flag.key}`}
      aria-label={i18n._('flags.default-switch', { flag: flag.key })}
      checked={flag.defaultEnabled}
      disabled={update.isPending}
      onCheckedChange={(on) => {
        update.mutate({ defaultEnabled: on });
      }}
    />
  );
}

interface OverridesToggleProps {
  readonly flag: FlagDto;
  readonly open: boolean;
  readonly onToggle: () => void;
}

function OverridesToggle({ flag, open, onToggle }: OverridesToggleProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-expanded={open}
      aria-label={i18n._('flags.overrides-toggle', { flag: flag.key })}
      data-testid={`flag-overrides-${flag.key}`}
      onClick={onToggle}
    >
      <LtrRun>{flag.overrides.length}</LtrRun>
    </Button>
  );
}

/** A flag's row, and below it, when opened, its overrides. */
export function FlagRow({ flag }: { readonly flag: FlagDto }): ReactNode {
  const [open, setOpen] = useState(false);
  const { i18n } = useLingui();
  return (
    <Fragment>
      <TableRow data-testid={`flag-row-${flag.key}`}>
        <TableCell className="whitespace-normal break-words font-medium">
          <KeyCell flagKey={flag.key} />
        </TableCell>
        <TableCell className={`${DESCRIPTION_COLUMN_CLASS} whitespace-normal`}>
          {flagDescription((id) => i18n._(id), flag)}
        </TableCell>
        <TableCell>
          <DefaultSwitch flag={flag} />
        </TableCell>
        <TableCell>
          <RolloutField flag={flag} />
        </TableCell>
        <TableCell>
          <OverridesToggle
            flag={flag}
            open={open}
            onToggle={() => {
              setOpen(!open);
            }}
          />
        </TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={5} className="whitespace-normal">
            <OverrideList flag={flag} />
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}
