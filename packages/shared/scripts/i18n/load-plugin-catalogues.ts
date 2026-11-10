import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { CatalogueLocale, DashboardSource, PluginCatalogueInput } from './check-catalogues';

const DASHBOARD_DIR = 'dashboard';
const CATALOGUE_DIR = 'i18n';
const SOURCE_FILE = /\.tsx?$/;
const SKIPPED_DIRS: ReadonlySet<string> = new Set(['node_modules', 'dist']);
const LOCALES: readonly CatalogueLocale[] = ['en', 'ar', 'fr'];

/** A plugin's optional registry of ids the scan cannot see (D89). */
const REGISTRY_FILE = 'dynamic-ids.ts';

/** What `dashboard/i18n/dynamic-ids.ts` may export. */
interface Registry {
  readonly dynamicIds: readonly string[];
  readonly nonMessageLiterals: readonly string[];
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return SKIPPED_DIRS.has(name) ? [] : sourceFiles(path);
    return SOURCE_FILE.test(name) ? [path] : [];
  });
}

function stringList(module: Record<string, unknown>, name: string, file: string): readonly string[] {
  const value = module[name];
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`${file}: ${name} must be an array of strings`);
  }
  return value as string[];
}

async function loadRegistry(dashboard: string): Promise<Registry> {
  const file = join(dashboard, CATALOGUE_DIR, REGISTRY_FILE);
  if (!existsSync(file)) return { dynamicIds: [], nonMessageLiterals: [] };
  const module = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
  return {
    dynamicIds: stringList(module, 'DYNAMIC_MESSAGE_IDS', file),
    nonMessageLiterals: stringList(module, 'NON_MESSAGE_LITERALS', file),
  };
}

function readCatalogues(dashboard: string): Partial<Record<CatalogueLocale, string>> {
  const catalogues: Partial<Record<CatalogueLocale, string>> = {};
  for (const locale of LOCALES) {
    const file = join(dashboard, CATALOGUE_DIR, `${locale}.po`);
    if (existsSync(file)) catalogues[locale] = readFileSync(file, 'utf8');
  }
  return catalogues;
}

async function loadPlugin(pluginsDir: string, plugin: string): Promise<PluginCatalogueInput | null> {
  const dashboard = join(pluginsDir, plugin, DASHBOARD_DIR);
  if (!existsSync(dashboard)) return null;
  const sources: DashboardSource[] = sourceFiles(dashboard).map((path) => ({
    path: relative(pluginsDir, path),
    text: readFileSync(path, 'utf8'),
  }));
  const registry = await loadRegistry(dashboard);
  return { plugin, sources, catalogues: readCatalogues(dashboard), ...registry };
}

/** Reads every `plugins/<name>/dashboard`: its `.ts`/`.tsx` sources, its `.po` catalogues and its id registry. */
export async function loadPluginCatalogues(pluginsDir: string): Promise<PluginCatalogueInput[]> {
  const names = readdirSync(pluginsDir).filter((name) => statSync(join(pluginsDir, name)).isDirectory());
  const plugins = await Promise.all(names.sort().map((name) => loadPlugin(pluginsDir, name)));
  return plugins.filter((plugin): plugin is PluginCatalogueInput => plugin !== null);
}
