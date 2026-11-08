import { storeCacheTag } from '@cod/shared';
import { cacheTag } from 'next/cache';
import { notFound } from 'next/navigation';
import { type ReactNode, Suspense } from 'react';
import { StoreDocumentLang } from '../../../../src/i18n/store-document-lang';
import { toStoreLocale } from '../../../../src/tenancy/store-locale';
import { PRERENDER_SENTINEL_STORE_ID } from '../../../../src/tenancy/store-resolver';
import { storeResolver } from '../../../../src/tenancy/store-resolver-instance';

interface TenantPageParams {
  readonly storeId: string;
  readonly locale: string;
}

interface TenantPageProps {
  readonly params: Promise<TenantPageParams>;
}

interface StoreNameProps {
  readonly storeId: string;
}

/** Next requires at least one entry; real stores are rendered on demand and cached by tag. */
export function generateStaticParams(): TenantPageParams[] {
  return [{ storeId: PRERENDER_SENTINEL_STORE_ID, locale: 'ar' }];
}

// Cached per store and tagged, so a store publish revalidates exactly its own entries (ADR 0006).
async function StoreName({ storeId }: StoreNameProps): Promise<ReactNode> {
  'use cache';
  // The build has no API to call. Rendering nothing also keeps this entry out of the not-found path.
  if (storeId === PRERENDER_SENTINEL_STORE_ID) return null;
  cacheTag(storeCacheTag(storeId));
  const store = await storeResolver.findById(storeId);
  if (!store) notFound();
  return <h1 data-testid="store-name">{store.name}</h1>;
}

// params is awaited inside the Suspense boundary: awaiting it at the top of the page fails the build.
async function StoreGreeting({ params }: TenantPageProps): Promise<ReactNode> {
  const { storeId, locale } = await params;
  return (
    <>
      <StoreDocumentLang locale={toStoreLocale(locale)} />
      <StoreName storeId={storeId} />
    </>
  );
}

/** A store's hello page, reached only through the proxy's rewrite to `/_t/{storeId}/{locale}`. */
export default function TenantPage({ params }: TenantPageProps): ReactNode {
  return (
    <main className="stub-page">
      <Suspense fallback={null}>
        <StoreGreeting params={params} />
      </Suspense>
    </main>
  );
}
