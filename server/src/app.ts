import { mkdirSync } from 'node:fs'
import express from 'express'
import { config } from './config.ts'
import { errorHandler } from './errors.ts'
import { api } from './routes.ts'

export function createApp() {
  mkdirSync(config.storageDir, { recursive: true })
  const app = express()
  app.use(express.json({ limit: '10mb' }))
  app.use(express.text({ type: 'text/plain', limit: '10mb' }))
  app.use('/api', api)
  app.use(errorHandler)
  return app
}
