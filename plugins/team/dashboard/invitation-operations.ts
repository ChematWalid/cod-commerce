import { getApiBaseUrl } from '@/vdb/utils/config-utils.js';
import type { AcceptInvitationInput } from '@cod/shared';
import { INVITATION_ACCEPT_ENDPOINT, INVITATION_PREVIEW_ENDPOINT } from './constants';
import type { InvitationPreviewDto } from './dto';
import { RestApiError } from './error-messages';

/** The stable code of a refusal's body, when it is JSON and has one; a 429 or a proxy page has none. */
async function refusalOf(response: Response): Promise<RestApiError> {
  const body: unknown = await response.json().catch(() => null);
  const code =
    typeof body === 'object' && body !== null && 'code' in body && typeof body.code === 'string'
      ? body.code
      : undefined;
  return new RestApiError(response.status, code);
}

/**
 * What the link opens: the address and the business, for the invitee's eyes only. Every token that opens nothing
 * gets the same refusal (D213). The token travels in the query once, as the route takes it; `no-store` keeps it
 * out of caches (D205).
 */
export async function previewInvitation(token: string): Promise<InvitationPreviewDto> {
  const query = new URLSearchParams({ token });
  const response = await fetch(`${getApiBaseUrl()}${INVITATION_PREVIEW_ENDPOINT}?${query.toString()}`, {
    credentials: 'omit',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
  });
  if (!response.ok) throw await refusalOf(response);
  return (await response.json()) as InvitationPreviewDto;
}

/** Creates the invitee's account. The password goes in this one request body and nowhere else. */
export async function acceptInvitation(input: AcceptInvitationInput): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}${INVITATION_ACCEPT_ENDPOINT}`, {
    method: 'POST',
    credentials: 'omit',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await refusalOf(response);
}
