import { useLingui } from '@lingui/react';
import { Badge } from '@vendure/dashboard';
import type { ReactNode } from 'react';

/** Marks a permission that needs an explicit choice (D62). */
export function SensitiveBadge(): ReactNode {
  const { i18n } = useLingui();
  return <Badge variant="destructive">{i18n._('rbac.sensitive')}</Badge>;
}
