import { toBusinessId } from '@cod/shared';
import { type Business, newBusiness } from '../domain/business';
import { assertValidName } from '../domain/name';
import type { OperationContext } from '../domain/ports/operation-context';
import type { CreateStoreInput, Store } from '../domain/store';
import type { CreateStoreService } from './create-store.service';
import type { TenancyPorts } from './tenancy-ports';

/** The first administrator of a business. `password` is handed to the commerce engine and goes nowhere else. */
export interface BusinessOwnerInput {
  readonly emailAddress: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly password: string;
}

/** A request to start a business with its first store. */
export interface ProvisionBusinessCommand {
  readonly name: string;
  readonly owner: BusinessOwnerInput;
  readonly store: CreateStoreInput;
}

/** What provisioning made. */
export interface ProvisionedBusiness {
  readonly business: Business;
  readonly store: Store;
  readonly administratorId: number;
}

/** Starts a business: the one path every sign-up, seed and test goes through (D5). */
export class ProvisionBusinessService {
  constructor(
    private readonly ports: TenancyPorts,
    private readonly stores: CreateStoreService,
  ) {}

  /**
   * Creates the seller, business, sequence, Owner role, first store and administrator in one transaction.
   *
   * @throws what {@link CreateStoreService.create} throws, before anything is written when the input is invalid.
   */
  async provision(ctx: OperationContext, command: ProvisionBusinessCommand): Promise<ProvisionedBusiness> {
    assertValidName(command.name);
    await this.stores.assertCreatable(ctx, command.store);
    return this.ports.transaction.run(ctx, (transactional) => this.provisionIn(transactional, command));
  }

  private async provisionIn(ctx: OperationContext, command: ProvisionBusinessCommand): Promise<ProvisionedBusiness> {
    const sellerId = await this.ports.channels.createSeller(ctx, command.name);
    const business = newBusiness({ id: this.ports.ids.next(), name: command.name, sellerId, now: this.ports.clock() });
    await this.ports.platform.saveBusiness(ctx, business);
    await this.ports.platform.createOrderSequence(ctx, business.id);
    // Saved before the store: CreateStoreService reads it to put the role on the new channel.
    const ownerRoleId = await this.ports.channels.createOwnerRole(ctx, business.id);
    await this.ports.platform.updateBusinessOwner(ctx, business.id, { ownerRoleId });
    const store = await this.stores.create(ctx, business.id, command.store);
    const administratorId = await this.ports.channels.createAdministrator(ctx, {
      ...command.owner,
      roleId: ownerRoleId,
      businessId: business.id,
    });
    await this.ports.platform.updateBusinessOwner(ctx, business.id, { ownerAdministratorId: administratorId });
    await this.ports.lifecycle.businessProvisioned(ctx, {
      businessId: toBusinessId(business.id),
      ownerRoleId,
      ownerAdministratorId: administratorId,
    });
    return {
      business: { ...business, ownerRoleId, ownerAdministratorId: administratorId },
      store,
      administratorId,
    };
  }
}
