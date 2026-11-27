import {
  type StoreScope,
  StoreScopedPage,
  storePathFor,
  type SwitchableStoreView,
  useHeldPermissions,
  useStoreScope,
} from '@cod/plugin-merchant-shell/shell-api';
import { useLingui } from '@lingui/react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { ActionBarItem, Button, Page, PageActionBar, PageBlock, PageLayout, PageTitle } from '@vendure/dashboard';
import { type ReactNode, useState } from 'react';
import { BulkCard } from '../components/bulk-card';
import { SettingsCard } from '../components/settings-card';
import { WilayaTable } from '../components/wilaya-table';
import {
  CREATE_PRICING_KEY,
  DELIVERY_PATH,
  EDIT_PRICING_KEY,
  PRICING_BACK_TEST_ID,
  PRICING_EDITOR_PAGE_ID,
  PRICING_EDITOR_TEST_ID,
  PRICING_SAVE_TEST_ID,
  pricingPathOf,
  VIEW_PRICING_KEY,
} from '../constants';
import type { CommuneRateDto, FeeGroupDto } from '../dto';
import { usePricingSave } from '../hooks/use-pricing-writes';
import { errorMessageIdOf } from '../model/list-view';
import { newPricingFormOf, type PricingForm, pricingFormOf } from '../model/pricing-form';
import { useFeeGroup, usePricingTemplate } from '../queries';

const BLOCK_IDS = {
  settings: 'delivery-pricing-settings',
  bulk: 'delivery-pricing-bulk',
  table: 'delivery-pricing-wilayas',
};
const NO_COMMUNE_RATES: readonly CommuneRateDto[] = [];

interface EditorProps {
  readonly store: SwitchableStoreView;
  readonly scope: StoreScope | null;
  /** The option as loaded, or null for a new one. */
  readonly group: FeeGroupDto | null;
  readonly initial: PricingForm;
}

/** The form, the refused fields and the save; a new option moves to its own page once created. */
function useEditor({ store, scope, group, initial }: EditorProps) {
  const navigate = useNavigate();
  const held = useHeldPermissions(scope);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<ReadonlySet<string>>(new Set());
  const save = usePricingSave({
    scope,
    groupId: group?.id ?? null,
    onErrors: setErrors,
    onSaved: (saved) => {
      if (group === null) void navigate({ to: storePathFor(pricingPathOf(saved.id), store.id) });
      else setForm(pricingFormOf(saved));
    },
  });
  const canSave = held.has(group === null ? CREATE_PRICING_KEY : EDIT_PRICING_KEY);
  return { form, setForm, errors, save, canSave };
}

/**
 * Back to the list, and Save for a caller who may save; a direct child of the page, as the title row needs. Both sit
 * in one action bar item: on a phone the Vendure bar keeps only its last item, which would drop Back.
 */
function EditorActions(props: { readonly canSave: boolean; readonly busy: boolean; readonly onSave: () => void }) {
  const { i18n } = useLingui();
  return (
    <PageActionBar>
      <ActionBarItem itemId="delivery-pricing-actions">
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            data-testid={PRICING_BACK_TEST_ID}
            variant="outline"
            render={<Link to={DELIVERY_PATH} search={{ tab: 'pricing' }} />}
          >
            {i18n._('delivery-pricing.back')}
          </Button>
          {props.canSave && (
            <Button data-testid={PRICING_SAVE_TEST_ID} disabled={props.busy} onClick={props.onSave}>
              {i18n._('delivery-pricing.save')}
            </Button>
          )}
        </div>
      </ActionBarItem>
    </PageActionBar>
  );
}

function EditorPage(props: EditorProps): ReactNode {
  const { i18n } = useLingui();
  const { form, setForm, errors, save, canSave } = useEditor(props);
  const disabled = !canSave;
  const onChange = (change: Partial<PricingForm>): void => {
    setForm((current) => ({ ...current, ...change }));
  };
  return (
    <Page pageId={PRICING_EDITOR_PAGE_ID}>
      <PageTitle>{props.group?.name ?? i18n._('delivery-pricing.new-heading')}</PageTitle>
      <EditorActions
        canSave={canSave}
        busy={save.isPending}
        onSave={() => {
          save.mutate(form);
        }}
      />
      <PageLayout>
        <PageBlock column="main" blockId={BLOCK_IDS.settings} title={i18n._('delivery-pricing.settings-title')}>
          <SettingsCard form={form} errors={errors} disabled={disabled} onChange={onChange} />
        </PageBlock>
        <PageBlock column="main" blockId={BLOCK_IDS.bulk} title={i18n._('delivery-pricing.bulk-title')}>
          <BulkCard form={form} disabled={disabled} onForm={setForm} />
        </PageBlock>
        <PageBlock column="main" blockId={BLOCK_IDS.table} title={i18n._('delivery-pricing.wilayas-title')}>
          <WilayaTable
            form={form}
            errors={errors}
            disabled={disabled}
            scope={props.scope}
            groupId={props.group?.id ?? null}
            communeRates={props.group?.communeRates ?? NO_COMMUNE_RATES}
            onForm={setForm}
          />
        </PageBlock>
      </PageLayout>
    </Page>
  );
}

function Notice({ messageId, alert = false }: { readonly messageId: string; readonly alert?: boolean }): ReactNode {
  const { i18n } = useLingui();
  return <p role={alert ? 'alert' : undefined}>{i18n._(messageId)}</p>;
}

/** A new pricing option, started from the store's "Platform default prices" table (D3138). */
function NewPricing({ store, scope }: Pick<EditorProps, 'store' | 'scope'>): ReactNode {
  const template = usePricingTemplate(scope);
  if (template.isError) return <Notice alert messageId={errorMessageIdOf(template.error)} />;
  if (template.data === undefined) return <Notice messageId="delivery-pricing.loading" />;
  if (template.data === null) return <Notice alert messageId="delivery-pricing.template-missing" />;
  return <EditorPage store={store} scope={scope} group={null} initial={newPricingFormOf(template.data)} />;
}

/** The option of the URL in the URL's store; not found when the store has no such option. */
function ExistingPricing(props: Pick<EditorProps, 'store' | 'scope'> & { readonly groupId: string }): ReactNode {
  const group = useFeeGroup(props.scope, props.groupId);
  if (group.isError) return <Notice alert messageId={errorMessageIdOf(group.error)} />;
  if (group.data === undefined) return <Notice messageId="delivery-pricing.loading" />;
  if (group.data === null) return <Notice alert messageId="delivery-pricing.not-found-page" />;
  return <EditorPage key={group.data.id} {...props} group={group.data} initial={pricingFormOf(group.data)} />;
}

function PricingEditor({
  store,
  groupId,
}: {
  readonly store: SwitchableStoreView | undefined;
  readonly groupId: string | null;
}) {
  const scope = useStoreScope(store);
  if (store === undefined) return <Notice messageId="delivery-pricing.loading" />;
  return (
    <div data-testid={PRICING_EDITOR_TEST_ID} data-store-id={store.id}>
      {groupId === null ? (
        <NewPricing store={store} scope={scope} />
      ) : (
        <ExistingPricing store={store} scope={scope} groupId={groupId} />
      )}
    </div>
  );
}

/** `/stores/$storeId/delivery/pricing/new`: needs the create key on the URL's store. */
export function NewPricingPage(): ReactNode {
  return (
    <StoreScopedPage permission={CREATE_PRICING_KEY}>
      {({ store }) => <PricingEditor store={store} groupId={null} />}
    </StoreScopedPage>
  );
}

/** `/stores/$storeId/delivery/pricing/$groupId`: the view key opens it read-only, the edit key lets it save. */
export function EditPricingPage(): ReactNode {
  const params: { readonly groupId?: string } = useParams({ strict: false });
  return (
    <StoreScopedPage permission={VIEW_PRICING_KEY}>
      {({ store }) => <PricingEditor store={store} groupId={params.groupId ?? null} />}
    </StoreScopedPage>
  );
}
