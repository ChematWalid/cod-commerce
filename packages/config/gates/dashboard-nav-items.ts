import type { SourceFile } from './branding';

/**
 * The stock dashboard's top-level sections: the values of `BUILT_IN_NAV_SECTION_IDS` in `@vendure/dashboard` 3.8
 * (a test keeps the two equal). A merchant page lives in the shell's own navigation (`registerShellPage`, ADR 0010);
 * a plugin nav item in any of these would put a stock section back in front of merchants (#122, D2111, rule 18).
 * No stock section is allowed for staff either: staff pages use the own `platform` section.
 */
export const STOCK_NAV_SECTION_IDS: readonly string[] = [
  'insights',
  'catalog',
  'sales',
  'customers',
  'marketing',
  'system',
  'settings',
];

/** The plugin that owns the sidebar: its `navSections` function reshapes the stock sections for merchants (ADR 0010). */
export const NAV_OWNER_PLUGIN = 'merchant-shell';

/** Dashboard sources of a plugin, `plugins/<name>/dashboard/**`, in any JavaScript or TypeScript flavour. */
const DASHBOARD_SOURCE = /^plugins\/([^/]+)\/dashboard\/.+\.[cm]?[jt]sx?$/;

/** A quoted string, or a name or member chain such as `SECTION` or `IDS.catalog`. */
const VALUE = String.raw`(?:(['"\x60])([^'"\x60\n]{0,80})\1|([A-Za-z_$][\w$.]{0,120}))`;
/** `sectionId: <value>`; `sectionId?: string` is a type and does not match. */
const SECTION_ID = new RegExp(String.raw`\bsectionId\s*:\s*${VALUE}`, 'g');
/** The shorthand `{ sectionId }`. */
const SECTION_ID_SHORTHAND = /[{,]\s*sectionId\s*(?=[,}])/g;
/** `id: <value>`, an entry of a `navSections` array. */
const ENTRY_ID = new RegExp(String.raw`\bid\s*:\s*${VALUE}`, 'g');
/** `const NAME = 'value'` (with an optional type), the definition a named section refers to. */
const STRING_CONSTANT = /\bconst\s+([A-Za-z_$][\w$]{0,80})\s*(?::[^=\n]{0,80})?=\s*(['"`])([^'"`\n]{0,80})\2/g;
const NAV_SECTIONS = /\bnavSections\b/g;
const NAV_SECTIONS_ARRAY = /^\s*:\s*\[/;
const BUILT_IN_IDS_REFERENCE = /\bBUILT_IN_NAV_SECTION_IDS\b/;
/** Type annotations that read like a value: `sectionId: string`. */
const TYPE_NAMES: ReadonlySet<string> = new Set(['string']);

/** A section reference as written: a literal, or a name the gate must resolve. */
type SectionRef = { readonly literal: string } | { readonly name: string };

/** A plugin's string constants by name; `null` marks a name declared twice with different values. */
type Constants = ReadonlyMap<string, string | null>;

/** The string constants of each plugin's dashboard sources, keyed by plugin name, so equal names never collide. */
function constantsByPlugin(files: readonly SourceFile[]): ReadonlyMap<string, Constants> {
  const byPlugin = new Map<string, Map<string, string | null>>();
  for (const { path, content } of files) {
    const plugin = pluginOf(path);
    const constants = byPlugin.get(plugin) ?? new Map<string, string | null>();
    byPlugin.set(plugin, constants);
    for (const match of content.matchAll(STRING_CONSTANT)) {
      const [name, value] = [match[1] ?? '', match[3] ?? ''];
      const known = constants.get(name);
      constants.set(name, known === undefined || known === value ? value : null);
    }
  }
  return byPlugin;
}

function pluginOf(path: string): string {
  return DASHBOARD_SOURCE.exec(path)?.[1] ?? '';
}

function refOf(match: RegExpMatchArray): SectionRef {
  return match[3] === undefined ? { literal: match[2] ?? '' } : { name: match[3] };
}

/** The section ids a file names in `sectionId`, as written; the shorthand names the local `sectionId`. */
function sectionIdRefs(content: string): SectionRef[] {
  const named = [...content.matchAll(SECTION_ID)].map(refOf);
  const shorthand = [...content.matchAll(SECTION_ID_SHORTHAND)].map(() => ({ name: 'sectionId' }));
  return [...named, ...shorthand].filter((ref) => !('name' in ref && TYPE_NAMES.has(ref.name)));
}

/** The text of the array that opens at `start` (a `[`), brackets balanced. */
function arrayAt(content: string, start: number): string {
  let depth = 0;
  for (let index = start; index < content.length; index += 1) {
    depth += content[index] === '[' ? 1 : content[index] === ']' ? -1 : 0;
    if (depth === 0) return content.slice(start, index + 1);
  }
  return content.slice(start);
}

/** Problems with `navSections`: a function form outside the owner, and every entry id of an array form. */
function navSectionsFindings(content: string, plugin: string): { refs: SectionRef[]; problems: string[] } {
  const refs: SectionRef[] = [];
  const problems: string[] = [];
  for (const match of content.matchAll(NAV_SECTIONS)) {
    const after = content.slice(match.index + match[0].length);
    const array = NAV_SECTIONS_ARRAY.exec(after);
    if (array === null) {
      if (plugin !== NAV_OWNER_PLUGIN) problems.push(`reshapes the nav with a non-array navSections (ADR 0010)`);
      continue;
    }
    refs.push(...[...arrayAt(after, array[0].length - 1).matchAll(ENTRY_ID)].map(refOf));
  }
  return { refs, problems };
}

/** Why a section reference is refused, or `undefined` when it names an own or staff section. */
function problemOf(ref: SectionRef, constants: Constants | undefined): string | undefined {
  const value = 'literal' in ref ? ref.literal : constants?.get(ref.name);
  if ('literal' in ref && ref.literal.includes('${')) return `names a nav section with a template literal`;
  if (value === undefined || value === null) {
    const name = 'name' in ref ? ref.name : '';
    return `names a nav section through '${name}', not a string literal or a const of this plugin's dashboard`;
  }
  return STOCK_NAV_SECTION_IDS.includes(value) ? `puts a nav item in the stock section '${value}'` : undefined;
}

function problemsOf(file: SourceFile, constants: Constants | undefined): string[] {
  const plugin = pluginOf(file.path);
  const navSections = navSectionsFindings(file.content, plugin);
  const refProblems = [...sectionIdRefs(file.content), ...navSections.refs].flatMap((ref) => {
    const problem = problemOf(ref, constants);
    return problem === undefined ? [] : [problem];
  });
  const builtIn =
    plugin !== NAV_OWNER_PLUGIN && BUILT_IN_IDS_REFERENCE.test(file.content)
      ? ['refers to BUILT_IN_NAV_SECTION_IDS, the stock sections']
      : [];
  return [...builtIn, ...navSections.problems, ...refProblems];
}

/**
 * Finds plugin dashboard sources that put a nav item or section in a stock dashboard section. It fails closed: a
 * section named through anything but a string literal or a `const` of the same plugin's dashboard is reported too.
 *
 * @param files the repository files to scan; only plugin dashboard sources are read
 * @returns one message per problem; empty when every nav entry is in an own or staff section
 */
export function findStockNavSections(files: readonly SourceFile[]): string[] {
  const dashboardFiles = files.filter(({ path }) => DASHBOARD_SOURCE.test(path));
  const constants = constantsByPlugin(dashboardFiles);
  return dashboardFiles.flatMap((file) =>
    problemsOf(file, constants.get(pluginOf(file.path))).map((problem) => `${file.path} ${problem} (#122, D2111)`),
  );
}
