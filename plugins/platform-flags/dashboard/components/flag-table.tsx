import { useLingui } from '@lingui/react';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import type { FlagDto } from '../queries';
import { FlagRow } from './flag-row';

const HEADERS = [
  { id: 'flags.column-key', className: '' },
  { id: 'flags.column-description', className: 'hidden md:table-cell' },
  { id: 'flags.column-default', className: '' },
  { id: 'flags.column-rollout', className: '' },
  { id: 'flags.column-overrides', className: '' },
];

/** Every flag: key, description, default switch, rollout percent and the count of its overrides. */
export function FlagTable({ flags }: { readonly flags: readonly FlagDto[] }): ReactNode {
  const { i18n } = useLingui();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {HEADERS.map(({ id, className }) => (
            <TableHead key={id} className={`${className} text-start`}>
              {i18n._(id)}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {flags.map((flag) => (
          <FlagRow key={flag.key} flag={flag} />
        ))}
      </TableBody>
    </Table>
  );
}
