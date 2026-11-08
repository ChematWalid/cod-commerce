import { join } from 'node:path';
import type { NextConfig } from 'next';
import { requireDeploymentId } from './cache/cache-config';

/** The compiled cache handlers (`pnpm build:cache`, run before dev and build). */
const CACHE_DIST = join(__dirname, 'cache', 'dist');

// next start evaluates this file again: NEXT_DEPLOYMENT_ID must be the same at build and at start.
const nextConfig: NextConfig = {
  deploymentId: requireDeploymentId(process.env),
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
