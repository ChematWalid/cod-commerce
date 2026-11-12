import { afterEach, describe, expect, it } from 'vitest';
import type { AuthPluginOptions } from '../../auth.plugin';
import { AuthEmailService, AuthPlugin, InvitedAccountService } from '../../invitations';

/** Nest's module metadata key for the providers a module shares with its importers. */
const NEST_EXPORTS_KEY = 'exports';
const previousOptions = AuthPlugin.options;

describe('auth invitations entry', () => {
  afterEach(() => {
    AuthPlugin.options = previousOptions;
  });

  it('registers through init without a dynamic module, so a bare AuthPlugin import is the same Nest module', () => {
    // Arrange: init only stores the options; the factories read them when Nest builds the module.
    const options = { dashboardUrl: 'https://dash.example.test/dashboard/' } as unknown as AuthPluginOptions;

    // Act
    const registered = AuthPlugin.init(options);

    // Assert: Nest dedupes a static module by its class, so Team importing the bare class re-initialises nothing.
    expect(registered).toBe(AuthPlugin);
    expect(AuthPlugin.options).toBe(options);
  });

  it('shares the invited-account and email services with the modules that import it', () => {
    // Act
    const exported: unknown = Reflect.getMetadata(NEST_EXPORTS_KEY, AuthPlugin);

    // Assert
    expect(exported).toEqual(expect.arrayContaining([InvitedAccountService, AuthEmailService]));
  });
});
