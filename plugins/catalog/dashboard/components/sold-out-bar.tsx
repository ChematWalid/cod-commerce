import { useLingui } from '@lingui/react';
import { Button } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { SOLD_OUT_ORDERS_TEST_ID } from '../constants';
import { useSoldOutOrders } from '../hooks/use-sold-out-orders';
import type { StoreScope } from '../queries';

/** "Stop orders" and "Resume orders" for every sold-out product of the store, on the sold-out tab (AC6, D2108). */
export function SoldOutBar({ scope }: { readonly scope: StoreScope | null }): ReactNode {
  const { i18n } = useLingui();
  const orders = useSoldOutOrders(scope);
  const disabled = scope === null || orders.isPending;
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid={SOLD_OUT_ORDERS_TEST_ID}>
      <p className="text-muted-foreground text-sm">{i18n._('catalog.sold-out-orders-hint')}</p>
      <Button
        variant="outline"
        disabled={disabled}
        onClick={() => {
          orders.mutate('stop');
        }}
      >
        {i18n._('catalog.stop-orders')}
      </Button>
      <Button
        variant="outline"
        disabled={disabled}
        onClick={() => {
          orders.mutate('resume');
        }}
      >
        {i18n._('catalog.resume-orders')}
      </Button>
    </div>
  );
}
