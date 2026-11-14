/**
 * How two names compare: without outer spaces, case and Unicode form, so "Red ", "red" and an NFD "red" are one.
 * Option names and values (Task 9) and brand and tag names (D2140) use it.
 */
export const comparableText = (text: string): string => text.trim().normalize('NFC').toLowerCase();
