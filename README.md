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
yarn install               # dependencies, generates the Prisma client
yarn setup                 # database migration and demo seed
yarn dev                   # API on :3000, web app on http://localhost:5173
```

Open <http://localhost:5173>. Everything is configured with working defaults; copy
`server/.env.example` to `server/.env` only if you need to change a port, the storage folder or
the upload limit.

## Demo path (about five minutes)

`yarn setup` seeds the demo recordings from `demo/` through the real ingest code, so the queue is
populated on first start. Every step below names the exact value to enter; the transcript in
`demo/transcripts.json` contains deliberate recognition errors for you to correct. It has no
punctuation on purpose: dictated commands such as "Punkt" or "neue Zeile" arrive as words in a
first-pass transcript, and marking them is what FORMATTING_COMMAND spans are for.

1. **Queue** (home page). Three items: two over 15 s are _Pending_, `003_kurznotiz.wav` is under
   15 s and _Auto-rejected_. Choose _Pending_ in the _Status_ filter, then click the _Duration_
   column header to sort.
2. Click **001_leistenhernie.wav**. Type your name into the _Annotator_ box in the header; it is
   saved with the item.
3. **Player.** Press **Alt+K** to play and pause, **Alt+J** / **Alt+L** to jump 3 s, **Alt+,** /
   **Alt+.** to change speed. Click any word to jump the audio near it. Expand _Keyboard shortcuts
   and mouse actions_ at the bottom of the transcript for the full list.
4. **Correct the text.** Click _Edit text_ (or press **Alt+E**). Change `Cefuroxin` to
   `Cefuroxim`, `Leisten Hernie` to `Leistenhernie`, and `Proleen` to `Prolene`. Click _Annotate_
   to return. There is no save button: every change is saved about a second after you make it,
   and the header goes from _Unsaved changes_ to _✓ Saved_ (usually too fast to notice).
   **Ctrl+S** saves immediately.
5. **Add spans** (in _Annotate_ mode; the form appears on the right after each selection):
   - Click `Cefuroxim`. Choose _MEDICAL TERM_, category _drug_, note `Single-Shot-Antibiose`.
     Click _Add span_.
   - Drag from `eintausendfuenfhundert` to `Milligramm`. Choose _MEASUREMENT_, value `1500`,
     unit `mg`; the form shows the normalized `1.5 g`. Click _Add span_.
   - **Shift-click** `eintausendfuenfhundert` (inside the measurement). Choose _NUMBER_,
     rendering _words_, normalized value `1500`. Click _Add span_. The word now carries both spans.
   - Drag from the first `neue` to the following `Zeile`. Choose _FORMATTING COMMAND_, command
     _newline_, meaning _command_. Click _Add span_.
   - Drag from `sechs` to `null`. Choose _NUMBER_, rendering _words_, normalized value `6/0`.
     Click _Add span_.
   - Drag from `Klaus` to `Mueller`. Choose _NAMED ENTITY_, kind _person_. Click _Add span_.
   - **Edit a span:** click `Cefuroxim` again, change the note, click _Update_. Dragging exactly
     over a span's words, for example `Klaus` to `Mueller` again, opens that span as well.
     **Delete a span:** open it either way, or pick it from the _Spans_ list, then click _Delete_.
6. **Recording conditions** (right column). Header facts, the derived speech rate and the distance
   estimate with its level figures. Type `120` into the speech-rate _Override_ and pick `medium`
   in the distance _Override_; the export uses these instead of the derived values.
7. Click **Mark done**. Back in the queue, click **Export JSONL** and open the downloaded file:
   one line for the item with both transcripts, all spans and the recording conditions.
8. Open **002_tur_prostata.wav** for the remaining type: drag from `C` to `M` in
   `C wie Caesar E F U R O X I M`, choose _SPELLED OUT_, resolved word `Cefuroxim`, click
   _Add span_. Also mark `Universitaetsklinikum Essen` as _NAMED ENTITY / organisation_ and
   `zwanzig Scharrier` as _MEASUREMENT_ `20` `Ch` after correcting `Scharrier` to `Charriere`.
9. **Ingest page.** Upload `demo/transcripts-with-errors.json` under _Transcript file_ to see the
   per-row report: a duplicate path, a missing label, a missing path, a duplicate within the file,
   a non-object row, and one valid row without audio that lands in _Transcripts without audio_.
   Under _Audio files_, upload any `.wav`, `.mp3` or `.m4a` of your own; a `.txt` or a renamed
   non-audio file is rejected with a reason. Select the unmatched transcript and an unpaired
   recording and click _Pair selected_, or open an item without transcript and paste one.

## Tests

```bash
yarn test          # unit + integration (integration needs the compose database running)
yarn test:unit     # unit tests only
yarn test:e2e      # Playwright smoke test against a running `yarn dev`
yarn typecheck && yarn lint
```

- **Unit** (`shared/src`, `server/src`, `web/src`): the 15-second routing rule at its boundary,
  transcript JSON validation, unit normalization, span attribute schemas, span shifting on text
  edits, the WAV decoder and level analysis on synthesized signals. WAV files are synthesized in
  memory; two 7 KB clips in `server/test/fixtures` cover mp3 and m4a.
- **Integration** (`server/test`): the Express API against the `annotation_test` database that
  the compose file creates. Upload routing, size and type rejection, pairing in both directions,
  the pairing report, span persistence and validation, export shape and override precedence.
- **End to end**: opens the seeded queue, annotates an item and checks the export. It edits the
  demo item `001_leistenhernie.wav` and undoes its changes, but the item stays _In progress_;
  `yarn db:reset` returns the demo data to a pristine state.

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
- **Start over**: `yarn db:reset` drops the database, re-applies the migration, clears uploaded
  files and reseeds the demo data.
