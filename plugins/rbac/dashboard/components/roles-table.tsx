import { PERMISSION_CATALOG } from '@cod/shared';
import { useLingui } from '@lingui/react';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useLocalFormat,
} from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { CREATE_ROLE_KEY, DELETE_ROLE_KEY, EDIT_ROLE_KEY } from '../constants';
import { roleNameIn, useUiLanguage } from '../labels';
import type { BusinessRoleDto } from '../queries';
import { LtrRun } from './ltr-run';

const TOTAL_PERMISSIONS = PERMISSION_CATALOG.length;
const HEADER_IDS = ['rbac.column-role', 'rbac.column-members', 'rbac.column-access', 'rbac.column-updated'];

/** What a row's menu can ask for. */
export interface RoleActions {
  readonly onEdit: (role: BusinessRoleDto) => void;
  readonly onDuplicate: (role: BusinessRoleDto) => void;
  readonly onDelete: (role: BusinessRoleDto) => void;
}

interface RolesTableProps extends RoleActions {
  readonly roles: readonly BusinessRoleDto[];
  readonly held: ReadonlySet<string>;
}

interface RowMenuProps extends RoleActions {
  readonly role: BusinessRoleDto;
  readonly held: ReadonlySet<string>;
}

function RowMenu({ role, held, onEdit, onDuplicate, onDelete }: RowMenuProps): ReactNode {
  const { i18n } = useLingui();
  const actions = [
    { id: 'rbac.edit', allowed: !role.isBuiltIn && held.has(EDIT_ROLE_KEY), run: onEdit },
    { id: 'rbac.duplicate', allowed: held.has(CREATE_ROLE_KEY), run: onDuplicate },
    { id: 'rbac.delete', allowed: !role.isBuiltIn && held.has(DELETE_ROLE_KEY), run: onDelete },
  ].filter((action) => action.allowed);
  if (actions.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="icon" variant="ghost" aria-label={i18n._('rbac.row-actions')} />}>
        ⋮
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map(({ id, run }) => (
          <DropdownMenuItem
            key={id}
            onClick={() => {
              run(role);
            }}
          >
            {i18n._(id)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AccessCell({ count }: { readonly count: number }): ReactNode {
  const { i18n } = useLingui();
  if (count === TOTAL_PERMISSIONS) return i18n._('rbac.full-access');
  return <LtrRun>{`${String(count)} / ${String(TOTAL_PERMISSIONS)}`}</LtrRun>;
}

function RoleRow({ role, ...actions }: RowMenuProps): ReactNode {
  const { i18n } = useLingui();
  const language = useUiLanguage();
  const { formatDate } = useLocalFormat();
  return (
    <TableRow>
      <TableCell>
        <span className="flex flex-wrap items-center gap-2 font-medium">
          {roleNameIn(role, language)}
          {role.isBuiltIn && <Badge variant="outline">{i18n._('rbac.built-in')}</Badge>}
        </span>
      </TableCell>
      <TableCell>
        <LtrRun>{role.memberCount}</LtrRun>
      </TableCell>
      <TableCell>
        <AccessCell count={role.permissionCount} />
      </TableCell>
      <TableCell>{formatDate(role.updatedAt, { dateStyle: 'medium' })}</TableCell>
      <TableCell className="text-end">
        <RowMenu role={role} {...actions} />
      </TableCell>
    </TableRow>
  );
}

/** The roles of the business. The actions shown come from what the server says the caller holds. */
export function RolesTable({ roles, ...rowProps }: RolesTableProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {HEADER_IDS.map((id) => (
            <TableHead key={id} className="text-start">
              {i18n._(id)}
            </TableHead>
          ))}
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {roles.map((role) => (
          <RoleRow key={role.id} role={role} {...rowProps} />
        ))}
      </TableBody>
    </Table>
  );
}
