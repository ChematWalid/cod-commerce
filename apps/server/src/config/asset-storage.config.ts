import { tmpdir } from 'node:os';
import path from 'node:path';
import { AssetServerPlugin, configureS3AssetStorage, PresetOnlyStrategy } from '@vendure/asset-server-plugin';
import type { AppEnv } from './env';
import { PrefixedAssetStorage } from './prefixed-asset-storage';
import { TenantAssetNamingStrategy } from './tenant-asset-naming.strategy';

/** Where the api serves assets (D33); also the path the asset URLs carry. */
export const ASSET_ROUTE = 'assets';

/**
 * The key prefix of asset files inside the shared Garage bucket (D33). Below it, tenant files sit under their tenant's
 * prefix (`assets/b/{business}/s/{store}/source/…`, D2113) from the naming strategy.
 */
export const ASSET_KEY_PREFIX = 'assets/';

/**
 * Anonymous requests may only pick a named preset. Free `?w=&h=` would let anyone make the server render and cache
 * an object per size. The dashboard's thumbnails and galleries all ask for presets; only its unused
 * `ResponsiveImage` asks for widths, and those requests fall back to this preset.
 */
const DEFAULT_IMAGE_PRESET = 'medium';

/** Required by the plugin's options, never written to: the S3 storage strategy replaces the local one. */
const UNUSED_LOCAL_UPLOAD_DIR = path.join(tmpdir(), 'cod-assets-unused');

/**
 * Vendure's asset server on the Garage bucket the platform already runs (D33). It registers in every role: the
 * storage strategy it configures is what the api's uploads and the worker's asset jobs both write through.
 */
export function assetServerPlugin(env: AppEnv): ReturnType<typeof AssetServerPlugin.init> {
  const s3 = configureS3AssetStorage({
    bucket: env.S3_BUCKET_PRIVATE,
    credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
    nativeS3Configuration: {
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    },
  });
  return AssetServerPlugin.init({
    route: ASSET_ROUTE,
    assetUploadDir: UNUSED_LOCAL_UPLOAD_DIR,
    namingStrategy: new TenantAssetNamingStrategy(),
    imageTransformStrategy: new PresetOnlyStrategy({ defaultPreset: DEFAULT_IMAGE_PRESET }),
    storageStrategyFactory: (options) => new PrefixedAssetStorage(s3(options), ASSET_KEY_PREFIX),
  });
}
