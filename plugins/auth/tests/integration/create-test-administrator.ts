import gql from 'graphql-tag';
import type { createAuthTestEnvironment } from './auth-test-environment';

type AdminClient = ReturnType<typeof createAuthTestEnvironment>['adminClient'];

const ROLES = gql`
  query {
    roles {
      items {
        id
        code
      }
    }
  }
`;

const CREATE_ADMINISTRATOR = gql`
  mutation ($input: CreateAdministratorInput!) {
    createAdministrator(input: $input) {
      id
    }
  }
`;

const SUPER_ADMIN_ROLE_CODE = '__super_admin_role__';

interface RolesAnswer {
  readonly roles: { readonly items: readonly { readonly id: string; readonly code: string }[] };
}

/** An administrator who can sign in with `password`. The role is irrelevant to the behaviour under test. */
export async function createTestAdministrator(
  adminClient: AdminClient,
  emailAddress: string,
  password: string,
): Promise<void> {
  await adminClient.asSuperAdmin();
  const { roles } = await adminClient.query<RolesAnswer>(ROLES);
  const role = roles.items.find((item) => item.code === SUPER_ADMIN_ROLE_CODE);
  await adminClient.query(CREATE_ADMINISTRATOR, {
    input: { firstName: 'Test', lastName: 'Owner', emailAddress, password, roleIds: [role?.id] },
  });
}
