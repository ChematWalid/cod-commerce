import {
  type StoreScope,
  useActiveStore,
  useHeldPermissions,
  useStoreScope,
} from '@cod/plugin-merchant-shell/shell-api';
import { PRODUCT_TYPES } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { useParams } from '@tanstack/react-router';
import { Button } from '@vendure/dashboard';
import { type ReactNode, useMemo, useState } from 'react';
import { EDIT_PRODUCTS_KEY, PACK_BLOCK_TEST_ID, PACK_SAVE_FIRST_TEST_ID, PACK_SAVE_TEST_ID } from '../constants';
import { usePackSave } from '../hooks/use-pack-save';
import type { PickableProduct } from '../model/pack-components';
import { emptyPackForm, type PackForm, type PackFormErrors, packFormOf } from '../model/pack-form';
import { type CatalogPackDto, useCatalogPack, usePackComponentProducts, usePackProduct } from '../queries';
import { ComponentPicker } from './component-picker';
import { PackModes } from './pack-modes';
import { PackPreview } from './pack-preview';

const PACK_TYPE: (typeof PRODUCT_TYPES)[number] = 'pack';

interface EditorProps {
  readonly scope: StoreScope | null;
  readonly productId: string;
  readonly pack: CatalogPackDto | null;
  readonly storedPrice: number;
  readonly components: ReadonlyMap<string, PickableProduct>;
}

/** The form, its refusals, and the products the block has read (stored components, then picked ones). */
function usePackEditorState(props: EditorProps) {
  const initial = useMemo(() => {
    const titles = new Map([...props.components].map(([id, product]) => [id, product.title]));
    return props.pack === null ? emptyPackForm() : packFormOf(props.pack, titles);
  }, [props.pack, props.components]);
  const [form, setForm] = useState<PackForm>(initial);
  const [errors, setErrors] = useState<PackFormErrors>({});
  const [known, setKnown] = useState<ReadonlyMap<string, PickableProduct>>(props.components);
  const onChange = (change: Partial<PackForm>): void => {
    setForm((current) => ({ ...current, ...change }));
  };
  const onKnown = (product: PickableProduct): void => {
    setKnown((current) => new Map([...current, [product.id, product]]));
  };
  return { form, errors, setErrors, known, onChange, onKnown };
}

/** The pack's modes, components, preview and its own Save (the editor's Save does not reach the pack, D2201 b). */
function PackEditor(props: EditorProps): ReactNode {
  const { i18n } = useLingui();
  const state = usePackEditorState(props);
  const disabled = !useHeldPermissions(props.scope).has(EDIT_PRODUCTS_KEY);
  const save = usePackSave(props.scope, props.productId, state.setErrors);
  const formProps = { form: state.form, errors: state.errors, disabled, onChange: state.onChange };
  return (
    <div data-testid={PACK_BLOCK_TEST_ID} className="grid gap-6">
      <PackModes {...formProps} />
      <ComponentPicker
        {...formProps}
        scope={props.scope}
        productId={props.productId}
        known={state.known}
        onKnown={state.onKnown}
      />
      <PackPreview scope={props.scope} form={state.form} disabled={disabled} storedPrice={props.storedPrice} />
      {props.pack?.status === 'stale' && (
        <p role="alert" className="text-destructive text-sm">
          {i18n._('packs.stale')}
        </p>
      )}
      <div>
        <Button
          data-testid={PACK_SAVE_TEST_ID}
          disabled={disabled || save.isPending}
          onClick={() => {
            save.mutate(state.form);
          }}
        >
          {i18n._('packs.save')}
        </Button>
      </div>
    </div>
  );
}

/** Loads a pack product's stored pack and its components' products, then opens the editor on them. */
function StoredPack({
  scope,
  productId,
  price,
}: Pick<EditorProps, 'scope' | 'productId'> & { readonly price: number }) {
  const { i18n } = useLingui();
  const pack = useCatalogPack(scope, productId, true);
  const ids = useMemo(() => pack.data?.components.map((line) => line.productId) ?? [], [pack.data]);
  const products = usePackComponentProducts(scope, ids);
  if (pack.isPending || (ids.length > 0 && products.isPending)) return <p>{i18n._('packs.loading')}</p>;
  if (pack.isError) return <p role="alert">{i18n._('packs.error-generic')}</p>;
  const storedPrice = pack.data?.price ?? price;
  const components = products.data ?? new Map<string, PickableProduct>();
  return (
    <PackEditor
      key={JSON.stringify(pack.data)}
      scope={scope}
      productId={productId}
      pack={pack.data ?? null}
      storedPrice={storedPrice}
      components={components}
    />
  );
}

/** Reads the product's type: only a pack gets the editor, any other product a hint. */
function PackOfProduct({ scope, productId }: Pick<EditorProps, 'scope' | 'productId'>): ReactNode {
  const { i18n } = useLingui();
  const product = usePackProduct(scope, productId);
  if (product.isPending) return <p>{i18n._('packs.loading')}</p>;
  if (product.isError || product.data === null) return null;
  if (product.data.type !== PACK_TYPE)
    return <p className="text-muted-foreground text-sm">{i18n._('packs.not-a-pack')}</p>;
  return <StoredPack scope={scope} productId={productId} price={product.data.price} />;
}

/**
 * The pack block of catalog's product editor (D2105, D2201 b): on a new product it asks to save first; on a pack it
 * edits the components and modes and saves them through `saveCatalogPack`. Presentation only: the server computes and
 * checks everything (ADR 0017).
 */
export function PackBlock(): ReactNode {
  const { i18n } = useLingui();
  const params: { readonly productId?: string } = useParams({ strict: false });
  const scope = useStoreScope(useActiveStore());
  if (params.productId === undefined)
    return (
      <p data-testid={PACK_SAVE_FIRST_TEST_ID} className="text-muted-foreground text-sm">
        {i18n._('packs.save-first')}
      </p>
    );
  return <PackOfProduct scope={scope} productId={params.productId} />;
}

/** The block's title, translated. */
export function PackBlockTitle(): ReactNode {
  const { i18n } = useLingui();
  return i18n._('packs.block-title');
}
