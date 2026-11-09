import { classifySubdomain, type SubdomainAvailability } from '@cod/shared';
import { SubdomainTakenError } from '../domain/errors';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreAdminPorts } from './store-admin-ports';

/** Tells whether a store could use a subdomain. */
export class CheckSubdomainService {
  constructor(private readonly ports: StoreAdminPorts) {}

  /** Classifies `raw`; a well-formed name is `taken` while any store holds it, archived ones included (D4). */
  async check(ctx: OperationContext, raw: string): Promise<SubdomainAvailability> {
    const classified = classifySubdomain(raw);
    if (classified.status !== 'available') return classified;
    const taken = await this.ports.platform.isSubdomainTaken(ctx, classified.subdomain);
    return taken ? { ...classified, status: 'taken', reason: new SubdomainTakenError().message, reasonCode: 'taken' } : classified;
  }
}
