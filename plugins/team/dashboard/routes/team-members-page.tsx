import type { MemberTab } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Link } from '@tanstack/react-router';
import {
  ActionBarItem,
  Button,
  FullWidthPageBlock,
  Page,
  PageActionBar,
  PageLayout,
  PageTitle,
} from '@vendure/dashboard';
import { type ReactNode, useDeferredValue, useState } from 'react';
import { MembersTable } from '../components/members-table';
import { MembersPager, MembersToolbar } from '../components/members-toolbar';
import { TeamDialogs, type TeamDialogState } from '../components/team-dialogs';
import { LOADING_MESSAGE_ID, ROLES_TAB_PATH, TEAM_PAGE_TEST_ID, VIEW_ROLES_KEY } from '../constants';
import type { TeamMemberDto } from '../dto';
import { errorMessageId } from '../error-messages';
import { isMemberCommand, needsConfirmation, useMemberCommand } from '../hooks/use-member-commands';
import { canInvite, type MemberAction } from '../member-view-model';
import { useHeldPermissions, useRoleOptions, useTeamMembers } from '../queries';

const PAGE_ID = 'team-members';
const BLOCK_ID = 'team-members-list';
const INVITE_ACTION_ID = 'team-invite';
const ROLES_ACTION_ID = 'team-roles-link';

/** The list's tab, search and page; a new tab or search starts again at page 1. */
function useListQuery() {
  const [tab, setTab] = useState<MemberTab>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);
  return {
    tab,
    search,
    page,
    query: { tab, search: deferredSearch, page },
    onTab: (next: MemberTab) => {
      setTab(next);
      setPage(1);
    },
    onSearch: (next: string) => {
      setSearch(next);
      setPage(1);
    },
    onPage: setPage,
  };
}

/** Which dialog a row action opens, or the command it runs straight away. */
function useRowActions(setDialog: (state: TeamDialogState) => void) {
  const command = useMemberCommand(() => undefined);
  const onAction = (action: MemberAction, member: TeamMemberDto): void => {
    if (action === 'view') setDialog({ kind: 'details', member });
    if (action === 'edit') setDialog({ kind: 'edit', member });
    if (action === 'set-limit') setDialog({ kind: 'limit', member });
    if (!isMemberCommand(action)) return;
    if (needsConfirmation(action)) setDialog({ kind: 'confirm', command: action, member });
    else command.mutate({ command: action, member });
  };
  return {
    onAction,
    onPay: (member: TeamMemberDto) => {
      setDialog({ kind: 'pay', member });
    },
  };
}

function TeamActionBar({ held, onInvite }: { readonly held: ReadonlySet<string>; readonly onInvite: () => void }) {
  const { i18n } = useLingui();
  return (
    <PageActionBar>
      {held.has(VIEW_ROLES_KEY) && (
        <ActionBarItem itemId={ROLES_ACTION_ID}>
          <Button variant="outline" render={<Link to={ROLES_TAB_PATH} />}>
            {i18n._('team.nav-roles')}
          </Button>
        </ActionBarItem>
      )}
      {canInvite(held) && (
        <ActionBarItem itemId={INVITE_ACTION_ID}>
          <Button onClick={onInvite}>{i18n._('team.invite-button')}</Button>
        </ActionBarItem>
      )}
    </PageActionBar>
  );
}

function MembersBody(props: {
  readonly members: ReturnType<typeof useTeamMembers>;
  readonly held: ReadonlySet<string>;
  readonly rows: ReturnType<typeof useRowActions>;
  readonly roleOptions: ReturnType<typeof useRoleOptions>;
}): ReactNode {
  const { i18n } = useLingui();
  const { members, held, rows } = props;
  if (members.isError) return <p role="alert">{i18n._(errorMessageId(members.error))}</p>;
  if (!members.isSuccess) return <p>{i18n._(LOADING_MESSAGE_ID)}</p>;
  if (members.data.items.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">{i18n._('team.empty')}</p>;
  }
  const roleOptions = props.roleOptions.data ?? [];
  return <MembersTable members={members.data.items} held={held} roleOptions={roleOptions} {...rows} />;
}

/** The team of the business: status tabs, search, the members table and its dialogs (the `team.members` leaf). */
export function TeamMembersPage(): ReactNode {
  const { i18n } = useLingui();
  const held = useHeldPermissions();
  const list = useListQuery();
  const members = useTeamMembers(list.query);
  const roleOptions = useRoleOptions(held.has(VIEW_ROLES_KEY));
  const [dialog, setDialog] = useState<TeamDialogState>({ kind: 'none' });
  const rows = useRowActions(setDialog);
  return (
    <Page pageId={PAGE_ID}>
      <PageTitle>{i18n._('team.nav-members')}</PageTitle>
      <TeamActionBar
        held={held}
        onInvite={() => {
          setDialog({ kind: 'invite' });
        }}
      />
      <PageLayout>
        <FullWidthPageBlock blockId={BLOCK_ID}>
          <div className="grid gap-4" data-testid={TEAM_PAGE_TEST_ID}>
            <MembersToolbar {...list} counts={members.data?.counts} />
            <MembersBody members={members} held={held} rows={rows} roleOptions={roleOptions} />
            <MembersPager page={list.page} total={members.data?.total ?? 0} onPage={list.onPage} />
          </div>
        </FullWidthPageBlock>
      </PageLayout>
      <TeamDialogs
        state={dialog}
        held={held}
        roleOptions={roleOptions.data ?? []}
        onClose={() => {
          setDialog({ kind: 'none' });
        }}
      />
    </Page>
  );
}
