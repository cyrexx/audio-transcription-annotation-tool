# Design notes

## Data model

Three tables. **Item**: one uploaded audio file with the header facts read on the server, signal
levels, routing status, annotator, corrected text and the two overrides. **Transcript**: one row of
an uploaded JSON file or one pasted text, never modified; the item points at it through a nullable
unique foreign key. **Span**: a typed annotation over a token range of the corrected text, with
attributes in a JSON column validated by a Zod discriminated union shared with the client.

Separate rows because either side can arrive first or be missing: an unmatched transcript is a
row nobody points at, unmatched audio an item with a null key, pairing flips that key. The model's
label on Transcript and the annotator's version on Item is what makes the original immutable.

## Decisions and trade-offs

**Token ranges, not character offsets.** Everything in the brief is word-level, so words are the
whitespace tokens of the corrected text, spoken commands like "Punkt" included. Selection is click,
drag or shift-click on words; the export adds character offsets and the covered text.

**Spans follow text edits.** Old and new token lists are diffed into hunks (common prefix and
suffix, then a longest common subsequence): a keystroke is one tiny hunk, a pasted paragraph one
hunk per changed place. Spans before a hunk stay, after it shift, overlapping it stretch, empty
ones drop. Text and spans are saved in one `PUT`, so the server can reject a span past the text.

**Overlapping spans are supported**; a NUMBER inside a MEASUREMENT is a real case. A word is
coloured by its innermost span and underlined by the outer one.

**Word click to timestamp is an estimate** interpolated from character position: the format
carries no timings and aligners are out of scope.

**Audio facts are read once, on the server, at upload.** `music-metadata` parses all three formats
and thereby validates the content; bit depth exists only for PCM. Levels need samples: WAV is
decoded natively, so demo, tests and the clinical format never need ffmpeg; mp3/m4a use ffmpeg
when present and otherwise say why the estimate is missing. System ffmpeg is optional rather than
bundled: `ffmpeg-static` would add an 80 MB download to every `yarn install` for an optional
estimate, and the failure mode without it is a labelled gap in the panel, not a broken install.

**Distance estimate.** RMS over 50 ms windows: the 10th percentile is the noise floor (pauses), the
90th the speech level, their difference the level-to-noise ratio. Close is ratio ≥ 30 dB and speech
≥ −25 dBFS; far is ratio < 15 dB or speech < −40 dBFS; medium otherwise. Speech level, not
whole-file RMS, which sinks with every pause. Labelled a heuristic; fooled by gain control.

**Ingest.** One request per file, one verdict each, 50 MB limit; files live on disk under a UUID
name. Queue filter and sort are client-side: one annotator, a few hundred items at most.

**Export.** One object per line: item id and status, audio reference (filename, the `path` from the
transcript file, storage path, MIME type), annotator, both transcripts, spans (type, token and
character range, text, attributes; no ids, they change on every save) and recording conditions.
Speech rate and distance carry the effective value plus `speechRateSource` and `distanceSource`
(`annotator` or `derived`), so the override wins without hiding that it was one. `DONE` items by
default; a checkbox adds those in progress.

## Ambiguities resolved

- "CRUD" is read as correcting, adding and deleting tokens, not a seventh span type.
- "Base unit" is the unprefixed unit (g, l, m), following the brief's 1500 mg → 1.5 g; mmHg, IE
  and Ch normalize to themselves. "Human names" is the kind `person`.
- Duplicate paths: first row wins, later ones are rejected with the row number, also across
  imports. Matching is by exact, case-sensitive basename.
- Unpairing discards corrected text and spans, since they referred to that transcript.
- Annotator is a name typed once in the header: provenance, not a permission.
- Speech rate uses the corrected transcript, the text that is exported. Status sorts in workflow
  order. Auto-rejected items are visible and playable, can be paired, unpaired and given a pasted
  transcript, but are not annotated.
- No error rate is computed: the brief's sentence explains why the original stays immutable; the
  rate belongs to the evaluation pipeline, and the export carries both transcripts for it.
- Localhost is the security boundary: API and database bind to 127.0.0.1, crafted audio headers
  are rejected, level analysis stops at 60 minutes, and parser failures answer with a 4xx.

## Stack and deviations

No stack deviations. Yarn 4 via corepack, Prisma 7.10 pinned (npm `latest` is an 8.0 RC),
TypeScript 6.0 (7.0 is not yet supported by typescript-eslint). Starting the app is compose,
install and `yarn dev`, which applies the migration and the seed itself.

## Cut for time, and next

- Keyboard-only word selection (a token cursor on the arrow keys); a waveform under the seek bar.
- Drag handles on a span's highlight; boundaries move one word at a time from the form.
- Deleting items, server-side paging, a production build served by Express.
- Word timings from the model, should it emit them: the transcript schema can carry them and
  replace the interpolation without touching spans.
