// The public entry of collections-rules (D2317, rule `collections-entry-infra-only`): another plugin imports it only
// from its infrastructure/, its root *.plugin.ts file or its tests/; of the apps only apps/server does.
export { CollectionsRulesPlugin } from './collections-rules.plugin';
