import { vendurePermissionName } from '@cod/shared';
import { useLingui } from '@lingui/react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  useAuth,
} from '@vendure/dashboard';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { type CSSProperties, type ReactNode, useState } from 'react';
import { CREATE_STORE_PERMISSION, STORE_CREATE_TEST_ID, STORE_SWITCHER_TEST_ID } from '../constants';
import { useShellAudience } from '../hooks/use-is-merchant';
import { useStoreSession } from '../hooks/use-store-session';
import type { SwitchableStoreView } from '../model/types';
import { CreateStoreDialog } from './create-store-dialog';

/** The stock stylesheet sets `direction` on every element of an RTL page, so the `dir` attribute alone does nothing. */
const LTR_RUN: CSSProperties = { direction: 'ltr' };

/** A store's name and its left-to-right subdomain, each cut off at the end of its own line (Review Focus 5). */
function StoreLabel({ store }: { readonly store: SwitchableStoreView }): ReactNode {
  return (
    <span className="flex min-w-0 flex-col text-start leading-tight">
      <span className="truncate font-medium">{store.name}</span>
      <bdi dir="ltr" style={LTR_RUN} className="text-muted-foreground truncate text-xs">
        {store.subdomain}
      </bdi>
    </span>
  );
}

/** Whether the channel the session is on grants Create Store: presentation only, the server checks it again. */
function useCanCreateStore(activeChannelId: string | undefined): boolean {
  const { channels } = useAuth();
  const held: readonly string[] = channels?.find((channel) => channel.id === activeChannelId)?.permissions ?? [];
  return held.includes(vendurePermissionName(CREATE_STORE_PERMISSION));
}

/** The switcher's button: the active store, cut off inside a width that fits a phone (Review Focus 5). */
function StoreTrigger({ active }: { readonly active: SwitchableStoreView | undefined }): ReactNode {
  const { i18n } = useLingui();
  return (
    <DropdownMenuTrigger
      render={
        <Button
          variant="outline"
          data-testid={STORE_SWITCHER_TEST_ID}
          title={i18n._('shell.store.switch')}
          className="h-auto max-w-36 min-w-0 gap-2 py-1 sm:max-w-64"
        />
      }
    >
      {active !== undefined && <StoreLabel store={active} />}
      <ChevronsUpDown aria-hidden className="size-4 shrink-0" />
    </DropdownMenuTrigger>
  );
}

interface StoreMenuProps {
  readonly stores: readonly SwitchableStoreView[];
  readonly active: SwitchableStoreView | undefined;
  readonly canCreate: boolean;
  readonly onSelect: (store: SwitchableStoreView) => void;
  readonly onCreate: () => void;
}

/** The dropdown of a merchant who has stores: every store, then Create Store when the role allows it. */
function StoreMenu({ stores, active, canCreate, onSelect, onCreate }: StoreMenuProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <DropdownMenu>
      <StoreTrigger active={active} />
      <DropdownMenuContent align="end" className="max-h-[60vh] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto">
        {stores.map((store) => (
          <DropdownMenuItem
            key={store.id}
            className="gap-2"
            onClick={() => {
              onSelect(store);
            }}
          >
            <StoreLabel store={store} />
            {store.channelId === active?.channelId && <Check aria-hidden className="ms-auto size-4 shrink-0" />}
          </DropdownMenuItem>
        ))}
        {canCreate && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem data-testid={STORE_CREATE_TEST_ID} className="gap-2" onClick={onCreate}>
              <Plus aria-hidden className="size-4 shrink-0" />
              {i18n._('shell.store.create')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The switcher of a merchant: mounted always, so the session rules hold whichever page is open (D86). */
function MerchantStoreSwitcher(): ReactNode {
  const { i18n } = useLingui();
  const { stores, activeStore, activeChannelId, platformDomain, switchTo } = useStoreSession();
  const canCreate = useCanCreateStore(activeChannelId);
  const [creating, setCreating] = useState(false);
  if (stores === undefined) return null;
  if (stores.length === 0) {
    return (
      <span data-testid={STORE_SWITCHER_TEST_ID} className="text-muted-foreground text-sm">
        {i18n._('shell.store.none')}
      </span>
    );
  }
  const select = (store: SwitchableStoreView): void => {
    if (store.channelId === activeChannelId) return;
    switchTo(store.channelId).catch((error: unknown) => {
      console.error('Could not switch store', error);
    });
  };
  return (
    <>
      <StoreMenu
        stores={stores}
        active={activeStore}
        canCreate={canCreate}
        onSelect={select}
        onCreate={() => {
          setCreating(true);
        }}
      />
      <CreateStoreDialog
        open={creating}
        platformDomain={platformDomain}
        switchTo={switchTo}
        onOpenChange={setCreating}
      />
    </>
  );
}

/** The toolbar's store switcher. Platform staff keep the stock one (D79). */
export function StoreSwitcher(): ReactNode {
  return useShellAudience() === 'merchant' ? <MerchantStoreSwitcher /> : null;
}
