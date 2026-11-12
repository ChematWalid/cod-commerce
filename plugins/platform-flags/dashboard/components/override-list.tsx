import { useLingui } from '@lingui/react';
import { Badge, Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@vendure/dashboard';
import { type ReactNode, useState } from 'react';
import { SCOPE_MESSAGE_IDS } from '../constants';
import { useRemoveOverride } from '../hooks/use-flag-mutations';
import type { FlagDto, FlagOverrideDto } from '../queries';
import { LtrRun } from './ltr-run';
import { OverrideDialog } from './override-dialog';

interface OverrideRowProps {
  readonly flagKey: string;
  readonly override: FlagOverrideDto;
}

function OverrideRow({ flagKey, override }: OverrideRowProps): ReactNode {
  const { i18n } = useLingui();
  const remove = useRemoveOverride();
  return (
    <TableRow data-testid={`flag-override-${flagKey}-${override.scope.toLowerCase()}-${override.scopeId}`}>
      <TableCell className="whitespace-normal">{i18n._(SCOPE_MESSAGE_IDS[override.scope])}</TableCell>
      <TableCell className="whitespace-normal [overflow-wrap:anywhere]">
        <LtrRun>{override.scopeId}</LtrRun>
      </TableCell>
      <TableCell>
        <Badge variant={override.enabled ? 'default' : 'outline'}>
          {i18n._(override.enabled ? 'flags.state-on' : 'flags.state-off')}
        </Badge>
      </TableCell>
      <TableCell className="text-end">
        <Button
          size="sm"
          variant="ghost"
          disabled={remove.isPending}
          onClick={() => {
            remove.mutate({ key: flagKey, scope: override.scope, scopeId: override.scopeId });
          }}
        >
          {i18n._('flags.remove-override')}
        </Button>
      </TableCell>
    </TableRow>
  );
}

function OverrideTable({ flag }: { readonly flag: FlagDto }): ReactNode {
  const { i18n } = useLingui();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-start">{i18n._('flags.column-scope')}</TableHead>
          <TableHead className="text-start">{i18n._('flags.target-id')}</TableHead>
          <TableHead className="text-start">{i18n._('flags.column-state')}</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {flag.overrides.map((override) => (
          <OverrideRow key={`${override.scope}:${override.scopeId}`} flagKey={flag.key} override={override} />
        ))}
      </TableBody>
    </Table>
  );
}

/** The overrides of one flag, and the dialog that adds one. */
export function OverrideList({ flag }: { readonly flag: FlagDto }): ReactNode {
  const { i18n } = useLingui();
  const [adding, setAdding] = useState(false);
  return (
    <div className="grid gap-3 p-2">
      {flag.overrides.length === 0 ? (
        <p className="text-muted-foreground text-sm">{i18n._('flags.overrides-empty')}</p>
      ) : (
        <OverrideTable flag={flag} />
      )}
      <div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setAdding(true);
          }}
        >
          {i18n._('flags.add-override')}
        </Button>
      </div>
      <OverrideDialog
        open={adding}
        flagKey={flag.key}
        onClose={() => {
          setAdding(false);
        }}
      />
    </div>
  );
}
