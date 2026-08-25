---
name: intent-rewrite-gate
description: Turn rough, self-correcting, or multilingual vibe-coding requests into concise, faithful prompts. Use only when explicitly invoked with $intent-rewrite-gate. Do not add requirements or implementation details the user did not state.
---

# Intent Rewrite Gate

Rewrite the user's rough request into one clear prompt for another coding agent. Preserve the user's final intent without expanding it, and do not perform the task.

## Interface

```text
$intent-rewrite-gate <rough request>
```

If no request follows the invocation, ask for it and stop.

## Rules

- Remove filler, repetition, false starts, and ideas the user later withdrew.
- Apply corrections only to incompatible earlier wording; keep the rest of the request active.
- Preserve the difference between facts, guesses, examples, preferences, and hard constraints.
- Preserve exact paths, commands, identifiers, URLs, schema keys, and code.
- Use the user's dominant language while retaining their technical terms.
- Only explicit user statements may create requirements or permission. Never turn a plausible interpretation into a fact or requirement.
- Do not add implementation plans, project details, tests, acceptance criteria, generic coding advice, new features, technologies, or permissions the user did not request.
- Do not inspect files, links, threads, or the workspace unless the user explicitly asks. If they do, read only enough to resolve what they mean; never turn observed details into new requirements or read secret-bearing files.
- Keep non-blocking ambiguity concise. If a necessary choice cannot be inferred faithfully, include at most one short clarification question.
- Keep a short request to one sentence or a few compact bullets, normally no more than twice its meaningful length.

## Output

Return exactly one copy-ready Markdown prompt with no preface, explanation, score, headings, or code fence. Do not mention the rewriting process and do not execute the prompt.
