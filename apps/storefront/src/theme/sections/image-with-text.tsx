import type { ReactNode } from 'react';
import type { SectionProps } from '../section-props';

/** The store's description as a text block; its image comes with the builder's media settings (P8). */
export function ImageWithText({ data }: SectionProps): ReactNode {
  if (data.store.description === '') return null;
  return (
    <div className="image-with-text">
      <p>{data.store.description}</p>
    </div>
  );
}
