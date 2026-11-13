import { MEMBER_SEARCH_MAX_LENGTH, type MemberTab } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Button, Input, Tabs, TabsList, TabsTrigger } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import type { TeamMemberCountsDto } from '../dto';
import { pageCountOf } from '../member-paging';
import { tabsOf } from '../member-view-model';
import { LtrRun } from './ltr-run';

const NO_COUNTS: TeamMemberCountsDto = { all: 0, active: 0, pending: 0, inactive: 0 };

interface MembersToolbarProps {
  readonly tab: MemberTab;
  readonly counts: TeamMemberCountsDto | undefined;
  readonly search: string;
  readonly onTab: (tab: MemberTab) => void;
  readonly onSearch: (search: string) => void;
}

/** The status tabs with their counts, and the search by name or email. */
export function MembersToolbar({ tab, counts, search, onTab, onSearch }: MembersToolbarProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Tabs
        value={tab}
        onValueChange={(next) => {
          onTab(next as MemberTab);
        }}
      >
        <TabsList className="cod-team-tabs">
          {tabsOf(counts ?? NO_COUNTS).map((view) => (
            <TabsTrigger key={view.tab} value={view.tab}>
              {i18n._(view.labelId)} <LtrRun>{`(${String(view.count)})`}</LtrRun>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Input
        type="search"
        className="w-full sm:w-64"
        aria-label={i18n._('team.search')}
        placeholder={i18n._('team.search')}
        maxLength={MEMBER_SEARCH_MAX_LENGTH}
        value={search}
        onChange={(event) => {
          onSearch(event.target.value);
        }}
      />
    </div>
  );
}

interface PagerProps {
  readonly page: number;
  readonly total: number;
  readonly onPage: (page: number) => void;
}

/** Previous and next, shown only when the tab holds more than one page. */
export function MembersPager({ page, total, onPage }: PagerProps): ReactNode {
  const { i18n } = useLingui();
  const pages = pageCountOf(total);
  if (pages === 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 text-sm">
      <Button
        size="sm"
        variant="outline"
        disabled={page <= 1}
        onClick={() => {
          onPage(page - 1);
        }}
      >
        {i18n._('team.page-previous')}
      </Button>
      <LtrRun>{`${String(page)} / ${String(pages)}`}</LtrRun>
      <Button
        size="sm"
        variant="outline"
        disabled={page >= pages}
        onClick={() => {
          onPage(page + 1);
        }}
      >
        {i18n._('team.page-next')}
      </Button>
    </div>
  );
}
