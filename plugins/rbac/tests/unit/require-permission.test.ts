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
