import {
  ACCOUNT_CAPACITY,
  DAY_WINDOW_SECONDS,
  HOUR_WINDOW_SECONDS,
  IP_CAPACITY,
  MINUTE_WINDOW_SECONDS,
  OTP_DAILY_CAPACITY,
  REGISTER_IP_CAPACITY,
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
} as const satisfies Record<string, RateLimitPolicy>;

/** One of the {@link RATE_LIMIT_POLICIES}. */
export type RateLimitPolicyName = keyof typeof RATE_LIMIT_POLICIES;
