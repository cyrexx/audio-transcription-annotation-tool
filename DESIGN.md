# Design notes

## Data model

Three tables. **Item** is one uploaded audio file: header facts read on the server (duration,
sample rate, channels, bit depth, container, codec, bext/INFO metadata), signal levels, routing
status, annotator, the corrected text and the two overrides. **Transcript** is one row of an
uploaded JSON file or one pasted text and is never modified; the item points at it through a
nullable unique foreign key. **Span** is a typed annotation over a token range of the corrected
text, attributes in a JSON column.

Audio and transcripts are separate rows because pairing is the messy part of the brief: either
side can arrive first or be missing, and nothing may be dropped. An unmatched transcript is a row
nobody points at; unmatched audio is an item with a null key. Pairing flips that key. Keeping the
model's label on Transcript and the annotator's version on Item is what makes the original
immutable. Span attributes are a Zod discriminated union in `shared`, used by the server to
validate every save and by the client to build the form; MEASUREMENT normalization runs through the
same shared function on save.

## Decisions and trade-offs

**Token ranges, not character offsets.** Everything in the brief is word-level. Whitespace
tokenization is deterministic and shared; selection is click, drag or shift-click on words; the
export adds character offsets and the covered text so consumers need no tokenizer.

**Spans follow text edits.** Old and new token lists are diffed into hunks (common prefix and
suffix, then a longest common subsequence over the rest), so a keystroke is one tiny hunk and a
pasted paragraph is one hunk per changed place. Spans before a hunk stay, after it shift,
overlapping it stretch to cover the edited words, empty ones drop. Text and spans are saved together
in one `PUT`, so the server can reject a span that runs past the text.

**Overlapping spans are supported.** A NUMBER inside a MEASUREMENT or a SPELLED_OUT inside a
NAMED_ENTITY are real cases. Ranges are independent; a word is coloured by its innermost span and
underlined by the outer one.

**Word click to timestamp is an estimate.** The format carries no timings and aligners are out of
scope, so time is interpolated from character position over the server-read duration.

**Audio facts are read once, on the server, at upload.** `music-metadata` parses all three
formats, which also validates content regardless of extension. Levels need samples: WAV is decoded
natively, so demo, tests and the clinical format never need ffmpeg; mp3/m4a use ffmpeg when present
and otherwise say why the estimate is unavailable. `ffmpeg-static` was rejected: an 80 MB download
inside `yarn install` is a worse failure than a labelled gap in an optional estimate.

**Distance estimate.** RMS and peak over the file, plus RMS over 50 ms windows: the 10th percentile
is the noise floor (pauses), the 90th the speech level, their difference the level-to-noise ratio.
Close is ratio ≥ 30 dB and RMS ≥ −25 dBFS; far is ratio < 15 dB or RMS < −40 dBFS; medium is the
rest. Labelled a heuristic in the UI; fooled by normalization and automatic gain control.

**One request per uploaded file**, one verdict each, no half-done batches. Files live on disk under
a UUID name; the database stores the relative path.

**Queue filter and sort are client-side.** One annotator and a few hundred items at most.

**Export.** One object per line: audio reference, status, annotator, both transcripts, spans (type,
token range, character range, text, attributes) and recording conditions. Speech rate and distance
carry the effective value plus a `source` of `annotator` or `derived`: the override wins without
hiding that it was one. `DONE` items only by default, a checkbox includes unfinished ones.

## Ambiguities resolved

- The "CRUD" bullet is read as correcting, adding and deleting tokens, not a seventh span type.
- Duplicate paths: first row wins, later ones are rejected with the row number, also across
  imports. Matching is by exact basename.
- Unpairing discards corrected text and spans, since they referred to that transcript.
- Annotator is a name typed once in the header and saved on the item; no accounts.
- Speech rate uses the corrected transcript, the text that is exported.
- Auto-rejected items are visible and playable but read-only.

## Stack

No deviations. Yarn 4 via corepack, Prisma 7.10 pinned (npm `latest` is an 8.0 RC), TypeScript 6.0
(7.0 is not yet supported by typescript-eslint).

## Cut for time, and next

- Resizing a span means delete and recreate; a drag handle on the highlight is the next step.
- Number keys to pick the span type after selecting, and a waveform under the seek bar.
- Deleting items, server-side paging, a production build served by Express.
- If the model ever emits word timings, the transcript schema can carry them and replace the
  interpolation without touching spans.
