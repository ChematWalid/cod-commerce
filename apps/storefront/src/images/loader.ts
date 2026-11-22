/**
 * The asset server's named image presets (D3209): anonymous requests may only ask for one of these, never a free size
 * (`apps/server` `PresetOnlyStrategy`). The WebP presets of ADR 0006 §8 replace this table when they exist.
 */
export const IMAGE_PRESETS = [
  { name: 'tiny', width: 50 },
  { name: 'thumb', width: 150 },
  { name: 'small', width: 300 },
  { name: 'medium', width: 500 },
  { name: 'large', width: 800 },
] as const;

/** One of the {@link IMAGE_PRESETS} names. */
export type ImagePresetName = (typeof IMAGE_PRESETS)[number]['name'];

/** What `next/image` hands a custom loader. */
export interface ImageLoaderInput {
  readonly src: string;
  readonly width: number;
  readonly quality?: number;
}

/** The preset whose width is nearest to `width`; a tie goes to the larger one, so an image is never upscaled twice. */
export function presetFor(width: number): ImagePresetName {
  let best: (typeof IMAGE_PRESETS)[number] = IMAGE_PRESETS[0];
  for (const preset of IMAGE_PRESETS) {
    if (Math.abs(preset.width - width) <= Math.abs(best.width - width)) best = preset;
  }
  return best.name;
}

/** `source` at the preset nearest to `width`: `${source}?preset=<name>` (D3209). */
export function withPreset(source: string, width: number): string {
  return `${source}?preset=${presetFor(width)}`;
}

/**
 * The custom `next/image` loader (`images.loaderFile`). It runs in the browser as well, so it reads no environment and
 * imports nothing server-side: `src` is already an asset source built on the server (`assetSource`), and the loader
 * picks the preset nearest to the width Next asks for.
 */
export default function storefrontImageLoader({ src, width }: ImageLoaderInput): string {
  return withPreset(src, width);
}
