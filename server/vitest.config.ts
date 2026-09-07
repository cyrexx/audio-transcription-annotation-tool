import { defineConfig } from 'vitest/config'
import { TEST_DATABASE_URL } from './test/testDatabase.ts'

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
          env: { DATABASE_URL: TEST_DATABASE_URL, STORAGE_DIR: 'storage-test', MAX_UPLOAD_MB: '1' },
          fileParallelism: false,
        },
      },
    ],
  },
})
