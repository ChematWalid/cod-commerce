import {
  type BusinessId,
  INVITATION_MAX_RESENDS,
  INVITATION_RESEND_COOLDOWN_MS,
  INVITATION_TTL_MS,
  type Snowflake,
  type TeamEmailLocale,
} from '@cod/shared';
import { ResendCooldownError, ResendLimitError } from './errors';
import type { MemberGrant } from './member-grant';

/** Where an invitation stands at a given time. */
export type InvitationState = 'open' | 'expired' | 'revoked' | 'accepted';

/**
 * An invitation as Team reads it back. The token hash is not part of it: the column is never loaded by a generic
 * read (D205), only by the accept lookup.
 */
export interface Invitation {
  readonly id: Snowflake;
  readonly businessId: BusinessId;
  readonly memberId: Snowflake;
  /** The roles and stores the invitee gets on accept (D204). */
  readonly grant: MemberGrant;
  readonly locale: TeamEmailLocale;
  readonly expiresAt: Date;
  readonly lastSentAt: Date;
  readonly resendCount: number;
  readonly invitedByAdministratorId: number;
  readonly revokedAt: Date | null;
  readonly acceptedAt: Date | null;
  readonly createdAt: Date;
}

/** An invitation as it is written: with the SHA-256 hex of its token, never the token itself (D205). */
export interface IssuedInvitation extends Invitation {
  readonly tokenHash: string;
}

/** An invitation as the API shows it. */
export interface InvitationView {
  readonly id: Snowflake;
  readonly memberId: Snowflake;
  readonly state: InvitationState;
  readonly expiresAt: Date;
  readonly lastSentAt: Date;
  readonly resendCount: number;
}

/** Accepted and revoked are final; otherwise the invitation expires at exactly `expiresAt`. */
export function invitationStateOf(invitation: Invitation, now: Date): InvitationState {
  if (invitation.acceptedAt !== null) return 'accepted';
  if (invitation.revokedAt !== null) return 'revoked';
  return now.getTime() >= invitation.expiresAt.getTime() ? 'expired' : 'open';
}

/**
 * Refuses a resend the abuse caps forbid (D205).
 *
 * @throws {ResendLimitError} when the invitation was already resent {@link INVITATION_MAX_RESENDS} times.
 * @throws {ResendCooldownError} when the last send is less than the cooldown ago.
 */
export function assertResendAllowed(invitation: Invitation, now: Date): void {
  if (invitation.resendCount >= INVITATION_MAX_RESENDS) throw new ResendLimitError();
  if (now.getTime() - invitation.lastSentAt.getTime() < INVITATION_RESEND_COOLDOWN_MS) {
    throw new ResendCooldownError();
  }
}

/** When an invitation sent at `now` stops working. */
export function nextExpiry(now: Date): Date {
  return new Date(now.getTime() + INVITATION_TTL_MS);
}

/** Copies the fields a client may see; the token hash never leaves the server. */
export function toInvitationView(invitation: Invitation, now: Date): InvitationView {
  return {
    id: invitation.id,
    memberId: invitation.memberId,
    state: invitationStateOf(invitation, now),
    expiresAt: invitation.expiresAt,
    lastSentAt: invitation.lastSentAt,
    resendCount: invitation.resendCount,
  };
}
