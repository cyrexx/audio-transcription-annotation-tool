import path from 'node:path'

/** Shared by vitest.config.ts and globalSetup.ts so both are defined once, as absolute paths. */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://annotator:annotator@localhost:5432/annotation_test'

export const TEST_STORAGE_DIR = path.resolve(import.meta.dirname, '..', 'storage-test')
