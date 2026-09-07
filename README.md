# Audio Transcription Annotation Tool

A web tool for annotators who correct and enrich first-pass speech-to-text transcripts of German
clinical dictations. Upload audio and model transcripts, pair them, listen, correct the text, mark
typed spans (numbers, formatting commands, spelled-out words, named entities, medical terms,
measurements), review recording conditions, and export a JSONL gold standard.

See [DESIGN.md](DESIGN.md) for the data model, trade-offs and what was cut.

## Prerequisites

| Tool                    | Version      | Notes                                                                                                                                                                         |
| ----------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js                 | **22** (LTS) | `.nvmrc` is provided; `nvm use` picks it up                                                                                                                                   |
| Yarn                    | 4            | Comes with Node via `corepack enable`; no separate install                                                                                                                    |
| Docker + Docker Compose | any recent   | Runs PostgreSQL                                                                                                                                                               |
| ffmpeg                  | optional     | Only for the microphone-distance estimate of **mp3/m4a** files. WAV never needs it. Without ffmpeg those items show "not available" and the annotator sets the value by hand. |

## Install and run

```bash
git clone <this repo> && cd audio-transcription-annotation-tool
corepack enable            # once per machine, makes `yarn` available
docker compose up -d       # PostgreSQL on localhost:5432
yarn setup                 # yarn install, database migration, demo seed
yarn dev                   # API on :3000, web app on http://localhost:5173
```

Open <http://localhost:5173>. Everything is configured with working defaults; copy
`server/.env.example` to `server/.env` only if you need to change a port, the storage folder or
the upload limit.

## Demo path (about one minute)

`yarn setup` seeds the demo recordings from `demo/` through the real ingest code, so the queue is
populated on first start.

1. **Queue** (home page): three items. Two are over 15 s and `Pending`; `003_kurznotiz.wav` is
   under 15 s and `Auto-rejected`. Filter by status and sort by duration with the column headers.
2. Open **001_leistenhernie.wav**. Type your name into the _Annotator_ box in the header.
3. Press **Alt+K** to play, **Alt+J / Alt+L** to jump. Click any word to jump the audio there.
4. **Correct the text**: switch to _Edit text_ (button or **Alt+E**), fix `Cefuroxin` to `Cefuroxim`
   and `Proleen` to `Prolene`, switch back to _Annotate_. Spans stay attached to their words.
5. **Add spans**: drag across `eintausendfuenfhundert Milligramm`, choose _MEASUREMENT_, enter
   `1500` `mg` and see the normalized `1.5 g`. Click `Cefuroxim`, choose _MEDICAL_TERM / drug_.
   Drag across `neue Zeile`, choose _FORMATTING_COMMAND / newline_. Drag across `sechs null`,
   choose _NUMBER_, value `6/0`, rendering _words_. Overlaps are fine: mark `eintausendfuenfhundert`
   as a _NUMBER_ inside the measurement.
6. **Recording conditions** (right column): header facts, derived speech rate and the distance
   estimate with its RMS, peak and noise-floor numbers. Override either value.
7. Changes autosave. Click **Mark done**, go back to the queue and click **Export JSONL**.
8. **Ingest page**: upload `demo/transcripts-with-errors.json` to see the per-row validation report
   (missing fields, duplicates, a non-object row, and a valid row without audio that lands in the
   pairing list). Upload any `.wav`, `.mp3` or `.m4a` of your own; a `.txt` or a fake `.wav` is
   rejected with a reason. Pair the unmatched transcript with any unpaired recording, or paste a
   transcript on an item's page.

Keyboard shortcuts are listed in the item page under _Keyboard shortcuts and mouse actions_.

## Tests

```bash
yarn test          # unit + integration (integration needs the compose database running)
yarn test:unit     # unit tests only
yarn test:e2e      # Playwright smoke test against a running `yarn dev`
yarn typecheck && yarn lint
```

- **Unit** (`shared/src`, `server/src`, `web/src`): the 15-second routing rule at its boundary,
  transcript JSON validation, unit normalization, span attribute schemas, span shifting on text
  edits, the WAV decoder and level analysis on synthesized signals. No binary fixtures.
- **Integration** (`server/test`): the Express API against the `annotation_test` database that
  the compose file creates. Upload routing, size and type rejection, pairing in both directions,
  the pairing report, span persistence and validation, export shape and override precedence.
- **End to end**: opens the seeded queue, annotates an item and checks the export.

## Project layout

```
shared/   pure TypeScript used by both sides: tokenizer, routing rule, units, span schemas
server/   Express 5 + Prisma 7 API, audio analysis, seed script, integration tests
web/      Vue 3 (Composition API, <script setup>) single-page app on Vite
demo/     demo recordings and transcripts used by the seed
docs/     implementation plan and decision log
```

## Troubleshooting

- **Port 5432 already in use**: stop the other PostgreSQL, or change the host port in
  `docker-compose.yml` and set `DATABASE_URL` in `server/.env` to match.
- **`yarn: command not found`**: run `corepack enable` (Node 22 ships corepack).
- **Integration tests fail to connect**: `docker compose up -d` must be running; the test database
  `annotation_test` is created automatically the first time the volume is initialised.
- **Uploaded mp3/m4a shows "ffmpeg not found"**: install ffmpeg or set `FFMPEG_PATH`.
