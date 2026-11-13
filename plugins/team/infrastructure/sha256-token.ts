import { createHash, randomBytes } from 'node:crypto';
import { INVITATION_TOKEN_BYTES } from '../domain/constants';
import type { InvitationTokenPort } from '../domain/ports/invitation-token.port';

/**
 * Invitation tokens of 256 random bits, stored as their SHA-256 hex (D205). A token this long cannot be guessed, so
 * the hash needs no secret key: a leaked table gives no usable link.
 */
export class Sha256InvitationToken implements InvitationTokenPort {
  newToken(): string {
    return randomBytes(INVITATION_TOKEN_BYTES).toString('base64url');
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
