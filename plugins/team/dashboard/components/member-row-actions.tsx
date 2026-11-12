import { useLingui } from '@lingui/react';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import type { TeamMemberDto } from '../dto';
import { ACTION_LABEL_IDS, canPaySalary, type MemberAction, menuActionsOf } from '../member-view-model';

/** Actions a destructive style marks, so a misclick reads as one. */
const DESTRUCTIVE_ACTIONS: ReadonlySet<MemberAction> = new Set(['revoke', 'deactivate', 'remove']);

/** What a row asks the page for. */
export interface MemberRowHandlers {
  readonly onAction: (action: MemberAction, member: TeamMemberDto) => void;
  readonly onPay: (member: TeamMemberDto) => void;
}

interface MemberRowActionsProps extends MemberRowHandlers {
  readonly member: TeamMemberDto;
  readonly held: ReadonlySet<string>;
}

/** The row's "Pay salary" button and its menu; the server decides every action again. */
export function MemberRowActions({ member, held, onAction, onPay }: MemberRowActionsProps): ReactNode {
  const { i18n } = useLingui();
  const actions = menuActionsOf(member, held);
  return (
    <span className="flex items-center justify-end gap-1">
      {canPaySalary(member, held) && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            onPay(member);
          }}
        >
          {i18n._('team.pay-salary')}
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button size="icon" variant="ghost" aria-label={i18n._('team.row-actions')} />}>
          ⋮
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.map((action) => (
            <DropdownMenuItem
              key={action}
              variant={DESTRUCTIVE_ACTIONS.has(action) ? 'destructive' : 'default'}
              onClick={() => {
                onAction(action, member);
              }}
            >
              {i18n._(ACTION_LABEL_IDS[action])}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
