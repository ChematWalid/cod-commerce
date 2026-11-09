import { TenancyPlugin } from '@cod/plugin-tenancy';
import {
  type BusinessFixture,
  createMember,
  createPluginTestEnvironment,
  createTwoBusinesses,
  failureOf,
  loadPluginTestDbConfig,
  PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN,
  PLUGIN_TEST_INITIAL_DATA,
} from '@cod/testing';
import gql from 'graphql-tag';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { TemplatePlugin } from '../../template.plugin';
import { CREATE_NOTE, NOTE_BY_ID, type NoteResult, NOTES, TEST_REDIS_URL } from './template-note-operations';

/** ADR 0003: our ids are positive 63-bit integers, sent as decimal strings. */
const SNOWFLAKE_ID = /^[1-9][0-9]{0,18}$/;

const CREATE_NOTE_INPUT_FIELDS = gql`
  query {
    __type(name: "CreateTemplateNoteInput") {
      inputFields {
        name
      }
    }
  }
`;

describe('TemplateNote Admin API', () => {
  const { server, adminClient } = createPluginTestEnvironment({
    plugins: [
      TenancyPlugin.init({ redisUrl: TEST_REDIS_URL, platformDomain: 'localhost', snowflakeWorkerId: 1005 }),
      TemplatePlugin,
    ],
    db: loadPluginTestDbConfig(process.env),
  });

  let business: BusinessFixture;

  async function asOwner(): Promise<void> {
    adminClient.setChannelToken(business.stores[0].channelToken);
    await adminClient.asUserWithCredentials(business.owner.email, business.owner.password);
  }

  /** Signs in as a new member of the business whose only role grants `permissions` on its first store. */
  async function signInWith(code: string, permissions: readonly string[]): Promise<void> {
    const [store] = business.stores;
    const member = await createMember(server.app, adminClient, { code, business, store, permissions });
    adminClient.setChannelToken(store.channelToken);
    await adminClient.asUserWithCredentials(member.email, member.password);
  }

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    ({ a: business } = await createTwoBusinesses(adminClient));
  });

  afterEach(async () => {
    adminClient.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
    await adminClient.asSuperAdmin();
  });

  afterAll(async () => {
    await server.destroy();
  });

  it('creates and reads a note through the Admin API', async () => {
    // Arrange
    await asOwner();

    // Act
    const { createTemplateNote: created } = await adminClient.query<{ createTemplateNote: NoteResult }>(CREATE_NOTE, {
      input: { title: '  Call supplier  ', body: 'About the late order' },
    });
    const { templateNote: byId } = await adminClient.query<{ templateNote: NoteResult | null }>(NOTE_BY_ID, {
      id: created.id,
    });
    const { templateNotes: listed } = await adminClient.query<{ templateNotes: NoteResult[] }>(NOTES, { take: 5 });

    // Assert
    expect(created.id).toMatch(SNOWFLAKE_ID);
    expect(created).toMatchObject({ title: 'Call supplier', body: 'About the late order' });
    expect(byId).toEqual(created);
    expect(listed).toContainEqual(created);
  });

  it('rejects an empty title with a typed error', async () => {
    // Arrange
    await asOwner();

    // Act
    const failure = await failureOf(adminClient.query(CREATE_NOTE, { input: { title: '   ', body: '' } }));

    // Assert
    expect(failure).toEqual({ codes: ['TEMPLATE_NOTE_INVALID_TITLE'], data: null });
  });

  it('requires the ReadTemplateNote permission', async () => {
    // Arrange
    await asOwner();
    const { createTemplateNote: own } = await adminClient.query<{ createTemplateNote: NoteResult }>(CREATE_NOTE, {
      input: { title: 'Readable by a note reader', body: '' },
    });
    await signInWith('catalog-reader', ['ReadCatalog']);

    // Act
    const failure = await failureOf(adminClient.query(NOTES));
    await signInWith('note-reader', ['ReadTemplateNote']);
    const allowed = await adminClient.query<{ templateNote: NoteResult | null }>(NOTE_BY_ID, { id: own.id });

    // Assert
    expect(failure.codes).toEqual(['FORBIDDEN']);
    expect(allowed.templateNote).toEqual(own);
  });

  // Vendure runs a handler without `@Allow` for anyone, so every handler is checked, with a role that holds
  // the plugin's other permission: a handler guarded by the wrong permission fails too.
  it.each([
    { handler: 'templateNote', document: NOTE_BY_ID, variables: { id: '1' }, granted: 'CreateTemplateNote' },
    { handler: 'templateNotes', document: NOTES, variables: {}, granted: 'CreateTemplateNote' },
    {
      handler: 'createTemplateNote',
      document: CREATE_NOTE,
      variables: { input: { title: 'Not allowed', body: '' } },
      granted: 'ReadTemplateNote',
    },
  ])('refuses $handler without its permission', async ({ handler, document, variables, granted }) => {
    // Arrange
    await signInWith(`lacks-${handler.toLowerCase()}`, [granted]);

    // Act
    const failure = await failureOf(adminClient.query(document, variables));

    // Assert
    expect(failure.codes).toEqual(['FORBIDDEN']);
  });

  it('has no businessId input', async () => {
    // Arrange
    await adminClient.asSuperAdmin();

    // Act
    const { __type: inputType } = await adminClient.query<{ __type: { inputFields: { name: string }[] } }>(
      CREATE_NOTE_INPUT_FIELDS,
    );

    // Assert
    expect(inputType.inputFields.map((field) => field.name).sort()).toEqual(['body', 'title']);
  });
});
