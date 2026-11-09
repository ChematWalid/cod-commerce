import { ACTIVITY_ACTIONS } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  type DashboardRouteDefinition,
  FullWidthPageBlock,
  Page,
  PageLayout,
  PageTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useLocalFormat,
} from '@vendure/dashboard';
import { type ReactNode, useMemo } from 'react';
import { withoutArchivedStores } from '../archived-store-ids';
import { LtrRun } from '../components/ltr-run';
import {
  ACTIVITY_LOG_NAV_TITLE,
  ACTIVITY_LOG_PATH,
  ACTIVITY_LOG_QUERY_KEY,
  ACTIVITY_LOG_VIEW_VENDURE_PERMISSION,
  ARCHIVED_STORE_STATUS,
  LOADING_MESSAGE_ID,
  STORES_QUERY_KEY,
  TEAM_NAV_SECTION_ID,
  VIEW_STORES_KEY,
} from '../constants';
import { errorMessageId } from '../error-messages';
import { type ActivityLogItemDto, fetchActivityLog, fetchStoreStatuses, useEffectivePermissions } from '../queries';

const PAGE_ID = 'rbac-activity-log';
const BLOCK_ID = 'rbac-activity-log-list';
const HEADER_IDS = ['rbac.column-time', 'rbac.column-actor', 'rbac.column-action', 'rbac.column-target'];
const JSON_INDENT = 2;
const JSON_STYLE = { direction: 'ltr', textAlign: 'left' } as const;
const KNOWN_ACTIONS: ReadonlySet<string> = new Set(Object.values(ACTIVITY_ACTIONS));
const ENTITY_MESSAGE_IDS: Readonly<Record<string, string>> = {
  role: 'rbac.target-role',
  member: 'rbac.target-member',
};

/** The role's name a diff records: a plain text on create and delete, `{ before, after }` on update. */
function targetNameOf(diff: unknown): string | null {
  if (typeof diff !== 'object' || diff === null || !('name' in diff)) return null;
  const { name } = diff;
  if (typeof name === 'string') return name;
  if (typeof name !== 'object' || name === null || !('after' in name)) return null;
  return typeof name.after === 'string' ? name.after : null;
}

function ActionCell({ action }: { readonly action: string }): ReactNode {
  const { i18n } = useLingui();
  return KNOWN_ACTIONS.has(action) ? i18n._(action) : <LtrRun>{action}</LtrRun>;
}

function TargetCell({ item }: { readonly item: ActivityLogItemDto }): ReactNode {
  const { i18n } = useLingui();
  const typeMessageId = ENTITY_MESSAGE_IDS[item.entityType];
  return (
    <span className="flex flex-wrap items-center gap-1">
      {typeMessageId === undefined ? <LtrRun>{item.entityType}</LtrRun> : i18n._(typeMessageId)}
      <bdi>{targetNameOf(item.diff) ?? <LtrRun>{item.entityId}</LtrRun>}</bdi>
    </span>
  );
}

interface ActivityRowProps {
  readonly item: ActivityLogItemDto;
  readonly archived: ReadonlySet<string>;
}

function ActivityRow({ item, archived }: ActivityRowProps): ReactNode {
  const { i18n } = useLingui();
  const { formatDate } = useLocalFormat();
  return (
    <TableRow>
      <TableCell className="whitespace-normal">
        {formatDate(item.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
      </TableCell>
      <TableCell>{item.actor?.name ?? i18n._('rbac.actor-system')}</TableCell>
      <TableCell>
        <ActionCell action={item.action} />
      </TableCell>
      <TableCell className="min-w-32 whitespace-normal">
        <TargetCell item={item} />
        <Collapsible>
          <CollapsibleTrigger className="text-muted-foreground text-xs underline">
            {i18n._('rbac.show-details')}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre dir="ltr" style={JSON_STYLE} className="max-w-full overflow-x-auto text-xs">
              {JSON.stringify(withoutArchivedStores(item.diff, archived), null, JSON_INDENT)}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      </TableCell>
    </TableRow>
  );
}

/** Only a member who can read stores gets their statuses; the ids are opaque to anyone else. */
function useArchivedStoreIds(): { readonly archived: ReadonlySet<string>; readonly error: unknown } {
  const held = useEffectivePermissions();
  const { data, error } = useQuery({
    queryKey: STORES_QUERY_KEY,
    queryFn: fetchStoreStatuses,
    enabled: held.has(VIEW_STORES_KEY),
    retry: false,
  });
  const archived = useMemo(
    () => new Set((data ?? []).filter((store) => store.status === ARCHIVED_STORE_STATUS).map((store) => store.id)),
    [data],
  );
  return { archived, error };
}

interface ActivityTableProps {
  readonly items: readonly ActivityLogItemDto[];
  readonly archived: ReadonlySet<string>;
}

function ActivityTable({ items, archived }: ActivityTableProps): ReactNode {
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
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <ActivityRow key={item.id} item={item} archived={archived} />
        ))}
      </TableBody>
    </Table>
  );
}

function ActivityLogPage(): ReactNode {
  const { i18n } = useLingui();
  const { archived, error: storesError } = useArchivedStoreIds();
  const log = useInfiniteQuery({
    queryKey: ACTIVITY_LOG_QUERY_KEY,
    queryFn: ({ pageParam }) => fetchActivityLog(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    retry: false,
  });
  const failure: unknown = log.error ?? storesError;
  const items = log.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <Page pageId={PAGE_ID}>
      <PageTitle>{i18n._(ACTIVITY_LOG_NAV_TITLE)}</PageTitle>
      <PageLayout>
        <FullWidthPageBlock blockId={BLOCK_ID}>
          {failure !== null && <p role="alert">{i18n._(errorMessageId(failure))}</p>}
          {log.isPending && <p>{i18n._(LOADING_MESSAGE_ID)}</p>}
          {log.isSuccess && items.length === 0 && <p>{i18n._('rbac.activity-empty')}</p>}
          <ActivityTable items={items} archived={archived} />
          {log.hasNextPage && (
            <Button
              variant="outline"
              className="mt-4"
              disabled={log.isFetchingNextPage}
              onClick={() => void log.fetchNextPage()}
            >
              {i18n._('rbac.load-more')}
            </Button>
          )}
        </FullWidthPageBlock>
      </PageLayout>
    </Page>
  );
}

/** What was changed in the business, newest first (D67). */
export const activityLogRoute: DashboardRouteDefinition = {
  path: ACTIVITY_LOG_PATH,
  component: () => <ActivityLogPage />,
  navMenuItem: {
    sectionId: TEAM_NAV_SECTION_ID,
    id: 'rbac-activity-log',
    title: ACTIVITY_LOG_NAV_TITLE,
    url: ACTIVITY_LOG_PATH,
    requiresPermission: ACTIVITY_LOG_VIEW_VENDURE_PERMISSION,
  },
};
