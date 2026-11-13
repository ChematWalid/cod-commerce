import { MEMBERS_PAGE_SIZE } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { type ListedMember, matchesSearch, newestFirst, pageOfMembers } from '../../domain/member-listing';
import { invitedMember, scopeA, T0 } from '../support/builders';

const listed = (
  tab: ListedMember['tab'],
  email: string,
  firstName: string | null = null,
  lastName: string | null = null,
) => ({
  tab,
  email,
  firstName,
  lastName,
});

const MEMBERS = [
  listed('active', 'amina@example.test', 'Amina', 'Bensalem'),
  listed('active', 'karim@example.test', 'Karim', 'Haddad'),
  listed('pending', 'new.hire@example.test'),
  listed('inactive', 'old@example.test', 'Old', 'Timer'),
];

describe('pageOfMembers', () => {
  it.each([
    ['all', 4],
    ['active', 2],
    ['pending', 1],
    ['inactive', 1],
  ] as const)('lists the %s tab and counts every tab the same way', (tab, length) => {
    // Act
    const page = pageOfMembers(MEMBERS, { tab, page: 1 });

    // Assert
    expect(page.items).toHaveLength(length);
    expect(page.total).toBe(length);
    expect(page.items.every((member) => tab === 'all' || member.tab === tab)).toBe(true);
    expect(page.counts).toEqual({ all: 4, active: 2, pending: 1, inactive: 1 });
  });

  it('counts only the members the search matches, so badges agree with the lists', () => {
    // Act
    const page = pageOfMembers(MEMBERS, { tab: 'all', search: 'KARIM', page: 1 });

    // Assert
    expect(page.items.map((member) => member.email)).toEqual(['karim@example.test']);
    expect(page.counts).toEqual({ all: 1, active: 1, pending: 0, inactive: 0 });
  });

  it(`serves ${String(MEMBERS_PAGE_SIZE)} rows a page, in the order given, and an empty page past the end`, () => {
    // Arrange
    const many = Array.from({ length: MEMBERS_PAGE_SIZE + 3 }, (_, index) =>
      listed('active', `m${String(index)}@example.test`),
    );

    // Act
    const first = pageOfMembers(many, { tab: 'active', page: 1 });
    const second = pageOfMembers(many, { tab: 'active', page: 2 });
    const third = pageOfMembers(many, { tab: 'active', page: 3 });

    // Assert
    expect(first.items).toHaveLength(MEMBERS_PAGE_SIZE);
    expect(first.items[0]?.email).toBe('m0@example.test');
    expect(second.items.map((member) => member.email)).toEqual(many.slice(MEMBERS_PAGE_SIZE).map((m) => m.email));
    expect(third.items).toEqual([]);
    expect(third.total).toBe(MEMBERS_PAGE_SIZE + 3);
  });
});

describe('matchesSearch', () => {
  it.each([
    ['first name, any case', 'aMiNa', true],
    ['last name', 'bensal', true],
    ['full name', 'amina bensalem', true],
    ['email', '@EXAMPLE.test', true],
    ['surrounding blanks', '  amina  ', true],
    ['something else', 'zzz', false],
  ])('matches by %s', (_case, search, expected) => {
    // Act
    const matched = matchesSearch(listed('active', 'amina@example.test', 'Amina', 'Bensalem'), search);

    // Assert
    expect(matched).toBe(expected);
  });

  it('matches everyone for an empty or blank search', () => {
    // Act / Assert
    expect(matchesSearch(MEMBERS[2] as ListedMember, undefined)).toBe(true);
    expect(matchesSearch(MEMBERS[2] as ListedMember, '   ')).toBe(true);
  });

  it('reads % and _ as plain characters, never as wildcards', () => {
    // Arrange
    const plain = listed('active', 'plain@example.test', 'Plain');
    const percent = listed('active', 'p50%off@example.test', 'Fifty');

    // Act / Assert
    expect(matchesSearch(plain, '%')).toBe(false);
    expect(matchesSearch(plain, '_')).toBe(false);
    expect(matchesSearch(percent, '50%')).toBe(true);
  });
});

describe('newestFirst', () => {
  it('orders members by creation, newest first, then by id', () => {
    // Arrange
    const older = invitedMember(scopeA, { createdAt: T0 });
    const newer = invitedMember(scopeA, { createdAt: new Date(T0.getTime() + 1000) });
    const sameTimeLaterId = invitedMember(scopeA, { createdAt: T0 });

    // Act
    const ordered = newestFirst([older, sameTimeLaterId, newer]);

    // Assert
    expect(ordered.map((member) => member.id)).toEqual([newer.id, sameTimeLaterId.id, older.id]);
  });
});
