import { AUTH_ERROR_CODES } from '@cod/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { png, svg, textClaimingPng } from './image-fixtures';
import { createProfileTestKit } from './profile-test-kit';
import { codeOf } from './register-test-kit';

const kit = createProfileTestKit();
const { client } = kit;

const profileOf = (answer: { data: Record<string, Record<string, unknown> | null> | null }, key = 'accountProfile') =>
  answer.data?.[key] ?? {};

beforeAll(async () => {
  await kit.start();
});

afterAll(async () => {
  await kit.server.destroy();
});

describe('the owner profile', () => {
  it('saves the names and a national phone as E.164, and reads them back', async () => {
    // Arrange
    const owner = await kit.owner();

    // Act
    const saved = await kit.updateProfile(owner.session, {
      firstName: 'Nadia',
      lastName: 'Haddad',
      phone: '0555123456',
    });
    const read = await kit.profile(owner.session);

    // Assert
    expect(saved.errors).toEqual([]);
    expect(profileOf(saved, 'updateAccountProfile')).toMatchObject({ phone: '+213555123456' });
    expect(profileOf(read, 'accountProfile')).toEqual({
      firstName: 'Nadia',
      lastName: 'Haddad',
      emailAddress: owner.email,
      phone: '+213555123456',
      avatarUrl: null,
      emailVerified: false,
    });
  });

  it('keeps the fields a save leaves out, and clears the phone on null', async () => {
    // Arrange
    const owner = await kit.owner();
    await kit.updateProfile(owner.session, { firstName: 'Nadia', phone: '+213661000111' });

    // Act
    const partial = await kit.updateProfile(owner.session, { lastName: 'Haddad' });
    const cleared = await kit.updateProfile(owner.session, { phone: null });

    // Assert
    expect(profileOf(partial, 'updateAccountProfile')).toMatchObject({
      firstName: 'Nadia',
      lastName: 'Haddad',
      phone: '+213661000111',
    });
    expect(profileOf(cleared, 'updateAccountProfile')).toMatchObject({
      firstName: 'Nadia',
      lastName: 'Haddad',
      phone: null,
    });
  });

  it('refuses a phone that is not a number and changes nothing', async () => {
    // Arrange
    const owner = await kit.owner();
    await kit.updateProfile(owner.session, { firstName: 'Nadia', phone: '0555123456' });

    // Act
    const refused = await kit.updateProfile(owner.session, { firstName: 'Other', phone: 'call me' });

    // Assert
    expect(codeOf(refused)).toBe(AUTH_ERROR_CODES.PROFILE_INVALID);
    expect(refused.errors[0]?.message).toBe('Invalid profile fields: phone');
    expect(profileOf(await kit.profile(owner.session))).toMatchObject({ firstName: 'Nadia', phone: '+213555123456' });
  });

  it('refuses an empty name', async () => {
    // Arrange
    const owner = await kit.owner();

    // Act
    const refused = await kit.updateProfile(owner.session, { firstName: '   ' });

    // Assert
    expect(codeOf(refused)).toBe(AUTH_ERROR_CODES.PROFILE_INVALID);
  });

  it('serves the same profile on GET and PATCH /auth/profile', async () => {
    // Arrange
    const owner = await kit.owner();

    // Act
    const patched = await client.json('PATCH', '/auth/profile', owner.session, { phone: '0770111222' });
    const got = await client.json('GET', '/auth/profile', owner.session);
    const refused = await client.json('PATCH', '/auth/profile', owner.session, { phone: 'abc' });

    // Assert
    expect(patched.status).toBe(200);
    expect(got.body).toMatchObject({ emailAddress: owner.email, phone: '+213770111222', firstName: 'Sara' });
    expect(refused).toMatchObject({ status: 400, body: { code: AUTH_ERROR_CODES.PROFILE_INVALID } });
  });

  it('refuses an anonymous caller on GraphQL and on REST', async () => {
    // Arrange / Act
    const query = await kit.profile({});
    const mutation = await kit.updateProfile({}, { firstName: 'Nadia' });
    const get = await client.json('GET', '/auth/profile', {});
    const patch = await client.json('PATCH', '/auth/profile', {}, { firstName: 'Nadia' });

    // Assert
    expect(codeOf(query)).toBe('FORBIDDEN');
    expect(codeOf(mutation)).toBe('FORBIDDEN');
    expect([get.status, patch.status]).toEqual([403, 403]);
  });

  it('keeps two owners apart: each reads and saves only their own profile', async () => {
    // Arrange
    const a = await kit.owner();
    const b = await kit.owner();
    await kit.updateProfile(a.session, { firstName: 'Alpha', phone: '0555000001' });

    // Act
    await kit.updateProfile(b.session, { firstName: 'Bravo', phone: '0555000002' });
    const readA = await kit.profile(a.session);
    const readB = await kit.profile(b.session);

    // Assert
    expect(profileOf(readA)).toMatchObject({ emailAddress: a.email, firstName: 'Alpha', phone: '+213555000001' });
    expect(profileOf(readB)).toMatchObject({ emailAddress: b.email, firstName: 'Bravo', phone: '+213555000002' });
  });
});

describe('the profile photo', () => {
  it('stores an image, shows its URL, serves it, and drops it when cleared', async () => {
    // Arrange
    const owner = await kit.owner();

    // Act
    const set = await kit.setAvatar(owner.session, png());
    const url = profileOf(await kit.profile(owner.session))['avatarUrl'] as string | null;
    const served = url === null ? undefined : await fetch(url);
    const cleared = await kit.clearAvatar(owner.session);
    const after = profileOf(await kit.profile(owner.session))['avatarUrl'];

    // Assert
    expect(set.errors).toEqual([]);
    expect(url).toMatch(/\/assets\//);
    expect(served?.status).toBe(200);
    expect(served?.headers.get('content-type')).toMatch(/^image\//);
    expect(cleared.errors).toEqual([]);
    expect(after).toBeNull();
  });

  it("leaves another owner's photo alone", async () => {
    // Arrange
    const a = await kit.owner();
    const b = await kit.owner();
    await kit.setAvatar(a.session, png());

    // Act
    const readB = profileOf(await kit.profile(b.session));
    await kit.clearAvatar(b.session);
    const readA = profileOf(await kit.profile(a.session));

    // Assert
    expect(readB['avatarUrl']).toBeNull();
    expect(readA['avatarUrl']).toEqual(expect.stringContaining('/assets/'));
  });

  it('refuses an anonymous upload', async () => {
    // Arrange / Act
    const answer = await kit.setAvatar({}, png());

    // Assert
    expect(codeOf(answer)).toBe('FORBIDDEN');
  });

  it.each([
    ["an SVG that says so (core's type list)", svg(), 'USER_INPUT_ERROR'],
    ['an SVG that claims to be a PNG (content check)', svg('image/png', 'logo.png'), AUTH_ERROR_CODES.IMAGE_TYPE],
    ['text that claims to be a PNG (content check)', textClaimingPng(), AUTH_ERROR_CODES.IMAGE_TYPE],
  ])('refuses %s and keeps no photo', async (_label, file, code) => {
    // Arrange
    const owner = await kit.owner();

    // Act
    const answer = await kit.setAvatar(owner.session, file);

    // Assert
    expect(codeOf(answer)).toBe(code);
    expect(profileOf(await kit.profile(owner.session))['avatarUrl']).toBeNull();
  });
});
