/**
 * Signing of the requests the storefront and other internal callers send to the api (ADR 0008, D111). Exported only
 * as `@cod/shared/internal-auth`, never from the package index, so `node:crypto` stays out of browser bundles.
 */
export { canonicalInternalRequest, type InternalRequest } from './canonical';
export { INTERNAL_AUTH_HEADERS, INTERNAL_AUTH_MAX_SKEW_SECONDS, INTERNAL_AUTH_VERSION } from './constants';
export { InvalidInternalKeysError, parseInternalKeys, type InternalSigningKey } from './keys';
export { signInternalRequest } from './sign';
export { verifyInternalRequest, type InternalVerifyFailure, type InternalVerifyResult } from './verify';
