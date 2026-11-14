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
import type { ProductStatus } from '@cod/shared';
import type { ReactNode } from 'react';
import { EMPTY_VALUE, PRODUCT_ROW_TEST_ID } from '../constants';
import type { CatalogProductRowDto } from '../dto';
import { formatDzd, STATUS_LABEL_IDS } from '../model/list-view';
import { LtrRun } from './ltr-run';
import { RowActions, type RowCommand } from './row-actions';

/** Hidden on a phone, so the product, its status and the actions fit without a sideways scroll. */
const WIDE_ONLY = 'hidden md:table-cell';

const BADGE_OF_STATUS: Readonly<Record<ProductStatus, 'primary' | 'default' | 'outline'>> = {
  active: 'primary',
  hidden: 'default',
  draft: 'outline',
};

interface ProductTableProps {
  readonly products: readonly CatalogProductRowDto[];
  readonly previews: ReadonlyMap<string, string>;
  readonly held: ReadonlySet<string>;
  readonly onCommand: (command: RowCommand, product: CatalogProductRowDto) => void;
}

function ProductCell({
  product,
  previews,
}: { readonly product: CatalogProductRowDto } & Pick<ProductTableProps, 'previews'>) {
  const preview = product.featuredAsset === null ? undefined : previews.get(product.featuredAsset.id);
  return (
    <span className="flex items-center gap-3">
      {preview === undefined ? (
        <span aria-hidden className="cod-catalog-thumb bg-muted" />
      ) : (
        <img src={preview} alt="" className="cod-catalog-thumb object-cover" />
      )}
      <span className="font-medium [overflow-wrap:anywhere]">{product.title}</span>
    </span>
  );
}

function PriceCell({ price }: { readonly price: number }): ReactNode {
  const { i18n } = useLingui();
  const language = i18n.locale.split(/[-_]/)[0] ?? i18n.locale;
  return <LtrRun>{`${formatDzd(price, language)} ${i18n._('catalog.currency')}`}</LtrRun>;
}

function HeaderRow(): ReactNode {
  const { i18n } = useLingui();
  return (
    <TableRow>
      <TableHead className="text-start">{i18n._('catalog.column-product')}</TableHead>
      <TableHead className="text-start">{i18n._('catalog.column-status')}</TableHead>
      <TableHead className={`${WIDE_ONLY} text-start`}>{i18n._('catalog.column-price')}</TableHead>
      <TableHead className={`${WIDE_ONLY} text-start`}>{i18n._('catalog.column-collections')}</TableHead>
      <TableHead className={`${WIDE_ONLY} text-start`}>{i18n._('catalog.column-created')}</TableHead>
      <TableHead className="text-end">
        <span className="sr-only">{i18n._('catalog.row-actions')}</span>
      </TableHead>
    </TableRow>
  );
}

function ProductRow({
  product,
  ...props
}: Omit<ProductTableProps, 'products'> & { readonly product: CatalogProductRowDto }) {
  const { i18n } = useLingui();
  const { formatDate } = useLocalFormat();
  const collections = product.collectionIds.length;
  return (
    <TableRow data-testid={PRODUCT_ROW_TEST_ID} data-product-id={product.id}>
      <TableCell className="whitespace-normal">
        <ProductCell product={product} previews={props.previews} />
      </TableCell>
      <TableCell>
        <Badge variant={BADGE_OF_STATUS[product.status]}>{i18n._(STATUS_LABEL_IDS[product.status])}</Badge>
      </TableCell>
      <TableCell className={WIDE_ONLY}>
        <PriceCell price={product.price} />
      </TableCell>
      <TableCell className={WIDE_ONLY}>{collections === 0 ? EMPTY_VALUE : <LtrRun>{collections}</LtrRun>}</TableCell>
      <TableCell className={WIDE_ONLY}>{formatDate(product.createdAt, { dateStyle: 'medium' })}</TableCell>
      <TableCell className="text-end">
        <RowActions product={product} held={props.held} onCommand={props.onCommand} />
      </TableCell>
    </TableRow>
  );
}

/** The products of the page: thumbnail and title, status, price, collections, creation date and the row's actions. */
export function ProductTable({ products, ...props }: ProductTableProps): ReactNode {
  return (
    <Table>
      <TableHeader>
        <HeaderRow />
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <ProductRow key={product.id} product={product} {...props} />
        ))}
      </TableBody>
    </Table>
  );
}
