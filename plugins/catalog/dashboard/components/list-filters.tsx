import { PRODUCT_SEARCH_MAX } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@vendure/dashboard';
import { type ReactNode, useId } from 'react';
import { PRODUCT_SEARCH_TEST_ID } from '../constants';
import type { CatalogNamedDto } from '../dto';
import type { ProductListFilterChange, ProductListState } from '../model/list-search';

/** The select value that stands for "no filter": an option needs a non-empty value. */
const ANY_VALUE = 'any';

interface FilterSelectProps {
  readonly labelId: string;
  readonly value: string | null;
  readonly options: readonly CatalogNamedDto[];
  readonly onChange: (value: string | null) => void;
}

/** One filter: every option of the store, or "any". */
function FilterSelect({ labelId, value, options, onChange }: FilterSelectProps): ReactNode {
  const { i18n } = useLingui();
  const id = useId();
  const label = i18n._(labelId);
  const chosen = options.find((option) => option.id === value);
  return (
    <Select
      value={value ?? ANY_VALUE}
      onValueChange={(next) => {
        onChange(next === null || next === ANY_VALUE ? null : next);
      }}
    >
      <SelectTrigger id={id} className="w-full sm:w-44" aria-label={label}>
        <SelectValue>{chosen?.name ?? label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY_VALUE}>{label}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface ListFiltersProps {
  readonly state: ProductListState;
  readonly collections: readonly CatalogNamedDto[];
  readonly brands: readonly CatalogNamedDto[];
  readonly tags: readonly CatalogNamedDto[];
  readonly onChange: (change: ProductListFilterChange) => void;
}

type FilterField = 'collectionId' | 'brandId' | 'tagId';

/** The three filters in display order. */
const FILTERS: readonly { readonly field: FilterField; readonly labelId: string }[] = [
  { field: 'collectionId', labelId: 'catalog.filter-collection' },
  { field: 'brandId', labelId: 'catalog.filter-brand' },
  { field: 'tagId', labelId: 'catalog.filter-tag' },
];

/** Search by name, SKU or barcode (variants' too), and the collection, brand and tag filters, combined with AND (AC4). */
export function ListFilters({ state, collections, brands, tags, onChange }: ListFiltersProps): ReactNode {
  const { i18n } = useLingui();
  const options: Readonly<Record<FilterField, readonly CatalogNamedDto[]>> = {
    collectionId: collections,
    brandId: brands,
    tagId: tags,
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="search"
        data-testid={PRODUCT_SEARCH_TEST_ID}
        className="w-full sm:w-64"
        aria-label={i18n._('catalog.search')}
        placeholder={i18n._('catalog.search')}
        maxLength={PRODUCT_SEARCH_MAX}
        value={state.search}
        onChange={(event) => {
          onChange({ search: event.target.value });
        }}
      />
      {FILTERS.map(({ field, labelId }) => (
        <FilterSelect
          key={field}
          labelId={labelId}
          value={state[field]}
          options={options[field]}
          onChange={(value) => {
            onChange({ [field]: value });
          }}
        />
      ))}
    </div>
  );
}
