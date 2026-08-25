# Evaluation guide

The suite contains 21 behavior-oriented cases. It compares two systems:

- `intent-rewrite-gate`: the complete Skill policy.
- `generic-rewrite`: a minimal “rewrite this clearly for a coding agent” baseline.

The baseline is not GitHub Copilot `/refine`; no reproducible adapter for that product is included.

> **Snapshot status:** The checked-in `v0.1` snapshot is invalidated. Its generation
> prompt exposed behavior annotations to the candidate systems. The runner now hides
> those annotations, but the stored outputs and scores predate that fix and must not be
> used as comparative evidence.

## Metrics

- Final-intent coverage: preserved `must_preserve` items / all required items.
- Unsupported-requirement rate: unsupported requirements / compiled requirements.
- All-criteria case pass rate: full preservation, no unsupported requirements, correct strength/correction/ambiguity handling, valid output contract, and any declared expansion limit.
- Expansion ratio: output characters / input characters.

Semantic metrics require judgment; character ratios and corpus coverage are deterministic. A model-judged snapshot must never be described as human evaluation.

## Validate the corpus

```bash
python evals/run_eval.py validate
```

## Reproduce a snapshot with Codex

Generate one schema-constrained batch for each system from the Skill root:

```bash
python evals/run_eval.py prompt --system intent-rewrite-gate \
  | codex exec --ephemeral --skip-git-repo-check -s read-only \
      -C evals/fixtures/workspace \
      --output-schema evals/batch-output.schema.json \
      -o /tmp/intent-rewrite-gate.json -

python evals/run_eval.py prompt --system generic-rewrite \
  | codex exec --ephemeral --skip-git-repo-check -s read-only \
      -C evals/fixtures/workspace \
      --output-schema evals/batch-output.schema.json \
      -o /tmp/generic-rewrite.json -
```

Import both outputs, recording the actual model shown by Codex:

```bash
python evals/run_eval.py ingest --system intent-rewrite-gate \
  --model MODEL_NAME --batch /tmp/intent-rewrite-gate.json
python evals/run_eval.py ingest --system generic-rewrite \
  --model MODEL_NAME --batch /tmp/generic-rewrite.json
```

Create a separate semantic judge pass:

```bash
python evals/run_eval.py judge-prompt \
  | codex exec --ephemeral --skip-git-repo-check -s read-only \
      --output-schema evals/judgments.schema.json \
      -o /tmp/intent-rewrite-judgments.json -
python evals/run_eval.py ingest-judgments --model MODEL_NAME \
  --batch /tmp/intent-rewrite-judgments.json
python evals/run_eval.py report
```

For stronger evidence, repeat with fresh per-case invocations, multiple models, and blinded human reviewers. Keep raw outputs and judgments so claims remain auditable.

## Critical failures

Treat any lost negation, revived withdrawal, invented product decision or authorization, fabricated project fact, secret access, unnecessary repository dump, or execution of the downstream task as critical.
