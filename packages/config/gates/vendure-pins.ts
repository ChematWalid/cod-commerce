/** The dependencies one `package.json` declares, keyed by package name. */
export interface ManifestDeps {
  readonly path: string;
  readonly deps: Readonly<Record<string, string>>;
}

const VENDURE_SCOPE = '@vendure/';
/** pnpm names patch files after the patched package, e.g. `@vendure__core@3.8.1.patch`. */
const VENDURE_PATCH = /^@vendure__/;
const EXACT_VERSION = /^\d+\.\d+\.\d+$/;

interface VendureDep {
  readonly manifest: string;
  readonly name: string;
  readonly version: string;
}

const vendureDeps = (manifests: readonly ManifestDeps[]): VendureDep[] =>
  manifests.flatMap(({ path, deps }) =>
    Object.entries(deps)
      .filter(([name]) => name.startsWith(VENDURE_SCOPE))
      .map(([name, version]) => ({ manifest: path, name, version })),
  );

const describeDep = ({ manifest, name, version }: VendureDep): string => `${name}@${version} (${manifest})`;

const rangeViolations = (deps: readonly VendureDep[]): string[] =>
  deps
    .filter(({ version }) => !EXACT_VERSION.test(version))
    .map((dep) => `${describeDep(dep)} is not an exact version`);

const mixedVersionViolations = (deps: readonly VendureDep[]): string[] => {
  const versions = new Set(deps.map(({ version }) => version));
  return versions.size > 1 ? [`@vendure packages use more than one version: ${deps.map(describeDep).join(', ')}`] : [];
};

const patchViolations = (patchFiles: readonly string[]): string[] =>
  patchFiles
    .filter((file) => VENDURE_PATCH.test(file))
    .map((file) => `patches/${file} patches Vendure; core fixes need a reviewed vendure-patch PR (ADR 0001)`);

/**
 * Checks the ADR 0001 Vendure pin: every `@vendure/*` dependency of every manifest uses one and the same
 * exact version, and no patch file targets a `@vendure/*` package.
 *
 * @param manifests the dependencies of every workspace `package.json`
 * @param patchFiles the file names in `patches/`
 * @returns one message per violation; empty when the pin holds
 */
export function findVendurePinViolations(manifests: readonly ManifestDeps[], patchFiles: readonly string[]): string[] {
  const deps = vendureDeps(manifests);
  const ranges = rangeViolations(deps);
  const mixed = ranges.length > 0 ? [] : mixedVersionViolations(deps);
  return [...ranges, ...mixed, ...patchViolations(patchFiles)];
}
