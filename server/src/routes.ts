import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { Router, type RequestHandler } from 'express'
import multer, { MulterError } from 'multer'
import { annotationUpdateSchema } from 'shared'
import { z } from 'zod'
import { AUDIO_EXTENSIONS } from './audio/analyze.ts'
import { config } from './config.ts'
import { HttpError } from './errors.ts'
import { exportRecords } from './services/export.ts'
import { importTranscripts, ingestAudio, pairingState } from './services/ingest.ts'
import {
  getItem,
  getItemRow,
  listItems,
  pairItem,
  pasteTranscript,
  unpairItem,
  updateAnnotation,
} from './services/items.ts'

const upload = multer({
  storage: multer.diskStorage({
    destination: config.storageDir,
    filename: (_req, file, cb) =>
      cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (ext in AUDIO_EXTENSIONS) cb(null, true)
    else
      cb(new HttpError(415, `Unsupported file type ${ext || '(none)'}; upload .wav, .mp3 or .m4a`))
  },
})

/** Every multipart parsing failure is the client's, so it answers 4xx with the parser's reason. */
const uploadOne: RequestHandler = (req, res, next) =>
  upload.single('file')(req, res, (err: unknown) => {
    if (!err || err instanceof HttpError) return next(err)
    if (err instanceof MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return next(
        new HttpError(
          413,
          `File exceeds the ${config.maxUploadBytes / 1024 / 1024} MB upload limit`,
        ),
      )
    }
    next(new HttpError(400, `Upload rejected: ${(err as Error).message}`))
  })

export const api = Router()

// Ingest -------------------------------------------------------------------------------

api.post('/audio', uploadOne, async (req, res) => {
  if (!req.file) throw new HttpError(400, 'No file in the "file" field')
  const result = await ingestAudio({
    path: req.file.path,
    originalName: req.file.originalname,
    size: req.file.size,
  })
  res.status(201).json(result)
})

api.post('/transcripts', async (req, res) => {
  if (typeof req.body !== 'string')
    throw new HttpError(400, 'Send the transcript file as text/plain')
  res.json(await importTranscripts(req.body))
})

api.get('/pairing', async (_req, res) => {
  res.json(await pairingState())
})

// Items --------------------------------------------------------------------------------

api.get('/items', async (_req, res) => {
  res.json(await listItems())
})

api.get('/items/:id', async (req, res) => {
  res.json(await getItem(req.params.id))
})

api.get('/items/:id/audio', async (req, res) => {
  const item = await getItemRow(req.params.id)
  res.type(item.mimeType).sendFile(path.join(config.storageDir, item.storagePath))
})

api.put('/items/:id/annotation', async (req, res) => {
  res.json(await updateAnnotation(req.params.id, annotationUpdateSchema.parse(req.body)))
})

api.post('/items/:id/transcript', async (req, res) => {
  const { label } = z.object({ label: z.string().trim().min(1) }).parse(req.body)
  res.json(await pasteTranscript(req.params.id, label))
})

api.post('/items/:id/pair', async (req, res) => {
  const { transcriptId } = z.object({ transcriptId: z.string() }).parse(req.body)
  await pairItem(req.params.id, transcriptId)
  res.status(204).end()
})

api.post('/items/:id/unpair', async (req, res) => {
  await unpairItem(req.params.id)
  res.status(204).end()
})

// Export -------------------------------------------------------------------------------

api.get('/export', async (req, res) => {
  const records = await exportRecords(req.query.includeUnfinished === 'true')
  res
    .attachment('gold-standard.jsonl')
    .type('application/x-ndjson')
    .send(records.map((r) => JSON.stringify(r)).join('\n') + (records.length ? '\n' : ''))
})
