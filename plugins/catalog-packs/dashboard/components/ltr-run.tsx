import type { ReactNode } from 'react';

const LTR_STYLE = { direction: 'ltr', unicodeBidi: 'isolate', display: 'inline-block' } as const;

/** Keeps a price or a weight in reading order inside right-to-left text (as catalog's `LtrRun`). */
export function LtrRun({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <span dir="ltr" style={LTR_STYLE}>
      {children}
    </span>
  );
}
