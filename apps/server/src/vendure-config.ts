import type { VendureConfig } from '@vendure/core';
import { loadEnv } from './config/env';
import { buildVendureConfig } from './config/vendure-config';

/**
 * The api's config as one exported value, for the dashboard's Vite plugin only: it scans this file to find
 * the plugins with dashboard extensions and to introspect the Admin API schema. The server entry points
 * build their own config per role.
 */
export const config: VendureConfig = buildVendureConfig(loadEnv(), 'api');
