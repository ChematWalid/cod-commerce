import { describe, expect, it } from 'vitest';
import { OrderManagerCheckRegistry } from '../../application/order-manager-check.registry';
import { FakeOrderManagerCheck } from '../fakes/fake-order-manager-check';

describe('OrderManagerCheckRegistry', () => {
  it('has no check before team registers one', () => {
    // Arrange
    const registry = new OrderManagerCheckRegistry();

    // Act
    const check = registry.current();

    // Assert
    expect(check).toBeUndefined();
  });

  it('answers with the registered check', () => {
    // Arrange
    const registry = new OrderManagerCheckRegistry();
    const check = new FakeOrderManagerCheck(new Map());

    // Act
    registry.register(check);

    // Assert
    expect(registry.current()).toBe(check);
  });

  it('refuses a second check rather than silently replacing the first', () => {
    // Arrange
    const registry = new OrderManagerCheckRegistry();
    registry.register(new FakeOrderManagerCheck(new Map()));

    // Act
    const registering = () => {
      registry.register(new FakeOrderManagerCheck(new Map()));
    };

    // Assert
    expect(registering).toThrow(/already registered/);
  });
});
