# Implementation plan

Working document for the build. `README.md` is for running the tool, `DESIGN.md` for the
reasoning. This file tracks scope, decisions, and progress.

## Requirement checklist

Legend: `[ ]` open, `[x]` done, `[-]` cut (reason in DESIGN.md).

### Ingest

- [x] Audio upload: `.wav`, `.mp3`, `.m4a`; single or multiple files; type validated by parsing
      the file, not by extension; size limit; clear per-file accept/reject.
- [x] Files stored on disk, database stores a reference.
- [x] Transcript upload: JSON array of `{ path, label }`.
- [x] Paste a transcript for one item in the UI.
- [x] Pairing by filename; unmatched shown on both sides; manual pair and unpair.
- [x] Bad input reported: malformed JSON rejects the file with the parser's message; missing
      fields, duplicate paths, audio without transcript and transcript without audio are reported
      per row; good rows kept.

### Work queue

- [x] List with filename, duration, status, annotator.
- [x] Duration read server-side from the file.
- [x] Filter and sort by status and duration.
- [x] Routing rule: duration > 15 s goes to a human, 15 s and under is auto-rejected.

### Audio player

- [x] Play/pause, seek, playback speed, jump back/forward.
- [x] Keyboard shortcuts for all of the above, documented in the UI.
- [x] Click a word to jump to its (estimated) timestamp.

### Transcript editing

- [x] Original transcript immutable; corrected transcript stored separately and freely editable.

### Annotation

- [x] Spans with type and typed attributes; create, edit, delete.
- [x] NUMBER, FORMATTING_COMMAND, SPELLED_OUT, NAMED_ENTITY, MEDICAL_TERM, MEASUREMENT.
- [x] Overlapping spans supported (decision below).

### Recording conditions

- [x] Header facts: duration, sample rate, channels, bit depth, bext and LIST INFO metadata.
- [x] Derived speech rate in words per minute.
- [x] Derived distance estimate from signal level, labelled as an estimate.
- [x] Both derived values overridable; override is what gets exported.

### Export

- [x] JSONL, one item per line: audio reference, original, corrected, spans with attributes,
      recording-condition values.

### Deliverables

- [x] README: prerequisites, install, run, demo path, tests, Node version.
- [x] Demo path: seed script plus committed demo audio and transcripts.
- [x] Tests: routing rule, pairing, span persistence, unit normalization.
- [x] DESIGN.md, one page.

### Explicitly out of scope

Auth, users, roles, multi-annotator workflows, review queues, deployment, CI, cloud,
running or training a speech model, automatic pre-annotation.

## Decisions

| #   | Decision                                                                                                                                                              | Reason                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | Yarn 4 via corepack, workspaces `shared`, `server`, `web`                                                                                                             | Ships with Node 22; shared pure logic used by both sides                                |
| 2   | Spans are token ranges over the corrected text (whitespace tokenization)                                                                                              | Every feature is word-level; click and shift-click selection; no Selection API          |
| 3   | Text edits shift spans via a token diff: common prefix and suffix, then LCS hunks (the first version used a single window and merged spans between two distant edits) | Keeps spans valid without locking the text                                              |
| 4   | Overlapping spans allowed                                                                                                                                             | NUMBER inside MEASUREMENT and SPELLED_OUT inside NAMED_ENTITY are real cases            |
| 5   | Word timestamps interpolated from character position over duration                                                                                                    | Transcript has no timestamps; aligners are out of scope                                 |
| 6   | "CRUD" in the brief is token editing, not a seventh span type                                                                                                         | The brief says six types and lists six besides it                                       |
| 7   | One `PUT /api/items/:id/annotation` replaces text, spans and overrides atomically                                                                                     | Text and spans must stay consistent; autosave is simpler                                |
| 8   | One request per uploaded file                                                                                                                                         | Each file accepted or rejected independently with a reason                              |
| 9   | WAV decoded natively; mp3/m4a level analysis via system ffmpeg when present                                                                                           | Demo and tests need no ffmpeg; ffmpeg-static rejected as an 80 MB install-time download |
| 10  | Header facts via `music-metadata`                                                                                                                                     | One parser for all three formats, validates the file as a side effect                   |
| 11  | Export DONE items by default, toggle to include unfinished                                                                                                            | Gold standard means finished, but reviewers want to see output quickly                  |
| 12  | Annotator is a name typed once in the UI                                                                                                                              | Brief requires the column but forbids auth                                              |
| 13  | Prisma 7.10 pinned                                                                                                                                                    | npm `latest` tag points at an 8.0 release candidate                                     |
| 14  | TypeScript 6.0                                                                                                                                                        | TypeScript 7 is not yet supported by typescript-eslint                                  |

## Milestones

1. [x] Scaffold: workspaces, lint, format, compose, plan, demo scripts.
2. [x] `shared`: tokenizer, routing rule, unit normalization, annotation schemas, API types. Unit tests.
3. [x] `server`: Prisma schema and migration; audio analysis; ingest, pairing, queue, annotation,
       export routes; seed. Unit and integration tests.
4. [x] `web`: queue, ingest and pairing, item page (player, editor, annotation, conditions),
       shortcut help, export. Unit tests for span shifting.
5. [x] README, DESIGN.md, Playwright smoke test written.
6. [x] Browser verification of the UI and the smoke test; demo recordings committed.

## Review rounds after submission

Each round was an independent, read-only review; findings were fixed on a short branch, tests
first for server-side changes, and merged fast-forward.

1. Security audit (server and client): loopback-only bindings, crafted audio headers, upload and
   body error mapping, silent data loss in autosave, hostile-input limits.
2. Regression review of those fixes: mp3 duration estimates cut the decode off, overrun handling,
   disk errors mapped to the client, a save retry that outlived the page.
3. Final review of the follow-up: in-app navigation bypassed the unload warning, empty
   `FFMPEG_PATH`.
4. Full audit against the brief (requirements traceability, code quality, documentation):
   duration filter missing, help panel incomplete, unit-test script skipping a project, upload
   list reactivity, stale documents; dead code and duplication removed, retry loop dropped.

## Testing strategy

- Unit (Vitest): pure functions in `shared`, `server/src/audio`, `server/src/ingest`,
  `web/src/lib`. WAV files are synthesized in tests; two 7 KB mp3/m4a clips cover the lossy
  formats; ffmpeg-dependent cases skip where ffmpeg is missing.
- Integration (Vitest + supertest): Express app against `annotation_test` in the compose
  Postgres. Covers the 15-second rule end to end, pairing report, span persistence and
  validation, export shape.
- End to end (Playwright, optional): seed, open queue, open item, create span, export.
- Reviewer path: seed pushes `demo/` through the real ingest code; `demo/transcripts-with-errors.json`
  shows the validation report; README lists the click path.
