import { PERMISSION_CATALOG, vendurePermissionName } from '@cod/shared';
import { PLUGIN_TEST_INITIAL_DATA } from '@cod/testing';
import gql from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRbacTestEnvironment } from './rbac-test-environment';

const SNOWFLAKE_WORKER_ID = 1009;
const CATALOG_SIZE = 93;
const PERMISSION_NAME_PREFIX = /^Cod/;

const PERMISSION_ENUM = gql`
  query {
    __type(name: "Permission") {
      enumValues {
        name
      }
    }
  }
`;

const SERVER_PERMISSIONS = gql`
  query {
    globalSettings {
      serverConfig {
        permissions {
          name
          description
          assignable
        }
      }
    }
  }
`;

interface PermissionEnum {
  readonly __type: { readonly enumValues: readonly { readonly name: string }[] };
}

interface ServerPermissions {
  readonly globalSettings: {
    readonly serverConfig: {
      readonly permissions: readonly {
        readonly name: string;
        readonly description: string;
        readonly assignable: boolean;
      }[];
    };
  };
}

describe('the Permission enum', () => {
  const { server, adminClient } = createRbacTestEnvironment(SNOWFLAKE_WORKER_ID);

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    await adminClient.asSuperAdmin();
  });

  afterAll(async () => {
    await server.destroy();
  });

  it('lists the 93 catalog names and no other of ours', async () => {
    // Act
    const { __type } = await adminClient.query<PermissionEnum>(PERMISSION_ENUM);

    // Assert
    const ours = __type.enumValues.map(({ name }) => name).filter((name) => PERMISSION_NAME_PREFIX.test(name));
    expect(ours).toHaveLength(CATALOG_SIZE);
    expect([...ours].sort()).toEqual(PERMISSION_CATALOG.map(({ key }) => vendurePermissionName(key)).sort());
  });

  it('declares each name assignable, described by its English label', async () => {
    // Act
    const { globalSettings } = await adminClient.query<ServerPermissions>(SERVER_PERMISSIONS);

    // Assert
    const declared = new Map(globalSettings.serverConfig.permissions.map((entry) => [entry.name, entry]));
    for (const { key, label } of PERMISSION_CATALOG) {
      expect(declared.get(vendurePermissionName(key))).toMatchObject({ description: label.en, assignable: true });
    }
  });
});
