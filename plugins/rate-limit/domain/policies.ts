import {
  ACCOUNT_CAPACITY,
  CATALOG_MEDIA_ACTOR_CAPACITY,
  CATALOG_MEDIA_BUSINESS_CAPACITY,
  DAY_WINDOW_SECONDS,
  HOUR_WINDOW_SECONDS,
  IP_CAPACITY,
  MINUTE_WINDOW_SECONDS,
  OTP_DAILY_CAPACITY,
  REGISTER_IP_CAPACITY,
  TEAM_ACTOR_MAIL_CAPACITY,
  TEAM_INVITE_BUSINESS_CAPACITY,
} from './constants';

/** What a policy does while Valkey is unreachable (D31). */
export type OutageMode = 'in-process' | 'open';

/**
 * A token bucket: it holds `capacity` tokens and refills one `capacity`th of that every
 * `windowSeconds / capacity`, so an idle key is full again after one window.
 */
export interface RateLimitPolicy {
  readonly capacity: number;
  readonly windowSeconds: number;
  /** `in-process`: the same policy runs in this process's memory. `open`: every request is allowed. */
  readonly outage: OutageMode;
}

const perMinute = (capacity: number, outage: OutageMode): RateLimitPolicy => ({
  capacity,
  windowSeconds: MINUTE_WINDOW_SECONDS,
  outage,
});

/** An hourly budget that keeps limiting from memory during an outage. */
const perHour = (capacity: number): RateLimitPolicy => ({
  capacity,
  windowSeconds: HOUR_WINDOW_SECONDS,
  outage: 'in-process',
});

/** Invitation mail keeps limiting from memory during an outage: each request sends an email (D205). */
const mailPerHour = perHour;

/**
 * Every policy (D29). Credential and token guessing policies keep limiting from memory during an outage,
 * because stock sessions stay up without Valkey and would otherwise be unthrottled; the rest fail open.
 */
export const RATE_LIMIT_POLICIES = {
  'login-pair': perMinute(ACCOUNT_CAPACITY, 'in-process'),
  'login-account': perMinute(ACCOUNT_CAPACITY, 'in-process'),
  'login-ip': perMinute(IP_CAPACITY, 'in-process'),
  'reset-account': perMinute(ACCOUNT_CAPACITY, 'in-process'),
  'reset-ip': perMinute(IP_CAPACITY, 'in-process'),
  'token-redeem-ip': perMinute(IP_CAPACITY, 'in-process'),
  'otp-account': perMinute(ACCOUNT_CAPACITY, 'in-process'),
  'otp-ip': perMinute(IP_CAPACITY, 'in-process'),
  'otp-account-daily': { capacity: OTP_DAILY_CAPACITY, windowSeconds: DAY_WINDOW_SECONDS, outage: 'in-process' },
  'current-password-account': perMinute(ACCOUNT_CAPACITY, 'in-process'),
  'current-password-ip': perMinute(IP_CAPACITY, 'in-process'),
  'register-ip': { capacity: REGISTER_IP_CAPACITY, windowSeconds: HOUR_WINDOW_SECONDS, outage: 'open' },
  'subdomain-ip': perMinute(IP_CAPACITY, 'open'),
  // Team invitations (D205): the public accept and preview routes by address, the mail they send by business and actor.
  'invitation-accept-ip': perMinute(IP_CAPACITY, 'in-process'),
  'team-invite-business': mailPerHour(TEAM_INVITE_BUSINESS_CAPACITY),
  'team-invite-actor': mailPerHour(TEAM_ACTOR_MAIL_CAPACITY),
  'team-resend-actor': mailPerHour(TEAM_ACTOR_MAIL_CAPACITY),
  // Catalog media uploads (D2138): each one writes a file to the shared bucket, so they keep limiting from memory too.
  'catalog-media-business': perHour(CATALOG_MEDIA_BUSINESS_CAPACITY),
  'catalog-media-actor': perHour(CATALOG_MEDIA_ACTOR_CAPACITY),
} as const satisfies Record<string, RateLimitPolicy>;

/** One of the {@link RATE_LIMIT_POLICIES}. */
export type RateLimitPolicyName = keyof typeof RATE_LIMIT_POLICIES;
