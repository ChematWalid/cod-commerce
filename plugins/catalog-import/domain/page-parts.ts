import { TextNode } from 'node-html-parser';
import { PAGE_MAX_LD_BLOCKS, PAGE_MAX_METAS } from './constants';

/** One `<meta>` a page states: its `property` (else `name`), lower-cased, and its decoded `content`. */
export interface PageMeta {
  readonly key: string;
  readonly content: string;
}

/** The parts of a page a product is read from (D2275): its wanted metas, its first `<title>` and its JSON-LD blocks. */
export interface PageParts {
  readonly title?: string;
  readonly metas: readonly PageMeta[];
  readonly ldBlocks: readonly string[];
}

const LD_JSON_TYPE = 'application/ld+json';
/** Elements whose content is text up to their end tag, never markup: a `<meta>` inside them is not one. */
const RAW_TEXT_ELEMENTS: ReadonlySet<string> = new Set(['script', 'style', 'title', 'textarea']);
const KEPT_ATTRIBUTES: ReadonlySet<string> = new Set(['property', 'name', 'content', 'type']);
const TAG_NAME = /[a-zA-Z][^\s/>]*/y;
/** One attribute: its name and its double-quoted, single-quoted or bare value; an unclosed quote runs to the end. */
const ATTRIBUTE = /[\s/]*([^\s/>"'=][^\s/>=]*)(?:\s*=\s*(?:"([^"]*)"?|'([^']*)'?|([^\s>]*)))?/y;
const TAG_GAP = /[\s/]*/y;
/** A comment after its `<`; a `<meta>` inside it is not one. */
const COMMENT_OPEN = '!--';
const COMMENT_CLOSE = '-->';

/** The page's text with its character references decoded (`&amp;`, `&eacute;`, `&#x41;`). */
const decoded = (raw: string): string => new TextNode(raw, null).text;

/** A tag's attributes (only those read, the first of each name kept, raw) and the index just past its `>`. */
interface Tag {
  readonly name: string;
  readonly attributes: ReadonlyMap<string, string>;
  readonly end: number;
}

function attributeAt(html: string, at: number): { name: string; value: string; end: number } | undefined {
  ATTRIBUTE.lastIndex = at;
  const match = ATTRIBUTE.exec(html);
  if (match === null) return undefined;
  const [all, name = '', double, single, bare] = match;
  return { name: name.toLowerCase(), value: double ?? single ?? bare ?? '', end: at + all.length };
}

/** Reads the attributes after a tag's name; any character no attribute can start with is skipped, one at a time. */
function tagAt(html: string, name: string, from: number): Tag {
  const attributes = new Map<string, string>();
  let at = from;
  while (at < html.length) {
    const attribute = attributeAt(html, at);
    if (attribute !== undefined) {
      if (KEPT_ATTRIBUTES.has(attribute.name) && !attributes.has(attribute.name))
        attributes.set(attribute.name, attribute.value);
      at = attribute.end;
      continue;
    }
    TAG_GAP.lastIndex = at;
    at += TAG_GAP.exec(html)?.[0].length ?? 0;
    if (html.charAt(at) === '>') return { name, attributes, end: at + 1 };
    at += 1;
  }
  return { name, attributes, end: html.length };
}

/** The index just past the next `needle`, or the end of the page when there is none. */
function pastNext(html: string, needle: string, from: number): number {
  const at = html.indexOf(needle, from);
  return at < 0 ? html.length : at + needle.length;
}

const END_TAGS: ReadonlyMap<string, RegExp> = new Map(
  [...RAW_TEXT_ELEMENTS].map((element) => [element, new RegExp(`</${element}`, 'gi')]),
);

/** A raw-text element's text up to its end tag (or the page's end) and the index just past that end tag. */
function rawTextAt(html: string, element: string, from: number): { text: string; end: number } {
  const endTag = END_TAGS.get(element);
  if (endTag === undefined) return { text: '', end: from };
  endTag.lastIndex = from;
  const close = endTag.exec(html)?.index ?? html.length;
  return { text: html.slice(from, close), end: close < html.length ? pastNext(html, '>', close) : close };
}

/** What a scan has found so far; it stops keeping metas and blocks at their caps but still reads the page. */
class PartsFound {
  title: string | undefined;
  readonly metas: PageMeta[] = [];
  readonly ldBlocks: string[] = [];

  constructor(private readonly metaKeys: ReadonlySet<string>) {}

  meta(tag: Tag): void {
    const key = tag.attributes.get('property') ?? tag.attributes.get('name');
    if (key === undefined || this.metas.length >= PAGE_MAX_METAS) return;
    const wanted = decoded(key).trim().toLowerCase();
    if (this.metaKeys.has(wanted))
      this.metas.push({ key: wanted, content: decoded(tag.attributes.get('content') ?? '') });
  }

  rawText(tag: Tag, text: string): void {
    if (tag.name === 'title' && this.title === undefined) this.title = decoded(text);
    const isLd =
      decoded(tag.attributes.get('type') ?? '')
        .trim()
        .toLowerCase() === LD_JSON_TYPE;
    if (tag.name === 'script' && isLd && this.ldBlocks.length < PAGE_MAX_LD_BLOCKS) this.ldBlocks.push(text);
  }

  parts(): PageParts {
    return { ...(this.title === undefined ? {} : { title: this.title }), metas: this.metas, ldBlocks: this.ldBlocks };
  }
}

/** Reads the start tag whose name begins at `from` and, for a raw-text element, its text; answers where to go on. */
function startTagAt(html: string, from: number, found: PartsFound): number {
  TAG_NAME.lastIndex = from;
  const name = TAG_NAME.exec(html)?.[0].toLowerCase();
  if (name === undefined) return from;
  const tag = tagAt(html, name, from + name.length);
  if (name === 'meta') found.meta(tag);
  if (!RAW_TEXT_ELEMENTS.has(name)) return tag.end;
  const raw = rawTextAt(html, name, tag.end);
  found.rawText(tag, raw.text);
  return raw.end;
}

/** Handles the markup right after a `<`: a comment, an end tag or declaration, a start tag, or plain text. */
function markupAt(html: string, from: number, found: PartsFound): number {
  if (html.startsWith(COMMENT_OPEN, from)) return pastNext(html, COMMENT_CLOSE, from + COMMENT_OPEN.length);
  const next = html.charAt(from);
  if (next === '/' || next === '!' || next === '?') return pastNext(html, '>', from);
  return startTagAt(html, from, found);
}

/**
 * The metas named in `metaKeys`, the first `<title>` and the JSON-LD blocks of a page (D2275), in one forward pass:
 * every step moves on, no element tree is built and nothing is searched twice, so a hostile 2 MiB page costs time in
 * proportion to its length (the DOM parser it replaced was quadratic on
 * unclosed nesting and on repeated metas, and ran on the API's event loop).
 */
export function readPageParts(html: string, metaKeys: ReadonlySet<string>): PageParts {
  const found = new PartsFound(metaKeys);
  let at = html.indexOf('<');
  while (at >= 0) {
    at = html.indexOf('<', markupAt(html, at + 1, found));
  }
  return found.parts();
}
