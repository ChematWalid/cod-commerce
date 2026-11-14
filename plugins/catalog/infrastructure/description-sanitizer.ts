import { Injectable } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';
import type { DescriptionSanitizerPort } from '../domain/ports/description-sanitizer.port';

/** The only markup a description keeps (D2122); everything else is dropped, its text kept. */
const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'h2', 'h3', 'blockquote', 'a'];
/** A link may point only at the web or a mail address: never `javascript:`, `data:` or a relative path. */
const ALLOWED_SCHEMES = ['http', 'https', 'mailto'];
const LINK_REL = 'noopener noreferrer';

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: { a: ['href', 'rel'] },
  allowedSchemes: ALLOWED_SCHEMES,
  allowedSchemesAppliedToAttributes: ['href'],
  allowProtocolRelative: false,
  // Dropped with their content: script and style text must never show as product copy.
  nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'iframe'],
  transformTags: {
    a: (tagName, attribs) => {
      const { href } = attribs;
      return { tagName, attribs: { ...(href === undefined ? {} : { href }), rel: LINK_REL } };
    },
  },
};

/** {@link DescriptionSanitizerPort} on `sanitize-html` with the allow-list of D2122. */
@Injectable()
export class HtmlDescriptionSanitizer implements DescriptionSanitizerPort {
  sanitize(html: string): string {
    return sanitizeHtml(html, OPTIONS);
  }
}
