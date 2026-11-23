import { formatDzd, STOREFRONT_PAGE_PATHS, type StorefrontLocale, type StorefrontProductCard } from '@cod/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { t } from '../../i18n/messages';
import { AssetImage } from '../../images/asset-image';

/** The layout box of a card image; the loader serves the nearest preset. */
const CARD_IMAGE_SIZE = 300;

interface ProductCardProps {
  readonly card: StorefrontProductCard;
  readonly locale: StorefrontLocale;
}

/**
 * One product of a grid: image, name, server price and the sold-out badge. A sold-out product only reaches a grid
 * when the store keeps them; the api already hides them otherwise.
 */
export function ProductCard({ card, locale }: ProductCardProps): ReactNode {
  return (
    <li className="product-card" data-product-id={card.id}>
      <Link href={`${STOREFRONT_PAGE_PATHS.product}/${encodeURIComponent(card.slug)}`}>
        {card.imagePath === null ? null : (
          <AssetImage
            path={card.imagePath}
            alt={card.name}
            size={CARD_IMAGE_SIZE}
            sizes="(min-width: 48rem) 25vw, 50vw"
          />
        )}
        <span className="product-name">{card.name}</span>
      </Link>
      <span className="price">{formatDzd(locale, card.price)}</span>
      {card.oldPrice === null ? null : <s className="old-price">{formatDzd(locale, card.oldPrice)}</s>}
      {card.soldOut ? <span className="sold-out-badge">{t(locale, 'product.soldOut')}</span> : null}
    </li>
  );
}
