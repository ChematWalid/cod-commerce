import { useLingui } from '@lingui/react';
import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useLocalFormat,
} from '@vendure/dashboard';
import type { ComponentType, ReactNode } from 'react';
import type { RoleOptionDto, TeamMemberDto } from '../dto';
import { EMPTY_VALUE } from '../constants';
import { formatDzd, listOf, memberRoleLabel, storesTextOf, useUiLanguage } from '../labels';
import {
  COLUMN_LABEL_IDS,
  columnsFor,
  displayNameOf,
  type MemberColumn,
  type StatusView,
  statusOf,
  storeAccessOf,
} from '../member-view-model';
import { LtrRun } from './ltr-run';
import { MemberRowActions, type MemberRowHandlers } from './member-row-actions';

/** Hidden on a phone, so the name, the status and the actions fit without a sideways scroll. */
const WIDE_ONLY = 'hidden md:table-cell';
const WIDE_ONLY_COLUMNS: ReadonlySet<MemberColumn> = new Set(['roles', 'orders', 'stores', 'joined']);
/** A long status ("Invitation expired") wraps inside its badge instead of widening the table past a phone. */
const WRAPPING_BADGE = 'h-auto whitespace-normal text-center';

const BADGE_OF_TONE: Readonly<Record<StatusView['tone'], 'primary' | 'default' | 'destructive' | 'outline'>> = {
  active: 'primary',
  pending: 'default',
  expired: 'destructive',
  inactive: 'outline',
};

interface MembersTableProps extends MemberRowHandlers {
  readonly members: readonly TeamMemberDto[];
  readonly held: ReadonlySet<string>;
  readonly roleOptions: readonly RoleOptionDto[];
}

type CellProps = MembersTableProps & { readonly member: TeamMemberDto };

function EmployeeCell({ member }: CellProps): ReactNode {
  return (
    <span className="grid gap-0.5 [overflow-wrap:anywhere]">
      <span className="font-medium">{displayNameOf(member)}</span>
      {member.name !== null && (
        <span className="text-muted-foreground text-xs">
          <LtrRun>{member.email}</LtrRun>
        </span>
      )}
    </span>
  );
}

function RolesCell({ member, roleOptions }: CellProps): ReactNode {
  const language = useUiLanguage();
  const labels = member.roles.map((role) => memberRoleLabel(role, roleOptions, language));
  return labels.length === 0 ? EMPTY_VALUE : listOf(labels, language);
}

function SalaryCell({ member }: CellProps): ReactNode {
  const language = useUiLanguage();
  return member.baseSalary === null ? EMPTY_VALUE : <LtrRun>{formatDzd(member.baseSalary, language)}</LtrRun>;
}

function StatusCell({ member }: CellProps): ReactNode {
  const { i18n } = useLingui();
  const status = statusOf(member);
  return (
    <Badge variant={BADGE_OF_TONE[status.tone]} className={WRAPPING_BADGE}>
      {i18n._(status.labelId)}
    </Badge>
  );
}

function OrdersCell({ member }: CellProps): ReactNode {
  return <LtrRun>{member.ordersCount}</LtrRun>;
}

function StoresCell({ member }: CellProps): ReactNode {
  const { i18n } = useLingui();
  const language = useUiLanguage();
  return storesTextOf(storeAccessOf(member), language, (id) => i18n._(id));
}

function JoinedCell({ member }: CellProps): ReactNode {
  const { formatDate } = useLocalFormat();
  return member.joinedAt === null ? EMPTY_VALUE : formatDate(member.joinedAt, { dateStyle: 'medium' });
}

function ActionsCell({ member, held, onAction, onPay }: CellProps): ReactNode {
  return <MemberRowActions member={member} held={held} onAction={onAction} onPay={onPay} />;
}

const CELLS: Readonly<Record<MemberColumn, ComponentType<CellProps>>> = {
  employee: EmployeeCell,
  roles: RolesCell,
  salary: SalaryCell,
  status: StatusCell,
  orders: OrdersCell,
  stores: StoresCell,
  joined: JoinedCell,
  actions: ActionsCell,
};

function columnClass(column: MemberColumn): string {
  const visibility = WIDE_ONLY_COLUMNS.has(column) ? WIDE_ONLY : '';
  return `${visibility} ${column === 'actions' ? 'text-end' : 'text-start'}`;
}

function HeaderRow({ columns }: { readonly columns: readonly MemberColumn[] }): ReactNode {
  const { i18n } = useLingui();
  return (
    <TableRow>
      {columns.map((column) => (
        <TableHead key={column} className={columnClass(column)}>
          <span className={column === 'actions' ? 'sr-only' : undefined}>{i18n._(COLUMN_LABEL_IDS[column])}</span>
        </TableHead>
      ))}
    </TableRow>
  );
}

/** The members of the current tab; the columns and actions shown follow what the server says the caller holds. */
export function MembersTable(props: MembersTableProps): ReactNode {
  const columns = columnsFor(props.held);
  return (
    <Table>
      <TableHeader>
        <HeaderRow columns={columns} />
      </TableHeader>
      <TableBody>
        {props.members.map((member) => (
          <TableRow key={member.id} data-member-id={member.id}>
            {columns.map((column) => {
              const Cell = CELLS[column];
              return (
                <TableCell key={column} className={`${columnClass(column)} whitespace-normal`}>
                  <Cell {...props} member={member} />
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
