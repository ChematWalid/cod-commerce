import { PartitionMaintenanceService, PlatformPartitionsPlugin } from '@cod/plugin-platform-partitions';
import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import type { PermissionKey } from '@cod/shared';
import {
  createPluginTestEnvironment,
  createTwoBusinesses,
  failureOf,
  loadPluginTestDbConfig,
  withPartitionedSchemas,
  PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN,
  PLUGIN_TEST_INITIAL_DATA,
} from '@cod/testing';
import gql from 'graphql-tag';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { TemplatePlugin } from '../../template.plugin';
import { NoteMembers } from './template-note-members';
import {
  CREATE_NOTE,
  NOTE_BY_ID,
  type NoteResult,
  NOTES,
  TEST_REDIS_URL,
  testRateLimitPlugin,
} from './template-note-operations';

/** ADR 0003: our ids are positive 63-bit integers, sent as decimal strings. */
const SNOWFLAKE_ID = /^[1-9][0-9]{0,18}$/;

/** The catalogue keys the template's handlers require (`api/template-note.resolver.ts`). */
const VIEW_KEY: PermissionKey = 'catalog.products.view';
const CREATE_KEY: PermissionKey = 'catalog.products.create';

/** Every handler, with a call to it and the plugin's other permission, which must not open it. */
const HANDLERS = [
  { handler: 'templateNote', document: NOTE_BY_ID, variables: { id: '1' }, granted: CREATE_KEY },
  { handler: 'templateNotes', document: NOTES, variables: {}, granted: CREATE_KEY },
  {
    handler: 'createTemplateNote',
    document: CREATE_NOTE,
    variables: { input: { title: 'Not allowed', body: '' } },
    granted: VIEW_KEY,
  },
] as const;

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
      testRateLimitPlugin(),
      TenancyPlugin.init({ redisUrl: TEST_REDIS_URL, platformDomain: 'localhost', snowflakeWorkerId: 1005 }),
      // The catalogue permissions the handlers require, and the business roles that grant them.
      PlatformPartitionsPlugin,
      RbacPlugin,
      TemplatePlugin,
    ],
    db: loadPluginTestDbConfig(process.env),
  });
  withPartitionedSchemas(server, [ACTIVITY_LOG_SCHEMA], PartitionMaintenanceService);

  let members: NoteMembers;
  let count = 0;

  const asOwner = (): Promise<void> => members.asOwner();

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    const { a: business } = await createTwoBusinesses(adminClient);
    members = new NoteMembers(server.app, adminClient, business);
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

  it('lets a member whose built-in role holds the catalogue permission read notes', async () => {
    // Arrange
    await asOwner();
    const { createTemplateNote: own } = await adminClient.query<{ createTemplateNote: NoteResult }>(CREATE_NOTE, {
      input: { title: 'Readable by the inventory manager', body: '' },
    });
    await members.signInWith('inventory-manager', { builtIn: 'inventory-manager' });

    // Act
    const { templateNotes: listed } = await adminClient.query<{ templateNotes: NoteResult[] }>(NOTES);
    const { templateNote: byId } = await adminClient.query<{ templateNote: NoteResult | null }>(NOTE_BY_ID, {
      id: own.id,
    });

    // Assert
    expect(listed).toContainEqual(own);
    expect(byId).toEqual(own);
  });

  it('refuses a member whose built-in role lacks the catalogue permission', async () => {
    // Arrange
    await members.signInWith('order-tracker', { builtIn: 'order-tracker' });

    // Act
    const failure = await failureOf(adminClient.query(NOTES));

    // Assert
    expect(failure.codes).toEqual(['FORBIDDEN']);
  });

  // Vendure runs a handler without `@Allow` for anyone, so every handler is checked, with a role that holds
  // the plugin's other permission: a handler guarded by the wrong permission fails too.
  it.each(HANDLERS)('refuses $handler without its permission', async ({ handler, document, variables, granted }) => {
    // Arrange
    await members.signInWith(`lacks-${handler.toLowerCase()}`, { name: `Lacks ${handler}`, grants: [granted] });

    // Act
    const failure = await failureOf(adminClient.query(document, variables));

    // Assert
    expect(failure.codes).toEqual(['FORBIDDEN']);
  });

  // Every plugin copies this file: the three callers no role covers are pinned on every handler.
  describe.each([
    { caller: 'an anonymous caller', arrange: () => members.asAnonymous() },
    {
      caller: 'a member with no business role',
      arrange: () => members.signInWithoutRole(`no-role-${String(++count)}`),
    },
    { caller: 'the superadmin, who has no tenant,', arrange: () => members.asSuperadmin() },
  ])('$caller', ({ arrange }) => {
    it.each(HANDLERS)('is refused $handler on a store of the business', async ({ document, variables }) => {
      // Arrange
      await arrange();

      // Act
      const failure = await failureOf(adminClient.query(document, variables));

      // Assert
      expect(failure.codes).toEqual(['FORBIDDEN']);
    });
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
