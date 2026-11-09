const DEFAULT_MAILPIT_API_URL = 'http://localhost:8026';
const POLL_INTERVAL_MS = 200;
const DEFAULT_WAIT_MS = 15_000;

/** A message as Mailpit's API returns it. */
export interface MailpitMessage {
  readonly Subject: string;
  readonly Text: string;
  readonly HTML: string;
  readonly To: readonly { readonly Address: string }[];
}

interface MailpitListing {
  readonly messages: readonly { readonly ID: string }[];
}

function apiUrl(): string {
  return process.env['MAILPIT_API_URL'] ?? DEFAULT_MAILPIT_API_URL;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiUrl()}${path}`);
  if (!response.ok) {
    throw new Error(`Mailpit ${path} answered ${String(response.status)}`);
  }
  return (await response.json()) as T;
}

/** The messages sent to `address` so far, oldest first. */
export async function messagesTo(address: string): Promise<MailpitMessage[]> {
  const found = await getJson<MailpitListing>(`/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`);
  const messages = await Promise.all(
    found.messages.map((message) => getJson<MailpitMessage>(`/api/v1/message/${message.ID}`)),
  );
  return messages.reverse();
}

/** Waits until `count` messages reached `address`. @throws Error on timeout. */
export async function waitForMessages(
  address: string,
  count = 1,
  timeoutMs = DEFAULT_WAIT_MS,
): Promise<MailpitMessage[]> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const messages = await messagesTo(address);
    if (messages.length >= count) {
      return messages;
    }
    if (Date.now() > deadline) {
      throw new Error(`no ${String(count)} message(s) reached the mailbox within ${String(timeoutMs)} ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}
