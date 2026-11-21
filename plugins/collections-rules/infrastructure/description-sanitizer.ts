import { Injectable } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';
import type { DescriptionSanitizerPort } from '../domain/ports/description-sanitizer.port';

/** The only markup a description keeps, the product description's allow-list (D2122, D2322). */
const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'h2', 'h3', 'blockquote', 'a'];
/** A link may point only at the web or a mail address: never `javascript:`, `data:` or a relative path. */
const ALLOWED_SCHEMES = ['http', 'https', 'mailto'];
const LINK_REL = 'noopener noreferrer';
/** `sanitize-html` keeps scheme-less (relative) hrefs, which could reach any path of the storefront; they are dropped. */
const ABSOLUTE_HREF = /^(?:https?:\/\/|mailto:)/i;

const allowedHref = (href: string | undefined): string | undefined =>
  href !== undefined && ABSOLUTE_HREF.test(href.trim()) ? href : undefined;

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: { a: ['href', 'rel'] },
  allowedSchemes: ALLOWED_SCHEMES,
  allowedSchemesAppliedToAttributes: ['href'],
  allowProtocolRelative: false,
  // Dropped with their content: script and style text must never show as collection copy.
  nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'iframe'],
  transformTags: {
    a: (tagName, attribs) => {
      const href = allowedHref(attribs['href']);
      return { tagName, attribs: { ...(href === undefined ? {} : { href }), rel: LINK_REL } };
    },
  },
};

/** {@link DescriptionSanitizerPort} on `sanitize-html`, a copy of the catalog's (a plugin never imports another's internals). */
@Injectable()
export class HtmlDescriptionSanitizer implements DescriptionSanitizerPort {
  sanitize(html: string): string {
    return sanitizeHtml(html, OPTIONS);
  }
}
