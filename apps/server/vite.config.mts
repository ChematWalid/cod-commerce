import { fileURLToPath, pathToFileURL } from 'node:url';
import { vendureDashboardPlugin } from '@vendure/dashboard/vite';
import { defaultClientConditions, defineConfig, type Plugin, searchForWorkspaceRoot } from 'vite';
import { DEV_API_PORT } from './src/config/ports.js';

/**
 * Workspace packages are read from their source, like the host-run server does. `vendureDashboardPlugin`
 * (3.8.1) replaces `resolve` wholesale in its `config` hook, so a top-level `resolve.conditions` would be
 * dropped: this plugin adds the conditions back after it.
 */
const workspaceSourceConditions: Plugin = {
  name: 'cod:workspace-source-conditions',
  enforce: 'post',
  config: () => ({ resolve: { conditions: ['@cod/source', ...defaultClientConditions] } }),
};

/** The dashboard of the api role (ADR 0010): `build:dashboard` writes it where `DashboardPlugin` serves it. */
export default defineConfig(({ mode }) => {
  const production = mode === 'production';
  return {
    base: '/dashboard',
    build: { outDir: 'dist/dashboard' },
    // The plugin dashboards and the font files live outside this package.
    server: { fs: { allow: [searchForWorkspaceRoot(process.cwd())] } },
    plugins: [
      vendureDashboardPlugin({
        vendureConfigPath: pathToFileURL('./src/vendure-config.ts'),
        // The built dashboard calls the api that serves it; `vite dev` calls the host-run api.
        api: production
          ? { host: 'auto', port: 'auto' }
          : { host: 'http://localhost', port: Number(process.env['API_PORT'] ?? DEV_API_PORT) },
        gqlOutputPath: './src/gql',
        // The plugin guesses the folder from where @vendure/core resolves, which under pnpm is the store; the
        // workspace plugins are linked into this package's node_modules, so it must scan this one.
        pluginPackageScanner: { nodeModulesRoot: fileURLToPath(new URL('./node_modules', import.meta.url)) },
      }),
      workspaceSourceConditions,
    ],
  };
});
