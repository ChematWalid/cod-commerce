/** Injection token of the `AccountTokenRepositoryPort` adapter. */
export const ACCOUNT_TOKEN_REPOSITORY: unique symbol = Symbol('AccountTokenRepository');

/** Injection token of the `SecretHasherPort` adapter. */
export const SECRET_HASHER: unique symbol = Symbol('SecretHasher');

/** Injection token of the `PayloadSealerPort` adapter. */
export const PAYLOAD_SEALER: unique symbol = Symbol('PayloadSealer');

/** Injection token of the `AuthEmailTemplatesPort` the server supplies. */
export const AUTH_EMAIL_TEMPLATES: unique symbol = Symbol('AuthEmailTemplates');

/** Injection token of the `EmailSenderPort` adapter. */
export const EMAIL_SENDER: unique symbol = Symbol('EmailSender');

/** Injection token of {@link SessionTerminatorPort}. */
export const SESSION_TERMINATOR = Symbol('SESSION_TERMINATOR');

/** Injection token of the `BotChallengePort` adapter. */
export const BOT_CHALLENGE: unique symbol = Symbol('BotChallenge');

/** Injection token of the `AuthPublicConfig` value. */
export const AUTH_PUBLIC_CONFIG: unique symbol = Symbol('AuthPublicConfig');

/** Injection token of the `AccountIdentityPort` adapter, for the API layer. */
export const ACCOUNT_IDENTITY: unique symbol = Symbol('AccountIdentity');
