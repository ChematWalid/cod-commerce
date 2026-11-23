import { STOREFRONT_PAGE_PATHS } from '@cod/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { t } from '../../i18n/messages';
import { AssetImage } from '../../images/asset-image';
import type { SectionProps } from '../section-props';

/** The layout box of a collection tile image. */
const TILE_IMAGE_SIZE = 300;

/** The store's visible collections as tiles linking to their pages (`limit`). */
export function Collections({ section, data }: SectionProps): ReactNode {
  const all = data.collections ?? [];
  const limit = section.settings['limit'];
  const shown = typeof limit === 'number' && Number.isInteger(limit) && limit >= 1 ? all.slice(0, limit) : all;
  if (shown.length === 0) return null;
  return (
    <div className="collections">
      <h2>{t(data.locale, 'collections.title')}</h2>
      <ul className="collection-tiles">
        {shown.map((collection) => (
          <li key={collection.id} data-collection-id={collection.id}>
            <Link href={`${STOREFRONT_PAGE_PATHS.category}/${encodeURIComponent(collection.slug)}`}>
              {collection.imagePath === null ? null : (
                <AssetImage
                  path={collection.imagePath}
                  alt={collection.title}
                  size={TILE_IMAGE_SIZE}
                  sizes="(min-width: 48rem) 33vw, 50vw"
                />
              )}
              <span>{collection.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
