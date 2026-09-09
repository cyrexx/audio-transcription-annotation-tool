# Demo data

`yarn db:seed` pushes `audio/` and `transcripts.json` through the real ingest code, so a reviewer
sees the tool populated within a minute of starting it. `upload/` is left for the reviewer.

| File                           | Purpose                                                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `audio/001_leistenhernie.wav`  | Seeded. Dictation over 15 s, routed to a human                                                                                                 |
| `audio/003_kurznotiz.wav`      | Seeded. Dictation of 15 s or under, auto-rejected                                                                                              |
| `upload/002_tur_prostata.wav`  | Not seeded: the reviewer uploads it and watches it pair with its waiting transcript                                                            |
| `transcripts.json`             | First-pass AI transcripts in the production format, with typical model errors left in; the rows for 002 (until uploaded) and 004 have no audio |
| `transcripts-with-errors.json` | Upload this by hand on the Ingest page to see the validation report                                                                            |

The recordings are read by a human speaker from the scripts below. Between them, the two long
clips cover every annotation type at least once. The punctuation in the scripts is
only there for the reader. Where a script spells out "Punkt", "Komma", "Doppelpunkt", "neue
Zeile" or "Absatz", the speaker dictates that word, and the model transcripts in `transcripts.json`
contain it as a word; ordinary commas and periods in the scripts are pauses and appear nowhere in
the transcripts, exactly like real first-pass output. Turning those words into layout is what
FORMATTING_COMMAND spans record.

## Script 1: `audio/001_leistenhernie.wav` (28 s)

> Operationsbericht. Patient Klaus Müller, geboren am zwölften März neunzehnhundertsechzig.
> Diagnose Doppelpunkt Leistenhernie rechts. Neue Zeile.
> Single-Shot-Antibiose mit Cefuroxim eintausendfünfhundert Milligramm. Neue Zeile.
> Hautschnitt in der rechten Leiste, Präparation des Samenstrangs, Reposition des Bruchsacks.
> Verschluss mit Prolene sechs null fortlaufend. Absatz.
> Blutverlust circa fünfzig Milliliter. Punkt.

Covers: NAMED_ENTITY (person, date), MEDICAL_TERM (diagnosis, drug, anatomy, procedure, device),
MEASUREMENT (1500 mg, 50 ml), FORMATTING_COMMAND (colon, newline, paragraph, period),
NUMBER ("sechs null" meaning 6/0).

## Script 2: `upload/002_tur_prostata.wav` (34 s)

> Universitätsklinikum Essen, Klinik für Urologie.
> Transurethrale Resektion der Prostata am dritten September zweitausendsechsundzwanzig.
> Antibiose mit Cefuroxim, ich buchstabiere: C wie Cäsar, E, F, U, R, O, X, I, M. Neue Zeile.
> Einlage eines Dauerkatheters zwanzig Charrière Komma Spülung mit zwei Liter Kochsalzlösung. Punkt.
> Blutdruck intraoperativ stabil bei einhundertzwanzig zu achtzig Millimeter Quecksilbersäule.
> Auf dem Monitor erschien zeitweise nur ein Bindestrich. Absatz.

Covers: NAMED_ENTITY (organisation, place, date), SPELLED_OUT (Cefuroxim), MEDICAL_TERM
(procedure, anatomy, drug, device), MEASUREMENT (20 Ch, 2 l, 120 mmHg), FORMATTING_COMMAND
(newline, comma, period, paragraph), plus "Bindestrich" used as a literal word rather than a command.

## Script 3: `audio/003_kurznotiz.wav` (7 s, under the 15-second limit)

> Kurznotiz. Patient nüchtern, Prämedikation mit Midazolam siebeneinhalb Milligramm oral.

Exists only to show the auto-reject rule.

## Recording notes

- Any of `.wav`, `.mp3`, `.m4a` works. WAV is preferred because the tool then reads bit depth
  and RIFF metadata from the header, and no ffmpeg is needed for the signal analysis.
- Mono, 16 kHz or 22.05 kHz, 16-bit keeps each file around 1 MB. Higher rates are fine but bigger.
- Speak at a normal dictation pace. Pauses between sentences are realistic.
