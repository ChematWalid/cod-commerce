import { createPluginTestEnvironment, loadPluginTestDbConfig, PLUGIN_TEST_INITIAL_DATA } from '@cod/testing';
import gql from 'graphql-tag';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { TemplatePlugin } from '../../template.plugin';
import { failureOf } from './graphql-outcome';

/** ADR 0003: our ids are positive 63-bit integers, sent as decimal strings. */
const SNOWFLAKE_ID = /^[1-9][0-9]{0,18}$/;
const MEMBER_PASSWORD = 'member-password';

interface NoteResult {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly createdAt: string;
}

const NOTE_FIELDS = 'id title body createdAt';

const CREATE_NOTE = gql`
  mutation ($input: CreateTemplateNoteInput!) {
    createTemplateNote(input: $input) { ${NOTE_FIELDS} }
  }
`;

const NOTE_BY_ID = gql`
  query ($id: String!) {
    templateNote(id: $id) { ${NOTE_FIELDS} }
  }
`;

const NOTES = gql`
  query ($take: Int) {
    templateNotes(take: $take) { ${NOTE_FIELDS} }
  }
`;

const CREATE_NOTE_INPUT_FIELDS = gql`
  query {
    __type(name: "CreateTemplateNoteInput") {
      inputFields {
        name
      }
    }
  }
`;

const CREATE_ROLE = gql`
  mutation ($input: CreateRoleInput!) {
    createRole(input: $input) {
      id
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

describe('TemplateNote Admin API', () => {
  const { server, adminClient } = createPluginTestEnvironment({
    plugins: [TemplatePlugin],
    db: loadPluginTestDbConfig(process.env),
  });

  /** Signs in as a new administrator whose only role grants `permissions` on the default channel. */
  async function signInWith(code: string, permissions: readonly string[]): Promise<void> {
    const { createRole } = await adminClient.query<{ createRole: { id: string } }>(CREATE_ROLE, {
      input: { code, description: code, permissions },
    });
    const emailAddress = `${code}@example.test`;
    await adminClient.query(CREATE_ADMINISTRATOR, {
      input: { firstName: code, lastName: 'Member', emailAddress, password: MEMBER_PASSWORD, roleIds: [createRole.id] },
    });
    await adminClient.asUserWithCredentials(emailAddress, MEMBER_PASSWORD);
  }

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
  });

  afterEach(async () => {
    await adminClient.asSuperAdmin();
  });

  afterAll(async () => {
    await server.destroy();
  });

  it('creates and reads a note through the Admin API', async () => {
    // Arrange
    await adminClient.asSuperAdmin();

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
    expect(listed).toEqual([created]);
  });

  it('rejects an empty title with a typed error', async () => {
    // Arrange
    await adminClient.asSuperAdmin();

    // Act
    const failure = await failureOf(adminClient.query(CREATE_NOTE, { input: { title: '   ', body: '' } }));

    // Assert
    expect(failure).toEqual({ codes: ['TEMPLATE_NOTE_INVALID_TITLE'], data: null });
  });

  it('requires the ReadTemplateNote permission', async () => {
    // Arrange
    await adminClient.asSuperAdmin();
    const { createTemplateNote: own } = await adminClient.query<{ createTemplateNote: NoteResult }>(CREATE_NOTE, {
      input: { title: 'Readable by a note reader', body: '' },
    });
    await signInWith('catalog-reader', ['ReadCatalog']);

    // Act
    const failure = await failureOf(adminClient.query(NOTES));
    await adminClient.asSuperAdmin();
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
    await adminClient.asSuperAdmin();
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
