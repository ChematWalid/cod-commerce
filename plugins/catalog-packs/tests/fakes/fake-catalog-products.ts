import type { ComponentProduct } from '../../domain/component-product';
import type { CatalogProductsPort, PackSaveLock, PackWrite } from '../../domain/ports/catalog-products.port';
import type { OperationContext } from '../../domain/ports/operation-context';
import type { StoreScope } from '../../domain/store-scope';

const keyOf = (scope: StoreScope): string => `${scope.businessId}:${scope.storeId}`;

/** {@link CatalogProductsPort} on a map of products per store; a pack write updates the stored pack product. */
export class FakeCatalogProducts implements CatalogProductsPort {
  private readonly products = new Map<string, Map<string, ComponentProduct>>();
  readonly writes: PackWrite[] = [];
  readonly saveLocks: PackSaveLock[] = [];
  /** Runs once the save locks are "granted", standing in for a component write that committed before them. */
  onLockForSave: () => void = () => undefined;

  put(scope: StoreScope, ...products: readonly ComponentProduct[]): void {
    const store = this.products.get(keyOf(scope)) ?? new Map<string, ComponentProduct>();
    for (const product of products) store.set(product.id, product);
    this.products.set(keyOf(scope), store);
  }

  remove(scope: StoreScope, productId: string): void {
    this.products.get(keyOf(scope))?.delete(productId);
  }

  get(scope: StoreScope, productId: string): ComponentProduct | undefined {
    return this.products.get(keyOf(scope))?.get(productId);
  }

  byId(_ctx: OperationContext, scope: StoreScope, productId: string): Promise<ComponentProduct | undefined> {
    return Promise.resolve(this.get(scope, productId));
  }

  lockForSave(_ctx: OperationContext, _scope: StoreScope, lock: PackSaveLock): Promise<void> {
    this.saveLocks.push(lock);
    this.onLockForSave();
    return Promise.resolve();
  }

  writePackValues(_ctx: OperationContext, scope: StoreScope, values: PackWrite): Promise<void> {
    this.writes.push(values);
    const product = this.get(scope, values.productId);
    if (product === undefined) return Promise.resolve();
    this.put(scope, { ...product, ...writtenShape(product, values) });
    return Promise.resolve();
  }
}

/** The price, weight and matrix catalog stores for a pack write (`WritePackValuesService`'s outcome). */
function writtenShape(product: ComponentProduct, values: PackWrite): Partial<ComponentProduct> {
  const { sharedOption } = values;
  if (sharedOption === null) {
    return {
      price: values.price,
      weight: values.weight,
      optionGroups: [],
      variants: [{ id: product.variants[0]?.id ?? `${product.id}01`, price: values.price, optionValues: [] }],
    };
  }
  return {
    price: values.price,
    weight: values.weight,
    optionGroups: [{ name: sharedOption.name, values: sharedOption.values.map((entry) => entry.value) }],
    variants: sharedOption.values.map((entry, index) => ({
      id: `${product.id}${String(index + 1).padStart(2, '0')}`,
      price: entry.price,
      optionValues: [entry.value],
    })),
  };
}
