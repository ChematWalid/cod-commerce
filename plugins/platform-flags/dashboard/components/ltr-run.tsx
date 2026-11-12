import type { ReactNode } from 'react';

const LTR_STYLE = { direction: 'ltr', unicodeBidi: 'isolate', display: 'inline-block' } as const;

/** Keeps a key, a count or an id in reading order: the stock stylesheet sets `direction: rtl` on every element. */
export function LtrRun({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <span dir="ltr" style={LTR_STYLE}>
      {children}
    </span>
  );
}
