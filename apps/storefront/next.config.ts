import { join } from 'node:path';
import type { NextConfig } from 'next';
import { requireDeploymentId } from './cache/cache-config';

/** The compiled cache handlers (`pnpm build:cache`, run before dev and build). */
const CACHE_DIST = join(__dirname, 'cache', 'dist');

/** The CDN prefix of the static files, when one is configured (read at build and at start). */
const ASSET_PREFIX = process.env['STOREFRONT_ASSET_PREFIX']?.trim() ?? '';

// next start evaluates this file again: NEXT_DEPLOYMENT_ID must be the same at build and at start.
const nextConfig: NextConfig = {
  deploymentId: requireDeploymentId(process.env),
  // The build id is the deployment id, so the cache keys, the assets and the build id name one deployment.
  generateBuildId: () => requireDeploymentId(process.env),
  ...(ASSET_PREFIX !== '' && { assetPrefix: ASSET_PREFIX }),
  // Images go through the asset server's named presets, never Next's optimiser (D3209).
  images: { loader: 'custom', loaderFile: './src/images/loader.ts' },
  output: 'standalone',
  cacheComponents: true,
  // The pairing create-next-app 16.4.5 sets and spike F ran with; without it next build warns.
  partialPrefetching: true,
  cacheHandler: join(CACHE_DIST, 'isr-cache-handler.js'),
  cacheHandlers: {
    default: join(CACHE_DIST, 'use-cache-handler.js'),
    remote: join(CACHE_DIST, 'use-cache-handler.js'),
  },
  // Valkey is the only cache tier, shared by every instance.
  cacheMaxMemorySize: 0,
  transpilePackages: ['@cod/shared'],
};

export default nextConfig;
