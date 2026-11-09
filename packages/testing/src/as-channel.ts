import type { SimpleGraphQLClient } from '@vendure/testing';
import { PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN } from './create-plugin-test-environment';

/** Runs the Admin API calls of `work` on the channel of `token`, then returns the client to the default channel. */
export async function asChannel<T>(client: SimpleGraphQLClient, token: string, work: () => Promise<T>): Promise<T> {
  client.setChannelToken(token);
  try {
    return await work();
  } finally {
    client.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
  }
}
