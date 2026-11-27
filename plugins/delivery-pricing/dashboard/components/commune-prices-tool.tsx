import type { StoreScope } from '@cod/plugin-merchant-shell/shell-api';
import type { WilayaCode } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Button } from '@vendure/dashboard';
import { type ReactNode, useState } from 'react';
import { COMMUNE_PRICES_APPLY_TEST_ID, COMMUNE_PRICES_TEST_ID } from '../constants';
import { useCommunePrices } from '../hooks/use-bulk-writes';
import { type CommunePricesForm, communePricesInputOf } from '../model/price-tools';
import { NumberField } from './form-fields';

interface CommunePricesToolProps {
  readonly scope: StoreScope | null;
  readonly groupId: string;
  readonly provinceCode: WilayaCode;
}

const BLANK: CommunePricesForm = { home: '', desk: '' };

/**
 * "Set price for all communes" of an expanded wilaya (D3140): the typed prices go to every commune of the wilaya at
 * once; a blank price is left as each commune has it.
 */
export function CommunePricesTool({ scope, groupId, provinceCode }: CommunePricesToolProps): ReactNode {
  const { i18n } = useLingui();
  const [prices, setPrices] = useState(BLANK);
  const write = useCommunePrices({ scope, groupId });
  const submit = communePricesInputOf(provinceCode, prices);
  return (
    <fieldset data-testid={COMMUNE_PRICES_TEST_ID} className="grid gap-2 border-b pb-3">
      <legend className="mb-1 text-sm font-medium">{i18n._('delivery-pricing.commune-prices-title')}</legend>
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <NumberField
          label={i18n._('delivery-pricing.column-home')}
          value={prices.home}
          disabled={false}
          onChange={(home) => {
            setPrices((current) => ({ ...current, home }));
          }}
        />
        <NumberField
          label={i18n._('delivery-pricing.column-desk')}
          value={prices.desk}
          disabled={false}
          onChange={(desk) => {
            setPrices((current) => ({ ...current, desk }));
          }}
        />
        <Button
          size="sm"
          variant="outline"
          data-testid={COMMUNE_PRICES_APPLY_TEST_ID}
          disabled={write.isPending || !submit.ok}
          onClick={() => {
            if (submit.ok) write.mutate(submit.input, { onSuccess: () => setPrices(BLANK) });
          }}
        >
          {i18n._('delivery-pricing.commune-prices-apply')}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">{i18n._('delivery-pricing.commune-prices-hint')}</p>
    </fieldset>
  );
}
