import { useLingui } from '@lingui/react';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import type { TeamMemberDto } from '../dto';
import { ACTION_LABEL_IDS, canPaySalary, type MemberAction, menuActionsOf } from '../member-view-model';

/** Below this width the row's Pay salary button moves into its menu, as the wide-only columns hide (members-table). */
const WIDE_ONLY_BUTTON = 'hidden md:inline-flex';
const NARROW_ONLY_ITEM = 'md:hidden';

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

interface RowMenuProps extends MemberRowHandlers {
  readonly member: TeamMemberDto;
  readonly actions: readonly MemberAction[];
  readonly canPay: boolean;
}

/** The row's menu; on a phone it also holds Pay salary, whose button is hidden there. */
function RowMenu({ member, actions, canPay, onAction, onPay }: RowMenuProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="icon" variant="ghost" aria-label={i18n._('team.row-actions')} />}>
        ⋮
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canPay && (
          <DropdownMenuItem
            className={NARROW_ONLY_ITEM}
            onClick={() => {
              onPay(member);
            }}
          >
            {i18n._('team.pay-salary')}
          </DropdownMenuItem>
        )}
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
  );
}

/** The row's "Pay salary" button and its menu; the server decides every action again. */
export function MemberRowActions({ member, held, onAction, onPay }: MemberRowActionsProps): ReactNode {
  const { i18n } = useLingui();
  const canPay = canPaySalary(member, held);
  return (
    <span className="flex items-center justify-end gap-1">
      {canPay && (
        <Button
          size="sm"
          variant="outline"
          className={WIDE_ONLY_BUTTON}
          onClick={() => {
            onPay(member);
          }}
        >
          {i18n._('team.pay-salary')}
        </Button>
      )}
      <RowMenu
        member={member}
        actions={menuActionsOf(member, held)}
        canPay={canPay}
        onAction={onAction}
        onPay={onPay}
      />
    </span>
  );
}
