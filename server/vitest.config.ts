import { defineConfig } from 'vitest/config'
import { TEST_DATABASE_URL, TEST_STORAGE_DIR } from './test/testEnv.ts'

export default defineConfig({
  test: {
    projects: [
      {
        test: { name: 'server:unit', include: ['src/**/*.test.ts'] },
      },
      {
        test: {
          name: 'server:integration',
          include: ['test/**/*.test.ts'],
          globalSetup: ['test/globalSetup.ts'],
          env: {
            DATABASE_URL: TEST_DATABASE_URL,
            STORAGE_DIR: TEST_STORAGE_DIR,
            MAX_UPLOAD_MB: '1',
          },
          fileParallelism: false,
        },
      },
    ],
  },
})
