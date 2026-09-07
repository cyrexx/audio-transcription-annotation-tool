/**
 * Pushes the files in demo/ through the same ingest code the API uses, so the demo
 * exercises the real validation, routing and pairing logic. Safe to run twice.
 */
import { copyFile, mkdir, readdir, readFile, stat } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { AUDIO_EXTENSIONS } from '../src/audio/analyze.ts'
import { config } from '../src/config.ts'
import { prisma } from '../src/db.ts'
import { HttpError } from '../src/errors.ts'
import { importTranscripts, ingestAudio } from '../src/services/ingest.ts'

const DEMO_DIR = path.resolve(import.meta.dirname, '../../demo')

async function seedAudio() {
  const audioDir = path.join(DEMO_DIR, 'audio')
  const files = (await readdir(audioDir))
    .filter((f) => path.extname(f).toLowerCase() in AUDIO_EXTENSIONS)
    .sort()
  if (files.length === 0) console.log('No audio files in demo/audio; nothing to seed')

  for (const filename of files) {
    if (await prisma.item.findUnique({ where: { filename } })) {
      console.log(`${filename}: already seeded`)
      continue
    }
    const source = path.join(audioDir, filename)
    const stored = path.join(
      config.storageDir,
      `${randomUUID()}${path.extname(filename).toLowerCase()}`,
    )
    await copyFile(source, stored)
    try {
      const result = await ingestAudio({
        path: stored,
        originalName: filename,
        size: (await stat(source)).size,
      })
      console.log(`${filename}: ${result.durationSec.toFixed(1)} s, ${result.status}`)
    } catch (e) {
      if (e instanceof HttpError) console.log(`${filename}: rejected (${e.message})`)
      else throw e
    }
  }
}

async function seedTranscripts() {
  const report = await importTranscripts(
    await readFile(path.join(DEMO_DIR, 'transcripts.json'), 'utf8'),
  )
  console.log(
    `transcripts.json: ${report.accepted.length} accepted, ${report.rejected.length} rejected`,
  )
  for (const row of report.rejected) console.log(`  row ${row.index} (${row.path}): ${row.reason}`)
}

try {
  await mkdir(config.storageDir, { recursive: true })
  await seedAudio()
  await seedTranscripts()
} finally {
  await prisma.$disconnect()
}
