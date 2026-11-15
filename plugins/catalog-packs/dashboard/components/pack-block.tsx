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
import { blockLoadOf } from '../model/pack-load';
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

const NO_COMPONENTS: ReadonlyMap<string, PickableProduct> = new Map();

/** The block's notice while a read is pending, or why it failed. */
function LoadNotice({ kind }: { readonly kind: 'loading' | 'error' }): ReactNode {
  const { i18n } = useLingui();
  if (kind === 'loading') return <p>{i18n._('packs.loading')}</p>;
  return (
    <p role="alert" className="text-destructive text-sm">
      {i18n._('packs.error-generic')}
    </p>
  );
}

/**
 * Loads a pack product's stored pack and its components' products, then opens the editor on them. A placeholder (the
 * previous key's answer) counts as loading, so the editor never freezes another read's answer (D2245).
 */
function StoredPack({
  scope,
  productId,
  price,
}: Pick<EditorProps, 'scope' | 'productId'> & { readonly price: number }) {
  const pack = useCatalogPack(scope, productId, true);
  const packLoad = blockLoadOf(pack);
  const ready = packLoad.kind === 'ready' ? packLoad.data : null;
  const ids = useMemo(() => ready?.components.map((line) => line.productId) ?? [], [ready]);
  const products = usePackComponentProducts(scope, ids);
  const productsLoad = ids.length === 0 ? { kind: 'ready' as const, data: NO_COMPONENTS } : blockLoadOf(products);
  if (packLoad.kind !== 'ready') return <LoadNotice kind={packLoad.kind} />;
  if (productsLoad.kind !== 'ready') return <LoadNotice kind={productsLoad.kind} />;
  return (
    <PackEditor
      key={JSON.stringify([packLoad.data, ids])}
      scope={scope}
      productId={productId}
      pack={packLoad.data}
      storedPrice={packLoad.data?.price ?? price}
      components={productsLoad.data}
    />
  );
}

/** Reads the product's type: only a pack gets the editor, any other product a hint, a missing one nothing. */
function PackOfProduct({ scope, productId }: Pick<EditorProps, 'scope' | 'productId'>): ReactNode {
  const { i18n } = useLingui();
  const load = blockLoadOf(usePackProduct(scope, productId));
  if (load.kind !== 'ready') return <LoadNotice kind={load.kind} />;
  if (load.data === null) return null;
  if (load.data.type !== PACK_TYPE)
    return <p className="text-muted-foreground text-sm">{i18n._('packs.not-a-pack')}</p>;
  return <StoredPack key={productId} scope={scope} productId={productId} price={load.data.price} />;
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
