import type { FactoryProvider, Provider } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { PRODUCT_PORTS } from '../../application/tokens';
import { PORT_TOKEN_OF, PRODUCT_PROVIDERS } from '../../infrastructure/product.providers';

/** The provider that builds the port bundle from the injected adapters. */
function bundleProvider(providers: readonly Provider[]): FactoryProvider {
  const found = providers.find(
    (provider): provider is FactoryProvider =>
      typeof provider === 'object' && 'provide' in provider && provider.provide === PRODUCT_PORTS,
  );
  if (found === undefined) throw new Error('no PRODUCT_PORTS provider');
  return found;
}

describe('PRODUCT_PORTS wiring', () => {
  it('puts the adapter of each token on the bundle key that token is declared for', () => {
    // Arrange
    const provider = bundleProvider(PRODUCT_PROVIDERS);
    const inject = (provider.inject ?? []) as readonly symbol[];
    const stubOf = (token: symbol) => ({ stubFor: token });

    // Act
    const ports = provider.useFactory(...inject.map(stubOf)) as Record<string, unknown>;

    // Assert
    expect(Object.keys(ports).sort()).toEqual(Object.keys(PORT_TOKEN_OF).sort());
    for (const [key, token] of Object.entries(PORT_TOKEN_OF)) expect(ports[key]).toEqual(stubOf(token));
  });

  it('injects every port token once', () => {
    // Arrange
    const provider = bundleProvider(PRODUCT_PROVIDERS);

    // Act
    const inject = (provider.inject ?? []) as readonly symbol[];

    // Assert
    expect(new Set(inject).size).toBe(inject.length);
    expect([...inject].sort((a, b) => String(a).localeCompare(String(b)))).toEqual(
      Object.values(PORT_TOKEN_OF).sort((a, b) => String(a).localeCompare(String(b))),
    );
  });
});
