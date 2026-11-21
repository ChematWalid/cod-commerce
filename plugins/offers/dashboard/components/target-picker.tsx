import type { OfferTargetRole } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Button, Input, Label } from '@vendure/dashboard';
import { type ReactNode, useId, useState } from 'react';
import { useTargetProduct, useTargetProducts } from '../editor-queries';
import type { TargetProductDto } from '../dto';
import type { TargetDraft } from '../model/editor-form';
import { formatWhole } from '../model/list-view';
import { targetsOfRole, withoutTarget, withTarget } from '../model/target-list';
import type { StoreScope } from '../queries';
import { LtrRun } from './ltr-run';

export interface TargetPickerProps {
  readonly scope: StoreScope | null;
  /** The role the picked targets get: what is bought, gifted or offered as an add-on (D2501). */
  readonly role: OfferTargetRole;
  readonly legendId: string;
  /** Every target of the offer; only those of `role` are shown and changed. */
  readonly targets: readonly TargetDraft[];
  readonly onTargets: (next: readonly TargetDraft[]) => void;
  readonly disabled: boolean;
  /** The most targets of `role` (five add-on products, D2505). */
  readonly max?: number;
  readonly errorId?: string | undefined;
}

type VariantNames = ReadonlyMap<string, string>;

/** A chosen product: its name once loaded, "missing" when the store no longer has it (D2523). */
function ProductName({ scope, refId }: { readonly scope: StoreScope | null; readonly refId: string }): ReactNode {
  const { i18n } = useLingui();
  const product = useTargetProduct(scope, refId);
  if (product.data === undefined) return <span className="text-muted-foreground">{i18n._('offers.loading')}</span>;
  if (product.data === null) return <span className="text-destructive">{i18n._('offers.target-missing')}</span>;
  return <span>{product.data.title}</span>;
}

function TargetName(props: {
  readonly scope: StoreScope | null;
  readonly target: TargetDraft;
  readonly names: VariantNames;
}) {
  const { i18n } = useLingui();
  const { target } = props;
  if (target.refType === 'product') return <ProductName scope={props.scope} refId={target.refId} />;
  const name = props.names.get(target.refId);
  return <span>{name ?? i18n._('offers.target-variant', { id: target.refId })}</span>;
}

function ChosenTargets(props: TargetPickerProps & { readonly names: VariantNames }): ReactNode {
  const { i18n } = useLingui();
  const chosen = targetsOfRole(props.targets, props.role);
  if (chosen.length === 0) return <p className="text-muted-foreground text-sm">{i18n._('offers.targets-none')}</p>;
  return (
    <ul className="grid gap-1">
      {chosen.map((target) => (
        <li key={`${target.refType}-${target.refId}`} className="flex items-center justify-between gap-2 text-sm">
          <TargetName scope={props.scope} target={target} names={props.names} />
          <Button
            variant="ghost"
            size="sm"
            disabled={props.disabled}
            onClick={() => {
              props.onTargets(withoutTarget(props.targets, target));
            }}
          >
            {i18n._('offers.target-remove')}
          </Button>
        </li>
      ))}
    </ul>
  );
}

interface PickHandlers {
  readonly onPick: (target: TargetDraft, name?: string) => void;
  readonly disabled: boolean;
}

/** The variants of one product of the search, each with its own Add. */
function VariantChoices(props: PickHandlers & { readonly scope: StoreScope | null; readonly productId: string }) {
  const { i18n } = useLingui();
  const product = useTargetProduct(props.scope, props.productId);
  if (product.data === undefined) return <p className="text-muted-foreground text-xs">{i18n._('offers.loading')}</p>;
  return (
    <ul className="grid gap-1 ps-4">
      {(product.data?.variants ?? []).map((variant) => (
        <li key={variant.id} className="flex items-center justify-between gap-2 text-sm">
          <span>
            {variant.name} · <LtrRun>{formatWhole(variant.price, i18n.locale)}</LtrRun>
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={props.disabled}
            onClick={() => {
              props.onPick({ role: 'buy', refType: 'variant', refId: variant.id }, variant.name);
            }}
          >
            {i18n._('offers.target-add')}
          </Button>
        </li>
      ))}
    </ul>
  );
}

interface ProductResultProps extends PickHandlers {
  readonly scope: StoreScope | null;
  readonly product: TargetProductDto;
}

/** One product of the search: Add takes the whole product, Variants opens its variants under it. */
function ProductResult(props: ProductResultProps): ReactNode {
  const { i18n } = useLingui();
  const [opened, setOpened] = useState(false);
  const { product } = props;
  return (
    <li className="grid gap-1">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span>
          {product.title} · <LtrRun>{formatWhole(product.price, i18n.locale)}</LtrRun>
        </span>
        <span className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOpened(!opened);
            }}
          >
            {i18n._('offers.target-variants')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={props.disabled}
            onClick={() => {
              props.onPick({ role: 'buy', refType: 'product', refId: product.id });
            }}
          >
            {i18n._('offers.target-add')}
          </Button>
        </span>
      </div>
      {opened && <VariantChoices {...props} productId={product.id} />}
    </li>
  );
}

/** The products whose name matches the typed text. */
function SearchResults(props: PickHandlers & { readonly scope: StoreScope | null; readonly q: string }): ReactNode {
  const { i18n } = useLingui();
  const products = useTargetProducts(props.scope, props.q);
  if (props.q.trim() === '') return null;
  if (products.data === undefined) return <p className="text-muted-foreground text-xs">{i18n._('offers.loading')}</p>;
  if (products.data.length === 0)
    return <p className="text-muted-foreground text-xs">{i18n._('offers.targets-no-match')}</p>;
  return (
    <ul className="grid gap-2">
      {products.data.map((product) => (
        <ProductResult key={product.id} {...props} product={product} />
      ))}
    </ul>
  );
}

/**
 * Picks the products and variants an offer applies to, by name, through the catalog's Admin API (D2523). Collections
 * wait for the collections session and are shown disabled.
 */
export function TargetPicker(props: TargetPickerProps): ReactNode {
  const { i18n } = useLingui();
  const searchId = useId();
  const [q, setQ] = useState('');
  const [names, setNames] = useState<VariantNames>(new Map());
  const onPick = (target: TargetDraft, name?: string): void => {
    if (name !== undefined) setNames((current) => new Map(current).set(target.refId, name));
    props.onTargets(withTarget(props.targets, { ...target, role: props.role }, props.max));
  };
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1 text-sm font-medium">{i18n._(props.legendId)}</legend>
      <ChosenTargets {...props} names={names} />
      <div className="grid gap-1.5">
        <Label htmlFor={searchId}>{i18n._('offers.target-search')}</Label>
        <Input
          id={searchId}
          value={q}
          disabled={props.disabled}
          onChange={(event) => {
            setQ(event.target.value);
          }}
        />
      </div>
      <SearchResults scope={props.scope} q={q} onPick={onPick} disabled={props.disabled} />
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled>
          {i18n._('offers.target-collections')}
        </Button>
        <span className="text-muted-foreground text-xs">{i18n._('offers.target-collections-soon')}</span>
      </div>
      {props.errorId !== undefined && (
        <p role="alert" className="text-destructive text-sm">
          {i18n._(props.errorId)}
        </p>
      )}
    </fieldset>
  );
}
