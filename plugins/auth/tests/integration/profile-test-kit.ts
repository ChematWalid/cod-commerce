import { type AccountFlowKit, createAccountFlowKit, type TestOwner } from './account-flow-kit';
import type { Caller, GraphqlAnswer, UploadedTestFile } from './login-test-client';

const PROFILE = `query { accountProfile { firstName lastName emailAddress phone avatarUrl emailVerified } }`;
const UPDATE_PROFILE = `mutation ($input: UpdateAccountProfileInput!) {
  updateAccountProfile(input: $input) { firstName lastName emailAddress phone avatarUrl emailVerified }
}`;
const UPDATE_ACTIVE_ADMINISTRATOR = `mutation ($input: UpdateActiveAdministratorInput!) {
  updateActiveAdministrator(input: $input) { firstName lastName }
}`;
const SET_AVATAR = `mutation ($file: Upload!) { setActiveAdministratorAvatar(file: $file) { id } }`;
const CLEAR_AVATAR = `mutation { setActiveAdministratorAvatar { id } }`;
const UPLOAD_LOGO = `mutation ($file: Upload!) { uploadBusinessLogo(file: $file) { assetId } }`;

/** The account kit plus the profile and logo operations of Task 8. */
export interface ProfileTestKit extends AccountFlowKit {
  readonly profile: (caller: Caller) => Promise<GraphqlAnswer>;
  readonly updateProfile: (caller: Caller, input: Record<string, unknown>) => Promise<GraphqlAnswer>;
  /** The stock profile page's save, which the plugin shadows (D38). */
  readonly updateActiveAdministrator: (caller: Caller, input: Record<string, unknown>) => Promise<GraphqlAnswer>;
  readonly setAvatar: (caller: Caller, file: UploadedTestFile) => Promise<GraphqlAnswer>;
  readonly clearAvatar: (caller: Caller) => Promise<GraphqlAnswer>;
  readonly uploadLogo: (caller: Caller, file: UploadedTestFile) => Promise<GraphqlAnswer>;
  /** The owner's session on the channel of their own store, which is where tenant-scoped calls are made. */
  readonly onStore: (owner: TestOwner) => Promise<Caller>;
}

/** Builds the {@link ProfileTestKit} of a test file; its server serves assets. */
export function createProfileTestKit(): ProfileTestKit {
  const kit = createAccountFlowKit({ assets: true });
  const { client } = kit;

  async function onStore(owner: TestOwner): Promise<Caller> {
    const [row] = await kit.sql<{ token: string }>(
      `SELECT c."token" FROM "channel" c
       JOIN "store" s ON s."channelId" = c."id"
       JOIN "administrator" a ON a."customFieldsBusinessid" = s."businessId"::text
       WHERE a."emailAddress" = $1`,
      [owner.email],
    );
    return { ...owner.session, channelToken: row?.token ?? '' };
  }

  return {
    ...kit,
    onStore,
    profile: (caller) => client.graphql(PROFILE, {}, caller),
    updateProfile: (caller, input) => client.graphql(UPDATE_PROFILE, { input }, caller),
    updateActiveAdministrator: (caller, input) => client.graphql(UPDATE_ACTIVE_ADMINISTRATOR, { input }, caller),
    setAvatar: (caller, file) => client.upload(SET_AVATAR, file, caller),
    clearAvatar: (caller) => client.graphql(CLEAR_AVATAR, {}, caller),
    uploadLogo: (caller, file) => client.upload(UPLOAD_LOGO, file, caller),
  };
}
