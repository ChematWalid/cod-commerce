import {
  createPluginTestEnvironment,
  loadPluginTestDbConfig,
  PLUGIN_TEST_CURRENCY_CODE,
  PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN,
  PLUGIN_TEST_INITIAL_DATA,
} from '@cod/testing';
import gql from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TemplatePlugin } from '../../template.plugin';
import { failureOf } from './graphql-outcome';

/** Vendure's code of the platform channel, which a business never is (ADR 0002). */
const DEFAULT_CHANNEL_CODE = '__default_channel__';
const TOKEN_A = 'business-a-token';
const TOKEN_B = 'business-b-token';

interface NoteRef {
  readonly id: string;
}

type CreateChannelResult = { readonly id: string } | { readonly errorCode: string; readonly message: string };

interface ChannelRef {
  readonly id: string;
  readonly code: string;
}

const ZONES = gql`
  query {
    zones {
      items {
        id
      }
    }
  }
`;

const CREATE_CHANNEL = gql`
  mutation ($input: CreateChannelInput!) {
    createChannel(input: $input) {
      ... on Channel {
        id
      }
      ... on ErrorResult {
        errorCode
        message
      }
    }
  }
`;

const ACTIVE_CHANNEL = gql`
  query {
    activeChannel {
      id
      code
    }
  }
`;

const CREATE_NOTE = gql`
  mutation ($input: CreateTemplateNoteInput!) {
    createTemplateNote(input: $input) {
      id
    }
  }
`;

const NOTE_BY_ID = gql`
  query ($id: String!) {
    templateNote(id: $id) {
      id
    }
  }
`;

const NOTES = gql`
  query {
    templateNotes {
      id
    }
  }
`;

describe('TemplateNote isolation between two businesses', () => {
  const { server, adminClient } = createPluginTestEnvironment({
    plugins: [TemplatePlugin],
    db: loadPluginTestDbConfig(process.env),
  });
  let noteOfA: NoteRef;
  let noteOfB: NoteRef;

  /** Runs the Admin API calls of `work` on the channel of `token`, then returns to the default channel. */
  async function asChannel<T>(token: string, work: () => Promise<T>): Promise<T> {
    adminClient.setChannelToken(token);
    try {
      return await work();
    } finally {
      adminClient.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
    }
  }

  async function createBusinessChannel(code: string, token: string, zoneId: string): Promise<void> {
    const { createChannel } = await adminClient.query<{ createChannel: CreateChannelResult }>(CREATE_CHANNEL, {
      input: {
        code,
        token,
        defaultLanguageCode: 'en',
        pricesIncludeTax: true,
        defaultCurrencyCode: PLUGIN_TEST_CURRENCY_CODE,
        defaultTaxZoneId: zoneId,
        defaultShippingZoneId: zoneId,
      },
    });
    if ('errorCode' in createChannel) {
      throw new Error(`createChannel ${code} failed: ${createChannel.errorCode} ${createChannel.message}`);
    }
  }

  const createNote = (token: string, title: string): Promise<NoteRef> =>
    asChannel(token, async () => {
      const result = await adminClient.query<{ createTemplateNote: NoteRef }>(CREATE_NOTE, {
        input: { title, body: '' },
      });
      return result.createTemplateNote;
    });

  const listIds = async (token: string): Promise<string[]> =>
    asChannel(token, async () => {
      const result = await adminClient.query<{ templateNotes: NoteRef[] }>(NOTES);
      return result.templateNotes.map((note) => note.id);
    });

  const readById = (token: string, id: string): Promise<NoteRef | null> =>
    asChannel(token, async () => {
      const result = await adminClient.query<{ templateNote: NoteRef | null }>(NOTE_BY_ID, { id });
      return result.templateNote;
    });

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    await adminClient.asSuperAdmin();
    const { zones } = await adminClient.query<{ zones: { items: { id: string }[] } }>(ZONES);
    const [zone] = zones.items;
    if (zone === undefined) {
      throw new Error('The test server has no zone: PLUGIN_TEST_INITIAL_DATA must create Algeria');
    }
    const zoneId = zone.id;
    await createBusinessChannel('business-a', TOKEN_A, zoneId);
    await createBusinessChannel('business-b', TOKEN_B, zoneId);
    noteOfA = await createNote(TOKEN_A, "A's note");
    noteOfB = await createNote(TOKEN_B, "B's note");
  });

  afterAll(async () => {
    await server.destroy();
  });

  it("business A cannot read B's note by id", async () => {
    // Act
    const readByB = await readById(TOKEN_B, noteOfB.id);
    const readByA = await readById(TOKEN_A, noteOfB.id);

    // Assert
    expect(readByB).toEqual(noteOfB);
    expect(readByA).toBeNull();
  });

  it("business A's list never contains B's notes", async () => {
    // Act
    const listedForA = await listIds(TOKEN_A);
    const listedForB = await listIds(TOKEN_B);

    // Assert
    expect(listedForA).toEqual([noteOfA.id]);
    expect(listedForB).toEqual([noteOfB.id]);
  });

  // RF1: an isolation test is vacuous if A and B resolve to the same business, or to the default channel.
  it('A and B are two businesses, neither of them the default channel', async () => {
    // Act
    const channelOf = async (token: string): Promise<ChannelRef> =>
      asChannel(
        token,
        async () => (await adminClient.query<{ activeChannel: ChannelRef }>(ACTIVE_CHANNEL)).activeChannel,
      );
    const [channelA, channelB, platform] = [
      await channelOf(TOKEN_A),
      await channelOf(TOKEN_B),
      await channelOf(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN),
    ];
    const listedOnPlatform = await listIds(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);

    // Assert
    expect(new Set([channelA.id, channelB.id, platform.id]).size).toBe(3);
    expect(platform.code).toBe(DEFAULT_CHANNEL_CODE);
    expect([channelA.code, channelB.code]).toEqual(['business-a', 'business-b']);
    expect(listedOnPlatform).toEqual([]);
  });

  // RF1: Vendure would serve an empty token from the default channel; an unknown one must be refused.
  it('rejects an unknown channel token instead of falling back to the default channel', async () => {
    // Act
    const failure = await failureOf(asChannel('nope', () => adminClient.query(NOTES)));

    // Assert
    expect(failure).toEqual({ codes: ['CHANNEL_NOT_FOUND'], data: null });
  });
});
