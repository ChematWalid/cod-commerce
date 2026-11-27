import { captureException } from '@sentry/node';
import { type ErrorHandlerStrategy, I18nError, type Job, LogLevel } from '@vendure/core';

/** Sends one error with its tags; Sentry's `captureException` in production. */
export type CaptureError = (error: Error, tags: Readonly<Record<string, string>>) => void;

const sentryCapture: CaptureError = (error, tags) => {
  captureException(error, { tags });
};

/**
 * Errors a caller caused (bad input, not found, forbidden) are Vendure `I18nError`s below the error log level: they
 * are answered, not bugs, and would spend the Sentry quota (5 k errors at Launch, ADR 0015).
 */
const isCallerError = (error: Error): boolean => error instanceof I18nError && error.logLevel !== LogLevel.Error;

/** Forwards the api's and the worker's unexpected errors to Sentry. Registered only when `SENTRY_DSN` is set. */
export class SentryErrorHandlerStrategy implements ErrorHandlerStrategy {
  constructor(private readonly capture: CaptureError = sentryCapture) {}

  handleServerError(exception: Error): void {
    if (isCallerError(exception)) return;
    this.capture(exception, { source: 'api' });
  }

  /** Every failed attempt is reported with its queue name; job data is never attached (it can hold buyer details). */
  handleWorkerError(exception: Error, context: { job: Job }): void {
    this.capture(exception, { source: 'worker', queue: context.job.queueName });
  }
}
