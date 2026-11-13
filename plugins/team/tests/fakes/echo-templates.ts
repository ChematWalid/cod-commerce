/** A rendered message, in the shape auth's templates port returns. */
interface EchoedEmail {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

/**
 * Renders each variable on its own line, so a test reads the link straight from the mailbox. It fits auth's
 * `AuthEmailTemplatesPort` by shape: a test support file may not import another plugin's entry point.
 */
export class EchoTemplates {
  render(kind: string, locale: string, vars: Readonly<Record<string, string>>): EchoedEmail {
    const body = Object.entries(vars)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    return { subject: `${kind}/${locale}`, html: `<p>${body}</p>`, text: body };
  }
}
