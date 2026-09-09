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
git clone https://github.com/cyrexx/audio-transcription-annotation-tool.git
cd audio-transcription-annotation-tool
corepack enable            # once per machine, makes `yarn` available
docker compose up -d --wait   # PostgreSQL on 127.0.0.1:5432, waits until it accepts connections
yarn install               # dependencies, generates the Prisma client; Corepack asks once to download Yarn: answer Y
yarn dev                   # applies the migration, seeds the demo, starts API :3000 and web app http://localhost:5173
```

Open <http://localhost:5173>. Everything is configured with working defaults; copy
`server/.env.example` to `server/.env` only if you need to change the database URL, the storage
folder or the upload limit. The API port is also fixed in `web/vite.config.ts` (proxy target), so
change both if you change `PORT`.

## Demo path (about five minutes)

`yarn dev` seeds the recordings in `demo/audio` and the transcripts in `demo/transcripts.json`
through the real ingest code on every start (both steps are idempotent), so the queue is populated
on first start. One recording,
`demo/upload/002_tur_prostata.wav`, is deliberately left out of the seed: its transcript row is
already waiting, and you upload the audio yourself in step 8. Every step below names the exact
value to enter. The transcripts contain deliberate recognition errors for you to correct, and no
punctuation on purpose: dictated commands such as "Punkt" or "neue Zeile" arrive as words in a
first-pass transcript, and marking them is what FORMATTING_COMMAND spans are for.

1. **Queue** (home page). Two items: `001_leistenhernie.wav` is over 15 s and _Pending_,
   `003_kurznotiz.wav` is under 15 s and _Auto-rejected_. Choose _Pending_ in the _Status_ filter,
   then click the _Duration_ column header to sort.
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
5. **Add spans** (in _Annotate_ mode; the form appears on the right after each selection. The
   type can also be chosen with **Alt+1** to **Alt+6**, _Enter_ submits, _Esc_ closes the form):
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
     **Resize a span:** with `Klaus Mueller` open, the _Start_ and _End_ arrows move each
     boundary one word at a time; drop `Klaus` to keep only the last name, then add it back.
     **Delete a span:** open it either way, or pick it from the _Spans_ list, then click _Delete_.
6. **Recording conditions** (right column). Header facts, the derived speech rate and the distance
   estimate with its level figures. Type `120` into the speech-rate _Override_ and pick `medium`
   in the distance _Override_; the export uses these instead of the derived values.
7. Click **Mark done**. Back in the queue, click **Export JSONL** and open the downloaded file:
   one line for the item with both transcripts, all spans and the recording conditions.
8. **Ingest page: upload and pairing.** The _Pairing_ section already lists two transcripts
   without audio. Under _Audio files_, upload `demo/upload/002_tur_prostata.wav`: the verdict
   reads _0:34.3, Pending, transcript paired_, because a transcript with that filename was
   waiting. Then upload `demo/transcripts-with-errors.json` under _Transcript file_ to see the
   per-row report. Its rows are, in order: a path already imported, a row without label, a row
   without path, two rows with the same path (the first is accepted), a row that is not an object,
   and a valid row whose audio does not exist. The accepted rows join
   `audio/004_nephrektomie.wav` in _Transcripts without audio_, where the grey text is the start of
   each transcript. Upload any `.wav`, `.mp3` or `.m4a` of your own to pair one manually with
   _Pair selected_; a `.txt` or a renamed non-audio file is rejected with a reason. An item
   without transcript also accepts a pasted transcript on its page.
9. Open **002_tur_prostata.wav** from the verdict link or the queue for the remaining type: drag
   from `C` to `M` in `C wie Caesar E F U R O X I M`, choose _SPELLED OUT_, resolved word
   `Cefuroxim`, click _Add span_. Also mark `Universitaetsklinikum Essen` as
   _NAMED ENTITY / organisation_ and `zwanzig Scharrier` as _MEASUREMENT_ `20` `Ch` after
   correcting `Scharrier` to `Charriere`.

## Tests

```bash
yarn test          # unit + integration (integration needs the compose database running)
yarn test:unit     # unit tests only
yarn playwright install chromium   # once, before the first end-to-end run
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
- **"Can't reach database server" during `yarn dev` or the tests**: `docker compose up -d` must be
  running; the test database `annotation_test` is created automatically the first time the volume
  is initialised.
- **Uploaded mp3/m4a shows "ffmpeg not found"**: install ffmpeg or set `FFMPEG_PATH`.
- **Start over**: `yarn db:reset` drops the database, re-applies the migration, clears uploaded
  files and reseeds the demo data.
