import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'

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
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err)
  } else if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message })
  } else if (err instanceof ZodError) {
    const issue = err.issues[0]
    res.status(400).json({ error: `${issue.path.join('.') || 'body'}: ${issue.message}` })
  } else if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Request body is not valid JSON' })
  } else if (isClientError(err)) {
    // body-parser and raw-body errors: oversized or malformed bodies, unsupported charsets
    res.status(err.status).json({ error: err.message })
  } else {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

function isClientError(err: unknown): err is Error & { status: number; expose: true } {
  const e = err as { status?: unknown; expose?: unknown }
  return (
    err instanceof Error &&
    typeof e.status === 'number' &&
    e.status >= 400 &&
    e.status < 500 &&
    e.expose === true
  )
}
