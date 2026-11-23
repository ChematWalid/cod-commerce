import type { Metadata } from 'next';
import { type ReactNode, Suspense } from 'react';
import { productPageMetadata, tenantMetadata } from '../../../../../../../src/seo/metadata';
import { ProductContent, type ProductRouteParams } from '../../../../../../../src/views/product-page';

interface ProductPageProps {
  readonly params: Promise<ProductRouteParams>;
}

export function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  return tenantMetadata(params, (tenant, route) => productPageMetadata(tenant, route.slug));
}

/** A product page: gallery, variant picker, the in-page checkout shell (P3.S3). It never reads the query string. */
export default function ProductPage({ params }: ProductPageProps): ReactNode {
  return (
    <Suspense fallback={null}>
      <ProductContent params={params} />
    </Suspense>
  );
}
