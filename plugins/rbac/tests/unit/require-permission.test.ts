import { TenantGuard } from '@cod/plugin-tenancy';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { requirePermission } from '../../api/require-permission.decorator';

class Parent {
  inheritedHandler(): boolean {
    return true;
  }
}

class Grandchild extends Parent {}

class EmptyParent {
  readonly marker = true;
}

describe('requirePermission on a class', () => {
  it('refuses a class inheriting a method from its parent', () => {
    // Arrange
    class Child extends Parent {}

    // Act and assert
    expect(() => {
      requirePermission('orders.view')(Child);
    }).toThrow(/inheritedHandler/);
  });

  it('refuses a method inherited from further up the chain', () => {
    // Arrange
    class Child extends Grandchild {}

    // Act and assert
    expect(() => {
      requirePermission('orders.view')(Child);
    }).toThrow(/inheritedHandler/);
  });

  it('accepts a parent with no method', () => {
    // Arrange
    class Child extends EmptyParent {
      own(): boolean {
        return true;
      }
    }

    // Act and assert
    expect(() => {
      requirePermission('orders.view')(Child);
    }).not.toThrow();
  });
});

/** ADR 0002 addendum (TEN-3): the status checks run only where `TenantGuard` runs, so the decorator must add it. */
describe('requirePermission tenant scope', () => {
  const guardsOf = (target: object): unknown => Reflect.getMetadata(GUARDS_METADATA, target);

  it('adds the tenant guard to a decorated method', () => {
    // Arrange
    class Handlers {
      list(): boolean {
        return true;
      }
    }
    const descriptor = Object.getOwnPropertyDescriptor(Handlers.prototype, 'list') as PropertyDescriptor;

    // Act
    requirePermission('orders.view')(Handlers.prototype, 'list', descriptor);

    // Assert
    expect(guardsOf(descriptor.value as object)).toEqual([TenantGuard]);
  });

  it('adds the tenant guard to a decorated class', () => {
    // Arrange
    class Handlers {
      list(): boolean {
        return true;
      }
    }

    // Act
    requirePermission('orders.view')(Handlers);

    // Assert
    expect(guardsOf(Handlers)).toEqual([TenantGuard]);
  });
});
