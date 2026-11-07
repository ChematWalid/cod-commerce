import { createTestEnvironment } from '@vendure/testing';
import gql from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildE2eConfig, E2E_INITIAL_DATA, e2eBullPrefix, e2eEnv, removeBullKeys } from './support/e2e-config';
import { E2E_PORTS } from './support/ports';

const SUITE = 'smoke';
const PORT = E2E_PORTS.smoke;
const VARIANT_PRICE = 2500;

const SERVER_CONFIG = gql`
  query {
    globalSettings {
      serverConfig {
        moneyStrategyPrecision
      }
    }
  }
`;

const CREATE_PRODUCT = gql`
  mutation {
    createProduct(
      input: { translations: [{ languageCode: en, name: "Smoke product", slug: "smoke-product", description: "" }] }
    ) {
      id
    }
  }
`;

const CREATE_VARIANT = gql`
  mutation ($productId: ID!, $price: Money!) {
    createProductVariants(
      input: [
        {
          productId: $productId
          sku: "SMOKE-1"
          price: $price
          translations: [{ languageCode: en, name: "Smoke variant" }]
        }
      ]
    ) {
      id
    }
  }
`;

const VARIANT_PRICE_QUERY = gql`
  query ($id: ID!) {
    productVariant(id: $id) {
      price
    }
  }
`;

describe('smoke', () => {
  const env = e2eEnv();
  const { server, adminClient } = createTestEnvironment(buildE2eConfig({}, { suite: SUITE, port: PORT }));

  beforeAll(async () => {
    await server.init({ initialData: E2E_INITIAL_DATA, customerCount: 0 });
    await adminClient.asUserWithCredentials(env.SUPERADMIN_USERNAME, env.SUPERADMIN_PASSWORD);
  });

  afterAll(async () => {
    await server.destroy();
    await removeBullKeys(e2eBullPrefix(SUITE));
  });

  it('boots the composed config on postgres and serves the admin api', async () => {
    const config = await adminClient.query<{ globalSettings: { serverConfig: { moneyStrategyPrecision: number } } }>(
      SERVER_CONFIG,
    );
    const { createProduct } = await adminClient.query<{ createProduct: { id: string } }>(CREATE_PRODUCT);
    const { createProductVariants } = await adminClient.query<{ createProductVariants: { id: string }[] }>(
      CREATE_VARIANT,
      { productId: createProduct.id, price: VARIANT_PRICE },
    );
    const [variant] = createProductVariants;
    const readBack = await adminClient.query<{ productVariant: { price: number } }>(VARIANT_PRICE_QUERY, {
      id: variant?.id,
    });
    const livez = await fetch(`http://localhost:${String(PORT)}/livez`);

    expect(config.globalSettings.serverConfig.moneyStrategyPrecision).toBe(0);
    expect(readBack.productVariant.price).toBe(VARIANT_PRICE);
    expect(livez.status).toBe(200);
  });
});
