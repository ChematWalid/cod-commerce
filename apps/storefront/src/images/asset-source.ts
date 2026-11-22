import { storefrontAssetBase } from '../config/storefront-env';
import { withPreset } from './loader';

/** Where images are served from when `STOREFRONT_ASSET_BASE` is not set: the asset route on the same origin. */
export const DEFAULT_ASSET_BASE = '/assets';

/** The asset base of this process, read on each call (never at load: `next build` evaluates this module). */
export function assetBase(): string {
  const configured = storefrontAssetBase();
  return (configured === '' ? DEFAULT_ASSET_BASE : configured).replace(/\/+$/, '');
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

/**
 * The full asset URL of a storage path, without a preset: what a server component hands `next/image` as `src`. Every
 * segment is encoded, so a path can never add a query or a fragment. Built on the server, where
 * `STOREFRONT_ASSET_BASE` is read at run time; the loader then only adds the preset, in the browser too.
 */
export function assetSource(path: string, base: string = assetBase()): string {
  return `${base}/${encodePath(path)}`;
}

/** The URL of a storage path at the preset nearest to `width`: `${base}/${path}?preset=<name>` (D3209). */
export function imageUrl(path: string, width: number, base: string = assetBase()): string {
  return withPreset(assetSource(path, base), width);
}
