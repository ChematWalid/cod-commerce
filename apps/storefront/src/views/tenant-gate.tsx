import type { ReactNode } from 'react';
import type { TenantRouteParams } from '../tenancy/verified-tenant';
import { requireTenant } from './require-tenant';

export interface TenantGateProps {
  readonly children: ReactNode;
  readonly params: Promise<TenantRouteParams>;
}

/** Renders the store's pages only when the path's host binding is the store's own (#209). */
export async function TenantGate({ children, params }: TenantGateProps): Promise<ReactNode> {
  const tenant = await requireTenant(await params);
  return tenant === null ? null : children;
}
