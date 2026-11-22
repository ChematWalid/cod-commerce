import type { ReactNode } from 'react';
import { NotFoundContent } from '../../../src/i18n/not-found-content';

/**
 * The not-found UI of a tenant path: a crafted path whose host binding fails, an unknown slug. Under Cache Components
 * it streams with status 200 (a soft 404, D3202), so it tells crawlers not to index it.
 */
export default function TenantNotFound(): ReactNode {
  return (
    <>
      <meta name="robots" content="noindex" />
      <NotFoundContent />
    </>
  );
}
