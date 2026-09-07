import type { ErrorRequestHandler } from 'express'
import { MulterError } from 'multer'
import { ZodError } from 'zod'
import { config } from './config.ts'

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} not found`)

/** Turns every error into a JSON `{ error }` body with a fitting status code. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message })
  } else if (err instanceof ZodError) {
    const issue = err.issues[0]
    res.status(400).json({ error: `${issue.path.join('.') || 'body'}: ${issue.message}` })
  } else if (err instanceof MulterError && err.code === 'LIMIT_FILE_SIZE') {
    const mb = config.maxUploadBytes / 1024 / 1024
    res.status(413).json({ error: `File exceeds the ${mb} MB upload limit` })
  } else if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Request body is not valid JSON' })
  } else {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
