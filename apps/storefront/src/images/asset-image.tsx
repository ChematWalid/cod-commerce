import Image from 'next/image';
import type { ReactNode } from 'react';
import { assetSource } from './asset-source';

interface AssetImageProps {
  /** A storage path (`toAssetPath`), never a URL. */
  readonly path: string;
  readonly alt: string;
  /** The edge of the square box the image is laid out in, in CSS pixels. */
  readonly size: number;
  /** The `sizes` hint, so the browser picks the preset it needs from the srcset. */
  readonly sizes: string;
  readonly priority?: boolean;
}

/**
 * A catalog image through the custom loader's presets (D3209). Server components only: the source is built here,
 * where `STOREFRONT_ASSET_BASE` is read at run time; client islands get a built source as a prop.
 */
export function AssetImage({ path, alt, size, sizes, priority = false }: AssetImageProps): ReactNode {
  return <Image src={assetSource(path)} alt={alt} width={size} height={size} sizes={sizes} priority={priority} />;
}
