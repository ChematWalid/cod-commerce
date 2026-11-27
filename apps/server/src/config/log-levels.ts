import { LogLevel } from '@vendure/core';
import type { LogLevelName } from './env';

/** `LOG_LEVEL` mapped onto Vendure's levels, for the console logger and the OpenTelemetry logger's console copy. */
export const VENDURE_LOG_LEVELS: Readonly<Record<LogLevelName, LogLevel>> = {
  error: LogLevel.Error,
  warn: LogLevel.Warn,
  info: LogLevel.Info,
  verbose: LogLevel.Verbose,
  debug: LogLevel.Debug,
};
