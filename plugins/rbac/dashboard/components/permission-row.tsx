import type { LocalizedLabel, PermissionKey } from '@cod/shared';
import { Switch } from '@vendure/dashboard';
import { type ReactNode, useId } from 'react';
import { labelIn, useUiLanguage } from '../labels';
import { SensitiveBadge } from './sensitive-badge';

interface PermissionRowProps {
  readonly permission: {
    readonly key: PermissionKey;
    readonly sensitive: boolean;
    readonly label: LocalizedLabel;
  };
  readonly checked: boolean;
  readonly onChange: (key: PermissionKey, on: boolean) => void;
}

/** One permission's switch. */
export function PermissionRow({ permission, checked, onChange }: PermissionRowProps): ReactNode {
  const language = useUiLanguage();
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <label htmlFor={id} className="flex flex-wrap items-center gap-2 text-sm">
        {labelIn(permission.label, language)}
        {permission.sensitive && <SensitiveBadge />}
      </label>
      <Switch
        id={id}
        className="cod-rbac-switch"
        checked={checked}
        onCheckedChange={(on) => {
          onChange(permission.key, on);
        }}
      />
    </div>
  );
}
