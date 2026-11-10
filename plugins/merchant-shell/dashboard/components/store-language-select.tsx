import { useLingui } from '@lingui/react';
import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@vendure/dashboard';
import { type ReactNode, useId } from 'react';
import { STORE_LANGUAGE_OPTIONS } from '../constants';

interface StoreLanguageSelectProps {
  readonly value: string;
  readonly onChange: (language: string) => void;
  /** Shows the value without letting it change, for someone who may see the store but not edit it. */
  readonly disabled?: boolean;
}

/** The storefront's language, independent of the language this dashboard is shown in. */
export function StoreLanguageSelect({ value, onChange, disabled = false }: StoreLanguageSelectProps): ReactNode {
  const { i18n } = useLingui();
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{i18n._('Store language')}</Label>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(language) => {
          if (language !== null) onChange(language);
        }}
      >
        <SelectTrigger id={id} className="w-full" aria-describedby={hintId}>
          <SelectValue>{STORE_LANGUAGE_OPTIONS.find((option) => option.code === value)?.label}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {STORE_LANGUAGE_OPTIONS.map(({ code, label }) => (
            <SelectItem key={code} value={code}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p id={hintId} className="text-muted-foreground text-xs">
        {i18n._('The language your customers shop in, not the dashboard')}
      </p>
    </div>
  );
}
