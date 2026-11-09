import { useLingui } from '@lingui/react';
import type { ReactNode } from 'react';

/**
 * The visually hidden "Coming soon" that an inert top-bar placeholder names in `aria-describedby`. A `title` tooltip
 * never shows on a disabled button and is not reliably announced; this is read with the control.
 */
export function ComingSoonHint({ id }: { readonly id: string }): ReactNode {
  const { i18n } = useLingui();
  return (
    <span id={id} className="sr-only">
      {i18n._('shell.topbar.coming-soon')}
    </span>
  );
}
