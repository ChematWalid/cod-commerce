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
} from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { COLLECTION_ROW_TEST_ID } from '../constants';
import type { StoreCollectionDto } from '../dto';
import { type CollectionRowAction, MODE_LABEL_IDS, ROW_ACTION_LABEL_IDS, rowActionsOf } from '../model/list-view';
import { LtrRun } from './ltr-run';

/** Hidden on a phone, so the collection, its visibility and the actions fit without a sideways scroll. */
const WIDE_ONLY = 'hidden md:table-cell';
/** The stock header cell aligns to a physical side; `text-start` keeps each header over its column in a right-to-left page. */
const HEAD = 'text-start';

interface CollectionTableProps {
  readonly collections: readonly StoreCollectionDto[];
  readonly held: ReadonlySet<string>;
  readonly onCommand: (action: CollectionRowAction, collection: StoreCollectionDto) => void;
}

/** The image and the title; the title is merchant text, shown as typed. */
function TitleCell({ collection }: { readonly collection: StoreCollectionDto }): ReactNode {
  return (
    <span className="flex items-center gap-3">
      {collection.featuredAsset === null ? (
        <span aria-hidden className="cod-collections-thumb bg-muted" />
      ) : (
        <img src={collection.featuredAsset.preview} alt="" className="cod-collections-thumb object-cover" />
      )}
      <bdi className="font-medium [overflow-wrap:anywhere]">{collection.title}</bdi>
    </span>
  );
}

/** The row's menu: Edit, and Delete for holders of the sensitive key (D2325). */
function RowActions({
  collection,
  held,
  onCommand,
}: Omit<CollectionTableProps, 'collections'> & {
  readonly collection: StoreCollectionDto;
}): ReactNode {
  const { i18n } = useLingui();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button size="icon" variant="ghost" aria-label={i18n._('collections.row-actions')} />}
      >
        ⋮
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {rowActionsOf(held).map((action) => (
          <DropdownMenuItem
            key={action}
            variant={action === 'delete' ? 'destructive' : 'default'}
            onClick={() => {
              onCommand(action, collection);
            }}
          >
            {i18n._(ROW_ACTION_LABEL_IDS[action])}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CollectionRow(props: Omit<CollectionTableProps, 'collections'> & { readonly collection: StoreCollectionDto }) {
  const { i18n } = useLingui();
  const { collection } = props;
  return (
    <TableRow data-testid={COLLECTION_ROW_TEST_ID} data-collection-id={collection.id}>
      <TableCell>
        <TitleCell collection={collection} />
      </TableCell>
      <TableCell className={WIDE_ONLY}>{i18n._(MODE_LABEL_IDS[collection.mode])}</TableCell>
      <TableCell className={WIDE_ONLY}>
        <LtrRun>{String(collection.productCount)}</LtrRun>
      </TableCell>
      <TableCell>
        <Badge variant={collection.visible ? 'primary' : 'outline'}>
          {i18n._(collection.visible ? 'collections.visible-yes' : 'collections.visible-no')}
        </Badge>
      </TableCell>
      <TableCell className={WIDE_ONLY}>
        <LtrRun>{String(collection.position)}</LtrRun>
      </TableCell>
      <TableCell className="text-end">
        <RowActions {...props} />
      </TableCell>
    </TableRow>
  );
}

/** The list's columns (D2325): image and title, type, product count, visibility, position, actions. */
export function CollectionTable(props: CollectionTableProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={HEAD}>{i18n._('collections.column-title')}</TableHead>
          <TableHead className={`${WIDE_ONLY} ${HEAD}`}>{i18n._('collections.column-type')}</TableHead>
          <TableHead className={`${WIDE_ONLY} ${HEAD}`}>{i18n._('collections.column-products')}</TableHead>
          <TableHead className={HEAD}>{i18n._('collections.column-visibility')}</TableHead>
          <TableHead className={`${WIDE_ONLY} ${HEAD}`}>{i18n._('collections.column-position')}</TableHead>
          <TableHead>
            <span className="sr-only">{i18n._('collections.row-actions')}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {props.collections.map((collection) => (
          <CollectionRow key={collection.id} collection={collection} held={props.held} onCommand={props.onCommand} />
        ))}
      </TableBody>
    </Table>
  );
}
