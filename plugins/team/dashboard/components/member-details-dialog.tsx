import { useLingui } from '@lingui/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, useLocalFormat } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import type { RoleOptionDto, TeamMemberDto } from '../dto';
import { EMPTY_VALUE } from '../constants';
import { formatDzd, listOf, memberRoleLabel, storesTextOf, useUiLanguage } from '../labels';
import { displayNameOf, statusOf, storeAccessOf } from '../member-view-model';
import { LtrRun } from './ltr-run';

interface MemberDetailsDialogProps {
  readonly member: TeamMemberDto | null;
  readonly roleOptions: readonly RoleOptionDto[];
  readonly onClose: () => void;
}

function Row({ labelId, children }: { readonly labelId: string; readonly children: ReactNode }): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="grid gap-0.5 sm:grid-cols-3 sm:gap-2">
      <dt className="text-muted-foreground text-sm">{i18n._(labelId)}</dt>
      <dd className="text-sm [overflow-wrap:anywhere] sm:col-span-2">{children}</dd>
    </div>
  );
}

function Details({
  member,
  roleOptions,
}: {
  readonly member: TeamMemberDto;
  readonly roleOptions: readonly RoleOptionDto[];
}) {
  const { i18n } = useLingui();
  const language = useUiLanguage();
  const { formatDate } = useLocalFormat();
  const roles = member.roles.map((role) => memberRoleLabel(role, roleOptions, language));
  return (
    <dl className="grid gap-3">
      <Row labelId="team.field-email">
        <LtrRun>{member.email}</LtrRun>
      </Row>
      <Row labelId="team.column-status">{i18n._(statusOf(member).labelId)}</Row>
      <Row labelId="team.column-roles">{roles.length === 0 ? EMPTY_VALUE : listOf(roles, language)}</Row>
      <Row labelId="team.column-stores">{storesTextOf(storeAccessOf(member), language, (id) => i18n._(id))}</Row>
      {member.baseSalary !== null && (
        <Row labelId="team.column-salary">
          <LtrRun>{formatDzd(member.baseSalary, language)}</LtrRun>
        </Row>
      )}
      <Row labelId="team.field-limit">
        {member.maxOpenOrders === null ? i18n._('team.no-limit') : member.maxOpenOrders}
      </Row>
      <Row labelId="team.receiving-orders">{i18n._(member.receivingOrders ? 'team.yes' : 'team.no')}</Row>
      <Row labelId="team.column-joined">
        {member.joinedAt === null ? EMPTY_VALUE : formatDate(member.joinedAt, { dateStyle: 'medium' })}
      </Row>
    </dl>
  );
}

/** "View details": what the list row holds, readable on a phone where the table hides columns. */
export function MemberDetailsDialog({ member, roleOptions, onClose }: MemberDetailsDialogProps): ReactNode {
  return (
    <Dialog
      open={member !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="cod-team-dialog sm:max-w-lg">
        {member !== null && (
          <>
            <DialogHeader>
              <DialogTitle>{displayNameOf(member)}</DialogTitle>
            </DialogHeader>
            <Details member={member} roleOptions={roleOptions} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
