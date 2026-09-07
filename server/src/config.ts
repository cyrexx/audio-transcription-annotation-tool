import path from 'node:path'

// Every entry point (server, seed, Prisma config) imports this module first, so the version
// check runs before anything that would fail cryptically on an older Node.
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
  ffmpegPath: process.env.FFMPEG_PATH ?? 'ffmpeg',
}
