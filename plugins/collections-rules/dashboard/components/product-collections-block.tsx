import { useActiveStore } from '@cod/plugin-merchant-shell/shell-api';
import { useLingui } from '@lingui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { Button, Checkbox, toast } from '@vendure/dashboard';
import { type ReactNode, useState } from 'react';
import { setStoreProductCollections } from '../commands';
import {
  COLLECTIONS_QUERY_KEY,
  EDIT_COLLECTIONS_KEY,
  PRODUCT_COLLECTIONS_BLOCK_TEST_ID,
  PRODUCT_COLLECTIONS_QUERY_KEY,
  PRODUCT_COLLECTIONS_SAVE_TEST_ID,
  VIEW_COLLECTIONS_KEY,
} from '../constants';
import type { StoreCollectionRefDto, StoreProductCollectionsDto } from '../dto';
import { useHeldPermissions } from '../hooks/use-held-permissions';
import { useStoreScope } from '../hooks/use-store-scope';
import { errorMessageIdOf } from '../model/list-view';
import {
  collectionIdsToSend,
  manualChoicesOf,
  productCollectionsViewOf,
  samePicks,
} from '../model/product-collections';
import type { StoreScope } from '../model/store-query';
import { useCollectionChoices, useProductCollections } from '../rule-queries';

/** The class the collections stylesheet hides the whole block by, when the caller may not see collections. */
const HIDDEN_BLOCK_CLASS = 'cod-collections-block-hidden';

interface EditorProps {
  readonly scope: StoreScope | null;
  readonly productId: string;
  readonly canEdit: boolean;
  readonly answer: StoreProductCollectionsDto;
  readonly choices: readonly StoreCollectionRefDto[];
}

/** The save of the picked manual collections, through our own mutation and the edit key (D2324). */
function useSaveProductCollections(props: EditorProps) {
  const { i18n } = useLingui();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (picked: readonly string[]) =>
      setStoreProductCollections(props.scope, props.productId, collectionIdsToSend(picked, props.answer)),
    onSuccess: async () => {
      for (const queryKey of [PRODUCT_COLLECTIONS_QUERY_KEY, COLLECTIONS_QUERY_KEY])
        await queryClient.invalidateQueries({ queryKey });
      toast.success(i18n._('collections.product-block-saved'));
    },
    onError: (error: unknown) => {
      toast.error(i18n._(errorMessageIdOf(error)));
    },
  });
}

/** The collections a rule adds the product to: read-only, the rule decides them. */
function ByRule({ collections }: { readonly collections: readonly StoreCollectionRefDto[] }): ReactNode {
  const { i18n } = useLingui();
  if (collections.length === 0) return null;
  return (
    <div className="grid gap-1">
      <p className="text-sm font-medium">{i18n._('collections.product-block-by-rule')}</p>
      <ul className="grid gap-1 text-sm">
        {collections.map(({ id, title }) => (
          <li key={id}>
            <bdi>{title}</bdi>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The manual collections as checkboxes; merchant titles shown as typed. */
function ManualPicks(props: {
  readonly choices: readonly StoreCollectionRefDto[];
  readonly picked: readonly string[];
  readonly disabled: boolean;
  readonly onToggle: (id: string) => void;
}): ReactNode {
  const { i18n } = useLingui();
  if (props.choices.length === 0)
    return <p className="text-muted-foreground text-sm">{i18n._('collections.product-block-none')}</p>;
  return (
    <ul className="grid max-h-60 gap-1 overflow-y-auto">
      {props.choices.map(({ id, title }) => (
        <li key={id}>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={props.picked.includes(id)}
              disabled={props.disabled}
              onCheckedChange={() => {
                props.onToggle(id);
              }}
            />
            <bdi className="[overflow-wrap:anywhere]">{title}</bdi>
          </label>
        </li>
      ))}
    </ul>
  );
}

function ProductCollectionsEditor(props: EditorProps): ReactNode {
  const { i18n } = useLingui();
  const view = productCollectionsViewOf(props.answer);
  const [picked, setPicked] = useState<readonly string[]>(view.manualIds);
  const save = useSaveProductCollections(props);
  const toggle = (id: string): void => {
    setPicked((current) => (current.includes(id) ? current.filter((kept) => kept !== id) : [...current, id]));
  };
  return (
    <div className="grid gap-3">
      <p className="text-sm font-medium">{i18n._('collections.product-block-manual')}</p>
      {!props.canEdit && (
        <p className="text-muted-foreground text-xs">{i18n._('collections.product-block-read-only')}</p>
      )}
      <ManualPicks choices={props.choices} picked={picked} disabled={!props.canEdit} onToggle={toggle} />
      {props.canEdit && (
        <div>
          <Button
            type="button"
            variant="outline"
            data-testid={PRODUCT_COLLECTIONS_SAVE_TEST_ID}
            disabled={save.isPending || samePicks(picked, view.manualIds)}
            onClick={() => {
              save.mutate(picked);
            }}
          >
            {i18n._('collections.product-block-save')}
          </Button>
        </div>
      )}
      <ByRule collections={view.byRule} />
    </div>
  );
}

/** Loads the product's collections and the store's, then the editor; its picks restart from each fresh answer. */
function LoadedBlock(props: Omit<EditorProps, 'answer' | 'choices'>): ReactNode {
  const { i18n } = useLingui();
  const answer = useProductCollections(props.scope, props.productId);
  const collections = useCollectionChoices(props.scope);
  const failed = answer.isError ? answer.error : collections.error;
  if (failed !== null) return <p role="alert">{i18n._(errorMessageIdOf(failed))}</p>;
  if (!answer.isSuccess || !collections.isSuccess) return <p>{i18n._('collections.loading')}</p>;
  return (
    <ProductCollectionsEditor
      key={JSON.stringify(answer.data)}
      {...props}
      answer={answer.data}
      choices={manualChoicesOf(collections.data, answer.data)}
    />
  );
}

/**
 * The collections block of catalog's product editor (D2324a): the product's manual collections with their own save
 * (edit key), and the automatic ones "added by rule". Hidden without the collections view key; a new product first
 * needs saving.
 */
export function ProductCollectionsBlock(): ReactNode {
  const { i18n } = useLingui();
  const scope = useStoreScope(useActiveStore());
  const held = useHeldPermissions(scope);
  const params: { readonly productId?: string } = useParams({ strict: false });
  if (!held.has(VIEW_COLLECTIONS_KEY)) return <span className={HIDDEN_BLOCK_CLASS} hidden />;
  return (
    <div data-testid={PRODUCT_COLLECTIONS_BLOCK_TEST_ID}>
      {params.productId === undefined ? (
        <p className="text-muted-foreground text-sm">{i18n._('collections.product-block-new')}</p>
      ) : (
        <LoadedBlock scope={scope} productId={params.productId} canEdit={held.has(EDIT_COLLECTIONS_KEY)} />
      )}
    </div>
  );
}

/** The block's title, translated in the dashboard's language. */
export function ProductCollectionsTitle(): ReactNode {
  const { i18n } = useLingui();
  return i18n._('collections.product-block-title');
}
