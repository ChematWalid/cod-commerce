import { useLingui } from '@lingui/react';
import { Button } from '@vendure/dashboard';
import { type DragEvent, type KeyboardEvent, type ReactNode, useState } from 'react';
import { MANUAL_PRODUCT_ROW_TEST_ID } from '../constants';
import { formatDzd } from '../model/list-view';
import { type ManualProduct, moveBy, moveTo, reorderKeyDelta, withoutProduct } from '../model/manual-order';
import { LtrRun } from './ltr-run';

/** The drag data format: plain text, the one every browser accepts (Firefox starts no drag without data). */
const DRAG_FORMAT = 'text/plain';

interface ProductRowsProps {
  readonly products: readonly ManualProduct[];
  /** False for an automatic collection or a read-only editor: no handle, no remove. */
  readonly editable: boolean;
  readonly onReorder: (products: readonly ManualProduct[]) => void;
}

interface RowProps extends ProductRowsProps {
  readonly index: number;
  readonly product: ManualProduct;
  readonly dragging: boolean;
  readonly onDragState: (index: number | null) => void;
}

/** The handle: dragged with a pointer, or moved one place by the arrow keys while focused. */
function DragHandle({ index, products, onReorder }: RowProps): ReactNode {
  const { i18n } = useLingui();
  const onKeyDown = (event: KeyboardEvent): void => {
    const delta = reorderKeyDelta(event.key);
    if (delta === undefined) return;
    event.preventDefault();
    onReorder(moveBy(products, index, delta));
  };
  return (
    <button
      type="button"
      className="text-muted-foreground cursor-grab px-1"
      aria-label={i18n._('collections.reorder-handle')}
      onKeyDown={onKeyDown}
    >
      ⋮⋮
    </button>
  );
}

/** The drag-and-drop handlers of an editable row; none for a read-only one. */
function dragPropsOf(props: RowProps) {
  if (!props.editable) return {};
  return {
    draggable: true,
    onDragStart: (event: DragEvent) => {
      event.dataTransfer.setData(DRAG_FORMAT, String(props.index));
      event.dataTransfer.effectAllowed = 'move';
      props.onDragState(props.index);
    },
    onDragEnd: () => {
      props.onDragState(null);
    },
    onDragOver: (event: DragEvent) => {
      event.preventDefault();
    },
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      props.onReorder(moveTo(props.products, Number(event.dataTransfer.getData(DRAG_FORMAT)), props.index));
    },
  };
}

function ProductRow(props: RowProps): ReactNode {
  const { i18n } = useLingui();
  const { product, editable } = props;
  const dragProps = dragPropsOf(props);
  return (
    <li
      data-testid={MANUAL_PRODUCT_ROW_TEST_ID}
      data-product-id={product.productId}
      className={`flex items-center gap-3 rounded-md border px-3 py-2 ${props.dragging ? 'cod-collections-dragging' : ''}`}
      {...dragProps}
    >
      {editable && <DragHandle {...props} />}
      <span className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere]">
        <bdi>{product.title}</bdi>
      </span>
      <LtrRun>{formatDzd(product.price, i18n.locale)}</LtrRun>
      {editable && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            props.onReorder(withoutProduct(props.products, product.productId));
          }}
        >
          {i18n._('collections.remove-product')}
        </Button>
      )}
    </li>
  );
}

/** A collection's products in their order; product titles are merchant text, shown as typed (never translated). */
export function ProductRows(props: ProductRowsProps): ReactNode {
  const { i18n } = useLingui();
  const [dragged, setDragged] = useState<number | null>(null);
  if (props.products.length === 0)
    return <p className="text-muted-foreground text-sm">{i18n._('collections.no-products')}</p>;
  return (
    <ol className="grid gap-2">
      {props.products.map((product, index) => (
        <ProductRow
          key={product.productId}
          {...props}
          product={product}
          index={index}
          dragging={dragged === index}
          onDragState={setDragged}
        />
      ))}
    </ol>
  );
}
