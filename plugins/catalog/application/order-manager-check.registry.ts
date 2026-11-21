import type {
  OrderManagerCheck,
  OrderManagerCheckRegistrar,
  OrderManagerCheckSource,
} from '../domain/ports/order-manager-check.port';

/**
 * Holds the one order-manager check team registers on bootstrap (D2114; precedent tenancy's lifecycle registrar).
 * Until then {@link current} answers `undefined` and a non-empty order-manager list is refused.
 */
export class OrderManagerCheckRegistry implements OrderManagerCheckRegistrar, OrderManagerCheckSource {
  private check: OrderManagerCheck | undefined;

  register(check: OrderManagerCheck): void {
    if (this.check !== undefined) throw new Error('An order manager check is already registered');
    this.check = check;
  }

  current(): OrderManagerCheck | undefined {
    return this.check;
  }
}
