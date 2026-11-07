import { accept } from '../application/use-case';

export const resolve = (value: string): boolean => accept(value);
