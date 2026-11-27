import { PluginCommonModule, VendurePlugin } from '@vendure/core';

/**
 * Stands in for the internal-only middleware (D111), which plugin tests do not register: the store id of this header
 * becomes the signed one on `/store`. Production never trusts a header; the signed path is covered by the server's
 * e2e suite (Task 10).
 */
export const SIGNED_STORE_TEST_HEADER = 'x-test-signed-store';

/** The part of an Express request the stand-in reads and writes. */
interface SignedRequest {
  header(name: string): string | undefined;
  internalAuth?: unknown;
}

const signAsTest = (req: SignedRequest, _res: unknown, next: () => void): void => {
  const storeId = req.header(SIGNED_STORE_TEST_HEADER);
  if (storeId !== undefined) req.internalAuth = { kid: 'test', storeId };
  next();
};

@VendurePlugin({
  imports: [PluginCommonModule],
  configuration: (config) => {
    config.apiOptions.middleware.push({ route: 'store', handler: signAsTest });
    return config;
  },
})
// A Vendure plugin is a decorated class; this one only registers the stand-in.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class SignedStoreTestPlugin {}
