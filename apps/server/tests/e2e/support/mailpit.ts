const DEFAULT_MAILPIT_API_URL = 'http://localhost:8026';
const DEFAULT_MAILPIT_SMTP_PORT = '1026';
const POLL_INTERVAL_MS = 200;

/** A message as Mailpit's API returns it. */
export interface MailpitMessage {
  readonly Subject: string;
  readonly Text: string;
  readonly HTML: string;
}

/**
 * Plain SMTP without an account, whatever the developer's `.env` says: a Gmail block there would otherwise make
 * the server require TLS from Mailpit.
 */
export const PLAIN_SMTP_ENV = { SMTP_TLS: 'none', SMTP_USERNAME: '', SMTP_PASSWORD: '' } as const;

/** The compose Mailpit as seen from the host; CI publishes it on other ports and says so in the environment. */
export const MAILPIT_SMTP_PORT = process.env['MAILPIT_SMTP_HOST_PORT'] ?? DEFAULT_MAILPIT_SMTP_PORT;

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${process.env['MAILPIT_API_URL'] ?? DEFAULT_MAILPIT_API_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Mailpit ${path} answered ${String(response.status)}`);
  }
  return (await response.json()) as T;
}

/** Waits for the first message sent to `address`. @throws Error on timeout. */
export async function waitForMessageTo(address: string, timeoutMs: number): Promise<MailpitMessage> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const found = await getJson<{ messages: { ID: string }[] }>(
      `/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`,
    );
    const first = found.messages[0];
    if (first !== undefined) {
      return getJson<MailpitMessage>(`/api/v1/message/${first.ID}`);
    }
    if (Date.now() > deadline) {
      throw new Error(`no message reached the mailbox within ${String(timeoutMs)} ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}
