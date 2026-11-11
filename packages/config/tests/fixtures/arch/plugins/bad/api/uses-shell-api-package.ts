import { registerShellPage } from '@cod/plugin-merchant-shell/shell-api';

/** Forbidden: only a dashboard may import the shell api (D83). */
export const leakedByPackage = registerShellPage;
