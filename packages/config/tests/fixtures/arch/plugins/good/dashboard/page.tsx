import { isValid } from '../domain/rule';

export const canSubmit = (value: string): boolean => isValid(value);
