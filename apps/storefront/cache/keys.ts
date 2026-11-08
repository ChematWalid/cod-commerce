import { CACHE_KEY_ROOT, ISR_SEGMENT, ISR_TAG_SEGMENT, USE_CACHE_SEGMENT, USE_CACHE_TAG_SEGMENT } from './constants';

/**
 * The Valkey key of an ISR entry. Entries are namespaced by deployment, because the App Shell key has no
 * build component: without the prefix a new deployment served the previous one's shell (spike F (d)).
 */
export function isrEntryKey(deploymentId: string, key: string): string {
  return `${CACHE_KEY_ROOT}:${deploymentId}:${ISR_SEGMENT}:${key}`;
}

/** The Valkey set that indexes the ISR entries of a tag. Shared by every deployment, so revalidation reaches all. */
export function isrTagKey(tag: string): string {
  return `${CACHE_KEY_ROOT}:${ISR_TAG_SEGMENT}:${tag}`;
}

/** The Valkey key of a `'use cache'` entry, namespaced by deployment like {@link isrEntryKey}. */
export function useCacheEntryKey(deploymentId: string, key: string): string {
  return `${CACHE_KEY_ROOT}:${deploymentId}:${USE_CACHE_SEGMENT}:${key}`;
}

/** The Valkey key holding a `'use cache'` tag's last revalidation time. Shared by every deployment. */
export function useCacheTagKey(tag: string): string {
  return `${CACHE_KEY_ROOT}:${USE_CACHE_TAG_SEGMENT}:${tag}`;
}
