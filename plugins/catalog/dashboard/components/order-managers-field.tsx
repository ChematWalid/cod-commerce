import { useLingui } from '@lingui/react';
import type { ReactNode } from 'react';
import { VIEW_MEMBERS_KEY } from '../constants';
import { useOrderManagers } from '../editor-queries';
import { CheckList } from './check-list';
import type { ScopedSectionProps } from './section-props';

interface OrderManagersFieldProps extends ScopedSectionProps {
  readonly held: ReadonlySet<string>;
}

/**
 * The members who handle this product's orders (D2114). Picking needs the team view key; without it the field shows
 * how many are set and leaves them as they are.
 */
export function OrderManagersField({ form, disabled, onChange, scope, held }: OrderManagersFieldProps): ReactNode {
  const { i18n } = useLingui();
  const canList = held.has(VIEW_MEMBERS_KEY);
  const managers = useOrderManagers(scope, canList);
  const selected = form.settings.orderManagerIds;
  const count = { count: selected.length };
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">{i18n._('catalog.editor-order-managers')}</legend>
      {canList && managers.isSuccess ? (
        <CheckList
          items={managers.data.map((member) => ({ id: member.id, label: member.name ?? member.id }))}
          selected={selected}
          disabled={disabled}
          onChange={(orderManagerIds) => {
            onChange({ settings: { ...form.settings, orderManagerIds } });
          }}
        />
      ) : (
        <p className="text-muted-foreground text-xs">{i18n._('catalog.editor-order-managers-count', count)}</p>
      )}
    </fieldset>
  );
}
