/**
 * Entry point for Team's invitations (D203, D206): Team's adapters and its Nest module file import it (architecture
 * rule `auth-invitations-entry-infra-only`); their `application/`, `domain/` and `api/` reach it through their own
 * ports. Auth stays the owner of the email claim lock, `emailVerifiedAt`, `emailLocale` and the email queue.
 */
export { AuthPlugin } from './auth.plugin';
export { AuthEmailService } from './application/auth-email.service';
export { InvitedAccountService } from './application/invited-account.service';
export type { AuthEmailLocale, AuthEmailRequest } from './domain/email';
export { EmailTakenError } from './domain/errors';
export { asOperationContext, type OperationContext } from './domain/ports/operation-context';
