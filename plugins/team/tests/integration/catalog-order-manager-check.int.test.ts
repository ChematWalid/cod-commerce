import { AuthPlugin } from '@cod/plugin-auth';
import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { CATALOG_ERROR_CODES } from '@cod/shared';
import { createTwoBusinesses, failureOf, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import gql from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authTestOptions, createTeamTestEnvironment, TeamKit } from './team-kit';

const SNOWFLAKE_WORKER_ID = 1018;
const { server, adminClient } = createTeamTestEnvironment(SNOWFLAKE_WORKER_ID, {
  plugins: [RbacPlugin, AuthPlugin.init(authTestOptions())],
  partitionedSchemas: [ACTIVITY_LOG_SCHEMA],
});

const CREATE_PRODUCT = gql`
  mutation ($input: CreateCatalogProductInput!) {
    createCatalogProduct(input: $input) {
      product {
        id
        settings {
          orderManagerIds
        }
      }
    }
  }
`;

let businesses: TwoBusinesses;
let kit: TeamKit;

beforeAll(async () => {
  await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
  businesses = await createTwoBusinesses(adminClient);
  kit = new TeamKit(server.app, adminClient);
});

afterAll(async () => {
  await server.destroy();
});

/** A product naming `orderManagerIds`, created by the client's caller in its active store. */
function productNaming(orderManagerIds: readonly string[]) {
  const settings = {
    isFragile: false,
    allowParcelOpening: false,
    allowOutOfStockOrders: true,
    soldOut: false,
    quantityRules: { enabled: false, min: 1, step: 1 },
    orderManagerIds,
  };
  return kit.client.query<{ createCatalogProduct: { product: { settings: { orderManagerIds: string[] } } } }>(
    CREATE_PRODUCT,
    { input: { title: 'Managed', status: 'active', price: 100, settings } },
  );
}

describe("team's order-manager check for catalog products (D2114, D2137)", () => {
  it("saves a member whose store access covers the product's store", async () => {
    // Arrange
    const { a } = businesses;
    const member = await kit.teamMemberWith(a, await kit.builtInRoleId(a, 'order-tracker'));
    await kit.signIn(a.owner, a.stores[0]);

    // Act
    const { createCatalogProduct } = await productNaming([member.memberId]);

    // Assert
    expect(createCatalogProduct.product.settings.orderManagerIds).toEqual([member.memberId]);
  });

  it('refuses an order manager of another business', async () => {
    // Arrange
    const { a, b } = businesses;
    const ofB = await kit.teamMemberWith(b, await kit.builtInRoleId(b, 'order-tracker'));
    await kit.signIn(a.owner, a.stores[0]);

    // Act
    const failure = await failureOf(productNaming([ofB.memberId]));

    // Assert
    expect(failure.codes).toEqual([CATALOG_ERROR_CODES.ORDER_MANAGER_UNKNOWN]);
  });

  it("refuses an order manager of the business without access to the product's store", async () => {
    // Arrange
    const { a } = businesses;
    const [first, second] = a.stores;
    const member = await kit.teamMemberWith(a, await kit.builtInRoleId(a, 'order-tracker'), [second]);
    await kit.signIn(a.owner, first);

    // Act
    const refused = await failureOf(productNaming([member.memberId]));
    await kit.signIn(a.owner, second);
    const accepted = await productNaming([member.memberId]);

    // Assert
    expect(refused.codes).toEqual([CATALOG_ERROR_CODES.ORDER_MANAGER_UNKNOWN]);
    expect(accepted.createCatalogProduct.product.settings.orderManagerIds).toEqual([member.memberId]);
  });
});
