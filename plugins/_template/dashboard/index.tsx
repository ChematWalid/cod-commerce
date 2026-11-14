import { defineDashboardExtension } from '@vendure/dashboard';

// No route and no nav item (D2111, TPL-2): merchants never see a stock section, and the shell's leaves hold one page
// each. `routes/notes-page.tsx` stays as reference code; a merchant page is registered with `registerShellPage`
// from `@cod/plugin-merchant-shell/shell-api`, as in `plugins/catalog/dashboard/index.tsx`.
defineDashboardExtension({});
