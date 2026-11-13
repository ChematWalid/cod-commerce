import { TEAM_ERROR_CODES } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { acceptErrorMessageId, errorMessageId, RestApiError } from '../../dashboard/error-messages';

const graphQlError = (code: string): unknown => ({ message: 'x', extensions: { code } });

describe('team dashboard error messages', () => {
  it('shows a team code as its own message, from GraphQL and from REST', () => {
    const code = TEAM_ERROR_CODES.EMAIL_ALREADY_MEMBER;

    expect(errorMessageId(graphQlError(code))).toBe(code);
    expect(errorMessageId(new RestApiError(409, code))).toBe(code);
  });

  it('shows an rbac privilege refusal as one Team message', () => {
    expect(errorMessageId(graphQlError('rbac.owner-restricted'))).toBe('team.error-privilege');
    expect(errorMessageId(graphQlError('rbac.store-not-accessible'))).toBe('team.error-privilege');
  });

  it('shows FORBIDDEN, a rate limit and an unknown code as their generic messages', () => {
    expect(errorMessageId(graphQlError('FORBIDDEN'))).toBe('team.error-forbidden');
    expect(errorMessageId(new RestApiError(429, undefined))).toBe('team.error-rate-limited');
    expect(errorMessageId(graphQlError('something.else'))).toBe('team.error-generic');
    expect(errorMessageId(new Error('network'))).toBe('team.error-generic');
  });

  it('gives the accept page one message for an invalid, expired or revoked link (D213)', () => {
    const invalid = acceptErrorMessageId(new RestApiError(400, TEAM_ERROR_CODES.INVITATION_INVALID));
    const expired = acceptErrorMessageId(new RestApiError(400, TEAM_ERROR_CODES.INVITATION_EXPIRED));

    expect(invalid).toBe(TEAM_ERROR_CODES.INVITATION_INVALID);
    expect(expired).toBe(invalid);
  });

  it('gives the accept page the account-elsewhere message, which names no business (D201)', () => {
    const id = acceptErrorMessageId(new RestApiError(409, TEAM_ERROR_CODES.ACCOUNT_ELSEWHERE));

    expect(id).toBe(TEAM_ERROR_CODES.ACCOUNT_ELSEWHERE);
  });
});
