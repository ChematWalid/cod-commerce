import { beforeAll, describe, expect, it } from 'vitest';
import { CONFIG_LOAD_TIMEOUT_MS, lintSource, loadConfig, PLUGIN } from './lint-fixtures';

const RULE = 'cod/no-foreign-plugin-options';
const TENANCY_PLUGIN_FILE = 'plugins/tenancy/tenancy.plugin.ts';
const SERVER_FILE = 'apps/server/src/config/plugins.config.ts';

/** A plugin class whose `init` runs `statement`, as every real plugin registers its options. */
const pluginWithInit = (statement: string): string =>
  `export class TenancyPlugin {\n  static options: unknown;\n  static init(options: { redisUrl: string }): typeof TenancyPlugin {\n    ${statement}\n    return TenancyPlugin;\n  }\n}\n`;

/** The line audit finding M2 removed from the tenancy plugin. */
const TENANCY_WROTE_RATE_LIMIT = "RateLimitPlugin.options ??= { redisUrl: options.redisUrl, clientIpHeader: '' };";

const FOREIGN_WRITES = [
  ['=', 'OtherPlugin.options = options;'],
  ['??=', 'OtherPlugin.options ??= options;'],
  ['||=', 'OtherPlugin.options ||= options;'],
  ['&&=', 'OtherPlugin.options &&= options;'],
  ['= on config', 'OtherPlugin.config = options;'],
  ['= on a computed key', "OtherPlugin['options'] = options;"],
] as const;

describe("a plugin's static options are written only by the plugin itself (CLAUDE.md §3a.2)", () => {
  beforeAll(loadConfig, CONFIG_LOAD_TIMEOUT_MS);

  it('rejects the tenancy plugin configuring the rate-limit plugin from its own init', async () => {
    const source = `import { RateLimitPlugin } from '@cod/plugin-rate-limit';\n${pluginWithInit(TENANCY_WROTE_RATE_LIMIT)}`;

    expect(await lintSource(source, TENANCY_PLUGIN_FILE)).toContain(RULE);
  });

  it.each(FOREIGN_WRITES)("rejects an app writing another plugin's static state with %s", async (_operator, write) => {
    const source = `import { OtherPlugin } from '@cod/plugin-other';\nexport const configure = (options: object): void => {\n  ${write}\n};\n`;

    expect(await lintSource(source, SERVER_FILE)).toContain(RULE);
  });

  it.each(['api/x.resolver.ts', 'infrastructure/x.adapter.ts', 'application/x.service.ts'])(
    "rejects a plugin's %s writing another plugin's static options",
    async (file) => {
      const source = 'declare const OtherPlugin: { options: unknown };\nOtherPlugin.options = {};\n';

      expect(await lintSource(source, `${PLUGIN}/${file}`)).toContain(RULE);
    },
  );

  it.each(['TenancyPlugin.options = options;', 'this.options = options;', 'TenancyPlugin.options ??= options;'])(
    'lets a plugin register its own options in its own file with `%s`',
    async (statement) => {
      expect(await lintSource(pluginWithInit(statement), TENANCY_PLUGIN_FILE)).not.toContain(RULE);
    },
  );

  it('lets any file read a plugin option or write an unrelated `options` member', async () => {
    const source =
      'declare const OtherPlugin: { options: unknown };\ndeclare const client: { options: unknown };\nexport const read = OtherPlugin.options;\nclient.options = read;\n';

    expect(await lintSource(source, SERVER_FILE)).not.toContain(RULE);
  });

  it.each([`${PLUGIN}/tests/unit/x.test.ts`, 'apps/server/tests/unit/x.test.ts'])(
    'lets the test %s reset a plugin between cases',
    async (file) => {
      const source = 'declare const OtherPlugin: { options: unknown };\nOtherPlugin.options = undefined;\n';

      expect(await lintSource(source, file)).not.toContain(RULE);
    },
  );
});
