import path from 'node:path'

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
