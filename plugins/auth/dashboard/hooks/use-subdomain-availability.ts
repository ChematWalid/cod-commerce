import type { SubdomainAvailability } from '@cod/shared';
import { getApiBaseUrl } from '@/vdb/utils/config-utils.js';
import { useEffect, useState } from 'react';
import {
  HTTP_TOO_MANY_REQUESTS,
  MS_PER_SECOND,
  SUBDOMAIN_AVAILABILITY_ENDPOINT,
  SUBDOMAIN_AVAILABLE_MESSAGE_ID,
  SUBDOMAIN_CHECK_FAILED_MESSAGE_ID,
  SUBDOMAIN_CHECKING_MESSAGE_ID,
  SUBDOMAIN_DEBOUNCE_MS,
  SUBDOMAIN_RATE_LIMITED_MESSAGE_ID,
  SUBDOMAIN_REASON_MESSAGE_IDS,
  SUBDOMAIN_RETRY_FALLBACK_SECONDS,
} from '../constants';

/** What the field shows; Create is enabled only by `available`. */
export interface SubdomainCheck {
  readonly state: 'idle' | 'checking' | 'available' | 'unavailable';
  readonly messageId: string | null;
}

interface Answer extends SubdomainCheck {
  readonly subdomain: string;
  readonly retryAfterMs?: number;
}

const IDLE: SubdomainCheck = { state: 'idle', messageId: null };
const CHECKING: SubdomainCheck = { state: 'checking', messageId: SUBDOMAIN_CHECKING_MESSAGE_ID };

function retryDelayMs(header: string | null): number {
  const seconds = Number(header);
  return (Number.isFinite(seconds) && seconds > 0 ? seconds : SUBDOMAIN_RETRY_FALLBACK_SECONDS) * MS_PER_SECOND;
}

function toAnswer(subdomain: string, body: SubdomainAvailability): Answer {
  if (body.status === 'available') {
    return { subdomain, state: 'available', messageId: SUBDOMAIN_AVAILABLE_MESSAGE_ID };
  }
  const messageId =
    body.reasonCode === null ? SUBDOMAIN_CHECK_FAILED_MESSAGE_ID : SUBDOMAIN_REASON_MESSAGE_IDS[body.reasonCode];
  return { subdomain, state: 'unavailable', messageId };
}

async function askServer(subdomain: string, signal: AbortSignal): Promise<Answer> {
  const url = `${getApiBaseUrl()}${SUBDOMAIN_AVAILABILITY_ENDPOINT}?subdomain=${encodeURIComponent(subdomain)}`;
  const response = await fetch(url, { signal });
  if (response.status === HTTP_TOO_MANY_REQUESTS) {
    const retryAfterMs = retryDelayMs(response.headers.get('Retry-After'));
    return { subdomain, state: 'unavailable', messageId: SUBDOMAIN_RATE_LIMITED_MESSAGE_ID, retryAfterMs };
  }
  if (!response.ok) throw new Error(`Subdomain check answered ${String(response.status)}`);
  return toAnswer(subdomain, (await response.json()) as SubdomainAvailability);
}

/**
 * Checks a subdomain 400 ms after the last change. A check still running for an earlier value is aborted, so a
 * late answer can never mark the current value available. Over the rate limit it stays unavailable and asks
 * again once `Retry-After` has passed.
 */
export function useSubdomainAvailability(subdomain: string): SubdomainCheck {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (subdomain === '') return undefined;
    const controller = new AbortController();
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const run = async (): Promise<void> => {
      try {
        const result = await askServer(subdomain, controller.signal);
        setAnswer(result);
        if (result.retryAfterMs !== undefined) {
          retryTimer = setTimeout(() => {
            setAttempt((count) => count + 1);
          }, result.retryAfterMs);
        }
      } catch (error: unknown) {
        if (controller.signal.aborted) return;
        console.error('Subdomain availability check failed', error);
        setAnswer({ subdomain, state: 'unavailable', messageId: SUBDOMAIN_CHECK_FAILED_MESSAGE_ID });
      }
    };
    const debounce = setTimeout(() => void run(), SUBDOMAIN_DEBOUNCE_MS);
    return () => {
      clearTimeout(debounce);
      clearTimeout(retryTimer);
      controller.abort();
    };
  }, [subdomain, attempt]);
  if (subdomain === '') return IDLE;
  return answer?.subdomain === subdomain ? answer : CHECKING;
}
