import { catalogNameKey } from '@cod/shared';

/**
 * How two names compare: without outer spaces, case and Unicode form, so "Red ", "red" and an NFD "red" are one.
 * Option names and values and SKUs (Task 9), brand and tag names (D2140) and custom attribute names use it: one rule,
 * the shared {@link catalogNameKey}.
 */
export const comparableText = (text: string): string => catalogNameKey(text);
