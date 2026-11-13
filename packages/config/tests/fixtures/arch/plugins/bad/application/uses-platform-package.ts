import { platformJobsEntry } from '@cod/plugin-platform-jobs';

/** Forbidden: application/ reaching a platform entry point through the package name. */
export const usesPlatformPackage = platformJobsEntry;
