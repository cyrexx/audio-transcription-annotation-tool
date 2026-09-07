/** Shared by vitest.config.ts and globalSetup.ts so the URL is defined once. */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://annotator:annotator@localhost:5432/annotation_test'
