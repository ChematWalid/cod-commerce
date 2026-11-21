import type { ReactNode } from 'react';

const LTR_STYLE = { direction: 'ltr', unicodeBidi: 'isolate', display: 'inline-block' } as const;

/** Keeps a price, a SKU or a count in reading order inside right-to-left text (the idea of team's `LtrRun`). */
export function LtrRun({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <span dir="ltr" style={LTR_STYLE}>
      {children}
    </span>
  );
}
