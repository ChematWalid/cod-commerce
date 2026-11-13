import { describe, expect, it } from 'vitest';
import { parseNameChanges } from '../../application/profile-name-changes';
import { ProfileInvalidError } from '../../domain/errors';

describe('parseNameChanges', () => {
  it.each([
    ['an empty first name', { firstName: '' }, ['firstName']],
    ['a blank first name', { firstName: '   ' }, ['firstName']],
    ['a blank last name', { lastName: '\t ' }, ['lastName']],
    ['two blank names', { firstName: ' ', lastName: '' }, ['firstName', 'lastName']],
  ])('refuses %s, naming the field', (_label, changes, fields) => {
    // Arrange
    const parse = () => parseNameChanges(changes);

    // Act + Assert
    expect(parse).toThrow(new ProfileInvalidError(fields));
  });

  it('trims a valid name', () => {
    // Arrange
    const changes = { firstName: '  Yasmine ', lastName: 'Haddad' };

    // Act
    const parsed = parseNameChanges(changes);

    // Assert
    expect(parsed).toEqual({ firstName: 'Yasmine', lastName: 'Haddad' });
  });

  it('leaves out a name the save leaves out', () => {
    // Arrange
    const changes = { lastName: 'Belkacem' };

    // Act
    const parsed = parseNameChanges(changes);

    // Assert
    expect(parsed).toEqual({ lastName: 'Belkacem' });
  });
});
