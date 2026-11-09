import type { AccountToken, AccountTokenPurpose, NewAccountToken, OtpAttemptWindow } from '../../domain/account-token';
import { OTP_PURPOSE } from '../../domain/account-token';
import type { AccountTokenRepositoryPort } from '../../domain/ports/account-token-repository.port';

/** The port's rules over an array; each method runs to completion, like the adapter's single statements. */
export class InMemoryAccountTokenRepository implements AccountTokenRepositoryPort {
  rows: AccountToken[] = [];

  replaceOpen(_ctx: unknown, token: NewAccountToken): Promise<void> {
    if (token.userId !== null) {
      this.voidRows(token.userId, [token.purpose], token.createdAt);
    }
    this.rows.push({ ...token, otpAttempts: 0, otpLockedAt: null, consumedAt: null });
    return Promise.resolve();
  }

  consumeByHash(
    _ctx: unknown,
    purpose: AccountTokenPurpose,
    tokenHash: string,
    now: Date,
  ): Promise<AccountToken | undefined> {
    const row = this.rows.find(
      (r) => r.tokenHash === tokenHash && r.purpose === purpose && r.consumedAt === null && r.expiresAt > now,
    );
    return Promise.resolve(row && this.replace(row, { consumedAt: now }));
  }

  claimOtpAttempt(userId: number, window: OtpAttemptWindow): Promise<AccountToken | undefined> {
    const row = this.openOtp(userId, window);
    if (row === undefined || row.otpAttempts >= window.maxAttempts) {
      return Promise.resolve(undefined);
    }
    const otpAttempts = row.otpAttempts + 1;
    const otpLockedAt = otpAttempts >= window.maxAttempts ? window.now : row.otpLockedAt;
    return Promise.resolve(this.replace(row, { otpAttempts, otpLockedAt }));
  }

  findOpenOtp(userId: number, window: OtpAttemptWindow): Promise<AccountToken | undefined> {
    return Promise.resolve(this.openOtp(userId, window));
  }

  consumeOtpToken(_ctx: unknown, id: string, now: Date): Promise<AccountToken | undefined> {
    const row = this.rows.find((r) => r.id === id && r.consumedAt === null);
    return Promise.resolve(row && this.replace(row, { consumedAt: now, otpLockedAt: null }));
  }

  voidOpen(_ctx: unknown, userId: number, purposes: readonly AccountTokenPurpose[], now: Date): Promise<void> {
    this.voidRows(userId, purposes, now);
    return Promise.resolve();
  }

  lastIssuedAt(_ctx: unknown, userId: number, purpose: AccountTokenPurpose): Promise<Date | undefined> {
    const times = this.rows
      .filter((r) => r.userId === userId && r.purpose === purpose)
      .map((r) => r.createdAt.getTime());
    return Promise.resolve(times.length === 0 ? undefined : new Date(Math.max(...times)));
  }

  private openOtp(userId: number, window: OtpAttemptWindow): AccountToken | undefined {
    return this.rows.find(
      (r) =>
        r.userId === userId &&
        r.purpose === OTP_PURPOSE &&
        r.otpHash !== null &&
        r.consumedAt === null &&
        r.expiresAt > window.now &&
        r.createdAt > window.issuedAfter,
    );
  }

  private voidRows(userId: number, purposes: readonly AccountTokenPurpose[], now: Date): void {
    this.rows
      .filter((r) => r.userId === userId && purposes.includes(r.purpose) && r.consumedAt === null)
      .forEach((r) => this.replace(r, { consumedAt: now }));
  }

  private replace(row: AccountToken, changes: Partial<AccountToken>): AccountToken {
    const updated = { ...row, ...changes };
    this.rows = this.rows.map((r) => (r === row ? updated : r));
    return updated;
  }
}
