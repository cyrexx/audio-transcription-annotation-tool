import path from 'node:path'

// Server, seed and Prisma config all import this module, and the check runs before the
// loadEnvFile call below, which is what an older Node would trip over first.
const nodeMajor = Number(process.versions.node.split('.')[0])
if (nodeMajor < 22) {
  console.error(
    `Node 22 or newer is required, found ${process.versions.node}. See README.md, Prerequisites.`,
  )
  process.exit(1)
}

// Optional overrides; every value has a default that works with docker-compose.yml.
try {
  process.loadEnvFile('.env')
} catch {
  // no .env file
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl:
    process.env.DATABASE_URL ?? 'postgresql://annotator:annotator@localhost:5432/annotation',
  storageDir: path.resolve(process.env.STORAGE_DIR ?? 'storage'),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB ?? 50) * 1024 * 1024,
  ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
}
