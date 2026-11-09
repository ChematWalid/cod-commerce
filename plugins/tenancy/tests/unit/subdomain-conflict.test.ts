import { describe, expect, it } from 'vitest';
import { SubdomainTakenError } from '../../domain/errors';
import { translateSubdomainConflict } from '../../infrastructure/subdomain-conflict';

const failure = (code: string, detail: string): Error =>
  Object.assign(new Error('query failed'), { driverError: { code, detail } });

describe('translateSubdomainConflict', () => {
  it('passes a successful write through', async () => {
    // Act
    const result = await translateSubdomainConflict(Promise.resolve('written'));

    // Assert
    expect(result).toBe('written');
  });

  it('turns a unique violation on subdomain into SubdomainTakenError', async () => {
    // Arrange
    const conflict = failure('23505', 'Key (subdomain)=(demo) already exists.');

    // Act
    const write = translateSubdomainConflict(Promise.reject(conflict));

    // Assert
    await expect(write).rejects.toBeInstanceOf(SubdomainTakenError);
  });

  it.each([
    ['a unique violation on another column', failure('23505', 'Key ("channelId")=(4) already exists.')],
    ['another database error', failure('23503', 'Key (subdomain)=(demo) is not present.')],
    ['an error without a driver error', new Error('connection lost')],
  ])('rethrows %s unchanged', async (_name, error) => {
    // Act
    const write = translateSubdomainConflict(Promise.reject(error));

    // Assert
    await expect(write).rejects.toBe(error);
  });
});
