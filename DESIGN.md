# Design notes

## Data model

Three tables. **Item**: one uploaded audio file with the header facts read on the server, signal
levels, routing status, annotator, corrected text and the two overrides. **Transcript**: one row of
an uploaded JSON file or one pasted text, never modified; the item points at it through a nullable
unique foreign key. **Span**: a typed annotation over a token range of the corrected text, with
attributes in a JSON column validated by a Zod discriminated union shared with the client.

Audio and transcripts are separate rows because pairing is the messy part: either side can arrive
first or be missing, and nothing may be dropped. An unmatched transcript is a row nobody points at,
unmatched audio an item with a null key; pairing flips that key. Keeping the model's label on
Transcript and the annotator's version on Item is what makes the original immutable.

## Decisions and trade-offs

**Token ranges, not character offsets.** Everything in the brief is word-level. Whitespace
tokenization is deterministic and shared; selection is click, drag or shift-click on words; the
export adds character offsets and the covered text so consumers need no tokenizer.

**Spans follow text edits.** Old and new token lists are diffed into hunks (common prefix and
suffix, then a longest common subsequence), so a keystroke is one tiny hunk and a pasted paragraph
one hunk per changed place. Spans before a hunk stay, after it shift, overlapping it stretch, empty
ones drop. Text and spans are saved in one `PUT`, so the server can reject a span past the text.

**Overlapping spans are supported.** A NUMBER inside a MEASUREMENT is a real case. Ranges are
independent; a word is coloured by its innermost span and underlined by the outer one.

**Word click to timestamp is an estimate**, interpolated from character position over the
server-read duration: the format carries no timings and aligners are out of scope.

**Audio facts are read once, on the server, at upload.** `music-metadata` parses all three formats
and thereby validates the content. Levels need samples: WAV is decoded natively, so demo, tests and
the clinical format never need ffmpeg; mp3/m4a use ffmpeg when present and otherwise say why the
estimate is unavailable. `ffmpeg-static` was rejected: an 80 MB download inside `yarn install` is a
worse failure than a labelled gap in an optional estimate.

**Distance estimate.** RMS over 50 ms windows: the 10th percentile is the noise floor (pauses), the
90th the speech level, their difference the level-to-noise ratio. Close is ratio ≥ 30 dB and speech
≥ −25 dBFS; far is ratio < 15 dB or speech < −40 dBFS; medium is the rest. Speech level rather than
whole-file RMS, because RMS sinks with every pause. Labelled a heuristic; fooled by normalization
and automatic gain control.

**One request per uploaded file**, one verdict each; files live on disk under a UUID name, the
database stores the relative path. **Queue filter and sort are client-side**: one annotator, a few
hundred items at most.

**Export.** One object per line: audio reference, status, annotator, both transcripts, spans (type,
token range, character range, text, attributes) and recording conditions. Speech rate and distance
carry the effective value plus a `source` of `annotator` or `derived`. `DONE` items by default; a
checkbox includes unfinished ones.

## Ambiguities resolved

- "CRUD" is read as correcting, adding and deleting tokens, not a seventh span type.
- Duplicate paths: first row wins, later ones are rejected with the row number, also across
  imports. Matching is by exact basename.
- Unpairing discards corrected text and spans, since they referred to that transcript.
- Annotator is a name typed once in the header: provenance, not a permission. Editing works
  without it; the page only points out when it is missing.
- Speech rate uses the corrected transcript, the text that is exported.
- Auto-rejected items are visible and playable but read-only.
- No error rate is computed: "we compare against it to compute error rates" explains why the
  original stays immutable; the rate belongs to the evaluation pipeline and its normalization
  rules, and the export carries both transcripts for it.

## Stack

No deviations. Yarn 4 via corepack, Prisma 7.10 pinned (npm `latest` is an 8.0 RC), TypeScript 6.0
(7.0 is not yet supported by typescript-eslint).

## Cut for time, and next

- Keyboard-only word selection (a token cursor on the arrow keys); a waveform under the seek bar.
- Drag handles on a span's highlight; boundaries currently move one word at a time from the form.
- Deleting items, server-side paging, a production build served by Express.
- If the model ever emits word timings, the transcript schema can carry them and replace the
  interpolation without touching spans.
