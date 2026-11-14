import { PartitionMaintenanceService, PlatformPartitionsPlugin } from '@cod/plugin-platform-partitions';
import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import {
  adminOperationsOf,
  asChannel,
  type BusinessFixture,
  type GraphQlDocument,
  createPluginTestEnvironment,
  createTwoBusinesses,
  failureOf,
  loadPluginTestDbConfig,
  withPartitionedSchemas,
  PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN,
  PLUGIN_TEST_INITIAL_DATA,
  type TwoBusinesses,
} from '@cod/testing';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { adminApiSchema } from '../../api/schema';
import { TemplatePlugin } from '../../template.plugin';
import {
  CREATE_NOTE,
  NOTE_BY_ID,
  type NoteResult,
  NOTES,
  TEST_REDIS_URL,
  testRateLimitPlugin,
} from './template-note-operations';

type NoteIdsOf = (value: unknown) => readonly string[];

/** What A's call must come to; it is never B's data. */
type NoteOutcome = { readonly kind: 'null' } | { readonly kind: 'callerOwned'; readonly noteIdsOf: NoteIdsOf };

/**
 * Proves an attack aimed at something real, so `null` cannot come from a wrong id: B reads its own note, or B runs
 * the same write and finds what it created in its own list.
 */
type NoteControl =
  | { readonly kind: 'readAsB'; readonly noteIdsOf: NoteIdsOf }
  | { readonly kind: 'createdByB'; readonly noteIdsOf: NoteIdsOf };

/** One Admin API operation, its call from A against B, and the result it must have. */
interface NoteEntry {
  readonly operation: string;
  readonly document: GraphQlDocument;
  readonly variables: () => Record<string, unknown>;
  readonly outcome: NoteOutcome;
  readonly control: NoteControl;
}

const idOfNote: NoteIdsOf = (value) => [(value as NoteResult).id];
const idsOfNotes: NoteIdsOf = (value) => (value as NoteResult[]).map((note) => note.id);

describe('TemplateNote isolation between two businesses', () => {
  const { server, adminClient } = createPluginTestEnvironment({
    plugins: [
      testRateLimitPlugin(),
      TenancyPlugin.init({ redisUrl: TEST_REDIS_URL, platformDomain: 'localhost', snowflakeWorkerId: 1004 }),
      PlatformPartitionsPlugin,
      RbacPlugin,
      TemplatePlugin,
    ],
    db: loadPluginTestDbConfig(process.env),
  });
  withPartitionedSchemas(server, [ACTIVITY_LOG_SCHEMA], PartitionMaintenanceService);
  let fixtures: TwoBusinesses;
  let noteOfA: NoteResult;
  let noteOfB: NoteResult;

  const REGISTRY: readonly NoteEntry[] = [
    {
      operation: 'templateNote',
      document: NOTE_BY_ID,
      variables: () => ({ id: noteOfB.id }),
      outcome: { kind: 'null' },
      control: { kind: 'readAsB', noteIdsOf: idOfNote },
    },
    {
      operation: 'templateNotes',
      document: NOTES,
      variables: () => ({}),
      outcome: { kind: 'callerOwned', noteIdsOf: idsOfNotes },
      control: { kind: 'readAsB', noteIdsOf: idsOfNotes },
    },
    {
      operation: 'createTemplateNote',
      document: CREATE_NOTE,
      variables: () => ({ input: { title: "A's own", body: '' } }),
      outcome: { kind: 'callerOwned', noteIdsOf: idOfNote },
      control: { kind: 'createdByB', noteIdsOf: idOfNote },
    },
  ];

  async function callOperation(entry: NoteEntry): Promise<unknown> {
    const data = await adminClient.query<Record<string, unknown>>(entry.document, entry.variables());
    return data[entry.operation];
  }

  async function asOwner(business: BusinessFixture, store = business.stores[0]): Promise<void> {
    adminClient.setChannelToken(store.channelToken);
    await adminClient.asUserWithCredentials(business.owner.email, business.owner.password);
  }

  async function createNote(business: BusinessFixture, title: string): Promise<NoteResult> {
    await asOwner(business);
    const result = await adminClient.query<{ createTemplateNote: NoteResult }>(CREATE_NOTE, {
      input: { title, body: '' },
    });
    return result.createTemplateNote;
  }

  const noteIds = async (): Promise<string[]> => {
    const { templateNotes } = await adminClient.query<{ templateNotes: NoteResult[] }>(NOTES);
    return templateNotes.map((note) => note.id);
  };

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    fixtures = await createTwoBusinesses(adminClient);
    noteOfA = await createNote(fixtures.a, "A's note");
    noteOfB = await createNote(fixtures.b, "B's note");
  });

  afterEach(async () => {
    adminClient.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
    await adminClient.asSuperAdmin();
  });

  afterAll(async () => {
    await server.destroy();
  });

  it('has a registry entry for every Admin API operation', () => {
    // Act
    const registered = REGISTRY.map((entry) => entry.operation).sort();

    // Assert
    expect(registered).toEqual(adminOperationsOf(adminApiSchema));
  });

  it("business A cannot read B's note by id", async () => {
    // Arrange
    await asOwner(fixtures.a);

    // Act
    const { templateNote } = await adminClient.query<{ templateNote: NoteResult | null }>(NOTE_BY_ID, {
      id: noteOfB.id,
    });

    // Assert
    expect(templateNote).toBeNull();
  });

  it("business A's list never contains B's notes, on either of its stores", async () => {
    // Arrange
    await asOwner(fixtures.a);

    // Act
    const onA1 = await noteIds();
    await asOwner(fixtures.a, fixtures.a.stores[1]);
    const onA2 = await noteIds();

    // Assert
    expect(onA1).toContain(noteOfA.id);
    expect(onA1).not.toContain(noteOfB.id);
    expect(onA2).toEqual(onA1);
  });

  it("a note A creates stays out of B's list", async () => {
    // Arrange
    const created = await createNote(fixtures.a, 'Private to A');

    // Act
    await asOwner(fixtures.b);
    const listedForB = await noteIds();

    // Assert
    expect(listedForB).toEqual([noteOfB.id]);
    expect(listedForB).not.toContain(created.id);
  });

  it.each(REGISTRY)("$operation run by A never returns B's notes", async (entry) => {
    // Arrange
    await asOwner(fixtures.a);

    // Act
    const value = await callOperation(entry);

    // Assert
    if (entry.outcome.kind === 'null') {
      expect(value).toBeNull();
    } else {
      expect(entry.outcome.noteIdsOf(value)).not.toContain(noteOfB.id);
      expect(entry.outcome.noteIdsOf(value).length).toBeGreaterThan(0);
    }
    await asOwner(fixtures.b);
    expect(await noteIds()).toEqual([noteOfB.id]);
  });

  // The attack above must aim at a real note: without this, a wrong id would also come back null.
  it.each(REGISTRY)("$operation run by B reaches B's own notes", async (entry) => {
    // Arrange
    await asOwner(fixtures.b);

    // Act
    const ids = entry.control.noteIdsOf(await callOperation(entry));

    // Assert
    if (entry.control.kind === 'readAsB') {
      expect(ids).toEqual([noteOfB.id]);
    } else {
      expect(ids).toHaveLength(1);
      expect(await noteIds()).toContain(ids[0]);
    }
  });

  it.each(REGISTRY)("$operation is FORBIDDEN for A's owner on B's channel", async ({ document, variables }) => {
    // Arrange
    await asOwner(fixtures.a);

    // Act
    const failure = await failureOf(
      asChannel(adminClient, fixtures.b.stores[0].channelToken, () => adminClient.query(document, variables())),
    );

    // Assert
    expect(failure.codes).toEqual(['FORBIDDEN']);
  });

  it('is FORBIDDEN on the default channel, which belongs to no business', async () => {
    // Act
    const failure = await failureOf(adminClient.query(NOTES));

    // Assert
    expect(failure.codes).toEqual(['FORBIDDEN']);
  });

  // RF1: Vendure would serve an empty token from the default channel; an unknown one must be refused.
  it('rejects an unknown channel token instead of falling back to the default channel', async () => {
    // Act
    const failure = await failureOf(asChannel(adminClient, 'nope', () => adminClient.query(NOTES)));

    // Assert
    expect(failure).toEqual({ codes: ['CHANNEL_NOT_FOUND'], data: null });
  });
});
