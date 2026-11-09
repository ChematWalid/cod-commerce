import { useLingui } from '@lingui/react';
import type { ReactNode } from 'react';
import type { SubdomainCheck } from '../hooks/use-subdomain-availability';
import { TextField } from './text-field';

interface SubdomainFieldProps {
  readonly value: string;
  readonly check: SubdomainCheck;
  readonly errorId?: string | undefined;
  readonly onChange: (value: string) => void;
}

const STATE_CLASS: Readonly<Record<SubdomainCheck['state'], string>> = {
  idle: '',
  checking: 'text-muted-foreground',
  available: 'text-success',
  unavailable: 'text-destructive',
};

/** The store's address. Always left-to-right, even on an Arabic page. */
export function SubdomainField({ value, check, errorId, onChange }: SubdomainFieldProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="grid gap-1.5">
      <TextField
        label={i18n._('Store address')}
        dir="ltr"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        errorId={errorId}
        onChange={(event) => {
          onChange(event.target.value.trim().toLowerCase());
        }}
      />
      <p aria-live="polite" className={`text-sm ${STATE_CLASS[check.state]}`}>
        {check.messageId !== null && i18n._(check.messageId)}
      </p>
    </div>
  );
}
