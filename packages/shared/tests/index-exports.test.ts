import { describe, expect, it } from 'vitest';

const RUNTIME_EXPORTS = [
  'WILAYA_COUNT',
  'WILAYA_CODES',
  'WILAYAS',
  'isWilayaCode',
  'ORDER_STATUSES',
  'TRACKING_STATUSES',
  'DOMAIN_EVENT_NAMES',
  'FEATURE_KEYS',
  'MAX_BUSINESS_ID',
  'toBusinessId',
  'InvalidBusinessIdError',
  'DomainError',
  'registerFeatureGate',
  'requireFeature',
  'FeatureGateAlreadyRegisteredError',
  'MONEY_PRECISION',
  'PLATFORM_CURRENCY_CODE',
  'PLATFORM_LANGUAGE_CODES',
  'isPlatformLanguageCode',
  'InvalidDatabaseUrlError',
  'toPostgresFields',
  'STORE_CACHE_TAG_PREFIX',
  'storeCacheTag',
  'SnowflakeGenerator',
  'toSnowflake',
  'toStoreId',
  'classifySubdomain',
  'formatOrderNumber',
  'normalizeHost',
  'subdomainOfHost',
  'hostOfSubdomain',
] as const;

describe('@cod/shared entry point', () => {
  it('exports every runtime contract', async () => {
    const exported = Object.keys(await import('../src/index.js'));

    expect(exported).toEqual(expect.arrayContaining([...RUNTIME_EXPORTS]));
  });
});
