import { PRODUCT_STATUSES, type ProductStatus } from '@cod/shared';
import { useLingui } from '@lingui/react';
import {
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@vendure/dashboard';
import { type ReactNode, useId } from 'react';
import { STATUS_LABEL_IDS } from '../model/list-view';
import { useCatalogBrands, useCatalogTags } from '../queries';
import { CheckList } from './check-list';
import type { ScopedSectionProps } from './section-props';

/** The select value for "no brand": an option needs a non-empty value. */
const NO_BRAND = 'none';

const isStatus = (value: unknown): value is ProductStatus =>
  typeof value === 'string' && (PRODUCT_STATUSES as readonly string[]).includes(value);

/** Active is listed, Hidden only reachable by its landing page, Draft never public (D2109). */
function StatusField({ form, disabled, onChange }: ScopedSectionProps): ReactNode {
  const { i18n } = useLingui();
  const baseId = useId();
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">{i18n._('catalog.column-status')}</legend>
      <RadioGroup
        value={form.status}
        disabled={disabled}
        onValueChange={(value) => {
          if (isStatus(value)) onChange({ status: value });
        }}
      >
        {PRODUCT_STATUSES.map((status) => (
          <div key={status} className="flex items-center gap-2">
            <RadioGroupItem id={`${baseId}-${status}`} value={status} />
            <Label htmlFor={`${baseId}-${status}`} className="font-normal">
              {i18n._(STATUS_LABEL_IDS[status])}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </fieldset>
  );
}

function BrandField({ form, disabled, onChange, scope }: ScopedSectionProps): ReactNode {
  const { i18n } = useLingui();
  const id = useId();
  const brands = useCatalogBrands(scope).data ?? [];
  const chosen = brands.find((brand) => brand.id === form.brandId);
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{i18n._('catalog.editor-brand')}</Label>
      <Select
        value={form.brandId ?? NO_BRAND}
        disabled={disabled}
        onValueChange={(value) => {
          onChange({ brandId: value === null || value === NO_BRAND ? null : value });
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue>{chosen?.name ?? i18n._('catalog.editor-no-brand')}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_BRAND}>{i18n._('catalog.editor-no-brand')}</SelectItem>
          {brands.map((brand) => (
            <SelectItem key={brand.id} value={brand.id}>
              {brand.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function TagsField({ form, disabled, onChange, scope }: ScopedSectionProps): ReactNode {
  const { i18n } = useLingui();
  const tags = useCatalogTags(scope).data ?? [];
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">{i18n._('catalog.editor-tags')}</legend>
      {tags.length === 0 ? (
        <p className="text-muted-foreground text-xs">{i18n._('catalog.editor-no-tags')}</p>
      ) : (
        <CheckList
          items={tags.map((tag) => ({ id: tag.id, label: tag.name }))}
          selected={form.tagIds}
          disabled={disabled}
          onChange={(tagIds) => {
            onChange({ tagIds });
          }}
        />
      )}
    </fieldset>
  );
}

/** Status, brand, collections and tags of the product in its store. Collections arrive with P2.S3. */
export function OrganisationSection(props: ScopedSectionProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="grid gap-5">
      <StatusField {...props} />
      <BrandField {...props} />
      <div className="grid gap-1">
        <p className="text-sm font-medium">{i18n._('catalog.editor-collections')}</p>
        <p className="text-muted-foreground text-xs">{i18n._('catalog.editor-collections-later')}</p>
      </div>
      <TagsField {...props} />
    </div>
  );
}
