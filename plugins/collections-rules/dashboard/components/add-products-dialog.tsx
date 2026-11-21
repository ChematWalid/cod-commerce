import { COLLECTION_PRODUCT_SEARCH_MAX } from '@cod/shared';
import { TextField } from '@cod/plugin-merchant-shell/shell-api';
import { useLingui } from '@lingui/react';
import { Button, Checkbox, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@vendure/dashboard';
import { type ReactNode, useState } from 'react';
import { PRODUCT_SEARCH_DELAY_MS } from '../constants';
import { useSettled } from '../hooks/use-settled';
import { errorMessageIdOf } from '../model/list-view';
import type { ManualProduct } from '../model/manual-order';
import type { StoreScope } from '../model/store-query';
import { useProductSearch } from '../queries';

interface AddProductsDialogProps {
  readonly scope: StoreScope | null;
  /** The products already in the collection: shown checked and not offered again. */
  readonly present: readonly ManualProduct[];
  readonly onConfirm: (added: readonly ManualProduct[]) => void;
  readonly onClose: () => void;
}

const toggled = (picked: readonly ManualProduct[], product: ManualProduct): readonly ManualProduct[] =>
  picked.some(({ productId }) => productId === product.productId)
    ? picked.filter(({ productId }) => productId !== product.productId)
    : [...picked, product];

interface ResultsProps {
  readonly scope: StoreScope | null;
  readonly search: string;
  readonly present: ReadonlySet<string>;
  readonly picked: readonly ManualProduct[];
  readonly onToggle: (product: ManualProduct) => void;
}

/** The store's products whose title holds the search; merchant text, shown as typed. */
function SearchResults({ scope, search, present, picked, onToggle }: ResultsProps): ReactNode {
  const { i18n } = useLingui();
  const results = useProductSearch(scope, useSettled(search, PRODUCT_SEARCH_DELAY_MS));
  if (results.isError) return <p role="alert">{i18n._(errorMessageIdOf(results.error))}</p>;
  if (!results.isSuccess) return <p>{i18n._('collections.loading')}</p>;
  if (results.data.items.length === 0) return <p className="text-sm">{i18n._('collections.search-no-match')}</p>;
  const pickedIds = new Set(picked.map(({ productId }) => productId));
  return (
    <ul className="grid max-h-80 gap-1 overflow-y-auto">
      {results.data.items.map((product) => (
        <li key={product.productId}>
          <label className="flex items-center gap-3 rounded-md px-2 py-1.5">
            <Checkbox
              checked={present.has(product.productId) || pickedIds.has(product.productId)}
              disabled={present.has(product.productId)}
              onCheckedChange={() => {
                onToggle(product);
              }}
            />
            <bdi className="[overflow-wrap:anywhere]">{product.title}</bdi>
          </label>
        </li>
      ))}
    </ul>
  );
}

interface FooterProps {
  readonly picked: number;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}

function AddProductsFooter({ picked, onClose, onConfirm }: FooterProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <DialogFooter>
      <Button type="button" variant="outline" onClick={onClose}>
        {i18n._('collections.cancel')}
      </Button>
      <Button type="button" disabled={picked === 0} onClick={onConfirm}>
        {i18n._('collections.add-picked', { count: picked })}
      </Button>
    </DialogFooter>
  );
}

interface SearchHeaderProps {
  readonly search: string;
  readonly onSearch: (search: string) => void;
}

function SearchHeader({ search, onSearch }: SearchHeaderProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <>
      <DialogHeader>
        <DialogTitle>{i18n._('collections.add-products')}</DialogTitle>
      </DialogHeader>
      <TextField
        label={i18n._('collections.search-products')}
        value={search}
        maxLength={COLLECTION_PRODUCT_SEARCH_MAX}
        onChange={(event) => {
          onSearch(event.target.value);
        }}
      />
    </>
  );
}

/** Finds products of the store by title and adds the picked ones at the end of the list (D2321); mounted while open. */
export function AddProductsDialog(props: AddProductsDialogProps): ReactNode {
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<readonly ManualProduct[]>([]);
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) props.onClose();
      }}
    >
      <DialogContent>
        <SearchHeader search={search} onSearch={setSearch} />
        <SearchResults
          scope={props.scope}
          search={search}
          present={new Set(props.present.map(({ productId }) => productId))}
          picked={picked}
          onToggle={(product) => {
            setPicked((current) => toggled(current, product));
          }}
        />
        <AddProductsFooter
          picked={picked.length}
          onClose={props.onClose}
          onConfirm={() => {
            props.onConfirm(picked);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
