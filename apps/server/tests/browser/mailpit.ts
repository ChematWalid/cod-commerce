/** Reads what the worker sent through the Mailpit HTTP API: the browser tests and the evidence script share it. */

const POLL_INTERVAL_MS = 300;
const DEFAULT_WAIT_MS = 30_000;
const LINK_TOKEN = /[?&]token=([\w-]+)/;
const OTP = /(?<!\d)\d{6}(?!\d)/;

export interface MailpitEmail {
  readonly id: string;
  readonly subject: string;
  readonly from: string;
  readonly to: string;
  readonly text: string;
  readonly html: string;
}

export interface WaitForEmailOptions {
  /** Only a message whose subject or text holds this counts, e.g. `/verify-email`. */
  readonly contains?: string;
  /** Waits until the address has received at least this many messages; the newest is returned. */
  readonly minCount?: number;
  readonly timeoutMs?: number;
}

interface SearchAnswer {
  readonly messages: readonly { readonly ID: string }[];
}

interface MessageAnswer {
  readonly ID: string;
  readonly Subject: string;
  readonly From: { readonly Address: string };
  readonly To: readonly { readonly Address: string }[];
  readonly Text: string;
  readonly HTML: string;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Mailpit answered ${String(response.status)} for ${url}`);
  return (await response.json()) as T;
}

async function readMessage(baseUrl: string, id: string): Promise<MailpitEmail> {
  const message = await getJson<MessageAnswer>(`${baseUrl}/api/v1/message/${id}`);
  return {
    id: message.ID,
    subject: message.Subject,
    from: message.From.Address,
    to: message.To.map(({ Address }) => Address).join(', '),
    text: message.Text,
    html: message.HTML,
  };
}

const holds = (email: MailpitEmail, contains: string | undefined): boolean =>
  contains === undefined || email.text.includes(contains) || email.subject.includes(contains);

/** The newest matching message of those found, or undefined while too few have arrived. */
async function findMessage(
  baseUrl: string,
  to: string,
  { contains, minCount = 1 }: WaitForEmailOptions,
): Promise<MailpitEmail | undefined> {
  const query = encodeURIComponent(`to:"${to}"`);
  const { messages } = await getJson<SearchAnswer>(`${baseUrl}/api/v1/search?query=${query}&limit=50`);
  if (messages.length < minCount) return undefined;
  for (const { ID } of messages) {
    const email = await readMessage(baseUrl, ID);
    if (holds(email, contains)) return email;
  }
  return undefined;
}

/** The newest message to `to` that meets the options, once it has arrived. */
export async function waitForEmail(
  baseUrl: string,
  to: string,
  options: WaitForEmailOptions = {},
): Promise<MailpitEmail> {
  const { contains, minCount = 1, timeoutMs = DEFAULT_WAIT_MS } = options;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const email = await findMessage(baseUrl, to, options);
    if (email !== undefined) return email;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(
    `no email to ${to} (holding ${contains ?? 'anything'}, at least ${String(minCount)}) within ${String(timeoutMs)} ms`,
  );
}

/** The link's token and the six-digit code of an email, when it has them. */
export function emailSecrets(email: Pick<MailpitEmail, 'text'>): { readonly token?: string; readonly code?: string } {
  const token = LINK_TOKEN.exec(email.text)?.[1];
  const code = OTP.exec(email.text)?.[0];
  return { ...(token !== undefined && { token }), ...(code !== undefined && { code }) };
}
