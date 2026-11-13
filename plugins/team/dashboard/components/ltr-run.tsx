import type { ReactNode } from 'react';

const LTR_STYLE = { direction: 'ltr', unicodeBidi: 'isolate', display: 'inline-block' } as const;

/** Keeps an amount, a count or an address in reading order: the stock stylesheet sets `direction: rtl` (P1.S2). */
export function LtrRun({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <span dir="ltr" style={LTR_STYLE}>
      {children}
    </span>
  );
}
