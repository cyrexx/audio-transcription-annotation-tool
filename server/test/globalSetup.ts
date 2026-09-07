import { execSync } from 'node:child_process'
import path from 'node:path'
import { TEST_DATABASE_URL } from './testDatabase.ts'

/** Brings the test database to the current migration state before the suite runs. */
export default function setup() {
  try {
    execSync('yarn prisma migrate deploy', {
      cwd: path.resolve(import.meta.dirname, '..'),
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: 'pipe',
    })
  } catch (e) {
    const stderr = (e as { stderr?: Buffer }).stderr?.toString() ?? ''
    throw new Error(
      `Could not prepare the test database at ${TEST_DATABASE_URL}.\n` +
        `Is Postgres running? Start it with "docker compose up -d" in the repo root.\n${stderr}`,
      { cause: e },
    )
  }
}
