import { isValid } from '../domain/rule';

export const accept = (value: string): boolean => isValid(value);
