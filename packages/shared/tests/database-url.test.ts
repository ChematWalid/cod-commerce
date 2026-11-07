import { describe, expect, it } from 'vitest';
import { InvalidDatabaseUrlError, toPostgresFields } from '../src/platform/database-url';

describe('toPostgresFields', () => {
  it('decodes percent-encoded passwords', () => {
    expect(toPostgresFields('postgresql://u:p%40ss@h:6432/d')).toEqual({
      host: 'h',
      port: 6432,
      username: 'u',
      password: 'p@ss',
      database: 'd',
    });
  });

  it.each([
    ['p@ss/w:rd', 'postgresql://cod:p@ss/w:rd@postgres:5432/cod'],
    ['p#ss', 'postgresql://cod:p#ss@postgres:5432/cod'],
  ])('rejects a password that broke the URL (%s)', (password, url) => {
    const failure = (): unknown => toPostgresFields(url);

    expect(failure).toThrow(InvalidDatabaseUrlError);
    expect(failure).not.toThrow(password);
    expect(failure).not.toThrow(url);
  });
});
