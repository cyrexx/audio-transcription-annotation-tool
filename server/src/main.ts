import { createApp } from './app.ts'
import { config } from './config.ts'

// Bound to the loopback interface only: the brief assumes one annotator on one machine and no
// authentication, so the local host is the security boundary.
createApp().listen(config.port, '127.0.0.1', () => {
  console.log(`API listening on http://localhost:${config.port}`)
})
