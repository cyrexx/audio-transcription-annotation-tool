import request from 'supertest'
import { createApp } from '../../src/app.ts'
import { prisma } from '../../src/db.ts'
import { synthWav, type SynthWavOptions } from './synthWav.ts'

export const app = createApp()
export const api = () => request(app)

export async function resetDb() {
  await prisma.$executeRawUnsafe('TRUNCATE "Span", "Item", "Transcript" CASCADE')
}

export function uploadWav(name: string, options: SynthWavOptions) {
  return api().post('/api/audio').attach('file', synthWav(options), name)
}

export function importTranscripts(body: unknown) {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return api().post('/api/transcripts').set('Content-Type', 'text/plain').send(text)
}

/** An item over the 15-second limit, paired with the given transcript label. */
export async function createPairedItem(filename: string, label: string): Promise<string> {
  const { body } = await uploadWav(filename, { seconds: 20 }).expect(201)
  await importTranscripts([{ path: `audio/${filename}`, label }]).expect(200)
  return body.itemId
}
