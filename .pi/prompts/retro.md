---
description: Review this session for workflow improvements and persist retro notes to docs/retro/
deterministic:
  run: |
    echo "=== Recent commits ==="
    git log --oneline -25
    echo
    echo "=== Existing retros ==="
    ls docs/retro/ 2>/dev/null || echo "(docs/retro/ does not exist yet)"
    echo
    echo "=== Plans referenced this session ==="
    ls -t docs/plans/ 2>/dev/null | head -5
  handoff: always
---

# Review session and persist retro notes

The user wants a retrospective on this session. Issue number (if provided): `$1`

You **must** load the `ask-user` skill before proposing any changes.

## Step 1 — Identify the retro file

1. If `$1` is set, treat it as the issue number `N`.
2. Otherwise, infer `N` from the most recent commit subject in the deterministic output above (look for `(#N)` at the end of `feat:`, `fix:`, or `docs:` commits). If multiple issues appear, list them and ask the user which to retro on with `ask-user`.
3. Resolve a slug from `docs/plans/NNNN-<slug>.md` if a matching plan exists; otherwise derive a short slug from the issue title via `gh issue view N --json title -q .title`.
4. The retro file is `docs/retro/NNNN-<slug>.md`. Create the directory if missing.

## Step 2 — Synthesize observations

Review what happened across this session — the user prompts, your tool calls, corrections, rework, and commits. Be specific: cite file paths, commit subjects, and concrete tool sequences. Categorize each friction point with one label:

- `premature-convergence` — picked the first viable approach without exploring alternatives
- `missing-context` — didn't check existing code, docs, conventions, or upstream specs
- `wrong-abstraction` — operated at the wrong level (mechanical when strategy was needed, or vice versa)
- `scope-drift` — went beyond what was asked or missed the actual ask
- `rabbit-hole` — chased symptoms instead of questioning assumptions
- `instruction-violation` — had clear instructions in `AGENTS.md` or the prompt but didn't follow them
- `permission-regression` — a code change weakened a default, broadened a wildcard, or skipped an `ask` gate without an explicit goal in the plan
- `other` — describe

For each friction point describe the **concrete impact**: time wasted, rework caused, follow-up commits needed, or "added friction but no rework."

Note whether each `instruction-violation` was **self-identified** (you caught it mid-session) or **user-caught** (the user pointed it out).
Self-identified failures usually indicate a salience tweak; user-caught failures may indicate the rule needs to be more prominent.

### Bidirectional feedback

Look for moments where the user could have shared context earlier, intervened with a redirecting question instead of a correction, or where their involvement was mechanical oversight rather than strategic judgment. Frame as opportunity, not criticism.

### Novel wins only

Record wins only if they are novel or surprising — a new pattern working for the first time, a tool proving its value, a notably clean execution. Skip routine successes.

## Step 3 — Write the retro file

Append (or create) `docs/retro/NNNN-<slug>.md` with this structure.
When creating a new file, include YAML frontmatter (see `AGENTS.md` § Documentation frontmatter):

```markdown
---
issue: N
issue_title: "<exact title from `gh issue view N`>"
---

# Retro: #N — <issue title>

## Final Retrospective (<ISO timestamp>)

### Session summary

2–3 sentences on what was accomplished.

### Observations

#### What went well

- ...

#### What caused friction (agent side)

- `<label>` — <description>. Impact: <concrete impact>.

#### What caused friction (user side)

- ...
```

Wrap all code identifiers, filenames, route paths, CLI names, and any text containing underscores in backticks. Use sequential numbering in ordered lists.

## Step 4 — Present highlights and proposals (before asking)

Surface the synthesis as regular message text **before** invoking `ask-user`. The message must include:

1. **Cross-session highlights** — 2–4 short paragraphs synthesizing dominant friction patterns and any wins worth promoting. Not a copy of the retro file — the bridge between observations and proposals.
2. **Per-proposal context** — for each proposed change: the concrete pain (with tool-call counts or specific examples), why the proposed location is the right home, and the proposed content as a fenced block.
3. **What you considered but did not propose** — name candidate changes you rejected and why.

Candidate change locations for this repo:

- `AGENTS.md` — project-wide priorities, code style, conventions.
- `.pi/prompts/*.md` — slash-command prompt bodies.
- `README.md`, `schemas/permissions.schema.json`, `config/config.example.json` — keep aligned per `AGENTS.md`.
- New skill or new prompt — only if the rule is reusable across many sessions.

## Step 5 — Ask before editing

Use the `ask-user` skill once to confirm which proposals to implement. The question itself stays a single sentence; the context belongs in the message above.

## Step 6 — Implement approved changes (with scope discipline)

The retro session is scoped to **observations and small consensus-driven adjustments**, not substantive rework. A retro commit (`docs(retro): ...`) should land the retro file plus small (~1–3 file) prompt or `AGENTS.md` adjustments the user explicitly confirmed.

If a proposed change is larger — touches more than ~3 files, restructures content significantly, or rewrites a prompt's scope — record it in the retro file as a follow-up but **do not** implement it inline. Suggest the user open a GitHub issue and run `/plan-issue` on it.

## Step 7 — Verbosity check before landing changes

Retro-driven additions to `AGENTS.md` and prompt bodies should land as **rule + tight example**, not **rule + rationale + worked example**. The retro file is the right home for rationale and worked examples.

Before landing any change, ask:

1. **Rationale placement** — is the _why_ in the retro file, or has it leaked into `AGENTS.md`/prompt? If the latter, move it back and leave a one-clause justification (or a `Refs #N` pointer).
2. **Example tightness** — can the example fit in one or two lines?
3. **Hedging audit** — phrases like "should generally," "typically," "usually" often signal the rule isn't crisp enough. Name the exceptions or drop the hedge.
4. **Sentence length** — sentences over ~30 words usually carry rationale that should be split out.

## Step 8 — Record changes made

After implementing, edit the retro file directly to append a `### Changes made` subsection under the Final Retrospective stage entry — a numbered list of changes with file paths. Do not split this into multiple sections; one coherent list per retro.

## Step 9 — Commit and push

1. `git add docs/retro/ AGENTS.md .pi/prompts/` (and any other touched files).
2. Commit as `docs(retro): add retro notes for issue #N`.
3. `git push`.

If the user suggests further refinements after the commit, implement them, append to the same `### Changes made` section, and commit again. Every change made during the retro must be recorded before the session ends.

## Rules

- Be conservative — only propose changes clearly justified by evidence in this session.
- Be specific — provide exact proposed text, not vague suggestions.
- Look for removals alongside additions.
- Don't duplicate — check whether a rule already exists in `AGENTS.md` or a prompt before adding.
- Do not edit `CHANGELOG.md` — release-please owns it.
