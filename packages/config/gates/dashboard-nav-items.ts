import type { SourceFile } from './branding';

/**
 * The stock dashboard's merchant sections. A merchant page lives in the shell's own navigation
 * (`registerShellPage`, ADR 0010); a nav item in one of these sections would put a stock section back in
 * front of merchants (#122, D2111). Staff sections such as `platform` stay allowed.
 */
export const STOCK_MERCHANT_SECTION_IDS: readonly string[] = ['catalog', 'sales', 'customers', 'marketing'];

/** Dashboard sources of a plugin: `plugins/<name>/dashboard/**` TypeScript and TSX. */
const DASHBOARD_SOURCE = /^plugins\/[^/]+\/dashboard\/.+\.tsx?$/;

/** `sectionId: 'catalog'`, with any quote. */
const LITERAL_SECTION = /\bsectionId\s*:\s*(['"`])([^'"`\n]{0,80})\1/g;
/** `sectionId: SOME_CONSTANT`. */
const NAMED_SECTION = /\bsectionId\s*:\s*([A-Za-z_$][\w$]{0,80})\b/g;
/** `const SOME_CONSTANT = 'value'`, the definition a named section refers to. */
const STRING_CONSTANT = /\bconst\s+([A-Za-z_$][\w$]{0,80})\s*(?::[^=\n]{0,80})?=\s*(['"`])([^'"`\n]{0,80})\2/g;

/** Every string constant declared in the dashboard sources, by name (a constant may live in another file). */
function stringConstantsOf(files: readonly SourceFile[]): ReadonlyMap<string, string> {
  const constants = new Map<string, string>();
  for (const { content } of files) {
    for (const match of content.matchAll(STRING_CONSTANT)) {
      constants.set(match[1] ?? '', match[3] ?? '');
    }
  }
  return constants;
}

/** The section ids one file names, literal or through a named constant. */
function sectionIdsOf(content: string, constants: ReadonlyMap<string, string>): string[] {
  const literal = [...content.matchAll(LITERAL_SECTION)].map((match) => match[2] ?? '');
  const named = [...content.matchAll(NAMED_SECTION)].flatMap((match) => {
    const value = constants.get(match[1] ?? '');
    return value === undefined ? [] : [value];
  });
  return [...literal, ...named];
}

/**
 * Finds plugin dashboard nav items placed in a stock merchant section.
 *
 * @param files the repository files to scan; only plugin dashboard sources are read
 * @returns one message per offending section id; empty when every nav item is in a staff or own section
 */
export function findStockNavSections(files: readonly SourceFile[]): string[] {
  const dashboardFiles = files.filter(({ path }) => DASHBOARD_SOURCE.test(path));
  const constants = stringConstantsOf(dashboardFiles);
  return dashboardFiles.flatMap(({ path, content }) =>
    sectionIdsOf(content, constants)
      .filter((sectionId) => STOCK_MERCHANT_SECTION_IDS.includes(sectionId))
      .map((sectionId) => `${path} puts a nav item in the stock merchant section '${sectionId}' (#122, D2111)`),
  );
}
