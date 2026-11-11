import { testPath } from '../../plugins/good/tests/unit/helper';

/** Forbidden: an app's production code importing a plugin's tests. */
export const leakedTestPath = testPath;
