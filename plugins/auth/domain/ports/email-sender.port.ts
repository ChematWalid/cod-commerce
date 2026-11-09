/** One message to one recipient. */
export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

/** Hands a message to a mail server (D32). */
export interface EmailSenderPort {
  /** Resolves when the server accepted the message; rejects otherwise, so the queue retries. */
  send(message: EmailMessage): Promise<void>;
}
