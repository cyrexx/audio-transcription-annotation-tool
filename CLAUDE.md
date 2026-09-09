# CLAUDE.md

Working rules for AI coding assistants in this repository. The human decides; the assistant
proposes, implements after confirmation, and proves the result.

## What this is

An annotation tool for correcting and tagging first-pass speech-to-text transcripts of German
clinical dictations. One annotator, one machine, localhost. The brief's scope is the law:
authentication, multi-user workflows, deployment, CI, speech models and automatic pre-annotation
are out of scope, and unrequested features count against the work. Read `DESIGN.md` for the
decisions and `docs/PLAN.md` for the requirement checklist before proposing anything.

## Layout and commands

- `shared/` pure TypeScript both sides import: tokenizer, routing rule, units, span schemas,
  API types. Anything that must agree between server and client lives here, once.
- `server/` Express 5 + Prisma 7 on PostgreSQL; `server/src/audio` header facts and levels,
  `server/src/services` ingest, items, export; `server/test` integration tests.
- `web/` Vue 3 with `<script setup>`; `web/src/lib` pure logic with unit tests, `components`,
  `pages`.
- `yarn dev` (migrate, seed, start both), `yarn test` (needs `docker compose up -d --wait`),
  `yarn test:unit`, `yarn test:e2e` (needs a running `yarn dev`), `yarn typecheck`, `yarn lint`,
  `yarn db:reset` (destructive: asks for consent).

## How to work here

1. Read the files you touch in full. Check the real dependency surface before adding a package,
   and say why a new dependency is necessary; prefer the standard library.
2. State assumptions in one or two lines before implementing. If the brief is ambiguous, decide,
   record the decision in `DESIGN.md`, and move on; surface alternatives instead of picking silently.
3. Minimum code for the stated problem. No abstractions for single use, no configurability nobody
   asked for, no error handling for impossible cases. Match the existing style.
4. Surgical diffs. Every changed line must trace to the request; mention adjacent problems,
   do not fix them unasked.
5. Server-side bug fixes start with a failing test (routing rule, pairing, span persistence,
   unit normalization and audio parsing all have suites to extend). UI changes are verified in the
   browser before they are called done; "done" comes with the command and its output.
6. Debug by reproducing, then changing one thing at a time. Never paper over an unexpected
   null with a guard; find out why it is null.
7. Commits: conventional style (`type(scope): imperative subject`), a body that says why, one
   concern per commit, linear history on `main` via short-lived branches merged fast-forward.
   Never rewrite pushed history.
8. Report faithfully: failing tests are reported with their output, skipped steps are named.
