import type { ReactNode } from 'react';
import { AssetImage } from '../../images/asset-image';
import type { SectionProps } from '../section-props';

/** The layout box of a gallery image. */
const GALLERY_IMAGE_SIZE = 800;

/** The product's images, the first one loaded eagerly as the page's largest paint. */
export function Gallery({ data }: SectionProps): ReactNode {
  const images = data.product?.images ?? [];
  if (images.length === 0) return null;
  return (
    <ul className="gallery">
      {images.map((image, index) => (
        <li key={image.path}>
          <AssetImage
            path={image.path}
            alt={image.alt}
            size={GALLERY_IMAGE_SIZE}
            sizes="(min-width: 48rem) 50vw, 100vw"
            priority={index === 0}
          />
        </li>
      ))}
    </ul>
  );
}
